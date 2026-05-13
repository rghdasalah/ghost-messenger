const Redis = require('ioredis');

const redisClient = new Redis(process.env.REDIS_URL);
const redisSubscriber = new Redis(process.env.REDIS_URL);

async function connectRedis() {
  await redisClient.config('SET', 'notify-keyspace-events', 'KEx');
  console.log('[REDIS]: Connected. Keyspace events enabled.');
}

module.exports = { redisClient, redisSubscriber, connectRedis };
