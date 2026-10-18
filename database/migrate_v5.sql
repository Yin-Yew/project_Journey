-- v5 Standalone Next Trip Voting. This is additive and leaves existing trips,
-- places and old place votes untouched. Take a backup before migrating.
USE joyjourney;

CREATE TABLE IF NOT EXISTS destination_polls (
  id INT AUTO_INCREMENT PRIMARY KEY,
  owner_id INT NOT NULL,
  title VARCHAR(150) NOT NULL,
  invite_code CHAR(10) NOT NULL UNIQUE,
  status ENUM('open','closed') NOT NULL DEFAULT 'open',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS destination_poll_members (
  poll_id INT NOT NULL,
  user_id INT NOT NULL,
  role ENUM('owner','member') NOT NULL DEFAULT 'member',
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(poll_id,user_id),
  FOREIGN KEY (poll_id) REFERENCES destination_polls(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
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
  FOREIGN KEY (poll_id,user_id) REFERENCES destination_poll_members(poll_id,user_id) ON DELETE CASCADE,
  FOREIGN KEY (poll_id,candidate_id) REFERENCES destination_candidates(poll_id,id) ON DELETE CASCADE
);
