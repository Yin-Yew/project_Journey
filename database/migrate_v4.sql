-- v4. Run AFTER the previous v3 migration. Safe to rerun CREATE IF NOT EXISTS.
-- Back up the database. Then execute `node server/migrate-checklist.js` once to
-- copy legacy JSON checklist entries safely and idempotently.
USE joyjourney;
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
