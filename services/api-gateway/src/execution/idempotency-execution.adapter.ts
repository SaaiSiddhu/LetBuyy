import type { SupabaseClient } from '@letbuyy/infrastructure/supabase-adapter';
import { AUTH_APPLICATION_WORKFLOWS } from '@letbuyy/application-services';
import { ConflictError, ValidationError } from '../lib/errors';

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

type IdempotencyRecord = {
    id: string;
    request_hash: string;
    response_body?: JsonValue | null;
    status: 'processing' | 'completed' | 'failed';
    status_code?: number | null;
    locked_until?: string | null;
};

export type IdempotencyClaim =
    | { kind: 'claimed'; id: string; requestHash: string }
    | { kind: 'replay'; responseBody: JsonValue; statusCode: number };

function stableJson(value: unknown): string {
    if (value === null || typeof value !== 'object') return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map((item) => stableJson(item)).join(',')}]`;

    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
        .sort()
        .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`)
        .join(',')}}`;
}

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

    constructor(private db: SupabaseClient) { }

    static normalizeKey(key: string | undefined | null): string {
        const normalized = (key || '').trim();
        if (normalized.length < 8 || normalized.length > 200) {
            throw new ValidationError('Idempotency key must be 8-200 characters');
        }
        return normalized;
    }

    async begin(params: {
        siteId: string;
        key: string;
        scope: string;
        requestBody: unknown;
        requestId?: string | null;
        lockSeconds?: number;
        expiresInSeconds?: number;
    }): Promise<IdempotencyClaim> {
        const key = IdempotencyExecutionAdapter.normalizeKey(params.key);
        const requestHash = await sha256Hex(stableJson(params.requestBody));
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
            })
            .select('id, request_hash, status, response_body, status_code, locked_until')
            .single();

        if (!error && data) {
            return { kind: 'claimed', id: (data as IdempotencyRecord).id, requestHash };
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

        const { data: reclaimed, error: reclaimError } = await this.db
            .from('idempotency_keys')
            .update({
                status: 'processing',
                locked_until: lockedUntil,
                request_id: params.requestId || null,
            })
            .eq('id', record.id)
            .select('id')
            .single();

        if (reclaimError || !reclaimed) {
            throw new Error(`Idempotency reclaim failed: ${reclaimError?.message || 'missing record'}`);
        }

        return { kind: 'claimed', id: record.id, requestHash };
    }

    async complete(params: {
        id: string;
        responseBody: JsonValue;
        statusCode: number;
        resourceType?: string;
        resourceId?: string;
    }) {
        const responseHash = await sha256Hex(stableJson(params.responseBody));
        const { error } = await this.db
            .from('idempotency_keys')
            .update({
                status: 'completed',
                response_body: params.responseBody,
                response_hash: responseHash,
                status_code: params.statusCode,
                resource_type: params.resourceType || null,
                resource_id: params.resourceId || null,
                locked_until: null,
            })
            .eq('id', params.id);

        if (error) {
            throw new Error(`Idempotency completion failed: ${error.message}`);
        }
    }

    async fail(id: string) {
        await this.db
            .from('idempotency_keys')
            .update({
                status: 'failed',
                locked_until: null,
            })
            .eq('id', id);
    }
}
