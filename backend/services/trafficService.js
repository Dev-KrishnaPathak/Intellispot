
import axios from 'axios';

const TTL_MS = 60 * 1000;
const cache = new Map();

function key(lat, lng) {
  const a = Number(lat || 0).toFixed(4);
  const b = Number(lng || 0).toFixed(4);
  return `${a},${b}`;
}

export async function getTraffic(lat, lng) {
  try {
    const k = key(lat, lng);
    const now = Date.now();
    const cached = cache.get(k);
    if (cached && (now - cached.at) < TTL_MS) return cached.data;
    const provider = (process.env.TRAFFIC_PROVIDER || 'tomtom').toLowerCase();
    let data = null;
    if (provider === 'tomtom') data = await fetchTomTom(lat, lng);
    else if (provider === 'google') data = await fetchGoogle(lat, lng);
    cache.set(k, { at: now, data });
    return data;
  } catch { return null; }
}

async function fetchTomTom(lat, lng) {
  const apiKey = process.env.TOMTOM_API_KEY;
  if (!apiKey) return null;
  const url = `https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json?point=${encodeURIComponent(lat)},${encodeURIComponent(lng)}&key=${encodeURIComponent(apiKey)}`;
  const res = await axios.get(url, { timeout: 6000 });
  const root = res.data || {};
  const d = root.flowSegmentData || root || {};
  const currentSpeed = d.currentSpeed;
  const freeFlow = d.freeFlowSpeed;
  const confidence = d.confidence;
  let congestion = null;
  if (typeof currentSpeed === 'number' && typeof freeFlow === 'number' && freeFlow > 0) {
    congestion = Math.max(0, Math.min(1, 1 - (currentSpeed / freeFlow)));
  }
  const level = congestion == null ? null : (congestion < 0.10 ? 'None' : congestion < 0.35 ? 'Moderate' : 'High');
  const summary = level;
  return { summary, level, congestion, speed: currentSpeed, freeFlow, confidence, provider: 'tomtom' };
}

async function fetchGoogle(lat, lng) {
  const key = process.env.key || process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_API_KEY || process.env.MAPS_API_KEY;
  if (!key) return null;
  const deltas = [
    { dlat: 0.009, dlng: 0 },
    { dlat: 0, dlng: 0.009 },
    { dlat: -0.009, dlng: 0 },
    { dlat: 0, dlng: -0.009 },
  ];
  for (const { dlat, dlng } of deltas) {
    const destLat = Number(lat || 0) + dlat;
    const destLng = Number(lng || 0) + dlng;
    const params = new URLSearchParams({
      origins: `${lat},${lng}`,
      destinations: `${destLat},${destLng}`,
      mode: 'driving',
      departure_time: 'now',
      traffic_model: 'best_guess',
      key,
    });
    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?${params.toString()}`;
    const res = await axios.get(url, { timeout: 6000 });
    const dmx = res.data;
    if (!dmx || dmx.status !== 'OK') continue;
    const row = Array.isArray(dmx.rows) && dmx.rows[0];
    const el = row && Array.isArray(row.elements) && row.elements[0];
    if (!el || el.status !== 'OK') continue;
    const duration = el.duration && el.duration.value;
    const durationTraffic = el.duration_in_traffic && el.duration_in_traffic.value;
    if (!duration || !durationTraffic) continue;
    const deltaRatio = Math.max(0, (durationTraffic - duration) / Math.max(duration, 1));
    const level = deltaRatio < 0.10 ? 'None' : deltaRatio < 0.35 ? 'Moderate' : 'High';
    const summary = level;
    const congestion = Math.max(0, Math.min(1, deltaRatio));
    return { summary, level, congestion, duration, durationTraffic, provider: 'google' };
  }
  return null;
}
