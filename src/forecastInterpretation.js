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

export function summarizeThreeDay(days) {
  const highestImpact = days.reduce((max, day) => impactRank(day.impact.level) > impactRank(max.impact.level) ? day : max, days[0])
  if (!highestImpact || highestImpact.impact.level === 'none') {
    return 'The next few days look low-impact.'
  }

  return `${highestImpact.title} has the main weather impact.`
}

export function summarizeThreeDayDetails(days) {
  const wetDays = days.filter((day) => day.impact.level !== 'none')
  if (wetDays.length === 0) {
    return 'No day has a meaningful rain signal. Temperature and wind are more likely to shape how it feels.'
  }

  return wetDays.map((day) => `${day.title}: ${day.rainLine}`).join(' ')
}

export function summarizeRainDays(days) {
  const wetDays = days.filter((day) => day.impact.level !== 'none')
  if (wetDays.length === 0) {
    return 'No meaningful rain signal'
  }

  return wetDays.map((day) => `${day.title}: ${day.rainLine}`).join('; ')
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
  const windLine = day.gustMax >= 28 ? `Breezy, gusts near ${Math.round(day.gustMax)} mph` : `${Math.round(day.windMax)} mph, manageable`
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
  if (day.precipTotal >= 0.35 || likelyWetHours.length >= 5 || day.precipProbabilityMax >= 85) {
    return { level: 'high', label: 'Likely disruptive' }
  }

  if (day.precipTotal >= 0.12 || likelyWetHours.length >= 3 || day.precipProbabilityMax >= 70) {
    return { level: 'medium', label: 'Plan around it' }
  }

  if (day.precipTotal >= 0.02 || wetHours.length > 0 || day.precipProbabilityMax >= 40) {
    return { level: 'low', label: 'Low impact' }
  }

  return { level: 'none', label: 'Minimal impact' }
}

function getHeadline(day, mainCondition, impact) {
  if (impact.level === 'none') {
    return `Mostly ${mainCondition}, with low weather impact.`
  }

  if (impact.level === 'low') {
    return `A ${mainCondition} day with limited rain impact.`
  }

  if (impact.level === 'medium') {
    return `Generally usable, with a wet window to plan around.`
  }

  return `Wet or unsettled conditions are likely.`
}

function getSummary(day, impact, timing, temperatureNote, windLine) {
  const amount = day.precipTotal < 0.01 ? 'little to no measurable rain' : `${day.precipTotal.toFixed(2)}" total`
  const windNote = getWindNote(windLine)

  if (impact.level === 'none') {
    return `${temperatureNote} Rain looks unlikely to affect plans, and ${windNote}.`
  }

  if (impact.level === 'low') {
    return `${temperatureNote} A brief wet window is possible ${timing}, but the forecast only shows ${amount}. Most outdoor plans should remain practical.`
  }

  if (impact.level === 'medium') {
    return `${temperatureNote} The wet window is most likely ${timing}, with ${amount}. Keep timing flexible for longer outdoor plans.`
  }

  return `${temperatureNote} Rain may be difficult to avoid ${timing}, with ${amount}. Timing will matter for outdoor plans.`
}

function getWindNote(windLine) {
  if (windLine.startsWith('Breezy')) {
    return windLine.replace('Breezy,', 'wind may be breezy, with')
  }

  return `wind should stay manageable near ${windLine}`
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
    return 'Dry in practice'
  }

  const amount = day.precipTotal < 0.01 ? 'trace' : `${day.precipTotal.toFixed(2)}"`
  const peak = peakRain ? `${formatHour(peakRain.time)} peak` : 'brief peak'
  const hours = wetHours.length === 1 ? '1 hour flagged' : `${wetHours.length} hours flagged`

  return `${amount}, ${hours}, ${peak}`
}

function getReason(day, wetHours, peakRain) {
  if (!peakRain) {
    return 'No hourly detail is available for this day yet.'
  }

  if (wetHours.length === 0 && day.precipTotal < 0.01) {
    return `No meaningful daytime rain is flagged, even though probability briefly reaches ${peakRain.precipProbability}%.`
  }

  if (day.precipTotal < 0.01 && day.precipProbabilityMax >= 35) {
    return `The icon may look cautious because probability peaks near ${peakRain.precipProbability}%, but modeled accumulation stays near trace.`
  }

  if (wetHours.length <= 2 && day.precipTotal < 0.05) {
    return `Only ${wetHours.length} daytime ${wetHours.length === 1 ? 'hour is' : 'hours are'} flagged, with ${day.precipTotal.toFixed(2)}" total.`
  }

  return `Daytime rain signal spans ${wetHours.length} hours, with ${day.precipTotal.toFixed(2)}" total and a ${day.precipProbabilityMax}% peak chance.`
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
    return 'Confidence: solid'
  }

  if (day.precipProbabilityMax >= 45 && day.precipTotal < 0.04) {
    return 'Confidence: mixed'
  }

  return 'Confidence: decent'
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
