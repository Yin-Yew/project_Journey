-- JoyJourney v7: simplified, single shared Next Trip voting board.
-- Non-destructive manual upgrade; existing votes remain.
USE joyjourney;
CREATE TABLE IF NOT EXISTS next_trip_board (
  slot TINYINT UNSIGNED NOT NULL PRIMARY KEY,
  poll_id INT NOT NULL UNIQUE,
  CONSTRAINT fk_next_trip_shared_poll FOREIGN KEY (poll_id) REFERENCES destination_polls(id) ON DELETE RESTRICT
);
-- The board automatically adopts the oldest OPEN existing poll on first view;
-- if there are none, the first user to view it initializes an empty board.
