import { getCalendarEvents } from "./googleCalendar.js";
import { getWeather } from "./weather.js";
import { getUserLocation } from "./location.js";
import { getUserPreferences } from "./preferences.js";


export async function processContext(req, userId) {
  const location = await getUserLocation(req);
  const weather = await getWeather(location.lat, location.lon);
  const events = await getCalendarEvents(req.user); // next 5 upcoming events
  const preferences = await getUserPreferences(userId);

  const processed = {
    timestamp: new Date(),
    location: {
      lat: location.lat,
      lon: location.lon,
      description: `Lat: ${location.lat}, Lon: ${location.lon}`,
    },
    weather: {
      condition: weather.condition,
      temp: weather.temp,
      isRainy: weather.condition.toLowerCase().includes("rain"),
      isCold: weather.temp < 18,
      isHot: weather.temp > 30,
    },
    nextEvent: events.length > 0 ? events[0] : null,
    freeSlots: events
      .map((e, i, arr) => {
        if (i === arr.length - 1) return null;
        return {
          start: arr[i].end,
          end: arr[i + 1].start,
        };
      })
      .filter(Boolean),
    preferences,
  };

  processed.suggestQuiet = processed.nextEvent
    ? processed.nextEvent.title.toLowerCase().includes("call") ||
      processed.nextEvent.title.toLowerCase().includes("meeting")
    : false;

  processed.suggestOutdoor = !processed.weather.isRainy && processed.weather.temp < 30;

  return processed;
}
