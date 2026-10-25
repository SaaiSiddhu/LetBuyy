import { NextRequest, NextResponse } from 'next/server';
import { appMarketplaceErrorResponse, createAppMarketplaceApiClient } from '@/lib/api/client';
import { logger } from '@/lib/logger';

interface RouteParams {
    params: Promise<{ id: string }>;
}

type JsonObject = Record<string, unknown>;

function stringValue(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function base64Url(bytes: Uint8Array): string {
    return Buffer.from(bytes)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/g, '');
}

async function createPkcePair() {
    const verifierBytes = new Uint8Array(32);
    crypto.getRandomValues(verifierBytes);
    const codeVerifier = base64Url(verifierBytes);
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(codeVerifier));
    return {
        codeVerifier,
        codeChallenge: base64Url(new Uint8Array(digest)),
    };
}

function redactedToken(token: JsonObject | null) {
    if (!token) return null;
    return {
        token_type: stringValue(token.token_type) || 'Bearer',
        expires_at: stringValue(token.expires_at) || null,
        refresh_expires_at: stringValue(token.refresh_expires_at) || null,
        scopes: Array.isArray(token.scopes) ? token.scopes.filter((scope): scope is string => typeof scope === 'string') : [],
        installation_id: stringValue(token.installation_id) || null,
        app_id: stringValue(token.app_id) || null,
        store_id: stringValue(token.store_id) || null,
    };
}

/**
 * POST /api/apps/[id]/install — Install an app to the user's store
 * Requires authentication (enforced by middleware + session verification)
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
    const { id: appId } = await params;

    try {
        const body = await request.json().catch(() => ({}));
        const idempotencyKey = request.headers.get('idempotency-key') ?? request.headers.get('x-idempotency-key') ?? undefined;
        const api = await createAppMarketplaceApiClient({ requireSession: true });
        if (body?.action === 'get_spend_control' && typeof body.store_id === 'string') {
            const data = await api.appStore.spendControl(body.store_id);
            return NextResponse.json({ data });
        }

        if (body?.action === 'update_spend_control' && typeof body.store_id === 'string') {
            const monthlyCapMinor = Number(body.monthly_cap_minor ?? 0);
            const alertThresholdMinor = Number(body.alert_threshold_minor ?? 0);
            const data = await api.appStore.updateSpendControl(body.store_id, {
                monthly_cap_minor: Number.isFinite(monthlyCapMinor) ? Math.max(0, Math.round(monthlyCapMinor)) : 0,
                alert_threshold_minor: Number.isFinite(alertThresholdMinor) ? Math.max(0, Math.round(alertThresholdMinor)) : 0,
                alerts_enabled: Boolean(body.alerts_enabled),
                enforcement_mode: body.enforcement_mode === 'alert_only' ? 'alert_only' : 'block',
                status: body.status === 'disabled' ? 'disabled' : 'active',
            });
            return NextResponse.json({ data });
        }

        if (body?.action === 'oauth_install') {
            const app = await api.appStore.app(appId);
            const appRecord = app as JsonObject;
            const registeredRedirects = Array.isArray(appRecord.oauth_redirect_uris)
                ? appRecord.oauth_redirect_uris.filter((value): value is string => typeof value === 'string' && value.length > 0)
                : [];
            const redirectUri = stringValue(body.redirect_uri) || registeredRedirects[0];
            if (!redirectUri) {
                return NextResponse.json({ error: { code: 'VALIDATION', message: 'A registered OAuth redirect URL is required before this app can be installed.' } }, { status: 400 });
            }

            const { codeVerifier, codeChallenge } = await createPkcePair();
            const authorization = await api.appStore.oauthAuthorize(appId, {
                store_id: stringValue(body.store_id),
                scopes: Array.isArray(body.scopes) ? (body.scopes as unknown[]).filter((scope): scope is string => typeof scope === 'string') : undefined,
                pricing_plan_id: stringValue(body.pricing_plan_id),
                redirect_uri: redirectUri,
                code_challenge: codeChallenge,
                code_challenge_method: 'S256',
                state: crypto.randomUUID(),
                config: body.config && typeof body.config === 'object' ? body.config as JsonObject : undefined,
            });
            const clientId = stringValue(appRecord.oauth_client_id) || `app_${authorization.authorization.app_id}`;
            const token = await api.appStore.oauthToken({
                grant_type: 'authorization_code',
                code: authorization.authorization.code,
                client_id: clientId,
                redirect_uri: authorization.authorization.redirect_uri,
                code_verifier: codeVerifier,
            });

            return NextResponse.json({
                data: {
                    installation: authorization.installation,
                    authorization: {
                        redirect_uri: authorization.authorization.redirect_uri,
                        redirect_to: authorization.authorization.redirect_to,
                        state: authorization.authorization.state,
                        scopes: authorization.authorization.scopes,
                        expires_at: authorization.authorization.expires_at,
                        installation_id: authorization.authorization.installation_id,
                        app_id: authorization.authorization.app_id,
                        store_id: authorization.authorization.store_id,
                    },
                    token: redactedToken(token as unknown as JsonObject),
                },
            }, { status: 201 });
        }

        if (body?.action === 'get_extension_registry' && typeof body.installation_id === 'string') {
            const data = await api.appStore.extensionRegistry(body.installation_id, stringValue(body.store_id) ? { store_id: stringValue(body.store_id) } : undefined);
            return NextResponse.json({ data });
        }

        if (body?.action === 'update_extension_registration' && typeof body.installation_id === 'string' && typeof body.registration_id === 'string') {
            const status = body.status === 'enabled' ? 'enabled' : 'disabled';
            const data = await api.appStore.updateExtensionRegistration(body.installation_id, body.registration_id, { status, store_id: stringValue(body.store_id) });
            return NextResponse.json({ data });
        }

        if (body?.action === 'update_function_registration' && typeof body.installation_id === 'string' && typeof body.registration_id === 'string') {
            const status = body.status === 'enabled' ? 'enabled' : 'disabled';
            const data = await api.appStore.updateFunctionRegistration(body.installation_id, body.registration_id, { status, store_id: stringValue(body.store_id) });
            return NextResponse.json({ data });
        }

        if (body?.action === 'revoke_scope' && typeof body.installation_id === 'string' && typeof body.scope === 'string') {
            const data = await api.appStore.updateInstallationScopes(body.installation_id, {
                store_id: stringValue(body.store_id),
                revoke_scope: body.scope,
            });
            return NextResponse.json({ data });
        }

        if (body?.action === 'embed_session' && typeof body.installation_id === 'string') {
            const token = await api.appStore.oauthTokenExchange({
                installation_id: body.installation_id,
                store_id: stringValue(body.store_id),
            });
            const session = await api.appStore.embedSession(body.installation_id, stringValue(body.store_id) ? { store_id: stringValue(body.store_id) } : undefined);
            const canProbeProducts = session.bridge.scopes.includes('read_products');
            const bridgeProbe = canProbeProducts
                ? await api.appStore.bridgeFetch(
                    { method: 'GET', path: '/products?limit=1', store_id: session.bridge.store_id },
                    { headers: { Authorization: `${session.bridge.token_type} ${session.bridge.access_token}` } },
                ).catch((probeError) => ({
                    ok: false,
                    status: 0,
                    data: null,
                    error: probeError instanceof Error ? probeError.message : 'Bridge probe failed',
                }))
                : null;
            return NextResponse.json({
                data: {
                    installation: session.installation,
                    embed: session.embed,
                    bridge: {
                        version: session.bridge.version,
                        token_type: session.bridge.token_type,
                        expires_at: session.bridge.expires_at,
                        api_base_url: session.bridge.api_base_url,
                        store_id: session.bridge.store_id,
                        installation_id: session.bridge.installation_id,
                        app_id: session.bridge.app_id,
                        scopes: session.bridge.scopes,
                        capabilities: session.bridge.capabilities,
                    },
                    token: redactedToken(token as unknown as JsonObject),
                    bridge_probe: bridgeProbe,
                },
            });
        }

        if (body?.action === 'activity' && typeof body.installation_id === 'string') {
            const data = await api.appStore.installationActivity(
                body.installation_id,
                stringValue(body.store_id) ? { store_id: stringValue(body.store_id), limit: 50 } : { limit: 50 },
            );
            return NextResponse.json({ data });
        }

        if (body?.action === 'create_charge' && typeof body.installation_id === 'string') {
            const amountMinor = Number(body.amount_minor);
            if (!Number.isInteger(amountMinor) || amountMinor <= 0) {
                return NextResponse.json({ error: { code: 'VALIDATION', message: 'amount_minor must be a positive integer' } }, { status: 400 });
            }
            const trialDays = Number(body.trial_days ?? 0);

            const data = await api.appStore.createCharge(body.installation_id, {
                store_id: typeof body.store_id === 'string' ? body.store_id : '',
                installation_id: body.installation_id,
                pricing_plan_id: typeof body.pricing_plan_id === 'string' ? body.pricing_plan_id : undefined,
                billing_mode: body.billing_mode === 'one_time' || body.billing_mode === 'usage' ? body.billing_mode : 'recurring',
                name: typeof body.name === 'string' ? body.name : 'App charge',
                amount_minor: amountMinor,
                trial_days: Number.isFinite(trialDays) ? Math.max(0, Math.round(trialDays)) : 0,
                idempotency_key: typeof body.idempotency_key === 'string' ? body.idempotency_key : crypto.randomUUID(),
                return_url: typeof body.return_url === 'string' ? body.return_url : undefined,
                metadata: body.metadata && typeof body.metadata === 'object' ? body.metadata : {},
            });
            return NextResponse.json({ data }, { status: 201 });
        }

        const data = await api.appStore.install(appId, {
                store_id: typeof body.store_id === 'string' ? body.store_id : undefined,
                scopes: Array.isArray(body.scopes) ? body.scopes : undefined,
                pricing_plan_id: typeof body.pricing_plan_id === 'string' ? body.pricing_plan_id : undefined,
                config: body.config && typeof body.config === 'object' ? body.config : undefined,
                webhook_url: typeof body.webhook_url === 'string' ? body.webhook_url : undefined,
                webhook_event: typeof body.webhook_event === 'string' ? body.webhook_event : undefined,
                // webhook_secret intentionally not forwarded: the gateway generates the signing secret server-side (M5).
        }, idempotencyKey ? { idempotencyKey } : undefined);
        return NextResponse.json({ data }, { status: 201 });
    } catch (err) {
        logger.error('app install failed', { appId, error: err instanceof Error ? err.message : String(err) });
        return appMarketplaceErrorResponse(err, 'Internal server error');
    }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
    const { id: appId } = await params;

    try {
        const body = await request.json().catch(() => ({}));
        if ((body?.action !== 'approve_charge' && body?.action !== 'cancel_charge') || typeof body.charge_id !== 'string') {
            return NextResponse.json({ error: { code: 'VALIDATION', message: 'charge_id is required' } }, { status: 400 });
        }

        const api = await createAppMarketplaceApiClient({ requireSession: true });
        if (body.action === 'cancel_charge') {
            const data = await api.appStore.cancelCharge(body.charge_id, {
                store_id: typeof body.store_id === 'string' ? body.store_id : '',
                charge_id: body.charge_id,
                idempotency_key: typeof body.idempotency_key === 'string' ? body.idempotency_key : crypto.randomUUID(),
                reason: typeof body.reason === 'string' ? body.reason : undefined,
            });

            return NextResponse.json({ data });
        }

        const data = await api.appStore.approveCharge(body.charge_id, {
            store_id: typeof body.store_id === 'string' ? body.store_id : '',
            charge_id: body.charge_id,
            idempotency_key: typeof body.idempotency_key === 'string' ? body.idempotency_key : crypto.randomUUID(),
            provider_reference: typeof body.provider_reference === 'string' ? body.provider_reference : undefined,
            provider_payment_id: typeof body.provider_payment_id === 'string' ? body.provider_payment_id : undefined,
            provider_signature: typeof body.provider_signature === 'string' ? body.provider_signature : undefined,
            provider_mode: body.provider_mode === 'live' ? 'live' : 'sandbox',
        });

        return NextResponse.json({ data });
    } catch (err) {
        logger.error('app charge approval failed', { appId, error: err instanceof Error ? err.message : String(err) });
        return appMarketplaceErrorResponse(err, 'Internal server error');
    }
}

/**
 * DELETE /api/apps/[id]/install — Uninstall an app from the user's store
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
    const { id: appId } = await params;

    try {
        const storeId = request.nextUrl.searchParams.get('store_id');
        const body = await request.json().catch(() => ({}));
        const idempotencyKey = request.headers.get('idempotency-key') ?? request.headers.get('x-idempotency-key') ?? undefined;
        const api = await createAppMarketplaceApiClient({ requireSession: true });
        const data = await api.appStore.uninstall(
            appId,
            storeId ? { store_id: storeId } : undefined,
            {
                ...(idempotencyKey ? { idempotencyKey } : {}),
                body: {
                    reason_code: typeof body.reason_code === 'string' ? body.reason_code : undefined,
                    reason_text: typeof body.reason_text === 'string' ? body.reason_text : undefined,
                },
            },
        );
        return NextResponse.json({ data });
    } catch (err) {
        logger.error('app uninstall failed', { appId, error: err instanceof Error ? err.message : String(err) });
        return appMarketplaceErrorResponse(err, 'Internal server error');
    }
}
