-- JoyJourney v9: permanent anonymous Next Trip round history.
USE joyjourney;
CREATE TABLE IF NOT EXISTS next_trip_rounds (
 id INT AUTO_INCREMENT PRIMARY KEY,
 poll_id INT NOT NULL UNIQUE,
 start_at DATETIME NOT NULL,
 end_at DATETIME NOT NULL,
 closed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY (poll_id) REFERENCES destination_polls(id) ON DELETE RESTRICT
);
