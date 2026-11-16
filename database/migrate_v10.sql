-- v10: One-time upgrade for existing MySQL databases.
-- BACK UP YOUR DATABASE FIRST. Run after selecting your JoyJourney database.
-- SETUP-AND-START.bat runs this upgrade automatically when required.
ALTER TABLE trip_checklist_items
  ADD COLUMN assigned_to INT NULL AFTER created_by,
  ADD INDEX idx_checklist_assignee (trip_id,assigned_to),
  ADD CONSTRAINT fk_checklist_assignee FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL;

-- Keep existing items. Give them to their creators if still trip members.
UPDATE trip_checklist_items c
JOIN trip_members m ON m.trip_id=c.trip_id AND m.user_id=c.created_by
SET c.assigned_to=c.created_by
WHERE c.assigned_to IS NULL;
