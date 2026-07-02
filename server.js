const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;

const cache = {};
const CACHE_DURATION_MS = 5 * 60 * 1000;

app.use(cors());

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { error: 'Too many requests, please slow down.' }
});

app.use(limiter);

app.get('/weather', async (req, res) => {
  const city = req.query.city;

  if (!city) {
    return res.status(400).json({ error: 'No city provided.' });
  }

  const cacheKey = city.toLowerCase();

  if (cache[cacheKey] && Date.now() - cache[cacheKey].timestamp < CACHE_DURATION_MS) {
    console.log(`Cache hit for ${city}`);
    return res.json(cache[cacheKey].data);
  }

  try {
    const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${city}`;
    const geoResponse = await fetch(geoUrl);
    const geoData = await geoResponse.json();

    console.log('Geo API response:', JSON.stringify(geoData).slice(0, 200));

    if (!geoData.results || geoData.results.length === 0) {
      return res.status(404).json({ error: `Couldn't find a city called "${city}"` });
    }

    const place = geoData.results[0];
    const lat = place.latitude;
    const lon = place.longitude;

    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&daily=temperature_2m_max,temperature_2m_min,weathercode&timezone=auto`;
    const weatherResponse = await fetch(weatherUrl);
    const weatherData = await weatherResponse.json();

    console.log('Weather API response:', JSON.stringify(weatherData).slice(0, 200));

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

  } catch (error) {
    console.error('Server error:', error.message);
    res.status(500).json({ error: 'Something went wrong on the server.' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});