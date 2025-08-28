import dotenv from 'dotenv';

dotenv.config();

export const API_KEYS = {
  FOURSQUARE_PLACES: process.env.FOURSQUARE_PLACES_KEY,
  FOURSQUARE_PERSONALIZATION: process.env.FOURSQUARE_PERSONALIZATION_KEY,
  FOURSQUARE_MOVEMENT: process.env.FOURSQUARE_MOVEMENT_KEY,
  WEATHER: process.env.WEATHER_API_KEY || process.env.OPENWEATHER_API_KEY || process.env.OWM_API_KEY,
  CALENDAR: process.env.CALENDAR_API_KEY,
  GOOGLE_MAPS: process.env.GOOGLE_MAPS_KEY || process.env.GOOGLE_MAPS_API_KEY || process.env.key,
  MAPBOX: process.env.MAPBOX_KEY || process.env.MAPBOX_API_KEY,
  TIMEZONE: process.env.TIMEZONE_API_KEY,
};
