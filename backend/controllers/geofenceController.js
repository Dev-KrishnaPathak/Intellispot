import * as movement from '../services/geofenceService.js';

export async function create(req, res) {
  try {
    const data = await movement.createGeofence(req.body);
    res.status(201).json(data);
  } catch (e) { res.status(e.status || 500).json({ error: e.message, details: e.data }); }
}

export async function batch(req, res) {
  try {
    const data = await movement.batchUpsertGeofences(req.body.geofences || []);
    res.status(200).json(data);
  } catch (e) { res.status(e.status || 500).json({ error: e.message, details: e.data }); }
}

export async function list(req, res) {
  try {
    const data = await movement.listGeofences(req.query);
    res.json(data);
  } catch (e) { res.status(e.status || 500).json({ error: e.message, details: e.data }); }
}

export async function get(req, res) {
  try {
    const data = await movement.getGeofence(req.params.id);
    res.json(data);
  } catch (e) { res.status(e.status || 500).json({ error: e.message, details: e.data }); }
}

export async function update(req, res) {
  try {
    const data = await movement.updateGeofence(req.params.id, req.body);
    res.json(data);
  } catch (e) { res.status(e.status || 500).json({ error: e.message, details: e.data }); }
}

export async function remove(req, res) {
  try {
    const data = await movement.deleteGeofence(req.params.id);
    res.json(data);
  } catch (e) { res.status(e.status || 500).json({ error: e.message, details: e.data }); }
}

export async function registerDevice(req, res) {
  try {
    const data = await movement.registerDevice(req.body);
    res.status(201).json(data);
  } catch (e) { res.status(e.status || 500).json({ error: e.message, details: e.data }); }
}

export async function updateDevice(req, res) {
  try {
    const data = await movement.updateDeviceLocation(req.params.id, req.body);
    res.json(data);
  } catch (e) { res.status(e.status || 500).json({ error: e.message, details: e.data }); }
}

export async function listDevices(req, res) {
  try {
    const data = await movement.listDevices(req.query);
    res.json(data);
  } catch (e) { res.status(e.status || 500).json({ error: e.message, details: e.data }); }
}

export async function events(req, res) {
  try {
    const data = await movement.listGeofenceEvents(req.query);
    res.json(data);
  } catch (e) { res.status(e.status || 500).json({ error: e.message, details: e.data }); }
}

export async function setGeofence(req, res) {
  try {
    const { userId, lat, lng, radius } = req.body;
    if (lat == null || lng == null || radius == null) {
      return res.status(400).json({ error: 'lat, lng, radius required' });
    }
    const geofence = movement.buildCircularGeofence({
      id: userId ? `user-${userId}-${Date.now()}` : undefined,
      name: `geo-${Date.now()}`,
      lat: Number(lat),
      lng: Number(lng),
      radiusMeters: Number(radius)
    });
    const created = await movement.createGeofence(geofence);
    res.json({ success: true, geofence: created });
  } catch (err) {
    console.error('Error setting geofence:', err.message);
    res.status(err.status || 500).json({ error: 'Failed to set geofence' });
  }
}

export default { create, batch, list, get, update, remove, registerDevice, updateDevice, listDevices, events, setGeofence };
