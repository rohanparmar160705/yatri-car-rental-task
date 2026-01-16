const express = require("express");
const router = express.Router();
const messageController = require("../controllers/messageController");
const { protect } = require("../middlewares/authMiddleware");

// All routes here require a valid Access JWT
router.use(protect);

router.post("/", messageController.sendMessage);
router.get("/:userId", messageController.getMessages);
router.put("/:messageId", messageController.editMessage);
router.delete("/:messageId", messageController.deleteMessage);

module.exports = router;
