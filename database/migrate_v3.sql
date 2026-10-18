-- Run once on existing v2 JoyJourney databases. Safe to re-run: CREATE IF NOT EXISTS.
-- Back up your database first. Keeps existing trips, memories, expenses and checklist.
USE joyjourney;

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
