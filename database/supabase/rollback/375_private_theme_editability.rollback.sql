-- No destructive downgrade: making retained private themes uneditable would break
-- owner access. Roll back application code without hiding merchant-owned designs.
BEGIN;
SELECT 1;
COMMIT;
