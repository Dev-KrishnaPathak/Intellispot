import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const PLACES_HOST = process.env.FOURSQUARE_PLACES_HOST || 'https://places-api.foursquare.com';

function getRawToken() {
  return (
    process.env.FOURSQUARE_SERVICE_KEY ||
    process.env.FSQ_SERVICE_KEY ||
    process.env.FSQ_API_KEY ||
    process.env.FOURSQUARE_PLACES_KEY ||
    process.env.FOURSQUARE_API_KEY
  );
}

function formatAuth(token) {
  if (!token) return null;
  return token.trim();
}

function versionHeader() {
  const v = process.env.FOURSQUARE_API_VERSION || process.env.FSQ_API_VERSION;
  if (!v) return {};
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    throw new Error('FOURSQUARE_API_VERSION must be YYYY-MM-DD (e.g. 2025-06-17)');
  }
  return { 'X-Places-Api-Version': v };
}

function ensureAuth() {
  const token = formatAuth(getRawToken());
  if (!token) throw new Error('Missing Foursquare service/API key (set FOURSQUARE_SERVICE_KEY or FOURSQUARE_PLACES_KEY in .env)');
  return token;
}

function baseHeaders() {
  return { Accept: 'application/json', ...versionHeader() };
}

function aliasId(obj) {
  if (obj && obj.fsq_place_id && !obj.fsq_id) {
    return { ...obj, fsq_id: obj.fsq_place_id };
  }
  return obj;
}

export const searchPlaces = async (lat, lng, queryString, limit = 10, radius = 1000) => {
  const auth = ensureAuth();
  try {
    const response = await axios.get(`${PLACES_HOST}/places/search`, {
      headers: { Authorization: auth, ...baseHeaders() },
      params: {
        ll: `${lat},${lng}`,
        query: queryString,
        radius,
        limit
      }
    });
    if (Array.isArray(response.data?.results)) {
      response.data.results = response.data.results.map(aliasId);
    }
    return response.data;
  } catch (err) {
    console.error('Error in searchPlaces:', err.response?.data || err.message);
    throw err;
  }
};

export const getPlaceDetails = async (id) => {
  const auth = ensureAuth();
  try {
    const response = await axios.get(`${PLACES_HOST}/places/${id}`, {
      headers: { Authorization: auth, ...baseHeaders() }
    });
    return aliasId(response.data);
  } catch (err) {
    console.error('Error in getPlaceDetails:', err.response?.data || err.message);
    throw err;
  }
};

export const getPlacePhotos = async (id) => {
  const auth = ensureAuth();
  try {
    const response = await axios.get(`${PLACES_HOST}/places/${id}/photos`, {
      headers: { Authorization: auth, ...baseHeaders() }
    });
    return response.data;
  } catch (err) {
    console.error('Error in getPlacePhotos:', err.response?.data || err.message);
    throw err;
  }
};

const legacyWrapper = {
  searchPlaces: async (location, query) => {
    if (!location || typeof location.lat === 'undefined') return [];
    const raw = await searchPlaces(location.lat, location.lng, query, 10, 1000);
    const arr = Array.isArray(raw?.results) ? raw.results : (Array.isArray(raw) ? raw : []);
    return arr.map(r => (r.fsq_place_id && !r.fsq_id ? { ...r, fsq_id: r.fsq_place_id } : r));
  },
  getPlaceDetails,
  getPlacePhotos
};

export default legacyWrapper;
