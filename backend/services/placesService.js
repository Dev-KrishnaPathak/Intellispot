import axios from 'axios';
import { API_KEYS } from '../config/apiKeys.js';

const NEW_HOST = process.env.FOURSQUARE_PLACES_HOST || 'https://places-api.foursquare.com';
const LEGACY_HOST = 'https://api.foursquare.com';

function rawToken() {
  return (
    process.env.FOURSQUARE_SERVICE_KEY ||
    process.env.FSQ_SERVICE_KEY ||
    API_KEYS.FOURSQUARE_PLACES ||
    process.env.FOURSQUARE_API_KEY ||
    process.env.FSQ_API_KEY
  );
}

function authHeaderValue() {
  const t = rawToken();
  if (!t) return null;
  return t.trim();
}


class PlacesError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = 'PlacesError';
    this.status = status;
    this.data = data;
  }
}

function buildHeaders(extra = {}, authOverride) {
  const version = process.env.FOURSQUARE_API_VERSION || process.env.FSQ_API_VERSION;
  let vh = {};
  if (version) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(version)) {
      throw new PlacesError('FOURSQUARE_API_VERSION must be YYYY-MM-DD (e.g. 2025-06-17)', 500);
    }
    vh = { 'X-Places-Api-Version': version };
  }
  const auth = authOverride || authHeaderValue();
  if (!auth) throw new PlacesError('Missing Foursquare API key', 500);
  return { Authorization: auth, Accept: 'application/json', ...vh, ...extra };
}

async function axiosGetWithFallback(path, params) {
  const envHost = process.env.FOURSQUARE_PLACES_HOST;
  const hosts = envHost ? [envHost] : [NEW_HOST, `${LEGACY_HOST}/v3`];
  let lastErr;
  for (const host of hosts) {
    try {
      const base = host.endsWith('/') ? host.slice(0, -1) : host;
      const p = path.startsWith('/') ? path : `/${path}`;
      const url = `${base}${p}`;
      const res = await axios.get(url, { headers: buildHeaders(), params });
      return res;
    } catch (err) {
      lastErr = err;
      continue;
    }
  }
  throw lastErr || new PlacesError('Foursquare request failed', 500);
}

const cache = new Map();
const TTL_MS = 1000 * 60; 

function getCache(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.time > TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

function setCache(key, value) {
  cache.set(key, { value, time: Date.now() });
}

function aliasId(p) {
  if (p && p.fsq_place_id && !p.fsq_id) {
    return { ...p, fsq_id: p.fsq_place_id };
  }
  return p;
}

export async function searchPlaces(query, { near, ll, radius, categories, limit = 10 } = {}) {
  if (!authHeaderValue()) throw new PlacesError('Missing Foursquare API key', 500);
  const params = { query, limit };
  if (near) params.near = near;
  if (ll) params.ll = ll; 
  if (radius) params.radius = radius;
  if (categories) params.categories = Array.isArray(categories) ? categories.join(',') : categories;

  const cacheKey = `search:${JSON.stringify(params)}`;
  const cached = getCache(cacheKey);
  if (cached) return cached;

  try {
    const response = await axiosGetWithFallback('/places/search', params);
    const results = (response.data.results || []).map(r => minifyPlaceSummary(aliasId(r)));
    setCache(cacheKey, results);
    return results;
  } catch (err) {
    handleAxiosError(err, 'searchPlaces');
  }
}

export async function getPlaceDetails(fsq_id) {
  if (!authHeaderValue()) throw new PlacesError('Missing Foursquare API key', 500);
  const cacheKey = `detail:${fsq_id}`;
  const cached = getCache(cacheKey);
  if (cached) return cached;
  try {
    const response = await axiosGetWithFallback(`/places/${fsq_id}`, undefined);
    const data = minifyPlaceDetail(aliasId(response.data));
    setCache(cacheKey, data);
    return data;
  } catch (err) {
    handleAxiosError(err, 'getPlaceDetails');
  }
}

export async function autocomplete(query, { near, ll, limit = 5 } = {}) {
  if (!authHeaderValue()) throw new PlacesError('Missing Foursquare API key', 500);
  const params = { query, limit };
  if (near) params.near = near;
  if (ll) params.ll = ll;
  try {
    const response = await axiosGetWithFallback('/autocomplete', params);
    return (response.data.results || []).map(aliasId);
  } catch (err) {
    handleAxiosError(err, 'autocomplete');
  }
}

// Placeholder: feedback submission (would call a dedicated endpoint or store internally)
export async function sendFeedback(userId, venueId, feedback) {
  if (!userId || !venueId || !feedback) {
    throw new PlacesError('userId, venueId, feedback required', 400);
  }
  // For now just return an echo with timestamp
  return { userId, venueId, feedback, receivedAt: new Date().toISOString() };
}

function minifyPlaceSummary(p) {
  return {
    id: p.fsq_id,
    name: p.name,
    categories: (p.categories || []).map(c => c.name),
    distance: p.distance,
  // Prefer entrance-level accuracy when Foursquare provides a roof point
  geocodes: p.geocodes?.roof || p.geocodes?.main || null,
  location: p.location && { city: p.location.city, region: p.location.region, country: p.location.country },
    rating: p.rating
  };
}

function minifyPlaceDetail(d) {
  return {
    id: d.fsq_id,
    name: d.name,
    description: d.description || null,
    categories: (d.categories || []).map(c => c.name),
    website: d.website || null,
    tel: d.tel || null,
    hours: d.hours || null,
    rating: d.rating,
    features: d.features || null,
    photos: (d.photos || []).slice(0, 5).map(ph => ({
      id: ph.id,
      url: `${ph.prefix}original${ph.suffix}`,
      width: ph.width,
      height: ph.height
    })),
    location: d.location && {
      address: d.location.formatted_address,
      locality: d.location.locality,
      region: d.location.region,
      postcode: d.location.postcode,
      country: d.location.country
  },
  geocodes: d.geocodes?.roof || d.geocodes?.main || null
  };
}

function handleAxiosError(err, label) {
  const status = err.response?.status || 500;
  const data = err.response?.data;
  console.error(`Foursquare ${label} error:`, status, data || err.message);
  if (status === 429) {
    throw new PlacesError('Rate limit exceeded', status, data);
  }
  throw new PlacesError('Foursquare API failure', status, data);
}

export default {
  searchPlaces,
  getPlaceDetails,
  autocomplete,
  sendFeedback
};
