const express = require('express');
const { body, validationResult } = require('express-validator');
const pool = require('../config/db');
const { hashPassword, comparePassword, signToken } = require('../utils/auth');

const router = express.Router();

router.post(
  '/register',
  [
    body('full_name').notEmpty(),
    body('phone_number').isMobilePhone('any'),
    body('provider').isIn(['mtn', 'airtel']),
    body('password').isLength({ min: 6 }),
    body('referral_code').optional().isInt(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { full_name, phone_number, provider, password, referral_code } = req.body;

    try {
      const existing = await pool.query('SELECT id FROM users WHERE phone_number = $1', [phone_number]);
      if (existing.rows.length) {
        return res.status(409).json({ error: 'Phone number already registered' });
      }

      const password_hash = await hashPassword(password);
      const result = await pool.query(
        `INSERT INTO users (full_name, phone_number, provider, password_hash, referred_by)
         VALUES ($1, $2, $3, $4, $5) RETURNING id, full_name, phone_number, provider`,
        [full_name, phone_number, provider, password_hash, referral_code || null]
      );

      const user = result.rows[0];
      const token = signToken(user);
      res.status(201).json({ user, token });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Registration failed' });
    }
  }
);

router.post(
  '/login',
  [body('phone_number').notEmpty(), body('password').notEmpty()],
  async (req, res) => {
    const { phone_number, password } = req.body;
    try {
      const result = await pool.query('SELECT * FROM users WHERE phone_number = $1', [phone_number]);
      const user = result.rows[0];
      if (!user || !(await comparePassword(password, user.password_hash))) {
        return res.status(401).json({ error: 'Invalid phone number or password' });
      }
      const token = signToken(user);
      res.json({
        user: { id: user.id, full_name: user.full_name, phone_number: user.phone_number, provider: user.provider },
        token,
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Login failed' });
    }
  }
);

module.exports = router;
