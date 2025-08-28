import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';

import contextRoutes from '../routes/contextRoutes.js';
import feedbackRoutes from '../routes/feedbackRoutes.js';
import adaptationRoutes from '../routes/adaptationRoutes.js';
import geofenceRoutes from '../routes/geofenceRoutes.js';
import placesRoutes from '../routes/placesRoutes.js';
import placeRoutes from '../routes/placeRoutes.js';
import intelliSpotRoutes from '../routes/intelliSpotRoutes.js';

import errorHandler from './middleware/errorHandler.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

app.set('etag', false);

const noCache = (_req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  res.set('Surrogate-Control', 'no-store');
  next();
};
app.use('/api', noCache);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.get('/debug/foursquare', (_req, res) => {
  const rawKey = process.env.FOURSQUARE_SERVICE_KEY || process.env.FSQ_SERVICE_KEY || process.env.FOURSQUARE_PLACES_KEY || process.env.FOURSQUARE_API_KEY || process.env.FSQ_API_KEY;
  const masked = rawKey ? rawKey.slice(0,6) + '...' + rawKey.slice(-4) : null;
  const bearerPrefixed = !!(rawKey && rawKey.startsWith('Bearer '));
  res.json({
    host: process.env.FOURSQUARE_PLACES_HOST || 'https://places-api.foursquare.com',
    versionHeader: process.env.FOURSQUARE_API_VERSION || process.env.FSQ_API_VERSION || null,
    keyPresent: !!rawKey,
    keySample: masked,
    bearerPrefixed,
    note: bearerPrefixed ? 'Bearer prefix will be stripped for Places requests and added exactly once.' : 'Token will be sent with Bearer prefix.'
  });
});

app.get('/debug/maps', (_req, res) => {
  const g = process.env.GOOGLE_MAPS_KEY || process.env.GOOGLE_MAPS_API_KEY || process.env.key;
  const m = process.env.MAPBOX_KEY || process.env.MAPBOX_API_KEY;
  const mask = (k) => (k ? k.slice(0,6) + '...' + k.slice(-4) : null);
  res.json({
    google: { present: !!g, sample: mask(g) },
    mapbox: { present: !!m, sample: mask(m) }
  });
});

app.get('/debug/weather', (_req, res) => {
  const w = process.env.WEATHER_API_KEY || process.env.OPENWEATHER_API_KEY || process.env.OWM_API_KEY;
  const mask = (k) => (k ? k.slice(0,6) + '...' + k.slice(-4) : null);
  res.json({ weather: { present: !!w, sample: mask(w) } });
});

app.get('/debug/weather/current', async (req, res) => {
  try {
    const lat = req.query.lat ? parseFloat(req.query.lat) : undefined;
    const lng = req.query.lng ? parseFloat(req.query.lng) : undefined;
    const cityId = process.env.OPENWEATHER_CITY_ID || process.env.WEATHER_CITY_ID;
    const svc = await import('../services/weatherService.js');
    let data = null;
    if (cityId) {
      data = await svc.getCurrentWeatherByCityId(cityId);
    } else if (typeof lat === 'number' && typeof lng === 'number' && !Number.isNaN(lat) && !Number.isNaN(lng)) {
      data = await svc.getCurrentWeather(lat, lng);
    } else {
      return res.status(400).json({ error: 'Provide lat & lng or set OPENWEATHER_CITY_ID' });
    }
    res.json({ ok: true, data });
  } catch (e) {
    res.status(e.status || 500).json({ ok: false, error: e.message, details: e.data || null });
  }
});

app.get('/debug/fsq-test', async (_req, res) => {
  try {
    const host = process.env.FOURSQUARE_PLACES_HOST || 'https://places-api.foursquare.com';
    const token = process.env.FOURSQUARE_SERVICE_KEY || process.env.FSQ_SERVICE_KEY || process.env.FOURSQUARE_PLACES_KEY || process.env.FOURSQUARE_API_KEY || process.env.FSQ_API_KEY;
    const base = token && token.startsWith('Bearer ') ? token.slice(7).trim() : (token || '').trim();
    const headers = { Accept: 'application/json' };
    const version = process.env.FOURSQUARE_API_VERSION || process.env.FSQ_API_VERSION;
    if (version) headers['X-Places-Api-Version'] = version;
    const candidates = [
      { auth: /^fsq/i.test(base) ? base : `Bearer ${base}`, label: 'auto' },
      { auth: /^fsq/i.test(base) ? `Bearer ${base}` : base, label: 'alternate' }
    ];
    const url = `${host}/places/search`;
    const attempts = [];
    for (const c of candidates) {
      try {
        const resp = await (await import('axios')).default.get(url, {
          headers: { ...headers, Authorization: c.auth },
          params: { near: 'New York', limit: 1 }
        });
        attempts.push({ ok: true, label: c.label, status: resp.status });
        return res.json({ ok: true, attempts, note: 'Authorization variant succeeded.' });
      } catch (e) {
        attempts.push({ ok: false, label: c.label, status: e.response?.status, data: e.response?.data });
      }
    }
    res.status(500).json({ ok: false, attempts });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.use('/api', contextRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/adaptation', adaptationRoutes);
app.use('/api/geofences', geofenceRoutes);
app.use('/api/places', placesRoutes); 
app.use('/api/place', placeRoutes); 
app.use('/api/intellispot', intelliSpotRoutes);

app.use(errorHandler);

export default app;
