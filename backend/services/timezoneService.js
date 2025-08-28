import axios from 'axios';
import { API_KEYS } from '../config/apiKeys.js';

const GOOGLE_TZ_URL = 'https://maps.googleapis.com/maps/api/timezone/json';
const WORLDTIME_URL = 'https://worldtimeapi.org/api/timezone'; // fallback (no key needed)
const TTL_MS = 1000 * 60 * 30; 
const cache = new Map();

class TimezoneError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = 'TimezoneError';
    this.status = status;
    this.data = data;
  }
}

function cacheKey(lat, lon) { return `${lat.toFixed(3)},${lon.toFixed(3)}`; }
function getCached(k) {
  const e = cache.get(k);
  if (!e) return null;
  if (Date.now() - e.time > TTL_MS) { cache.delete(k); return null; }
  const v = e.value;
  try {
    if (v && typeof v.rawOffset === 'number' && typeof v.dstOffset === 'number') {
      const localTs = computeLocalTimestamp(Date.now(), v.rawOffset, v.dstOffset);
  const minutesOfDay = computeLocalMinutesOfDay(Date.now(), v.rawOffset, v.dstOffset);
  return { ...v, localTime: new Date(localTs).toISOString(), minutesOfDay };
    }
  } catch { /* ignore */ }
  return v;
}
function setCached(k, v) { cache.set(k, { value: v, time: Date.now() }); }

function handleError(err, label) {
  const status = err.response?.status || 500;
  const data = err.response?.data;
  const msg = data?.errorMessage || data?.message || err.message;
  if (status === 429) throw new TimezoneError(`Rate limit exceeded (${label})`, status, data);
  throw new TimezoneError(`${label} failed: ${msg}`, status, data);
}

function computeLocalTimestamp(baseUtcMillis, rawOffsetSec, dstOffsetSec) {
  return baseUtcMillis + (rawOffsetSec + dstOffsetSec) * 1000;
}

function computeLocalMinutesOfDay(baseUtcMillis, rawOffsetSec, dstOffsetSec) {
  const DAY = 24 * 60 * 60 * 1000;
  const local = computeLocalTimestamp(baseUtcMillis, rawOffsetSec, dstOffsetSec);
  const mod = ((local % DAY) + DAY) % DAY; 
  return Math.floor(mod / 60000); 
}

function normalizeGoogle(resp, lat, lon) {
  if (!resp || resp.status !== 'OK') return null;
  const nowUtc = Date.now();
  const localTs = computeLocalTimestamp(nowUtc, resp.rawOffset, resp.dstOffset);
  const minutesOfDay = computeLocalMinutesOfDay(nowUtc, resp.rawOffset, resp.dstOffset);
  return {
    provider: 'google',
    timezoneId: resp.timeZoneId,
    timezoneName: resp.timeZoneName,
    rawOffset: resp.rawOffset,
    dstOffset: resp.dstOffset,
    minutesOfDay,
    localTime: new Date(localTs).toISOString(),
    lat,
    lon
  };
}

function normalizeWorldTime(resp, lat, lon) {
  if (!resp || !resp.timezone) return null;
  let minutesOfDay = undefined;
  try {
    const d = new Date(resp.datetime);
    if (!isNaN(d)) {
      const h = d.getUTCHours();
      const m = d.getUTCMinutes();
      minutesOfDay = (h * 60) + m;
    }
  } catch { /* ignore */ }
  return {
    provider: 'worldtime',
    timezoneId: resp.timezone,
    timezoneName: resp.abbreviation,
    rawOffset: resp.raw_offset,
    dstOffset: resp.dst_offset,
    minutesOfDay,
    localTime: resp.datetime,
    lat,
    lon
  };
}

export async function getTimezone(lat, lon, { timestamp = Math.floor(Date.now()/1000) } = {}) {
  const k = cacheKey(lat, lon);
  const cached = getCached(k);
  if (cached) return cached;

  if (API_KEYS.TIMEZONE || API_KEYS.GOOGLE_MAPS) {
    try {
      const key = API_KEYS.TIMEZONE || API_KEYS.GOOGLE_MAPS;
      const params = { location: `${lat},${lon}`, timestamp, key }; // Google accepts either
      const res = await axios.get(GOOGLE_TZ_URL, { params });
      const norm = normalizeGoogle(res.data, lat, lon);
      if (norm) { setCached(k, norm); return norm; }
    } catch (e) {
      console.warn('Google timezone failed, falling back:', e.message);
    }
  }

  try {
    const res = await axios.get('https://worldtimeapi.org/api/ip');
    const norm = normalizeWorldTime(res.data, lat, lon);
    if (norm) { setCached(k, norm); return norm; }
  } catch (_e) {
    // ignore
  }

  const now = Date.now();
  const mod = computeLocalMinutesOfDay(now, 0, 0);
  const fallback = { provider: 'fallback', timezoneId: 'UTC', timezoneName: 'Coordinated Universal Time', rawOffset: 0, dstOffset: 0, minutesOfDay: mod, localTime: new Date(now).toISOString(), lat, lon };
  setCached(k, fallback);
  return fallback;
}

export async function getLocalTime(lat, lon) {
  const tz = await getTimezone(lat, lon);
  return tz.localTime;
}

export default { getTimezone, getLocalTime };
