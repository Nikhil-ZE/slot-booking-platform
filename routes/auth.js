const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const router = express.Router();
const { sendOtpEmail } = require('../mailer');

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit code
}

module.exports = (pool) => {
  // Register
  router.post('/register', async (req, res) => {
    const client = await pool.connect();
    try {
      const { name, email, password, role, specialty, bio } = req.body;

      if (!name || !email || !password || !role) {
        return res.status(400).json({ error: 'All fields are required' });
      }

      if (role === 'doctor' && !specialty) {
        return res.status(400).json({ error: 'Specialty is required for doctors' });
      }

      const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
      if (existing.rows.length > 0) {
        return res.status(409).json({ error: 'Email already registered' });
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const otp = generateOtp();
      const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now

      await client.query('BEGIN');

      const userResult = await client.query(
        `INSERT INTO users (name, email, password_hash, role, otp_code, otp_expires_at, is_verified)
         VALUES ($1, $2, $3, $4, $5, $6, false)
         RETURNING id, name, email, role`,
        [name, email, passwordHash, role, otp, otpExpiresAt]
      );
      const user = userResult.rows[0];

      if (role === 'doctor') {
        await client.query(
          'INSERT INTO doctors (user_id, specialty, bio) VALUES ($1, $2, $3)',
          [user.id, specialty, bio || '']
        );
      }

      await client.query('COMMIT');

      sendOtpEmail({ to: email, name, otp }).catch((err) => console.error('OTP email failed:', err));

      // No token yet — they must verify first
      res.status(201).json({ message: 'Registered. Please check your email for a verification code.', email: user.email });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(err);
      res.status(500).json({ error: err.message });
    } finally {
      client.release();
    }
  });

  // Verify OTP
  router.post('/verify-otp', async (req, res) => {
    try {
      const { email, otp } = req.body;

      if (!email || !otp) {
        return res.status(400).json({ error: 'Email and code are required' });
      }

      const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Account not found' });
      }

      const user = result.rows[0];

      if (user.is_verified) {
        return res.status(400).json({ error: 'Account already verified' });
      }

      if (user.otp_code !== otp) {
        return res.status(400).json({ error: 'Incorrect code' });
      }

      if (new Date() > new Date(user.otp_expires_at)) {
        return res.status(400).json({ error: 'Code has expired. Please request a new one.' });
      }

      await pool.query(
        'UPDATE users SET is_verified = true, otp_code = NULL, otp_expires_at = NULL WHERE id = $1',
        [user.id]
      );

      const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });

      res.json({
        user: { id: user.id, name: user.name, email: user.email, role: user.role },
        token,
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  });

  // Resend OTP
  router.post('/resend-otp', async (req, res) => {
    try {
      const { email } = req.body;
      const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Account not found' });
      }

      const user = result.rows[0];
      if (user.is_verified) {
        return res.status(400).json({ error: 'Account already verified' });
      }

      const otp = generateOtp();
      const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

      await pool.query('UPDATE users SET otp_code = $1, otp_expires_at = $2 WHERE id = $3', [otp, otpExpiresAt, user.id]);

      sendOtpEmail({ to: email, name: user.name, otp }).catch((err) => console.error('OTP email failed:', err));

      res.json({ message: 'A new code has been sent.' });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  });

  // Login
  router.post('/login', async (req, res) => {
    try {
      const { email, password } = req.body;

      const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
      if (result.rows.length === 0) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      const user = result.rows[0];
      const validPassword = await bcrypt.compare(password, user.password_hash);
      if (!validPassword) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      if (!user.is_verified) {
        return res.status(403).json({ error: 'Please verify your email before logging in', needsVerification: true, email: user.email });
      }

      const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });

      res.json({
        user: { id: user.id, name: user.name, email: user.email, role: user.role },
        token
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};