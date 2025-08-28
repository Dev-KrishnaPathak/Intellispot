import placesService from "../services/placesService.js";
import personalizationService from "../services/personalizationService.js";
import { API_KEYS } from "../config/apiKeys.js";
import * as mapsService from "../services/mapsService.js";
import weatherService from "../services/weatherService.js";
import recommendationAlgo from "../utils/recommendationAlgo.js";

function mergeResults(baseList = [], personalizedList = []) {
  const byId = new Map();
  baseList.forEach(p => byId.set(p.id, { ...p }));
  personalizedList.forEach(p => {
    if (byId.has(p.id)) {
      const existing = byId.get(p.id);
      byId.set(p.id, { ...existing, score: p.score ?? existing.score, reasons: p.reasons || existing.reasons });
    } else {
      byId.set(p.id, { ...p });
    }
  });
  return Array.from(byId.values());
}

async function enrichWithRatings(list = [], topN = 10) {
  try {
    const ids = []
    for (const item of list) {
      if (ids.length >= topN) break
      if (item && item.id && (typeof item.rating !== 'number')) ids.push(item.id)
    }
    if (ids.length === 0) return list
    const unique = Array.from(new Set(ids))
    const details = await Promise.all(unique.map(async (id) => {
      try { return await placesService.getPlaceDetails(id) } catch { return null }
    }))
    const byId = new Map()
    unique.forEach((id, i) => { const d = details[i]; if (d && typeof d.rating === 'number') byId.set(id, d.rating) })
    if (byId.size === 0) return list
    return list.map(item => (byId.has(item.id) ? { ...item, rating: byId.get(item.id) } : item))
  } catch {
    return list
  }
}

export const getRecommendations = async (req, res) => {
  try {
    const { location, userId, query = "sights", radius, categories, limit = 15 } = req.body || {};
    const ll = location && location.lat != null && location.lng != null ? `${location.lat},${location.lng}` : undefined;

    let baseResults = [];
    try {
      baseResults = await placesService.searchPlaces(query, { ll, radius, categories, limit });
    } catch (e) {
      console.error("Base place search failed:", e.message);
    }

    let personalized = [];
    const hasPersKey = !!(process.env.FOURSQUARE_PERSONALIZATION_SERVICE_KEY || API_KEYS.FOURSQUARE_PERSONALIZATION);
    if (ll && hasPersKey) {
      try {
        personalized = await personalizationService.getPersonalizedRecommendations(userId, ll, { limit });
      } catch (e) {
        console.warn("Personalization unavailable:", e.message);
      }
    }

    const merged = mergeResults(baseResults, personalized);

    let enriched = merged;
    try {
      enriched = await mapsService.addTravelData(location, merged);
    } catch (e) {
      console.warn("Travel enrichment failed:", e.message);
    }

    let final = enriched;
    if (recommendationAlgo && typeof recommendationAlgo.rank === 'function') {
      try {
        final = recommendationAlgo.rank(enriched);
      } catch (e) {
        console.warn("Ranking algorithm error, returning unranked list:", e.message);
      }
    }

    let withRatings = final
    try {
      withRatings = await enrichWithRatings(final, 10)
    } catch {}

    res.json({ count: withRatings.length, results: withRatings });
  } catch (error) {
    console.error("Recommendation pipeline error:", error);
    res.status(500).json({ message: "Error fetching recommendations" });
  }
};

export const getRecommendationsQuery = async (req, res) => {
  try {
    const userId = req.query.userId;
    const lat = parseFloat(req.query.lat);
    const lng = parseFloat(req.query.lng);
    const query = req.query.query || 'sights';
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      return res.status(400).json({ error: 'lat and lng query params required' });
    }

    const ll = `${lat},${lng}`;

    const hasPersKey = !!(process.env.FOURSQUARE_PERSONALIZATION_SERVICE_KEY || API_KEYS.FOURSQUARE_PERSONALIZATION);
    let personalization = [];
    if (hasPersKey) {
      try {
        personalization = await personalizationService.getPersonalizedRecommendations(userId, ll, { limit: 20 });
      } catch (e) {
        console.warn('Personalization unavailable:', e.message);
      }
    }

    let places = [];
    try {
      places = await placesService.searchPlaces(query, { ll, limit: 10 });
    } catch (e) {
      console.warn('Places error:', e.message);
    }

    try {
      const location = { lat, lng }
      if (places && places.length) {
        places = await mapsService.addTravelData(location, places)
      }
      if (personalization && personalization.length) {
        personalization = await mapsService.addTravelData(location, personalization)
      }
    } catch (e) {
      console.warn('Travel enrichment (GET) failed:', e.message)
    }

    try {
      if (places && places.length) places = await enrichWithRatings(places, 10)
    } catch {}
    try {
      if (personalization && personalization.length) personalization = await enrichWithRatings(personalization, 10)
    } catch {}

    let weather = null;
    try {
      weather = await weatherService.getWeather({ lat, lng });
    } catch (e) {
      console.warn('Weather error:', e.message);
    }

    res.json({
      recommendations: personalization,
      context: { places, weather }
    });
  } catch (err) {
    console.error('Error fetching recommendations (query variant):', err.message);
    res.status(500).json({ error: 'Failed to fetch recommendations' });
  }
};
