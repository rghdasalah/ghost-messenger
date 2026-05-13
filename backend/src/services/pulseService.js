let _io = null;

function init(io) {
  _io = io;
}

function emitPulse(socketId, tag, message) {
  if (!_io) return;
  _io.to(socketId).emit('pulse_event', { tag, message, timestamp: Date.now() });
}

function broadcastPulseToRoom(roomId, tag, message) {
  if (!_io) return;
  _io.to(roomId).emit('pulse_event', { tag, message, timestamp: Date.now() });
}

function broadcastPulse(tag, message) {
  if (!_io) return;
  _io.emit('pulse_event', { tag, message, timestamp: Date.now() });
}

module.exports = { init, emitPulse, broadcastPulseToRoom, broadcastPulse };
