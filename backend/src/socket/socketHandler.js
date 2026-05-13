const admin = require('../config/firebase');
const redisService = require('../services/redisService');
const pulseService = require('../services/pulseService');
const User = require('../models/User');

// uid → socketId  and  socketId → uid  maps shared across the app
const uidToSocket = new Map();
const socketToUid = new Map();

function socketHandler(io) {
  io.on('connection', async (socket) => {
    const token = socket.handshake.auth?.token;

    // Authenticate the socket connection
    let decoded;
    try {
      decoded = await admin.auth().verifyIdToken(token);
    } catch {
      socket.disconnect(true);
      return;
    }

    const { uid } = decoded;
    const user = await User.findOne({ uid });
    const displayName = user?.displayName || uid;

    // Register presence
    uidToSocket.set(uid, socket.id);
    socketToUid.set(socket.id, uid);
    await redisService.setPresence(uid, socket.id);

    // Notify the user themselves
    pulseService.emitPulse(socket.id, '[SOCKET]', `${displayName} connected.`);

    // Broadcast online status to everyone else
    socket.broadcast.emit('presence_update', { uid, status: 'online' });

    // Send current user list with presence to the newly connected socket
    try {
      const users = await User.find({}, { uid: 1, displayName: 1, photoURL: 1, _id: 0 });
      const uids = users.map((u) => u.uid);
      const presences = await redisService.getAllPresences(uids);
      const list = users.map((u) => ({
        uid: u.uid,
        displayName: u.displayName,
        photoURL: u.photoURL,
        status: presences[u.uid] || 'offline',
      }));
      socket.emit('users_list', list);
    } catch (err) {
      console.error('[SOCKET] Failed to send users_list:', err.message);
    }

    // --- Event: join_room ---
    socket.on('join_room', ({ roomId }) => {
      socket.join(roomId);
      pulseService.emitPulse(socket.id, '[SOCKET]', `${displayName} joined private room ${roomId}.`);
    });

    // --- Event: send_message ---
    socket.on('send_message', async ({ roomId, encryptedText, recipientUid }) => {
      const messageObj = {
        sender: uid,
        displayName,
        encryptedText,
        timestamp: Date.now(),
      };

      const ttl = redisService.TTL();
      const listLen = await redisService.pushMessage(roomId, messageObj, ttl);

      // Emit message to everyone in the room (sender + recipient)
      io.to(roomId).emit('receive_message', { roomId, ...messageObj });

      // Pulse: key created on first message, otherwise just updated
      const tag = listLen === 1 ? 'created' : 'updated';
      pulseService.emitPulse(
        socket.id,
        '[REDIS]',
        `Key 'chat:${roomId}' ${tag} (TTL: ${ttl}s).`
      );
    });

    // --- Event: disconnect (Bonus 1: Burn-on-Disconnect) ---
    socket.on('disconnect', async () => {
      uidToSocket.delete(uid);
      socketToUid.delete(socket.id);

      await redisService.deletePresence(uid);

      socket.broadcast.emit('presence_update', { uid, status: 'offline' });
      pulseService.broadcastPulse('[SOCKET]', `${displayName} disconnected. Presence wiped.`);
    });
  });
}

module.exports = { socketHandler, uidToSocket, socketToUid };
