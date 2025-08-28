
import axios from 'axios';
import { API_KEYS } from '../config/apiKeys.js';
const PERSONALIZATION_HOST = process.env.FOURSQUARE_PERSONALIZATION_HOST || 'https://places-api.foursquare.com';

function authValue() {
  const raw = process.env.FOURSQUARE_PERSONALIZATION_SERVICE_KEY || API_KEYS.FOURSQUARE_PERSONALIZATION;
  return raw || null;
}

function headers(extra = {}) {
  const version = process.env.FOURSQUARE_API_VERSION || process.env.FSQ_API_VERSION;
  let vh = {};
  if (version) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(version)) {
      throw new PersonalizationError('FOURSQUARE_API_VERSION must be YYYY-MM-DD (e.g. 2025-06-17)', 500);
    }
    vh = { 'X-Places-Api-Version': version };
  }
  return { Authorization: authValue(), Accept: 'application/json', ...vh, ...extra };
}

class PersonalizationError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = 'PersonalizationError';
    this.status = status;
    this.data = data;
  }
}


const cache = new Map();
const TTL_MS = 1000 * 60; 

function cacheKey(userId, ll) {
  return `${userId || 'anon'}:${ll || 'none'}`;
}

function getCached(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.time > TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

function setCached(key, value) {
  cache.set(key, { value, time: Date.now() });
}

export async function getPersonalizedRecommendations(userId, ll, { limit = 20, radius, categories } = {}) {

  if (!API_KEYS.FOURSQUARE_PERSONALIZATION && !process.env.FOURSQUARE_PERSONALIZATION_SERVICE_KEY) {
    return [];
  }
  if (!ll) {
    throw new PersonalizationError('ll (lat,long) parameter required', 400);
  }


  const key = cacheKey(userId, ll);
  const cached = getCached(key);
  if (cached) return cached;


  try {
    const params = { user_id: userId, ll, limit };
    if (radius) params.radius = radius;
    if (categories) params.categories = Array.isArray(categories) ? categories.join(',') : categories;

    const response = await axios.get(`${PERSONALIZATION_HOST}/personalization/recommendations`, {
      headers: headers(),
      params
    });
    const data = normalizeRecommendations(response.data);
    setCached(key, data);
    return data;
  } catch (err) {
    const status = err.response?.status || 500;
    const payload = err.response?.data;
    console.error('Personalization API error:', status, payload || err.message);
    if (status === 429) {
      throw new PersonalizationError('Rate limit exceeded', status, payload);
    }
    throw new PersonalizationError('Personalization API failed', status, payload);
  }
}

function normalizeRecommendations(apiData) {
  if (!apiData) return [];
  const items = apiData.results || apiData || [];
  return items.map(item => {
    const place = item.place || item;
    return {
  id: place.fsq_id || place.fsq_place_id || place.id,
      name: place.name,
      categories: (place.categories || []).map(c => c.name),
      distance: place.distance,
      score: item.score || null,
      reasons: item.reasons || null,
      geocodes: place.geocodes?.main || null,
      location: place.location && {
        address: place.location.formatted_address,
        locality: place.location.locality,
        region: place.location.region,
        country: place.location.country
      }
    };
  });
}

export default { getPersonalizedRecommendations };
