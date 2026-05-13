const express = require('express');
const router = express.Router();
const User = require('../models/User');
const redisService = require('../services/redisService');
const verifyToken = require('../middleware/verifyToken');

// GET /users — all users with online/offline presence
router.get('/', verifyToken, async (req, res) => {
  const users = await User.find({}, { uid: 1, displayName: 1, photoURL: 1, _id: 0 });
  const uids = users.map((u) => u.uid);
  const presences = await redisService.getAllPresences(uids);

  const result = users.map((u) => ({
    uid: u.uid,
    displayName: u.displayName,
    photoURL: u.photoURL,
    status: presences[u.uid] || 'offline',
  }));

  return res.json(result);
});

module.exports = router;
