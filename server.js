const express = require('express');
const cors = require('cors');
const app = express();
const PORT = 3000;


const cache = {};
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

const rateLimit = require('express-rate-limit');

app.use(cors());
  
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20,              // limit each IP to 20 requests per minute
  message: { error: 'Too many requests, please slow down.' }
});

app.use(limiter);

app.get('/weather', async (req, res) => {
  const city = req.query.city;
  const cacheKey = city.toLowerCase();

  if (cache[cacheKey] && Date.now() - cache[cacheKey].timestamp < CACHE_DURATION_MS) {
    console.log(`Cache hit for ${city}`);
    return res.json(cache[cacheKey].data);
  }

  const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${city}`;
  const geoResponse = await fetch(geoUrl);
  const geoData = await geoResponse.json();

  const place = geoData.results[0];
  const lat = place.latitude;
  const lon = place.longitude;

  const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&daily=temperature_2m_max,temperature_2m_min,weathercode&timezone=auto`;
  const weatherResponse = await fetch(weatherUrl);
  const weatherData = await weatherResponse.json();

  const result = {
    name: place.name,
    country: place.country,
    temperature: weatherData.current_weather.temperature,
    weathercode: weatherData.current_weather.weathercode,
    forecast: weatherData.daily.time.map((date, i) => ({
      date,
      max: weatherData.daily.temperature_2m_max[i],
      min: weatherData.daily.temperature_2m_min[i],
      weathercode: weatherData.daily.weathercode[i]
    }))
  };

  cache[cacheKey] = { data: result, timestamp: Date.now() };

  res.json(result);
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});