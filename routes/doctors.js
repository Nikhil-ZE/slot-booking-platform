const express = require('express');
const router = express.Router();

module.exports = (pool) => {
  // GET all doctors with their specialty
  router.get('/', async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT d.id, u.name, d.specialty, d.bio
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

  // GET open slots for one doctor
  router.get('/:id/slots', async (req, res) => {
    try {
      const { id } = req.params;
      const result = await pool.query(
        `SELECT id, slot_date, start_time, end_time
         FROM slots
         WHERE doctor_id = $1 AND status = 'open'
         ORDER BY slot_date, start_time`,
        [id]
      );
      res.json(result.rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};