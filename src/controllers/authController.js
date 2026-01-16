const bcrypt = require("bcryptjs");
const { query } = require("../config/db");
const { redisClient } = require("../config/redis");
const { sendOTP } = require("../services/emailService");
const {
  generateAccessToken,
  generateRefreshToken,
} = require("../utils/jwtHelper");
const jwt = require("jsonwebtoken");

/**
 * @desc Helper function to set the refresh token in an HTTP-only cookie
 */
const setRefreshTokenCookie = (res, refreshToken) => {
  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
};

// Signup: Register user using raw SQL
exports.signup = async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1. Check if user exists
    const userCheck = await query("SELECT id FROM users WHERE email = $1", [
      email,
    ]);
    if (userCheck.rows.length > 0) {
      return res.status(400).json({ message: "User already exists" });
    }

    // 2. Hash password with Pepper
    const pepper = process.env.PEPPER || "";
    const hashedPassword = await bcrypt.hash(password + pepper, 10);

    // 3. Insert user
    await query(
      "INSERT INTO users (email, password, status) VALUES ($1, $2, 'Unverified')",
      [email, hashedPassword]
    );

    // 4. OTP Logic
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    console.log(`🔑 [TESTING] OTP for ${email}: ${otp}`);
    await redisClient.set(`OTP:${email}`, otp, { EX: 300 });

    try {
      await sendOTP(email, otp);
    } catch (e) {
      console.error("Error sending OTP:", e);
    }

    res
      .status(201)
      .json({ success: true, message: "User registered. Verify OTP." });
  } catch (error) {
    res.status(500).json({ message: "Signup failed", error: error.message });
  }
};

// Verify OTP
exports.verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    const storedOtp = await redisClient.get(`OTP:${email}`);
    if (!storedOtp || storedOtp !== otp) {
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }

    // Update status using raw SQL
    await query("UPDATE users SET status = 'Verified' WHERE email = $1", [
      email,
    ]);
    await redisClient.del(`OTP:${email}`);

    res.status(200).json({ success: true, message: "Email verified." });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Verification failed", error: error.message });
  }
};

// Signin
exports.signin = async (req, res) => {
  try {
    const { email, password } = req.body;
    const userResult = await query("SELECT * FROM users WHERE email = $1", [
      email,
    ]);
    const user = userResult.rows[0];

    if (!user) return res.status(401).json({ message: "Invalid credentials" });
    if (user.status !== "Verified")
      return res.status(403).json({ message: "Verify account first." });

    const pepper = process.env.PEPPER || "";
    const isMatch = await bcrypt.compare(password + pepper, user.password);
    if (!isMatch)
      return res.status(401).json({ message: "Invalid credentials" });

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    await redisClient.set(`REFRESH:${user.id}`, refreshToken, {
      EX: 3600 * 24 * 7,
    });
    setRefreshTokenCookie(res, refreshToken);

    res.status(200).json({
      success: true,
      accessToken,
      user: { id: user.id, email: user.email },
    });
  } catch (error) {
    res.status(500).json({ message: "Login failed", error: error.message });
  }
};

// Refresh Token
exports.refreshToken = async (req, res) => {
  try {
    const oldRefreshToken = req.cookies.refreshToken;
    if (!oldRefreshToken)
      return res.status(401).json({ message: "Session expired" });

    const decoded = jwt.verify(oldRefreshToken, process.env.JWT_REFRESH_SECRET);
    const storedToken = await redisClient.get(`REFRESH:${decoded.id}`);
    if (!storedToken || storedToken !== oldRefreshToken)
      return res.status(403).json({ message: "Invalid session" });

    const userResult = await query(
      "SELECT id, email FROM users WHERE id = $1",
      [decoded.id]
    );
    const user = userResult.rows[0];

    const newAccessToken = generateAccessToken(user);
    const newRefreshToken = generateRefreshToken(user);

    await redisClient.set(`REFRESH:${user.id}`, newRefreshToken, {
      EX: 3600 * 24 * 7,
    });
    setRefreshTokenCookie(res, newRefreshToken);

    res.status(200).json({ success: true, accessToken: newAccessToken });
  } catch (error) {
    res.status(403).json({ message: "Session expired." });
  }
};

// Logout
exports.logout = async (req, res) => {
  try {
    const token = req.cookies.refreshToken;
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
      await redisClient.del(`REFRESH:${decoded.id}`);
    }
    res.clearCookie("refreshToken");
    res.status(200).json({ success: true, message: "Logged out" });
  } catch (error) {
    res.status(500).json({ message: "Logout error", error: error.message });
  }
};
// Search User by Email or ID
exports.searchUser = async (req, res) => {
  try {
    const { email } = req.query;
    if (!email)
      return res
        .status(400)
        .json({ message: "Search term (email or ID) required" });

    // Check if it's a UUID or Email
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-4][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        email
      );

    let queryStr, params;
    if (isUuid) {
      queryStr = "SELECT id, email FROM users WHERE id = $1";
      params = [email];
    } else {
      queryStr = "SELECT id, email FROM users WHERE email = $1";
      params = [email];
    }

    const result = await query(queryStr, params);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({ success: true, user: result.rows[0] });
  } catch (error) {
    res.status(500).json({ message: "Search failed", error: error.message });
  }
};
