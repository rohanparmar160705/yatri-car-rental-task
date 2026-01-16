const express = require("express");
const router = express.Router();
const fileController = require("../controllers/fileController");
const upload = require("../middlewares/uploadMiddleware");
const { protect } = require("../middlewares/authMiddleware");

// Protection middleware
router.use(protect);

/**
 * Endpoint for single file upload
 * 'file' is the key expected in the multipart/form-data request
 */
router.post("/upload", upload.single("file"), fileController.uploadFile);

module.exports = router;
