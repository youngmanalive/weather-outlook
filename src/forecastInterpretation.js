const WMO_LABELS = {
  0: 'clear',
  1: 'mostly clear',
  2: 'partly cloudy',
  3: 'overcast',
  45: 'foggy',
  48: 'foggy',
  51: 'light drizzle',
  53: 'drizzle',
  55: 'steady drizzle',
  56: 'freezing drizzle',
  57: 'freezing drizzle',
  61: 'light rain',
  63: 'rain',
  65: 'heavy rain',
  66: 'freezing rain',
  67: 'freezing rain',
  71: 'light snow',
  73: 'snow',
  75: 'heavy snow',
  77: 'snow grains',
  80: 'brief showers',
  81: 'showers',
  82: 'heavy showers',
  85: 'snow showers',
  86: 'heavy snow showers',
  95: 'thunderstorms',
  96: 'thunderstorms',
  99: 'strong thunderstorms',
}

export function buildDays(forecast) {
  if (!forecast?.hourly?.time || !forecast?.daily?.time) {
    return []
  }

  return forecast.daily.time.map((date, index) => {
    const hours = forecast.hourly.time
      .map((time, hourIndex) => ({
        time,
        date: time.slice(0, 10),
        temperature: forecast.hourly.temperature_2m[hourIndex],
        apparentTemperature: forecast.hourly.apparent_temperature[hourIndex],
        precipProbability: forecast.hourly.precipitation_probability[hourIndex] ?? 0,
        precipitation: forecast.hourly.precipitation[hourIndex] ?? 0,
        weatherCode: forecast.hourly.weather_code[hourIndex],
        cloudCover: forecast.hourly.cloud_cover[hourIndex] ?? 0,
        humidity: forecast.hourly.relative_humidity_2m[hourIndex] ?? 0,
        dewPoint: forecast.hourly.dew_point_2m[hourIndex],
        windSpeed: forecast.hourly.wind_speed_10m[hourIndex] ?? 0,
        windGusts: forecast.hourly.wind_gusts_10m[hourIndex] ?? 0,
      }))
      .filter((hour) => hour.date === date)

    return interpretDay({
      date,
      index,
      hours,
      high: forecast.daily.temperature_2m_max[index],
      low: forecast.daily.temperature_2m_min[index],
      apparentHigh: forecast.daily.apparent_temperature_max[index],
      apparentLow: forecast.daily.apparent_temperature_min[index],
      precipTotal: forecast.daily.precipitation_sum[index] ?? 0,
      precipHours: forecast.daily.precipitation_hours[index] ?? 0,
      precipProbabilityMax: forecast.daily.precipitation_probability_max[index] ?? 0,
      windMax: forecast.daily.wind_speed_10m_max[index] ?? 0,
      gustMax: forecast.daily.wind_gusts_10m_max[index] ?? 0,
      weatherCode: forecast.daily.weather_code[index],
    })
  })
}

export function highestImpactDay(days) {
  if (!days.length) {
    return null
  }
  return days.reduce(
    (max, day) => (impactRank(day.impact.level) > impactRank(max.impact.level) ? day : max),
    days[0],
  )
}

export function summarizeThreeDay(days) {
  const featureDay = highestImpactDay(days)
  if (!featureDay || featureDay.impact.level === 'none') {
    return 'Calm stretch ahead.'
  }

  if (featureDay.impact.level === 'high') {
    return `${featureDay.title} is the wettest day.`
  }

  if (featureDay.impact.level === 'medium') {
    return `Plan around ${featureDay.title}.`
  }

  return `${featureDay.title} is the wettest day.`
}

export function summarizeThreeDayDetails(days) {
  const wetDays = days.filter((day) => day.impact.level !== 'none')
  if (wetDays.length === 0) {
    return 'No meaningful rain in sight.'
  }

  return wetDays.map((day) => `${day.title} ${day.rainLine}`).join(' · ')
}

export function summarizeRainDays(days) {
  const wetDays = days.filter((day) => day.impact.level !== 'none')
  if (wetDays.length === 0) {
    return 'Dry stretch'
  }

  return wetDays
    .map((day) => `${shortTitle(day.title)} ${rainTotal(day)}`)
    .join(' · ')
}

function shortTitle(title) {
  if (title === 'Today' || title === 'Tomorrow') {
    return title
  }
  return title.slice(0, 3)
}

function rainTotal(day) {
  if (day.precipTotal < 0.01) {
    return 'trace'
  }
  return `${day.precipTotal.toFixed(2)}"`
}

export function summarizeTempRange(days) {
  const lows = days.map((day) => day.low)
  const highs = days.map((day) => day.high)
  return `${Math.round(Math.min(...lows))}-${Math.round(Math.max(...highs))}°F`
}

export function summarizeWind(days) {
  const gustMax = Math.max(...days.map((day) => day.gustMax))
  const windMax = Math.max(...days.map((day) => day.windMax))
  return gustMax >= 28 ? `${Math.round(gustMax)} mph gusts` : `${Math.round(windMax)} mph`
}

export function summarizeHumidity(days) {
  const humidityValues = days.flatMap((day) => day.hours.map((hour) => hour.humidity)).filter(Number.isFinite)
  const dewPoints = days.flatMap((day) => day.hours.map((hour) => hour.dewPoint)).filter(Number.isFinite)
  if (humidityValues.length === 0) {
    return ''
  }

  const averageHumidity = Math.round(average(humidityValues))
  if (dewPoints.length === 0) {
    return `${averageHumidity}%`
  }

  const maxDewPoint = Math.round(Math.max(...dewPoints))
  if (maxDewPoint >= 70) {
    return `${averageHumidity}% · muggy at times`
  }

  if (maxDewPoint >= 62) {
    return `${averageHumidity}% · humid at times`
  }

  return `${averageHumidity}% · comfortable`
}

export function formatHour(time) {
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric' }).format(new Date(time)).replace(' ', '\u00a0')
}

function interpretDay(day) {
  const daylightHours = day.hours.filter((hour) => {
    const currentHour = new Date(hour.time).getHours()
    return currentHour >= 6 && currentHour <= 22
  })
  const wetHours = daylightHours.filter((hour) => hour.precipitation > 0.005 || hour.precipProbability >= 45)
  const likelyWetHours = daylightHours.filter((hour) => hour.precipitation > 0.01 || hour.precipProbability >= 60)
  const peakRain = daylightHours.reduce((peak, hour) => (hour.precipProbability > peak.precipProbability ? hour : peak), daylightHours[0])
  const mainCondition = WMO_LABELS[day.weatherCode] || 'mixed conditions'
  const impact = getImpact(day, wetHours, likelyWetHours)
  const timing = getTiming(wetHours)
  const temperatureNote = getTemperatureNote(day)
  const rainLine = getRainLine(day, wetHours, peakRain)
  const windLine = day.gustMax >= 28 ? `${Math.round(day.gustMax)} mph gusts` : `${Math.round(day.windMax)} mph`
  const humidityLine = getHumidityLine(daylightHours)
  const confidence = getConfidence(day, wetHours)

  return {
    ...day,
    title: getTitle(day.date, day.index),
    headline: getHeadline(day, mainCondition, impact),
    summary: getSummary(day, impact, timing, temperatureNote),
    rainLine,
    windLine,
    humidityLine,
    impact,
    confidence,
    reason: getReason(day, wetHours, peakRain),
  }
}

function getImpact(day, wetHours, likelyWetHours) {
  if (
    day.precipTotal >= 0.6 ||
    (day.precipTotal >= 0.35 && likelyWetHours.length >= 5) ||
    day.gustMax >= 35
  ) {
    return { level: 'high', label: 'Likely disruptive' }
  }

  if (
    day.precipTotal >= 0.12 ||
    likelyWetHours.length >= 3 ||
    (day.precipProbabilityMax >= 75 && wetHours.length >= 2)
  ) {
    return { level: 'medium', label: 'Timing matters' }
  }

  if (day.precipTotal >= 0.02 || wetHours.length > 0 || day.precipProbabilityMax >= 40) {
    return { level: 'low', label: 'Low impact' }
  }

  return { level: 'none', label: 'Easy day' }
}

const NONE_HEADLINES = [
  (mc) => `Easy day. Mostly ${mc}.`,
  (mc) => `Calm day. Mostly ${mc}.`,
  (mc) => `Quiet day. Mostly ${mc}.`,
]

const LOW_HEADLINES = [
  () => `Light rain possible.`,
  () => `Brief showers at most.`,
  () => `A hint of rain — mostly fine.`,
]

const MEDIUM_HEADLINES = [
  () => `Plan around the wet window.`,
  () => `Rain timing matters.`,
  () => `Wet stretch likely.`,
]

const HIGH_HEADLINES = [
  () => `Wet day. Plan around it.`,
  () => `Rain will be hard to avoid.`,
  () => `Disruptive rain or wind likely.`,
]

function getHeadline(day, mainCondition, impact) {
  const seed = `${day.date}|${mainCondition}`
  const condition = isRainyCondition(mainCondition) ? 'overcast' : mainCondition

  if (impact.level === 'none') {
    return pickDeterministic(seed, NONE_HEADLINES)(condition)
  }

  if (impact.level === 'low') {
    return pickDeterministic(seed, LOW_HEADLINES)()
  }

  if (impact.level === 'medium') {
    return pickDeterministic(seed, MEDIUM_HEADLINES)()
  }

  return pickDeterministic(seed, HIGH_HEADLINES)()
}

function isRainyCondition(label) {
  return /rain|drizzle|shower|thunder|snow/.test(label)
}

/** Stable index from a string — same seed always picks the same option (no Math.random). */
function pickDeterministic(seed, options) {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return options[Math.abs(h) % options.length]
}

function getSummary(day, impact, timing, temperatureNote) {
  const amount = day.precipTotal < 0.01 ? 'a trace' : `${day.precipTotal.toFixed(2)}"`

  if (impact.level === 'none') {
    return temperatureNote
  }

  if (impact.level === 'low') {
    return `${temperatureNote} Brief shower window ${timing}, ~${amount}.`
  }

  if (impact.level === 'medium') {
    return `${temperatureNote} Wettest ${timing}, ~${amount}.`
  }

  return `${temperatureNote} Rain ${timing}, ~${amount}.`
}

function getHumidityLine(hours) {
  if (hours.length === 0) {
    return ''
  }

  const humidities = hours.map((hour) => hour.humidity).filter(Number.isFinite)
  const dewPoints = hours.map((hour) => hour.dewPoint).filter(Number.isFinite)
  if (humidities.length === 0) {
    return ''
  }

  const averageHumidity = Math.round(average(humidities))
  if (dewPoints.length === 0) {
    return `${averageHumidity}%`
  }

  const maxDewPoint = Math.round(Math.max(...dewPoints))
  if (maxDewPoint >= 70) {
    return `${averageHumidity}% · muggy`
  }

  if (maxDewPoint >= 62) {
    return `${averageHumidity}% · humid`
  }

  return `${averageHumidity}% · comfortable`
}

function getRainLine(day, wetHours, peakRain) {
  if (day.precipTotal < 0.01 && day.precipProbabilityMax < 35) {
    return 'Dry'
  }

  if (day.precipTotal < 0.01) {
    return peakRain ? `Trace · peak ${formatHour(peakRain.time)}` : 'Trace'
  }

  const amount = `${day.precipTotal.toFixed(2)}"`
  return peakRain ? `${amount} · peak ${formatHour(peakRain.time)}` : amount
}

function getReason(day, wetHours, peakRain) {
  if (!peakRain) {
    return 'No hourly detail yet.'
  }

  if (wetHours.length === 0 && day.precipTotal < 0.01) {
    return `Chances peak ${peakRain.precipProbability}%, but no real rain expected.`
  }

  if (day.precipTotal < 0.01 && day.precipProbabilityMax >= 35) {
    return `Chances peak ${peakRain.precipProbability}%, but only a trace likely.`
  }

  if (wetHours.length <= 2 && day.precipTotal < 0.05) {
    return `Brief — about ${wetHours.length} wet ${wetHours.length === 1 ? 'hour' : 'hours'}, ~${day.precipTotal.toFixed(2)}".`
  }

  return `~${day.precipTotal.toFixed(2)}" expected · chances peak ${day.precipProbabilityMax}%.`
}

function getTiming(hours) {
  if (hours.length === 0) {
    return 'midday'
  }

  return `${formatHour(hours[0].time)}–${formatHour(hours[hours.length - 1].time)}`
}

function getTemperatureNote(day) {
  const high = Math.round(day.high)
  const low = Math.round(day.low)

  if (day.apparentHigh >= 90) {
    return `Feels hot, ${low}–${high}°F.`
  }

  if (day.apparentLow <= 35) {
    return `Chilly start, ${low}–${high}°F.`
  }

  if (day.high - day.low >= 22) {
    return `Wide range, ${low}–${high}°F.`
  }

  return `Steady ${low}–${high}°F.`
}

function getConfidence(day, wetHours) {
  if (day.precipProbabilityMax >= 70 && wetHours.length >= 3) {
    return 'Solid signal'
  }

  if (day.precipProbabilityMax >= 45 && day.precipTotal < 0.04) {
    return 'Mixed signal'
  }

  return 'Reliable forecast'
}

function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function impactRank(level) {
  return { none: 0, low: 1, medium: 2, high: 3 }[level] || 0
}

function getTitle(date, index) {
  if (index === 0) {
    return 'Today'
  }

  if (index === 1) {
    return 'Tomorrow'
  }

  return new Intl.DateTimeFormat(undefined, { weekday: 'long' }).format(new Date(`${date}T12:00:00`))
}
