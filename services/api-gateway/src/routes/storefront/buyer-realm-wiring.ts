// D-8 / D-9 — every gateway-side wiring for the marketplace BUYER realm, in one place.
//
// Extracted from customer-engagement-routes.ts, which this pushed past the 1500-line route budget
// twice: ROUTE-1 had just given that file headroom and three buyer domains consumed it. The split is
// by BOUNDARY, not by size — a buyer is platform-level and carries no store_id, so none of this
// belonged beside the per-store customer lifecycle it was sitting in.
//
// True of every query below: buyer-owned tables are reached with the buyer id from a VERIFIED
// session, never a request parameter, and every buyer_notifications query carries
// .eq('buyer_account_id', ...). A source contract enforces that second point, because the route tests
// use fakes and a fake that models the scoping cannot prove the scoping.

import type { Hono } from 'hono';
import type { Env } from '../../index';
import { getSupabaseAdmin } from '../../lib/supabase';
import { registerBuyerAccountRoutes, BUYER_ACCOUNT_COLUMNS } from './buyer-account-routes';
import { registerBuyerNotificationRoutes, BUYER_NOTIFICATION_COLUMNS } from './buyer-notification-routes';
import { registerBuyerReturnRoutes, type BuyerReturnRequestRow } from './buyer-return-routes';
import { registerMobileReleaseRoutes } from './mobile-release-routes';
import { registerSellerFollowRoutes } from './seller-follow-routes';
import type { AppContext } from './customer-engagement-routes';

export interface BuyerRealmRoutesDeps {
    normalizeEmail: (email: string) => string;
    requireStorefrontInternal: (c: AppContext) => Promise<Response | null>;
}

export function registerBuyerRealmRoutes(
    router: Hono<{ Bindings: Env }>,
    deps: BuyerRealmRoutesDeps,
): void {
    const { normalizeEmail, requireStorefrontInternal } = deps;

    registerBuyerAccountRoutes(router, {
        normalizeEmail,
        requireStorefrontInternal,
        loadBuyerByEmail: async (c, email) => getSupabaseAdmin(c)
            .from('buyer_accounts')
            .select(BUYER_ACCOUNT_COLUMNS)
            .eq('email', email)
            .maybeSingle(),
        insertBuyer: async (c, row) => getSupabaseAdmin(c)
            .from('buyer_accounts')
            .insert(row)
            .select(BUYER_ACCOUNT_COLUMNS)
            .single(),
        setBuyerPassword: async (c, id, passwordHash) => getSupabaseAdmin(c)
            .from('buyer_accounts')
            .update({ password_hash: passwordHash, status: 'active' })
            .eq('id', id)
            .select(BUYER_ACCOUNT_COLUMNS)
            .single(),
        loadBuyerById: async (c, id) => getSupabaseAdmin(c)
            .from('buyer_accounts')
            .select(BUYER_ACCOUNT_COLUMNS)
            .eq('id', id)
            .maybeSingle(),
        findOrCreateStoreCustomer: async (c, storeId, email) => {
            const db = getSupabaseAdmin(c);
            const existing = await db
                .from('store_customers')
                .select('id')
                .eq('store_id', storeId)
                .eq('email', email)
                .maybeSingle<{ id: string }>();
            if (existing.error) return { data: null, error: existing.error };
            if (existing.data) return { data: existing.data, error: null };
            // store_customers is UNIQUE (store_id, email), so a concurrent create loses the race
            // rather than duplicating. onConflict returns the winner instead of failing.
            return db
                .from('store_customers')
                .upsert({ store_id: storeId, email }, { onConflict: 'store_id,email' })
                .select('id')
                .single<{ id: string }>();
        },
        linkBuyerToStoreCustomer: async (c, link) => {
            // ignoreDuplicates: migration 223's unique indexes already guarantee one link per
            // store_customers row and one per (buyer, site). Re-linking is a no-op, not an error --
            // a shopper returning to a seller they already have an account with must not fail.
            const { error } = await getSupabaseAdmin(c)
                .from('buyer_store_customers')
                .upsert(
                    {
                        buyer_account_id: link.buyerAccountId,
                        store_customer_id: link.storeCustomerId,
                        site_id: link.siteId,
                    },
                    { onConflict: 'buyer_account_id,store_customer_id', ignoreDuplicates: true },
                );
            return { error };
        },
    });

    // CAP-FB-NOTIF (D-9): the buyer's own inbox. Every read and write is scoped by the buyer id the
    // route takes from a VERIFIED session — never a request parameter.
    registerBuyerNotificationRoutes(router, {
        listNotifications: async (c, buyerAccountId, limit) => getSupabaseAdmin(c)
            .from('buyer_notifications')
            .select(BUYER_NOTIFICATION_COLUMNS)
            .eq('buyer_account_id', buyerAccountId)
            .order('created_at', { ascending: false })
            .limit(limit),
        countUnread: async (c, buyerAccountId) => {
            const { count, error } = await getSupabaseAdmin(c)
                .from('buyer_notifications')
                .select('id', { count: 'exact', head: true })
                .eq('buyer_account_id', buyerAccountId)
                .is('read_at', null);
            return { count: count ?? 0, error };
        },
        // Scoped by BOTH ids. Without the buyer predicate any signed-in buyer could mark any
        // notification read, and the same omission on a read would expose another inbox entirely.
        markRead: async (c, buyerAccountId, notificationId) => getSupabaseAdmin(c)
            .from('buyer_notifications')
            .update({ read_at: new Date().toISOString() })
            .eq('id', notificationId)
            .eq('buyer_account_id', buyerAccountId)
            .select(BUYER_NOTIFICATION_COLUMNS)
            .maybeSingle(),
        markAllRead: async (c, buyerAccountId) => {
            const { error } = await getSupabaseAdmin(c)
                .from('buyer_notifications')
                .update({ read_at: new Date().toISOString() })
                .eq('buyer_account_id', buyerAccountId)
                .is('read_at', null);
            return { error };
        },
    });

    // CAP-FB-RETURNS (D-9): a buyer opening a return on their OWN order. Ownership is walked through
    // buyer_store_customers rather than trusted from the request — orders has no customer FK, only
    // customer_email, so the link table is what ties a platform buyer to a seller's order.

    // CAP-FB-RETURNS (D-9): ONE rpc call. The ownership walk, the duplicate check and the insert all
    // happen inside request_order_return (migration 225), so this file never reaches return_requests
    // — a genuine tenant table merchants read — with the admin client, and the check-then-insert
    // cannot race.
    registerBuyerReturnRoutes(router, {
        requestOrderReturn: async (c, input) => {
            const { data, error } = await getSupabaseAdmin(c).rpc('request_order_return', {
                p_buyer_account_id: input.buyerAccountId,
                p_order_id: input.orderId,
                p_reason: input.reason,
                p_description: input.description,
            });

            // 23505 is the RPC's own signal that a return is already open, chosen so the caller can
            // tell it from a generic failure without parsing a message.
            const code = (error as { code?: string } | null)?.code;
            if (code === '23505') return { data: null, error: null, alreadyOpen: true };
            if (error) return { data: null, error };

            const rows = (data ?? []) as BuyerReturnRequestRow[];
            // No row means the order is not this buyer's OR does not exist. The RPC does not
            // distinguish them and neither does the caller.
            return { data: rows[0] ?? null, error: null };
        },
        listBuyerReturnRequests: async (c, buyerAccountId, limit) => {
            const db = getSupabaseAdmin(c);
            const links = await db
                .from('buyer_store_customers')
                .select('store_customer_id')
                .eq('buyer_account_id', buyerAccountId);
            if (links.error) return { data: null, error: links.error };
            const linkRows = links.data ?? [];
            if (linkRows.length === 0) return { data: [], error: null };

            const customers = await db
                .from('store_customers')
                .select('store_id, email')
                .in('id', linkRows.map((row) => row.store_customer_id as string));
            if (customers.error) return { data: null, error: customers.error };
            const owned = customers.data ?? [];
            if (owned.length === 0) return { data: [], error: null };

            const orders = await db
                .from('orders')
                .select('id, site_id, customer_email')
                .in('site_id', owned.map((customer) => customer.store_id as string));
            if (orders.error) return { data: null, error: orders.error };

            // Narrowing by site alone is not enough — a seller has many customers. Both the seller
            // AND the email must match, the same pair the RPC checks on the write path.
            const ownedOrderIds = (orders.data ?? [])
                .filter((order) => owned.some((customer) =>
                    customer.store_id === order.site_id
                    && String(customer.email).toLowerCase() === String(order.customer_email).toLowerCase()))
                .map((order) => order.id as string);
            if (ownedOrderIds.length === 0) return { data: [], error: null };

            return db
                .from('return_requests')
                .select('id, order_id, reason, description, status, created_at')
                .in('order_id', ownedOrderIds)
                .order('created_at', { ascending: false })
                .limit(limit);
        },
    });

    // CAP-FB-APPUPDATE (D-9): the mobile release gate. Public and unauthenticated — it must answer
    // for a build too old to log in. Registered here because this module already composes the
    // marketplace-client surface, though it is not buyer-scoped: every store's buyers run the same
    // binary, so a release belongs to the platform.
    registerSellerFollowRoutes(router, {
        // ON CONFLICT DO NOTHING makes a repeat follow one row rather than an error, and `created`
        // still distinguishes "now following" from "already following". 229's PK is what makes this
        // safe under concurrency: two simultaneous follows cannot produce two rows.
        follow: async (c, buyerAccountId, siteId) => {
            const { data, error } = await getSupabaseAdmin(c)
                .from('seller_follows')
                .upsert({ buyer_account_id: buyerAccountId, site_id: siteId }, { onConflict: 'buyer_account_id,site_id', ignoreDuplicates: true })
                .select('site_id')
                .maybeSingle();
            return { created: Boolean(data), error };
        },
        unfollow: async (c, buyerAccountId, siteId) => {
            const { data, error } = await getSupabaseAdmin(c)
                .from('seller_follows')
                .delete()
                .eq('buyer_account_id', buyerAccountId)
                .eq('site_id', siteId)
                .select('site_id')
                .maybeSingle();
            return { removed: Boolean(data), error };
        },
        // Joined to sites and filtered to currently-published sellers. 229's trigger stops a follow
        // being CREATED on an unpublished site; a site unpublished afterwards keeps its rows (the
        // buyer's data is not the merchant's to delete) and disappears from reads here instead.
        listFollowing: async (c, buyerAccountId, limit) => {
            const { data, error } = await getSupabaseAdmin(c)
                .from('seller_follows')
                .select('site_id, followed_at, sites!inner(store_name, subdomain, status, deleted_at)')
                .eq('buyer_account_id', buyerAccountId)
                .eq('sites.status', 'published')
                .is('sites.deleted_at', null)
                .order('followed_at', { ascending: false })
                .limit(limit);
            const rows = (data || []).map((row) => {
                const site = (row as { sites?: { store_name?: string | null; subdomain?: string | null } }).sites;
                return {
                    site_id: (row as { site_id: string }).site_id,
                    followed_at: (row as { followed_at: string }).followed_at,
                    store_name: site?.store_name ?? null,
                    subdomain: site?.subdomain ?? null,
                };
            });
            return { data: error ? null : rows, error };
        },
        isFollowing: async (c, buyerAccountId, siteId) => {
            const { data, error } = await getSupabaseAdmin(c)
                .from('seller_follows')
                .select('site_id')
                .eq('buyer_account_id', buyerAccountId)
                .eq('site_id', siteId)
                .maybeSingle();
            return { following: Boolean(data), error };
        },
        // head:true so the rows are never transferred: the count is the whole answer, and shipping
        // follower rows to compute a number would hand out the identities this phase withholds.
        countFollowers: async (c, siteId) => {
            const { count, error } = await getSupabaseAdmin(c)
                .from('seller_follows')
                .select('site_id', { count: 'exact', head: true })
                .eq('site_id', siteId);
            return { count: count ?? null, error };
        },
    });

    registerMobileReleaseRoutes(router, {
        loadLatestRelease: async (c, platform, applicationId) => getSupabaseAdmin(c)
            .from('mobile_app_releases')
            .select('build_number, version_name, minimum_supported_build, update_url, message')
            .eq('platform', platform)
            .eq('application_id', applicationId)
            .eq('is_active', true)
            .order('build_number', { ascending: false })
            .limit(1)
            .maybeSingle(),
    });
}
