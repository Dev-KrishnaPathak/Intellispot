import React, { useEffect, useMemo, useRef, useState } from 'react'
import { MapPin, Sun, Clock, Star, Flame, Car, Calendar as CalendarIcon, Cloud, CloudRain, CloudSnow, CloudFog, CloudDrizzle, CloudLightning, Wind, Info } from 'lucide-react'
import Calendar from './components/Calendar'
import { createRoot } from 'react-dom/client'
import './index.css'
import { getAccessToken, fetchGoogleCalendarEvents } from './lib/google'

export function Dashboard() {
  const [refreshTick, setRefreshTick] = useState(0)
  const today = useMemo(()=> new Date(), [])
  const [formError, setFormError] = useState(null)
  const [active, setActive] = useState('Dashboard')
  const [favorites, setFavorites] = useState(() => {
    try { return JSON.parse(localStorage.getItem('is_favorites') || '[]') } catch { return [] }
  })
  const [settings, setSettings] = useState(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem('is_settings') || '{"refreshSec":60,"minGapMin":45,"manualOnly":false}')
      return { refreshSec: 60, minGapMin: 45, manualOnly: false, ...parsed }
    } catch { return { refreshSec: 60, minGapMin: 45, manualOnly: false } }
  })
  const [sugQueryOverride, setSugQueryOverride] = useState(() => {
    try { return localStorage.getItem('is_query_override') || null } catch { return null }
  })
  const [geo, setGeo] = useState(null) 
  const [geoError, setGeoError] = useState(null)
  const [ctxLoading, setCtxLoading] = useState(false)
  const [recLoading, setRecLoading] = useState(false)
  const [ctxError, setCtxError] = useState(null)
  const [recError, setRecError] = useState(null)
  const [ctx, setCtx] = useState({ location: null, weather: null, timezone: null, traffic: null })
  const [recs, setRecs] = useState([])
  const [autoSug, setAutoSug] = useState({ query: 'coffee', dayIndex: 0, startHHMM: '15:00' })
  const TABS = ['Work','Eat','Relax','Exercise']
  const [activeTab, setActiveTab] = useState('Work')
  const [sugTabOverride, setSugTabOverride] = useState(null)
  const [localClock, setLocalClock] = useState(null)
  const timeBaseRef = useRef(null) 
  const startOfWeek = (d) => {
    const dt = new Date(d)
    const day = dt.getDay() || 7 
    dt.setHours(0,0,0,0)
    dt.setDate(dt.getDate() - (day - 1))
    return dt
  }
  const fmtMonthYear = (d) => d.toLocaleString(undefined, { month: 'long', year: 'numeric' })
  const fmtDDMON = (d) => {
    const day = String(d.getDate()).padStart(2,'0')
    const mon = d.toLocaleString(undefined, { month: 'short' }).toUpperCase()
    return `${day}/${mon}`
  }
  const weekKeyFromDate = (d) => {
    const y = d.getFullYear()
    const m = String(d.getMonth()+1).padStart(2,'0')
    const day = String(d.getDate()).padStart(2,'0')
    return `${y}-${m}-${day}`
  }
  const [currentWeekStart, setCurrentWeekStart] = useState(() => startOfWeek(today))
  const [visibleMonth, setVisibleMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1))
  const [jumpMonth, setJumpMonth] = useState(() => today.getMonth())
  const [jumpYear, setJumpYear] = useState(() => today.getFullYear())
  const days = useMemo(() => ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'], [])
  const [events, setEvents] = useState(() => {
    try {
      const raw = localStorage.getItem('is_events')
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) return parsed.filter(e => e && e.source !== 'gcal' && !String(e.id||'').startsWith('gcal-'))
      }
    } catch {}
    const wk = weekKeyFromDate(startOfWeek(today))
    return [
      { id: 'tue-sync', weekKey: wk, day: 1, title: 'Team sync', start: 15 * 60, end: 16 * 60 },
    ]
  })
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({
    title: '',
    day: 0,
    start: '15:00',
  hour12: 3,
  minute: 0,
  meridiem: 'PM',
  startText: '03:00 PM',
  startInvalid: false,
    duration: 30, 
    durationMode: 'preset', 
    customHours: 0,
    customMinutes: 30,
  })
  const [isEditing, setIsEditing] = useState(false)
  const [editId, setEditId] = useState(null)
  const [showDetails, setShowDetails] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState(null)

  const hasOverlap = (a, b) => (a.start < b.end && b.start < a.end)
  const dayEvents = (dayIdx, wk) => events.filter(e => e.weekKey === wk && e.day === dayIdx)
  const dayEventsSorted = (dayIdx, wk) => dayEvents(dayIdx, wk).slice().sort((a,b)=>a.start-b.start)
  const toMinutes = (hhmm) => {
    const [h, m] = hhmm.split(':').map(Number)
    return (h * 60) + (m || 0)
  }
  const minutesToHHMM = (mins) => {
    const h = Math.floor(mins / 60)
    const m = mins % 60
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  }
  const hhmmToH12 = (hhmm) => {
    const [hStr, mStr] = hhmm.split(':')
    let h = parseInt(hStr, 10)
    const m = parseInt(mStr, 10) || 0
    const mer = h >= 12 ? 'PM' : 'AM'
    let h12 = h % 12
    if (h12 === 0) h12 = 12
    return { hour12: h12, minute: m, meridiem: mer }
  }
  const h12ToHHMM = (h12, minute, meridiem) => {
    let h = parseInt(h12, 10) || 12
    let m = parseInt(minute, 10) || 0
    h = Math.min(12, Math.max(1, h))
    m = Math.min(59, Math.max(0, m))
    let hh = h % 12
    if (meridiem === 'PM') hh += 12
    return `${String(hh).padStart(2,'0')}:${String(m).padStart(2,'0')}`
  }
  const labelFromHHMM = (hhmm) => {
    const { hour12, minute, meridiem } = hhmmToH12(hhmm)
    return `${String(hour12).padStart(2,'0')}:${String(minute).padStart(2,'0')} ${meridiem}`
  }
  
  const labelFromMinutes = (mins) => labelFromHHMM(minutesToHHMM(Math.max(0, Math.min(24*60, mins))))

  const freeSlotsForDate = (date) => {
    try {
      const wkStart = startOfWeek(date)
      const wkKey = weekKeyFromDate(wkStart)
      const dayIdx = Math.max(0, Math.min(6, Math.floor((new Date(date.getFullYear(), date.getMonth(), date.getDate()) - new Date(wkStart.getFullYear(), wkStart.getMonth(), wkStart.getDate()))/(24*60*60*1000))))
      const evts = dayEventsSorted(dayIdx, wkKey)
      const DAY_START = 0
      const DAY_END = 24 * 60
      let slots = []
      let cursor = DAY_START
      for (const e of evts) {
        const s = Math.max(DAY_START, Math.min(DAY_END, Number(e.start)||0))
        const t = Math.max(DAY_START, Math.min(DAY_END, Number(e.end)||s))
        if (s > cursor) slots.push({ start: cursor, end: s })
        cursor = Math.max(cursor, t)
      }
      if (cursor < DAY_END) slots.push({ start: cursor, end: DAY_END })
      const minGap = Math.max(0, Number(settings?.minGapMin || 0))
      if (minGap > 0) slots = slots.filter(x => (x.end - x.start) >= minGap)
      return slots
    } catch {
      return []
    }
  }

  const formatFreeSlotsList = (slots) => {
    if (!slots || slots.length === 0) return 'None'
    if (slots.length === 1 && slots[0].start <= 0 && slots[0].end >= 24*60) return 'All day'
    return slots.map(s => `${labelFromMinutes(s.start)}–${labelFromMinutes(s.end)}`).join(', ')
  }

  const buildDaySegments = (date) => {
    try {
      const wkStart = startOfWeek(date)
      const wkKey = weekKeyFromDate(wkStart)
      const dayIdx = Math.max(0, Math.min(6, Math.floor((new Date(date.getFullYear(), date.getMonth(), date.getDate()) - new Date(wkStart.getFullYear(), wkStart.getMonth(), wkStart.getDate()))/(24*60*60*1000))))
      const evts = dayEventsSorted(dayIdx, wkKey)
      const DAY_START = 0
      const DAY_END = 24 * 60
      const out = []
      let cursor = DAY_START
      for (const e of evts) {
        const s = Math.max(DAY_START, Math.min(DAY_END, Number(e.start)||0))
        const t = Math.max(DAY_START, Math.min(DAY_END, Number(e.end)||s))
        if (s > cursor) out.push({ start: cursor, end: s, type: 'free' })
        const bs = Math.max(cursor, s)
        if (t > bs) out.push({ start: bs, end: t, type: 'busy' })
        cursor = Math.max(cursor, t)
      }
      if (cursor < DAY_END) out.push({ start: cursor, end: DAY_END, type: 'free' })
      const merged = []
      for (const seg of out) {
        const last = merged[merged.length - 1]
        if (last && last.type === seg.type && (seg.end - last.end) <= 0.5) {
          last.end = seg.end
        } else {
          merged.push({ ...seg })
        }
      }
      return merged
    } catch { return [] }
  }
  const parseUserTime = (input) => {
    if (!input) return null
    const s = input.trim().toLowerCase().replace(/\s+/g,' ')
    let m = s.match(/^(\d{1,2})(?::(\d{1,2}))?\s*(am|pm)$/i)
    if (m) {
      let h = parseInt(m[1],10)
      let mi = parseInt(m[2]||'0',10)
      if (isNaN(h) || h<1 || h>12 || isNaN(mi) || mi<0 || mi>59) return null
      if (m[3].toUpperCase()==='PM' && h !== 12) h += 12
      if (m[3].toUpperCase()==='AM' && h === 12) h = 0
      return `${String(h).padStart(2,'0')}:${String(mi).padStart(2,'0')}`
    }
    m = s.match(/^(\d{1,2})(\d{2})\s*(am|pm)$/i)
    if (m) {
      let h = parseInt(m[1],10)
      let mi = parseInt(m[2],10)
      if (isNaN(h) || h<1 || h>12 || isNaN(mi) || mi<0 || mi>59) return null
      if (m[3].toUpperCase()==='PM' && h !== 12) h += 12
      if (m[3].toUpperCase()==='AM' && h === 12) h = 0
      return `${String(h).padStart(2,'0')}:${String(mi).padStart(2,'0')}`
    }
    m = s.match(/^([01]?\d|2[0-3]):([0-5]\d)$/)
    if (m) {
      const h = parseInt(m[1],10)
      const mi = parseInt(m[2],10)
      return `${String(h).padStart(2,'0')}:${String(mi).padStart(2,'0')}`
    }
    m = s.match(/^([01]?\d|2[0-3])([0-5]\d)$/)
    if (m) {
      const h = parseInt(m[1],10)
      const mi = parseInt(m[2],10)
      return `${String(h).padStart(2,'0')}:${String(mi).padStart(2,'0')}`
    }
    return null
  }
  const timeOptions = useMemo(() => {
    const opts = []
    for (let h = 0; h < 24; h++) {
      for (let m = 0; m < 60; m += 30) {
        const value = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`
        const { hour12, minute, meridiem } = hhmmToH12(value)
        const label = `${String(hour12).padStart(2,'0')}:${String(minute).padStart(2,'0')} ${meridiem}`
        opts.push({ value, label })
      }
    }
    return opts
  }, [])

  const queryForTab = (tab) => {
    const now = new Date()
  const h = now.getHours()
  const main = (ctx?.weather?.main || ctx?.weather?.condition || '').toString().toLowerCase()
  const isWet = /rain|snow|drizzle|storm|thunder/.test(main)
    switch (tab) {
      case 'Work':
        return 'cafe' 
      case 'Eat': {
        if (h >= 6 && h < 11) return 'breakfast'
        if (h >= 11 && h < 15) return 'lunch'
        if (h >= 17 && h <= 22) return 'dinner'
        return 'dessert'
      }
      case 'Relax':
        return isWet ? 'dessert' : 'park'
      case 'Exercise':
        return 'gym'
      default:
        return 'cafe'
    }
  }

  const deriveAutoTab = () => {
    try {
      const now = new Date()
      const h = now.getHours()
      const day = now.getDay() 
      const weekend = (day === 0 || day === 6)
      if (!weekend && h >= 9 && h < 12) return 'Work'
      if (h >= 11 && h < 15) return 'Eat'
      if (h >= 17 && h <= 21) return 'Relax'
      if (h >= 6 && h < 9) return 'Exercise'
      return weekend ? 'Relax' : 'Work'
    } catch { return 'Work' }
  }

  
  const lastCtxFetchRef = React.useRef(0)
  const lastRecFetchRef = React.useRef(0)
  const recDebounceRef = React.useRef(null)
  const lastManualTickRef = React.useRef(-1)
  const lastRecKeyRef = React.useRef(null)

  const kmText = (m) => {
    if (m == null) return null
    const meters = Number(m)
    if (!isFinite(meters)) return null
    if (meters < 1000) return `${Math.round(meters)} m`
    const km = meters / 1000
    return km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`
  }

  const toRad = (d) => (d * Math.PI) / 180
  const haversineMeters = (lat1, lon1, lat2, lon2) => {
    try {
      if (![lat1,lon1,lat2,lon2].every(v => typeof v === 'number' && isFinite(v))) return null
      const R = 6371000
      const dLat = toRad(lat2 - lat1)
      const dLon = toRad(lon2 - lon1)
      const a = Math.sin(dLat/2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon/2) ** 2
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
      return R * c
    } catch { return null }
  }

  const distanceForRec = (r) => {
    try {
      if (r?.travel && typeof r.travel.distanceKm === 'number' && isFinite(r.travel.distanceKm) && r.travel.distanceKm > 0) {
        return r.travel.distanceKm * 1000
      }
      if (!geo || typeof geo.lat !== 'number' || typeof geo.lng !== 'number') return null
      const glat = r?.geocodes?.latitude ?? r?.geocodes?.lat ?? r?.location?.lat ?? r?.lat
      const glng = r?.geocodes?.longitude ?? r?.geocodes?.lng ?? r?.location?.lng ?? r?.lng
      const dm = haversineMeters(geo.lat, geo.lng, glat, glng)
      if (typeof dm === 'number' && isFinite(dm)) return dm
      return null
    } catch { return null }
  }

  const DistanceIcon = ({ r }) => {
    try {
  const isDriving = r?.travel && typeof r.travel.distanceKm === 'number' && isFinite(r.travel.distanceKm) && r.travel.distanceKm > 0 && ['google','mapbox'].includes(String(r.travel.source||'').toLowerCase())
  return isDriving
        ? <Car className="w-3.5 h-3.5" />
        : <MapPin className="w-3.5 h-3.5" />
    } catch { return <MapPin className="w-3.5 h-3.5" /> }
  }

  const mapsLinkFor = (r) => {
    try {
      const dlat = r?.geocodes?.latitude ?? r?.location?.lat ?? r?.lat
      const dlng = r?.geocodes?.longitude ?? r?.location?.lng ?? r?.lng
      if (isFinite(dlat) && isFinite(dlng)) {
        const origin = (geo?.lat != null && geo?.lng != null) ? `&origin=${encodeURIComponent(`${geo.lat},${geo.lng}`)}` : ''
        return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${dlat},${dlng}`)}${origin}`
      }
      const q = encodeURIComponent(r?.name || 'destination')
      return `https://www.google.com/maps/search/?api=1&query=${q}`
    } catch {
      return 'https://www.google.com/maps'
    }
  }

  const formatPopularity = (v) => {
    const n = Number(v)
    if (!isFinite(n)) return null
    if (n > 0 && n <= 1) return `${Math.round(n * 100)}%`
    if (n <= 10) return n.toFixed(1)
    if (n <= 100) return String(Math.round(n))
    return String(n)
  }

  const computePopularity = (r) => {
    try {
      if (typeof r.rating === 'number') return null
      if (typeof r.score === 'number') return null
      let p = 0.3
      const disp = distanceForRec(r)
      if (typeof disp === 'number' && isFinite(disp)) {
        const d = Math.max(0, Math.min(3000, disp))
        const near = 1 - d / 3000 // 0..1
        p = Math.max(p, 0.2 + 0.6 * near)
      }
      const cats = Array.isArray(r.categories) ? r.categories.join(',').toLowerCase() : ''
      if (/coffee|cafe|café|lunch|dessert|park/.test(cats)) p += 0.05
      const now = new Date(); const h = now.getHours()
      if (/coffee|cafe|café/.test(cats) && h >= 9 && h <= 12) p += 0.05
      if (/lunch|restaurant/.test(cats) && h >= 11 && h <= 14) p += 0.05
      if (/dessert|bakery|ice cream/.test(cats) && h >= 20 && h <= 23) p += 0.05
      return Math.max(0, Math.min(1, p))
    } catch { return null }
  }

  const buildTags = (r) => {
    try {
      const cats = Array.isArray(r.categories) ? r.categories : []
      const primary = cats[0] || null
      const tags = []
      if (primary) tags.push(primary)
      const name = (primary||'').toLowerCase()
      if (/coffee|cafe|café/.test(name)) tags.push('WiFi')
      if (/park|outdoor|garden|terrace/.test(name)) tags.push('Outdoor')
      if (typeof r.rating === 'number') {
        if (r.rating >= 8) tags.push('Popular')
        else if (r.rating <= 6) tags.push('Quiet')
      }
      if (typeof r.score === 'number' && tags.indexOf('Popular') === -1) {
        if (r.score >= 0.8) tags.push('Popular')
        else if (r.score <= 0.4) tags.push('Quiet')
      }
      if (typeof r.rating !== 'number' && typeof r.score !== 'number') {
        const cp = computePopularity(r)
        if (typeof cp === 'number') {
          if (cp >= 0.7 && tags.indexOf('Popular') === -1) tags.push('Popular')
          else if (cp <= 0.3 && tags.indexOf('Quiet') === -1) tags.push('Quiet')
        }
      }
      return tags.slice(0,3).join(' • ') || null
    } catch { return null }
  }

  const weatherSummary = () => {
    try {
      const raw = ctx?.weather?.weather?.summary || ctx?.weather?.summary || ''
      return String(raw).toLowerCase()
    } catch { return '' }
  }
  const isSunnyNow = () => {
    const s = weatherSummary()
    return /(sun|clear)/.test(s) && !/(rain|drizzle|snow|storm|thunder)/.test(s)
  }
  const isRainingNow = () => /(rain|drizzle|storm|thunder)/.test(weatherSummary())
  const isEveningNow = () => { try { return (getLocalNow()?.getHours?.() || new Date().getHours()) >= 18 } catch { return false } }
  const hasFreeWindowToday = (startMin, endMin) => {
    try {
      const today = getLocalNow() || new Date()
      const slots = freeSlotsForDate(today)
      return slots?.some(s => Math.max(s.start, startMin) < Math.min(s.end, endMin)) || false
    } catch { return false }
  }
  const ratingText = (r) => {
    try {
      if (typeof r?.rating === 'number' && isFinite(r.rating)) {
        const val = r.rating > 5 ? (r.rating / 2) : r.rating
        return `${val.toFixed(1)}⭐`
      }
      if (typeof r?.score === 'number' && isFinite(r.score)) return `${(r.score * 5).toFixed(1)}⭐`
      const cp = computePopularity(r)
      if (typeof cp === 'number') return `${(Math.max(0, Math.min(1, cp)) * 5).toFixed(1)}⭐`
      return null
    } catch { return null }
  }
  const walkingMinutes = (meters) => {
    try {
      if (typeof meters !== 'number' || !isFinite(meters) || meters <= 0) return null
      const min = Math.max(1, Math.round(meters / (5000/60))) // ~5 km/h
      return `${min} min`
    } catch { return null }
  }
  const pickRecByCategory = (list, terms = []) => {
    try {
      if (!Array.isArray(list) || list.length === 0) return null
      const t = terms.map(s => String(s).toLowerCase())
      const scored = list.map(r => {
        const cats = Array.isArray(r?.categories) ? r.categories.join(',').toLowerCase() : ''
        const name = String(r?.name || '').toLowerCase()
        const match = t.some(term => cats.includes(term) || name.includes(term))
        const d = (()=>{ const v = distanceForRec(r); return (typeof v === 'number' && isFinite(v)) ? v : Number.POSITIVE_INFINITY })()
        const rat = (()=>{ const v = r?.rating; return (typeof v === 'number' && isFinite(v)) ? v : 0 })()
        return { r, match, d, rat }
      })
      const filtered = scored.filter(x => x.match)
      const best = (filtered.length ? filtered : scored).sort((a,b)=> a.d - b.d || b.rat - a.rat)[0]
      return best?.r || null
    } catch { return null }
  }
  const getContextHighlight = () => {
    try {
      const sunny = isSunnyNow()
      const raining = isRainingNow()
      const evening = isEveningNow()
      const freeLunch = hasFreeWindowToday(13*60, 14*60)

      if (sunny && freeLunch) {
        const cand = pickRecByCategory(recs, ['cafe','coffee'])
        let text = 'Outdoor Café nearby'
        const parts = []
        if (cand) {
          const d = distanceForRec(cand)
          const walk = walkingMinutes(d)
          const rt = ratingText(cand)
          if (rt) parts.push(rt)
          if (walk) parts.push(`${walk} walk`)
        }
        return { emoji: '🌤', title: text, details: parts.join(', '), rec: cand }
      }
      if (raining) {
        const cand = pickRecByCategory(recs, ['museum','mall','cinema','library','spa','arcade','bowling','indoor','shopping','bookstore','restaurant'])
        const parts = []
        if (cand) {
          const d = distanceForRec(cand)
          const km = kmText(d)
          const rt = ratingText(cand)
          if (rt) parts.push(rt)
          if (km) parts.push(String(km))
        }
        return { emoji: '☔', title: 'Indoor spots nearby', details: parts.join(', '), rec: cand }
      }
      if (evening) {
        const cand = pickRecByCategory(recs, ['dinner','restaurant','bar','pub','lounge'])
        const parts = []
        if (cand) {
          const d = distanceForRec(cand)
          const km = kmText(d)
          const rt = ratingText(cand)
          if (rt) parts.push(rt)
          if (km) parts.push(String(km))
        }
        return { emoji: '🌆', title: 'Dinner + Drinks nearby', details: parts.join(', '), rec: cand }
      }
      return null
    } catch { return null }
  }
  
  const refreshLocation = React.useCallback(() => {
    setGeoError(null)
    if (!('geolocation' in navigator)) {
      setGeoError('Geolocation not supported by this browser')
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords
        const next = { lat: latitude, lng: longitude, accuracy: Number(accuracy), ts: Date.now() }
        setGeo(next)
        try { localStorage.setItem('is_geo', JSON.stringify(next)) } catch {}
      },
      (err) => {
        setGeoError(err?.message || 'Unable to get location')
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    )
  }, [])

  useEffect(() => {
    try {
      const cached = localStorage.getItem('is_geo')
      if (cached) {
        const g = JSON.parse(cached)
        if (g && typeof g.lat === 'number' && typeof g.lng === 'number') {
          const ts = Number(g.ts) || 0
          const acc = Number(g.accuracy)
          const fresh = ts > 0 && (Date.now() - ts) < (10 * 60 * 1000) 
          const good = isFinite(acc) ? acc <= 2000 : true 
          if (fresh && good) setGeo(g)
        }
      }
    } catch {}
    refreshLocation()
  }, [refreshLocation])

  useEffect(() => {
    let watchId = null
    if ('geolocation' in navigator && navigator.permissions?.query) {
      navigator.permissions.query({ name: 'geolocation' }).then((p) => {
        if (p.state === 'granted') {
          watchId = navigator.geolocation.watchPosition(
            (pos) => {
              const next = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: Number(pos.coords.accuracy), ts: Date.now() }
              const prev = (() => { try { return JSON.parse(localStorage.getItem('is_geo')||'null') } catch { return null } })() || geo
              let moved = false
              try {
                const d = haversineMeters(prev?.lat, prev?.lng, next.lat, next.lng)
                moved = typeof d === 'number' && isFinite(d) && d > 120 // >120m movement
              } catch {}
              const improvedAccuracy = (typeof prev?.accuracy === 'number') && isFinite(prev.accuracy)
                ? (next.accuracy + 50 < prev.accuracy) // 50m better
                : true
              const stale = (typeof prev?.ts === 'number') ? (Date.now() - prev.ts > 2 * 60 * 1000) : true // >2 min
              if (moved || improvedAccuracy || stale || !prev) {
                setGeo(next)
                try { localStorage.setItem('is_geo', JSON.stringify(next)) } catch {}
              }
            },
            () => {},
            { enableHighAccuracy: true, maximumAge: 60000, timeout: 20000 }
          )
        }
      }).catch(() => {})
    }
    return () => { if (watchId != null && 'geolocation' in navigator) navigator.geolocation.clearWatch(watchId) }
  }, [])

  useEffect(() => {
    if (!geo) return
    const fetchContext = async () => {
      try {
        setCtxLoading(true); setCtxError(null)
        const res = await fetch(`/api/context?lat=${encodeURIComponent(geo.lat)}&lng=${encodeURIComponent(geo.lng)}&query=coffee`)
        if (!res.ok) throw new Error(`Context ${res.status}`)
        const data = await res.json()
  const c = data?.context || data || {}
  setCtx({ location: c.location || null, weather: c.weather || null, timezone: c.timezone || null, traffic: c.traffic || null })
        const iso = c?.timezone?.localTime
        if (iso) {
          try {
            const baseLocal = new Date(iso).getTime()
            if (!Number.isNaN(baseLocal)) {
              timeBaseRef.current = { baseLocal, baseSys: Date.now() }
              setLocalClock(formatLocalTime(new Date(baseLocal)))
            }
          } catch {}
        }
      } catch (e) {
        setCtxError(e.message || 'Failed to load context')
      } finally {
        setCtxLoading(false)
      }
    }
  const period = Math.max(30, Number(settings?.refreshSec || 60)) * 1000
  const minGap = Math.max(15000, Math.floor(period / 2))
  const now = Date.now()
  if (now - lastCtxFetchRef.current > minGap) {
    lastCtxFetchRef.current = now
    fetchContext()
  }
  let id = null
  if (!settings?.manualOnly) {
    id = setInterval(() => {
      const t = Date.now()
      if (t - lastCtxFetchRef.current > minGap) {
        lastCtxFetchRef.current = t
        fetchContext()
      }
    }, period)
  }
  return () => { if (id) clearInterval(id) }
  }, [geo, settings?.refreshSec, settings?.manualOnly])

  const formatLocalTime = (value) => {
    try {
      if (!value) return null
      const d = value instanceof Date ? value : new Date(value)
      const h = d.getHours()
      const m = d.getMinutes()
      const mer = h >= 12 ? 'PM' : 'AM'
      const h12 = h % 12 === 0 ? 12 : h % 12
      return `${String(h12).padStart(2,'0')}:${String(m).padStart(2,'0')} ${mer}`
    } catch {
      return null
    }
  }

  const formatTraffic = (t) => {
    try {
      if (!t) return null
      let label = ''
      let level = null
      if (typeof t === 'string') {
        label = t
      } else if (typeof t === 'object') {
        if (t.level) level = String(t.level).toLowerCase()
        if (!level && t.summary) level = String(t.summary).toLowerCase()
        if (level) {
          if (/(none|low|light)/.test(level)) label = 'Light'
          else if (/(moderate|med)/.test(level)) label = 'Moderate'
          else if (/(high|heavy|severe)/.test(level)) label = 'Heavy'
        }
        if (!label && t.congestion != null) {
          const p = Math.round(Number(t.congestion) * 100)
          if (p < 10) label = 'Light'
          else if (p < 35) label = 'Moderate'
          else label = 'Heavy'
        }
      }
      return label || '—'
    } catch { return null }
  }

  const trafficDotClass = (label) => {
    const s = String(label || '').toLowerCase()
    if (/light/.test(s)) return 'bg-green-500'
    if (/moderate/.test(s)) return 'bg-yellow-500'
    if (/heavy/.test(s)) return 'bg-red-500'
    return 'bg-gray-400'
  }

  const formatWeather = (w) => {
    try {
      if (!w) return null
      const raw = w?.weather?.summary || w?.summary || ''
      const temp = w?.temperature?.actual
      const label = raw || 'Weather'
      return `${label}${temp != null ? ` ${Math.round(temp)}°C` : ''}`
    } catch { return null }
  }

  const getWeatherIcon = (w) => {
    try {
      const raw = w?.weather?.summary || w?.summary || ''
      const s = String(raw).toLowerCase()
      if (/thunder|storm/.test(s)) return CloudLightning
      if (/drizzle/.test(s)) return CloudDrizzle
      if (/rain|shower/.test(s)) return CloudRain
      if (/snow|sleet|freez/.test(s)) return CloudSnow
      if (/fog|mist|haze|smoke/.test(s)) return CloudFog
      if (/wind/.test(s)) return Wind
      if (/cloud|overcast/.test(s)) return Cloud
      return Sun
    } catch { return Sun }
  }

  useEffect(() => {
    const zonedLabel = () => {
      try {
        const mod = ctx?.timezone?.minutesOfDay
        if (Number.isFinite(mod)) {
          const h = Math.floor(mod / 60)
          const m = mod % 60
          const mer = h >= 12 ? 'PM' : 'AM'
          const h12 = (h % 12) === 0 ? 12 : (h % 12)
          return `${String(h12).padStart(2,'0')}:${String(m).padStart(2,'0')} ${mer}`
        }
        const tzid = ctx?.timezone?.timezoneId
        const raw = ctx?.timezone?.rawOffset
        const dst = ctx?.timezone?.dstOffset
        if (tzid) {
          const ms = timeBaseRef.current
            ? (timeBaseRef.current.baseLocal + (Date.now() - timeBaseRef.current.baseSys))
            : Date.now()
          const fmt = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: tzid })
          return fmt.format(new Date(ms))
        }
        if (typeof raw === 'number' && typeof dst === 'number') {
          const ms = Date.now() + (raw + dst) * 1000
          const d = new Date(ms)
          const h = d.getUTCHours()
          const m = d.getUTCMinutes()
          const mer = h >= 12 ? 'PM' : 'AM'
          const h12 = (h % 12) === 0 ? 12 : (h % 12)
          return `${String(h12).padStart(2,'0')}:${String(m).padStart(2,'0')} ${mer}`
        }
      } catch { /* ignore */ }
      return formatLocalTime(new Date())
    }

    setLocalClock(zonedLabel())
    const id = setInterval(() => {
      setLocalClock(zonedLabel())
    }, 30000)
    return () => clearInterval(id)
  }, [ctx?.timezone?.timezoneId, ctx?.timezone?.rawOffset, ctx?.timezone?.dstOffset])

  const getLocalNow = () => {
    try {
      if (timeBaseRef.current && typeof timeBaseRef.current.baseLocal === 'number' && typeof timeBaseRef.current.baseSys === 'number') {
        const { baseLocal, baseSys } = timeBaseRef.current
        const ms = baseLocal + (Date.now() - baseSys)
        if (!Number.isNaN(ms)) return new Date(ms)
      }
      if (ctx?.timezone?.localTime) return new Date(ctx.timezone.localTime)
    } catch {}
  return new Date()
  }

  const nextFreeSlotToday = (dayIdx, minGapMin = 45) => {
    if (settings?.minGapMin) {
      const mg = Number(settings.minGapMin)
      if (!Number.isNaN(mg) && mg > 0) minGapMin = mg
    }
    const wkKey = weekKeyFromDate(currentWeekStart)
    const list = dayEvents(dayIdx, wkKey).slice().sort((a,b)=>a.start-b.start)
    const now = getLocalNow()
    const todayIdx = (()=>{
      const start = new Date(currentWeekStart)
      const t = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const diff = Math.floor((t - new Date(start.getFullYear(), start.getMonth(), start.getDate()))/(24*60*60*1000))
      return diff
    })()
    const isToday = dayIdx === todayIdx
    const nowMin = isToday ? (now.getHours()*60 + now.getMinutes()) : 0
    let prevEnd = Math.max(0, nowMin)
    for (const ev of list) {
      if (ev.start > prevEnd) {
        const gap = ev.start - prevEnd
        if (gap >= minGapMin) return prevEnd
      }
      prevEnd = Math.max(prevEnd, ev.end)
    }
    if ((24*60 - prevEnd) >= minGapMin) return prevEnd
    return null
  }

  const deriveAutoSuggestion = () => {
    const now = getLocalNow()
    const hour = now.getHours()
    const wkStart = new Date(currentWeekStart)
    const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const startDate = new Date(wkStart.getFullYear(), wkStart.getMonth(), wkStart.getDate())
    const diffDays = Math.floor((todayDate - startDate)/(24*60*60*1000))
    const dayIndex = diffDays >= 0 && diffDays <= 6 ? diffDays : 0
    const freeStartMin = nextFreeSlotToday(dayIndex, 45)
    const nowMin = now.getHours()*60 + now.getMinutes()
    let hForCategory = hour
    if (freeStartMin != null) {
      const diffMin = freeStartMin - nowMin
      hForCategory = (diffMin >= 0 && diffMin <= 180) ? Math.floor(freeStartMin/60) : hour // within 3 hours
    }

   
    let query = 'coffee'
    if (hForCategory >= 6 && hForCategory < 11) {
      query = 'coffee'
    } else if (hForCategory >= 11 && hForCategory < 15) {
      query = 'lunch'
    } else if (hForCategory >= 15 && hForCategory < 17) {
      query = 'cafe'
    } else if (hForCategory >= 17 && hForCategory < 21) {
      query = 'cafe'
    } else if (hForCategory >= 21 && hForCategory <= 23) {
      query = 'dessert'
    } else {
      query = 'coffee'
    }

    let startHHMM = '15:00'
    if (freeStartMin != null) {
      startHHMM = minutesToHHMM(freeStartMin)
    } else {
      let h = now.getHours()
      let m = now.getMinutes()
      m = Math.min(55, Math.ceil(m/5)*5)
      startHHMM = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`
    }
  if (sugQueryOverride) query = sugQueryOverride
  return { query, dayIndex, startHHMM }
  }
  
  useEffect(() => {
    if (!geo) return
  const meta = deriveAutoSuggestion()
  const autoTab = sugTabOverride || deriveAutoTab()
  const tabQuery = queryForTab(autoTab)
  const q = sugQueryOverride || tabQuery || meta.query
  setActiveTab(autoTab)
  setAutoSug({ ...meta, query: q })
    const recKey = `${autoTab}|${q}`
    if (settings?.manualOnly) {
      if (lastManualTickRef.current === refreshTick) return
      lastManualTickRef.current = refreshTick
    }
    if (recDebounceRef.current) { clearTimeout(recDebounceRef.current); recDebounceRef.current = null }
    recDebounceRef.current = setTimeout(async () => {
      const minMs = 25000
      const now = Date.now()
      const changed = lastRecKeyRef.current !== recKey
      if (!changed && (now - lastRecFetchRef.current < minMs)) return
      lastRecKeyRef.current = recKey
      lastRecFetchRef.current = now
      ;(async () => {
      try {
        setRecLoading(true); setRecError(null)
    const res = await fetch(`/api/recommendations?lat=${encodeURIComponent(geo.lat)}&lng=${encodeURIComponent(geo.lng)}&query=${encodeURIComponent(q)}`)
        if (!res.ok) throw new Error(`Recommendations ${res.status}`)
        const data = await res.json()
  let list = Array.isArray(data?.recommendations) && data.recommendations.length > 0
          ? data.recommendations
          : (data?.context?.places || [])

        if ((!data?.recommendations || data.recommendations.length === 0) && q) {
          const normalize = (s) => (s || '')
            .toString()
            .toLowerCase()
            .normalize('NFD')
            .replace(/\p{Diacritic}/gu, '')
          const qBase = normalize(q)
          const synonyms = new Set([
            qBase,
            ...(qBase === 'coffee' ? ['cafe','café','espresso'] : []),
            ...(qBase === 'cafe' ? ['coffee','café','espresso'] : []),
            ...(qBase === 'lunch' ? ['restaurant','food','eatery'] : []),
            ...(qBase === 'dessert' ? ['dessert','ice cream','bakery','sweet'] : []),
          ])
          const filtered = list.filter((p) => {
            const name = normalize(p?.name)
            const cats = normalize(Array.isArray(p?.categories) ? p.categories.join(',') : '')
            for (const term of synonyms) {
              if (!term) continue
              if (name.includes(term) || cats.includes(term)) return true
            }
            return false
          })
          if (filtered.length > 0) list = filtered
        }
        list = list.slice().sort((a,b) => {
          const da = (() => { const d = distanceForRec(a); return (typeof d === 'number') ? d : Number.POSITIVE_INFINITY })()
          const db = (() => { const d = distanceForRec(b); return (typeof d === 'number') ? d : Number.POSITIVE_INFINITY })()
          if (da !== db) return da - db
          const ra = (typeof a?.rating === 'number') ? a.rating : 0
          const rb = (typeof b?.rating === 'number') ? b.rating : 0
          return rb - ra
        })
        setRecs(list)
      } catch (e) {
        setRecError(e.message || 'Failed to load recommendations')
      } finally {
        setRecLoading(false)
      }
      })()
    }, 500)
  }, [ctx, events, currentWeekStart, geo, refreshTick, sugQueryOverride, settings?.manualOnly])

  useEffect(() => { try { localStorage.setItem('is_favorites', JSON.stringify(favorites)) } catch {} }, [favorites])
  useEffect(() => { try { localStorage.setItem('is_settings', JSON.stringify(settings)) } catch {} }, [settings])
  useEffect(() => {
    try {
      const manual = events.filter(e => e && e.source !== 'gcal' && !String(e.id||'').startsWith('gcal-'))
      localStorage.setItem('is_events', JSON.stringify(manual))
    } catch {}
  }, [events])
  useEffect(() => { try {
    if (sugQueryOverride) localStorage.setItem('is_query_override', sugQueryOverride)
    else localStorage.removeItem('is_query_override')
  } catch {} }, [sugQueryOverride])
  const onSubmitAdd = (e) => {
    e.preventDefault()
    const startMin = toMinutes(form.start)
    let durMin = 0
    if (form.durationMode === 'custom') {
      const h = parseInt(form.customHours, 10) || 0
      const m = parseInt(form.customMinutes, 10) || 0
      durMin = h * 60 + m
    } else {
      durMin = Number(form.duration) || 0
    }
    durMin = Math.max(5, durMin)
    const baseEvt = {
      id: isEditing && editId ? editId : `${Date.now()}`,
      weekKey: weekKeyFromDate(currentWeekStart),
      day: Number(form.day),
      title: form.title?.trim() || 'New event',
      start: startMin,
      end: startMin + durMin
    }
  const conflicts = dayEvents(baseEvt.day, baseEvt.weekKey)
      .filter(ev => !(isEditing && ev.id === editId))
      .some(ev => hasOverlap(ev, baseEvt))
    if (conflicts) {
      setFormError('This time overlaps with an existing event. Pick a different start time or day.')
      return
    }
    const evt = baseEvt
    setEvents((arr) => {
      if (isEditing && editId) {
        return arr.map(ev => (ev.id === editId ? evt : ev))
      }
      return [...arr, evt]
    })
    setShowModal(false)
  setFormError(null)
  setForm({ title: '', day: 0, start: '15:00', hour12: 3, minute: 0, meridiem: 'PM', startText: '03:00 PM', startInvalid: false, duration: 30, durationMode: 'preset', customHours: 0, customMinutes: 30 })
    setIsEditing(false)
    setEditId(null)
  }

  useEffect(() => {
    let abort = false
    ;(async () => {
      try {
        setEvents(prev => prev.filter(e => e && e.source !== 'gcal' && !String(e.id||'').startsWith('gcal-')))
        const token = await getAccessToken({ scopes: ['https://www.googleapis.com/auth/calendar.readonly'] })
        if (!token) return
        const base = visibleMonth || new Date()
        const start = new Date(base.getFullYear(), base.getMonth(), 1)
        const end = new Date(base.getFullYear(), base.getMonth() + 1, 1)
        const items = await fetchGoogleCalendarEvents({ accessToken: token, timeMin: start, timeMax: end })
        if (abort) return
        setEvents(prev => {
          const next = prev.filter(e => e && e.source !== 'gcal' && !String(e.id||'').startsWith('gcal-'))
          for (const it of items) {
            const startStr = it.start?.dateTime || it.start?.date
            const endStr = it.end?.dateTime || it.end?.date
            if (!startStr || !endStr) continue
            const s = new Date(startStr)
            const en = new Date(endStr)
            if (isNaN(s) || isNaN(en)) continue
            const wkStart = startOfWeek(s)
            const wkKey = weekKeyFromDate(wkStart)
            const dayIdx = Math.floor((new Date(s.getFullYear(), s.getMonth(), s.getDate()) - new Date(wkStart.getFullYear(), wkStart.getMonth(), wkStart.getDate()))/(24*60*60*1000))
            const startMin = s.getHours()*60 + s.getMinutes()
            const endMin = en.getHours()*60 + en.getMinutes()
            const title = it.summary || 'Google event'
            const candidate = { id: `gcal-${it.id}-${s.getTime()}`, source: 'gcal', gcalId: it.id, weekKey: wkKey, day: dayIdx, title, start: startMin, end: Math.max(startMin+5, endMin) }
            next.push(candidate)
          }
          return next
        })
      } catch (err) {
      }
    })()
    return () => { abort = true }
  }, [visibleMonth])

  useEffect(() => {
    let cancelled = false
    const periodSec = Math.max(60, Number(settings?.refreshSec || 120))
    const tick = async () => {
      try {
        setEvents(prev => prev.filter(e => e && e.source !== 'gcal' && !String(e.id||'').startsWith('gcal-')))
        const token = await getAccessToken({ scopes: ['https://www.googleapis.com/auth/calendar.readonly'] })
        if (!token || cancelled) return
        const base = visibleMonth || new Date()
        const start = new Date(base.getFullYear(), base.getMonth(), 1)
        const end = new Date(base.getFullYear(), base.getMonth() + 1, 1)
        const items = await fetchGoogleCalendarEvents({ accessToken: token, timeMin: start, timeMax: end })
        if (cancelled) return
        setEvents(prev => {
          const next = prev.filter(e => e && e.source !== 'gcal' && !String(e.id||'').startsWith('gcal-'))
          for (const it of items) {
            const startStr = it.start?.dateTime || it.start?.date
            const endStr = it.end?.dateTime || it.end?.date
            if (!startStr || !endStr) continue
            const s = new Date(startStr)
            const en = new Date(endStr)
            if (isNaN(s) || isNaN(en)) continue
            const wkStart = startOfWeek(s)
            const wkKey = weekKeyFromDate(wkStart)
            const dayIdx = Math.floor((new Date(s.getFullYear(), s.getMonth(), s.getDate()) - new Date(wkStart.getFullYear(), wkStart.getMonth(), wkStart.getDate()))/(24*60*60*1000))
            const startMin = s.getHours()*60 + s.getMinutes()
            const endMin = en.getHours()*60 + en.getMinutes()
            const title = it.summary || 'Google event'
            const candidate = { id: `gcal-${it.id}-${s.getTime()}`, source: 'gcal', gcalId: it.id, weekKey: wkKey, day: dayIdx, title, start: startMin, end: Math.max(startMin+5, endMin) }
            next.push(candidate)
          }
          return next
        })
      } catch {}
    }
    const id = setInterval(tick, periodSec * 1000)
    return () => { cancelled = true; clearInterval(id) }
  }, [visibleMonth, settings?.refreshSec])
  return (
    <div className="min-h-screen min-w-0 grid grid-cols-1 md:grid-cols-[260px_1fr] grid-rows-[64px_auto_1fr] md:grid-rows-[64px_1fr]">
      {/* Header */}
      <header className="row-start-1 col-span-1 md:col-span-2 flex items-center justify-between px-6 border-b border-gray-200 bg-white/70 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <a href="/" aria-label="Go to landing page" className="text-lg font-semibold text-gray-900 hover:opacity-80">IntelliSpot</a>
        </div>
        <div className="flex items-center gap-2 md:gap-3">
          <button
            type="button"
            aria-label="Import Google Calendar"
            className="inline-flex items-center gap-2 rounded-full bg-transparent text-black border border-black px-3 py-1.5 text-xs md:text-sm hover:opacity-90 transition"
      onClick={async () => {
              try {
        const token = await getAccessToken({ scopes: ['https://www.googleapis.com/auth/calendar.readonly'] })
                const now = new Date()
                const in60 = new Date(now)
                in60.setDate(in60.getDate() + 60)
                const items = await fetchGoogleCalendarEvents({ accessToken: token, timeMin: now, timeMax: in60 })
                setEvents(prev => {
                  const next = prev.filter(e => e && e.source !== 'gcal' && !String(e.id||'').startsWith('gcal-'))
                  for (const it of items) {
                    const startStr = it.start?.dateTime || it.start?.date
                    const endStr = it.end?.dateTime || it.end?.date
                    if (!startStr || !endStr) continue
                    const start = new Date(startStr)
                    const end = new Date(endStr)
                    if (isNaN(start) || isNaN(end)) continue
                    const wkStart = startOfWeek(start)
                    const wkKey = weekKeyFromDate(wkStart)
                    const dayIdx = Math.floor((new Date(start.getFullYear(), start.getMonth(), start.getDate()) - new Date(wkStart.getFullYear(), wkStart.getMonth(), wkStart.getDate()))/(24*60*60*1000))
                    const startMin = start.getHours()*60 + start.getMinutes()
                    const endMin = end.getHours()*60 + end.getMinutes()
                    const title = it.summary || 'Google event'
                    const candidate = { id: `gcal-${it.id}-${start.getTime()}`, source: 'gcal', gcalId: it.id, weekKey: wkKey, day: dayIdx, title, start: startMin, end: Math.max(startMin+5, endMin) }
                    if (next.some(e => e.id === candidate.id)) continue
                    const conflicts = next.filter(e => e.weekKey === wkKey && e.day === dayIdx).some(e => hasOverlap(e, candidate))
                    next.push(conflicts ? { ...candidate, title: `${title} (conflict)` } : candidate)
                  }
                  return next
                })
                alert('Imported Google Calendar events.')
              } catch (e) {
                console.error(e)
                alert(`Google Calendar import failed: ${e.message || e}`)
              }
            }}
          >
            <img
              src="https://www.gstatic.com/images/branding/product/2x/calendar_2020q4_48dp.png"
              alt="Google Calendar"
              className="w-4 h-4"
              referrerPolicy="no-referrer"
              onError={(e) => {
                const t = e.currentTarget
                const stage = parseInt(t.dataset.stage || '0', 10)
                const fallbacks = [
                  'https://www.gstatic.com/images/branding/product/2x/calendar_48dp.png',
                  'https://ssl.gstatic.com/calendar/images/favicons_v2018_2/calendar_2x.png',
                  'https://www.google.com/s2/favicons?domain=calendar.google.com&sz=64'
                ]
                if (stage < fallbacks.length) {
                  t.dataset.stage = String(stage + 1)
                  t.src = fallbacks[stage]
                }
              }}
            />
            <span className="hidden md:inline">Import Google Calendar</span>
            <span className="md:hidden">Import</span>
          </button>
          {/* Removed Add Schedule button per request */}
        </div>
      </header>

      {/* Sidebar */}
      <aside className="row-start-2 md:row-start-2 col-start-1 md:col-start-1 border-r md:border-r border-gray-200 bg-white/70 backdrop-blur-sm p-4 md:p-5 min-h-0 overflow-y-auto">
        <nav className="space-y-1 text-sm">
          {['Dashboard','My Schedule','Smart Suggestions','Favourites','Settings'].map((item) => (
            <a
              key={item}
              href="#"
              onClick={(e)=>{ e.preventDefault(); setActive(item) }}
              className={`block rounded-lg px-3 py-2 text-gray-800 hover:bg-gray-100 ${active===item ? 'bg-gray-100 font-medium' : ''}`}
            >{item}</a>
          ))}
        </nav>
      </aside>

      {/* Main content */}
  <main className="row-start-3 md:row-start-2 col-start-1 md:col-start-2 p-4 md:p-6 min-h-0 overflow-y-auto">
        {active === 'Dashboard' && (
  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
          {/* Smart Suggestions now on top-left (spans 2 columns) */}
          <section className="md:col-span-2 md:col-start-1 bg-white rounded-2xl shadow-sm border border-gray-200 p-4 transition hover:-translate-y-0.5 hover:shadow-md">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold text-gray-900">Smart Suggestions</h2>
              <div className="flex items-center gap-2">
                {TABS.map(tab => (
                  <button
                    key={tab}
                    className={`px-3 py-1.5 rounded-full text-xs border transition ${ (sugTabOverride || activeTab) === tab ? 'bg-black text-white border-black' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50' }`}
                    onClick={() => { setSugTabOverride(tab); setRefreshTick(t=>t+1) }}
                  >{tab}</button>
                ))}
                <button
                  onClick={() => { if (!geo) return; setRefreshTick((t) => t + 1) }}
                  className="ml-2 text-xs text-gray-600 hover:text-gray-900"
                >Refresh</button>
              </div>
            </div>
            <div className="text-xs text-gray-500 mb-2">
              Showing: <span className="font-medium">{sugTabOverride || activeTab}</span> • Query <span className="font-medium">{autoSug.query}</span> near you
              {geo && (typeof geo.accuracy === 'number') && isFinite(geo.accuracy) && geo.accuracy <= 200 && (
                <span> • Location ±{Math.round(geo.accuracy)} m{geo.ts ? ` · updated ${Math.max(0, Math.round((Date.now()-geo.ts)/60000))}m ago` : ''}</span>
              )}
              <button
                className="ml-2 underline hover:no-underline"
                onClick={() => { refreshLocation(); setRefreshTick(t=>t+1) }}
              >Update location</button>
            </div>
            {recLoading ? (
              <div className="text-sm text-gray-500">Loading recommendations…</div>
            ) : recError ? (
              <div className="text-sm text-red-600">{recError}</div>
            ) : (
              <div className="space-y-3" key={refreshTick}>
                {(() => { const h = getContextHighlight(); return h ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 flex items-center justify-between">
                    <div className="min-w-0 pr-3">
                      <div className="text-sm font-medium text-gray-900 truncate">{h.emoji} {h.title}</div>
                      {h.details ? <div className="text-[11px] text-gray-600 mt-0.5 truncate">{h.details}</div> : null}
                    </div>
                    {h.rec ? (
                      <a href={mapsLinkFor(h.rec)} target="_blank" rel="noopener noreferrer" className="rounded-full border border-gray-300 text-gray-700 px-3 py-1.5 text-xs hover:bg-gray-50">Go</a>
                    ) : null}
                  </div>
                ) : null })()}
                {recs.slice(0, 4).map((r) => {
                  const id = r.id || r.fsq_id || r.name
                  const tags = buildTags(r)
                  return (
                    <div key={id} className="anim-fade-up rounded-xl border border-gray-100 p-3 flex items-center justify-between transition hover:-translate-y-0.5 hover:shadow">
                      <div className="min-w-0 pr-3">
                        <div className="text-sm font-medium text-gray-900 truncate">{r.name}</div>
                        <div className="text-[11px] text-gray-500 flex items-center gap-3 mt-0.5">
                          {(() => { const d = distanceForRec(r); return (typeof d === 'number') ? (
                            <span className="inline-flex items-center gap-1"><DistanceIcon r={r} /> <span>{kmText(d)}</span></span>
                          ) : null })()}
                          {typeof r.rating === 'number' ? (
                            <span className="inline-flex items-center gap-1"><Star className="w-3.5 h-3.5" /> <span>{r.rating}</span></span>
                          ) : (typeof r.score === 'number' && formatPopularity(r.score)) ? (
                            <span className="inline-flex items-center gap-1"><Flame className="w-3.5 h-3.5" /> <span>{formatPopularity(r.score)}</span></span>
                          ) : (formatPopularity(computePopularity(r))) ? (
                            <span className="inline-flex items-center gap-1"><Flame className="w-3.5 h-3.5" /> <span>{formatPopularity(computePopularity(r))}</span></span>
                          ) : null}
                        </div>
                        {tags ? <div className="text-[11px] text-gray-600 mt-1 truncate">{tags}</div> : null}
                      </div>
                      <div className="flex items-center gap-2">
                        <a
                          href={mapsLinkFor(r)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-full border border-gray-300 text-gray-700 px-3 py-1.5 text-xs hover:bg-gray-50"
                        >Navigate</a>
                        <button
                          className="rounded-full bg-black text-white px-3 py-1.5 text-xs hover:opacity-90"
                          onClick={() => {
                            const title = r.name || 'Suggested activity'
                            const hhmm = autoSug.startHHMM || '15:00'
                            const { hour12, minute, meridiem } = hhmmToH12(hhmm)
                            setForm({ title, day: autoSug.dayIndex ?? 0, start: hhmm, hour12, minute, meridiem, startText: labelFromHHMM(hhmm), startInvalid: false, duration: 30, durationMode: 'preset', customHours: 0, customMinutes: 30 })
                            setIsEditing(false); setEditId(null); setFormError(null); setShowModal(true)
                          }}
                        >Add</button>
                      </div>
                    </div>
                  )
                })}
                {recs.length === 0 && (
                  <div className="text-sm text-gray-500">No suggestions right now.</div>
                )}
              </div>
            )}
          </section>

          {/* Right column: Context only */}
          <div className="md:col-span-1 h-full flex">
            {/* Context card */}
            <section className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 transition hover:-translate-y-0.5 hover:shadow-md h-full flex-1">
              <h2 className="text-base font-semibold text-gray-900 mb-3">Context</h2>
              {ctxLoading ? (
                <div className="text-sm text-gray-500">Loading context…</div>
              ) : ctxError ? (
                <div className="text-sm text-red-600">{ctxError}</div>
              ) : (
                <ul className="text-sm text-gray-800 space-y-2">
                  <li className="grid grid-cols-[auto,1fr] items-start gap-2">
                    <span className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-gray-700" />
                      <span>Location:</span>
                    </span>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium break-words">
                        {(() => {
                          const city = ctx.location?.city
                          const n = ctx.location?.name
                          if (city) return city
                          if (n) return n
                          if (ctx.weather?.location?.name) return ctx.weather.location.name
                          if (ctx.location?.lat != null && ctx.location?.lng != null) return `${ctx.location.lat.toFixed(3)}, ${ctx.location.lng.toFixed(3)}`
                          return 'Unknown'
                        })()}
                      </span>
                    </div>
                  </li>
                  <li className="grid grid-cols-[auto,1fr] items-start gap-2">
                    <span className="flex items-center gap-2">
                      <Sun className="w-4 h-4 text-gray-700" />
                      <span>Weather:</span>
                    </span>
                    <span className="font-medium break-words">
                      {(() => {
                        const Icon = getWeatherIcon(ctx.weather)
                        const text = formatWeather(ctx.weather) || '—'
                        return (
                          <span className="inline-flex items-center gap-1">
                            <Icon className="w-4 h-4 text-gray-700" />
                            <span>{text}</span>
                          </span>
                        )
                      })()}
                    </span>
                  </li>
                  <li className="grid grid-cols-[auto,1fr] items-start gap-2">
                    <span className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-gray-700" />
                      <span>Time:</span>
                    </span>
                    <span className="font-medium break-words">{localClock || '—'}</span>
                  </li>
                  <li className="grid grid-cols-[auto,1fr] items-start gap-2">
                    <span className="flex items-center gap-2">
                      <Car className="w-4 h-4 text-gray-700" />
                      <span>Traffic:</span>
                    </span>
                    <span className="font-medium break-words">
                      {(() => {
                        const text = formatTraffic(ctx.traffic) || '—'
                        const dot = trafficDotClass(text)
                        return (
                          <span className="inline-flex items-center gap-2">
                            <span className={`inline-block w-2.5 h-2.5 rounded-full ${dot}`}></span>
                            <span>{text}</span>
                          </span>
                        )
                      })()}
                    </span>
                  </li>
                  <li className="grid grid-cols-[auto,1fr] items-start gap-2">
                    <span className="flex items-center gap-2">
                      <CalendarIcon className="w-4 h-4 text-gray-700" />
                      <span>Free today:</span>
                      {/* Info tooltip for timeline legend */}
                      <span className="relative group inline-flex">
                        <button
                          type="button"
                          aria-label="Timeline legend"
                          className="text-gray-500 hover:text-gray-800 focus:outline-none"
                        >
                          <Info className="w-3.5 h-3.5" />
                        </button>
                        <div className="absolute left-0 top-5 z-20 w-56 rounded-md bg-white border border-gray-200 shadow-lg p-2 text-[11px] text-gray-700 hidden group-hover:block group-focus-within:block">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="inline-block w-5 h-2 rounded bg-emerald-400"></span>
                            <span>Free time</span>
                          </div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="inline-block w-5 h-2 rounded bg-gray-600"></span>
                            <span>Busy (scheduled)</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="inline-block w-0.5 h-3 bg-red-500"></span>
                            <span>Now</span>
                          </div>
                        </div>
                      </span>
                    </span>
                    <span className="font-medium break-words w-full">
                      {(() => {
                        const today = getLocalNow() || new Date()
                        const segs = buildDaySegments(today)
            const nowMins = (() => {
                          try {
              const mod = ctx?.timezone?.minutesOfDay
              if (Number.isFinite(mod)) return Math.max(0, Math.min(1439, mod))
                            const tzid = ctx?.timezone?.timezoneId
                            if (tzid) {
                              const ms = timeBaseRef.current
                                ? (timeBaseRef.current.baseLocal + (Date.now() - timeBaseRef.current.baseSys))
                                : Date.now()
                              const parts = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tzid }).formatToParts(new Date(ms))
                              const hh = Number(parts.find(p=>p.type==='hour')?.value)
                              const mm = Number(parts.find(p=>p.type==='minute')?.value)
                              if (Number.isFinite(hh) && Number.isFinite(mm)) return hh*60 + mm
                            }
                            const raw = ctx?.timezone?.rawOffset
                            const dst = ctx?.timezone?.dstOffset
                            if (typeof raw === 'number' && typeof dst === 'number') {
                              const ms = Date.now() + (raw + dst) * 1000
                              const d = new Date(ms)
                              return d.getUTCHours()*60 + d.getUTCMinutes()
                            }
                          } catch { /* ignore */ }
                          const d = today
                          return d.getHours()*60 + d.getMinutes()
                        })()
                        return (
                          <div className="space-y-1 w-full">
                            {/* Timeline bar */}
                            <div className="relative h-2 w-full rounded-full bg-gray-200 overflow-hidden">
                              <div className="absolute inset-0 flex">
                                {segs.map((s, idx) => {
                                  const widthPct = Math.max(0, (s.end - s.start) / (24*60)) * 100
                                  const bg = s.type === 'busy' ? 'bg-gray-600' : 'bg-emerald-400'
                                  return <div key={idx} className={`${bg}`} style={{ width: `${widthPct}%` }} />
                                })}
                              </div>
                              {/* now marker */}
                              {(() => {
                                const pct = Math.max(0, Math.min(99.5, (nowMins/(24*60))*100))
                                return <div className="absolute top-[-2px] h-3 w-0.5 bg-red-500" style={{ left: `${pct}%` }} />
                              })()}
                            </div>
                            {/* Labels: min text, keep concise */}
                            <div className="flex justify-between text-[10px] text-gray-500">
                              <span>00:00</span>
                              <span>12:00</span>
                              <span>24:00</span>
                            </div>
                            {/* Fallback text description */}
                            <div className="text-[11px] text-gray-600">
                              {formatFreeSlotsList(freeSlotsForDate(today))}
                            </div>
                          </div>
                        )
                      })()}
                    </span>
                  </li>
                  {/* Legend removed; now shown in tooltip above */}
                </ul>
              )}
            </section>
          </div>

          {/* Calendar moved below Smart Suggestions (now spans full width under Context) */}
          <section className="md:col-span-3 md:col-start-1">
            <div className="mb-3 text-black font-bold text-lg md:text-xl text-center">
              {(() => {
                const d = new Date()
                const mon = d.toLocaleString(undefined, { month: 'short' })
                const day = d.getDate()
                const yr = d.getFullYear()
                return `Today, ${mon} ${day}, ${yr}`
              })()}
            </div>
            <Calendar
              value={visibleMonth}
              onMonthChange={(firstDay) => {
                if (firstDay) setVisibleMonth(new Date(firstDay.getFullYear(), firstDay.getMonth(), 1))
              }}
              events={(() => {
                const base = visibleMonth || new Date()
                const start = new Date(base.getFullYear(), base.getMonth(), 1)
                const end = new Date(base.getFullYear(), base.getMonth() + 1, 1)
                const out = []
                for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
                  const wkStart = startOfWeek(d)
                  const wkKey = weekKeyFromDate(wkStart)
                  const dayIdx = Math.floor((new Date(d.getFullYear(), d.getMonth(), d.getDate()) - new Date(wkStart.getFullYear(), wkStart.getMonth(), wkStart.getDate())) / (24*60*60*1000))
                  const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
                  for (const ev of dayEventsSorted(dayIdx, wkKey)) {
                    out.push({
                      id: ev.id,
                      title: ev.title,
                      date: key,
                      time: `${String(Math.floor(ev.start/60)).padStart(2,'0')}:${String(ev.start%60).padStart(2,'0')}`,
                      color: ev.conflict ? '#ef4444' : '#2563eb'
                    })
                  }
                }
                return out
              })()}
              onDayClick={undefined}
              onAddClick={() => {
                const wkStart = currentWeekStart
                const now = new Date()
                const dayIdx = Math.max(0, Math.min(6, Math.floor((new Date(now.getFullYear(), now.getMonth(), now.getDate()) - new Date(wkStart.getFullYear(), wkStart.getMonth(), wkStart.getDate()))/(24*60*60*1000))))
                setForm(f => ({ ...f, day: dayIdx }))
                setShowModal(true)
              }}
              onDeleteEvent={(ev) => {
                setEvents((arr) => arr.filter((e) => e.id !== ev.id))
                try {
                  const manual = (JSON.parse(localStorage.getItem('is_events') || '[]') || []).filter((e) => e.id !== ev.id)
                  localStorage.setItem('is_events', JSON.stringify(manual))
                } catch {}
              }}
            />
          </section>
        </div>
        )}

        {active === 'My Schedule' && (
          <div className="grid grid-cols-1 gap-6">
            <section className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 transition hover:-translate-y-0.5 hover:shadow-md">
              <div className="mb-3 text-black font-bold text-lg md:text-xl text-center">
                {(() => {
                  const d = new Date()
                  const mon = d.toLocaleString(undefined, { month: 'short' })
                  const day = d.getDate()
                  const yr = d.getFullYear()
                  return `Today, ${mon} ${day}, ${yr}`
                })()}
              </div>
              <div className="space-y-4">
                {(() => {
                  const wkStart = currentWeekStart
                  const wkKey = weekKeyFromDate(wkStart)
                  const blocks = []
                  let any = false
                  for (let i = 0; i < 7; i++) {
                    const evs = dayEventsSorted(i, wkKey)
                    if (!evs || evs.length === 0) continue
                    any = true
                    const d = new Date(wkStart)
                    d.setDate(d.getDate() + i)
                    const head = d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
                    blocks.push(
                      <div key={`day-${i}`}>
                        <div className="text-sm font-semibold text-gray-900 mb-1">{head}</div>
                        <ul className="space-y-1">
                          {evs.map(ev => (
                            <li key={ev.id} className="text-sm text-gray-700">
                              <button
                                type="button"
                                className="w-full text-left hover:bg-gray-50 rounded-md px-2 py-1"
                                onClick={() => { setSelectedEvent(ev); setShowDetails(true) }}
                              >
                                <span className="font-mono text-gray-900">{labelFromMinutes(ev.start)}–{labelFromMinutes(ev.end)}</span>
                                <span className="mx-2">•</span>
                                <span className="font-medium">{ev.title}</span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )
                  }
                  if (!any) return <div className="text-sm text-gray-500">No schedule this week.</div>
                  return blocks
                })()}
              </div>
            </section>
          </div>
        )}

        {active === 'Smart Suggestions' && (
          <div className="grid grid-cols-1 gap-6">
            <section className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 transition hover:-translate-y-0.5 hover:shadow-md">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-semibold text-gray-900">Smart Suggestions</h2>
                <div className="flex items-center gap-2">
                  {TABS.map(tab => (
                    <button
                      key={tab}
                      className={`px-3 py-1.5 rounded-full text-xs border transition ${ (sugTabOverride || activeTab) === tab ? 'bg-black text-white border-black' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50' }`}
                      onClick={() => { setSugTabOverride(tab); setRefreshTick(t=>t+1) }}
                    >{tab}</button>
                  ))}
                  <input className="ml-2 border rounded-lg px-2 py-1 text-sm" placeholder="Override category (e.g., sushi, coffee)" value={sugQueryOverride || ''} onChange={(e)=> setSugQueryOverride(e.target.value || null)} />
                  <button onClick={()=> setRefreshTick(t=>t+1)} className="text-xs text-gray-600 hover:text-gray-900">Refresh</button>
                </div>
              </div>
              <div className="text-xs text-gray-500 mb-2">Showing: <span className="font-medium">{sugTabOverride || activeTab}</span> • Query <span className="font-medium">{autoSug.query}</span> near you</div>
              {recLoading ? (
                <div className="text-sm text-gray-500">Loading recommendations…</div>
              ) : recError ? (
                <div className="text-sm text-red-600">{recError}</div>
              ) : (
                <div className="space-y-3" key={refreshTick}>
                  {(() => { const h = getContextHighlight(); return h ? (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 flex items-center justify-between">
                      <div className="min-w-0 pr-3">
                        <div className="text-sm font-medium text-gray-900 truncate">{h.emoji} {h.title}</div>
                        {h.details ? <div className="text-[11px] text-gray-600 mt-0.5 truncate">{h.details}</div> : null}
                      </div>
                      {h.rec ? (
                        <a href={mapsLinkFor(h.rec)} target="_blank" rel="noopener noreferrer" className="rounded-full border border-gray-300 text-gray-700 px-3 py-1.5 text-xs hover:bg-gray-50">Go</a>
                      ) : null}
                    </div>
                  ) : null })()}
                  {recs.slice(0, 4).map((r) => {
                    const id = r.id || r.fsq_id || r.name
                    const tags = buildTags(r)
                    return (
                      <div key={id} className="anim-fade-up rounded-xl border border-gray-100 p-3 flex items-center justify-between transition hover:-translate-y-0.5 hover:shadow">
                        <div className="min-w-0 pr-3">
                          <div className="text-sm font-medium text-gray-900 truncate">{r.name}</div>
                          <div className="text-[11px] text-gray-500 flex items-center gap-3 mt-0.5">
                            {(() => { const d = distanceForRec(r); return (typeof d === 'number') ? (
                              <span className="inline-flex items-center gap-1"><DistanceIcon r={r} /> <span>{kmText(d)}</span></span>
                            ) : null })()}
                            {typeof r.rating === 'number' ? (
                              <span className="inline-flex items-center gap-1"><Star className="w-3.5 h-3.5" /> <span>{r.rating}</span></span>
                            ) : (typeof r.score === 'number' && formatPopularity(r.score)) ? (
                              <span className="inline-flex items-center gap-1"><Flame className="w-3.5 h-3.5" /> <span>{formatPopularity(r.score)}</span></span>
                            ) : (formatPopularity(computePopularity(r))) ? (
                              <span className="inline-flex items-center gap-1"><Flame className="w-3.5 h-3.5" /> <span>{formatPopularity(computePopularity(r))}</span></span>
                            ) : null}
                          </div>
                          {tags ? <div className="text-[11px] text-gray-600 mt-1 truncate">{tags}</div> : null}
                        </div>
                        <div className="flex items-center gap-2">
                          <a
                            href={mapsLinkFor(r)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-full border border-gray-300 text-gray-700 px-3 py-1.5 text-xs hover:bg-gray-50"
                          >Navigate</a>
                          <button className="rounded-full bg-black text-white px-3 py-1.5 text-xs hover:opacity-90" onClick={() => {
                            const title = r.name || 'Suggested activity'
                            const hhmm = autoSug.startHHMM || '15:00'
                            const { hour12, minute, meridiem } = hhmmToH12(hhmm)
                            setForm({ title, day: autoSug.dayIndex ?? 0, start: hhmm, hour12, minute, meridiem, startText: labelFromHHMM(hhmm), startInvalid: false, duration: 30, durationMode: 'preset', customHours: 0, customMinutes: 30 })
                            setIsEditing(false); setEditId(null); setFormError(null); setShowModal(true)
                          }}>Add</button>
                          <button className="rounded-full border border-gray-300 text-gray-700 px-3 py-1.5 text-xs hover:bg-gray-50" onClick={() => {
                            const item = { id, name: r.name, distance: r.distance, rating: r.rating }
                            setFavorites(prev => prev.some(x=>x.id===item.id) ? prev : [...prev, item])
                          }}>Save</button>
                        </div>
                      </div>
                    )
                  })}
                  {recs.length === 0 && (
                    <div className="text-sm text-gray-500">No suggestions right now.</div>
                  )}
                </div>
              )}
            </section>
          </div>
        )}

        {active === 'Favourites' && (
          <div className="grid grid-cols-1 gap-6">
            <section className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 transition hover:-translate-y-0.5 hover:shadow-md">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-semibold text-gray-900">Favourites</h2>
                <button onClick={()=> setFavorites([])} className="text-xs text-red-600 hover:text-red-800">Clear all</button>
              </div>
              {favorites.length === 0 ? (
                <div className="text-sm text-gray-500">No favourites yet. Save from Smart Suggestions.</div>
              ) : (
                <div className="space-y-3">
                  {favorites.map((f)=> (
                    <div key={f.id} className="rounded-xl border border-gray-100 p-3 flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{f.name}</div>
                        <div className="text-xs text-gray-500 flex items-center gap-3 mt-0.5">
                          {f.distance != null && (
                            <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> <span>{(f.distance/1000).toFixed(1)} km</span></span>
                          )}
                          {f.rating != null && (
                            <span className="flex items-center gap-1"><Star className="w-3.5 h-3.5" /> <span>{f.rating}</span></span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button className="rounded-full bg-black text-white px-3 py-1.5 text-xs hover:opacity-90" onClick={() => {
                          const title = f.name || 'Suggested activity'
                          const hhmm = autoSug.startHHMM || '15:00'
                          const { hour12, minute, meridiem } = hhmmToH12(hhmm)
                          setForm({ title, day: autoSug.dayIndex ?? 0, start: hhmm, hour12, minute, meridiem, startText: labelFromHHMM(hhmm), startInvalid: false, duration: 30, durationMode: 'preset', customHours: 0, customMinutes: 30 })
                          setIsEditing(false); setEditId(null); setFormError(null); setShowModal(true)
                        }}>Add</button>
                        <button className="rounded-full border border-gray-300 text-gray-700 px-3 py-1.5 text-xs hover:bg-gray-50" onClick={()=> setFavorites(prev=> prev.filter(x=>x.id!==f.id))}>Remove</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {active === 'Settings' && (
          <div className="grid grid-cols-1 gap-6">
            <section className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 transition hover:-translate-y-0.5 hover:shadow-md">
              <h2 className="text-base font-semibold text-gray-900 mb-3">Settings</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-700 mb-1">Auto-refresh (seconds)</label>
                  <input type="number" min={15} step={5} value={settings.refreshSec} onChange={(e)=> setSettings(s=> ({ ...s, refreshSec: Math.max(15, Number(e.target.value)||60) }))} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                  <p className="text-xs text-gray-500 mt-1">How often Context updates (time/weather).</p>
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-1">Min free slot (minutes)</label>
                  <input type="number" min={5} step={5} value={settings.minGapMin} onChange={(e)=> setSettings(s=> ({ ...s, minGapMin: Math.max(5, Number(e.target.value)||45) }))} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                  <p className="text-xs text-gray-500 mt-1">Gap used to pick next free time in suggestions.</p>
                </div>
                <div className="md:col-span-2 flex items-center gap-3">
                  <input id="manualOnly" type="checkbox" checked={!!settings.manualOnly} onChange={(e)=> setSettings(s=> ({ ...s, manualOnly: !!e.target.checked }))} />
                  <label htmlFor="manualOnly" className="text-sm text-gray-700">Manual refresh only for Smart Suggestions and Context</label>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm text-gray-700 mb-1">Default suggestion category (optional)</label>
                  <input type="text" placeholder="e.g., coffee, sushi" value={sugQueryOverride || ''} onChange={(e)=> setSugQueryOverride(e.target.value || null)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                  <p className="text-xs text-gray-500 mt-1">Overrides the automatic category selection.</p>
                </div>
              </div>
            </section>
          </div>
        )}
      </main>
  {/* Add/Edit Schedule Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowModal(false)}></div>
          <div className="relative z-10 w-full max-w-md rounded-2xl bg-white border border-gray-200 shadow-lg p-5">
    <h3 className="text-lg font-semibold text-gray-900 mb-3">{isEditing ? 'Edit Schedule' : 'Add Schedule'}</h3>
            <form onSubmit={onSubmitAdd} className="space-y-3">
              {formError && (
                <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm px-3 py-2">{formError}</div>
              )}
              <div>
                <label className="block text-sm text-gray-700 mb-1">Title</label>
                <input value={form.title} onChange={(e)=>{ setFormError(null); setForm(f=>({...f,title:e.target.value})) }} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black/20" placeholder="Meeting / Workout / etc" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-gray-700 mb-1">Day</label>
                  <select value={form.day} onChange={(e)=>{ setFormError(null); setForm(f=>({...f,day:e.target.value})) }} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black/20">
                    {days.map((d, i)=>(<option key={d} value={i}>{d}</option>))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-1">Start time</label>
                  <input
                    type="text"
                    list="timeOptions"
                    placeholder="e.g., 9:30 AM"
                    value={form.startText}
          onChange={(e)=>{
                      const raw = e.target.value
                      const parsed = parseUserTime(raw)
                      if (parsed) {
                        const { hour12, minute, meridiem } = hhmmToH12(parsed)
            setFormError(null)
            setForm(f=>({ ...f, startText: raw, start: parsed, hour12, minute, meridiem, startInvalid: false }))
                      } else {
                        setForm(f=>({ ...f, startText: raw, startInvalid: true }))
                      }
                    }}
                    onBlur={(e)=>{
                      const parsed = parseUserTime(e.target.value)
                      if (parsed) {
            setFormError(null)
            setForm(f=>({ ...f, startText: labelFromHHMM(parsed), startInvalid: false }))
                      }
                    }}
                    className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 ${form.startInvalid ? 'border-red-400 focus:ring-red-200' : 'border-gray-300 focus:ring-black/20'}`}
                  />
                  <datalist id="timeOptions">
                    {timeOptions.map(opt => (
                      <option key={opt.value} value={opt.label} />
                    ))}
                  </datalist>
                  <div className="mt-2 flex flex-wrap gap-2">
                      {[{label:'9:00 AM',h:9,m:0,mer:'AM'},{label:'10:00 AM',h:10,m:0,mer:'AM'},{label:'2:00 PM',h:2,m:0,mer:'PM'}].map(t => (
                        <button
                          key={t.label}
                          type="button"
                          onClick={()=>{
                            const hhmm = h12ToHHMM(t.h, t.m, t.mer)
                            const { hour12, minute, meridiem } = hhmmToH12(hhmm)
                          setFormError(null)
                          setForm(f=>({ ...f, start: hhmm, hour12, minute, meridiem, startText: labelFromHHMM(hhmm), startInvalid: false }))
                          }}
                          className="text-xs px-2 py-1 rounded-full border border-gray-300 text-gray-700 hover:bg-gray-50"
                        >{t.label}</button>
                      ))}
                      <button
                        type="button"
                        onClick={()=>{
                          const now = new Date()
                          let h = now.getHours()
                          let m = now.getMinutes()
                          m = Math.round(m/5)*5
                          if (m === 60) { m = 0; h = (h+1)%24 }
                          const hhmm = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`
                          const { hour12, minute, meridiem } = hhmmToH12(hhmm)
                          setFormError(null)
                          setForm(f=>({ ...f, start: hhmm, hour12, minute, meridiem, startText: labelFromHHMM(hhmm), startInvalid: false }))
                        }}
                        className="text-xs px-2 py-1 rounded-full border border-gray-300 text-gray-700 hover:bg-gray-50"
                      >Now</button>
                    </div>
                  </div>
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-1">Duration</label>
                <select
                  value={form.durationMode === 'custom' ? 'custom' : String(form.duration)}
                  onChange={(e)=>{
                    const v = e.target.value
                    if (v === 'custom') {
                      setForm(f=>({
                        ...f,
                        durationMode: 'custom',
                        customHours: Math.floor((Number(f.duration) || 0)/60),
                        customMinutes: (Number(f.duration) || 0)%60
                      }))
                    } else {
                      setForm(f=>({ ...f, durationMode: 'preset', duration: Number(v) }))
                    }
                  }}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black/20"
                >
                  {[15,30,45,60,90].map(m=>(<option key={m} value={m}>{m} minutes</option>))}
                  <option value="custom">Custom…</option>
                </select>
                {form.durationMode === 'custom' && (
                  <div className="mt-2 grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Hours</label>
                      <input
                        type="number"
                        min={0}
                        step={1}
                        value={form.customHours}
                        onChange={(e)=>setForm(f=>({ ...f, customHours: e.target.value }))}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black/20"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Minutes</label>
                      <input
                        type="number"
                        min={0}
                        max={59}
                        step={1}
                        value={form.customMinutes}
                        onChange={(e)=>{
                          let v = parseInt(e.target.value, 10)
                          if (isNaN(v) || v < 0) v = 0
                          if (v > 59) v = 59
                          setForm(f=>({ ...f, customMinutes: v }))
                        }}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black/20"
                      />
                    </div>
                  </div>
                )}
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button type="button" onClick={()=>setShowModal(false)} className="rounded-full px-4 py-1.5 text-sm border border-gray-300 text-gray-700">Cancel</button>
                <button type="submit" className="rounded-full px-4 py-1.5 text-sm bg-black text-white">{isEditing ? 'Save' : 'Add'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Event Details Modal */}
      {showDetails && selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowDetails(false)}></div>
          <div className="relative z-10 w-full max-w-md rounded-2xl bg-white border border-gray-200 shadow-lg p-5">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Schedule Details</h3>
            <div className="text-sm text-gray-800 space-y-1 mb-4">
              <div><span className="text-gray-500">Title:</span> <span className="font-medium">{selectedEvent.title}</span></div>
              <div><span className="text-gray-500">Day:</span> <span className="font-medium">{days[selectedEvent.day]}</span></div>
              <div><span className="text-gray-500">Time:</span> <span className="font-medium">{minutesToHHMM(selectedEvent.start)} - {minutesToHHMM(selectedEvent.end)}</span></div>
              {selectedEvent.conflict && (
                <div className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-red-100 text-red-800">Conflict</div>
              )}
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  const diff = Math.max(5, selectedEvent.end - selectedEvent.start)
                  const presets = [15,30,45,60,90]
                  const usePreset = presets.includes(diff)
                  const startHHMM = minutesToHHMM(selectedEvent.start)
                  const t12 = hhmmToH12(startHHMM)
                  setForm({
                    title: selectedEvent.title,
                    day: selectedEvent.day,
                    start: startHHMM,
                    hour12: t12.hour12,
                    minute: t12.minute,
                    meridiem: t12.meridiem,
                    startText: labelFromHHMM(startHHMM),
                    startInvalid: false,
                    duration: diff,
                    durationMode: usePreset ? 'preset' : 'custom',
                    customHours: Math.floor(diff/60),
                    customMinutes: diff % 60,
                  })
                  setIsEditing(true)
                  setEditId(selectedEvent.id)
                  setShowDetails(false)
                  setShowModal(true)
                }}
                className="rounded-full px-4 py-1.5 text-sm border border-gray-300 text-gray-700"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => {
                  setEvents((arr) => arr.filter(ev => ev.id !== selectedEvent.id))
                  setShowDetails(false)
                  setSelectedEvent(null)
                }}
                className="rounded-full px-4 py-1.5 text-sm bg-black text-white"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Dashboard />
  </React.StrictMode>
)
