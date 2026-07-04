-- 184_v1_subscription_coupons.sql
-- Platform-level subscription coupons: LetBuyy -> merchant plan discounts.
-- Distinct from the site-scoped storefront `coupons` table (merchant -> customer).
-- Server-authoritative: validation + discount are computed in validate_subscription_coupon();
-- redemption is recorded ONLY on a verified payment via redeem_subscription_coupon().
-- Money is stored in minor units (paise), consistent with the rest of the ledger.

-- ── Catalog ──────────────────────────────────────────────────────────────────
create table if not exists public.subscription_coupons (
    id uuid primary key default gen_random_uuid(),
    code text not null,
    description text,
    discount_type text not null check (discount_type in ('percentage', 'fixed_amount')),
    percent_off numeric(5, 2) check (percent_off is null or (percent_off > 0 and percent_off <= 100)),
    amount_off_minor bigint check (amount_off_minor is null or amount_off_minor > 0),
    applies_to_plan_slugs text[],                                   -- null = all plans
    applies_to_billing text check (applies_to_billing in ('monthly', 'yearly')), -- null = both
    min_amount_minor bigint not null default 0 check (min_amount_minor >= 0),
    max_redemptions integer check (max_redemptions is null or max_redemptions > 0),
    per_merchant_limit integer not null default 1 check (per_merchant_limit > 0),
    used_count integer not null default 0 check (used_count >= 0),
    valid_from timestamptz not null default now(),
    valid_until timestamptz,
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint subscription_coupons_value_chk check (
        (discount_type = 'percentage' and percent_off is not null and amount_off_minor is null)
        or (discount_type = 'fixed_amount' and amount_off_minor is not null and percent_off is null)
    )
);

create unique index if not exists subscription_coupons_code_key
    on public.subscription_coupons (upper(code));

-- ── Redemptions (usage ledger) ───────────────────────────────────────────────
create table if not exists public.subscription_coupon_redemptions (
    id uuid primary key default gen_random_uuid(),
    coupon_id uuid not null references public.subscription_coupons(id) on delete cascade,
    site_id uuid not null references public.sites(id) on delete cascade,
    user_id uuid,
    plan_slug text not null,
    billing_period text not null,
    amount_before_minor bigint not null,
    discount_minor bigint not null,
    amount_after_minor bigint not null,
    razorpay_order_id text,
    razorpay_payment_id text,
    idempotency_key text not null,
    redeemed_at timestamptz not null default now()
);

create unique index if not exists subscription_coupon_redemptions_idem_key
    on public.subscription_coupon_redemptions (idempotency_key);
create index if not exists subscription_coupon_redemptions_coupon_idx
    on public.subscription_coupon_redemptions (coupon_id);
create index if not exists subscription_coupon_redemptions_site_idx
    on public.subscription_coupon_redemptions (site_id);

-- ── RLS: locked. Only service_role (gateway) + SECURITY DEFINER RPCs touch these.
alter table public.subscription_coupons enable row level security;
alter table public.subscription_coupons force row level security;
alter table public.subscription_coupon_redemptions enable row level security;
alter table public.subscription_coupon_redemptions force row level security;
-- No permissive policies: no public USING(true). service_role bypasses RLS; the
-- validate/redeem functions below run SECURITY DEFINER for least-privilege reads/writes.

-- ── Validation (read-only): returns a JSON verdict + computed discount ────────
create or replace function public.validate_subscription_coupon(
    p_code text,
    p_plan_slug text,
    p_billing_period text,
    p_amount_minor bigint,
    p_site_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_coupon public.subscription_coupons%rowtype;
    v_discount_minor bigint := 0;
    v_used_by_merchant integer := 0;
begin
    if p_code is null or btrim(p_code) = '' then
        return jsonb_build_object('valid', false, 'message', 'Enter a coupon code');
    end if;

    select * into v_coupon
    from public.subscription_coupons
    where upper(code) = upper(btrim(p_code))
    limit 1;

    if not found then
        return jsonb_build_object('valid', false, 'message', 'Coupon not found');
    end if;
    if not v_coupon.is_active then
        return jsonb_build_object('valid', false, 'message', 'This coupon is no longer active');
    end if;
    if now() < v_coupon.valid_from then
        return jsonb_build_object('valid', false, 'message', 'This coupon is not active yet');
    end if;
    if v_coupon.valid_until is not null and now() > v_coupon.valid_until then
        return jsonb_build_object('valid', false, 'message', 'This coupon has expired');
    end if;
    if v_coupon.applies_to_plan_slugs is not null
        and not (p_plan_slug = any(v_coupon.applies_to_plan_slugs)) then
        return jsonb_build_object('valid', false, 'message', 'Coupon is not valid for this plan');
    end if;
    if v_coupon.applies_to_billing is not null and v_coupon.applies_to_billing <> p_billing_period then
        return jsonb_build_object('valid', false, 'message', 'Coupon is not valid for this billing period');
    end if;
    if p_amount_minor < v_coupon.min_amount_minor then
        return jsonb_build_object('valid', false, 'message', 'Order amount is too low for this coupon');
    end if;
    if v_coupon.max_redemptions is not null and v_coupon.used_count >= v_coupon.max_redemptions then
        return jsonb_build_object('valid', false, 'message', 'This coupon has reached its redemption limit');
    end if;

    select count(*) into v_used_by_merchant
    from public.subscription_coupon_redemptions
    where coupon_id = v_coupon.id and site_id = p_site_id;

    if v_used_by_merchant >= v_coupon.per_merchant_limit then
        return jsonb_build_object('valid', false, 'message', 'You have already used this coupon');
    end if;

    if v_coupon.discount_type = 'percentage' then
        v_discount_minor := floor(p_amount_minor::numeric * v_coupon.percent_off / 100.0)::bigint;
    else
        v_discount_minor := v_coupon.amount_off_minor;
    end if;

    if v_discount_minor > p_amount_minor then
        v_discount_minor := p_amount_minor;  -- never below zero
    end if;
    if v_discount_minor < 0 then
        v_discount_minor := 0;
    end if;

    return jsonb_build_object(
        'valid', true,
        'coupon_id', v_coupon.id,
        'code', upper(v_coupon.code),
        'discount_type', v_coupon.discount_type,
        'percent_off', v_coupon.percent_off,
        'amount_off_minor', v_coupon.amount_off_minor,
        'discount_minor', v_discount_minor,
        'final_minor', p_amount_minor - v_discount_minor,
        'description', v_coupon.description,
        'message', 'Coupon applied'
    );
end;
$$;

-- ── Redemption (mutation): idempotent, locks the coupon, increments usage ─────
create or replace function public.redeem_subscription_coupon(
    p_code text,
    p_site_id uuid,
    p_user_id uuid,
    p_plan_slug text,
    p_billing_period text,
    p_amount_before_minor bigint,
    p_discount_minor bigint,
    p_amount_after_minor bigint,
    p_razorpay_order_id text,
    p_razorpay_payment_id text,
    p_idempotency_key text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_coupon public.subscription_coupons%rowtype;
    v_existing uuid;
begin
    select id into v_existing
    from public.subscription_coupon_redemptions
    where idempotency_key = p_idempotency_key;
    if found then
        return jsonb_build_object('recorded', true, 'idempotent', true);
    end if;

    select * into v_coupon
    from public.subscription_coupons
    where upper(code) = upper(btrim(p_code))
    for update;

    if not found then
        return jsonb_build_object('recorded', false, 'message', 'Coupon not found');
    end if;

    insert into public.subscription_coupon_redemptions (
        coupon_id, site_id, user_id, plan_slug, billing_period,
        amount_before_minor, discount_minor, amount_after_minor,
        razorpay_order_id, razorpay_payment_id, idempotency_key
    ) values (
        v_coupon.id, p_site_id, p_user_id, p_plan_slug, p_billing_period,
        p_amount_before_minor, p_discount_minor, p_amount_after_minor,
        p_razorpay_order_id, p_razorpay_payment_id, p_idempotency_key
    )
    on conflict (idempotency_key) do nothing;

    update public.subscription_coupons
    set used_count = used_count + 1, updated_at = now()
    where id = v_coupon.id;

    return jsonb_build_object('recorded', true, 'idempotent', false, 'coupon_id', v_coupon.id);
end;
$$;

revoke all on function public.validate_subscription_coupon(text, text, text, bigint, uuid) from public;
revoke all on function public.redeem_subscription_coupon(text, uuid, uuid, text, text, bigint, bigint, bigint, text, text, text) from public;
grant execute on function public.validate_subscription_coupon(text, text, text, bigint, uuid) to authenticated, service_role;
grant execute on function public.redeem_subscription_coupon(text, uuid, uuid, text, text, bigint, bigint, bigint, text, text, text) to service_role;

-- ── Seed two launch coupons so checkout works end-to-end (idempotent) ─────────
insert into public.subscription_coupons
    (code, description, discount_type, percent_off, applies_to_billing, valid_until, max_redemptions, per_merchant_limit)
values
    ('LAUNCH20', 'Launch offer — 20% off your first payment', 'percentage', 20.00, null, now() + interval '180 days', 1000, 1)
on conflict (upper(code)) do nothing;

insert into public.subscription_coupons
    (code, description, discount_type, amount_off_minor, applies_to_billing, valid_until, max_redemptions, per_merchant_limit)
values
    ('BHARAT500', '₹500 off any annual plan', 'fixed_amount', 50000, 'yearly', now() + interval '180 days', 1000, 1)
on conflict (upper(code)) do nothing;
