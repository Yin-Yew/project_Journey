-- JoyJourney v8: voting schedule for the one shared anonymous destination board.
-- Run once after migrate_v7.sql on preexisting non-demo installs.
-- Existing locations and ballots are preserved.
USE joyjourney;

-- Safe to re-run on MySQL 8; columns are only added when absent.
SET @column_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='next_trip_board' AND COLUMN_NAME='start_at');
SET @statement = IF(@column_exists=0,
  'ALTER TABLE next_trip_board ADD COLUMN start_at DATETIME NULL DEFAULT NULL','DO 0');
PREPARE stmt FROM @statement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='next_trip_board' AND COLUMN_NAME='end_at');
SET @statement = IF(@column_exists=0,
  'ALTER TABLE next_trip_board ADD COLUMN end_at DATETIME NULL DEFAULT NULL','DO 0');
PREPARE stmt FROM @statement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- A previous v7 board receives its initial seven-day schedule on first page view.
-- The voting page owner may change these times later.
