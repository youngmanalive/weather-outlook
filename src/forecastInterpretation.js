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
    const seed = days.map((day) => day.date).join('|')
    return pickDeterministic(seed, THREE_DAY_NONE_IMPACT_HEADLINES)
  }

  if (featureDay.impact.level === 'high') {
    return `${featureDay.title} looks like the wettest of the stretch.`
  }

  if (featureDay.impact.level === 'medium') {
    return `Plan around ${featureDay.title}'s rain timing.`
  }

  return `${featureDay.title} has the most weather to plan around.`
}

export function summarizeThreeDayDetails(days) {
  const wetDays = days.filter((day) => day.impact.level !== 'none')
  if (wetDays.length === 0) {
    return 'No day looks meaningfully wet. Temperature and wind will shape how it feels more than rain.'
  }

  return wetDays.map((day) => `${day.title} — ${lowercaseFirst(day.rainLine)}.`).join(' ')
}

export function summarizeRainDays(days) {
  const wetDays = days.filter((day) => day.impact.level !== 'none')
  if (wetDays.length === 0) {
    return 'Looks dry through the stretch'
  }

  return wetDays.map((day) => `${day.title}: ${lowercaseFirst(day.rainLine)}`).join('; ')
}

function lowercaseFirst(text) {
  if (!text) {
    return text
  }
  return text.charAt(0).toLowerCase() + text.slice(1)
}

export function summarizeTempRange(days) {
  const lows = days.map((day) => day.low)
  const highs = days.map((day) => day.high)
  return `${Math.round(Math.min(...lows))}-${Math.round(Math.max(...highs))}°F`
}

export function summarizeWind(days) {
  const gustMax = Math.max(...days.map((day) => day.gustMax))
  const windMax = Math.max(...days.map((day) => day.windMax))
  return gustMax >= 28 ? `Gusts near ${Math.round(gustMax)} mph` : `Up to ${Math.round(windMax)} mph`
}

export function summarizeHumidity(days) {
  const humidityValues = days.flatMap((day) => day.hours.map((hour) => hour.humidity)).filter(Number.isFinite)
  const dewPoints = days.flatMap((day) => day.hours.map((hour) => hour.dewPoint)).filter(Number.isFinite)
  if (humidityValues.length === 0) {
    return ''
  }

  const averageHumidity = Math.round(average(humidityValues))
  if (dewPoints.length === 0) {
    return `${averageHumidity}% avg`
  }

  const maxDewPoint = Math.round(Math.max(...dewPoints))
  if (maxDewPoint >= 70) {
    return `${averageHumidity}% avg, muggy at times`
  }

  if (maxDewPoint >= 62) {
    return `${averageHumidity}% avg, humid at times`
  }

  return `${averageHumidity}% avg, comfortable`
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
  const windLine = day.gustMax >= 28 ? `Breezy, gusts near ${Math.round(day.gustMax)} mph` : `Around ${Math.round(day.windMax)} mph, calm enough`
  const humidityLine = getHumidityLine(daylightHours)
  const confidence = getConfidence(day, wetHours)

  return {
    ...day,
    title: getTitle(day.date, day.index),
    headline: getHeadline(day, mainCondition, impact),
    summary: getSummary(day, impact, timing, temperatureNote, windLine),
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

const THREE_DAY_NONE_IMPACT_HEADLINES = [
  'The next few days look low-impact.',
  'The next few days look manageable on the weather front.',
  'Overall, the stretch ahead looks fairly tame weather-wise.',
  'Nothing major jumps out for the next few days — mostly routine weather.',
  'The pattern ahead stays fairly low-drama for outdoor plans.',
]

const NONE_IMPACT_HEADLINE_LINES = [
  (mc) => `Mostly ${mc} and easy to plan around.`,
  (mc) => `Mostly ${mc} with little to work around.`,
  (mc) => `Mostly ${mc} — the forecast shouldn't shape your day.`,
  (mc) => `Mostly ${mc} and quiet overall.`,
  (mc) => `Mostly ${mc}, a calm day on the weather front.`,
]

const LOW_IMPACT_HEADLINE_LINES = [
  (mc) => `A ${mc} day with only a hint of rain.`,
  (mc) => `A ${mc} day — rain should stay a minor footnote.`,
  (mc) => `A ${mc} day, with light rain at worst.`,
  (mc) => `A ${mc} day — wet spells possible but not the main story.`,
]

const MEDIUM_IMPACT_HEADLINE_LINES = [
  () => `Workable day, but rain timing matters.`,
  () => `Mostly usable, with a wet window to plan around.`,
  () => `A wet stretch is likely — keep timing flexible.`,
]

const HIGH_IMPACT_HEADLINE_LINES = [
  () => `A wet, unsettled day — plan around it.`,
  () => `Expect rain you can't easily avoid.`,
  () => `A disruptive day — rain or wind will shape plans.`,
]

function getHeadline(day, mainCondition, impact) {
  const seed = `${day.date}|${mainCondition}`

  if (impact.level === 'none') {
    const line = pickDeterministic(seed, NONE_IMPACT_HEADLINE_LINES)
    return line(mainCondition)
  }

  if (impact.level === 'low') {
    const line = pickDeterministic(seed, LOW_IMPACT_HEADLINE_LINES)
    return line(mainCondition)
  }

  if (impact.level === 'medium') {
    const line = pickDeterministic(seed, MEDIUM_IMPACT_HEADLINE_LINES)
    return line()
  }

  const line = pickDeterministic(seed, HIGH_IMPACT_HEADLINE_LINES)
  return line()
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

function getSummary(day, impact, timing, temperatureNote, windLine) {
  const amount = day.precipTotal < 0.01 ? 'barely any measurable rain' : `about ${day.precipTotal.toFixed(2)} in`
  const windNote = getWindNote(windLine)

  if (impact.level === 'none') {
    return `${temperatureNote} Rain isn't expected to interfere, and ${windNote}.`
  }

  if (impact.level === 'low') {
    return `${temperatureNote} A short wet spell is possible ${timing}, but only ${amount} is expected. Most outdoor plans should stay on track.`
  }

  if (impact.level === 'medium') {
    return `${temperatureNote} The wettest stretch lands ${timing}, with ${amount}. Stay flexible for longer outdoor plans.`
  }

  return `${temperatureNote} Rain may be hard to avoid ${timing}, with ${amount}. Timing will shape what's worth doing outside.`
}

function getWindNote(windLine) {
  if (windLine.startsWith('Breezy')) {
    return windLine.replace('Breezy,', 'wind may be breezy, with')
  }

  return 'wind should stay calm enough to ignore'
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
    return `${averageHumidity}% humidity`
  }

  const maxDewPoint = Math.round(Math.max(...dewPoints))
  if (maxDewPoint >= 70) {
    return `${averageHumidity}%, muggy`
  }

  if (maxDewPoint >= 62) {
    return `${averageHumidity}%, a little humid`
  }

  return `${averageHumidity}%, comfortable`
}

function getRainLine(day, wetHours, peakRain) {
  if (day.precipTotal < 0.01 && day.precipProbabilityMax < 35) {
    return 'Looks dry'
  }

  if (day.precipTotal < 0.01) {
    return peakRain ? `Trace at most, peak chance around ${formatHour(peakRain.time)}` : 'Trace at most'
  }

  const amount = `${day.precipTotal.toFixed(2)} in`
  const peakLabel = peakRain ? ` around ${formatHour(peakRain.time)}` : ''

  if (wetHours.length === 0) {
    return `About ${amount}${peakLabel}`
  }

  if (wetHours.length === 1) {
    return `About ${amount}, brief${peakLabel}`
  }

  if (wetHours.length <= 3) {
    return `About ${amount} over a few hours${peakLabel ? `, peak${peakLabel}` : ''}`
  }

  return `About ${amount} on and off${peakLabel ? `, peak${peakLabel}` : ''}`
}

function getReason(day, wetHours, peakRain) {
  if (!peakRain) {
    return 'Hourly detail is not available for this day yet.'
  }

  if (wetHours.length === 0 && day.precipTotal < 0.01) {
    return `No meaningful daytime rain is expected, even though chances briefly reach ${peakRain.precipProbability}%.`
  }

  if (day.precipTotal < 0.01 && day.precipProbabilityMax >= 35) {
    return `Forecast looks cautious — chances peak near ${peakRain.precipProbability}%, but only a trace of rain is expected.`
  }

  if (wetHours.length <= 2 && day.precipTotal < 0.05) {
    const hourWord = wetHours.length === 1 ? 'hour' : 'hours'
    return `Only about ${wetHours.length} daytime ${hourWord} of rain is expected, with about ${day.precipTotal.toFixed(2)} in total.`
  }

  return `Rain looks likely on and off through the day, with about ${day.precipTotal.toFixed(2)} in expected and chances peaking near ${day.precipProbabilityMax}%.`
}

function getTiming(hours) {
  if (hours.length === 0) {
    return 'without a clear daytime window'
  }

  return `${formatHour(hours[0].time)}-${formatHour(hours[hours.length - 1].time)}`
}

function getTemperatureNote(day) {
  const high = Math.round(day.high)
  const low = Math.round(day.low)

  if (day.apparentHigh >= 90) {
    return `It will feel hot, roughly ${low}-${high}°F.`
  }

  if (day.apparentLow <= 35) {
    return `The day starts chilly, roughly ${low}-${high}°F.`
  }

  if (day.high - day.low >= 22) {
    return `Expect a wide temperature range, roughly ${low}-${high}°F.`
  }

  return `Temperatures should be steady, roughly ${low}-${high}°F.`
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
