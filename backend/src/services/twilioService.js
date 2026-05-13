const twilio = require('twilio');

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const SERVICE_SID = process.env.TWILIO_VERIFY_SERVICE_SID;

async function sendOTP(toPhone) {
  const verification = await client.verify.v2
    .services(SERVICE_SID)
    .verifications.create({ to: toPhone, channel: 'sms' });
  return verification.sid;
}

async function verifyOTP(toPhone, code) {
  const check = await client.verify.v2
    .services(SERVICE_SID)
    .verificationChecks.create({ to: toPhone, code });
  return check.status === 'approved';
}

module.exports = { sendOTP, verifyOTP };
