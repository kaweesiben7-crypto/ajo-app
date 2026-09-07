const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const BASE_URL = process.env.MOMO_BASE_URL;
const TARGET_ENV = process.env.MOMO_TARGET_ENVIRONMENT;
const CURRENCY = process.env.MOMO_CURRENCY;

async function getToken(product) {
  const subscriptionKey = product === 'collection'
    ? process.env.MOMO_COLLECTION_SUBSCRIPTION_KEY
    : process.env.MOMO_DISBURSEMENT_SUBSCRIPTION_KEY;
  const apiUser = product === 'collection'
    ? process.env.MOMO_COLLECTION_API_USER
    : process.env.MOMO_DISBURSEMENT_API_USER;
  const apiKey = product === 'collection'
    ? process.env.MOMO_COLLECTION_API_KEY
    : process.env.MOMO_DISBURSEMENT_API_KEY;

  const basicAuth = Buffer.from(`${apiUser}:${apiKey}`).toString('base64');

  const { data } = await axios.post(
    `${BASE_URL}/${product}/token/`,
    {},
    {
      headers: {
        Authorization: `Basic ${basicAuth}`,
        'Ocp-Apim-Subscription-Key': subscriptionKey,
      },
    }
  );
  return data.access_token;
}

async function requestContribution({ phoneNumber, amount, externalId, note }) {
  const referenceId = uuidv4();
  const token = await getToken('collection');

  await axios.post(
    `${BASE_URL}/collection/v1_0/requesttopay`,
    {
      amount: String(amount),
      currency: CURRENCY,
      externalId,
      payer: { partyIdType: 'MSISDN', partyId: phoneNumber },
      payerMessage: note || 'Weekly savings contribution',
      payeeNote: note || 'Weekly savings contribution',
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Reference-Id': referenceId,
        'X-Target-Environment': TARGET_ENV,
        'Ocp-Apim-Subscription-Key': process.env.MOMO_COLLECTION_SUBSCRIPTION_KEY,
        'Content-Type': 'application/json',
      },
    }
  );

  return referenceId;
}

async function checkContributionStatus(referenceId) {
  const token = await getToken('collection');
  const { data } = await axios.get(
    `${BASE_URL}/collection/v1_0/requesttopay/${referenceId}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Target-Environment': TARGET_ENV,
        'Ocp-Apim-Subscription-Key': process.env.MOMO_COLLECTION_SUBSCRIPTION_KEY,
      },
    }
  );
  return data.status;
}

async function sendPayout({ phoneNumber, amount, externalId, note }) {
  const referenceId = uuidv4();
  const token = await getToken('disbursement');

  await axios.post(
    `${BASE_URL}/disbursement/v1_0/transfer`,
    {
      amount: String(amount),
      currency: CURRENCY,
      externalId,
      payee: { partyIdType: 'MSISDN', partyId: phoneNumber },
      payerMessage: note || 'Ajo group payout',
      payeeNote: note || 'Ajo group payout',
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Reference-Id': referenceId,
        'X-Target-Environment': TARGET_ENV,
        'Ocp-Apim-Subscription-Key': process.env.MOMO_DISBURSEMENT_SUBSCRIPTION_KEY,
        'Content-Type': 'application/json',
      },
    }
  );

  return referenceId;
}

async function checkPayoutStatus(referenceId) {
  const token = await getToken('disbursement');
  const { data } = await axios.get(
    `${BASE_URL}/disbursement/v1_0/transfer/${referenceId}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Target-Environment': TARGET_ENV,
        'Ocp-Apim-Subscription-Key': process.env.MOMO_DISBURSEMENT_SUBSCRIPTION_KEY,
      },
    }
  );
  return data.status;
}

module.exports = {
  requestContribution,
  checkContributionStatus,
  sendPayout,
  checkPayoutStatus,
};
