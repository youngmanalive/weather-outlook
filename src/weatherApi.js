import { toPlace } from './places'

const FORECAST_HOURS = [
  'temperature_2m',
  'apparent_temperature',
  'precipitation_probability',
  'precipitation',
  'weather_code',
  'cloud_cover',
  'relative_humidity_2m',
  'dew_point_2m',
  'wind_speed_10m',
  'wind_gusts_10m',
]

export async function fetchForecast(place) {
  const params = new URLSearchParams({
    latitude: place.latitude,
    longitude: place.longitude,
    hourly: FORECAST_HOURS.join(','),
    daily:
      'temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,precipitation_sum,precipitation_hours,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max,weather_code',
    temperature_unit: 'fahrenheit',
    wind_speed_unit: 'mph',
    precipitation_unit: 'inch',
    timezone: place.timezone || 'auto',
    forecast_days: '4',
  })

  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`)
  if (!response.ok) {
    throw new Error('Forecast unavailable')
  }

  return response.json()
}

export async function searchPlaces(query) {
  const params = new URLSearchParams({
    name: query,
    count: '5',
    language: 'en',
    format: 'json',
  })
  const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${params}`)
  if (!response.ok) {
    throw new Error('Location search failed')
  }

  const data = await response.json()
  return (data.results || []).map(toPlace)
}
