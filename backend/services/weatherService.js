import axios from 'axios';
import { API_KEYS } from '../config/apiKeys.js';

const BASE_URL = 'https://api.openweathermap.org/data/2.5';
const ONECALL_URL = 'https://api.openweathermap.org/data/3.0/onecall';
const TTL_MS = 1000 * 30; 
const cache = new Map();

class WeatherError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = 'WeatherError';
    this.status = status;
    this.data = data;
  }
}

function key(parts) { return parts.join(':'); }
function setCache(k, value) { cache.set(k, { value, time: Date.now() }); }
function getCache(k) {
  const e = cache.get(k);
  if (!e) return null;
  if (Date.now() - e.time > TTL_MS) { cache.delete(k); return null; }
  return e.value;
}

function ensureKey() {
  if (!API_KEYS.WEATHER) throw new WeatherError('Missing WEATHER_API_KEY', 500);
}

function handleErr(err, label) {
  const status = err.response?.status || 500;
  const data = err.response?.data;
  const msg = data?.message || err.message || 'Weather API failure';
  if (status === 429) throw new WeatherError(`Rate limit exceeded (${label})`, status, data);
  throw new WeatherError(`${label} failed: ${msg}`, status, data);
}

function normalizeCurrent(d) {
  if (!d) return null;
  return {
    source: 'openweather',
    timestamp: d.dt * 1000,
    location: { name: d.name, country: d.sys?.country, coord: d.coord },
    weather: {
      summary: d.weather?.[0]?.main,
      description: d.weather?.[0]?.description,
      icon: d.weather?.[0]?.icon
    },
    temperature: {
      actual: d.main?.temp,
      feelsLike: d.main?.feels_like,
      min: d.main?.temp_min,
      max: d.main?.temp_max
    },
    humidity: d.main?.humidity,
    pressure: d.main?.pressure,
    wind: { speed: d.wind?.speed, deg: d.wind?.deg },
    sunrise: d.sys?.sunrise ? d.sys.sunrise * 1000 : null,
    sunset: d.sys?.sunset ? d.sys.sunset * 1000 : null
  };
}

function normalizeForecast(d) {
  if (!d) return null;
  return {
    source: 'openweather',
    city: d.city?.name,
    country: d.city?.country,
    list: (d.list || []).map(item => ({
      timestamp: item.dt * 1000,
      temp: item.main?.temp,
      feelsLike: item.main?.feels_like,
      weather: item.weather?.[0]?.main,
      description: item.weather?.[0]?.description,
      icon: item.weather?.[0]?.icon,
      humidity: item.main?.humidity,
      wind: { speed: item.wind?.speed, deg: item.wind?.deg }
    }))
  };
}

function normalizeOneCall(d) {
  if (!d) return null;
  return {
    source: 'openweather',
    lat: d.lat,
    lon: d.lon,
    timezone: d.timezone,
    current: normalizeCurrent({ ...d.current, name: undefined, sys: undefined, coord: { lon: d.lon, lat: d.lat } }),
    hourly: (d.hourly || []).slice(0, 48).map(h => ({
      timestamp: h.dt * 1000,
      temp: h.temp,
      feelsLike: h.feels_like,
      weather: h.weather?.[0]?.main,
      icon: h.weather?.[0]?.icon,
      pop: h.pop,
      wind: { speed: h.wind_speed, deg: h.wind_deg }
    })),
    daily: (d.daily || []).slice(0, 8).map(day => ({
      timestamp: day.dt * 1000,
      sunrise: day.sunrise * 1000,
      sunset: day.sunset * 1000,
      temp: day.temp,
      weather: day.weather?.[0]?.main,
      icon: day.weather?.[0]?.icon,
      pop: day.pop
    }))
  };
}

export async function getCurrentWeather(lat, lon, { units = 'metric', lang } = {}) {
  ensureKey();
  const cacheId = key(['current', lat, lon, units, lang]);
  const cached = getCache(cacheId);
  if (cached) return cached;
  try {
    const params = { lat, lon, units, appid: API_KEYS.WEATHER };
    if (lang) params.lang = lang;
    const res = await axios.get(`${BASE_URL}/weather`, { params });
    const norm = normalizeCurrent(res.data);
    setCache(cacheId, norm);
    return norm;
  } catch (e) { handleErr(e, 'getCurrentWeather'); }
}

export async function getCurrentWeatherByCityId(cityId, { units = 'metric', lang } = {}) {
  ensureKey();
  if (!cityId) throw new WeatherError('City ID required', 400);
  const cacheId = key(['currentId', cityId, units, lang]);
  const cached = getCache(cacheId);
  if (cached) return cached;
  try {
    const params = { id: cityId, units, appid: API_KEYS.WEATHER };
    if (lang) params.lang = lang;
    const res = await axios.get(`${BASE_URL}/weather`, { params });
    const norm = normalizeCurrent(res.data);
    setCache(cacheId, norm);
    return norm;
  } catch (e) { handleErr(e, 'getCurrentWeatherByCityId'); }
}

export async function getForecast(lat, lon, { units = 'metric', cnt, lang } = {}) {
  ensureKey();
  const cacheId = key(['forecast', lat, lon, units, cnt, lang]);
  const cached = getCache(cacheId);
  if (cached) return cached;
  try {
    const params = { lat, lon, units, appid: API_KEYS.WEATHER };
    if (cnt) params.cnt = cnt;
    if (lang) params.lang = lang;
    const res = await axios.get(`${BASE_URL}/forecast`, { params });
    const norm = normalizeForecast(res.data);
    setCache(cacheId, norm);
    return norm;
  } catch (e) { handleErr(e, 'getForecast'); }
}

export async function getOneCall(lat, lon, { units = 'metric', lang, exclude } = {}) {
  ensureKey();
  const cacheId = key(['onecall', lat, lon, units, lang, exclude]);
  const cached = getCache(cacheId);
  if (cached) return cached;
  try {
    const params = { lat, lon, units, appid: API_KEYS.WEATHER };
    if (lang) params.lang = lang;
    if (exclude) params.exclude = Array.isArray(exclude) ? exclude.join(',') : exclude;
    const res = await axios.get(ONECALL_URL, { params });
    const norm = normalizeOneCall(res.data);
    setCache(cacheId, norm);
    return norm;
  } catch (e) { handleErr(e, 'getOneCall'); }
}

async function getWeather(location) {
  if (!location) return null;
  const cityId = process.env.OPENWEATHER_CITY_ID || process.env.WEATHER_CITY_ID || null;
  if (cityId) return getCurrentWeatherByCityId(cityId);
  return getCurrentWeather(location.lat, location.lng);
}

export async function getWeatherByCity(city, { units = 'metric', lang } = {}) {
  ensureKey();
  if (!city) throw new WeatherError('City name required', 400);
  const cacheId = key(['city', city.toLowerCase(), units, lang]);
  const cached = getCache(cacheId);
  if (cached) return cached;
  try {
    const params = { q: city, units, appid: API_KEYS.WEATHER };
    if (lang) params.lang = lang;
    const res = await axios.get(`${BASE_URL}/weather`, { params });
    const norm = normalizeCurrent(res.data);
    setCache(cacheId, norm);
    return norm;
  } catch (e) { handleErr(e, 'getWeatherByCity'); }
}

export const weatherService = {
  getWeather, 
  getCurrentWeather,
  getCurrentWeatherByCityId,
  getForecast,
  getOneCall,
  getWeatherByCity
};

export default weatherService;
