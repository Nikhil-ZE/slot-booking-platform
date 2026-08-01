const express = require('express');
const router = express.Router();

module.exports = (pool) => {
  router.post('/', async (req, res) => {
    const client = await pool.connect();
    try {
      const { slot_id, patient_name, patient_age, patient_address, payment_type } = req.body;

      if (!slot_id || !patient_name || !patient_age || !patient_address || !payment_type) {
        return res.status(400).json({ error: 'All fields are required' });
      }

      await client.query('BEGIN');

      // Lock the slot row and check it's still open
      const slotResult = await client.query(
        `SELECT * FROM slots WHERE id = $1 AND status = 'open' FOR UPDATE`,
        [slot_id]
      );

      if (slotResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'This slot is no longer available' });
      }

      // Mark slot as booked
      await client.query(`UPDATE slots SET status = 'booked' WHERE id = $1`, [slot_id]);

      // Create the booking (patient_id left null for now since we're not requiring login for this form)
      const bookingResult = await client.query(
        `INSERT INTO bookings (slot_id, patient_id, patient_name, patient_age, patient_address, payment_type, status)
         VALUES ($1, NULL, $2, $3, $4, $5, 'confirmed')
         RETURNING *`,
        [slot_id, patient_name, patient_age, patient_address, payment_type]
      );

      await client.query('COMMIT');
      res.status(201).json(bookingResult.rows[0]);
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