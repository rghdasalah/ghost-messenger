require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');

const { connectMongo } = require('./config/mongo');
const { connectRedis, redisSubscriber } = require('./config/redis');
const pulseService = require('./services/pulseService');
const { socketHandler, uidToSocket } = require('./socket/socketHandler');

const authRoutes = require('./routes/auth');
const usersRoutes = require('./routes/users');
const messagesRoutes = require('./routes/messages');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
  },
});

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3000' }));
app.use(express.json());

app.use('/auth', authRoutes);
app.use('/users', usersRoutes);
app.use('/messages', messagesRoutes);

// Initialize pulse service with io instance
pulseService.init(io);

// Register socket handlers
socketHandler(io);

// Redis keyspace expiry listener — fires when any key expires
redisSubscriber.subscribe('__keyevent@0__:expired', (err) => {
  if (err) console.error('[REDIS] Keyspace subscribe error:', err.message);
  else console.log('[REDIS] Subscribed to keyspace expiry events.');
});

redisSubscriber.on('message', (channel, key) => {
  if (!key.startsWith('chat:')) return;

  const roomId = key.replace('chat:', '');

  // Notify all room members that the ghost was purged
  io.to(roomId).emit('ghost_wipe', { roomId });
  pulseService.broadcastPulseToRoom(
    roomId,
    '[GHOST]',
    `TTL reached 0. Redis memory purged. Key: ${key}.`
  );
});

async function start() {
  await connectMongo();
  await connectRedis();
  const PORT = process.env.PORT || 5000;
  server.listen(PORT, () => console.log(`[SERVER]: Running on port ${PORT}`));
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
