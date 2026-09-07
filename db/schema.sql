CREATE TABLE IF NOT EXISTS users (
    id              SERIAL PRIMARY KEY,
    full_name       VARCHAR(120) NOT NULL,
    phone_number    VARCHAR(20) UNIQUE NOT NULL,
    provider        VARCHAR(10) NOT NULL CHECK (provider IN ('mtn', 'airtel')),
    password_hash   VARCHAR(255) NOT NULL,
    referred_by     INTEGER REFERENCES users(id),
    created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS groups (
    id                  SERIAL PRIMARY KEY,
    name                VARCHAR(120) NOT NULL,
    contribution_amount NUMERIC(12,2) NOT NULL,
    currency            VARCHAR(5) NOT NULL DEFAULT 'UGX',
    cycle_type          VARCHAR(10) NOT NULL DEFAULT 'weekly' CHECK (cycle_type IN ('weekly','monthly','custom')),
    cycle_days          INTEGER NOT NULL DEFAULT 7,
    max_members         INTEGER NOT NULL,
    status              VARCHAR(15) NOT NULL DEFAULT 'forming' CHECK (status IN ('forming','active','completed','cancelled')),
    current_round       INTEGER NOT NULL DEFAULT 0,
    created_by          INTEGER REFERENCES users(id),
    starts_at           TIMESTAMP,
    created_at          TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS group_members (
    id              SERIAL PRIMARY KEY,
    group_id        INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    user_id         INTEGER NOT NULL REFERENCES users(id),
    payout_position INTEGER NOT NULL,
    has_been_paid   BOOLEAN NOT NULL DEFAULT FALSE,
    joined_at       TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (group_id, user_id),
    UNIQUE (group_id, payout_position)
);

CREATE TABLE IF NOT EXISTS contributions (
    id                  SERIAL PRIMARY KEY,
    group_id            INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    user_id             INTEGER NOT NULL REFERENCES users(id),
    round_number        INTEGER NOT NULL,
    amount              NUMERIC(12,2) NOT NULL,
    provider             VARCHAR(10) NOT NULL CHECK (provider IN ('mtn','airtel')),
    provider_reference  VARCHAR(100),
    status              VARCHAR(15) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','successful','failed')),
    requested_at        TIMESTAMP NOT NULL DEFAULT NOW(),
    confirmed_at        TIMESTAMP,
    UNIQUE (group_id, user_id, round_number)
);

CREATE TABLE IF NOT EXISTS payouts (
    id                  SERIAL PRIMARY KEY,
    group_id            INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    recipient_user_id   INTEGER NOT NULL REFERENCES users(id),
    round_number        INTEGER NOT NULL,
    amount              NUMERIC(12,2) NOT NULL,
    provider            VARCHAR(10) NOT NULL CHECK (provider IN ('mtn','airtel')),
    provider_reference  VARCHAR(100),
    status              VARCHAR(15) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','successful','failed')),
    disbursed_at        TIMESTAMP,
    UNIQUE (group_id, round_number)
);

CREATE TABLE IF NOT EXISTS referral_rewards (
    id              SERIAL PRIMARY KEY,
    referrer_id     INTEGER NOT NULL REFERENCES users(id),
    referred_id     INTEGER NOT NULL REFERENCES users(id),
    reward_type     VARCHAR(20) NOT NULL DEFAULT 'fee_rebate',
    reward_amount   NUMERIC(12,2) NOT NULL DEFAULT 0,
    triggered_by    VARCHAR(50),
    created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contributions_group_round ON contributions(group_id, round_number);
CREATE INDEX IF NOT EXISTS idx_group_members_group ON group_members(group_id);
