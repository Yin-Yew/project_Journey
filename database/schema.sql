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
  cover_url MEDIUMTEXT,
  invite_code VARCHAR(20) UNIQUE,
  status ENUM('active','finished') NOT NULL DEFAULT 'active',
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
  slip_url MEDIUMTEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  verified_at TIMESTAMP NULL,
  FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE,
  FOREIGN KEY (payer_id) REFERENCES users(id),
  FOREIGN KEY (payee_id) REFERENCES users(id)
);

-- Additional structures for persistent trip and authentication management.
-- For pre-existing deployments, run database/migrate_existing.sql once.
CREATE TABLE IF NOT EXISTS auth_sessions (
  token_hash CHAR(64) PRIMARY KEY,
  user_id INT NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS trip_modules (
  trip_id INT PRIMARY KEY,
  module_data JSON NOT NULL,
  FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE
);


CREATE TABLE IF NOT EXISTS memories (
 id INT AUTO_INCREMENT PRIMARY KEY,
 trip_id INT NOT NULL,
 uploaded_by INT NOT NULL,
 caption VARCHAR(300) NOT NULL,
 filename VARCHAR(80) NOT NULL UNIQUE,
 mime_type VARCHAR(30) NOT NULL,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE,
 FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE CASCADE
);

-- v3: per-trip daily itinerary with ordered activities.
CREATE TABLE IF NOT EXISTS trip_activities (
 id INT AUTO_INCREMENT PRIMARY KEY,
 trip_id INT NOT NULL,
 day_number INT NOT NULL,
 start_time TIME NOT NULL,
 title VARCHAR(150) NOT NULL,
 location VARCHAR(200) NOT NULL DEFAULT '',
 details TEXT,
 sort_order INT NOT NULL DEFAULT 0,
 created_by INT NOT NULL,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 INDEX idx_trip_day_order (trip_id,day_number,sort_order,id),
 FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE,
 FOREIGN KEY (created_by) REFERENCES users(id)
);

-- v3: places belong to trips; one vote per user per place.
CREATE TABLE IF NOT EXISTS trip_places (
 id INT AUTO_INCREMENT PRIMARY KEY,
 trip_id INT NOT NULL,
 name VARCHAR(150) NOT NULL,
 category ENUM('attraction','restaurant','cafe') NOT NULL,
 details TEXT,
 image_url MEDIUMTEXT,
 created_by INT NOT NULL,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 INDEX idx_trip_places (trip_id,id),
 FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE,
 FOREIGN KEY (created_by) REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS place_votes (
 place_id INT NOT NULL,
 user_id INT NOT NULL,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(place_id,user_id),
 FOREIGN KEY (place_id) REFERENCES trip_places(id) ON DELETE CASCADE,
 FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- v4: independent packing items avoid lost updates from concurrent users.
CREATE TABLE IF NOT EXISTS trip_checklist_items (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  trip_id INT NOT NULL,
  label VARCHAR(150) NOT NULL,
  is_checked TINYINT(1) NOT NULL DEFAULT 0,
  created_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_checklist_trip (trip_id,id),
  FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);
CREATE TABLE IF NOT EXISTS trip_checklist_migrations (
  trip_id INT PRIMARY KEY,
  migrated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE
);

-- Public Next Trip polls (v6): available to every authenticated JoyJourney account.
-- Independent of trip membership; each account has at most one vote per poll.
CREATE TABLE IF NOT EXISTS destination_polls (
  id INT AUTO_INCREMENT PRIMARY KEY,
  owner_id INT NOT NULL,
  title VARCHAR(150) NOT NULL,
  status ENUM('open','closed') NOT NULL DEFAULT 'open',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS destination_candidates (
  id INT AUTO_INCREMENT PRIMARY KEY,
  poll_id INT NOT NULL,
  name VARCHAR(150) NOT NULL,
  details VARCHAR(1000) NOT NULL DEFAULT '',
  image_url VARCHAR(1500),
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_poll_options (poll_id,id),
  UNIQUE KEY uq_candidate_poll (poll_id,id),
  FOREIGN KEY (poll_id) REFERENCES destination_polls(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS destination_votes (
  poll_id INT NOT NULL,
  user_id INT NOT NULL,
  candidate_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (poll_id,user_id),
  INDEX idx_poll_candidate (poll_id,candidate_id),
  CONSTRAINT fk_destination_votes_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (poll_id,candidate_id) REFERENCES destination_candidates(poll_id,id) ON DELETE CASCADE
);
