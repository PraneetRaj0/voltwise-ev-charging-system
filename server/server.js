
import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import pool from './db.js'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'

dotenv.config({ path: '../.env' })

const app = express()

app.use(cors())
app.use(express.json())

app.get('/', (req, res) => {
  res.json({ message: 'VoltWise API is running!' })
})

app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1')
    res.json({ api: 'running', database: 'connected' })
  } catch (error) {
    console.error('Database connection failed:', error.message)
    res.status(500).json({ api: 'running', database: 'disconnected' })
  }
})

app.get('/api/stations', async (req, res) => {
  try {
    const [stations] = await pool.query(`
      SELECT
        s.station_id,
        s.station_name,
        s.location,
        s.max_power_kw,
        t.price_per_kwh,
        COUNT(c.connector_id) AS total_connectors,
        SUM(CASE WHEN c.status = 'active' THEN 1 ELSE 0 END) AS active_connectors
      FROM stations s
      LEFT JOIN tariffs t ON s.station_id = t.station_id
      LEFT JOIN connectors c ON s.station_id = c.station_id
      GROUP BY
        s.station_id,
        s.station_name,
        s.location,
        s.max_power_kw,
        t.price_per_kwh
      ORDER BY s.station_id
    `)

    res.json(stations)
  } catch (error) {
    console.error('Could not fetch stations:', error.message)
    res.status(500).json({ error: 'Could not fetch stations' })
  }
})



app.get('/api/bookings', requireAuth, async (req, res) => {
  console.log('Bookings request:', {
  user_id: req.auth.user_id,
  role: req.auth.role
})
  try {
    let bookings

    if (req.auth.role === 'admin') {
      ;[bookings] = await pool.query(`
        SELECT
          b.booking_id,
          b.user_id,
          u.name AS user_name,
          b.connector_id,
          s.station_name,
          c.connector_type,
          b.start_time,
          b.end_time,
          b.requested_power_kw,
          b.status
        FROM bookings b
        JOIN users u ON b.user_id = u.user_id
        JOIN connectors c ON b.connector_id = c.connector_id
        JOIN stations s ON c.station_id = s.station_id
        ORDER BY b.start_time DESC
      `)
    } else {
      ;[bookings] = await pool.query(`
        SELECT
          b.booking_id,
          b.user_id,
          u.name AS user_name,
          b.connector_id,
          s.station_name,
          c.connector_type,
          b.start_time,
          b.end_time,
          b.requested_power_kw,
          b.status
        FROM bookings b
        JOIN users u ON b.user_id = u.user_id
        JOIN connectors c ON b.connector_id = c.connector_id
        JOIN stations s ON c.station_id = s.station_id
        WHERE b.user_id = ?
        ORDER BY b.start_time DESC
      `, [req.auth.user_id])
    }

    res.json(bookings)
  } catch (error) {
    console.error('Could not fetch bookings:', error.message)
    res.status(500).json({ error: 'Could not fetch bookings' })
  }
})


app.post('/api/bookings', requireAuth, async (req, res) => {
  const {
  connector_id,
  start_time,
  end_time,
  requested_power_kw
} = req.body

const user_id = req.auth.user_id

  if (!user_id || !connector_id || !start_time ||
      !end_time || !requested_power_kw) {
    return res.status(400).json({
      error: 'Please fill in all booking fields'
    })
  }

  if (
    Number.isNaN(Date.parse(start_time)) ||
    Number.isNaN(Date.parse(end_time)) ||
    new Date(start_time) >= new Date(end_time)
  ) {
    return res.status(400).json({
      error: 'Please provide valid start and end times'
    })
  }

  try {
    const [users] = await pool.query(
      'SELECT user_id FROM users WHERE user_id = ?',
      [user_id]
    )

    if (users.length === 0) {
      return res.status(400).json({ error: 'User not found' })
    }

    const [connectors] = await pool.query(
      `SELECT connector_id, power_kw, status
       FROM connectors
       WHERE connector_id = ?`,
      [connector_id]
    )

    if (!connectors.length || connectors[0].status !== 'active') {
      return res.status(400).json({
        error: 'Connector not found or inactive'
      })
    }

    if (Number(requested_power_kw) > Number(connectors[0].power_kw)) {
      return res.status(400).json({
        error: 'Requested power exceeds connector capacity'
      })
    }

    const [conflicts] = await pool.query(
      `SELECT booking_id
       FROM bookings
       WHERE connector_id = ?
         AND status = 'confirmed'
         AND start_time < ?
         AND end_time > ?`,
      [connector_id, end_time, start_time]
    )

    if (conflicts.length > 0) {
      return res.status(409).json({
        error: 'This connector is already booked for that time'
      })
    }

    const [result] = await pool.query(
      `INSERT INTO bookings
       (user_id, connector_id, start_time, end_time,
        requested_power_kw, status)
       VALUES (?, ?, ?, ?, ?, 'confirmed')`,
      [user_id, connector_id, start_time, end_time, requested_power_kw]
    )

    res.status(201).json({
      message: 'Booking created successfully',
      booking_id: result.insertId
    })
  } catch (error) {
    console.error('Could not create booking:', error.message)
    res.status(500).json({ error: 'Could not create booking' })
  }
})


app.patch('/api/bookings/:id/cancel', requireAuth, async (req, res) => {
  const bookingId = Number(req.params.id)

  if (!Number.isInteger(bookingId) || bookingId < 1) {
    return res.status(400).json({ error: 'Invalid booking ID' })
  }

  try {
    const [result] = await pool.query(
    `UPDATE bookings
 SET status = 'cancelled'
 WHERE booking_id = ?
   AND status = 'confirmed'
   AND start_time > NOW()
   AND (? = 'admin' OR user_id = ?)` ,
      [bookingId, req.auth.role, req.auth.user_id]
    )

    if (result.affectedRows === 0) {
      return res.status(400).json({
        error: 'Booking not found, already cancelled, or already started'
      })
    }

    res.json({ message: 'Booking cancelled successfully' })
  } catch (error) {
    console.error('Could not cancel booking:', error.message)
    res.status(500).json({ error: 'Could not cancel booking' })
  }
})

app.get('/api/energy', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        COALESCE(SUM(s.max_power_kw), 0) AS total_capacity_kw,
        COALESCE((
          SELECT SUM(b.requested_power_kw)
          FROM bookings b
          WHERE b.status = 'confirmed'
            AND b.start_time <= NOW()
            AND b.end_time > NOW()
        ), 0) AS current_load_kw
      FROM stations s
    `)

    const capacity = Number(rows[0].total_capacity_kw)
    const load = Number(rows[0].current_load_kw)

    res.json({
      total_capacity_kw: capacity,
      current_load_kw: load,
      utilization_percent: capacity > 0
        ? Math.round((load / capacity) * 100)
        : 0
    })
  } catch (error) {
    console.error('Could not fetch energy data:', error.message)
    res.status(500).json({ error: 'Could not fetch energy data' })
  }
})


function createToken(user) {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is missing from .env')
  }

  return jwt.sign(
    { user_id: user.user_id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '2h' }
  )
}

function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7)
    : null

  if (!token) {
    return res.status(401).json({ error: 'Please log in first' })
  }

  try {
    req.auth = jwt.verify(token, process.env.JWT_SECRET)
    next()
  } catch {
    return res.status(401).json({ error: 'Invalid or expired login' })
  }
}

function requireAdmin(req, res, next) {
  if (req.auth?.role !== 'admin') {
    return res.status(403).json({ error: 'Administrator access required' })
  }
  next()
}

app.post('/api/auth/register', async (req, res) => {
  const { name, email, password } = req.body

  if (
    typeof name !== 'string' ||
    typeof email !== 'string' ||
    typeof password !== 'string' ||
    !name.trim() ||
    !email.trim() ||
    password.length < 8 ||
    password.length > 72
  ) {
    return res.status(400).json({
      error: 'Enter your name, email, and a password of 8–72 characters'
    })
  }

  try {
    const normalizedEmail = email.trim().toLowerCase()
    const [existing] = await pool.query(
      'SELECT user_id FROM users WHERE email = ?',
      [normalizedEmail]
    )

    if (existing.length) {
      return res.status(409).json({ error: 'Email is already registered' })
    }

    const passwordHash = await bcrypt.hash(password, 12)
    const [result] = await pool.query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES (?, ?, ?, 'user')`,
      [name.trim(), normalizedEmail, passwordHash]
    )

    res.status(201).json({
      message: 'Customer account created successfully',
      user_id: result.insertId
    })
  } catch (error) {
    console.error('Registration failed:', error.message)
    res.status(500).json({ error: 'Could not create account' })
  }
})

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body

  if (
    typeof email !== 'string' ||
    typeof password !== 'string' ||
    !email.trim() ||
    !password
  ) {
    return res.status(400).json({ error: 'Enter your email and password' })
  }

  try {
    const [users] = await pool.query(
      `SELECT user_id, name, email, password_hash, role
       FROM users WHERE email = ?`,
      [email.trim().toLowerCase()]
    )

    if (!users.length) {
      return res.status(401).json({ error: 'Invalid email or password' })
    }

    const user = users[0]
    const matches = await bcrypt.compare(password, user.password_hash)

    if (!matches) {
      return res.status(401).json({ error: 'Invalid email or password' })
    }

    const token = createToken(user)
    res.json({
      message: 'Login successful',
      token,
      user: {
        user_id: user.user_id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    })
  } catch (error) {
    console.error('Login failed:', error.message)
    res.status(500).json({ error: 'Could not log in' })
  }
})

app.get('/api/admin/check', requireAuth, requireAdmin, (req, res) => {
  res.json({ message: 'Administrator access verified' })
})

const PORT = process.env.PORT || 5000

app.listen(PORT, () => {
  console.log(`VoltWise API running at http://localhost:${PORT}`)
})
