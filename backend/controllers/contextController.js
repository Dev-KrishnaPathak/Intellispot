import weatherService from "../services/weatherService.js";
import calendarService from "../services/calendarService.js";
import timezoneService from "../services/timezoneService.js";
import { searchPlaces } from "../services/placesService.js";
import { reverseGeocode } from "../services/geocodingService.js";
import { getTraffic } from "../services/trafficService.js";

export const processContext = async (req, res) => {
  try {
    const { location, userId, query = 'coffee' } = req.body;

    if (!location || typeof location.lat !== 'number' || typeof location.lng !== 'number') {
      return res.status(400).json({ message: 'location {lat,lng} required' });
    }

    const weather = await weatherService.getWeather(location);
    let locName = null;
    try {
      const rg = await reverseGeocode(location.lat, location.lng);
      locName = rg?.name || null;
    } catch {}

    const calendar = await calendarService.getUserCalendar ? await calendarService.getUserCalendar(userId) : [];

    const timezone = await timezoneService.getTime ? await timezoneService.getTime(location) : await timezoneService.getTimezone(location.lat, location.lng);

    let traffic = null;
    try {
      traffic = await getTraffic(location.lat, location.lng);
    } catch (e) {
      console.warn('Traffic error:', e.message);
    }

    const ll = `${location.lat},${location.lng}`;
    let places = [];
    try {
      places = await searchPlaces(query, { ll, limit: 10 });
    } catch (e) {
      console.warn('Places lookup failed:', e.message);
    }

  res.json({ location: { ...location, name: locName }, weather, calendar, timezone, traffic, places });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error processing context" });
  }
};

export const getContext = async (req, res) => {
  try {
    const lat = parseFloat(req.query.lat);
    const lng = parseFloat(req.query.lng);
    const query = req.query.query || 'coffee';
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      return res.status(400).json({ error: 'lat and lng query params required' });
    }

    let locName = null
    let locCity = null
    let locRegion = null
    let locCountry = null
    try {
      const rg = await reverseGeocode(lat, lng)
      locName = rg?.name || null
      locCity = rg?.city || null
      locRegion = rg?.region || null
      locCountry = rg?.country || null
    } catch {}

    let places = [];
    try {
      places = await searchPlaces(query, { ll: `${lat},${lng}`, limit: 10 });
    } catch (e) {
      console.warn('Places error:', e.message);
    }

    let weather = null;
    try {
      weather = await weatherService.getWeather({ lat, lng });
    } catch (e) {
      console.warn('Weather error:', e.message);
    }

    let timezone = null;
    try {
      timezone = await timezoneService.getTimezone(lat, lng);
    } catch (e) {
      console.warn('Timezone error:', e.message);
    }

    let traffic = null;
    try {
      traffic = await getTraffic(lat, lng);
    } catch (e) {
      console.warn('Traffic error:', e.message);
    }

  res.json({
      context: {
  location: { lat, lng, name: locName, city: locCity, region: locRegion, country: locCountry },
        weather,
        timezone,
  traffic,
        places
      }
    });
  } catch (err) {
    console.error('Error fetching context:', err.message);
    res.status(500).json({ error: 'Failed to fetch context' });
  }
};
