const { redisClient } = require('../config/redis');

const TTL = () => parseInt(process.env.MESSAGE_TTL_SECONDS || '120', 10);

function roomKey(roomId) {
  return `chat:${roomId}`;
}

async function pushMessage(roomId, messageObj, ttl = TTL()) {
  const key = roomKey(roomId);
  const len = await redisClient.rpush(key, JSON.stringify(messageObj));
  await redisClient.expire(key, ttl);
  return len;
}

async function getMessages(roomId) {
  const raw = await redisClient.lrange(roomKey(roomId), 0, -1);
  return raw.map((r) => JSON.parse(r));
}

// Bonus 1: atomic fetch + delete in a single MULTI/EXEC transaction
async function readOnceAndDelete(roomId) {
  const key = roomKey(roomId);
  const results = await redisClient.multi().lrange(key, 0, -1).del(key).exec();
  // results[0] = [err, lrange result]
  const raw = results[0][1];
  return Array.isArray(raw) ? raw.map((r) => JSON.parse(r)) : [];
}

async function setPresence(uid, socketId) {
  await redisClient.set(`presence:${uid}`, socketId);
}

async function deletePresence(uid) {
  await redisClient.del(`presence:${uid}`);
}

async function getPresence(uid) {
  return redisClient.get(`presence:${uid}`);
}

async function getAllPresences(uids) {
  if (!uids.length) return {};
  const pipeline = redisClient.pipeline();
  uids.forEach((uid) => pipeline.get(`presence:${uid}`));
  const results = await pipeline.exec();
  const map = {};
  uids.forEach((uid, i) => {
    map[uid] = results[i][1] ? 'online' : 'offline';
  });
  return map;
}

async function setMfaState(uid, sid) {
  await redisClient.set(`mfa:${uid}`, sid, 'EX', 300);
  await redisClient.set(`mfa_state:${uid}`, 'PENDING_MFA', 'EX', 300);
}

async function getMfaState(uid) {
  return redisClient.get(`mfa_state:${uid}`);
}

async function setMfaSecure(uid) {
  await redisClient.del(`mfa:${uid}`);
  await redisClient.set(`mfa_state:${uid}`, 'SECURE', 'EX', 86400);
}

module.exports = {
  pushMessage,
  getMessages,
  readOnceAndDelete,
  setPresence,
  deletePresence,
  getPresence,
  getAllPresences,
  setMfaState,
  getMfaState,
  setMfaSecure,
  TTL,
};
