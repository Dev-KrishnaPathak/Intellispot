import axios from 'axios';
import { API_KEYS } from '../config/apiKeys.js';

const GOOGLE_BASE = 'https://maps.googleapis.com/maps/api';
const MAPBOX_BASE = 'https://api.mapbox.com';
const CACHE_TTL = 1000 * 60; 
const cache = new Map();

class MapsError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = 'MapsError';
    this.status = status;
    this.data = data;
  }
}

function cacheKey(parts) { return parts.join(':'); }
function getCached(k) {
  const e = cache.get(k);
  if (!e) return null;
  if (Date.now() - e.time > CACHE_TTL) { cache.delete(k); return null; }
  return e.value;
}
function setCached(k, v) { cache.set(k, { value: v, time: Date.now() }); }

function handleAxios(err, label) {
  const status = err.response?.status || 500;
  const data = err.response?.data;
  const msg = data?.error_message || data?.message || err.message;
  if (status === 429) throw new MapsError(`Rate limit exceeded (${label})`, status, data);
  throw new MapsError(`${label} failed: ${msg}`, status, data);
}

// --- Google Maps ---
export async function geocode(text) {
  if (!API_KEYS.GOOGLE_MAPS) return { lat: 0, lon: 0, placeholder: true };
  const k = cacheKey(['geocode', text]);
  const cached = getCached(k); if (cached) return cached;
  try {
    const res = await axios.get(`${GOOGLE_BASE}/geocode/json`, { params: { address: text, key: API_KEYS.GOOGLE_MAPS } });
    const first = res.data.results?.[0];
    const loc = first?.geometry?.location || { lat: 0, lng: 0 };
    const value = { lat: loc.lat, lon: loc.lng, raw: first };
    setCached(k, value);
    return value;
  } catch (e) { handleAxios(e, 'geocode'); }
}

export async function getDirections(origin, destination, { mode = 'driving' } = {}) {
  if (!API_KEYS.GOOGLE_MAPS) throw new MapsError('Missing GOOGLE_MAPS_KEY', 500);
  try {
    const res = await axios.get(`${GOOGLE_BASE}/directions/json`, {
      params: { origin, destination, mode, key: API_KEYS.GOOGLE_MAPS }
    });
    return res.data;
  } catch (e) { handleAxios(e, 'getDirections'); }
}


export async function simpleGetDirections(origin, destination) {
  return getDirections(origin, destination, {});
}

export async function distanceMatrix(origins, destinations, { mode = 'driving' } = {}) {
  if (!API_KEYS.GOOGLE_MAPS) throw new MapsError('Missing GOOGLE_MAPS_KEY', 500);
  const k = cacheKey(['dist', origins.join('|'), destinations.join('|'), mode]);
  const cached = getCached(k); if (cached) return cached;
  try {
    const res = await axios.get(`${GOOGLE_BASE}/distancematrix/json`, {
      params: {
        origins: origins.join('|'),
        destinations: destinations.join('|'),
        mode,
        departure_time: 'now',
        key: API_KEYS.GOOGLE_MAPS
      }
    });
    setCached(k, res.data);
    return res.data;
  } catch (e) { handleAxios(e, 'distanceMatrix'); }
}


async function mapboxMatrix(coords) {
  if (!API_KEYS.MAPBOX) return null;
  const k = cacheKey(['mbx-matrix', JSON.stringify(coords)]);
  const cached = getCached(k); if (cached) return cached;
  try {
    const coordStr = coords.map(c => `${c[0]},${c[1]}`).join(';');
    const url = `${MAPBOX_BASE}/directions-matrix/v1/mapbox/driving/${coordStr}`;

    const n = coords.length;
    const destinations = Array.from({ length: n - 1 }, (_, i) => i + 1).join(';');
    const res = await axios.get(url, {
      params: {
        access_token: API_KEYS.MAPBOX,
        sources: '0',
        destinations,
        annotations: 'distance,duration'
      }
    });
    setCached(k, res.data);
    return res.data;
  } catch (e) { return null; }
}


export async function addTravelData(location, places = [], { mode = 'driving' } = {}) {
  if (!location || location.lat == null || location.lng == null || places.length === 0) return places;
  
  const googleCapable = !!API_KEYS.GOOGLE_MAPS;
  if (googleCapable) {
    const origins = [ `${location.lat},${location.lng}` ];
    
    const validIdx = [];
    const destinations = [];
    places.forEach((p, i) => {
      const lat = p.geocodes?.latitude ?? p.geocodes?.lat ?? p.geocodes?.main?.latitude;
      const lon = p.geocodes?.longitude ?? p.geocodes?.lng ?? p.geocodes?.main?.longitude ?? p.geocodes?.lon;
      if (lat != null && lon != null && isFinite(lat) && isFinite(lon)) {
        validIdx.push(i);
        destinations.push(`${lat},${lon}`);
      }
    });
    try {
      if (destinations.length > 0) {
        const matrix = await distanceMatrix(origins, destinations, { mode });
        const rows = matrix.rows?.[0]?.elements || [];
        
    const out = places.map(p => ({ ...p }));
        validIdx.forEach((origIdx, k) => {
          const elem = rows[k];
          if (elem && elem.status === 'OK' && elem.distance && typeof elem.distance.value === 'number' && elem.distance.value > 0) {
      out[origIdx].travel = { distanceKm: elem.distance.value / 1000, etaMinutes: elem.duration.value / 60, source: 'google' };
          }
          
        });
        return out;
      }

    } catch (e) {
      
      try {
        if (API_KEYS.MAPBOX) {
          
          const originCoord = [Number(location.lng), Number(location.lat)];
          const destCoords = [];
          validIdx.forEach((origIdx) => {
            const p = places[origIdx];
            const lat = p.geocodes?.latitude ?? p.geocodes?.lat ?? p.geocodes?.main?.latitude;
            const lon = p.geocodes?.longitude ?? p.geocodes?.lng ?? p.geocodes?.main?.longitude ?? p.geocodes?.lon;
            if (lat != null && lon != null && isFinite(lat) && isFinite(lon)) destCoords.push([Number(lon), Number(lat)]);
          });
          if (destCoords.length > 0) {
            const mb = await mapboxMatrix([originCoord, ...destCoords]);
            const distances = mb?.distances?.[0] || [];
            const durations = mb?.durations?.[0] || [];
      const out = places.map(p => ({ ...p }));
            validIdx.forEach((origIdx, k) => {
              
              const dMeters = distances[k + 1];
              const dSecs = durations[k + 1];
              if (typeof dMeters === 'number' && isFinite(dMeters) && dMeters > 0) {
        out[origIdx].travel = { distanceKm: dMeters / 1000, etaMinutes: (typeof dSecs === 'number' && isFinite(dSecs)) ? dSecs / 60 : undefined, source: 'mapbox' };
              }
            });
            return out;
          }
        }
      } catch {

      }
    }
  }
  
  return places.map(p => {
    const lat = p.geocodes?.latitude ?? p.geocodes?.lat ?? p.geocodes?.main?.latitude;
    const lon = p.geocodes?.longitude ?? p.geocodes?.lng ?? p.geocodes?.main?.longitude ?? p.geocodes?.lon;
   
    if (lat != null && lon != null && isFinite(lat) && isFinite(lon)) {
      const dLat = (lat - location.lat);
      const dLon = (lon - location.lng);
      const distanceKm = Math.sqrt(dLat * dLat + dLon * dLon) * 111;
      const travelTimeMinutes = distanceKm / 40 * 60;
      return { ...p, travel: { distanceKm: Number(distanceKm.toFixed(2)), etaMinutes: Number(travelTimeMinutes.toFixed(1)), estimated: true, source: 'estimate' } };
    }
    
    if (typeof p.distance === 'number' && isFinite(p.distance) && p.distance > 0) {
      const distanceKm = p.distance / 1000;
      const travelTimeMinutes = distanceKm / 40 * 60;
      return { ...p, travel: { distanceKm: Number(distanceKm.toFixed(2)), etaMinutes: Number(travelTimeMinutes.toFixed(1)), estimated: true, source: 'estimate' } };
    }
    
    return p;
  });
}

export default {
  geocode,
  getDirections,
  simpleGetDirections,
  distanceMatrix,
  addTravelData
};
