// Driving the REAL gateway worker from an owned-database suite.
//
// The suites that use this do not mount a router of their own and do not stub a dependency. They call the worker's
// own `fetch` (the default export of src/index.ts, what Cloudflare calls in production), so a request passes through
// the real global middleware (security headers, request id, input validation, error sanitiser, observability, CORS,
// API versioning), the real route registration (`/v1/storefront`, `/v1/employees`, `/v1/operations/...`), the real
// session and role middleware, the real production dependency wiring, a real PostgREST and a real Postgres. The only
// things this file adds are what a caller would bring: signed credentials, and (optionally) a tap on the one HTTP hop
// between the gateway and the owned PostgREST, used to line concurrent requests up deterministically or to inject a
// specific database fault. A tap sees the gateway's own calls to the owned REST layer and nothing else.
//
// Nothing here reaches a database except through requireOwnedDatabase() (see owned-db-support.ts); the REST url and
// service key it hands out belong to this suite's own disposable sidecar.

import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import {
    LETBUYY_BUYER_SESSION_EPOCH_CLAIM,
    LETBUYY_BUYER_SESSION_HEADER,
    createLetbuyyInternalIdentityHeaders,
} from '@letbuyy/auth-core';
import worker from '../../index';
import type { Env } from '../../index';
import type { OwnedDatabase } from './owned-db-support';

export const IDENTITY_ISSUER = 'https://accounts.letbuyy.test';
export const INTERNAL_SECRET = 'owned-db-gateway-harness-internal-secret';
export const BUYER_SESSION_AUDIENCE = 'letbuyy:buyer-session';
export const MERCHANT_SESSION_AUDIENCE = 'letbuyy:merchant-session';

// --------------------------------------------------------------------------------------------------------------------
// Credentials
// --------------------------------------------------------------------------------------------------------------------

export interface IdentityKeys {
    privateKey: CryptoKey;
    kid: string;
    /** The public half, as the JWKS document the gateway is configured with (LETBUYY_IDENTITY_PUBLIC_JWKS). */
    jwks: string;
}

export async function newIdentityKeys(kid = 'owned-db-identity'): Promise<IdentityKeys> {
    const { privateKey, publicKey } = await generateKeyPair('ES256', { extractable: true });
    return { privateKey, kid, jwks: JSON.stringify({ keys: [{ ...(await exportJWK(publicKey)), alg: 'ES256', kid }] }) };
}

export interface SessionOverrides {
    /** Audience, issuer, realm and token_use default to a well-formed BUYER session; each can be bent on its own. */
    audience?: string;
    issuer?: string;
    realm?: string;
    tokenUse?: string;
    /** Seconds from now; negative is already expired. */
    expiresInSeconds?: number;
    /** Seconds from now; positive is issued in the future. */
    issuedAtOffsetSeconds?: number;
    /** `null` leaves the replay id out altogether. */
    jti?: string | null;
    /** The session epoch claim; `null` leaves it out (a pre-epoch token, which counts as epoch 1). */
    epoch?: number | null;
    /** Sign with this key instead of the configured identity key (a forged token). */
    signWith?: CryptoKey;
    /** `HS256` signs with a shared secret instead of an asymmetric key: the verifier must refuse the algorithm. */
    algorithm?: 'ES256' | 'HS256';
    extraClaims?: Record<string, unknown>;
}

/** A session credential as identity-platform issues one (ES256, buyer realm), unless an override says otherwise. */
export async function mintSession(keys: IdentityKeys, subject: string, overrides: SessionOverrides = {}): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    const claims: Record<string, unknown> = {
        realm: overrides.realm ?? 'buyer',
        token_use: overrides.tokenUse ?? 'buyer_session',
        ...(overrides.extraClaims ?? {}),
    };
    if (overrides.epoch !== null && overrides.epoch !== undefined) claims[LETBUYY_BUYER_SESSION_EPOCH_CLAIM] = overrides.epoch;

    const algorithm = overrides.algorithm ?? 'ES256';
    const jwt = new SignJWT(claims)
        .setProtectedHeader(algorithm === 'ES256' ? { alg: 'ES256', typ: 'JWT', kid: keys.kid } : { alg: 'HS256', typ: 'JWT' })
        .setIssuer(overrides.issuer ?? IDENTITY_ISSUER)
        .setAudience(overrides.audience ?? BUYER_SESSION_AUDIENCE)
        .setSubject(subject)
        .setIssuedAt(now + (overrides.issuedAtOffsetSeconds ?? 0))
        .setExpirationTime(now + (overrides.expiresInSeconds ?? 3600));
    if (overrides.jti !== null) jwt.setJti(overrides.jti ?? `jti-${crypto.randomUUID().replace(/-/g, '')}`);

    if (algorithm === 'HS256') return jwt.sign(new TextEncoder().encode('a-shared-secret-that-identity-never-uses'));
    return jwt.sign(overrides.signWith ?? keys.privateKey);
}

export async function buyerHeaders(keys: IdentityKeys, buyerAccountId: string, overrides: SessionOverrides = {}): Promise<Record<string, string>> {
    return {
        [LETBUYY_BUYER_SESSION_HEADER]: await mintSession(keys, buyerAccountId, overrides),
        'Content-Type': 'application/json',
    };
}

/** A fresh signed internal identity (merchant staff or platform operator), per request, as a server-side LetBuyy app sends it. */
export async function signedIdentityHeaders(userId: string, email: string): Promise<Record<string, string>> {
    const plan = await createLetbuyyInternalIdentityHeaders({ userId, email, secret: INTERNAL_SECRET });
    if (!plan.ok) throw new Error(`could not sign an internal identity: ${plan.status}`);
    return { ...(plan as { headers: Record<string, string> }).headers, 'Content-Type': 'application/json' };
}

// --------------------------------------------------------------------------------------------------------------------
// The worker
// --------------------------------------------------------------------------------------------------------------------

export function gatewayEnv(owned: OwnedDatabase, keys: IdentityKeys, extra: Record<string, unknown> = {}): Env {
    return {
        ...owned.restEnv(),
        ENVIRONMENT: 'test',
        LETBUYY_IDENTITY_ISSUER: IDENTITY_ISSUER,
        LETBUYY_IDENTITY_PUBLIC_JWKS: keys.jwks,
        INTERNAL_API_SECRET: INTERNAL_SECRET,
        ...extra,
    } as unknown as Env;
}

export interface GatewayResponse {
    status: number;
    text: string;
    /** The parsed body, or null when it is not JSON. */
    json: Record<string, any> | null;
    headers: Headers;
}

export const CLIENT_ADDRESS_HEADER = 'CF-Connecting-IP';

let clientSequence = 0;

/**
 * A client address of its own (RFC 3849 documentation range), the way Cloudflare presents every real caller. The gateway's global
 * query-cost limiter keeps one token bucket per client address and, with no address, puts every request in a single 'anonymous'
 * bucket: a suite that sends a few hundred requests from "nobody" would be throttled by a bucket no production caller shares,
 * and would then fail for a reason that has nothing to do with what it tests. A test that wants the limiter itself passes its own.
 */
export function nextClientAddress(): string {
    clientSequence += 1;
    return `2001:db8:feed::${clientSequence.toString(16)}`;
}

/**
 * The worker's own `fetch`, with an execution context that remembers what the worker hands to waitUntil
 * (observability writes, for one) so a test can wait for it instead of leaving it running into the next test.
 */
export class Gateway {
    private readonly background: Promise<unknown>[] = [];

    constructor(readonly env: Env) {}

    async request(path: string, init: RequestInit = {}, env: Env = this.env): Promise<GatewayResponse> {
        const context = {
            waitUntil: (work: Promise<unknown>) => {
                this.background.push(Promise.resolve(work).catch(() => undefined));
            },
            passThroughOnException: () => undefined,
        };
        const headers = new Headers(init.headers);
        if (!headers.has(CLIENT_ADDRESS_HEADER)) headers.set(CLIENT_ADDRESS_HEADER, nextClientAddress());
        const response = await worker.fetch(new Request(`https://gateway.test${path}`, { ...init, headers }), env, context as unknown as ExecutionContext);
        const text = await response.text();
        let json: Record<string, any> | null = null;
        try {
            const parsed = JSON.parse(text);
            json = parsed && typeof parsed === 'object' ? parsed : null;
        } catch {
            json = null;
        }
        return { status: response.status, text, json, headers: response.headers };
    }

    async settle(): Promise<void> {
        await Promise.allSettled(this.background.splice(0));
    }
}

// --------------------------------------------------------------------------------------------------------------------
// A tap on the gateway -> owned PostgREST hop
// --------------------------------------------------------------------------------------------------------------------

export interface RestCall {
    url: string;
    method: string;
    /** The table (or `rpc/<name>`) addressed under /rest/v1. */
    resource: string;
    search: URLSearchParams;
    /** The request body when it is text (the Supabase client always sends JSON text), else ''. */
    body: string;
    json: unknown;
}

export interface RestTap {
    /** Every call the gateway made to the owned REST layer while the tap was installed, in order, as it was sent. */
    readonly calls: RestCall[];
    restore(): void;
}

export type RestHandler = (call: RestCall, forward: (override?: { body?: string }) => Promise<Response>) => Promise<Response>;

/**
 * Installs a wrapper around globalThis.fetch for the gateway's calls to the owned REST layer. Every call is recorded
 * and handed to `handler`, which decides what happens next: forward it untouched (`forward()`), forward it with a changed
 * body, hold it, fail it, or answer it itself. Any other fetch in the process (nothing in these suites makes one) is
 * passed through untouched. The Supabase client resolves `fetch` when a client is created and the gateway creates one
 * per request, so a tap installed before a request is the one that request uses. Always restore in a finally.
 */
export function tapRest(restUrl: string, handler: RestHandler): RestTap {
    const original = globalThis.fetch;
    const calls: RestCall[] = [];
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        if (!url.startsWith(`${restUrl}/rest/v1/`)) return original(input, init);

        const parsed = new URL(url);
        const method = (init?.method ?? (typeof input === 'object' && 'method' in input ? input.method : 'GET')).toUpperCase();
        const body = typeof init?.body === 'string' ? init.body : '';
        let json: unknown = null;
        try {
            json = body ? JSON.parse(body) : null;
        } catch {
            json = null;
        }
        const call: RestCall = {
            url,
            method,
            resource: parsed.pathname.replace('/rest/v1/', ''),
            search: parsed.searchParams,
            body,
            json,
        };
        calls.push(call);
        const forward = (override?: { body?: string }) => original(input, override?.body === undefined ? init : { ...init, body: override.body });
        return handler(call, forward);
    }) as typeof fetch;

    return {
        calls,
        restore: () => {
            globalThis.fetch = original;
        },
    };
}

/** Just record: nothing is held, changed or failed. */
export const passThrough: RestHandler = (_call, forward) => forward();

export interface Barrier {
    /** Resolves once `parties` callers have arrived; rejects every waiter if they do not all arrive in time. */
    arrive(): Promise<void>;
    readonly arrived: number;
}

export function newBarrier(parties: number, timeoutMs = 20_000): Barrier {
    let arrived = 0;
    let release!: () => void;
    let fail!: (error: Error) => void;
    const gate = new Promise<void>((resolve, reject) => {
        release = resolve;
        fail = reject;
    });
    const timer = setTimeout(() => fail(new Error(`barrier: only ${arrived} of ${parties} requests reached it within ${timeoutMs} ms`)), timeoutMs);
    timer.unref();
    gate.then(() => clearTimeout(timer), () => clearTimeout(timer));
    return {
        arrive() {
            arrived += 1;
            if (arrived === parties) release();
            return gate;
        },
        get arrived() {
            return arrived;
        },
    };
}

/** A synthetic PostgREST-shaped JSON answer. */
export function restJson(status: number, body: unknown, extraHeaders: Record<string, string> = {}): Response {
    return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...extraHeaders } });
}

// --------------------------------------------------------------------------------------------------------------------
// Fixtures and queries
// --------------------------------------------------------------------------------------------------------------------

type Psql = (sql: string) => string;

export interface SyntheticBuyer {
    id: string;
    email: string;
}

/** A buyer account that exists only in this suite's database. The email is normalised, as the table requires. */
export function seedBuyerAccount(psql: Psql, label: string, status: 'active' | 'disabled' = 'active'): SyntheticBuyer {
    if (!/^[a-z0-9-]{1,24}$/.test(label)) throw new Error('a buyer label is lowercase letters, digits and hyphens');
    const id = crypto.randomUUID();
    const email = `syn-buyer-${label}-${id.slice(0, 8)}@example.invalid`;
    psql(`INSERT INTO buyer_accounts (id, email, email_verified, status) VALUES ('${id}', '${email}', true, '${status}');`);
    return { id, email };
}

/** Runs a query that returns ONE jsonb value and parses it. */
export function queryJson<T = any>(psql: Psql, sql: string): T {
    return JSON.parse(psql(sql)) as T;
}
