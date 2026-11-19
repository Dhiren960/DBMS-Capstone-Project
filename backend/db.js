// Database connection pool (MySQL)
require("dotenv").config();
const mysql = require("mysql2/promise");

// Cloud MySQL (TiDB, Aiven, Railway...) needs SSL. Set DB_SSL=true in Vercel to turn it on.
const ssl = process.env.DB_SSL === "true" ? { rejectUnauthorized: true } : undefined;

const config = {
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "canteen_db",
  ssl,
};

const pool = mysql.createPool({
  ...config,
  waitForConnections: true,
  connectionLimit: process.env.VERCEL ? 3 : 10, // serverless: keep it small
});

module.exports = pool;
module.exports.ssl = ssl;
