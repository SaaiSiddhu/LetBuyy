import type { SupabaseClient } from '@letbuyy/infrastructure/supabase-adapter';
import {
    AUTH_APPLICATION_WORKFLOWS,
    AUTH_EXECUTION_PIPELINES,
    defineRuntimeBridge,
} from '@letbuyy/shared-types';
import { canonicalizeExecutionPayload } from '@letbuyy/event-core';
import { AppError, ConflictError, ValidationError } from '../lib/errors';
import { redactReplayableSecrets } from '../lib/replayable-secret-redaction';
import { isMissingSchemaError } from '../lib/supabase';

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

type IdempotencyRecord = {
    id: string;
    request_hash: string;
    response_hash?: string | null;
    resource_type?: string | null;
    response_body?: JsonValue | null;
    status: 'processing' | 'completed' | 'failed';
    status_code?: number | null;
    locked_until?: string | null;
};

export type IdempotencyClaim =
    | { kind: 'claimed'; id: string; siteId: string; requestHash: string; recoveryBody?: JsonValue | null }
    | { kind: 'replay'; responseBody: JsonValue; statusCode: number };

async function sha256Hex(value: string): Promise<string> {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
    return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function isUniqueViolation(error: { code?: string; message?: string } | null): boolean {
    const message = error?.message?.toLowerCase() || '';
    return error?.code === '23505' || message.includes('duplicate key');
}

export class IdempotencyExecutionAdapter {
    static readonly applicationWorkflows = AUTH_APPLICATION_WORKFLOWS;
    static readonly executionPipelines = AUTH_EXECUTION_PIPELINES;
    static readonly runtimeBridge = defineRuntimeBridge({
        kind: 'runtime-bridge',
        adapter: 'idempotency-execution.adapter',
        workflowAuthority: 'auth-application',
        allowedResponsibilities: ['database-rpc', 'response-formatting'],
        forbiddenResponsibilities: ['workflow-ownership', 'business-sequencing', 'query-aggregation', 'provider-sdk', 'ui-rendering'],
    });

    private currentSiteId: string | undefined;

    constructor(private db: SupabaseClient) { }

    static normalizeKey(key: string | undefined | null): string {
        const normalized = (key || '').trim();
        if (normalized.length < 8 || normalized.length > 200) {
            throw new ValidationError('Idempotency key must be 8-200 characters');
        }
        return normalized;
    }

    /** Read an already committed acknowledgement without claiming new work.
     * Same key/scope/request hashing as begin; callers still supply their own
     * current recovery authority before using this result. */
    async readCompleted(params: { siteId: string; key: string; scope: string; requestBody: unknown }): Promise<Extract<IdempotencyClaim, { kind: 'replay' }> | null> {
        const key = IdempotencyExecutionAdapter.normalizeKey(params.key);
        const requestHash = await sha256Hex(canonicalizeExecutionPayload(params.requestBody));
        const { data, error } = await this.db.from('idempotency_keys')
            .select('request_hash,status,response_body,status_code')
            .eq('site_id', params.siteId).eq('scope', params.scope).eq('key', key)
            .is('deleted_at', null).maybeSingle();
        if (error) throw new AppError('Checkout acknowledgement is temporarily unavailable', 503, 'CHECKOUT_UNAVAILABLE');
        if (!data) return null;
        const record = data as IdempotencyRecord;
        if (record.request_hash !== requestHash) throw new ConflictError('Idempotency key was already used with a different request body');
        return record.status === 'completed' && record.response_body
            ? { kind: 'replay', responseBody: record.response_body, statusCode: record.status_code || 200 }
            : null;
    }

    /** Scoped existing-state lookup, without allocating or reclaiming an effect. */
    async readForRecovery(params: { siteId: string; key: string; scope: string; requestBody: unknown }): Promise<IdempotencyRecord | null> {
        const key = IdempotencyExecutionAdapter.normalizeKey(params.key);
        const hash = await sha256Hex(canonicalizeExecutionPayload(params.requestBody));
        const { data, error } = await this.db.from('idempotency_keys')
            .select('id,request_hash,status,response_body,status_code,response_hash,resource_type')
            .eq('site_id', params.siteId).eq('scope', params.scope).eq('key', key).is('deleted_at', null).maybeSingle();
        if (error) throw new AppError('The original request receipt is unavailable', 503, 'COMMAND_RECEIPT_UNAVAILABLE');
        if (!data) return null;
        const record = data as IdempotencyRecord;
        if (record.request_hash !== hash) throw new ConflictError('Idempotency key was already used with a different request body');
        return record;
    }

    /** Complete only the existing verified recovery allocation. Concurrent failed
     * handlers cannot regress this acknowledgement via fail(status=processing). */
    async completeRecovered(params: { id: string; siteId: string; requestHash: string; resourceType: string; responseBody: JsonValue; statusCode: number }): Promise<void> {
        const response = redactReplayableSecrets(params.responseBody);
        const responseHash = await sha256Hex(canonicalizeExecutionPayload(response));
        const { data, error } = await this.db.from('idempotency_keys')
            .update({ status: 'completed', response_body: response, response_hash: responseHash,
                status_code: params.statusCode, locked_until: null })
            .eq('id', params.id).eq('site_id', params.siteId).eq('request_hash', params.requestHash)
            .eq('resource_type', params.resourceType).in('status', ['processing', 'failed'])
            .is('deleted_at', null).select('id').maybeSingle();
        if (error) throw new AppError('The recovered acknowledgement could not be saved', 503, 'COMMAND_RECEIPT_UNAVAILABLE');
        if (data) return;
        const { data: current, error: readError } = await this.db.from('idempotency_keys')
            .select('status,response_hash').eq('id', params.id).eq('site_id', params.siteId)
            .eq('request_hash', params.requestHash).is('deleted_at', null).maybeSingle();
        if (readError || !current || current.status !== 'completed' || current.response_hash !== responseHash)
            throw new ConflictError('The original receipt changed. Reload the saved request.');
    }

    async begin(params: {
        siteId: string;
        key: string;
        scope: string;
        requestBody: unknown;
        requestId?: string | null;
        lockSeconds?: number;
        expiresInSeconds?: number;
        initialResponseBody?: JsonValue;
        initialResourceType?: string;
    }): Promise<IdempotencyClaim> {
        this.currentSiteId = params.siteId;
        const key = IdempotencyExecutionAdapter.normalizeKey(params.key);
        const requestHash = await sha256Hex(canonicalizeExecutionPayload(params.requestBody));
        const now = Date.now();
        const lockedUntil = new Date(now + (params.lockSeconds ?? 120) * 1000).toISOString();
        const expiresAt = new Date(now + (params.expiresInSeconds ?? 24 * 60 * 60) * 1000).toISOString();

        const { data, error } = await this.db
            .from('idempotency_keys')
            .insert({
                site_id: params.siteId,
                key,
                scope: params.scope,
                request_hash: requestHash,
                status: 'processing',
                locked_until: lockedUntil,
                expires_at: expiresAt,
                request_id: params.requestId || null,
                ...(params.initialResponseBody === undefined ? {} : {
                    response_body: redactReplayableSecrets(params.initialResponseBody),
                    resource_type: params.initialResourceType || null,
                }),
            })
            .select('id, request_hash, status, response_body, status_code, locked_until')
            .single();

        if (!error && data) {
            return { kind: 'claimed', id: (data as IdempotencyRecord).id, siteId: params.siteId, requestHash, ...(params.initialResponseBody === undefined ? {} : { recoveryBody: (data as IdempotencyRecord).response_body }) };
        }

        if (error && isMissingSchemaError(error)) {
            if (params.initialResponseBody !== undefined) throw new AppError('Durable upload receipts are unavailable', 503, 'COMMAND_RECEIPT_UNAVAILABLE');
            return { kind: 'claimed', id: 'dev-idempotency-id', siteId: params.siteId, requestHash };
        }

        if (!isUniqueViolation(error)) {
            throw new Error(`Idempotency claim failed: ${error?.message || 'unknown error'}`);
        }

        const { data: existing, error: existingError } = await this.db
            .from('idempotency_keys')
            .select('id, request_hash, status, response_body, status_code, locked_until')
            .eq('site_id', params.siteId)
            .eq('scope', params.scope)
            .eq('key', key)
            .is('deleted_at', null)
            .single();

        if (existingError || !existing) {
            throw new Error(`Idempotency lookup failed: ${existingError?.message || 'missing record'}`);
        }

        const record = existing as IdempotencyRecord;
        if (record.request_hash !== requestHash) {
            throw new ConflictError('Idempotency key was already used with a different request body');
        }

        if (record.status === 'completed' && record.response_body) {
            return {
                kind: 'replay',
                responseBody: record.response_body,
                statusCode: record.status_code || 200,
            };
        }

        const lockActive = record.locked_until && new Date(record.locked_until).getTime() > now;
        if (record.status === 'processing' && lockActive) {
            throw new ConflictError('An identical mutation is already processing');
        }

        const reclaimQuery = this.db
            .from('idempotency_keys')
            .update({
                status: 'processing',
                locked_until: lockedUntil,
                request_id: params.requestId || null,
            })
            .eq('id', record.id).eq('status', record.status).eq('request_hash', requestHash);
        // A claimant that observed an expired lease must not regress a receipt
        // completed (or reclaimed) while it waited for the row lock.
        const unchangedLease = record.locked_until
            ? reclaimQuery.eq('locked_until', record.locked_until)
            : reclaimQuery.is('locked_until', null);
        const { data: reclaimed, error: reclaimError } = await (this.currentSiteId
            ? unchangedLease.eq('site_id', this.currentSiteId)
            : unchangedLease)
            .select('id')
            .single();

        if (reclaimError || !reclaimed) {
            throw new ConflictError('The original request changed while its receipt was being recovered. Retry the same request.');
        }

        return { kind: 'claimed', id: record.id, siteId: params.siteId, requestHash, ...(params.initialResponseBody === undefined ? {} : { recoveryBody: record.response_body }) };
    }

    async complete(params: {
        id: string;
        responseBody: JsonValue;
        statusCode: number;
        resourceType?: string;
        resourceId?: string;
        requireDurable?: boolean;
    }) {
        if (params.id === 'dev-idempotency-id') return;
        const persistedResponseBody = redactReplayableSecrets(params.responseBody);
        const responseHash = await sha256Hex(canonicalizeExecutionPayload(persistedResponseBody));
        const query = this.db
            .from('idempotency_keys')
            .update({
                status: 'completed',
                response_body: persistedResponseBody,
                response_hash: responseHash,
                status_code: params.statusCode,
                resource_type: params.resourceType || null,
                resource_id: params.resourceId || null,
                locked_until: null,
            })
            .eq('id', params.id);
        const scoped = this.currentSiteId ? query.eq('site_id', this.currentSiteId) : query;
        if (params.requireDurable) {
            const { data, error } = await scoped.select('id').maybeSingle();
            if (error || !data) throw new AppError('The original acknowledgement could not be saved', 503, 'COMMAND_RECEIPT_UNAVAILABLE');
            return;
        }
        const { error } = await scoped;

        if (error) {
            if (isMissingSchemaError(error)) return;
            throw new Error(`Idempotency completion failed: ${error.message}`);
        }
    }

    async fail(id: string) {
        if (id === 'dev-idempotency-id') return;
        const query = this.db
            .from('idempotency_keys')
            .update({
                status: 'failed',
                locked_until: null,
            })
            .eq('id', id).eq('status', 'processing');
        const { error } = await (this.currentSiteId ? query.eq('site_id', this.currentSiteId) : query);
        if (error && !isMissingSchemaError(error)) {
            throw new Error(`Idempotency failure update failed: ${error.message}`);
        }
    }
}
