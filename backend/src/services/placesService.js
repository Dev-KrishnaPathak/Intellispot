import axios from 'axios';

const NEW_HOST = process.env.FOURSQUARE_PLACES_HOST || 'https://places-api.foursquare.com';
const LEGACY_ENDPOINT = 'https://api.foursquare.com/v3/places/search';
const FOURSQ_API_URL = `${NEW_HOST}/places/search`;

export const searchPlaces = async (lat, lng, query, radius, limit = 5) => {
  try {
    const key = process.env.FOURSQUARE_API_KEY || process.env.FSQ_API_KEY || process.env.FOURSQUARE_PLACES_KEY;
    if (!key) throw new Error('Missing Foursquare API key (FOURSQUARE_API_KEY / FSQ_API_KEY / FOURSQUARE_PLACES_KEY)');
    const version = process.env.FOURSQUARE_API_VERSION || process.env.FSQ_API_VERSION;
    if (version && !/^\d{4}-\d{2}-\d{2}$/.test(version)) {
      throw new Error('FOURSQUARE_API_VERSION must be YYYY-MM-DD (e.g. 2025-06-17)');
    }
    const headers = { Authorization: key, accept: 'application/json' };
    if (version) headers['X-Places-Api-Version'] = version;
    let response;
    try {
      response = await axios.get(FOURSQ_API_URL, {
        headers,
        params: {
          ll: `${lat},${lng}`,
          query,
          radius,
          limit
        }
      });
    } catch (primaryErr) {
      if (primaryErr.response && [404, 410].includes(primaryErr.response.status)) {
        response = await axios.get(LEGACY_ENDPOINT, {
          headers: { ...headers },
          params: {
            ll: `${lat},${lng}`,
            query,
            radius,
            limit
          }
        });
      } else {
        throw primaryErr;
      }
    }
    if (Array.isArray(response.data?.results)) {
      response.data.results = response.data.results.map(r => (r.fsq_place_id && !r.fsq_id ? { ...r, fsq_id: r.fsq_place_id } : r));
    }
    return response.data;
  } catch (err) {
    console.error('Error searching places:', err.response?.data || err.message);
    throw err;
  }
};

export const searchPlacesByLL = async (query, ll, limit = 5) => {
  const [lat, lng] = (ll || '').split(',');
  return searchPlaces(lat, lng, query, undefined, limit);
};

export default { searchPlaces, searchPlacesByLL };
