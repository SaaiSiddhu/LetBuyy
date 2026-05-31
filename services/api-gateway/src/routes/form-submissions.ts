import { Hono } from 'hono';
import type { Env } from '../index';
import { resolveCustomUser, verifySiteOwnership } from '../lib/auth-user';
import { getSupabaseAdmin, paginated, success } from '../lib/supabase';
import { validate } from '../middleware/validation';
import {
    ListFormSubmissionsQuery,
    UpdateFormSubmissionSchema,
} from '../schemas/form-submission.schema';
import {
    normalizeFormSubmissionRecord,
    type CmsFormSubmissionRecord,
} from '@letbuyy/cms-core';
import type { z } from 'zod';

const router = new Hono<{ Bindings: Env }>();

type ListFormSubmissionsInput = z.infer<typeof ListFormSubmissionsQuery>;
type UpdateFormSubmissionInput = z.infer<typeof UpdateFormSubmissionSchema>;

interface FormSubmissionOwnerRow {
    id: string;
    store_id?: string | null;
    stores?: unknown;
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

router.get('/', validate('query', ListFormSubmissionsQuery), async (c) => {
    const auth = c.get('auth');
    const query = c.get('validatedQuery') as ListFormSubmissionsInput;
    const offset = (query.page - 1) * query.limit;
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    if (!customUser) {
        return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    }
    if (!(await verifySiteOwnership(db, query.store_id, customUser.id, auth.user.storeId))) {
        return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    const buildSubmissionsQuery = (includeDeletedAtFilter: boolean) => {
        let request = db
            .from('form_submissions')
            .select('*', { count: 'exact' })
            .eq('store_id', query.store_id);

        if (includeDeletedAtFilter) request = request.is('deleted_at', null);
        if (query.type === 'contact') request = request.eq('form_type', 'contact');
        if (query.type === 'lead') request = request.neq('form_type', 'contact');
        if (query.status !== 'all') request = request.eq('status', query.status);

        return request
            .order('created_at', { ascending: false })
            .range(offset, offset + query.limit - 1);
    };

    let { data, error, count } = await buildSubmissionsQuery(true);

    if (isMissingDeletedAtError(error)) {
        ({ data, error, count } = await buildSubmissionsQuery(false));
    }

    if (error) {
        return c.json({ success: false, error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    return c.json(paginated(((data || []) as CmsFormSubmissionRecord[]).map(normalizeFormSubmissionRecord), count || 0, query.page, query.limit));
});

router.patch('/:id', validate('json', UpdateFormSubmissionSchema), async (c) => {
    const auth = c.get('auth');
    const submissionId = c.req.param('id');
    const body = c.get('validatedBody') as UpdateFormSubmissionInput;
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    const selectExistingSubmission = (includeDeletedAtFilter: boolean) => {
        let request = db
            .from('form_submissions')
            .select('id, store_id')
            .eq('id', submissionId);

        if (includeDeletedAtFilter) request = request.is('deleted_at', null);
        return request.single();
    };

    let { data: existing, error: existingError } = await selectExistingSubmission(true);

    if (isMissingDeletedAtError(existingError)) {
        ({ data: existing, error: existingError } = await selectExistingSubmission(false));
    }

    const ownedSubmission = existing as FormSubmissionOwnerRow | null;
    if (!customUser || !ownedSubmission?.store_id || !(await verifySiteOwnership(db, ownedSubmission.store_id, customUser.id, auth.user.storeId))) {
        return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    const updates: Record<string, string> = { status: body.status };
    if (body.status === 'read') updates.read_at = new Date().toISOString();
    if (body.status === 'replied') updates.replied_at = new Date().toISOString();

    const { data, error } = await db
        .from('form_submissions')
        .update(updates)
        .eq('id', submissionId)
        .select()
        .single();

    if (error || !data) {
        return c.json({ success: false, error: { code: 'DB_ERROR', message: error?.message || 'Unable to update submission' } }, 500);
    }

    return c.json(success(normalizeFormSubmissionRecord(data as CmsFormSubmissionRecord)));
});

router.delete('/:id', async (c) => {
    const auth = c.get('auth');
    const submissionId = c.req.param('id');
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    const selectExistingSubmission = (includeDeletedAtFilter: boolean) => {
        let request = db
            .from('form_submissions')
            .select('id, store_id')
            .eq('id', submissionId);

        if (includeDeletedAtFilter) request = request.is('deleted_at', null);
        return request.single();
    };

    let { data: existing, error: existingError } = await selectExistingSubmission(true);

    if (isMissingDeletedAtError(existingError)) {
        ({ data: existing, error: existingError } = await selectExistingSubmission(false));
    }

    const ownedSubmission = existing as FormSubmissionOwnerRow | null;
    if (!customUser || !ownedSubmission?.store_id || !(await verifySiteOwnership(db, ownedSubmission.store_id, customUser.id, auth.user.storeId))) {
        return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    const { error } = await db
        .from('form_submissions')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', submissionId);

    if (error) {
        return c.json({ success: false, error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    return c.json(success({ deleted: true }));
});

export default router;
