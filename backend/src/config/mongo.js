const mongoose = require('mongoose');

async function connectMongo() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('[MONGO]: Connected to MongoDB');
}

module.exports = { connectMongo };
