import axios from 'axios'



const TTL_MS = 60 * 1000 
const cache = new Map() 

function cacheKey(lat, lng) {
  const la = Number(lat || 0).toFixed(4)
  const lo = Number(lng || 0).toFixed(4)
  return `${la},${lo}`
}

export async function getTraffic(lat, lng) {
  try {
    const key = cacheKey(lat, lng)
    const now = Date.now()
    const cached = cache.get(key)
    if (cached && (now - cached.at) < TTL_MS) {
      return cached.data
    }
    const provider = (process.env.TRAFFIC_PROVIDER || 'tomtom').toLowerCase()
    let data = null
    if (provider === 'tomtom') {
      data = await fetchTomTom(lat, lng)
    } else if (provider === 'google') {
      data = await fetchGoogle(lat, lng)
    } else {
      data = null
    }
    cache.set(key, { at: now, data })
    return data
  } catch (e) {
    return null
  }
}

async function fetchTomTom(lat, lng) {
  const apiKey = process.env.TOMTOM_API_KEY
  if (!apiKey) return null
  const url = `https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json?point=${encodeURIComponent(lat)},${encodeURIComponent(lng)}&key=${encodeURIComponent(apiKey)}`
  const res = await axios.get(url, { timeout: 6000 })
  const d = res.data || {}
  const frc = d.frc
  const currentSpeed = d.currentSpeed
  const freeFlow = d.freeFlowSpeed
  const confidence = d.confidence
  let congestion = null
  if (typeof currentSpeed === 'number' && typeof freeFlow === 'number' && freeFlow > 0) {
    congestion = Math.max(0, Math.min(1, 1 - (currentSpeed / freeFlow)))
  }
  const level = congestion == null ? null : (congestion < 0.2 ? 'Low' : congestion < 0.4 ? 'Moderate' : congestion < 0.7 ? 'High' : 'Severe')
  const summary = level ? `${level} traffic` : null
  return { summary, congestion, speed: currentSpeed, freeFlow, confidence, provider: 'tomtom' }
}

async function fetchGoogle(lat, lng) {
  const key = process.env.key || process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_API_KEY || process.env.MAPS_API_KEY
  if (!key) return null
  const deltaDeg = 0.009 
  const destLat = Number(lat || 0) + deltaDeg
  const destLng = Number(lng || 0)
  const params = new URLSearchParams({
    origins: `${lat},${lng}`,
    destinations: `${destLat},${destLng}`,
    mode: 'driving',
    departure_time: 'now',
    traffic_model: 'best_guess',
    key,
  })
  const url = `https://maps.googleapis.com/maps/api/distancematrix/json?${params.toString()}`
  const res = await axios.get(url, { timeout: 6000 })
  const d = res.data
  if (!d || d.status !== 'OK') return null
  const row = Array.isArray(d.rows) && d.rows[0]
  const el = row && Array.isArray(row.elements) && row.elements[0]
  if (!el || el.status !== 'OK') return null
  const duration = el.duration && el.duration.value 
  const durationTraffic = el.duration_in_traffic && el.duration_in_traffic.value 
  if (!duration || !durationTraffic) return null
  const ratio = Math.max(0, (durationTraffic - duration) / Math.max(duration, 1))
  const congestion = Math.max(0, Math.min(1, ratio / 1.5)) 
  const level = congestion < 0.2 ? 'Low' : congestion < 0.4 ? 'Moderate' : congestion < 0.7 ? 'High' : 'Severe'
  const summary = `${level} traffic`
  return { summary, congestion, duration, durationTraffic, provider: 'google' }
}
