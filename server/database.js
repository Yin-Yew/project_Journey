const mysql = require("mysql2/promise");
const crypto = require("crypto");

const DB_CONFIG = {
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "joyjourney"
};

let pool = null;

function getPool() {
  if (!pool) {
    throw new Error("Database is not initialised yet");
  }
  return pool;
}

async function query(sql, params = []) {
  const [rows] = await getPool().query(sql, params);
  return rows;
}

async function withTransaction(work) {
  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    const result = await work(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/* ---------- Schema (keep in sync with database/schema.sql) ---------- */

const TABLES = [
  `CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    client_id VARCHAR(80) UNIQUE,
    name VARCHAR(100) NOT NULL,
    username VARCHAR(80),
    email VARCHAR(150) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL DEFAULT '',
    avatar VARCHAR(500),
    travel_style VARCHAR(100),
    promptpay VARCHAR(30),
    bank_name VARCHAR(80),
    bank_account VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS trips (
    id INT AUTO_INCREMENT PRIMARY KEY,
    owner_id INT NOT NULL,
    name VARCHAR(150) NOT NULL,
    destination VARCHAR(150),
    start_date DATE,
    end_date DATE,
    budget DECIMAL(12, 2) DEFAULT 0,
    cover_url TEXT,
    invite_code VARCHAR(20) UNIQUE,
    status ENUM('active', 'finished') NOT NULL DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_id) REFERENCES users(id)
  ) DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS trip_members (
    trip_id INT NOT NULL,
    user_id INT NOT NULL,
    role ENUM('owner', 'member') DEFAULT 'member',
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (trip_id, user_id),
    FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  ) DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS expenses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    trip_id INT NOT NULL,
    title VARCHAR(150) NOT NULL,
    category VARCHAR(80) DEFAULT 'Other',
    amount DECIMAL(12, 2) NOT NULL,
    paid_by INT NOT NULL,
    split_type ENUM('equal', 'percentage', 'custom') DEFAULT 'equal',
    expense_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE,
    FOREIGN KEY (paid_by) REFERENCES users(id)
  ) DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS expense_splits (
    expense_id INT NOT NULL,
    user_id INT NOT NULL,
    share_amount DECIMAL(12, 2) NOT NULL,
    share_percentage DECIMAL(7, 2),
    PRIMARY KEY (expense_id, user_id),
    FOREIGN KEY (expense_id) REFERENCES expenses(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id)
  ) DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS payments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    trip_id INT NOT NULL,
    payer_id INT NOT NULL,
    payee_id INT NOT NULL,
    amount DECIMAL(12, 2) NOT NULL,
    status ENUM('pending', 'paid', 'cancelled') DEFAULT 'pending',
    slip_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    verified_at TIMESTAMP NULL,
    FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE,
    FOREIGN KEY (payer_id) REFERENCES users(id),
    FOREIGN KEY (payee_id) REFERENCES users(id)
  ) DEFAULT CHARSET=utf8mb4`
];

async function hasColumn(table, column) {
  const rows = await query(
    "SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?",
    [table, column]
  );
  return rows.length > 0;
}

/* Upgrades a database that was created from the older schema.sql */
async function migrate() {
  if (!(await hasColumn("users", "client_id"))) {
    await query("ALTER TABLE users ADD COLUMN client_id VARCHAR(80) NULL UNIQUE AFTER id");
  }
  await query("ALTER TABLE users MODIFY password_hash VARCHAR(255) NOT NULL DEFAULT ''");
  if (!(await hasColumn("trips", "status"))) {
    await query("ALTER TABLE trips ADD COLUMN status ENUM('active', 'finished') NOT NULL DEFAULT 'active' AFTER invite_code");
  }
  if (!(await hasColumn("trips", "updated_at"))) {
    await query("ALTER TABLE trips ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP");
  }

  // Thai names need utf8mb4. Convert tables made with an older default charset.
  const tables = await query(
    "SELECT TABLE_NAME AS name, TABLE_COLLATION AS collation FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()"
  );
  for (const table of tables) {
    if (table.collation && !String(table.collation).startsWith("utf8mb4")) {
      await query(`ALTER TABLE \`${table.name}\` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    }
  }
}

/* ---------- Demo data (only for a brand-new, empty database) ---------- */

const DEMO_USERS = [
  { clientId: "yin", name: "Yin", email: "yin@example.com", style: "Beach Explorer", color: "ffd5dc", promptpay: "081-XXX-0001", bankName: "KBank", bankAccount: "XXX-X-00001-X" },
  { clientId: "ploy", name: "Ploy", email: "ploy@example.com", style: "Cafe Hunter", color: "d5efff", promptpay: "081-XXX-0002", bankName: "SCB", bankAccount: "XXX-X-00002-X" },
  { clientId: "book", name: "Book", email: "book@example.com", style: "Photo Lover", color: "dff2d8", promptpay: "081-XXX-0003", bankName: "KBank", bankAccount: "XXX-X-00003-X" },
  { clientId: "gun", name: "Gun", email: "gun@example.com", style: "Food Explorer", color: "eee1ff", promptpay: "081-XXX-0004", bankName: "BBL", bankAccount: "XXX-X-00004-X" }
];

const DEMO_TRIPS = [
  {
    name: "Koh Samet Getaway",
    destination: "Rayong",
    startDate: "2026-10-10",
    endDate: "2026-10-12",
    budget: 12000,
    cover: "https://images.pexels.com/photos/28581877/pexels-photo-28581877.jpeg?auto=compress&cs=tinysrgb&w=1200",
    inviteCode: "SAMET26",
    status: "active"
  },
  {
    name: "Bangkok Weekend",
    destination: "Bangkok",
    startDate: "2026-11-28",
    endDate: "2026-11-29",
    budget: 8000,
    cover: "https://images.pexels.com/photos/20020757/pexels-photo-20020757.jpeg?auto=compress&cs=tinysrgb&w=1200",
    inviteCode: "BKK26",
    status: "active"
  },
  {
    name: "Chiang Mai 2025",
    destination: "Chiang Mai",
    startDate: "2025-12-13",
    endDate: "2025-12-15",
    budget: 9000,
    cover: "https://images.pexels.com/photos/35683130/pexels-photo-35683130.jpeg?auto=compress&cs=tinysrgb&w=1200",
    inviteCode: "CNX25",
    status: "finished"
  }
];

async function seedDemoData() {
  const [{ total }] = await query("SELECT COUNT(*) AS total FROM users");
  if (Number(total) > 0) {
    return;
  }

  const demoHash = crypto.createHash("sha256").update("password123").digest("hex");
  const ids = {};
  for (const user of DEMO_USERS) {
    const avatar = `https://api.dicebear.com/9.x/notionists/svg?seed=${user.name}&backgroundColor=${user.color}`;
    const result = await query(
      `INSERT INTO users (client_id, name, username, email, password_hash, avatar, travel_style, promptpay, bank_name, bank_account)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [user.clientId, user.name, user.clientId, user.email, demoHash, avatar, user.style, user.promptpay, user.bankName, user.bankAccount]
    );
    ids[user.clientId] = result.insertId;
  }

  for (const trip of DEMO_TRIPS) {
    const result = await query(
      `INSERT INTO trips (owner_id, name, destination, start_date, end_date, budget, cover_url, invite_code, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [ids.yin, trip.name, trip.destination, trip.startDate, trip.endDate, trip.budget, trip.cover, trip.inviteCode, trip.status]
    );
    for (const user of DEMO_USERS) {
      await query("INSERT INTO trip_members (trip_id, user_id, role) VALUES (?, ?, ?)", [
        result.insertId,
        ids[user.clientId],
        user.clientId === "yin" ? "owner" : "member"
      ]);
    }
  }
  console.log("Seeded demo users and trips");
}

async function initDatabase() {
  const admin = await mysql.createConnection({
    host: DB_CONFIG.host,
    port: DB_CONFIG.port,
    user: DB_CONFIG.user,
    password: DB_CONFIG.password
  });
  await admin.query(
    `CREATE DATABASE IF NOT EXISTS \`${DB_CONFIG.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
  );
  await admin.end();

  pool = mysql.createPool({
    ...DB_CONFIG,
    charset: "utf8mb4",
    dateStrings: true,
    connectionLimit: 10
  });

  for (const statement of TABLES) {
    await query(statement);
  }
  await migrate();
  await seedDemoData();
  console.log(`Connected to MySQL database "${DB_CONFIG.database}"`);
}

module.exports = { initDatabase, query, withTransaction, getPool };
