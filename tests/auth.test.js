const {
  signup,
  verifyOtp,
  signin,
} = require("../src/controllers/authController");
const { query } = require("../src/config/db");
const { redisClient } = require("../src/config/redis");
const bcrypt = require("bcryptjs");

/**
 * UNIT TESTING: Authentication Controller
 *
 * Objectives:
 * 1. Test Signup (Duplicate check, Peppered Hashing, OTP storage).
 * 2. Test Signin (Credential validation, Verified status, Token rotation).
 * 3. Test OTP Verification (Redis validation).
 *
 * Strategy:
 * We use 'jest.mock' to intercept calls to the database (PostgreSQL),
 * cache (Redis), and encryption (Bcrypt), allowing us to test controller
 * logic in isolation without requiring a running environment.
 */

// Mock the raw database query function
jest.mock("../src/config/db", () => ({
  query: jest.fn(),
}));

// Mock Redis client methods (set, get, del)
jest.mock("../src/config/redis", () => ({
  redisClient: {
    set: jest.fn(),
    get: jest.fn(),
    del: jest.fn(),
  },
}));

// Mock secondary dependencies
jest.mock("../src/services/emailService");
jest.mock("bcryptjs");
jest.mock("../src/utils/jwtHelper");

describe("Auth Controller Unit Tests (Raw SQL Integration)", () => {
  let req, res;

  // Reset mocks and setup standard req/res objects before each test
  beforeEach(() => {
    req = { body: {}, cookies: {} };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      cookie: jest.fn(),
    };
    jest.clearAllMocks();
    process.env.PEPPER = "test_pepper"; // Ensure pepper is present for hashing tests
  });

  describe("Signup Logic", () => {
    /**
     * TEST: Rejects existing emails
     * How it works: We mock the SELECT query to return a user object.
     * The controller should see this and return a 400 error.
     */
    it("should return 400 if user exists", async () => {
      req.body = { email: "exists@ex.com", password: "p1" };
      query.mockResolvedValue({ rows: [{ id: "1" }] }); // Mock: User found

      await signup(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(query).toHaveBeenCalledWith(
        expect.stringMatching(/SELECT id FROM users/),
        ["exists@ex.com"]
      );
    });

    /**
     * TEST: Successful Registration
     * How it works:
     * 1. Mock SELECT to return empty (User doesn't exist).
     * 2. Verify Bcrypt hashes (password + PEPPER).
     * 3. Verify INSERT query is called with hashed data.
     */
    it("should hash with pepper and insert user", async () => {
      req.body = { email: "new@ex.com", password: "p1" };
      query.mockResolvedValueOnce({ rows: [] }); // Step 1: User skip
      query.mockResolvedValueOnce({}); // Step 2: Insert success
      bcrypt.hash.mockResolvedValue("h1"); // Step 3: Mock hashing

      await signup(req, res);

      // Crucial: Check if Pepper was concatenated correctly
      expect(bcrypt.hash).toHaveBeenCalledWith("p1test_pepper", 10);
      expect(query).toHaveBeenCalledWith(
        expect.stringMatching(/INSERT INTO users/),
        ["new@ex.com", "h1"]
      );
      expect(res.status).toHaveBeenCalledWith(201);
    });
  });

  describe("Signin Logic", () => {
    /**
     * TEST: Invalid Email
     * How it works: Mock SELECT to return no rows.
     */
    it("should fail if user not found", async () => {
      req.body = { email: "none@ex.com", password: "p1" };
      query.mockResolvedValue({ rows: [] });

      await signin(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
    });

    /**
     * TEST: Successful Signin and Token Generation
     * How it works:
     * 1. Mock DB to return a "Verified" user.
     * 2. Mock Bcrypt to return true for password match.
     * 3. Verify that the Refresh Token is sent via an HTTP-only Cookie.
     */
    it("should succeed and set cookie if verified and password matches", async () => {
      req.body = { email: "ok@ex.com", password: "p1" };
      query.mockResolvedValue({
        rows: [
          { id: "u1", email: "ok@ex.com", status: "Verified", password: "h1" },
        ],
      });
      bcrypt.compare.mockResolvedValue(true);

      const {
        generateAccessToken,
        generateRefreshToken,
      } = require("../src/utils/jwtHelper");
      generateAccessToken.mockReturnValue("a1");
      generateRefreshToken.mockReturnValue("r1");

      await signin(req, res);

      // Verify secure cookie transmission
      expect(res.cookie).toHaveBeenCalledWith(
        "refreshToken",
        "r1",
        expect.objectContaining({ httpOnly: true })
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });
});
