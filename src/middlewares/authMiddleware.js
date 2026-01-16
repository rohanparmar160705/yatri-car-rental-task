const jwt = require("jsonwebtoken");
require("dotenv").config();

/**
 * Middleware to protect routes that require authentication.
 * It verifies the Access Token provided in the Authorization header.
 */
const protect = async (req, res, next) => {
  let token;

  // Check if token exists in Authorization header (Bearer token)
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    try {
      // Extract token from 'Bearer <token>'
      token = req.headers.authorization.split(" ")[1];

      // Verify token integrity and expiration
      const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);

      // Attach user info (id, email) to the request object
      req.user = decoded;

      // if all is well, proceed to the next middleware or route handler
      next();
    } catch (error) {
      console.error("Auth Middleware Error:", error.message);
      return res.status(401).json({ message: "Not authorized, token failed" });
    }
  }

  if (!token) {
    return res
      .status(401)
      .json({ message: "Not authorized, no token provided" });
  }
};

module.exports = { protect };
