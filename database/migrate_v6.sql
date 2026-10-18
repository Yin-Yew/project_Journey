-- v6: Make destination polls visible and votable by every logged-in JoyJourney user.
-- Run AFTER migrate_v5.sql on existing installs. Back up the joyjourney database first.
-- Existing polls, suggestions, and votes are retained. No trip data is changed.
USE joyjourney;

-- v5 required an invite code on each poll; v6 does not create/require one.
-- Keep old codes in legacy rows rather than deleting data.
ALTER TABLE destination_polls MODIFY COLUMN invite_code CHAR(10) NULL DEFAULT NULL;

-- v5 votes refer to destination_poll_members, which prevents a new site user
-- from voting without joining. Remove that FK (its generated name can vary).
SET @old_members_fk = (
 SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'destination_votes'
   AND REFERENCED_TABLE_NAME = 'destination_poll_members'
 LIMIT 1
);
SET @statement = IF(@old_members_fk IS NULL, 'DO 0',
 CONCAT('ALTER TABLE `destination_votes` DROP FOREIGN KEY `', REPLACE(@old_members_fk,'`','``'), '`'));
PREPARE stmt FROM @statement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Protect vote integrity directly via users instead of legacy poll membership.
SET @user_fk_exists = (
 SELECT COUNT(*) FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'destination_votes'
   AND REFERENCED_TABLE_NAME = 'users' AND COLUMN_NAME = 'user_id'
);
SET @statement = IF(@user_fk_exists > 0, 'DO 0',
 'ALTER TABLE `destination_votes` ADD CONSTRAINT `fk_destination_votes_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE');
PREPARE stmt FROM @statement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- The old destination_poll_members table stays in the database as legacy data;
-- it no longer controls visibility or participation and may be archived later.
