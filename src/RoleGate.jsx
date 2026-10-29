
import { useState } from 'react'
import App from './App.jsx'
import './RoleGate.css'

const API = 'http://localhost:5000'

export default function RoleGate() {
  const [screen, setScreen] = useState('choose')
  const [mode, setMode] = useState('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(false)
  const [account, setAccount] = useState(null)

  async function submitForm(event) {
    event.preventDefault()
    setNotice('')
    setLoading(true)

    try {
      const registering =
        screen === 'customer' && mode === 'register'

      const response = await fetch(
        `${API}/api/auth/${registering ? 'register' : 'login'}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(
            registering
              ? { name, email, password }
              : { email, password }
          )
        }
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Request failed')
      }

      if (registering) {
        setMode('login')
        setPassword('')
        setNotice('Account created! Please log in with your email and password.')
        return
      }

      const expectedRole = screen === 'admin' ? 'admin' : 'user'

      if (data.user?.role !== expectedRole) {
        throw new Error(
          screen === 'admin'
            ? 'This account is not an administrator.'
            : 'Please use the Administrator login for this account.'
        )
      }

      sessionStorage.setItem('voltwise_token', data.token)
      sessionStorage.setItem('voltwise_user', JSON.stringify(data.user))
      setAccount(data.user)
    } catch (error) {
      setNotice(
        error.message === 'Failed to fetch'
          ? 'Cannot connect to the backend. Make sure your server is running on port 5000.'
          : error.message
      )
    } finally {
      setLoading(false)
    }
  }

  function signOut() {
    sessionStorage.removeItem('voltwise_token')
    sessionStorage.removeItem('voltwise_user')
    setAccount(null)
    setPassword('')
    setNotice('')
    setScreen('choose')
  }

  if (account) {
    return (
      <>
        <div className="demo-banner">
          Signed in as {account.name} ({account.role})
          <button onClick={signOut}>Sign out</button>
        </div>
        {account.role === 'user' ? (
          <App />
        ) : (
          <AdminDemo onBack={signOut} />
        )}
      </>
    )
  }

  return (
    <main className="role-page">
      <section className="role-shell">
        <div className="role-brand">
          <span className="role-bolt">⚡</span>
          <span>VoltWise</span>
        </div>

        <p className="role-eyebrow">SMART EV CHARGING PLATFORM</p>

        {screen === 'choose' ? (
          <>
            <h1>Welcome to VoltWise</h1>
            <p className="role-subtitle">
              Choose how you want to access the charging network.
            </p>

            <div className="role-options">
              <button
                className="role-option"
                onClick={() => {
                  setScreen('customer')
                  setMode('login')
                  setNotice('')
                }}
              >
                <span className="role-option-icon">♙</span>
                <strong>Customer</strong>
                <span>
                  Find stations, reserve charging slots, and manage bookings.
                </span>
                <b>Customer login / registration →</b>
              </button>

              <button
                className="role-option"
                onClick={() => {
                  setScreen('admin')
                  setNotice('')
                }}
              >
                <span className="role-option-icon">▣</span>
                <strong>Administrator</strong>
                <span>
                  Access the management area for your charging network.
                </span>
                <b>Administrator login →</b>
              </button>
            </div>
          </>
        ) : (
          <form className="role-form" onSubmit={submitForm}>
            <button
              type="button"
              className="role-back"
              onClick={() => {
                setScreen('choose')
                setNotice('')
                setPassword('')
              }}
            >
              ← Back to role selection
            </button>

            <h1>
              {screen === 'admin'
                ? 'Administrator login'
                : mode === 'register'
                  ? 'Create customer account'
                  : 'Customer login'}
            </h1>

            <p className="role-subtitle">
              {screen === 'admin'
                ? 'Sign in with your authorized administrator account.'
                : mode === 'register'
                  ? 'Register to access VoltWise charging services.'
                  : 'Sign in to access your charging dashboard.'}
            </p>

            {screen === 'customer' && mode === 'register' && (
              <label>
                Full name
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Enter your name"
                  autoComplete="name"
                  required
                  maxLength={100}
                />
              </label>
            )}

            <label>
              Email address
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="username"
                required
                maxLength={100}
              />
            </label>

            <label>
              Password
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter password"
                autoComplete={
                  mode === 'register' ? 'new-password' : 'current-password'
                }
                minLength={mode === 'register' ? 8 : undefined}
                maxLength={72}
                required
              />
            </label>

            <button className="role-submit" type="submit" disabled={loading}>
              {loading
                ? 'Please wait...'
                : screen === 'admin'
                  ? 'Sign in as administrator'
                  : mode === 'register'
                    ? 'Create account'
                    : 'Sign in'}
            </button>

            {screen === 'customer' && (
              <p className="role-footnote">
                {mode === 'login'
                  ? "New to VoltWise? "
                  : 'Already registered? '}
                <button
                  type="button"
                  className="role-back"
                  onClick={() => {
                    setMode(mode === 'login' ? 'register' : 'login')
                    setNotice('')
                  }}
                >
                  {mode === 'login' ? 'Create an account' : 'Sign in'}
                </button>
              </p>
            )}

            {notice && (
              <p className="role-notice" role="alert">
                {notice}
              </p>
            )}
          </form>
        )}
      </section>
    </main>
  )
}


function AdminDemo({ onBack }) {
  const [showBookings, setShowBookings] = useState(false)
  const [adminBookings, setAdminBookings] = useState([])
  const [bookingsError, setBookingsError] = useState('')
  const [bookingsLoading, setBookingsLoading] = useState(false)

  const loadAdminBookings = async () => {
    setBookingsLoading(true)
    setBookingsError('')

    try {
      const token = sessionStorage.getItem('voltwise_token')

      const response = await fetch('http://localhost:5000/api/bookings', {
        cache: 'no-store',
        headers: {
          Authorization: `Bearer ${token}`,
          'Cache-Control': 'no-cache'
        }
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Could not load bookings')
      }

      setAdminBookings(data)
      setShowBookings(true)
    } catch (error) {
      setBookingsError(error.message)
    } finally {
      setBookingsLoading(false)
    }
  }

  const [showStations, setShowStations] = useState(false)
  const [adminStations, setAdminStations] = useState([])
  const [stationsLoading, setStationsLoading] = useState(false)
  const [stationsError, setStationsError] = useState('')

  const loadAdminStations = async () => {
    setStationsLoading(true)
    setStationsError('')

    try {
      const response = await fetch('http://localhost:5000/api/stations', {
        cache: 'no-store'
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Could not load stations')
      }

      setAdminStations(data)
      setShowStations(true)
    } catch (error) {
      setStationsError(error.message)
    } finally {
      setStationsLoading(false)
    }
  }
const [energyData, setEnergyData] = useState(null)
const [energyLoading, setEnergyLoading] = useState(false)
const [energyError, setEnergyError] = useState('')

const loadEnergyData = async () => {
  setEnergyLoading(true)
  setEnergyError('')

  try {
    const response = await fetch('http://localhost:5000/api/energy', {
      cache: 'no-store'
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || 'Could not load energy data')
    }

    setEnergyData(data)
  } catch (error) {
    setEnergyError(error.message)
  } finally {
    setEnergyLoading(false)
  }
}
  return (

    <main className="admin-demo">
      <header>
        <div>
          <p className="role-eyebrow">VOLTWISE CONTROL CENTRE</p>
          <h1>Administrator dashboard</h1>
          <p>Welcome to VoltWise management.</p>
        </div>
        <button onClick={onBack}>Sign out</button>
      </header>

      
<div className="admin-cards">
  <article
    onClick={loadAdminStations}
    role="button"
    tabIndex={0}
    className="admin-card"
  >
    <span>⚡</span>
    <h2>Charging stations</h2>
    <p>Manage station locations and capacity.</p>
    <small>Open station management</small>
  </article>

  <article
    onClick={() => {
  console.log('Admin Bookings card clicked')
  loadAdminBookings()
}}
    role="button"
    tabIndex={0}
    className="admin-card"
  >
    <span>▣</span>
    <h2>Bookings</h2>
    <p>Review customer reservations.</p>
    <small>Open booking management</small>
  </article>

  <article
    onClick={loadEnergyData}
    role="button"
    tabIndex={0}
    className="admin-card"
  >
    <span>ϟ</span>
    <h2>Energy &amp; tariffs</h2>
    <p>Review charging activity and pricing.</p>
    <small>Open energy management</small>
  </article>
</div>

{stationsLoading && <p>Loading charging stations...</p>}

{stationsError && <p role="alert">{stationsError}</p>}

{showStations && (
  <section className="admin-bookings">
    <h2>Charging Station Management</h2>

    {adminStations.length === 0 ? (
      <p>No charging stations found.</p>
    ) : (
      adminStations.map((station) => (
        <article key={station.station_id}>
          <h3>{station.station_name}</h3>
          <p>Location: {station.location}</p>
          <p>Maximum power: {station.max_power_kw} kW</p>
          <p>
            Connectors: {station.active_connectors} active / {station.total_connectors} total
          </p>
          <p>
            Price: {station.price_per_kwh != null
              ? `₹${Number(station.price_per_kwh).toFixed(2)} / kWh`
              : 'Price unavailable'}
          </p>
        </article>
      ))
    )}
  </section>
)}

{energyLoading && <p>Loading energy data...</p>}

{energyError && <p role="alert">{energyError}</p>}

{energyData && (
  <section className="admin-bookings">
    <h2>Energy &amp; Tariffs Overview</h2>

    <article>
      <h3>Total charging capacity</h3>
      <p>{Number(energyData.total_capacity_kw).toFixed(2)} kW</p>
    </article>

    <article>
      <h3>Current energy load</h3>
      <p>{Number(energyData.current_load_kw).toFixed(2)} kW</p>
    </article>

    <article>
      <h3>Capacity utilization</h3>
      <p>{Number(energyData.utilization_percent).toFixed(2)}%</p>
    </article>
  </section>
)}


{bookingsLoading && <p>Loading bookings...</p>}

{bookingsError && <p role="alert">{bookingsError}</p>}

{showBookings && (
  <section className="admin-bookings">
    <h2>All Customer Bookings</h2>

    {adminBookings.length === 0 ? (
      <p>No bookings found.</p>
    ) : (
      adminBookings.map((booking) => (
        <article key={booking.booking_id}>
          <h3>{booking.station_name}</h3>
          <p>Booking ID: {booking.booking_id}</p>
          <p>Customer: {booking.user_name || booking.user_id}</p>
          <p>Connector: {booking.connector_type}</p>
          <p>Status: {booking.status}</p>
          <p>Start: {new Date(booking.start_time).toLocaleString()}</p>
          <p>End: {new Date(booking.end_time).toLocaleString()}</p>
        </article>
      ))
    )}
  </section>
)}


    </main>
  )
}
