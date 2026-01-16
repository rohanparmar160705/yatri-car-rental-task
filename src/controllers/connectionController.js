const { query } = require("../config/db");
const { emitToUser } = require("../sockets/socketHelper");

// Create a bidirectional connection
exports.createConnection = async (req, res) => {
  try {
    const { connected_user_id } = req.body;
    const user_id = req.user.id;
    const user_email = req.user.email; // Get sender email from JWT

    if (user_id === connected_user_id) {
      return res.status(400).json({ message: "Cannot connect to yourself" });
    }

    // Check if the other user exists and is verified
    const userCheck = await query(
      "SELECT id, email, status FROM users WHERE id = $1",
      [connected_user_id]
    );
    if (
      userCheck.rows.length === 0 ||
      userCheck.rows[0].status !== "Verified"
    ) {
      return res.status(404).json({ message: "User not found or unverified" });
    }

    // Check if connection already exists (either direction)
    const existingConnection = await query(
      `SELECT * FROM connections 
       WHERE (user_id = $1 AND connected_user_id = $2) 
       OR (user_id = $2 AND connected_user_id = $1)`,
      [user_id, connected_user_id]
    );

    if (existingConnection.rows.length > 0) {
      return res.status(400).json({ message: "Connection already exists" });
    }

    // Create BIDIRECTIONAL connection (insert both directions)
    console.log(
      `🔗 Creating connection between ${user_id} and ${connected_user_id}`
    );
    await query(
      "INSERT INTO connections (user_id, connected_user_id) VALUES ($1, $2), ($2, $1)",
      [user_id, connected_user_id]
    );

    // Notify the other user in real-time
    console.log(`📡 Emitting NEW_CONNECTION to User: ${connected_user_id}`);
    const pushed = emitToUser(connected_user_id, {
      type: "NEW_CONNECTION",
      connection: {
        connected_user_id: user_id,
        email: user_email,
        status: "Verified",
      },
    });
    console.log(`📡 Socket push status: ${pushed ? "Success" : "Failed"}`);

    res.status(201).json({
      success: true,
      message: "Connection created successfully",
      connection: {
        user_id,
        connected_user_id,
        connected_user: userCheck.rows[0],
      },
    });
  } catch (error) {
    console.error("Create connection error:", error);
    res
      .status(500)
      .json({ message: "Failed to create connection", error: error.message });
  }
};

// Get all connections for the current user
exports.getConnections = async (req, res) => {
  try {
    const user_id = req.user.id;

    const result = await query(
      `SELECT 
        c.id as connection_id,
        c.connected_user_id,
        c.created_at,
        u.email,
        u.status
       FROM connections c
       JOIN users u ON c.connected_user_id = u.id
       WHERE c.user_id = $1
       ORDER BY c.created_at DESC`,
      [user_id]
    );

    res.status(200).json({
      success: true,
      connections: result.rows,
    });
  } catch (error) {
    console.error("Get connections error:", error);
    res
      .status(500)
      .json({ message: "Failed to fetch connections", error: error.message });
  }
};

// Delete a connection (removes both directions)
exports.deleteConnection = async (req, res) => {
  try {
    const { connectionId } = req.params;
    const user_id = req.user.id;

    // Get the connection to find the other user
    const connectionResult = await query(
      "SELECT * FROM connections WHERE id = $1 AND user_id = $2",
      [connectionId, user_id]
    );

    if (connectionResult.rows.length === 0) {
      return res.status(404).json({ message: "Connection not found" });
    }

    const connected_user_id = connectionResult.rows[0].connected_user_id;

    // Delete BOTH directions of the connection
    await query(
      `DELETE FROM connections 
       WHERE (user_id = $1 AND connected_user_id = $2) 
       OR (user_id = $2 AND connected_user_id = $1)`,
      [user_id, connected_user_id]
    );

    res.status(200).json({
      success: true,
      message: "Connection deleted successfully",
    });
  } catch (error) {
    console.error("Delete connection error:", error);
    res
      .status(500)
      .json({ message: "Failed to delete connection", error: error.message });
  }
};
