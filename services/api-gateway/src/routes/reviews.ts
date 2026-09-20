import { Hono } from 'hono';
import type { Env } from '../index';
import { resolveCustomUser, verifySiteOwnership } from '../lib/auth-user';
import { getSupabaseAdmin, getSupabaseAdminUnguarded, paginated, success } from '../lib/supabase';
import { validate } from '../middleware/validation';
import {
    ListProductReviewsQuery,
    ProductReviewReplySchema,
    UpdateProductReviewSchema,
    type ProductReviewReplyInput,
    type ReviewModerationStatus,
} from '../schemas/review.schema';
import { normalizeProductReviewRecord } from '@letbuyy/commerce-core';
import type { z } from 'zod';

const router = new Hono<{ Bindings: Env }>();

type ListProductReviewsInput = z.infer<typeof ListProductReviewsQuery>;
type UpdateProductReviewInput = z.infer<typeof UpdateProductReviewSchema>;

interface ProductReviewOwnerRow {
    id: string;
    store_id?: string | null;
    stores?: unknown;
}

interface ProductReviewRow extends ProductReviewOwnerRow {
    product_id?: string | null;
    customer_name?: string | null;
    customer_email?: string | null;
    rating?: number | null;
    title?: string | null;
    body?: string | null;
    images?: string[] | null;
    is_verified?: boolean | null;
    is_approved?: boolean | null;
    helpful_count?: number | null;
    status?: ReviewModerationStatus | null;
    merchant_reply?: string | null;
    merchant_reply_by?: string | null;
    merchant_reply_at?: string | null;
    created_at?: string | null;
    updated_at?: string | null;
    products?: { name?: string | null } | null;
}

type DatabaseErrorLike = {
    message?: string;
    details?: string;
    hint?: string;
} | null | undefined;

function databaseErrorText(error: DatabaseErrorLike): string {
    return [error?.message, error?.details, error?.hint].filter(Boolean).join(' ').toLowerCase();
}

function isMissingColumnError(error: DatabaseErrorLike, columnName: string): boolean {
    const text = databaseErrorText(error);
    return text.includes(columnName.toLowerCase()) && (
        text.includes('does not exist') ||
        text.includes('schema cache') ||
        text.includes('could not find')
    );
}

function isMissingDeletedAtError(error: DatabaseErrorLike): boolean {
    return isMissingColumnError(error, 'deleted_at');
}

function isMissingStatusError(error: DatabaseErrorLike): boolean {
    return isMissingColumnError(error, 'status');
}

function isMissingTableError(error: DatabaseErrorLike, tableName: string): boolean {
    const text = databaseErrorText(error);
    return text.includes(tableName.toLowerCase()) && (
        text.includes('does not exist') ||
        text.includes('schema cache') ||
        text.includes('could not find')
    );
}

function isEmbeddedRelationError(error: DatabaseErrorLike, relationName: string): boolean {
    const text = databaseErrorText(error);
    return text.includes(relationName.toLowerCase()) && (
        text.includes('relationship') ||
        text.includes('schema cache') ||
        text.includes('could not find')
    );
}

async function loadReviewOwner(db: ReturnType<typeof getSupabaseAdminUnguarded>, reviewId: string) {
    const buildQuery = (includeDeletedAtFilter: boolean) => {
        let request = db
            .from('product_reviews')
            .select('id, store_id')
            .eq('id', reviewId);

        if (includeDeletedAtFilter) request = request.is('deleted_at', null);
        return request.maybeSingle();
    };

    let { data, error } = await buildQuery(true);
    if (isMissingDeletedAtError(error)) {
        ({ data, error } = await buildQuery(false));
    }

    if (isMissingTableError(error, 'product_reviews')) {
        return { data: null as ProductReviewOwnerRow | null, error: null };
    }

    return { data: data as ProductReviewOwnerRow | null, error };
}

router.get('/', validate('query', ListProductReviewsQuery), async (c) => {
    const auth = c.get('auth');
    const query = c.get('validatedQuery') as ListProductReviewsInput;
    const offset = (query.page - 1) * query.limit;
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    if (!customUser) {
        return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    }
    if (!(await verifySiteOwnership(db, query.store_id, customUser.id, auth.user.storeId))) {
        return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    const buildReviewsQuery = (includeDeletedAtFilter: boolean, includeProductRelation: boolean, useStatusColumn: boolean) => {
        let request = db
            .from('product_reviews')
            .select(includeProductRelation ? '*, products(name)' : '*', { count: 'exact' })
            .eq('store_id', query.store_id);

        if (includeDeletedAtFilter) request = request.is('deleted_at', null);

        if (query.status !== 'all') {
            if (useStatusColumn) {
                request = request.eq('status', query.status);
            } else if (query.status === 'approved') {
                request = request.eq('is_approved', true);
            } else if (query.status === 'pending') {
                request = request.eq('is_approved', false);
            }
        }

        request = request
            .order('created_at', { ascending: false })
            .range(offset, offset + query.limit - 1);

        return request;
    };

    let useStatusColumn = true;
    let includeProductRelation = true;
    let { data, error, count } = await buildReviewsQuery(true, includeProductRelation, useStatusColumn);

    if (isMissingDeletedAtError(error)) {
        ({ data, error, count } = await buildReviewsQuery(false, includeProductRelation, useStatusColumn));
    }

    if (isMissingStatusError(error)) {
        useStatusColumn = false;
        if (query.status === 'rejected') {
            return c.json(paginated([], 0, query.page, query.limit));
        }
        ({ data, error, count } = await buildReviewsQuery(!isMissingDeletedAtError(error), includeProductRelation, useStatusColumn));
    }

    if (isEmbeddedRelationError(error, 'products')) {
        includeProductRelation = false;
        ({ data, error, count } = await buildReviewsQuery(true, includeProductRelation, useStatusColumn));
        if (isMissingDeletedAtError(error)) {
            ({ data, error, count } = await buildReviewsQuery(false, includeProductRelation, useStatusColumn));
        }
    }

    if (isMissingTableError(error, 'product_reviews')) {
        return c.json(paginated([], 0, query.page, query.limit));
    }

    if (error) {
        return c.json({ success: false, error: { code: 'DB_ERROR', message: 'Unable to load product reviews' } }, 500);
    }

    const reviews = Array.isArray(data) ? (data as unknown as ProductReviewRow[]) : [];
    return c.json(paginated(reviews.map(normalizeProductReviewRecord), count || 0, query.page, query.limit));
});

router.patch('/:id', validate('json', UpdateProductReviewSchema), async (c) => {
    const auth = c.get('auth');
    const reviewId = c.req.param('id');
    const body = c.get('validatedBody') as UpdateProductReviewInput;
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    const { data: existing, error: existingError } = await loadReviewOwner(getSupabaseAdminUnguarded(c), reviewId);

    if (existingError) {
        return c.json({ success: false, error: { code: 'DB_ERROR', message: 'Unable to load review' } }, 500);
    }

    const ownedReview = existing as ProductReviewOwnerRow | null;
    if (!customUser || !ownedReview?.store_id || !(await verifySiteOwnership(db, ownedReview.store_id, customUser.id, auth.user.storeId))) {
        return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    let { data, error } = await db
        .from('product_reviews')
        .update({
            status: body.status,
            is_approved: body.status === 'approved',
        })
        .eq('id', reviewId)
        .eq('store_id', ownedReview.store_id)
        .select('*')
        .single();

    if (isMissingStatusError(error)) {
        ({ data, error } = await db
            .from('product_reviews')
            .update({ is_approved: body.status === 'approved' })
            .eq('id', reviewId)
            .eq('store_id', ownedReview.store_id)
            .select('*')
            .single());
    }

    if (error || !data) {
        return c.json({ success: false, error: { code: 'DB_ERROR', message: 'Unable to update review' } }, 500);
    }

    return c.json(success(normalizeProductReviewRecord({ ...(data as ProductReviewRow), status: body.status })));
});

router.post('/:id/reply', validate('json', ProductReviewReplySchema), async (c) => {
    const auth = c.get('auth');
    const reviewId = c.req.param('id');
    const body = c.get('validatedBody') as ProductReviewReplyInput;
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    const { data: existing, error: existingError } = await loadReviewOwner(getSupabaseAdminUnguarded(c), reviewId);

    if (existingError) {
        return c.json({ success: false, error: { code: 'DB_ERROR', message: 'Unable to load review' } }, 500);
    }

    const ownedReview = existing as ProductReviewOwnerRow | null;
    if (!customUser || !ownedReview?.store_id || !(await verifySiteOwnership(db, ownedReview.store_id, customUser.id, auth.user.storeId))) {
        return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    const repliedAt = new Date().toISOString();
    const { data, error } = await db
        .from('product_reviews')
        .update({
            merchant_reply: body.message,
            merchant_reply_by: customUser.id,
            merchant_reply_at: repliedAt,
            updated_at: repliedAt,
        })
        .eq('id', reviewId)
        .eq('store_id', ownedReview.store_id)
        .select('*')
        .single();

    if (isMissingColumnError(error, 'merchant_reply') || isMissingColumnError(error, 'merchant_reply_by') || isMissingColumnError(error, 'merchant_reply_at')) {
        return c.json({
            success: false,
            error: {
                code: 'REVIEW_REPLY_SCHEMA_MISSING',
                message: 'Review replies are not available in this environment.',
            },
        }, 503);
    }

    if (error || !data) {
        return c.json({ success: false, error: { code: 'DB_ERROR', message: 'Unable to reply to review' } }, 500);
    }

    return c.json(success(normalizeProductReviewRecord(data as ProductReviewRow)));
});

router.delete('/:id', async (c) => {
    const auth = c.get('auth');
    const reviewId = c.req.param('id');
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    const { data: existing, error: existingError } = await loadReviewOwner(getSupabaseAdminUnguarded(c), reviewId);

    if (existingError) {
        return c.json({ success: false, error: { code: 'DB_ERROR', message: 'Unable to load review' } }, 500);
    }

    const ownedReview = existing as ProductReviewOwnerRow | null;
    if (!customUser || !ownedReview?.store_id || !(await verifySiteOwnership(db, ownedReview.store_id, customUser.id, auth.user.storeId))) {
        return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    let { error } = await db
        .from('product_reviews')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', reviewId)
        .eq('store_id', ownedReview.store_id);

    if (isMissingDeletedAtError(error)) {
        ({ error } = await db
            .from('product_reviews')
            .delete()
            .eq('id', reviewId)
            .eq('store_id', ownedReview.store_id));
    }

    if (error) {
        return c.json({ success: false, error: { code: 'DB_ERROR', message: 'Unable to delete review' } }, 500);
    }

    return c.json(success({ deleted: true }));
});

export default router;
