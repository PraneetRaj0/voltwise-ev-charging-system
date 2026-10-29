import './App.css'
import { useEffect, useState } from 'react'
function App() {
    const token = sessionStorage.getItem('voltwise_token')
  const loggedInUser = JSON.parse(
    sessionStorage.getItem('voltwise_user') || 'null'
  )
  const [bookings, setBookings] = useState([])
  const [bookingsLoading, setBookingsLoading] = useState(false)
  const [bookingsError, setBookingsError] = useState('')
  const [stations, setStations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [connectorId, setConnectorId] = useState('1')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [requestedPower, setRequestedPower] = useState('7')
  const [bookingMessage, setBookingMessage] = useState('')
  const [bookingLoading, setBookingLoading] = useState(false)
  const [energy, setEnergy] = useState({
  total_capacity_kw: 0,
  current_load_kw: 0,
  utilization_percent: 0
})

  useEffect(() => {
    fetch('http://localhost:5000/api/stations')
      .then((response) => {
        if (!response.ok) {
          throw new Error('Failed to load stations')
        }
        return response.json()
      })
      .then((data) => setStations(data))
      .catch(() => setError('Could not load charging stations.'))
      .finally(() => setLoading(false))
  }, [])

useEffect(() => {
  const loadBookings = async () => {
    setBookingsLoading(true)

    try {
      
const response = await fetch('http://localhost:5000/api/bookings', {
  cache: 'no-store',
  headers: {
    Authorization: `Bearer ${token}`,
    'Cache-Control': 'no-cache'
  }
})


      if (!response.ok) {
        throw new Error('Failed to load bookings')
      }

      
const data = await response.json()
setBookings(data)
setBookingsError('')
} catch (error) {
  console.error('Could not load bookings:', error.message)
  setBookings([])
  setBookingsError(error.message)
} finally {
  setBookingsLoading(false)
}

  }

  loadBookings()
}, [])

useEffect(() => {
  const loadEnergy = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/energy')

      if (!response.ok) {
        throw new Error('Failed to load energy data')
      }

      const data = await response.json()
      setEnergy(data)
    } catch (error) {
      console.error('Could not load energy data:', error.message)
    }
  }

  loadEnergy()
}, [])

const createBooking = async (event) => {
  event.preventDefault()
  setBookingMessage('')
  setBookingLoading(true)

  try {
    const response = await fetch('http://localhost:5000/api/bookings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        connector_id: Number(connectorId),
        start_time: startTime,
        end_time: endTime,
        requested_power_kw: Number(requestedPower)
      })
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || 'Booking failed')
    }

    setBookingMessage(
      `Booking created successfully! Booking ID: ${data.booking_id}`
    )
    setStartTime('')
    setEndTime('')
  } catch (error) {
    setBookingMessage(error.message)
  } finally {
    setBookingLoading(false)
  }
}

const cancelBooking = async (bookingId) => {
  const confirmed = window.confirm(
    'Are you sure you want to cancel this booking?'
  )

  if (!confirmed) return

  try {
    
const response = await fetch(
  `http://localhost:5000/api/bookings/${bookingId}/cancel`,
  {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`
    }
  }
)


    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || 'Could not cancel booking')
    }

    setBookings((currentBookings) =>
      currentBookings.map((booking) =>
        booking.booking_id === bookingId
          ? { ...booking, status: 'cancelled' }
          : booking
      )
    )

    setBookingMessage('Booking cancelled successfully.')
  } catch (error) {
    setBookingMessage(error.message)
  }
}

  return (
    <div className="app">
      <aside className="sidebar">
        <h2 className="logo">⚡ VoltWise</h2>
        <p className="menu-label">MAIN MENU</p>
        <a
  className="active"
  href="#dashboard"
  onClick={() => {
    document.getElementById('dashboard')?.scrollIntoView({
      behavior: 'smooth'
    })
  }}
>
  ▦ Dashboard
</a>
        <a href="#stations">⚡ Charging Stations</a>
        <a href="#my-bookings">▣ My Bookings</a>
        <a href="#energy">◉ Energy Analytics</a>
        <a href="#profile">♙ My Profile</a>
        <div className="sidebar-bottom">Smart charging. Smarter future.</div>
      </aside>

      <main className="main" id="dashboard">
        <header className="topbar">
          <div>
            <p className="eyebrow">EV CHARGING MANAGEMENT</p>
            <h1>Dashboard</h1>
            <p className="muted">Welcome to your smart charging workspace.</p>
          </div>
          <div className="user-badge">PR <span>EV User</span></div>
        </header>

        <section className="hero">
          <div>
            <span className="hero-tag">⚡ YOUR ELECTRIC JOURNEY</span>
            <h2>Power your journey.<br />Charge smarter.</h2>
            <p>Find charging stations, reserve a slot, and monitor your energy usage in one place.</p>
            <a className="primary-button" href="#stations">Explore Stations ↗</a>
          </div>
          <div className="hero-icon">⚡</div>
        </section>

        
<section className="stats">
  <article className="stat-card">
    <div className="stat-icon green">⚡</div>
    <p>Available Stations</p>
    <h2>{stations.length} <span>stations</span></h2>
    <small>Across your charging network</small>
  </article>

  <article className="stat-card">
    <div className="stat-icon blue">▣</div>
    <p>My Bookings</p>
    <h2>{bookings.filter((booking) => booking.status === 'confirmed').length} <span>bookings</span></h2>
    <small>Confirmed charging sessions</small>
  </article>

  <article className="stat-card">
    <div className="stat-icon orange">ϟ</div>
    <p>Energy Consumed</p>
    <h2>0 <span>kWh</span></h2>
    <small>Consumption tracking not yet implemented</small>
  </article>
</section>


        <section className="content-grid" id="stations">
          <article className="panel stations-panel">
            <div className="panel-heading">
              <div>
                <h2>Nearby Charging Stations</h2>
                <p>Explore the network and charging capacity.</p>
              </div>
              <span className="live-label"><span /> DEMO DATA</span>
            </div>

            {loading && <p>Loading stations...</p>}

{error && <p>{error}</p>}

{!loading && !error && stations.length === 0 && (
  <p>No charging stations found.</p>
)}


{stations.map((station) => (
  <div className="station" key={station.station_id}>
    <div className="station-symbol">⚡</div>

    <div className="station-info">
      <h3>{station.station_name}</h3>
      <p>{station.location}</p>
      <p>Maximum power: {station.max_power_kw} kW</p>
      <p>
        Connectors: {station.active_connectors} active / {station.total_connectors} total
      </p>
    </div>

    <div className="station-price">
      {station.price_per_kwh != null
        ? `₹${Number(station.price_per_kwh).toFixed(2)}`
        : 'Price unavailable'}
      <small>/ kWh</small>
    </div>
  </div>
))}

          </article>

          
<article className="panel energy-panel" id="energy">
  <div className="panel-heading">
    <div>
      <h2>Energy Load</h2>
      <p>Live station capacity usage</p>
    </div>
  </div>

  <div className="energy-number">
    {energy.utilization_percent}%
    <span>utilized</span>
  </div>

  <div className="progress">
    <div
      style={{
        width: `${Math.min(energy.utilization_percent, 100)}%`
      }}
    />
  </div>

  <div className="progress-labels">
    <span>Current load</span>
    <span>
      {energy.current_load_kw} / {energy.total_capacity_kw} kW
    </span>
  </div>

  <div className="load-status">
    <span>
      {energy.current_load_kw <= energy.total_capacity_kw
        ? '● Within estimated capacity'
        : '● Capacity exceeded'}
    </span>
  </div>

  <div className="energy-note">
    <strong>Smart load balancing</strong>
    <p>
      VoltWise will help prevent overlapping reservations from exceeding
      available charging capacity.
    </p>
  </div>
</article>

        </section>
        
<section className="panel booking-panel">
  <div className="panel-heading">
    <div>
      <h2>Reserve a Charging Slot</h2>
      <p>Choose your connector and charging time.</p>
    </div>
  </div>

  <form onSubmit={createBooking} className="booking-form">
    <label>
      Connector
      <select
        value={connectorId}
        onChange={(event) => setConnectorId(event.target.value)}
      >
        <option value="1">Station A — Type 2 (11 kW)</option>
        <option value="2">Station A — CCS2 (30 kW)</option>
        <option value="3">Station B — Type 2 (7.4 kW)</option>
      </select>
    </label>

    <label>
      Start date and time
      <input
        type="datetime-local"
        value={startTime}
        onChange={(event) => setStartTime(event.target.value)}
        required
      />
    </label>

    <label>
      End date and time
      <input
        type="datetime-local"
        value={endTime}
        onChange={(event) => setEndTime(event.target.value)}
        required
      />
    </label>

    <label>
      Requested power (kW)
      <input
        type="number"
        min="0.1"
        step="0.1"
        value={requestedPower}
        onChange={(event) => setRequestedPower(event.target.value)}
        required
      />
    </label>

    <button type="submit" disabled={bookingLoading}>
      {bookingLoading ? 'Booking...' : 'Book Now'}
    </button>

    {bookingMessage && <p role="status">{bookingMessage}</p>}
  </form>
</section>

<section className="panel booking-panel" id="my-bookings">
  <div className="panel-heading">
    <div>
      <h2>My Bookings</h2>
      <p>View your scheduled charging sessions.</p>
    </div>
  </div>

 
{bookingsLoading && <p>Loading bookings...</p>}

{bookingsError && <p role="alert">{bookingsError}</p>}

{!bookingsLoading && !bookingsError && bookings.length === 0 && (
  <p>No bookings found yet.</p>
)}


  {bookings.map((booking) => (
    <article className="station" key={booking.booking_id}>
      <div className="station-symbol">⚡</div>

      <div className="station-info">
        <h3>{booking.station_name}</h3>
        <p>Booking ID: {booking.booking_id}</p>
        <p>Connector: {booking.connector_type}</p>
        <p>
          Start: {new Date(booking.start_time).toLocaleString()}
        </p>
        <p>
          End: {new Date(booking.end_time).toLocaleString()}
        </p>
        <p>Power requested: {booking.requested_power_kw} kW</p>
        <p>Status: {booking.status}</p>
        
{booking.status === 'confirmed' && (
  <button
    type="button"
    onClick={() => cancelBooking(booking.booking_id)}
    className="cancel-booking-button"
  >
    Cancel Booking
  </button>
)}

      </div>
    </article>
  ))}
</section>

<section className="panel booking-panel" id="profile">
  <div className="panel-heading">
    <div>
      <h2>My Profile</h2>
      <p>Your VoltWise account information.</p>
    </div>
  </div>

  <div className="station">
    <div className="station-symbol">👤</div>
    <div className="station-info">
      <h3>{loggedInUser?.name || 'Customer'}</h3>
<p>Role: {loggedInUser?.role || 'user'}</p>
<p>Account: {loggedInUser?.email || ''}</p>
    </div>
  </div>
</section>



        <footer>VoltWise · EV Charging Reservation &amp; Energy Load Balancing System</footer>
      </main>
    </div>
  )
}

export default App