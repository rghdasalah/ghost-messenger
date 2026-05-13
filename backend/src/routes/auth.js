const express = require('express');
const router = express.Router();
const admin = require('../config/firebase');
const User = require('../models/User');
const redisService = require('../services/redisService');
const pulseService = require('../services/pulseService');
const twilioService = require('../services/twilioService');
const verifyToken = require('../middleware/verifyToken');
const { uidToSocket } = require('../socket/socketHandler');

// POST /auth/login — verify Firebase token, silent register, trigger MFA
router.post('/login', async (req, res) => {
  const { idToken } = req.body;
  if (!idToken) return res.status(400).json({ error: 'idToken required' });

  let decoded;
  try {
    decoded = await admin.auth().verifyIdToken(idToken);
  } catch {
    return res.status(401).json({ error: 'Invalid Firebase token' });
  }

  const { uid, name, picture, email } = decoded;

  // Emit pulse to user's socket if already connected
  const socketId = uidToSocket.get(uid);
  if (socketId) {
    pulseService.emitPulse(socketId, '[AUTH]', `Token verified for ${uid}`);
  }

  // Silent registration: upsert user in MongoDB
  const user = await User.findOneAndUpdate(
    { uid },
    {
      $set: { displayName: name || '', photoURL: picture || '', email: email || '', lastLoginAt: new Date() },
      $setOnInsert: { createdAt: new Date() },
    },
    { upsert: true, new: true }
  );

  // Trigger MFA via Twilio
  const phone = process.env.MFA_PHONE_NUMBER;
  let mfaRequired = false;
  try {
    const sid = await twilioService.sendOTP(phone);
    await redisService.setMfaState(uid, sid);
    mfaRequired = true;
    if (socketId) {
      pulseService.emitPulse(socketId, '[TWILIO]', `MFA Challenge dispatched to ${phone}`);
      pulseService.emitPulse(socketId, '[AUTH]', 'Awaiting SMS code verification.');
    }
  } catch (err) {
    console.error('[TWILIO] Failed to send OTP:', err.message);
    // Non-fatal: allow login without MFA if Twilio is misconfigured
  }

  return res.json({ user, mfaRequired });
});

// POST /auth/mfa/request — resend OTP
router.post('/mfa/request', verifyToken, async (req, res) => {
  const { uid } = req.user;
  const phone = process.env.MFA_PHONE_NUMBER;
  try {
    const sid = await twilioService.sendOTP(phone);
    await redisService.setMfaState(uid, sid);
    const socketId = uidToSocket.get(uid);
    if (socketId) {
      pulseService.emitPulse(socketId, '[TWILIO]', `MFA Challenge re-dispatched to ${phone}`);
    }
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /auth/mfa/verify — verify OTP, promote session to SECURE
router.post('/mfa/verify', verifyToken, async (req, res) => {
  const { uid } = req.user;
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: 'code required' });

  const phone = process.env.MFA_PHONE_NUMBER;
  try {
    const approved = await twilioService.verifyOTP(phone, code);
    if (!approved) return res.status(400).json({ error: 'Invalid or expired code' });

    await redisService.setMfaSecure(uid);
    const socketId = uidToSocket.get(uid);
    if (socketId) {
      pulseService.emitPulse(socketId, '[TWILIO]', 'SMS Code Verified. Session promoted to SECURE.');
    }
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
