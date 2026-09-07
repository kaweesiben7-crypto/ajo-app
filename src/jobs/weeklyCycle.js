const cron = require('node-cron');
const { v4: uuidv4 } = require('uuid');
const pool = require('../config/db');
const gateway = require('../services/paymentGateway');

async function disburseRoundPayout(groupId) {
  const groupResult = await pool.query('SELECT * FROM groups WHERE id = $1', [groupId]);
  const group = groupResult.rows[0];
  if (!group) throw new Error('Group not found');
  if (group.status !== 'active') throw new Error('Group is not active');

  const membersResult = await pool.query(
    'SELECT COUNT(*) FROM group_members WHERE group_id = $1',
    [groupId]
  );
  const totalMembers = parseInt(membersResult.rows[0].count, 10);

  const contributionsResult = await pool.query(
    `SELECT COUNT(*) FROM contributions
     WHERE group_id = $1 AND round_number = $2 AND status = 'successful'`,
    [groupId, group.current_round]
  );
  const paidCount = parseInt(contributionsResult.rows[0].count, 10);

  if (paidCount < totalMembers) {
    throw new Error(
      `Not all members have contributed yet (${paidCount}/${totalMembers}). Payout withheld.`
    );
  }

  const recipientResult = await pool.query(
    `SELECT gm.*, u.full_name, u.phone_number, u.provider
     FROM group_members gm JOIN users u ON u.id = gm.user_id
     WHERE gm.group_id = $1 AND gm.payout_position = $2`,
    [groupId, group.current_round]
  );
  const recipient = recipientResult.rows[0];
  if (!recipient) throw new Error('No recipient found for this round');

  const totalPool = parseFloat(group.contribution_amount) * totalMembers;
  const externalId = uuidv4();

  const reference = await gateway.disburse({
    provider: recipient.provider,
    phoneNumber: recipient.phone_number,
    amount: totalPool,
    externalId,
    note: `${group.name} - Round ${group.current_round} payout`,
  });

  await pool.query(
    `INSERT INTO payouts (group_id, recipient_user_id, round_number, amount, provider, provider_reference, status, disbursed_at)
     VALUES ($1, $2, $3, $4, $5, $6, 'pending', NOW())`,
    [groupId, recipient.user_id, group.current_round, totalPool, recipient.provider, reference]
  );

  await pool.query('UPDATE group_members SET has_been_paid = TRUE WHERE id = $1', [recipient.id]);

  const isLastRound = group.current_round >= totalMembers;
  if (isLastRound) {
    await pool.query(`UPDATE groups SET status = 'completed' WHERE id = $1`, [groupId]);
  } else {
    await pool.query('UPDATE groups SET current_round = current_round + 1 WHERE id = $1', [groupId]);
  }

  return { recipient: recipient.full_name, amount: totalPool, reference, group_completed: isLastRound };
}

function scheduleWeeklyCycleJob() {
  cron.schedule('0 * * * *', async () => {
    try {
      const activeGroups = await pool.query(`SELECT * FROM groups WHERE status = 'active'`);
      for (const group of activeGroups.rows) {
        try {
          const result = await disburseRoundPayout(group.id);
          console.log(`[weeklyCycle] Group ${group.id} round paid out:`, result);
        } catch (err) {
          console.log(`[weeklyCycle] Group ${group.id} skipped: ${err.message}`);
        }
      }
    } catch (err) {
      console.error('[weeklyCycle] job error:', err);
    }
  });
}

module.exports = { disburseRoundPayout, scheduleWeeklyCycleJob };
