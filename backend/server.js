require("dotenv").config();
const fs = require("fs");
const path = require("path");
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const mysql = require("mysql2/promise");
const pool = require("./db");

const app = express();

app.use(cors());
app.use(express.json());
// Food photos are now served by the frontend (frontend/public/images), not by Express.

// Setup runs once per server start (also on Vercel). Every request waits for it.
let ready = null;
function setup() {
  if (!ready) {
    ready = initDatabase().then(ensureAdmin).catch((e) => { ready = null; throw e; });
  }
  return ready;
}
app.use((req, res, next) => { setup().then(() => next(), next); });

app.get("/api/categories", async (req, res, next) => {
  try {
    const [rows] = await pool.query("SELECT category_id, name FROM categories ORDER BY category_id");
    res.json(rows);
  } catch (e) { next(e); }
});
app.use("/api/auth", require("./routes/auth"));
app.use("/api/menu", require("./routes/menu"));
app.use("/api/orders", require("./routes/orders"));
app.use("/api/admin", require("./routes/admin"));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Server error. Check the back end terminal." });
});

// First run: if the database does not exist yet, create it from schema.sql automatically
async function initDatabase() {
  const dbName = process.env.DB_NAME || "canteen_db";
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    ssl: pool.ssl,
    multipleStatements: true,
  });
  try {
    const [rows] = await conn.query(
      "SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema = ? AND table_name = 'menu_items'",
      [dbName]
    );
    if (rows[0].n === 0) {
      console.log("First run: creating the database and loading the menu...");
      const sql = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8").split("canteen_db").join(dbName);
      await conn.query(sql);
      console.log("Database ready.");
    }
  } finally {
    await conn.end();
  }
}

// Creates the default admin (username: admin, password: 123456) the first time
async function ensureAdmin() {
  const [rows] = await pool.query("SELECT COUNT(*) AS n FROM admins");
  if (rows[0].n === 0) {
    const hash = await bcrypt.hash("123456", 10);
    await pool.execute("INSERT INTO admins (username, password_hash) VALUES (?, ?)", ["admin", hash]);
    console.log("Default admin created (password 123456).");
  }
}

// Local run:  npm start  (Vercel imports the app instead and does not call listen)
if (require.main === module) {
  const PORT = Number(process.env.PORT) || 5000;
  setup()
    .then(() => app.listen(PORT, () => console.log("Canteen API running on http://localhost:" + PORT)))
    .catch((e) => {
      console.error("Could not connect to MySQL. Is MySQL started (XAMPP > Start)? If you set a MySQL password, put it in backend/.env.\n", e.message);
      process.exit(1);
    });
}

module.exports = app;
