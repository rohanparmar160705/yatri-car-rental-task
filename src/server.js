const http = require("http");
const app = require("./app");
const { connectDB } = require("./config/db");
const { connectRedis } = require("./config/redis");
const { initSocket } = require("./sockets/socketHelper");
require("dotenv").config();

// Create HTTP server for Express and WebSockets
const server = http.createServer(app);

// Initialize Socket.io
initSocket(server);

// Port
const PORT = process.env.PORT || 5000;

// Start Server
const startServer = async () => {
  try {
    // 1. Connect to PostgreSQL (via pg pool)
    await connectDB();

    // 2. Connect to Redis (Used for OTP and Sessions)
    await connectRedis();

    // 3. Start Listening
    server.listen(PORT, () => {
      console.log(`🚀 Server is running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
};

startServer();
