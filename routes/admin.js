const express = require('express');
const router = express.Router();
const requireAdmin = require('../middleware/requireAdmin');

module.exports = (pool) => {
  // GET all users
  router.get('/users', requireAdmin, async (req, res) => {
    try {
      const result = await pool.query(
        'SELECT id, name, email, role, created_at FROM users ORDER BY created_at DESC'
      );
      res.json(result.rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  });

  // DELETE a user (also removes their doctor profile / bookings via cascade)
  router.delete('/users/:id', requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      await pool.query('DELETE FROM users WHERE id = $1', [id]);
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  });

  // GET all doctors (with specialty/bio)
  router.get('/doctors', requireAdmin, async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT d.id, u.id AS user_id, u.name, u.email, d.specialty, d.bio
        FROM doctors d
        JOIN users u ON d.user_id = u.id
        ORDER BY u.name
      `);
      res.json(result.rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  });

  // GET all bookings across every doctor
  router.get('/bookings', requireAdmin, async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT b.id, b.patient_name, b.patient_age, b.patient_email, b.payment_type, b.status,
               s.slot_date, s.start_time, s.end_time,
               du.name AS doctor_name
        FROM bookings b
        JOIN slots s ON b.slot_id = s.id
        JOIN doctors d ON s.doctor_id = d.id
        JOIN users du ON d.user_id = du.id
        ORDER BY s.slot_date DESC, s.start_time DESC
      `);
      res.json(result.rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  });

  // DELETE a booking (also frees up the slot again)
  router.delete('/bookings/:id', requireAdmin, async (req, res) => {
    const client = await pool.connect();
    try {
      const { id } = req.params;
      await client.query('BEGIN');

      const bookingResult = await client.query('SELECT slot_id FROM bookings WHERE id = $1', [id]);
      if (bookingResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Booking not found' });
      }

      const { slot_id } = bookingResult.rows[0];
      await client.query('DELETE FROM bookings WHERE id = $1', [id]);
      await client.query(`UPDATE slots SET status = 'open' WHERE id = $1`, [slot_id]);

      await client.query('COMMIT');
      res.json({ success: true });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(err);
      res.status(500).json({ error: err.message });
    } finally {
      client.release();
    }
  });

  return router;
};