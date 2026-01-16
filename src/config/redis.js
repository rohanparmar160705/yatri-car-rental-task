const { createClient } = require("redis");
require("dotenv").config();

// Create Redis client
const redisClient = createClient({
  url: process.env.REDIS_URL,
  socket: {
    tls: true,
    rejectUnauthorized: false,
  },
});

// Event listeners for err
redisClient.on("error", (err) => console.log("❌ Redis Client Error", err));
// Event listener for successful connection
redisClient.on("connect", () =>
  console.log("✅ Redis connected successfully.")
);

// Function to connect to Redis
const connectRedis = async () => {
  if (!redisClient.isOpen) {
    await redisClient.connect();
  }
};

module.exports = { redisClient, connectRedis };
