require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const app = express();
const bookingsRouter = require('./routes/bookings')(pool);
app.use('/bookings', bookingsRouter);
app.use(cors());
app.use(express.json());
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});
const doctorsRouter = require('./routes/doctors')(pool);
app.use('/doctors', doctorsRouter);
app.get('/test-db', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({ success: true, time: result.rows[0].now });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
const authRouter = require('./routes/auth')(pool);
app.use('/auth', authRouter);