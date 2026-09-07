const express = require('express');
const { v4: uuidv4 } = require('uuid');
const pool = require('../config/db');
const { requireAuth } = require('../middleware/authMiddleware');
const gateway = require('../services/paymentGateway');

const router = express.Router();

router.post('/:groupId/pay', requireAuth, async (req, res) => {
  const { groupId } = req.params;

  try {
    const groupResult = await pool.query('SELECT * FROM groups WHERE id = $1', [groupId]);
    const group = groupResult.rows[0];
    if (!group || group.status !== 'active') {
      return res.status(400).json({ error: 'Group is not active' });
    }

    const memberResult = await pool.query(
      'SELECT * FROM group_members WHERE group_id = $1 AND user_id = $2',
      [groupId, req.user.id]
    );
    if (!memberResult.rows.length) {
      return res.status(403).json({ error: 'You are not a member of this group' });
    }

    const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
    const user = userResult.rows[0];

    const existing = await pool.query(
      'SELECT * FROM contributions WHERE group_id = $1 AND user_id = $2 AND round_number = $3',
      [groupId, req.user.id, group.current_round]
    );
    if (existing.rows.length && existing.rows[0].status === 'successful') {
      return res.status(400).json({ error: 'Already contributed this round' });
    }

    const externalId = uuidv4();
    const reference = await gateway.collect({
      provider: user.provider,
      phoneNumber: user.phone_number,
      amount: group.contribution_amount,
      externalId,
      note: `${group.name} - Round ${group.current_round}`,
    });

    await pool.query(
      `INSERT INTO contributions (group_id, user_id, round_number, amount, provider, provider_reference, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending')
       ON CONFLICT (group_id, user_id, round_number)
       DO UPDATE SET provider_reference = $6, status = 'pending', requested_at = NOW()`,
      [groupId, req.user.id, group.current_round, group.contribution_amount, user.provider, reference]
    );

    res.json({ message: 'Payment prompt sent to your phone', reference });
  } catch (err) {
    console.error(err.response?.data || err);
    res.status(500).json({ error: 'Could not initiate contribution payment' });
  }
});

router.get('/:groupId/status/:round', requireAuth, async (req, res) => {
  const { groupId, round } = req.params;

  try {
    const contribResult = await pool.query(
      'SELECT * FROM contributions WHERE group_id = $1 AND user_id = $2 AND round_number = $3',
      [groupId, req.user.id, round]
    );
    const contribution = contribResult.rows[0];
    if (!contribution) return res.status(404).json({ error: 'No contribution found for this round' });

    if (contribution.status === 'successful' || contribution.status === 'failed') {
      return res.json(contribution);
    }

    const status = await gateway.checkCollectionStatus({
      provider: contribution.provider,
      reference: contribution.provider_reference,
    });

    if (status !== 'pending') {
      const updated = await pool.query(
        `UPDATE contributions SET status = $1, confirmed_at = NOW() WHERE id = $2 RETURNING *`,
        [status, contribution.id]
      );
      return res.json(updated.rows[0]);
    }

    res.json(contribution);
  } catch (err) {
    console.error(err.response?.data || err);
    res.status(500).json({ error: 'Could not check contribution status' });
  }
});

module.exports = router;
