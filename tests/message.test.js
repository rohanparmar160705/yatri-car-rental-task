const {
  sendMessage,
  getMessages,
} = require("../src/controllers/messageController");
const { query } = require("../src/config/db");
const { emitToUser } = require("../src/sockets/socketHelper");

/**
 * UNIT TESTING: Messaging Controller
 *
 * Objectives:
 * 1. Test sending messages to verified users only.
 * 2. Test Real-Time WebSocket emission (Immediate Push).
 * 3. Test Message History retrieval (Bi-directional SQL).
 *
 * Strategy:
 * We mock 'pg' queries and the 'socketHelper' to ensure that when
 * an API is called, the correct sequence of DB saves and WebSocket emits
 * occurs without actually connecting to a database or socket server.
 */

// Mock DB queries
jest.mock("../src/config/db", () => ({
  query: jest.fn(),
}));

// Mock WebSocket helper to verify push triggers
jest.mock("../src/sockets/socketHelper");

describe("Message Controller Unit Tests (Raw SQL Architecture)", () => {
  let req, res;

  beforeEach(() => {
    // Mock user session 'u1'
    req = { user: { id: "u1" }, body: {}, params: {} };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    jest.clearAllMocks();
  });

  describe("sendMessage Logic", () => {
    /**
     * TEST: Prevent messaging unverified users
     * How it works: Mock the recipient query to return nothing.
     */
    it("should return 404 if receiver is not verified", async () => {
      req.body = { receiver_id: "u2", content: "hi" };
      query.mockResolvedValueOnce({ rows: [] }); // Simulating user not found or unverified

      await sendMessage(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: "Recipient not found or unverified",
      });
    });

    /**
     * TEST: Message Creation + WebSocket Trigger
     * How it works:
     * 1. Mock DB to allow sending (Recipient verified).
     * 2. Verify INSERT SQL is triggered with correct participants.
     * 3. CRITICAL: Verify that emitToUser is called so the recipient gets a push.
     */
    it("should insert message and emit real-time event", async () => {
      req.body = { receiver_id: "u2", content: "hi" };
      query.mockResolvedValueOnce({ rows: [{ status: "Verified" }] }); // Peer confirmed
      query.mockResolvedValueOnce({
        rows: [{ id: "m1", sender_id: "u1", receiver_id: "u2", content: "hi" }],
      }); // Message saved

      await sendMessage(req, res);

      // Verify DB storage
      expect(query).toHaveBeenCalledWith(
        expect.stringMatching(/INSERT INTO messages/),
        ["u1", "u2", "hi", undefined]
      );

      // Verify real-time broadcast trigger
      expect(emitToUser).toHaveBeenCalledWith(
        "u2",
        expect.objectContaining({ type: "NEW_MESSAGE" })
      );
      expect(res.status).toHaveBeenCalledWith(201);
    });
  });

  describe("getMessages Logic", () => {
    /**
     * TEST: Fetching History
     * How it works: Verifies that the SQL query looks for messages where
     * current user is either sender or receiver.
     */
    it("should fetch messages for a specific chat", async () => {
      req.params.userId = "u2";
      query.mockResolvedValue({ rows: [{ id: "m1", content: "hey" }] });

      await getMessages(req, res);

      // Verify the OR complex query
      expect(query).toHaveBeenCalledWith(
        expect.stringMatching(
          /SELECT m\.\*.*FROM messages m.*LEFT JOIN files f/s
        ),
        ["u1", "u2"]
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, data: expect.any(Array) })
      );
    });
  });
});
