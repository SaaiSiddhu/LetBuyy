-- Rollback of 236: restore the grants 231 and 232 gave service_role on the stored-value tables.
--
-- Not destructive to data: 236 changes privileges only, and this restores exactly what 231 and 232
-- granted. It DOES restore the hole 236 closed -- application code could again UPDATE
-- ad_campaigns.allocated_minor, minting ad credit with no ledger entry behind it -- so roll back only
-- to unblock a writer that turns out to need direct access, and fix that writer rather than living
-- here. Nothing in the repository needed these grants when 236 was written.

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN RETURN; END IF;

  GRANT SELECT, INSERT, UPDATE, DELETE ON public.loyalty_accounts TO service_role;
  GRANT SELECT, INSERT, UPDATE, DELETE ON public.loyalty_ledger_entries TO service_role;
  GRANT SELECT, INSERT, UPDATE, DELETE ON public.ad_credit_accounts TO service_role;
  GRANT SELECT, INSERT, UPDATE, DELETE ON public.ad_credit_ledger_entries TO service_role;

  -- The column-level grants must be dropped before the table-level one is restored, or the
  -- per-column entries linger in the ACL alongside it.
  REVOKE INSERT, UPDATE ON public.ad_campaigns FROM service_role;
  GRANT SELECT, INSERT, UPDATE, DELETE ON public.ad_campaigns TO service_role;
END
$$;

COMMIT;
