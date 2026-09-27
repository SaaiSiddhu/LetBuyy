-- Phase 2 / F2.7 (Section 10): close the check-then-insert race in privacy-request idempotency.
--
-- buyer-privacy-routes.ts's "at most one OPEN request per (buyer, type)" rule was previously
-- enforced only by an application-level find-then-create -- two concurrent requests from the same
-- buyer could both pass the find (neither sees the other's not-yet-committed row) and both insert,
-- producing two open tickets for the same (buyer, type). A partial unique index makes the second
-- concurrent insert fail at the database with SQLSTATE 23505 (unique_violation); the route catches
-- that specific code and returns the row the other request created (the same recovery-by-conflict
-- pattern contact-public.ts already uses for its own idempotency).
--
-- Partial (topic='privacy', status NOT IN resolved/closed, not soft-deleted) so the constraint
-- covers only "is there already an unresolved privacy request of this type", never a resolved one
-- (a buyer must be able to open a new request after their last one closed) and never a non-privacy
-- ticket (this index says nothing about ordinary support conversations).
CREATE UNIQUE INDEX support_tickets_privacy_open_request_uidx
  ON public.support_tickets (requester_user_id, (metadata->>'privacy_request_type'))
  WHERE topic = 'privacy'
    AND status NOT IN ('resolved', 'closed')
    AND deleted_at IS NULL;
