const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");
require("dotenv").config();

const path = require("path");
const authRoutes = require("./routes/authRoutes");
const messageRoutes = require("./routes/messageRoutes");
const fileRoutes = require("./routes/fileRoutes");
const connectionRoutes = require("./routes/connectionRoutes");

const app = express();

// Serve static files from 'uploads' directory
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// Custom Morgan token for JSON logging
morgan.token("json-details", (req, res) => {
  // Create a copy of the body to redact sensitive fields
  const body = { ...req.body };
  if (body.password) body.password = "********";

  return JSON.stringify(
    {
      method: req.method,
      url: req.url,
      status: res.statusCode,
      headers: req.headers,
      body: body,
      timestamp: new Date().toISOString(),
    },
    null,
    2
  ); // Multi-line JSON
});

// Middleware
app.use(
  cors({
    origin: true, // In production, specify your frontend URL
    credentials: true,
  })
);
// morgan middleware for logging
app.use(morgan(":json-details"));
// cookie parser middleware for refresh token in http-only cookies
app.use(cookieParser());
// express json middleware
app.use(express.json());
// express urlencoded middleware
app.use(express.urlencoded({ extended: true }));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/files", fileRoutes);
app.use("/api/connections", connectionRoutes);

// Root endpoint
app.get("/", (req, res) => {
  res.json({ message: "Real-Time Secure Communication API is running" });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res
    .status(500)
    .json({ message: "Something went wrong!", error: err.message });
});

module.exports = app;
