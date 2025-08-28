import axios from 'axios'
import { searchPlaces } from '../../services/placesService.js'

function pickComponent(components, types) {
  if (!Array.isArray(components)) return null
  for (const t of types) {
    const c = components.find(ac => Array.isArray(ac.types) && ac.types.includes(t))
    if (c) return c
  }
  return null
}

function extractBestFromResults(results) {
  const tryTypesInOrder = [
    ['locality'],
    ['postal_town'],
    ['administrative_area_level_3'],
    ['administrative_area_level_2'],
    ['sublocality', 'sublocality_level_1'],
    ['neighborhood'],
    ['colloquial_area']
  ]
  for (const types of tryTypesInOrder) {
    for (const r of results) {
      const comp = pickComponent(r.address_components, types)
      if (comp?.long_name) return comp.long_name
    }
  }
  return results[0]?.formatted_address || null
}

export async function reverseGeocode(lat, lng) {
  try {
    if (lat == null || lng == null) return null
    const mode = String(process.env.LOCATION_NAME_PROVIDER || 'hybrid').toLowerCase()
    const key = process.env.key || process.env.GOOGLE_MAPS_API_KEY
    if (mode === 'fsq') {
      let out = { name: null, city: null, region: null, country: null }
      try {
        const ll = `${lat},${lng}`
        const pool = await searchPlaces('', { ll, limit: 20, radius: 3000 })
        const counts = new Map()
        for (const p of pool || []) {
          const c = p?.location?.city?.trim()
          if (c) counts.set(c, (counts.get(c) || 0) + 1)
        }
        let votedCity = null
        let max = 0
        for (const [k, v] of counts.entries()) { if (v > max) { votedCity = k; max = v } }
        if (votedCity) out.city = votedCity
        if (!out.city) {
          const queries = ['city hall','municipal office','police station','post office','downtown']
          let best = null
          for (const q of queries) {
            const fsq = await searchPlaces(q, { ll, limit: 5, radius: 5000 })
            best = fsq?.find(p => p?.location?.city) || best
            if (best?.location?.city) break
          }
          if (best?.location?.city) {
            out.city = best.location.city
            if (best.location.region) out.region = best.location.region
            if (!out.name) out.name = best.name
          }
        }
        if (!out.name) out.name = out.city
      } catch {}
      return out
    }
    let out = { name: null, city: null, region: null, country: null }
    if (key) {
      const url = 'https://maps.googleapis.com/maps/api/geocode/json'
      const params = {
        latlng: `${lat},${lng}`,
        key,
        language: 'en'
      }
      const res = await axios.get(url, { params, timeout: 8000 })
      const data = res.data
      if (data && Array.isArray(data.results) && data.results.length > 0) {
        const results = data.results
        const name = extractBestFromResults(results)
        const head = results[0]
        const region = pickComponent(head.address_components, ['administrative_area_level_1'])?.short_name || null
        const country = pickComponent(head.address_components, ['country'])?.short_name || null
        let city = null
        for (const r of results) {
          const c = pickComponent(r.address_components, ['locality', 'postal_town'])
          if (c?.long_name) { city = c.long_name; break }
        }
        out = { name, city: city || name, region, country }
      }
    }
    if (mode !== 'google' && (!out.city || out.city === out.region)) {
      try {
        const ll = `${lat},${lng}`
        const pool = await searchPlaces('', { ll, limit: 20, radius: 3000 })
        const counts = new Map()
        for (const p of pool || []) {
          const c = p?.location?.city?.trim()
          if (c) counts.set(c, (counts.get(c) || 0) + 1)
        }
        let votedCity = null
        let max = 0
        for (const [k, v] of counts.entries()) { if (v > max) { votedCity = k; max = v } }
        if (votedCity) {
          out.city = votedCity
          if (!out.name) out.name = votedCity
        }
        if (!out.city) {
          const queries = ['city hall','municipal office','police station','post office','downtown']
          let best = null
          for (const q of queries) {
            const fsq = await searchPlaces(q, { ll, limit: 5, radius: 5000 })
            best = fsq?.find(p => p?.location?.city) || best
            if (best?.location?.city) break
          }
          if (best?.location?.city) {
            out.city = best.location.city
            if (!out.region && best.location.region) out.region = best.location.region
            if (!out.name) out.name = out.city
          }
        }
      } catch {}
    }
    return out
  } catch {
    return null
  }
}
