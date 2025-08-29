export async function getAccessTokenRedirect({ scopes = ['https://www.googleapis.com/auth/calendar.readonly'] } = {}) {
  await ensureGisLoaded()
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
  if (!clientId) throw new Error('Missing VITE_GOOGLE_CLIENT_ID')
  window.google.accounts.oauth2.initCodeClient({
    client_id: clientId,
    scope: scopes.join(' '),
    ux_mode: 'redirect',
    redirect_uri: `${window.location.origin}/auth/callback`, // must match Google Cloud console
  }).requestCode()
}

const GIS_SRC = 'https://accounts.google.com/gsi/client'
let gisLoaded = false
let tokenClient = null
let currentAccessToken = null
let currentTokenExpiresAt = 0
let tokenRequestInFlight = null 

function saveToken(token, expiresInSec) {
  currentAccessToken = token
  const ttl = typeof expiresInSec === 'number' ? expiresInSec : 3600
  currentTokenExpiresAt = Date.now() + (ttl - 60) * 1000
  try {
    sessionStorage.setItem('gcal_token', token)
    sessionStorage.setItem('gcal_token_exp', String(currentTokenExpiresAt))
    localStorage.setItem('gcal_token', token)
    localStorage.setItem('gcal_token_exp', String(currentTokenExpiresAt))
  } catch {}
}

function loadToken() {
  if (currentAccessToken && Date.now() < currentTokenExpiresAt) return currentAccessToken
  try {
    const t = sessionStorage.getItem('gcal_token')
    const exp = Number(sessionStorage.getItem('gcal_token_exp') || '0')
    if (t && exp && Date.now() < exp) {
      currentAccessToken = t
      currentTokenExpiresAt = exp
      return t
    }
    const tl = localStorage.getItem('gcal_token')
    const expl = Number(localStorage.getItem('gcal_token_exp') || '0')
    if (tl && expl && Date.now() < expl) {
      currentAccessToken = tl
      currentTokenExpiresAt = expl
      try {
        sessionStorage.setItem('gcal_token', tl)
        sessionStorage.setItem('gcal_token_exp', String(expl))
      } catch {}
      return tl
    }
  } catch {}
  return null
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = src
    s.async = true
    s.onload = () => resolve()
    s.onerror = (e) => reject(new Error('Failed to load ' + src))
    document.head.appendChild(s)
  })
}

export async function ensureGisLoaded() {
  if (gisLoaded) return
  await loadScript(GIS_SRC)
  gisLoaded = true
}

export async function getAccessToken({ scopes = ['https://www.googleapis.com/auth/calendar.readonly'], prompt } = {}) {
  await ensureGisLoaded()
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
  if (!clientId) throw new Error('Missing VITE_GOOGLE_CLIENT_ID')
  // Mobile: use redirect flow
  if (/Mobi|Android/i.test(navigator.userAgent)) {
    return getAccessTokenRedirect({ scopes })
  }
  // Desktop: use popup flow
  const cached = loadToken()
  if (cached) return cached
  if (tokenRequestInFlight) return tokenRequestInFlight
  if (!tokenClient) {
    tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: scopes.join(' '),
      callback: (resp) => {},
    })
  }
  const tryPrompt = typeof prompt === 'string' ? prompt : ''
  tokenRequestInFlight = (async () => {
    try {
      const token = await new Promise((resolve, reject) => {
        tokenClient.callback = (resp) => {
          if (resp.error) return reject(Object.assign(new Error(resp.error), { code: resp.error }))
          saveToken(resp.access_token, resp.expires_in)
          resolve(resp.access_token)
        }
        tokenClient.requestAccessToken({ prompt: tryPrompt })
      })
      return token
    } catch (err) {
      const code = err && (err.code || err.message || '')
      if (String(code).includes('interaction') || String(code).includes('consent') || String(code).includes('login_required')) {
        const token = await new Promise((resolve, reject) => {
          tokenClient.callback = (resp) => {
            if (resp.error) return reject(new Error(resp.error))
            saveToken(resp.access_token, resp.expires_in)
            resolve(resp.access_token)
          }
          tokenClient.requestAccessToken({ prompt: 'consent' })
        })
        return token
      }
      throw err
    } finally {
      setTimeout(() => { tokenRequestInFlight = null }, 0)
    }
  })()
  return tokenRequestInFlight
}

export function getCachedAccessToken() {
  return currentAccessToken
}

export async function fetchGoogleCalendarEvents({ accessToken, timeMin, timeMax, pageSize = 100 }) {
  if (!accessToken) throw new Error('Missing access token')
  const params = new URLSearchParams({
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: String(pageSize),
  })
  if (timeMin) params.set('timeMin', new Date(timeMin).toISOString())
  if (timeMax) params.set('timeMax', new Date(timeMax).toISOString())
  let url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`
  const out = []
  while (url) {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
    if (!res.ok) throw new Error(`Google API ${res.status}`)
    const data = await res.json()
    if (Array.isArray(data.items)) out.push(...data.items)
    const next = data.nextPageToken
    if (next) {
      const u = new URL(url)
      u.searchParams.set('pageToken', next)
      url = u.toString()
    } else {
      url = null
    }
  }
  return out
}
