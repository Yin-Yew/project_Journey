CREATE DATABASE IF NOT EXISTS joyjourney;
USE joyjourney;

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  username VARCHAR(80) UNIQUE,
  email VARCHAR(150) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  avatar VARCHAR(500),
  travel_style VARCHAR(100),
  promptpay VARCHAR(30),
  bank_name VARCHAR(80),
  bank_account VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

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
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS trip_members (
  trip_id INT NOT NULL,
  user_id INT NOT NULL,
  role ENUM('owner', 'member') DEFAULT 'member',
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (trip_id, user_id),
  FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

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
);

CREATE TABLE IF NOT EXISTS expense_splits (
  expense_id INT NOT NULL,
  user_id INT NOT NULL,
  share_amount DECIMAL(12, 2) NOT NULL,
  share_percentage DECIMAL(7, 2),
  PRIMARY KEY (expense_id, user_id),
  FOREIGN KEY (expense_id) REFERENCES expenses(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

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
);
