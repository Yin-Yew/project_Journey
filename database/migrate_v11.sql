-- v12 private checklist migration. Back up MySQL before running manually.
-- Run against the existing JoyJourney database; the setup script also applies it.
-- Account that CREATED each v11 checklist row now owns and privately sees it.
UPDATE trip_checklist_items
SET assigned_to = created_by
WHERE created_by IS NOT NULL
  AND (assigned_to IS NULL OR assigned_to <> created_by);

-- If a creator's account was deleted, put the orphaned entry under the trip owner.
UPDATE trip_checklist_items c JOIN trips t ON t.id=c.trip_id
SET c.assigned_to=t.owner_id
WHERE c.assigned_to IS NULL;
