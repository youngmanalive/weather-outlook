import {
  formatHour,
  summarizeHumidity,
  summarizeRainDays,
  summarizeTempRange,
  summarizeThreeDay,
  summarizeThreeDayDetails,
  summarizeWind,
} from './forecastInterpretation'

export function ForecastControls({ selectedView, onSelectView }) {
  return (
    <section className="view-tabs" aria-label="Forecast range">
      <button type="button" className={selectedView === 'today' ? 'active' : ''} onClick={() => onSelectView('today')}>
        Today
      </button>
      <button type="button" className={selectedView === 'tomorrow' ? 'active' : ''} onClick={() => onSelectView('tomorrow')}>
        Tomorrow
      </button>
      <button type="button" className={selectedView === 'three' ? 'active' : ''} onClick={() => onSelectView('three')}>
        3 days
      </button>
    </section>
  )
}

export function LocationDialog({
  currentPlace,
  dialogNotice,
  locationStatus,
  query,
  searchResults,
  onClose,
  onCurrentLocation,
  onDefaultLocation,
  onQueryChange,
  onSearch,
  onSelectPlace,
}) {
  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="location-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="location-dialog-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="dialog-heading">
          <div>
            <h2 id="location-dialog-title">Where should we forecast?</h2>
            <p>Currently showing {currentPlace}</p>
          </div>
          <button type="button" className="close-button" onClick={onClose} aria-label="Close location dialog">
            ×
          </button>
        </div>

        <form className="search" onSubmit={onSearch}>
          <label className="search-label" htmlFor="location-search">
            Search a city, town, or ZIP
          </label>
          <div className="search-row">
            <input
              id="location-search"
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="e.g. Fairfield, PA or 17320"
            />
            <button type="submit">Search</button>
          </div>
          <p className="search-hint">We'll only use your location to pull a forecast.</p>
        </form>

        {(dialogNotice || locationStatus !== 'idle') && (
          <p className="dialog-notice" aria-live="polite">
            {locationStatus === 'searching'
              ? 'Searching locations...'
              : locationStatus === 'locating'
                ? 'Checking browser location...'
                : dialogNotice}
          </p>
        )}

        <div className="dialog-actions">
          <button type="button" onClick={onCurrentLocation}>
            Use current location
          </button>
          <button type="button" onClick={onDefaultLocation}>
            Use Fairfield, PA
          </button>
        </div>

        {searchResults.length > 1 && (
          <div className="result-list" aria-label="Choose location">
            {searchResults.map((result) => (
              <button type="button" key={`${result.latitude}-${result.longitude}`} onClick={() => onSelectPlace(result)}>
                {result.label}
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

export function ForecastSummary({ activeDays, primaryDay, selectedView }) {
  return (
    <section className="forecast-layout">
      <article className={`outlook-card impact-${primaryDay.impact.level}`}>
        <p className="day-label">{selectedView === 'three' ? 'Next 3 days' : primaryDay.title}</p>
        <h2>{selectedView === 'three' ? summarizeThreeDay(activeDays) : primaryDay.headline}</h2>
        <p className="outlook-copy">{selectedView === 'three' ? summarizeThreeDayDetails(activeDays) : primaryDay.summary}</p>

        <div className="impact-row">
          <span className="impact-chip">{primaryDay.impact.label}</span>
          {selectedView !== 'three' && <span>{primaryDay.confidence}</span>}
        </div>
      </article>

      <aside className="details-panel">
        <Metric label="Rain" value={selectedView === 'three' ? summarizeRainDays(activeDays) : primaryDay.rainLine} />
        <Metric label="Temp" value={selectedView === 'three' ? summarizeTempRange(activeDays) : `${Math.round(primaryDay.low)}-${Math.round(primaryDay.high)}°F`} />
        <Metric label="Wind" value={selectedView === 'three' ? summarizeWind(activeDays) : primaryDay.windLine} />
        <Metric label="Humidity" value={selectedView === 'three' ? summarizeHumidity(activeDays) : primaryDay.humidityLine} />
      </aside>
    </section>
  )
}

export function DailyCards({ days }) {
  if (days.length <= 1) {
    return null
  }

  return (
    <section className="day-grid" aria-label="Daily outlooks">
      {days.map((day) => (
        <article key={day.date} className={`day-card impact-${day.impact.level}`}>
          <p>{day.title}</p>
          <h3>{day.headline}</h3>
          <small>{day.rainLine} · {Math.round(day.low)}-{Math.round(day.high)}°F</small>
          <span className="impact-chip">{day.impact.label}</span>
        </article>
      ))}
    </section>
  )
}

export function HourlyEvidence({ day }) {
  return (
    <section className="evidence">
      <div className="section-heading">
        <h2>Hourly evidence</h2>
        <p>{day.reason}</p>
      </div>
      <HourlyStrip hours={day.hours} />
    </section>
  )
}

function Metric({ label, value }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function HourlyStrip({ hours }) {
  const displayHours = hours.filter((hour) => {
    const currentHour = new Date(hour.time).getHours()
    return currentHour >= 6 && currentHour <= 22
  })

  return (
    <div className="hour-strip">
      {displayHours.map((hour) => (
        <div className="hour" key={hour.time}>
          <span>{formatHour(hour.time)}</span>
          <div className="rain-bar" style={{ height: `${Math.max(5, hour.precipProbability)}%` }} title={`${hour.precipProbability}% rain chance`} />
          <strong>{Math.round(hour.temperature)}°</strong>
          <small>{hour.precipitation > 0 ? `${hour.precipitation.toFixed(2)}"` : 'dry'}</small>
        </div>
      ))}
    </div>
  )
}
