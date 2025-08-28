import axios from "axios";

export async function getWeather(lat, lon) {
  const apiKey = process.env.WEATHER_API_KEY;
  const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`;
  const res = await axios.get(url);
  return {
    condition: res.data.weather[0].main,
    temp: res.data.main.temp,
  };
}

