const { query } = require("../config/db");
const { emitToUser } = require("../sockets/socketHelper");

// Send Message
exports.sendMessage = async (req, res) => {
  try {
    const { receiver_id, content, file_id } = req.body;
    const sender_id = req.user.id;

    // 1. Recipient check
    const receiverResult = await query(
      "SELECT status FROM users WHERE id = $1",
      [receiver_id]
    );
    const receiver = receiverResult.rows[0];
    if (!receiver || receiver.status !== "Verified") {
      return res
        .status(404)
        .json({ message: "Recipient not found or unverified" });
    }

    // 2. Insert message
    const result = await query(
      `INSERT INTO messages (sender_id, receiver_id, content, file_id) 
       VALUES ($1, $2, $3, $4) 
       RETURNING *`,
      [sender_id, receiver_id, content, file_id]
    );
    let message = result.rows[0];

    // 2.1 Fetch file info if exists for real-time push
    if (file_id) {
      const fileRes = await query(
        "SELECT file_path, original_name FROM files WHERE id = $1",
        [file_id]
      );
      message.file = fileRes.rows[0];
    }

    // 3. Real-time push
    emitToUser(receiver_id, { type: "NEW_MESSAGE", message });

    res.status(201).json({ success: true, data: message });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to send message", error: error.message });
  }
};

// Get History
exports.getMessages = async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const otherUserId = req.params.userId;

    const result = await query(
      `SELECT m.*, f.file_path, f.original_name, f.mime_type
       FROM messages m
       LEFT JOIN files f ON m.file_id = f.id
       WHERE ((m.sender_id = $1 AND m.receiver_id = $2) OR (m.sender_id = $2 AND m.receiver_id = $1)) 
       AND m.is_deleted = false 
       ORDER BY m.created_at ASC`,
      [currentUserId, otherUserId]
    );

    res.status(200).json({ success: true, data: result.rows });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to fetch history", error: error.message });
  }
};

// Edit Message
exports.editMessage = async (req, res) => {
  try {
    const { content } = req.body;
    const { messageId } = req.params;
    const userId = req.user.id;

    const result = await query(
      "UPDATE messages SET content = $1 WHERE id = $2 AND sender_id = $3 RETURNING *",
      [content, messageId, userId]
    );

    if (result.rows.length === 0)
      return res.status(403).json({ message: "Unauthorized or not found" });

    const message = result.rows[0];
    emitToUser(message.receiver_id, { type: "EDIT_MESSAGE", message });

    res.status(200).json({ success: true, data: message });
  } catch (error) {
    res.status(500).json({ message: "Update failed", error: error.message });
  }
};

// Soft Delete
exports.deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.id;

    const result = await query(
      "UPDATE messages SET is_deleted = true WHERE id = $1 AND sender_id = $2 RETURNING *",
      [messageId, userId]
    );

    if (result.rows.length === 0)
      return res.status(403).json({ message: "Unauthorized or not found" });

    const message = result.rows[0];
    emitToUser(message.receiver_id, { type: "DELETE_MESSAGE", messageId });

    res.status(200).json({ success: true, message: "Deleted" });
  } catch (error) {
    res.status(500).json({ message: "Delete failed", error: error.message });
  }
};
