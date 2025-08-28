import axios from 'axios';
import { API_KEYS } from '../config/apiKeys.js';

const BASE_URL = process.env.FOURSQUARE_MOVEMENT_HOST || 'https://api.foursquare.com/v3';

class MovementError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = 'MovementError';
    this.status = status;
    this.data = data;
  }
}

function ensureKey() {
  if (!API_KEYS.FOURSQUARE_MOVEMENT) {
    throw new MovementError('Missing Foursquare Movement API key (FOURSQUARE_MOVEMENT_KEY)', 500);
  }
}

function buildHeaders(extra = {}) {
  ensureKey();
  const raw = API_KEYS.FOURSQUARE_MOVEMENT;
  const auth = raw.startsWith('Bearer ') ? raw : `Bearer ${raw}`;
  const version = process.env.FOURSQUARE_API_VERSION || process.env.FSQ_API_VERSION;
  const vh = version ? { 'X-Places-Api-Version': version } : {};
  return { Authorization: auth, 'Content-Type': 'application/json', Accept: 'application/json', ...vh, ...extra };
}

function handleError(err, label) {
  const status = err.response?.status || 500;
  const data = err.response?.data;
  const msg = data?.message || err.message || 'Movement API failure';
  if (status === 429) {
    throw new MovementError(`Rate limit exceeded (${label})`, status, data);
  }
  throw new MovementError(`${label} failed: ${msg}`, status, data);
}


export async function createGeofence(geofence) {
  try {
  const res = await axios.post(`${BASE_URL}/movement/geofences`, geofence, { headers: buildHeaders() });
    return res.data;
  } catch (e) { handleError(e, 'createGeofence'); }
}

export async function batchUpsertGeofences(geofences = []) {
  try {
  const res = await axios.post(`${BASE_URL}/movement/geofences/batch`, { geofences }, { headers: buildHeaders() });
    return res.data;
  } catch (e) { handleError(e, 'batchUpsertGeofences'); }
}

export async function listGeofences({ page = 1, limit = 50 } = {}) {
  try {
  const res = await axios.get(`${BASE_URL}/movement/geofences`, { headers: buildHeaders(), params: { page, limit } });
    return res.data;
  } catch (e) { handleError(e, 'listGeofences'); }
}

export async function getGeofence(id) {
  try {
  const res = await axios.get(`${BASE_URL}/movement/geofences/${id}`, { headers: buildHeaders() });
    return res.data;
  } catch (e) { handleError(e, 'getGeofence'); }
}

export async function updateGeofence(id, patch) {
  try {
  const res = await axios.patch(`${BASE_URL}/movement/geofences/${id}`, patch, { headers: buildHeaders() });
    return res.data;
  } catch (e) { handleError(e, 'updateGeofence'); }
}

export async function deleteGeofence(id) {
  try {
  const res = await axios.delete(`${BASE_URL}/movement/geofences/${id}`, { headers: buildHeaders() });
    return { id, deleted: true, status: res.status };
  } catch (e) { handleError(e, 'deleteGeofence'); }
}


export async function registerDevice({ deviceId, lat, lng, accuracy }) {
  try {
    const body = { device_id: deviceId, location: { lat, lng, accuracy } };
  const res = await axios.post(`${BASE_URL}/movement/devices`, body, { headers: buildHeaders() });
    return res.data;
  } catch (e) { handleError(e, 'registerDevice'); }
}

export async function updateDeviceLocation(deviceId, { lat, lng, accuracy }) {
  try {
    const body = { location: { lat, lng, accuracy } };
  const res = await axios.patch(`${BASE_URL}/movement/devices/${deviceId}`, body, { headers: buildHeaders() });
    return res.data;
  } catch (e) { handleError(e, 'updateDeviceLocation'); }
}

export async function listDevices({ page = 1, limit = 50 } = {}) {
  try {
  const res = await axios.get(`${BASE_URL}/movement/devices`, { headers: buildHeaders(), params: { page, limit } });
    return res.data;
  } catch (e) { handleError(e, 'listDevices'); }
}

export async function listGeofenceEvents({ since, until, deviceId, geofenceId, page = 1, limit = 100 } = {}) {
  try {
    const params = { page, limit };
    if (since) params.since = since;
    if (until) params.until = until;
    if (deviceId) params.device_id = deviceId;
    if (geofenceId) params.geofence_id = geofenceId;
  const res = await axios.get(`${BASE_URL}/movement/events`, { headers: buildHeaders(), params });
    return res.data;
  } catch (e) { handleError(e, 'listGeofenceEvents'); }
}


export function buildCircularGeofence({ id, name, lat, lng, radiusMeters, metadata }) {
  return { id, name, geometry: { type: 'Circle', center: { lat, lng }, radius: radiusMeters }, metadata: metadata || {} };
}

export function buildPolygonGeofence({ id, name, coordinates, metadata }) {
  return { id, name, geometry: { type: 'Polygon', coordinates }, metadata: metadata || {} };
}


export function normalizeEvent(e) {
  if (!e) return null;
  return {
    id: e.id,
    type: e.type,
    deviceId: e.device_id,
    geofenceId: e.geofence_id,
    timestamp: e.timestamp,
    location: e.location || null,
    dwellSeconds: e.dwell_seconds || null
  };
}

export default {
  createGeofence,
  batchUpsertGeofences,
  listGeofences,
  getGeofence,
  updateGeofence,
  deleteGeofence,
  registerDevice,
  updateDeviceLocation,
  listDevices,
  listGeofenceEvents,
  buildCircularGeofence,
  buildPolygonGeofence,
  normalizeEvent
};
