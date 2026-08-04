-- Rollback for 195_contact_requests.sql
--
-- Drops the contact-form intake surface in dependency order: the RPC first
-- (nothing depends on it), then the trigger and its function, then the table
-- (which takes its own indexes, constraints and policy with it), then the
-- sequence the ticket-reference default drew from.
--
-- DESTRUCTIVE. Unlike the migrations either side of it, this one deletes rows:
-- contact_requests holds real enquiries from real people, and dropping the
-- table discards every ticket, its message and its operator notes. Export
-- before running it in any environment where a person has ever submitted the
-- form:
--
--   \copy (SELECT * FROM public.contact_requests ORDER BY created_at)
--     TO 'contact_requests_backup.csv' WITH CSV HEADER
--
-- Re-runnable: every statement is IF EXISTS, so a partial rollback can be
-- finished by running the file again.

-- (1) The two-factor status lookup. SECURITY DEFINER, so it is removed before
--     the table it reads — a definer function over a missing table is a
--     runtime error rather than a no-op.
DROP FUNCTION IF EXISTS public.get_contact_request_status(text, text);

-- (2) updated_at maintenance. The trigger goes before its function; dropping
--     the function first would fail on the dependency.
DROP TRIGGER IF EXISTS contact_requests_touch_updated_at ON public.contact_requests;
DROP FUNCTION IF EXISTS public.touch_contact_requests_updated_at();

-- (3) The ticket-reference generator. Dropped before the table because the
--     table's DEFAULT references it.
ALTER TABLE IF EXISTS public.contact_requests
    ALTER COLUMN ticket_ref DROP DEFAULT;
DROP FUNCTION IF EXISTS public.next_contact_ticket_ref();

-- (4) The table. Its indexes, CHECK constraints and the service_role policy
--     are owned by it and go with it.
DROP TABLE IF EXISTS public.contact_requests;

-- (5) The sequence last: while the table existed, its DEFAULT depended on it.
DROP SEQUENCE IF EXISTS public.contact_requests_ticket_seq;
