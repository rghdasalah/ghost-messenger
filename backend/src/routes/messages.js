const express = require('express');
const router = express.Router();
const redisService = require('../services/redisService');
const pulseService = require('../services/pulseService');
const verifyToken = require('../middleware/verifyToken');
const { uidToSocket } = require('../socket/socketHandler');

// GET /messages/:roomId — atomic read-once (MULTI/EXEC fetch + delete)
router.get('/:roomId', verifyToken, async (req, res) => {
  const { roomId } = req.params;
  const { uid } = req.user;

  const messages = await redisService.readOnceAndDelete(roomId);

  const socketId = uidToSocket.get(uid);
  if (socketId) {
    pulseService.emitPulse(socketId, '[REDIS]', `Read-once executed on chat:${roomId}. Key deleted.`);
  }

  return res.json(messages);
});

module.exports = router;
