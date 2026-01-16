const { Pool } = require("pg");
require("dotenv").config();

/**
 * Configure PostgreSQL connection pool
 */
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false, // Required for Supabase/External DBs
  },
});

/**
 * Execute a raw query
 * @param {string} text - SQL Query
 * @param {Array} params - Query Parameters
 */
const query = (text, params) => pool.query(text, params);

/**
 * Database connection check and schema initialization
 */
const connectDB = async () => {
  try {
    const client = await pool.connect();
    console.log("✅ PostgreSQL connected successfully (via pg pool).");
    client.release();
  } catch (error) {
    console.error("❌ PostgreSQL connection error:", error.message);
    process.exit(1);
  }
};

module.exports = { query, connectDB, pool };
