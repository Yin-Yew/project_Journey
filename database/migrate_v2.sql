-- JoyJourney v2 migration: run once if you already installed the previous ZIP.
-- This does not delete existing users, trips, checklist modules or expenses.
USE joyjourney;

ALTER TABLE trips MODIFY COLUMN cover_url MEDIUMTEXT;
ALTER TABLE payments MODIFY COLUMN slip_url MEDIUMTEXT;

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
