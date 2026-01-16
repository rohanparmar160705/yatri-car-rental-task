const express = require("express");
const router = express.Router();
const connectionController = require("../controllers/connectionController");
const { protect } = require("../middlewares/authMiddleware");

// All routes require authentication
router.use(protect);

// Connection routes
router.post("/", connectionController.createConnection);
router.get("/", connectionController.getConnections);
router.delete("/:connectionId", connectionController.deleteConnection);

module.exports = router;
