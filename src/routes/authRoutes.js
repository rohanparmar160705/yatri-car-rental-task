const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");

// Auth Routes
router.post("/signup", authController.signup);
router.post("/verify", authController.verifyOtp);
router.post("/signin", authController.signin);
router.post("/refresh", authController.refreshToken);
router.post("/logout", authController.logout);
router.get("/search", authController.searchUser); // New search route

module.exports = router;
