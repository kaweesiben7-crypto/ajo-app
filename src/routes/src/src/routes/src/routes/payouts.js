const express = require('express');
const pool = require('../config/db');
const { requireAuth } = require('../middleware/authMiddleware');
const { disburseRoundPayout } = require('../jobs/weeklyCycle');

const router = express.Router();

router.post('/:groupId/trigger', requireAuth, async (req, res) => {
  const { groupId } = req.params;
  try {
    const result = await disburseRoundPayout(groupId);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: err.message });
  }
});

router.get('/:groupId/history', requireAuth, async (req, res) => {
  const { groupId } = req.params;
  const result = await pool.query(
    `SELECT p.*, u.full_name FROM payouts p JOIN users u ON u.id = p.recipient_user_id
     WHERE p.group_id = $1 ORDER BY p.round_number ASC`,
    [groupId]
  );
  res.json(result.rows);
});

module.exports = router;
