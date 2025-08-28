// ...existing code...
import weatherService from './weatherService.js';
import placesService from './placesService.js'; // expanded service (searchPlaces etc.)
import { searchPlaces as fsqSimpleSearch } from '../src/services/placesService.js'; // simple search
import calendarService from './calendarService.js';
import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

class IntelliSpotService {
  constructor() {
    this.apiKeys = {
      foursquare: process.env.FOURSQUARE_API_KEY || process.env.FSQ_API_KEY || process.env.FOURSQUARE_PLACES_KEY,
      weather: process.env.WEATHER_API_KEY,
  mapbox: process.env.MAPBOX_KEY
    };
  }

  async getCalendarEvents(userId, accessToken) {
    // Prefer provided OAuth access token; fallback to internal service if available
    if (accessToken) {
      try {
        const url = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';
        const { data } = await axios.get(url, { headers: { Authorization: `Bearer ${accessToken}` } });
        return data.items || [];
      } catch (e) {
        console.warn('Direct Google Calendar fetch failed:', e.response?.status, e.response?.data || e.message);
      }
    }
    if (calendarService.listEvents) {
      try { return await calendarService.listEvents({ userId }); } catch { /* ignore */ }
    }
    return [];
  }

  detectFreeTimeSlots(events) {
    const now = new Date();
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);
    const busy = (events || [])
      .filter(e => e.start && e.end)
      .map(e => ({
        start: new Date(e.start.dateTime || e.start.date || e.start),
        end: new Date(e.end.dateTime || e.end.date || e.end)
      }))
      .sort((a, b) => a.start - b.start);
    const free = [];
    let cursor = now;
    for (const slot of busy) {
      if (cursor < slot.start) {
        const mins = (slot.start - cursor) / 60000;
        if (mins >= 60) free.push({ start: new Date(cursor), end: new Date(slot.start), duration: Math.floor(mins) });
      }
      if (slot.end > cursor) cursor = slot.end;
    }
    if (cursor < endOfDay) {
      const mins = (endOfDay - cursor) / 60000;
      if (mins >= 60) free.push({ start: new Date(cursor), end: endOfDay, duration: Math.floor(mins) });
    }
    return free;
  }

  async getWeatherForecast(lat, lng, targetTime) {
    try {
      if (weatherService.getOneCall) {
        const data = await weatherService.getOneCall({ lat, lng });
        if (data?.hourly?.length) {
          const ts = Math.floor(targetTime.getTime() / 1000);
          let closest = data.hourly[0];
          let diff = Math.abs(closest.dt - ts);
          for (const h of data.hourly) {
            const d = Math.abs(h.dt - ts);
            if (d < diff) { closest = h; diff = d; }
          }
          return {
            temperature: Math.round(closest.temp),
            condition: closest.weather?.[0]?.main?.toLowerCase() || 'unknown',
            description: closest.weather?.[0]?.description || '',
            humidity: closest.humidity,
            windSpeed: closest.wind_speed
          };
        }
      }
    } catch {}

    const key = this.apiKeys.weather;
    if (!key) return null;
    try {
      const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lng}&appid=${key}&units=metric`;
      const { data } = await axios.get(url);
      if (!data?.list?.length) return null;
      const target = Math.floor(targetTime.getTime() / 1000);
      let closest = data.list[0];
      let diff = Math.abs(closest.dt - target);
      for (const f of data.list) {
        const d = Math.abs(f.dt - target);
        if (d < diff) { closest = f; diff = d; }
      }
      return {
        temperature: Math.round(closest.main.temp),
        condition: closest.weather?.[0]?.main?.toLowerCase() || 'unknown',
        description: closest.weather?.[0]?.description || '',
        humidity: closest.main.humidity,
        windSpeed: closest.wind.speed
      };
    } catch { return null; }
  }

  determineVenueTypes(weather, freeSlot) {
    if (!weather || !freeSlot) return { venueTypes: [], searchQuery: '' };
    const { condition, temperature } = weather;
    const { duration } = freeSlot;
    let venueTypes = [];
    let searchQuery = '';
    if (condition === 'rain' || condition === 'thunderstorm') {
      venueTypes = ['museum','cafe','shopping mall','library','bookstore'];
      searchQuery = 'indoor activities';
    } else if (condition === 'clear' || condition === 'clouds') {
      if (temperature > 25) {
        venueTypes = ['air conditioned cafe','indoor restaurant','shopping center'];
        searchQuery = 'cool indoor places';
      } else if (temperature > 15) {
        venueTypes = ['park','outdoor restaurant','rooftop bar','walking trail'];
        searchQuery = 'outdoor activities';
      } else {
        venueTypes = ['warm cafe','cozy restaurant','indoor market'];
        searchQuery = 'warm indoor places';
      }
    }
    if (duration < 90) {
      venueTypes = venueTypes.filter(t => ['cafe','coffee','quick'].some(k => t.toLowerCase().includes(k)));
    } else if (duration > 180) {
      venueTypes.push('shopping center','entertainment complex','spa');
    }
    return { venueTypes, searchQuery };
  }

  async getVenueRecommendations(lat, lng, weather, freeSlot) {
    const { searchQuery } = this.determineVenueTypes(weather, freeSlot);
    const query = searchQuery || 'coffee';
    try {
      if (placesService.searchPlaces) {
        const results = await placesService.searchPlaces(query, { ll: `${lat},${lng}`, limit: 15 });
        return this.enhanceVenues(results, weather, lat, lng);
      }
    } catch {}
    try {
      const raw = await fsqSimpleSearch(query, `${lat},${lng}`);
      return this.enhanceVenues(raw, weather, lat, lng);
    } catch { return []; }
  }

  enhanceVenues(venues = [], weather, lat, lng) {
    return (venues || []).map((v, i) => {
      const geocode = v.geocodes?.main || v.geocode || {};
      const distance = this.calculateDistance(lat, lng, geocode.latitude, geocode.longitude);
      return {
        ...v,
        weatherScore: this.calculateWeatherScore(v, weather),
        distanceFromUser: distance,
        rank: i + 1
      };
    }).sort((a, b) => b.weatherScore - a.weatherScore);
  }

  calculateWeatherScore(venue, weather) {
    if (!weather) return 50;
    let score = 70;
    const cats = (venue.categories || []).map(c => c.name?.toLowerCase());
    const { condition, temperature } = weather;
    if (condition === 'rain' && cats.some(n => ['museum','shopping','cafe','indoor'].some(k => n.includes(k)))) score += 30;
    if (condition === 'clear' && cats.some(n => ['park','outdoor','rooftop','garden'].some(k => n.includes(k)))) score += 25;
    if (temperature > 25 && cats.some(n => n.includes('air conditioned'))) score += 20;
    return score;
  }

  generateMapURL(venues, centerLat, centerLon) {
    if (!this.apiKeys.mapbox) return null;
    const markers = (venues || []).slice(0,5).map((v,i) => {
      const g = v.geocodes?.main || v.geocode || {};
      const color = i === 0 ? 'f74e4e' : '3fb1ce';
      return `pin-s-${i+1}+${color}(${g.longitude},${g.latitude})`;
    }).join(',');
    return `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/${markers}/${centerLon},${centerLat},13/800x600@2x?access_token=${this.apiKeys.mapbox}`;
  }

  getWeatherContext(w) {
    if (!w) return '';
    const t = w.temperature; const c = w.condition;
    if (c === 'rain') return `It's raining (${t}°C) - perfect for cozy indoor activities!`;
    if (c === 'clear' && t > 20) return `Beautiful sunny weather (${t}°C) - great for outdoor experiences!`;
    if (t < 10) return `It's quite cold (${t}°C) - time for warm, comfortable places!`;
    return `Pleasant ${t}°C weather with ${w.description}.`;
  }
  getTimeContext(slot) {
    if (!slot) return '';
    const d = slot.duration; const h = slot.start.getHours();
    let msg = `You have ${d} minutes free starting at ${slot.start.toLocaleTimeString()}.`;
    if (h>=11 && h<=14) msg += ' Perfect lunch time!';
    else if (h>=15 && h<=17) msg += ' Great for an afternoon break!';
    else if (h>=18) msg += ' Evening relaxation time!';
    return msg;
  }
  getWeatherAdvice(w) {
    if (!w) return '';
    if (w.condition === 'rain') return 'Bring an umbrella and enjoy indoor activities!';
    if (w.temperature > 25) return 'Stay cool and hydrated - perfect for air-conditioned venues!';
    if (w.condition === 'clear') return 'Great weather for exploring outdoor spots!';
    return 'Dress appropriately for the weather!';
  }
  getTimeAdvice(slot) {
    if (!slot) return '';
    if (slot.duration < 90) return 'Perfect time for a quick coffee or snack!';
    if (slot.duration > 180) return 'You have plenty of time - consider trying something new!';
    return 'Great duration for a relaxing activity!';
  }
  calculateDistance(lat1, lon1, lat2, lon2) {
    if ([lat1, lon1, lat2, lon2].some(v => typeof v !== 'number' || Number.isNaN(v))) return null;
    const R = 6371; const dLat = (lat2-lat1)*Math.PI/180; const dLon = (lon2-lon1)*Math.PI/180;
    const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  }

  async generateSmartRecommendations({ lat, lng, userId, calendarAccessToken }) {
    try {
      const events = await this.getCalendarEvents(userId, calendarAccessToken);
      const free = this.detectFreeTimeSlots(events);
      if (!free.length) return { message: "No free time slots today.", recommendations: [] };
      const nextSlot = free[0];
      const weather = await this.getWeatherForecast(lat, lng, nextSlot.start);
      if (!weather) return { message: 'Weather unavailable right now.', recommendations: [] };
      const venues = await this.getVenueRecommendations(lat, lng, weather, nextSlot);
      const mapURL = this.generateMapURL(venues, lat, lng);
      const message = `${this.getTimeContext(nextSlot)} ${this.getWeatherContext(weather)} Here are perfect spots for you:`;
      return {
        message,
        freeTime: { start: nextSlot.start, duration: nextSlot.duration },
        weather,
        recommendations: venues.slice(0,5),
        mapURL,
        context: { weatherAdvice: this.getWeatherAdvice(weather), timeAdvice: this.getTimeAdvice(nextSlot) }
      };
    } catch (e) {
      console.error('IntelliSpot error:', e.message);
      return { message: 'Recommendation engine error.', recommendations: [] };
    }
  }
}

const intelliSpotService = new IntelliSpotService();
export default intelliSpotService;
