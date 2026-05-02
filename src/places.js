export const DEFAULT_PLACE = {
  name: 'Fairfield',
  admin1: 'Pennsylvania',
  postalCode: '17320',
  country: 'United States',
  latitude: 39.7876,
  longitude: -77.3686,
  timezone: 'America/New_York',
}

const PLACE_STORAGE_KEY = 'weather-outlook-place'

export function toPlace(result) {
  return {
    name: result.name,
    admin1: result.admin1,
    postalCode: result.postcode,
    country: result.country,
    latitude: result.latitude,
    longitude: result.longitude,
    timezone: result.timezone,
  }
}

export async function placeFromPosition(position) {
  const { latitude, longitude } = position.coords
  const fallbackPlace = {
    name: 'Current location',
    admin1: '',
    country: '',
    latitude,
    longitude,
    timezone: 'auto',
  }

  try {
    const params = new URLSearchParams({
      latitude,
      longitude,
      localityLanguage: 'en',
    })
    const response = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?${params}`)
    if (!response.ok) {
      return fallbackPlace
    }

    const data = await response.json()
    const name = getReversePlaceName(data)
    const admin1 = data.principalSubdivision
    const country = normalizeCountryName(data.countryName)
    const postalCode = data.postcode

    return {
      name: name || fallbackPlace.name,
      admin1: admin1 || '',
      postalCode,
      country: country || '',
      latitude,
      longitude,
      timezone: 'auto',
    }
  } catch {
    return fallbackPlace
  }
}

export function formatPlace(currentPlace) {
  const region = [currentPlace.admin1, currentPlace.postalCode].filter(Boolean).join(' ')
  const country = currentPlace.country === 'United States' ? '' : currentPlace.country
  return [currentPlace.name, region, country].filter(Boolean).join(', ')
}

export function readStoredPlace() {
  try {
    const storedPlace = window.localStorage.getItem(PLACE_STORAGE_KEY)
    return storedPlace ? JSON.parse(storedPlace) : null
  } catch {
    return null
  }
}

export function writeStoredPlace(nextPlace) {
  try {
    window.localStorage.setItem(PLACE_STORAGE_KEY, JSON.stringify(nextPlace))
  } catch {
    // Local storage can be unavailable in private or locked-down browser modes.
  }
}

function getReversePlaceName(data) {
  const administrativeNames = data.localityInfo?.administrative?.map((item) => item.name).filter(Boolean) || []
  const friendlyAdminName = administrativeNames.find((name) => !/township|county/i.test(name))
  return data.city || data.locality || friendlyAdminName || administrativeNames[0]
}

function normalizeCountryName(countryName = '') {
  if (countryName === 'United States of America (the)') {
    return 'United States'
  }

  return countryName.replace(' (the)', '')
}
