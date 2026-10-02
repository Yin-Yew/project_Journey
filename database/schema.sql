-- JoyJourney database schema (MySQL 8 / MariaDB 10.4+)
--
-- You usually do NOT need to import this by hand: `npm run dev` creates the
-- database, the tables, upgrades older tables and adds demo data automatically
-- (see server/database.js). This file is kept for phpMyAdmin / manual setup.

CREATE DATABASE IF NOT EXISTS joyjourney CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE joyjourney;

-- client_id = the user id used by the browser login (e.g. "yin", "user-1727...")
CREATE TABLE IF NOT EXISTS users (
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
) DEFAULT CHARSET=utf8mb4;

-- status: 'active' trips appear in Planner / Expenses / Checklist,
--         'finished' trips move to the Finished shelf.
-- Active trips are finished automatically once end_date has passed.
CREATE TABLE IF NOT EXISTS trips (
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
) DEFAULT CHARSET=utf8mb4;

-- Exactly one row per trip has role = 'owner' (kept in sync with trips.owner_id)
CREATE TABLE IF NOT EXISTS trip_members (
  trip_id INT NOT NULL,
  user_id INT NOT NULL,
  role ENUM('owner', 'member') DEFAULT 'member',
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (trip_id, user_id),
  FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS expenses (
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
) DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS expense_splits (
  expense_id INT NOT NULL,
  user_id INT NOT NULL,
  share_amount DECIMAL(12, 2) NOT NULL,
  share_percentage DECIMAL(7, 2),
  PRIMARY KEY (expense_id, user_id),
  FOREIGN KEY (expense_id) REFERENCES expenses(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id)
) DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS payments (
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
) DEFAULT CHARSET=utf8mb4;
