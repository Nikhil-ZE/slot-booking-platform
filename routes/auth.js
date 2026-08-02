const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const router = express.Router();

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

      await client.query('BEGIN');

      const userResult = await client.query(
        'INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, name, email, role',
        [name, email, passwordHash, role]
      );
      const user = userResult.rows[0];

      if (role === 'doctor') {
        await client.query(
          'INSERT INTO doctors (user_id, specialty, bio) VALUES ($1, $2, $3)',
          [user.id, specialty, bio || '']
        );
      }

      await client.query('COMMIT');

      const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
      res.status(201).json({ user, token });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(err);
      res.status(500).json({ error: err.message });
    } finally {
      client.release();
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