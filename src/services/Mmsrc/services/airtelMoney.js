const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const BASE_URL = process.env.AIRTEL_BASE_URL;
const COUNTRY = process.env.AIRTEL_COUNTRY;
const CURRENCY = process.env.AIRTEL_CURRENCY;

let cachedToken = null;
let tokenExpiresAt = 0;

async function getToken() {
  if (cachedToken && Date.now() < tokenExpiresAt) return cachedToken;

  const { data } = await axios.post(`${BASE_URL}/auth/oauth2/token`, {
    client_id: process.env.AIRTEL_CLIENT_ID,
    client_secret: process.env.AIRTEL_CLIENT_SECRET,
    grant_type: 'client_credentials',
  });

  cachedToken = data.access_token;
  tokenExpiresAt = Date.now() + (data.expires_in - 60) * 1000;
  return cachedToken;
}

async function requestContribution({ phoneNumber, amount, externalId, note }) {
  const token = await getToken();
  const transactionId = externalId || uuidv4();

  const { data } = await axios.post(
    `${BASE_URL}/merchant/v1/payments/`,
    {
      reference: note || 'Weekly savings contribution',
      subscriber: { country: COUNTRY, currency: CURRENCY, msisdn: phoneNumber },
      transaction: { amount, country: COUNTRY, currency: CURRENCY, id: transactionId },
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Country': COUNTRY,
        'X-Currency': CURRENCY,
        'Content-Type': 'application/json',
      },
    }
  );

  return data.data?.transaction?.id || transactionId;
}

async function checkContributionStatus(transactionId) {
  const token = await getToken();
  const { data } = await axios.get(
    `${BASE_URL}/standard/v1/payments/${transactionId}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Country': COUNTRY,
        'X-Currency': CURRENCY,
      },
    }
  );
  return data.data?.transaction?.status;
}

async function sendPayout({ phoneNumber, amount, externalId, note }) {
  const token = await getToken();
  const transactionId = externalId || uuidv4();

  const { data } = await axios.post(
    `${BASE_URL}/standard/v1/disbursements/`,
    {
      payee: { msisdn: phoneNumber },
      reference: note || 'Ajo group payout',
      pin: process.env.AIRTEL_DISBURSEMENT_PIN,
      transaction: { amount, id: transactionId },
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Country': COUNTRY,
        'X-Currency': CURRENCY,
        'Content-Type': 'application/json',
      },
    }
  );

  return data.data?.transaction?.id || transactionId;
}

async function checkPayoutStatus(transactionId) {
  const token = await getToken();
  const { data } = await axios.get(
    `${BASE_URL}/standard/v1/disbursements/${transactionId}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Country': COUNTRY,
        'X-Currency': CURRENCY,
      },
    }
  );
  return data.data?.transaction?.status;
}

module.exports = {
  requestContribution,
  checkContributionStatus,
  sendPayout,
  checkPayoutStatus,
};
