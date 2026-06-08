-- Verification for 107_security_rls_hardening_and_payment_uniqueness.sql.
-- Run after applying migration 107 to a local/staging/production database.
-- It fails if the sensitive credential/session/customer-auth policies are still
-- reachable by public/anon/authenticated roles or if own-row policies remain
-- broad `USING (true)` policies.

DO $$
DECLARE
    v_failures text;
BEGIN
    WITH expected_service_policies(tablename, policyname, cmd) AS (
        VALUES
            ('devices', 'Service role full access', 'ALL'),
            ('sessions', 'Service role full access', 'ALL'),
            ('users_custom', 'Service role full access', 'ALL'),
            ('verification_tokens', 'Service role full access', 'ALL'),
            ('customer_credentials', 'Service role manages customer credentials', 'ALL'),
            ('notifications', 'Service role inserts notifications', 'INSERT'),
            ('contacts', 'contacts_service_all', 'ALL'),
            ('projects', 'projects_service_all', 'ALL'),
            ('employee_permissions', 'employee_permissions_service_write', 'ALL')
    ),
    bad_service_policies AS (
        SELECT e.tablename, e.policyname
          FROM expected_service_policies e
          LEFT JOIN pg_policies p
            ON p.schemaname = 'public'
           AND p.tablename = e.tablename
           AND p.policyname = e.policyname
         WHERE p.policyname IS NULL
            OR p.cmd <> e.cmd
            OR NOT ('service_role' = ANY (p.roles))
            OR array_length(p.roles, 1) <> 1
    )
    SELECT string_agg(tablename || ':' || policyname, ', ' ORDER BY tablename, policyname)
      INTO v_failures
      FROM bad_service_policies;

    IF v_failures IS NOT NULL THEN
        RAISE EXCEPTION 'Migration 107 service-role policy hardening is incomplete: %', v_failures;
    END IF;

    WITH bad_own_row_policies AS (
        SELECT tablename, policyname
          FROM pg_policies
         WHERE schemaname = 'public'
           AND (
               (tablename = 'notifications'
                AND policyname IN ('Users view own notifications', 'Users update own notifications', 'Users delete own notifications')
                AND COALESCE(qual, '') NOT LIKE '%user_id = auth.uid()%')
            OR (tablename = 'theme_reviews'
                AND policyname = 'Users manage own theme reviews'
                AND (COALESCE(qual, '') NOT LIKE '%user_id = auth.uid()%' OR COALESCE(with_check, '') NOT LIKE '%user_id = auth.uid()%'))
            OR (tablename = 'notification_preferences'
                AND policyname = 'users_own_notification_preferences'
                AND (COALESCE(qual, '') NOT LIKE '%user_id = auth.uid()%' OR COALESCE(with_check, '') NOT LIKE '%user_id = auth.uid()%'))
           )
    )
    SELECT string_agg(tablename || ':' || policyname, ', ' ORDER BY tablename, policyname)
      INTO v_failures
      FROM bad_own_row_policies;

    IF v_failures IS NOT NULL THEN
        RAISE EXCEPTION 'Migration 107 own-row policy hardening is incomplete: %', v_failures;
    END IF;

    WITH forbidden_permissive_policies AS (
        SELECT tablename, policyname
          FROM pg_policies
         WHERE schemaname = 'public'
           AND (
               (tablename IN ('devices', 'sessions', 'users_custom', 'verification_tokens', 'customer_credentials')
                AND NOT ('service_role' = ANY (roles))
                AND (COALESCE(qual, '') IN ('true', '(true)') OR COALESCE(with_check, '') IN ('true', '(true)')))
            OR (tablename = 'notifications'
                AND policyname IN ('System can insert notifications', 'Users view own notifications', 'Users update own notifications', 'Users delete own notifications')
                AND (COALESCE(qual, '') IN ('true', '(true)') OR COALESCE(with_check, '') IN ('true', '(true)')))
            OR (tablename = 'theme_reviews'
                AND policyname = 'Users manage own theme reviews'
                AND COALESCE(qual, '') IN ('true', '(true)'))
            OR (tablename = 'notification_preferences'
                AND policyname IN ('Users manage their notification preferences', 'users_own_notifications')
                AND (COALESCE(qual, '') IN ('true', '(true)') OR COALESCE(with_check, '') IN ('true', '(true)')))
           )
    )
    SELECT string_agg(tablename || ':' || policyname, ', ' ORDER BY tablename, policyname)
      INTO v_failures
      FROM forbidden_permissive_policies;

    IF v_failures IS NOT NULL THEN
        RAISE EXCEPTION 'Migration 107 left forbidden public/anon/authenticated permissive policies: %', v_failures;
    END IF;

    PERFORM 1
      FROM pg_indexes
     WHERE schemaname = 'public'
       AND tablename = 'payment_transactions'
       AND indexname = 'idx_payment_transactions_provider_payment_global';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Migration 107 payment replay uniqueness index is missing';
    END IF;
END $$;
