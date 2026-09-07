const mtn = require('./mtnMomo');
const airtel = require('./airtelMoney');

function getProviderClient(provider) {
  if (provider === 'mtn') return mtn;
  if (provider === 'airtel') return airtel;
  throw new Error(`Unsupported provider: ${provider}`);
}

async function collect({ provider, phoneNumber, amount, externalId, note }) {
  const client = getProviderClient(provider);
  return client.requestContribution({ phoneNumber, amount, externalId, note });
}

async function checkCollectionStatus({ provider, reference }) {
  const client = getProviderClient(provider);
  const status = await client.checkContributionStatus(reference);
  return normalizeStatus(provider, status);
}

async function disburse({ provider, phoneNumber, amount, externalId, note }) {
  const client = getProviderClient(provider);
  return client.sendPayout({ phoneNumber, amount, externalId, note });
}

async function checkDisbursementStatus({ provider, reference }) {
  const client = getProviderClient(provider);
  const status = await client.checkPayoutStatus(reference);
  return normalizeStatus(provider, status);
}

function normalizeStatus(provider, rawStatus) {
  if (provider === 'mtn') {
    if (rawStatus === 'SUCCESSFUL') return 'successful';
    if (rawStatus === 'FAILED') return 'failed';
    return 'pending';
  }
  if (provider === 'airtel') {
    if (rawStatus === 'TS') return 'successful';
    if (rawStatus === 'TF') return 'failed';
    return 'pending';
  }
  return 'pending';
}

module.exports = { collect, checkCollectionStatus, disburse, checkDisbursementStatus };
