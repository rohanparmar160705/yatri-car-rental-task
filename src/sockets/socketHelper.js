const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");

// Dictionary to map User IDs to their active Socket IDs
const userSocketMap = new Map();

let io;

/**
 * Initializes the Socket.io server and attaches it to the HTTP server.
 * @param {Object} server - The HTTP server instance
 */
const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: "*", // Later we will adjust this for production
      methods: ["GET", "POST"],
    },
  });

  // Socket Authentication Middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error("Authentication error: No token provided"));
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
      socket.user = decoded; // Attach user info to socket
      next();
    } catch (err) {
      next(new Error("Authentication error: Invalid token"));
    }
  });

  io.on("connection", (socket) => {
    const userId = socket.user.id;
    const userEmail = socket.user.email || "Unknown";

    // --- UNIQUE CONNECTION LOGIC ---
    if (userSocketMap.has(userId)) {
      const oldSocketId = userSocketMap.get(userId);
      console.log(
        `[Double Connection] ⚠️ User: ${userEmail} (${userId}) connected in a new tab. Disconnecting old session: ${oldSocketId}`,
      );

      io.to(oldSocketId).emit("session_terminated", {
        message: "New session started elsewhere.",
      });
      io.sockets.sockets.get(oldSocketId)?.disconnect(true);
    }

    // Register the new socket ID
    userSocketMap.set(userId, socket.id);
    console.log(
      `[User Connected] ✅ User: ${userEmail} (${userId}) | Socket: ${socket.id}`,
    );

    // Join a room specific to this user ID
    socket.join(`user_${userId}`);

    // Handle disconnection
    socket.on("disconnect", (reason) => {
      if (userSocketMap.get(userId) === socket.id) {
        userSocketMap.delete(userId);
      }
      console.log(
        `[User Disconnected] 🔌 User: ${userEmail} (${userId}) | Reason: ${reason}`,
      );
    });
  });

  return io;
};

/**
 * Sends a real-time message to a specific user if they are online.
 * @param {string} receiverId - ID of the message recipient
 * @param {Object} messageData - The message object to send
 */
const emitToUser = (receiverId, messageData) => {
  if (io) {
    io.to(`user_${receiverId}`).emit("new_message", messageData);
    console.log(`📡 Message pushed to User Room: user_${receiverId}`);
    return true;
  }
  return false;
};

module.exports = { initSocket, emitToUser };
