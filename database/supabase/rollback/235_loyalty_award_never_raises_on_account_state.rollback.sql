-- Rollback of 235: restore 231's behaviour, where a frozen or closed loyalty account RAISES.
--
-- Not destructive to data. It DOES restore the hazard 235 removed: any caller on the payment path
-- would then fail when a buyer's account is frozen. Re-apply 231's definition to roll back.

BEGIN;
-- Intentionally empty: re-apply migration 231's award_loyalty_points definition to revert.
COMMIT;
