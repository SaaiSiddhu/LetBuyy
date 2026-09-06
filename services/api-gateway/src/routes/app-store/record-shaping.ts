// Record shaping and input normalisation for the app-store routes.
//
// Turning a query string into a bounded number, decorating a raw app row into the shape the API
// returns, and scoring a review for fraud signals are all pure functions of their inputs. They were
// inline in routes/app-store.ts, which put the file 28 lines from the route-size limit; they live
// here for the same reason `schema-drift.ts` and `search-score.ts` already do.
//
// A byte-for-byte transplant: every declaration below is the text that was running in app-store.ts,
// in the same order, with only `export` added.

import { z } from 'zod';

export const AppAwardWriteSchema = z.object({
    award_key: z.string().trim().min(2).max(80).regex(/^[a-z0-9][a-z0-9_-]*$/),
    label: z.string().trim().min(2).max(120),
    year: z.coerce.number().int().min(2020).max(2100).default(new Date().getFullYear()),
    blurb: z.string().trim().max(500).optional().nullable(),
    status: z.enum(['draft', 'published', 'archived']).default('published'),
    metadata: z.record(z.string(), z.unknown()).optional(),
});

export type AppStoreRecord = Record<string, unknown>;

export function normalizeSearchTerm(value: string | undefined): string {
    return (value || '').trim().replace(/[%(),]/g, ' ').replace(/\s+/g, ' ').slice(0, 120);
}

export function normalizePositiveInt(value: string | undefined, fallback: number, max: number): number {
    const parsed = Number.parseInt(value || '', 10);
    if (!Number.isFinite(parsed) || parsed < 1) return fallback;
    return Math.min(parsed, max);
}

export function normalizeRatingMin(value: string | undefined): number | null {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    return Math.max(1, Math.min(5, parsed));
}

export function decorateAppRecord(app: AppStoreRecord): AppStoreRecord {
    const category = app.app_categories;
    if (category && typeof category === 'object' && !Array.isArray(category)) {
        const categoryRecord = category as AppStoreRecord;
        app.app_categories = {
            ...categoryRecord,
            group: categoryRecord.group ?? categoryRecord.group_name,
        };
    }
    if (app.is_first_party_demo) {
        app.discovery_label = 'First-party demo app';
    }
    return app;
}

export function decorateAppRecords(apps: AppStoreRecord[] | null): AppStoreRecord[] {
    return (apps || []).map((app) => decorateAppRecord({ ...app }));
}

export function stringOrNull(value: unknown): string | null {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

export function appDeveloperOwnerId(app: AppStoreRecord | null | undefined): string | null {
    const developer = Array.isArray(app?.app_developers) ? app?.app_developers[0] : app?.app_developers;
    if (!developer || typeof developer !== 'object') return null;
    return stringOrNull((developer as AppStoreRecord).user_id);
}

export function isSearchVectorUnavailableError(error: { code?: string; message?: string } | null | undefined): boolean {
    const text = `${error?.code || ''} ${error?.message || ''}`.toLowerCase();
    return text.includes('42703') || text.includes('search_vector') || text.includes('column');
}

export function reviewFraudSignals(input: { rating: number; title?: unknown; body?: unknown }, duplicateBodyCount: number): {
    fraud_score: number;
    fraud_flags: string[];
    status: 'published' | 'flagged';
    moderation_reason: string | null;
} {
    const flags: string[] = [];
    const body = stringOrNull(input.body) || '';
    const title = stringOrNull(input.title) || '';
    if (body.length > 0 && body.length < 24) flags.push('short_body');
    if (title && body && title.toLowerCase() === body.toLowerCase()) flags.push('title_body_duplicate');
    if (duplicateBodyCount > 0) flags.push('duplicate_body');
    if (Number(input.rating) === 5 && duplicateBodyCount > 0) flags.push('duplicate_max_rating');

    const fraud_score = Math.min(100, (flags.includes('duplicate_body') ? 55 : 0) + (flags.length * 15));
    return {
        fraud_score,
        fraud_flags: flags,
        status: fraud_score >= 70 ? 'flagged' : 'published',
        moderation_reason: fraud_score >= 70 ? 'Automated review fraud controls flagged this review for moderation.' : null,
    };
}
