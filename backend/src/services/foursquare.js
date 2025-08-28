import axios from "axios";

const RAW_KEY = process.env.FOURSQUARE_SERVICE_KEY || process.env.FOURSQUARE_API_KEY;
const FOURSQUARE_API_KEY = RAW_KEY ? (RAW_KEY.startsWith('Bearer ') ? RAW_KEY : `Bearer ${RAW_KEY}`) : null;
const FOURSQUARE_BASE_URL = process.env.FOURSQUARE_PLACES_HOST || "https://places-api.foursquare.com"; // New host

/**
 * @param {Object} context
 * @param {number} limit 
 */
export async function fetchVenues(context, limit = 10) {
  try {
    const { lat, lon } = context.location;

    let categories = [];
    if (context.suggestQuiet) categories.push("coffee", "cafe", "library");
    else categories.push("restaurant", "bar", "entertainment");

    if (context.suggestOutdoor) categories.push("park");

    const params = {
      ll: `${lat},${lon}`,
      query: categories.join(","),
      limit,
      sort: "DISTANCE",
    };

  const version = process.env.FOURSQUARE_API_VERSION || process.env.FSQ_API_VERSION;
  if (version && !/^\d{4}-\d{2}-\d{2}$/.test(version)) {
    throw new Error('FOURSQUARE_API_VERSION must be YYYY-MM-DD (e.g. 2025-06-17)');
  }
  const headers = { Accept: "application/json", Authorization: FOURSQUARE_API_KEY };
  if (version) headers['X-Places-Api-Version'] = version;

  const response = await axios.get(`${FOURSQUARE_BASE_URL}/places/search`, { params, headers });
    return response.data.results.map(place => ({
      name: place.name,
      address: place.location.formatted_address,
      category: place.categories.map(c => c.name).join(", "),
      distance: place.distance,
      rating: place.rating || null,
      geocode: place.geocodes.main,
      hours: place.hours || null,
      website: place.website || null,
    }));
  } catch (err) {
    console.error("Error fetching venues from Foursquare:", err.message);
    return [];
  }
}
