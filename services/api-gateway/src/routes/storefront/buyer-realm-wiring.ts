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
import { sendBuyerEmailCode } from '../../lib/buyer-email-code';
import { firebaseSigningKeys, verifyFirebaseIdToken } from '../../lib/firebase-id-token';
import { verifyInternalAppRequest } from '../../lib/internal-auth';
import { getSupabaseAdmin } from '../../lib/supabase';
import { resolveStorefrontCallbackSite } from '../../lib/storefront-callback-site';
import {
    registerBuyerAccountRoutes,
    BUYER_ACCOUNT_COLUMNS,
    type EmailChallengeOutcome,
    type EmailChallengeStart,
    type OrderClaimOutcome,
    type SessionRevocation,
    type StoreLinkOutcome,
} from './buyer-account-routes';
import { registerBuyerAppRoutes, type FirebaseLinkOutcome } from './buyer-app-routes';
import {
    registerBuyerAuthorizationRoutes,
    type AuthorizationCodeIssue,
    type AuthorizationCodeRedemption,
} from './buyer-authorization-routes';
import { registerBuyerNotificationRoutes, BUYER_NOTIFICATION_COLUMNS } from './buyer-notification-routes';
import { registerBuyerReturnRoutes, type BuyerReturnRequestRow } from './buyer-return-routes';
import { registerMobileReleaseRoutes } from './mobile-release-routes';
import { registerSellerFollowRoutes } from './seller-follow-routes';
import { registerPersonalizationRoutes } from './personalization-routes';
import { registerBuyerSupportRoutes, type BuyerTicketRow, type BuyerTicketMessageRow } from './buyer-support-routes';
import { registerBuyerLoyaltyRoutes, type LoyaltySummary, type LoyaltyEntryRow } from './buyer-loyalty-routes';
import { registerSponsoredProductRoutes, type AdSpendResult, type SponsoredPlacementRow } from './sponsored-product-routes';
// The SAME reference generator and SLA defaults the operator surface uses: one ticket system must not
// grow two human-facing reference formats or two SLA clocks depending on who opened the ticket.
import { addBusinessDays, generateTicketRef } from '../operations/support';
import { SUPPORT_DEFAULT_FIRST_RESPONSE_HOURS, SUPPORT_DEFAULT_RESOLUTION_BUSINESS_DAYS } from '@letbuyy/shared-types';
import type { AppContext } from './customer-engagement-routes';

export interface BuyerRealmRoutesDeps {
    normalizeEmail: (email: string) => string;
}

/// identity-platform signs its internal calls as the 'accounts' app (its lib/api/client.ts), the same
/// app name routes/auth.ts accepts for the merchant realm.
async function requireIdentityInternal(c: AppContext): Promise<Response | null> {
    if (await verifyInternalAppRequest(c, 'accounts')) return null;
    return c.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid internal identity signature' } }, 401);
}

/// commerce/web's server signs its internal calls as the 'storefront' app.
async function requireStorefrontInternal(c: AppContext): Promise<Response | null> {
    if (await verifyInternalAppRequest(c, 'storefront')) return null;
    return c.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid internal storefront signature' } }, 401);
}

export function registerBuyerRealmRoutes(
    router: Hono<{ Bindings: Env }>,
    deps: BuyerRealmRoutesDeps,
): void {
    const { normalizeEmail } = deps;

    registerBuyerAccountRoutes(router, {
        normalizeEmail,
        requireIdentityInternal,
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
        loadBuyerById: async (c, id) => getSupabaseAdmin(c)
            .from('buyer_accounts')
            .select(BUYER_ACCOUNT_COLUMNS)
            .eq('id', id)
            .maybeSingle(),
        // Migration 255. Verification, conflict refusal and the audit row are one database decision;
        // the route only maps the outcome.
        linkStoreCustomer: async (c, input) => {
            const { data, error } = await getSupabaseAdmin(c).rpc('link_buyer_store_customer', {
                p_buyer_account_id: input.buyerAccountId,
                p_site_id: input.siteId,
            });
            return { data: (data ?? null) as StoreLinkOutcome | null, error };
        },
        claimOrders: async (c, input) => {
            const { data, error } = await getSupabaseAdmin(c).rpc('claim_buyer_orders', {
                p_buyer_account_id: input.buyerAccountId,
                p_site_id: input.siteId,
            });
            return { data: (data ?? null) as OrderClaimOutcome | null, error };
        },
        // Migration 257. Codes are generated, hashed, limited, expired and audited in the database.
        startEmailChallenge: async (c, input) => {
            const { data, error } = await getSupabaseAdmin(c).rpc('start_buyer_email_challenge', {
                p_buyer_account_id: input.buyerAccountId,
                p_purpose: input.purpose,
            });
            return { data: (data ?? null) as EmailChallengeStart | null, error };
        },
        consumeEmailChallenge: async (c, input) => {
            const { data, error } = await getSupabaseAdmin(c).rpc('consume_buyer_email_challenge', {
                p_buyer_account_id: input.buyerAccountId,
                p_purpose: input.purpose,
                p_code: input.code,
                p_new_password_hash: input.newPasswordHash,
            });
            return { data: (data ?? null) as EmailChallengeOutcome | null, error };
        },
        revokeSessions: async (c, buyerAccountId) => {
            const { data, error } = await getSupabaseAdmin(c).rpc('revoke_buyer_sessions', {
                p_buyer_account_id: buyerAccountId,
            });
            return { data: (data ?? null) as SessionRevocation | null, error };
        },
        sendEmailCode: sendBuyerEmailCode,
    });

    // APPID-P4b (migration 258): storefront sign-in through identity-platform with a first-party code.
    registerBuyerAuthorizationRoutes(router, {
        requireIdentityInternal,
        requireStorefrontInternal,
        // The storefront's own host resolver: a published site, at its primary host.
        resolveRedirectSite: resolveStorefrontCallbackSite,
        issueCode: async (c, input) => {
            const { data, error } = await getSupabaseAdmin(c).rpc('issue_buyer_authorization_code', {
                p_buyer_account_id: input.buyerAccountId,
                p_client_id: input.clientId,
                p_redirect_uri: input.redirectUri,
                p_site_id: input.siteId,
                p_code_challenge: input.codeChallenge,
            });
            return { data: (data ?? null) as AuthorizationCodeIssue | null, error };
        },
        redeemCode: async (c, input) => {
            const { data, error } = await getSupabaseAdmin(c).rpc('redeem_buyer_authorization_code', {
                p_code: input.code,
                p_code_verifier: input.codeVerifier,
                p_client_id: input.clientId,
                p_redirect_uri: input.redirectUri,
            });
            return { data: (data ?? null) as AuthorizationCodeRedemption | null, error };
        },
        loadBuyerById: async (c, id) => getSupabaseAdmin(c)
            .from('buyer_accounts')
            .select(BUYER_ACCOUNT_COLUMNS)
            .eq('id', id)
            .maybeSingle(),
    });

    // APPID-P4d (migration 259): the marketplace app's account read and its Firebase migration link.
    registerBuyerAppRoutes(router, {
        loadBuyerById: async (c, id) => getSupabaseAdmin(c)
            .from('buyer_accounts')
            .select(BUYER_ACCOUNT_COLUMNS)
            .eq('id', id)
            .maybeSingle(),
        verifyFirebaseToken: async (_c, token) => verifyFirebaseIdToken(token, firebaseSigningKeys()),
        linkFirebaseUid: async (c, input) => {
            const { data, error } = await getSupabaseAdmin(c).rpc('link_buyer_firebase_uid', {
                p_buyer_account_id: input.buyerAccountId,
                p_firebase_uid: input.firebaseUid,
                p_firebase_project: input.firebaseProject,
                p_firebase_email: input.firebaseEmail,
            });
            return { data: (data ?? null) as FirebaseLinkOutcome | null, error };
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
            // The buyer's orders are the explicit links (migration 255), the same record the write
            // path's request_order_return checks. Matching a store customer's email to an order's
            // contact address proves nothing until its owner has verified it and claimed the order.
            const db = getSupabaseAdmin(c);
            const owned = await db
                .from('buyer_order_links')
                .select('order_id')
                .eq('buyer_account_id', buyerAccountId);
            if (owned.error) return { data: null, error: owned.error };
            const ownedOrderIds = (owned.data ?? []).map((row) => row.order_id as string);
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
    registerSponsoredProductRoutes(router, {
        // A designed CROSS-TENANT read, so it goes through a SECURITY DEFINER function exactly as
        // marketplace_feed (217) does. Every fence — campaign active and in window, placement active,
        // product visible, seller published — lives in the function, where a later caller cannot omit
        // one, and the column list there is an explicit allowlist.
        loadSponsored: async (c, limit) => {
            const { data, error } = await getSupabaseAdmin(c)
                .rpc('marketplace_sponsored_products', { p_limit: limit });
            return { data: (data || null) as SponsoredPlacementRow[] | null, error };
        },
        // The charge is computed inside record_ad_spend from the campaign's own bid. Nothing here
        // passes an amount, because nothing on this side is entitled to choose one.
        recordAdSpend: async (c, input) => {
            const { data, error } = await getSupabaseAdmin(c).rpc('record_ad_spend', {
                p_site_id: input.siteId,
                p_campaign_id: input.campaignId,
                p_event_type: input.eventType,
                p_quantity: 1,
                p_idempotency_key: input.idempotencyKey,
                p_request_id: c.req.header('x-request-id') ?? null,
                p_actor_id: null,
            });
            return { data: (data || null) as AdSpendResult | null, error };
        },
    });

    registerBuyerLoyaltyRoutes(router, {
        // The balance comes from the database's own loyalty_balance() projection. Summing entries
        // here would be a SECOND projection of a money balance, and the two would eventually
        // disagree — the exact defect this ledger replaces.
        loadSummary: async (c, buyerAccountId, siteId) => {
            const db = getSupabaseAdmin(c);
            const program = await db
                .from('loyalty_programs')
                .select('site_id, is_active, earn_rate_bps, redeem_cap_bps, point_value_minor')
                .eq('site_id', siteId)
                .maybeSingle();
            if (program.error) return { data: null, error: program.error };
            if (!program.data) return { data: null, error: null };

            const account = await db
                .from('loyalty_accounts')
                .select('id')
                .eq('site_id', siteId)
                .eq('buyer_account_id', buyerAccountId)
                .maybeSingle();
            if (account.error) return { data: null, error: account.error };

            let balance = 0;
            if (account.data) {
                const projected = await db.rpc('loyalty_balance', { p_loyalty_account_id: (account.data as { id: string }).id });
                if (projected.error) return { data: null, error: projected.error };
                balance = Number(projected.data ?? 0);
            }
            const row = program.data as unknown as Omit<LoyaltySummary, 'balance'>;
            return { data: { ...row, balance }, error: null };
        },
        listEntries: async (c, buyerAccountId, siteId, limit) => {
            const db = getSupabaseAdmin(c);
            const account = await db
                .from('loyalty_accounts')
                .select('id')
                .eq('site_id', siteId)
                .eq('buyer_account_id', buyerAccountId)
                .maybeSingle();
            if (account.error) return { data: null, error: account.error };
            if (!account.data) return { data: [], error: null };

            const { data, error } = await db
                .from('loyalty_ledger_entries')
                .select('id, entry_type, points, balance_after, order_id, created_at')
                .eq('loyalty_account_id', (account.data as { id: string }).id)
                .eq('site_id', siteId)
                .order('created_at', { ascending: false })
                .limit(limit);
            return { data: (data || null) as LoyaltyEntryRow[] | null, error };
        },
    });

    registerBuyerSupportRoutes(router, {
        listTickets: async (c, buyerAccountId, limit) => {
            const { data, error } = await getSupabaseAdmin(c)
                .from('support_tickets')
                .select('id, ticket_ref, subject, status, topic, created_at, last_agent_message_at')
                .eq('requester_user_id', buyerAccountId)
                .eq('requester_type', 'customer')
                .is('deleted_at', null)
                .order('created_at', { ascending: false })
                .limit(limit);
            return { data: (data || null) as BuyerTicketRow[] | null, error };
        },
        // Scoped by BOTH the ticket and the buyer. Scoping by ticket alone would let any buyer read
        // any other buyer's support conversation by guessing a uuid, and the response would look
        // entirely normal.
        getTicket: async (c, buyerAccountId, ticketId) => {
            const { data, error } = await getSupabaseAdmin(c)
                .from('support_tickets')
                .select('id, ticket_ref, subject, status, topic, created_at, last_agent_message_at')
                .eq('id', ticketId)
                .eq('requester_user_id', buyerAccountId)
                .eq('requester_type', 'customer')
                .is('deleted_at', null)
                .maybeSingle();
            return { data: (data || null) as BuyerTicketRow | null, error };
        },
        // visibility = 'internal' is an agent's private note — triage, fraud suspicion, escalation
        // reasoning. It must never reach the buyer, and the filter lives HERE, in the query, so no
        // caller can obtain the unfiltered rows by using this dependency differently.
        listPublicMessages: async (c, ticketId, limit) => {
            const { data, error } = await getSupabaseAdmin(c)
                .from('ticket_messages')
                .select('id, author_type, body, created_at')
                .eq('ticket_id', ticketId)
                .eq('visibility', 'public')
                .is('deleted_at', null)
                .order('created_at', { ascending: true })
                .limit(limit);
            return { data: (data || null) as BuyerTicketMessageRow[] | null, error };
        },
        // requester_type, channel, status and author_type are set HERE, never taken from the request:
        // a buyer must not be able to open a ticket as a merchant, nor post as an agent.
        openTicket: async (c, buyerAccountId, input) => {
            const db = getSupabaseAdmin(c);
            const now = new Date();
            const inserted = await db
                .from('support_tickets')
                .insert({
                    ticket_ref: generateTicketRef(now),
                    first_response_due_at: new Date(now.getTime() + SUPPORT_DEFAULT_FIRST_RESPONSE_HOURS * 60 * 60 * 1000).toISOString(),
                    resolution_due_at: addBusinessDays(now, SUPPORT_DEFAULT_RESOLUTION_BUSINESS_DAYS).toISOString(),
                    site_id: input.siteId,
                    requester_type: 'customer',
                    requester_user_id: buyerAccountId,
                    subject: input.subject,
                    channel: 'chat',
                    status: 'open',
                    last_customer_message_at: now.toISOString(),
                })
                .select('id, ticket_ref, subject, status, topic, created_at, last_agent_message_at')
                .maybeSingle();
            if (inserted.error || !inserted.data) return { data: null, error: inserted.error };
            const ticket = inserted.data as unknown as BuyerTicketRow;
            const message = await db
                .from('ticket_messages')
                .insert({ ticket_id: ticket.id, author_type: 'requester', author_id: buyerAccountId, visibility: 'public', body: input.body })
                .select('id')
                .maybeSingle();
            if (message.error) return { data: null, error: message.error };
            return { data: ticket, error: null };
        },
        addRequesterMessage: async (c, ticketId, body) => {
            const { data, error } = await getSupabaseAdmin(c)
                .from('ticket_messages')
                .insert({ ticket_id: ticketId, author_type: 'requester', visibility: 'public', body })
                .select('id, author_type, body, created_at')
                .maybeSingle();
            return { data: (data || null) as BuyerTicketMessageRow | null, error };
        },
    });

    registerPersonalizationRoutes(router, {
        // Viewing again UPDATES the timestamp: 230's PK is (buyer, product), so the history holds one
        // row per product and cannot fill with ten copies of the item a buyer keeps returning to.
        recordView: async (c, buyerAccountId, productId) => {
            const { error } = await getSupabaseAdmin(c)
                .from('buyer_product_views')
                .upsert(
                    { buyer_account_id: buyerAccountId, product_id: productId, viewed_at: new Date().toISOString() },
                    { onConflict: 'buyer_account_id,product_id' },
                );
            return { error };
        },
        // Joined to products and filtered to publicly-visible ones. A buyer can POST any product id,
        // so without this filter the history would read back names and prices of catalogue they were
        // never allowed to see. The projection is the narrow public one for the same reason.
        listRecentlyViewed: async (c, buyerAccountId, limit) => {
            const { data, error } = await getSupabaseAdmin(c)
                .from('buyer_product_views')
                .select('product_id, viewed_at, products!inner(name, slug, price, images, site_id, is_active, deleted_at)')
                .eq('buyer_account_id', buyerAccountId)
                .eq('products.is_active', true)
                .is('products.deleted_at', null)
                .order('viewed_at', { ascending: false })
                .limit(limit);
            const rows = (data || []).map((row) => {
                // PostgREST types an embedded relation as an array even when !inner makes it exactly
                // one row, so it is normalised here rather than asserted away.
                const embedded = (row as unknown as { products?: unknown }).products;
                const product = (Array.isArray(embedded) ? embedded[0] : embedded) as Record<string, unknown> | undefined ?? {};
                const images = Array.isArray(product.images) ? product.images : [];
                return {
                    product_id: (row as unknown as { product_id: string }).product_id,
                    viewed_at: (row as unknown as { viewed_at: string }).viewed_at,
                    name: (product.name as string) ?? null,
                    slug: (product.slug as string) ?? null,
                    price: (product.price as number) ?? null,
                    image_url: typeof images[0] === 'string' ? (images[0] as string) : null,
                    site_id: (product.site_id as string) ?? null,
                };
            });
            return { data: error ? null : rows, error };
        },
        clearRecentlyViewed: async (c, buyerAccountId) => {
            const { error } = await getSupabaseAdmin(c)
                .from('buyer_product_views')
                .delete()
                .eq('buyer_account_id', buyerAccountId);
            return { error };
        },
        listTrendingSearches: async (c) => {
            const { data, error } = await getSupabaseAdmin(c)
                .from('marketplace_trending_searches')
                .select('id, term, position')
                .eq('is_active', true)
                .order('position', { ascending: true })
                .order('created_at', { ascending: true })
                .limit(20);
            return { data: (data || null) as { id: string; term: string; position: number }[] | null, error };
        },
    });

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
