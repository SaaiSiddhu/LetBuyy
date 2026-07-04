-- Rollback for 185_v1_site_domains.sql
-- Forward-compatible: drops only what 185 added. The legacy sites.custom_domain column
-- (kept in sync as the primary) is untouched, so single-domain resolution still works.

drop function if exists public.record_domain_verification(uuid, uuid, text, text, text, boolean, boolean, boolean, jsonb, uuid);
drop function if exists public.set_primary_site_domain(uuid, text);

drop table if exists public.site_domain_verifications;
drop table if exists public.site_domains;
