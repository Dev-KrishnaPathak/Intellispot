import React from 'react'
import { Link } from 'react-router-dom'
import { Routes, Route } from 'react-router-dom'
import { Dashboard } from './dashboard'
import Demo from './demo'
import Pricing from './pricing'
import { DotLottieReact } from '@lottiefiles/dotlottie-react'
import ReactGlobe from 'react-globe.gl'
import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'

function Brand() {
  return (
    <Link to="/" className="flex items-center focus:outline-none">
      <span className="text-xl md:text-2xl font-semibold tracking-tight">IntelliSpot</span>
    </Link>
  )
}

function Navbar() {
  return (
  <header className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between relative">
      <Brand />
      <nav className="hidden md:flex items-center gap-3 absolute left-1/2 -translate-x-1/2">
        <a
          className="inline-flex items-center rounded-full bg-gray-100 border border-gray-200 px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-200 transition"
          href="#features"
          onClick={(e) => {
            e.preventDefault()
            const el = document.getElementById('features')
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }}
        >
          Features
        </a>
  <a className="inline-flex items-center rounded-full bg-gray-100 border border-gray-200 px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-200 transition" href="/demo">Demo</a>
  <a className="inline-flex items-center rounded-full bg-gray-100 border border-gray-200 px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-200 transition" href="/pricing">Pricing</a>
      </nav>
      <div className="flex items-center gap-3">
  <a className="inline-flex items-center rounded-full bg-black text-white px-4 py-2 text-sm hover:opacity-90 transition" href="/dashboard">Get Started</a>
      </div>
    </header>
  )
}

function Hero() {
  return (
  <section className="max-w-6xl mx-auto px-6 min-h-[calc(100vh-96px)] flex flex-col items-center justify-center text-center">
      
  <h1 className="mt-[50px] md:mt-[50px] text-[40px] font-bold tracking-tight leading-[1.05] max-w-3xl mx-auto">
        Minimal. Smart. Effortless.
      </h1>
     <p className="text-gray-400 font-bold mt-1 text-[40px] leading-[1.05] max-w-4xl mx-auto">Your schedule, beautifully clear.</p>
  <div className="mt-10 flex justify-center">
  <a className="inline-flex items-center rounded-full bg-black text-white px-5 py-2.5 text-sm font-semibold hover:opacity-90 transition shadow-sm" href="/dashboard">Try Now</a>
      </div>
  <div className="mt-10 max-w-4xl w-full mx-auto">
        <div className="rounded-2xl bg-gray-100 h-[500px] w-full overflow-hidden">
          <GlobeHero />
        </div>
      </div>
    </section>
  )
}

function GlobeHero() {
  const globeEl = useRef(null)
  const wrapRef = useRef(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const [marker, setMarker] = useState(null)
  const [autoRotate, setAutoRotate] = useState(true)
  const [countries, setCountries] = useState([])
  const [textureUrl, setTextureUrl] = useState('https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg')
  const [bumpUrl, setBumpUrl] = useState('https://unpkg.com/three-globe/example/img/earth-topology.png')
  const [selectedNightUrl, setSelectedNightUrl] = useState('https://unpkg.com/three-globe/example/img/earth-night.jpg')
  const [selectedDayUrl, setSelectedDayUrl] = useState('https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg')
  const [maxTextureSize, setMaxTextureSize] = useState(null)
  const [didCountryZoom, setDidCountryZoom] = useState(false)
  const CUSTOM_TEXTURE_URL = 'https://eoimages.gsfc.nasa.gov/images/imagerecords/79000/79765/earth_lights_lrg.jpg'

  const getMinAltitude = (url) => {
  if (!url) return 0.025
  if (url.includes('earth_lights_lrg')) return 0.026
  if (url.includes('5400x2700') || url.includes('3x5400x2700')) return 0.024
  if (url.includes('8k')) return 0.02
  if (url.includes('4k')) return 0.025
  if (url.includes('2k')) return 0.035
  return 0.04
  }

  const normalizeLng = (lng) => {
    let x = lng
    while (x > 180) x -= 360
    while (x < -180) x += 360
    return x
  }
  const pointInRing = (lng, lat, ring) => {
    let inside = false
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const xi = ring[i][0], yi = ring[i][1]
      const xj = ring[j][0], yj = ring[j][1]
      const intersect = ((yi > lat) !== (yj > lat)) && (lng < (xj - xi) * (lat - yi) / (yj - yi + 1e-12) + xi)
      if (intersect) inside = !inside
    }
    return inside
  }
  const featureCoords = (feature) => {
    const g = feature?.geometry
    if (!g) return []
    if (g.type === 'Polygon') return g.coordinates
    if (g.type === 'MultiPolygon') return g.coordinates.flat()
    return []
  }
  const pointInFeature = (lng, lat, feature) => {
    const polys = featureCoords(feature)
    for (const ring of polys) {
      if (pointInRing(lng, lat, ring)) return true
    }
    return false
  }
  const getFeatureForPoint = (features, lng, lat) => {
    for (const f of features) {
      const polys = featureCoords(f)
      let minLng = 180, maxLng = -180, minLat = 90, maxLat = -90
      for (const ring of polys) {
        for (const p of ring) {
          const Lng = normalizeLng(p[0])
          const Lat = p[1]
          if (Lng < minLng) minLng = Lng
          if (Lng > maxLng) maxLng = Lng
          if (Lat < minLat) minLat = Lat
          if (Lat > maxLat) maxLat = Lat
        }
      }
      if (lng >= minLng && lng <= maxLng && lat >= minLat && lat <= maxLat) {
        if (pointInFeature(lng, lat, f)) return f
      }
    }
    return null
  }
  const getFeatureBoundsAndCenter = (feature) => {
    const polys = featureCoords(feature)
    let minLng = 180, maxLng = -180, minLat = 90, maxLat = -90
    let sumLng = 0, sumLat = 0, count = 0
    for (const ring of polys) {
      for (const p of ring) {
        const Lng = normalizeLng(p[0])
        const Lat = p[1]
        if (Lng < minLng) minLng = Lng
        if (Lng > maxLng) maxLng = Lng
        if (Lat < minLat) minLat = Lat
        if (Lat > maxLat) maxLat = Lat
        sumLng += Lng; sumLat += Lat; count++
      }
    }
    const center = { lng: count ? sumLng / count : 0, lat: count ? sumLat / count : 0 }
    const spanLng = Math.abs(maxLng - minLng)
    const spanLat = Math.abs(maxLat - minLat)
    const span = Math.max(spanLng, spanLat)
    return { center, span }
  }
  const spanToAltitude = (degSpan) => {
    const s = Math.max(5, Math.min(80, degSpan))
    const t = (s - 5) / (80 - 5)
    return 0.45 + t * (1.9 - 0.45)
  }

  useEffect(() => {
    if (globeEl.current) {
      const controls = globeEl.current.controls()
      controls.autoRotate = autoRotate
      controls.autoRotateSpeed = 0.6
  controls.enableDamping = true
  controls.dampingFactor = 0.06
    }
  }, [autoRotate])

  useEffect(() => {
    if (!wrapRef.current) return
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const cr = entry.contentRect
        setSize({ width: Math.floor(cr.width), height: Math.floor(cr.height) })
      }
    })
    ro.observe(wrapRef.current)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    if (!globeEl.current) return
    const renderer = globeEl.current.renderer?.()
    if (renderer && size.width && size.height) {
      renderer.setSize(size.width, size.height, false)
      const dpr = Math.min(window.devicePixelRatio || 1, 4)
      renderer.setPixelRatio(dpr)
    }
  }, [size.width, size.height])

  useEffect(() => {
    if (!('geolocation' in navigator)) return
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords
        setMarker({ lat: latitude, lng: longitude })
        if (globeEl.current) {
          globeEl.current.pointOfView({ lat: latitude, lng: longitude, altitude: 1.1 }, 1200)
          setAutoRotate(false)
          const renderer = globeEl.current.renderer?.()
          if (renderer) {
            const dpr = Math.min(window.devicePixelRatio || 1, 4)
            renderer.setPixelRatio(dpr)
          }
        }
      },
      () => {
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    )
  }, [])

  useEffect(() => {
    if (!globeEl.current || !marker || !countries?.length) return
    try {
      const lng = normalizeLng(marker.lng)
      const lat = marker.lat
      const feature = getFeatureForPoint(countries, lng, lat)
      if (feature) {
        const { center, span } = getFeatureBoundsAndCenter(feature)
        const paddedSpan = span * 1.2
        const altitude = spanToAltitude(paddedSpan)
        globeEl.current.pointOfView({ lat: center.lat, lng: center.lng, altitude }, 1600)
  setAutoRotate(false)
        setDidCountryZoom(true)
      } else {
  const fallbackAlt = 1.1
        globeEl.current.pointOfView({ lat, lng, altitude: fallbackAlt }, 1600)
  setAutoRotate(false)
        setDidCountryZoom(true)
      }
    } catch {}
  }, [marker, countries])

  useEffect(() => {
    if (!globeEl.current || !marker) return
    if (didCountryZoom) return
    const t = setTimeout(() => {
      if (!didCountryZoom && globeEl.current) {
  globeEl.current.pointOfView({ lat: marker.lat, lng: marker.lng, altitude: 1.0 }, 1200)
  setAutoRotate(false)
      }
    }, 2000)
    return () => clearTimeout(t)
  }, [marker, didCountryZoom])

  useEffect(() => {
    fetch('https://unpkg.com/three-globe/example/datasets/ne_110m_admin_0_countries.geojson')
      .then((res) => res.json())
      .then((geo) => setCountries(geo.features || []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    const DAY_CANDIDATES = [
      { size: 8192, url: 'https://unpkg.com/planet-textures@3.0.2/8k_earth_daymap.jpg' },
      { size: 4096, url: 'https://unpkg.com/planet-textures@3.0.2/4k_earth_daymap.jpg' },
      { size: 2048, url: 'https://unpkg.com/planet-textures@3.0.2/2k_earth_daymap.jpg' },
      { size: 2048, url: 'https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg' }
    ]
    const NIGHT_CANDIDATES = [
      { size: 8192, url: 'https://unpkg.com/planet-textures@3.0.2/8k_earth_nightmap.jpg' },
      { size: 4096, url: 'https://unpkg.com/planet-textures@3.0.2/4k_earth_nightmap.jpg' },
      { size: 2048, url: 'https://unpkg.com/planet-textures@3.0.2/2k_earth_nightmap.jpg' },
      { size: 2048, url: 'https://unpkg.com/three-globe/example/img/earth-night.jpg' }
    ]
    const BUMP_CANDIDATES = [
      { size: 8192, url: 'https://unpkg.com/planet-textures@3.0.2/8k_earth_normal_map.jpg' },
      { size: 4096, url: 'https://unpkg.com/planet-textures@3.0.2/4k_earth_normal_map.jpg' },
      { size: 2048, url: 'https://unpkg.com/planet-textures@3.0.2/2k_earth_normal_map.jpg' },
      { size: 2048, url: 'https://unpkg.com/three-globe/example/img/earth-topology.png' }
    ]

    const testImage = (url) => new Promise((resolve, reject) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => resolve(url)
      img.onerror = () => reject(url)
      img.src = url
    })

    const filterByMax = (cands) => {
      if (!maxTextureSize) return cands
      return cands.filter(c => c.size <= maxTextureSize)
    }

    const pickFirst = async (arr) => {
      for (const url of arr) {
        try { return await testImage(url) } catch {}
      }
      return arr[arr.length - 1]
    }

    (async () => {
      const bumpArr = filterByMax(BUMP_CANDIDATES).map(c => c.url)
      const bump = await pickFirst(bumpArr)
      setBumpUrl(bump)

      if (CUSTOM_TEXTURE_URL) {
        setSelectedDayUrl(CUSTOM_TEXTURE_URL)
        setSelectedNightUrl(null)
        setTextureUrl(CUSTOM_TEXTURE_URL)
        return
      }

      const dayArr = filterByMax(DAY_CANDIDATES).map(c => c.url)
      const nightArr = filterByMax(NIGHT_CANDIDATES).map(c => c.url)
      const day = await pickFirst(dayArr)
      const night = await pickFirst(nightArr)
      setSelectedDayUrl(day)
      setSelectedNightUrl(night)
      const setByTime = () => {
        const hr = new Date().getHours()
        setTextureUrl(hr >= 19 || hr < 6 ? night : day)
      }
      setByTime()
      const t = setInterval(setByTime, 60 * 60 * 1000)
      return () => clearInterval(t)
    })()
  }, [maxTextureSize])

  useEffect(() => {
    // When in night mode, add faint emissive city lights; clear in day mode
    if (!globeEl.current) return
    const mat = globeEl.current.globeMaterial?.()
    if (!mat) return
    const applySampling = () => {
      try {
        const renderer = globeEl.current?.renderer?.()
        const aniso = renderer?.capabilities?.getMaxAnisotropy ? renderer.capabilities.getMaxAnisotropy() : 1
        ;[mat.map, mat.bumpMap].forEach(tex => {
          if (tex) {
            tex.anisotropy = aniso || 1
            tex.minFilter = THREE.LinearMipmapLinearFilter
            tex.magFilter = THREE.LinearFilter
            tex.generateMipmaps = true
            tex.needsUpdate = true
          }
        })
        mat.needsUpdate = true
      } catch {}
    }
  if (selectedNightUrl && textureUrl === selectedNightUrl) {
      const loader = new THREE.TextureLoader()
      loader.setCrossOrigin('anonymous')
      loader.load(selectedNightUrl, (tex) => {
        mat.emissive = new THREE.Color(0x111111)
  const renderer = globeEl.current?.renderer?.()
  const aniso = renderer?.capabilities?.getMaxAnisotropy ? renderer.capabilities.getMaxAnisotropy() : 1
  tex.anisotropy = aniso || 1
  tex.minFilter = THREE.LinearMipmapLinearFilter
  tex.magFilter = THREE.LinearFilter
  tex.generateMipmaps = true
  mat.emissiveMap = tex
        mat.needsUpdate = true
        applySampling()
      })
    } else {
      mat.emissiveMap = null
      mat.emissive = new THREE.Color(0x000000)
      mat.needsUpdate = true
      applySampling()
    }
  }, [textureUrl, selectedNightUrl])

  // Pulsing marker via HTML element overlay
  const markers = marker ? [marker] : []

  return (
  <div ref={wrapRef} className="w-full h-full">
      <ReactGlobe
        ref={globeEl}
  globeImageUrl={textureUrl}
  bumpImageUrl={bumpUrl}
        backgroundImageUrl="https://unpkg.com/three-globe/example/img/night-sky.png"
  backgroundColor="#000011"
  showAtmosphere={true}
        atmosphereColor="#88c9ff"
        atmosphereAltitude={0.18}
  rendererConfig={{ antialias: true, alpha: true, powerPreference: 'high-performance', logarithmicDepthBuffer: true }}
        width={size.width}
        height={size.height}
  // graticules removed for a cleaner look
  polygonsData={countries}
  polygonCapColor={() => 'rgba(0,0,0,0)'}
  polygonSideColor={() => 'rgba(0,0,0,0)'}
  polygonStrokeColor={() => 'rgba(255,255,255,0.25)'}
  polygonAltitude={0.003}
  polygonsTransitionDuration={0}
        htmlElementsData={markers}
        htmlElement={(d) => {
          const el = document.createElement('div')
          el.style.width = '14px'
          el.style.height = '14px'
          el.style.borderRadius = '9999px'
          el.style.background = '#22c55e'
          el.style.boxShadow = '0 0 0 0 rgba(34,197,94,0.7)'
          el.style.transform = 'translate(-50%, -50%)'
          el.style.animation = 'pulse 2s infinite'
          el.style.border = '2px solid white'
          return el
        }}
        onGlobeReady={() => {
          if (globeEl.current) {
            globeEl.current.pointOfView({ lat: 20, lng: 0, altitude: 1.9 })
            const renderer = globeEl.current.renderer?.()
            if (renderer) {
              const dpr = Math.min(window.devicePixelRatio || 1, 4)
              renderer.setPixelRatio(dpr)
              try {
                const maxTex = renderer.capabilities?.maxTextureSize
                if (maxTex) setMaxTextureSize(maxTex)
              } catch {}
              try {
                const mat = globeEl.current.globeMaterial?.()
                if (mat) {
                  mat.bumpScale = 0.08
                }
                const aniso = renderer.capabilities.getMaxAnisotropy ? renderer.capabilities.getMaxAnisotropy() : 1
                if (mat && aniso > 1) {
                  ;[mat.map, mat.bumpMap, mat.emissiveMap].forEach(tex => {
                    if (tex) {
                      tex.anisotropy = aniso
                      tex.minFilter = THREE.LinearMipmapLinearFilter
                      tex.magFilter = THREE.LinearFilter
                      tex.generateMipmaps = true
                      tex.needsUpdate = true
                    }
                  })
                  mat.needsUpdate = true
                }
              } catch {}
            }
          }
        }}
      />
      <style>{`
        @keyframes pulse {
          0% { box-shadow: 0 0 0 0 rgba(34,197,94,0.7); }
          70% { box-shadow: 0 0 0 12px rgba(34,197,94,0); }
          100% { box-shadow: 0 0 0 0 rgba(34,197,94,0); }
        }
      `}</style>
    </div>
  )
}

function Feature({ title, description, shape, reverse = false }) {
  return (
    <div className="grid md:grid-cols-2 gap-12 items-start md:items-center">
      <div className={`${reverse ? 'order-2 md:order-2' : 'order-2 md:order-1'}`}>
        <h3 className="text-lg md:text-xl font-semibold text-black">{title}</h3>
        <p className="text-gray-500 text-sm leading-6 mt-3 max-w-xs md:max-w-sm">{description}</p>
      </div>
      <div className={`${reverse ? 'order-1 md:order-1' : 'order-1 md:order-2'}`}>
        <div className="rounded-2xl bg-gray-100 h-64 w-full flex items-center justify-center">
          {shape}
        </div>
      </div>
    </div>
  )
}

const SquareInSquare = () => (
  <div className="w-16 h-16 bg-gray-200 flex items-center justify-center">
    <div className="w-10 h-10 bg-white rounded"></div>
  </div>
)
const Circle = () => (
  <div className="w-16 h-16 bg-gray-200 rounded flex items-center justify-center">
    <div className="w-10 h-10 rounded-full bg-white"></div>
  </div>
)
const Triangle = () => (
  <div className="w-16 h-16 bg-gray-200 flex items-center justify-center relative">
    <div className="w-0 h-0 border-l-[14px] border-l-transparent border-r-[14px] border-r-transparent border-b-[24px] border-b-white"></div>
  </div>
)

function Features() {
  return (
  <section id="features" className="max-w-6xl mx-auto px-6 py-16 space-y-24">
      <Feature
        title="Proactive Smart Suggestions"
        description={
          <>
            <span className="font-semibold underline">Stop Searching, Start Discovering</span> - Get perfect venue recommendations automatically based on your calendar, weather, and location without ever opening the app to search.
          </>
        }
        shape={
          <DotLottieReact
            src="https://lottie.host/ac62223f-cc96-4e2f-91f3-194fe1c79c98/VSDpAHphLu.lottie"
            loop
            autoplay
            style={{ width: '100%', height: '100%' }}
          />
        }
        reverse={false}
      />
      <Feature
        title="Context-Aware Intelligence"
          description={
            <>
              <span className="font-semibold underline">Stop Searching, Start Discovering.</span> Knows What You Need Before You Do - Suggests quiet coffee shops before work calls, weather-appropriate restaurants, and entertainment that matches your free time and mood.
            </>
          }
        shape={
          <DotLottieReact
            src="https://lottie.host/e1f4465f-f9fa-4ef8-adf5-3bc491fd589a/w1VYkn2APc.lottie"
            loop
            autoplay
            style={{ width: '100%', height: '100%' }}
          />
        }
        reverse
      />
      <Feature
        title="Learns Your Preferences"
        description={
          <>
            <span className="font-semibold underline">Gets Smarter Every Day</span> - AI learns from your choices and feedback to deliver increasingly personalized recommendations that match your taste, dietary needs, and lifestyle.
          </>
        }
        shape={
          <DotLottieReact
            src="https://lottie.host/d1401b01-8417-4fe3-a91d-de275556a3af/rzssPoVrLY.lottie"
            loop
            autoplay
            style={{ width: '100%', height: '100%' }}
          />
        }
        reverse={false}
      />

      <Feature
        title="Real-Time Adaptation"
        description={
          <>
            <span className="font-semibold underline">Perfect Timing, Every Time</span> - Recommendations update instantly as your schedule changes, weather shifts, or you move to different locations throughout the day.
          </>
        }
        shape={
          <DotLottieReact
            src="https://lottie.host/71d7fdaf-839b-4975-b195-6b8d6191732b/fru3SUnrAj.lottie"
            loop
            autoplay
            style={{ width: '100%', height: '100%' }}
          />
        }
        reverse
      />

      <Feature
        title="80% Less Decision Time"
        description={
          <>
            <span className="font-semibold underline">From Idea to Action in Seconds</span> - Eliminate decision fatigue and save hours weekly with instant, contextually perfect venue suggestions that match your current situation.
          </>
        }
        shape={
          <DotLottieReact
            src="https://lottie.host/a47c1a80-0dd3-4685-bbe4-0a7a2be64039/MCWf1c9LCN.lottie"
            loop
            autoplay
            style={{ width: '100%', height: '100%' }}
          />
        }
        reverse={false}
      />
    </section>
  )
}

function CTA() {
  return (
  <section className="max-w-6xl mx-auto px-6 text-center py-20">
      <h2 className="text-2xl md:text-3xl font-medium">Start scheduling smarter.</h2>
      <p className="text-gray-600 mt-3">Free today, upgrade later.</p>
      <div className="mt-6">
    <a className="inline-flex items-center rounded-full bg-black text-white px-4 py-2 text-sm hover:opacity-90 transition" href="#">Get Started</a>
      </div>
    </section>
  )
}

function Footer() {
  return (
  <footer className="max-w-6xl mx-auto px-6 py-10 border-t border-gray-200">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-sm text-gray-600">
        <div>
          <div className="text-gray-800 font-medium mb-3">Contact</div>
          <ul className="space-y-2">
            <li><a className="hover:text-black" href="#">Email</a></li>
            <li><a className="hover:text-black" href="#">Chat</a></li>
          </ul>
        </div>
        <div>
          <div className="text-gray-800 font-medium mb-3">Support</div>
          <ul className="space-y-2">
            <li><a className="hover:text-black" href="#">Status</a></li>
            <li><a className="hover:text-black" href="#">Docs</a></li>
          </ul>
        </div>
        <div>
          <div className="text-gray-800 font-medium mb-3">Company</div>
          <ul className="space-y-2">
            <li><a className="hover:text-black" href="#">About</a></li>
            <li><a className="hover:text-black" href="#">Careers</a></li>
          </ul>
        </div>
        <div>
          <div className="text-gray-800 font-medium mb-3">Resources</div>
          <ul className="space-y-2">
            <li><a className="hover:text-black" href="#">Blog</a></li>
            <li><a className="hover:text-black" href="#">Changelog</a></li>
          </ul>
        </div>
      </div>
  <div className="text-xs text-gray-500 mt-10">© Intellispot.</div>
    </footer>
  )
}

export default function App() {
  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/" element={
          <>
            <Hero />
            <Features />
            <CTA />
          </>
        } />
        <Route path="/dashboard" element={<Dashboard />} />
  <Route path="/demo" element={<Demo />} />
  <Route path="/pricing" element={<Pricing />} />
      </Routes>
      <Footer />
    </>
  )
}

