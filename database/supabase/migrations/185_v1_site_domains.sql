-- 185_v1_site_domains.sql
-- Multi-domain Domain Center: a store may connect MANY custom domains, exactly one
-- of which is `primary` (serves the storefront); the rest are `redirect` (301 → primary).
-- Supersedes the single `sites.custom_domain` column, which is kept in sync (the primary
-- domain) for backward compatibility with existing storefront host resolution.
--
-- Real verification only: TXT/CNAME checks (DoH) + Vercel TLS happen in the gateway;
-- this schema persists state + an append-only verification history. No fabricated status.

-- ── Connected domains (multi-domain, one primary per site) ────────────────────
create table if not exists public.site_domains (
    id uuid primary key default gen_random_uuid(),
    site_id uuid not null references public.sites(id) on delete cascade,
    domain text not null,
    role text not null default 'redirect' check (role in ('primary', 'redirect')),
    status text not null default 'pending'
        check (status in ('none', 'pending', 'review', 'verifying', 'active', 'error')),
    ssl_status text not null default 'unknown'
        check (ssl_status in ('unknown', 'pending', 'active', 'error', 'unavailable')),
    provider text,                       -- detected merchant DNS host (cloudflare/godaddy/…)
    verification_token text,             -- TXT ownership challenge
    redirect_to text,                    -- role='redirect': target host (null ⇒ the primary)
    last_checked_at timestamptz,
    connected_at timestamptz,
    metadata jsonb not null default '{}'::jsonb,
    created_by uuid,
    updated_by uuid,
    deleted_by uuid,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    deleted_at timestamptz
);

-- A domain may belong to only one store (case-insensitive, active rows).
create unique index if not exists site_domains_domain_key
    on public.site_domains (lower(domain)) where deleted_at is null;
-- Exactly one primary per site.
create unique index if not exists site_domains_one_primary
    on public.site_domains (site_id) where role = 'primary' and deleted_at is null;
create index if not exists site_domains_site_idx
    on public.site_domains (site_id) where deleted_at is null;
create index if not exists site_domains_status_idx
    on public.site_domains (status) where deleted_at is null;

-- ── Verification history (append-only audit of every check) ───────────────────
create table if not exists public.site_domain_verifications (
    id uuid primary key default gen_random_uuid(),
    site_id uuid not null references public.sites(id) on delete cascade,
    site_domain_id uuid references public.site_domains(id) on delete set null,
    domain text not null,
    check_type text not null
        check (check_type in ('connect', 'verify', 'health', 'set_primary', 'set_redirect', 'delete')),
    status text not null,
    txt_verified boolean not null default false,
    cname_verified boolean not null default false,
    ssl_active boolean not null default false,
    result jsonb not null default '{}'::jsonb,
    checked_by uuid,
    created_at timestamptz not null default now()
);

create index if not exists site_domain_verifications_site_idx
    on public.site_domain_verifications (site_id, created_at desc);
create index if not exists site_domain_verifications_domain_idx
    on public.site_domain_verifications (lower(domain));

-- ── RLS: locked. service_role (gateway, behind verifySiteOwnership) + the SECURITY
-- DEFINER RPCs below are the only writers. No permissive USING(true) policy.
alter table public.site_domains enable row level security;
alter table public.site_domains force row level security;
alter table public.site_domain_verifications enable row level security;
alter table public.site_domain_verifications force row level security;

-- ── Backfill existing single custom_domain → site_domains primary ─────────────
insert into public.site_domains (site_id, domain, role, status, verification_token, connected_at)
select s.id,
       lower(s.custom_domain),
       'primary',
       coalesce(s.custom_domain_status, 'pending'),
       s.custom_domain_verification_token,
       case when s.custom_domain_status = 'active' then now() else null end
from public.sites s
where s.custom_domain is not null
  and s.deleted_at is null
  and not exists (
      select 1 from public.site_domains d
      where lower(d.domain) = lower(s.custom_domain) and d.deleted_at is null
  );

-- ── RPC: set primary domain (atomic demote/promote) ──────────────────────────
-- Promotes p_domain to primary (must be active), demotes the current primary to a
-- redirect that points at the new primary, and mirrors the primary onto sites.custom_domain.
create or replace function public.set_primary_site_domain(
    p_site_id uuid,
    p_domain text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_target public.site_domains%rowtype;
    v_new_primary text;
begin
    v_new_primary := lower(btrim(p_domain));

    select * into v_target
    from public.site_domains
    where site_id = p_site_id and lower(domain) = v_new_primary and deleted_at is null
    for update;

    if not found then
        return jsonb_build_object('ok', false, 'message', 'Domain is not connected to this store');
    end if;
    if v_target.status <> 'active' then
        return jsonb_build_object('ok', false, 'message', 'Only an active, verified domain can be primary');
    end if;
    if v_target.role = 'primary' then
        return jsonb_build_object('ok', true, 'message', 'Domain is already primary', 'domain', v_target.domain);
    end if;

    -- Demote the existing primary to a redirect pointing at the new primary.
    update public.site_domains
    set role = 'redirect', redirect_to = v_new_primary, updated_at = now()
    where site_id = p_site_id and role = 'primary' and deleted_at is null;

    -- Promote the target.
    update public.site_domains
    set role = 'primary', redirect_to = null, updated_at = now()
    where id = v_target.id;

    -- Keep the legacy column in sync (storefront host resolution + back-compat).
    update public.sites
    set custom_domain = v_new_primary,
        custom_domain_status = v_target.status,
        custom_domain_verification_token = v_target.verification_token
    where id = p_site_id;

    return jsonb_build_object('ok', true, 'domain', v_new_primary, 'role', 'primary');
end;
$$;

-- ── RPC: append a verification-history row ───────────────────────────────────
create or replace function public.record_domain_verification(
    p_site_id uuid,
    p_site_domain_id uuid,
    p_domain text,
    p_check_type text,
    p_status text,
    p_txt_verified boolean,
    p_cname_verified boolean,
    p_ssl_active boolean,
    p_result jsonb,
    p_checked_by uuid
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_id uuid;
begin
    insert into public.site_domain_verifications (
        site_id, site_domain_id, domain, check_type, status,
        txt_verified, cname_verified, ssl_active, result, checked_by
    ) values (
        p_site_id, p_site_domain_id, lower(btrim(p_domain)), p_check_type, p_status,
        coalesce(p_txt_verified, false), coalesce(p_cname_verified, false),
        coalesce(p_ssl_active, false), coalesce(p_result, '{}'::jsonb), p_checked_by
    )
    returning id into v_id;
    return v_id;
end;
$$;

revoke all on function public.set_primary_site_domain(uuid, text) from public;
revoke all on function public.record_domain_verification(uuid, uuid, text, text, text, boolean, boolean, boolean, jsonb, uuid) from public;
grant execute on function public.set_primary_site_domain(uuid, text) to service_role;
grant execute on function public.record_domain_verification(uuid, uuid, text, text, text, boolean, boolean, boolean, jsonb, uuid) to service_role;
