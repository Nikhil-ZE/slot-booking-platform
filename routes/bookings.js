const express = require('express');
const router = express.Router();
const { sendBookingConfirmation } = require('../mailer');

module.exports = (pool) => {
  router.post('/', async (req, res) => {
    const client = await pool.connect();
    try {
      const { slot_id, patient_name, patient_age, patient_address, patient_email, payment_type } = req.body;

      if (!slot_id || !patient_name || !patient_age || !patient_address || !patient_email || !payment_type) {
        return res.status(400).json({ error: 'All fields are required' });
      }

      await client.query('BEGIN');

      // Lock the slot row and check it's still open, and grab doctor info for the email
      const slotResult = await client.query(
        `SELECT s.*, u.name AS doctor_name
         FROM slots s
         JOIN doctors d ON s.doctor_id = d.id
         JOIN users u ON d.user_id = u.id
         WHERE s.id = $1 AND s.status = 'open'
         FOR UPDATE OF s`,
        [slot_id]
      );

      if (slotResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'This slot is no longer available' });
      }

      const slot = slotResult.rows[0];

      // Mark slot as booked
      await client.query(`UPDATE slots SET status = 'booked' WHERE id = $1`, [slot_id]);

      // Create the booking
      const bookingResult = await client.query(
        `INSERT INTO bookings (slot_id, patient_id, patient_name, patient_age, patient_address, patient_email, payment_type, status)
         VALUES ($1, NULL, $2, $3, $4, $5, $6, 'confirmed')
         RETURNING *`,
        [slot_id, patient_name, patient_age, patient_address, patient_email, payment_type]
      );

      await client.query('COMMIT');

      // Send confirmation email (don't block the response if this fails)
      sendBookingConfirmation({
        to: patient_email,
        patientName: patient_name,
        doctorName: slot.doctor_name,
        slotDate: slot.slot_date,
        startTime: slot.start_time,
        endTime: slot.end_time,
      }).catch((err) => console.error('Email send failed:', err));

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