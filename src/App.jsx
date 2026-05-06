import { useEffect, useMemo, useState } from 'react'
import { buildDays, highestImpactDay } from './forecastInterpretation'
import { DEFAULT_PLACE, formatPlace, placeFromPosition, readStoredPlace, writeStoredPlace } from './places'
import { fetchForecast, searchPlaces as searchPlaceApi } from './weatherApi'
import { DailyCards, ForecastControls, ForecastSummary, HourlyEvidence, LocationDialog } from './WeatherSections'
import './App.css'

const LATE_EVENING_HOUR = 21

function getInitialView() {
  return new Date().getHours() >= LATE_EVENING_HOUR ? 'tomorrow' : 'today'
}

function App() {
  const [initialLocation] = useState(() => {
    const storedPlace = readStoredPlace()
    return {
      hasStoredPlace: Boolean(storedPlace),
      place: storedPlace || DEFAULT_PLACE,
    }
  })
  const [place, setPlace] = useState(initialLocation.place)
  const [query, setQuery] = useState(initialLocation.place.name)
  const [searchResults, setSearchResults] = useState([])
  const [forecast, setForecast] = useState(null)
  const [selectedView, setSelectedView] = useState(getInitialView)
  const [isLocationDialogOpen, setIsLocationDialogOpen] = useState(false)
  const [forecastStatus, setForecastStatus] = useState('idle')
  const [locationStatus, setLocationStatus] = useState('idle')
  const [forecastError, setForecastError] = useState('')
  const [dialogNotice, setDialogNotice] = useState('')

  useEffect(() => {
    if (initialLocation.hasStoredPlace || !navigator.geolocation) {
      return
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const currentPlace = await placeFromPosition(position)
        setPlace(currentPlace)
        setQuery(currentPlace.name)
        writeStoredPlace(currentPlace)
      },
      () => {},
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 600000 },
    )
  }, [initialLocation.hasStoredPlace])

  useEffect(() => {
    let ignore = false

    async function loadForecast() {
      setForecastStatus('loading')
      setForecastError('')

      try {
        const data = await fetchForecast(place)
        if (!ignore) {
          setForecast(data)
          setForecastStatus('ready')
        }
      } catch (currentError) {
        if (!ignore) {
          setForecastError(currentError.message || 'Forecast unavailable')
          setForecastStatus('error')
        }
      }
    }

    loadForecast()

    return () => {
      ignore = true
    }
  }, [place])

  const days = useMemo(() => buildDays(forecast), [forecast])
  const activeDays = selectedView === 'three' ? days.slice(0, 3) : [days[selectedView === 'today' ? 0 : 1]].filter(Boolean)
  const primaryDay = selectedView === 'three' ? highestImpactDay(activeDays) : activeDays[0]
  const currentPlaceLabel = formatPlace(place)
  const labelledSearchResults = searchResults.map((result) => ({
    ...result,
    label: formatPlace(result),
  }))

  function updatePlace(nextPlace) {
    setPlace(nextPlace)
    setQuery(nextPlace.name)
    writeStoredPlace(nextPlace)
  }

  function openLocationDialog() {
    setQuery(place.name)
    setSearchResults([])
    setDialogNotice('')
    setLocationStatus('idle')
    setIsLocationDialogOpen(true)
  }

  function closeLocationDialog() {
    setSearchResults([])
    setDialogNotice('')
    setLocationStatus('idle')
    setIsLocationDialogOpen(false)
  }

  async function searchPlaces(event) {
    event.preventDefault()

    const trimmedQuery = query.trim()
    if (!trimmedQuery) {
      return
    }

    setLocationStatus('searching')
    setDialogNotice('')
    setSearchResults([])

    try {
      const results = await searchPlaceApi(trimmedQuery)
      setSearchResults(results)

      if (results.length === 1) {
        updatePlace(results[0])
        setSearchResults([])
        setLocationStatus('idle')
        setIsLocationDialogOpen(false)
      } else if (results.length === 0) {
        setDialogNotice(`No locations found for "${trimmedQuery}".`)
        setLocationStatus('idle')
      } else {
        setLocationStatus('idle')
      }
    } catch (currentError) {
      setDialogNotice(currentError.message || 'Location search failed')
      setLocationStatus('idle')
    }
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setDialogNotice('This browser does not support location lookup.')
      return
    }

    setLocationStatus('locating')
    setDialogNotice('')

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        updatePlace(await placeFromPosition(position))
        setSearchResults([])
        setLocationStatus('idle')
        setIsLocationDialogOpen(false)
      },
      () => {
        setDialogNotice('Location permission was not available.')
        setLocationStatus('idle')
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 600000 },
    )
  }

  return (
    <main className="app-shell">
      <section className="topbar" aria-label="Weather location controls">
        <div className="brand">
          <h1>Weather outlook</h1>
          <p className="current-place">{currentPlaceLabel}</p>
        </div>

        <div className="header-actions">
          <ForecastControls selectedView={selectedView} onSelectView={setSelectedView} />

          <button
            type="button"
            className="menu-trigger"
            aria-haspopup="dialog"
            aria-expanded={isLocationDialogOpen}
            onClick={openLocationDialog}
          >
            Location
          </button>
        </div>
      </section>

      {isLocationDialogOpen && (
        <LocationDialog
          currentPlace={currentPlaceLabel}
          dialogNotice={dialogNotice}
          locationStatus={locationStatus}
          query={query}
          searchResults={labelledSearchResults}
          onClose={closeLocationDialog}
          onCurrentLocation={useCurrentLocation}
          onDefaultLocation={() => {
            updatePlace(DEFAULT_PLACE)
            closeLocationDialog()
          }}
          onQueryChange={setQuery}
          onSearch={searchPlaces}
          onSelectPlace={(nextPlace) => {
            updatePlace(nextPlace)
            closeLocationDialog()
          }}
        />
      )}

      {forecastError && <p className="notice">{forecastError}</p>}

      {forecastStatus !== 'ready' && forecastStatus !== 'error' && (
        <section className="loading" aria-live="polite">
          Reading the forecast...
        </section>
      )}

      {primaryDay && <ForecastSummary activeDays={activeDays} primaryDay={primaryDay} selectedView={selectedView} />}
      <DailyCards days={activeDays} />
      {primaryDay && selectedView !== 'three' && <HourlyEvidence day={primaryDay} />}
    </main>
  )
}

export default App
