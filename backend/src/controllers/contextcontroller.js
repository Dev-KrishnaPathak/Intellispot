import { getTraffic } from '../services/trafficService.js'
import { reverseGeocode } from '../services/geocodingService.js'

export async function getContext(req, res) {
  try {
    const q = req.query || {}
    const lat = q.lat != null ? Number(q.lat) : (q.latitude != null ? Number(q.latitude) : 0)
    const lng = q.lng != null ? Number(q.lng) : (q.lon != null ? Number(q.lon) : (q.longitude != null ? Number(q.longitude) : 0))
    const traffic = await getTraffic(lat, lng)
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
    const context = {
      timestamp: new Date(),
      location: { lat, lon: lng, name: locName, city: locCity, region: locRegion, country: locCountry },
      weather: null,
      traffic
    }
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    res.set('Pragma', 'no-cache')
    res.set('Expires', '0')
    res.set('Surrogate-Control', 'no-store')
    res.json(context)
  } catch (err) {
    console.error('Error in getContext:', err.message);
    res.status(500).json({ error: 'Failed to get context' });
  }
}
