const express = require('express');
const { body, validationResult } = require('express-validator');
const pool = require('../config/db');
const { requireAuth } = require('../middleware/authMiddleware');

const router = express.Router();

router.post(
  '/',
  requireAuth,
  [
    body('name').notEmpty(),
    body('contribution_amount').isFloat({ gt: 0 }),
    body('currency').notEmpty(),
    body('max_members').isInt({ min: 2 }),
    body('cycle_days').optional().isInt({ min: 1 }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { name, contribution_amount, currency, max_members, cycle_days } = req.body;

    try {
      const result = await pool.query(
        `INSERT INTO groups (name, contribution_amount, currency, cycle_type, cycle_days, max_members, created_by)
         VALUES ($1, $2, $3, 'weekly', $4, $5, $6) RETURNING *`,
        [name, contribution_amount, currency, cycle_days || 7, max_members, req.user.id]
      );
      const group = result.rows[0];

      await pool.query(
        `INSERT INTO group_members (group_id, user_id, payout_position) VALUES ($1, $2, 1)`,
        [group.id, req.user.id]
      );

      res.status(201).json(group);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Could not create group' });
    }
  }
);

router.post('/:groupId/join', requireAuth, async (req, res) => {
  const { groupId } = req.params;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const groupResult = await client.query('SELECT * FROM groups WHERE id = $1 FOR UPDATE', [groupId]);
    const group = groupResult.rows[0];
    if (!group) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Group not found' });
    }
    if (group.status !== 'forming') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Group is no longer accepting members' });
    }

    const countResult = await client.query('SELECT COUNT(*) FROM group_members WHERE group_id = $1', [groupId]);
    const currentCount = parseInt(countResult.rows[0].count, 10);
    if (currentCount >= group.max_members) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Group is full' });
    }

    const nextPosition = currentCount + 1;
    await client.query(
      `INSERT INTO group_members (group_id, user_id, payout_position) VALUES ($1, $2, $3)`,
      [groupId, req.user.id, nextPosition]
    );

    let updatedGroup = group;
    if (nextPosition === group.max_members) {
      const activateResult = await client.query(
        `UPDATE groups SET status = 'active', current_round = 1, starts_at = NOW() WHERE id = $1 RETURNING *`,
        [groupId]
      );
      updatedGroup = activateResult.rows[0];
    }

    await client.query('COMMIT');
    res.json({ joined: true, payout_position: nextPosition, group: updatedGroup });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Could not join group' });
  } finally {
    client.release();
  }
});

router.get('/open', requireAuth, async (req, res) => {
  const result = await pool.query(`SELECT * FROM groups WHERE status = 'forming' ORDER BY created_at DESC`);
  res.json(result.rows);
});

router.get('/:groupId', requireAuth, async (req, res) => {
  const { groupId } = req.params;
  const group = await pool.query('SELECT * FROM groups WHERE id = $1', [groupId]);
  if (!group.rows.length) return res.status(404).json({ error: 'Group not found' });

  const members = await pool.query(
    `SELECT gm.payout_position, gm.has_been_paid, u.id AS user_id, u.full_name
     FROM group_members gm JOIN users u ON u.id = gm.user_id
     WHERE gm.group_id = $1 ORDER BY gm.payout_position ASC`,
    [groupId]
  );

  res.json({ ...group.rows[0], members: members.rows });
});

module.exports = router;
