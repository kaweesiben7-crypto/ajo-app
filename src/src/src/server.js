const app = require('./app');
const { scheduleWeeklyCycleJob } = require('./jobs/weeklyCycle');
require('dotenv').config();

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`Ajo savings platform running on port ${PORT}`);
  scheduleWeeklyCycleJob();
  console.log('Weekly payout cycle job scheduled (runs hourly, disburses when a round is fully funded)');
});
