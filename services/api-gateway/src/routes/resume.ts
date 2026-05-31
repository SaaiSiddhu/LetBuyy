import { Hono } from 'hono';
import type { Env } from '../index';
import { resolveCustomUser, verifySiteOwnership, type WorkerAuthUser } from '../lib/auth-user';
import { getSupabaseAdmin, success } from '../lib/supabase';
import {
    RESUME_CONTENT_SECTION_TABLES,
    isResumeContentSection,
    normalizeResumeContentItem,
    sanitizeResumeContentInput,
    type ResumeContentOwnerRecord,
} from '@letbuyy/cms-core';

const router = new Hono<{ Bindings: Env }>();

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

function isMissingTableError(error: DatabaseErrorLike, tableName: string): boolean {
    const text = databaseErrorText(error);
    return text.includes(tableName.toLowerCase()) && (
        text.includes('does not exist') ||
        text.includes('schema cache') ||
        text.includes('could not find')
    );
}

// GET /resume/section/:section — Tenant-scoped section list for admin content modules
router.get('/section/:section', async (c) => {
    const auth = c.get('auth');
    const section = c.req.param('section');
    const storeId = c.req.query('store_id');
    const db = getSupabaseAdmin(c);

    if (!isResumeContentSection(section)) {
        return c.json({ error: { code: 'VALIDATION', message: `Invalid section: ${section}` } }, 400);
    }

    if (!storeId) {
        return c.json({ error: { code: 'VALIDATION', message: 'store_id required' } }, 400);
    }

    const ownsStore = await verifyStoreOwnership(db, storeId, auth.user);
    if (!ownsStore) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    const sectionTable = RESUME_CONTENT_SECTION_TABLES[section];
    const buildSectionQuery = (includeDeletedAtFilter: boolean) => {
        let query = db
            .from(sectionTable)
            .select('*')
            .eq('store_id', storeId);

        if (includeDeletedAtFilter) query = query.is('deleted_at', null);
        return query.order('display_order', { ascending: true });
    };

    let { data, error } = await buildSectionQuery(true);

    if (isMissingDeletedAtError(error)) {
        ({ data, error } = await buildSectionQuery(false));
    }

    if (isMissingTableError(error, sectionTable)) {
        return c.json(success([]));
    }

    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    return c.json(success((data || []).map((row) => normalizeResumeContentItem(section, row))));
});

// POST /resume/section/:section — Tenant-scoped create for admin content modules
router.post('/section/:section', async (c) => {
    const auth = c.get('auth');
    const section = c.req.param('section');
    const body = await c.req.json() as Record<string, unknown>;
    const storeId = typeof body.store_id === 'string' ? body.store_id : null;
    const db = getSupabaseAdmin(c);

    if (!isResumeContentSection(section)) {
        return c.json({ error: { code: 'VALIDATION', message: `Invalid section: ${section}` } }, 400);
    }

    if (!storeId) {
        return c.json({ error: { code: 'VALIDATION', message: 'store_id required' } }, 400);
    }

    const ownsStore = await verifyStoreOwnership(db, storeId, auth.user);
    if (!ownsStore) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    const payload = sanitizeResumeContentInput(section, body, storeId);
    const { data, error } = await db
        .from(RESUME_CONTENT_SECTION_TABLES[section])
        .insert(payload)
        .select()
        .single();

    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    return c.json(success(normalizeResumeContentItem(section, data)), 201);
});

// PATCH /resume/section/:section/:id — Tenant-scoped update for admin content modules
router.patch('/section/:section/:id', async (c) => {
    const auth = c.get('auth');
    const section = c.req.param('section');
    const id = c.req.param('id');
    const body = await c.req.json() as Record<string, unknown>;
    const db = getSupabaseAdmin(c);

    if (!isResumeContentSection(section)) {
        return c.json({ error: { code: 'VALIDATION', message: `Invalid section: ${section}` } }, 400);
    }

    const ownsItem = await verifyContentItemOwnership(db, RESUME_CONTENT_SECTION_TABLES[section], id, auth.user);
    if (!ownsItem) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    const payload = sanitizeResumeContentInput(section, body);
    const { data, error } = await db
        .from(RESUME_CONTENT_SECTION_TABLES[section])
        .update(payload)
        .eq('id', id)
        .select()
        .single();

    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    return c.json(success(normalizeResumeContentItem(section, data)));
});

// DELETE /resume/section/:section/:id — Soft delete tenant-scoped content
router.delete('/section/:section/:id', async (c) => {
    const auth = c.get('auth');
    const section = c.req.param('section');
    const id = c.req.param('id');
    const db = getSupabaseAdmin(c);

    if (!isResumeContentSection(section)) {
        return c.json({ error: { code: 'VALIDATION', message: `Invalid section: ${section}` } }, 400);
    }

    const ownsItem = await verifyContentItemOwnership(db, RESUME_CONTENT_SECTION_TABLES[section], id, auth.user);
    if (!ownsItem) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    const { error } = await db
        .from(RESUME_CONTENT_SECTION_TABLES[section])
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id);

    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    return c.json(success({ deleted: true }));
});

// GET /resume — List resume data (skills, education, work experience, certifications)
router.get('/', async (c) => {
    const auth = c.get('auth');
    const storeId = c.req.query('store_id');
    const db = getSupabaseAdmin(c);

    if (!storeId) {
        return c.json({ error: { code: 'VALIDATION', message: 'store_id required' } }, 400);
    }

    const ownsStore = await verifyStoreOwnership(db, storeId, auth.user);
    if (!ownsStore) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    // Fetch all resume sections in parallel
    const [skills, education, workExperience, certifications] = await Promise.all([
        db.from('skills').select('*').eq('store_id', storeId).order('display_order'),
        db.from('education').select('*').eq('store_id', storeId).order('start_date', { ascending: false }),
        db.from('work_experience').select('*').eq('store_id', storeId).order('start_date', { ascending: false }),
        db.from('certifications').select('*').eq('store_id', storeId).order('issue_date', { ascending: false }),
    ]);

    return c.json(success({
        skills: skills.data || [],
        education: education.data || [],
        work_experience: workExperience.data || [],
        certifications: certifications.data || [],
    }));
});

// POST /resume/:section — Add an item to a resume section
router.post('/:section', async (c) => {
    const auth = c.get('auth');
    const section = c.req.param('section');
    const body = await c.req.json();
    const db = getSupabaseAdmin(c);

    const validSections = ['skills', 'education', 'work_experience', 'certifications'];
    if (!validSections.includes(section)) {
        return c.json({ error: { code: 'VALIDATION', message: `Invalid section: ${section}` } }, 400);
    }

    if (!body.store_id) {
        return c.json({ error: { code: 'VALIDATION', message: 'store_id required' } }, 400);
    }

    const ownsStore = await verifyStoreOwnership(db, body.store_id, auth.user);
    if (!ownsStore) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    const { data, error } = await db
        .from(section)
        .insert(body)
        .select()
        .single();

    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    return c.json(success(data), 201);
});

// PATCH /resume/:section/:id
router.patch('/:section/:id', async (c) => {
    const auth = c.get('auth');
    const section = c.req.param('section');
    const id = c.req.param('id');
    const body = await c.req.json();
    const db = getSupabaseAdmin(c);
    const validSections = ['skills', 'education', 'work_experience', 'certifications'];

    if (!validSections.includes(section)) {
        return c.json({ error: { code: 'VALIDATION', message: `Invalid section: ${section}` } }, 400);
    }

    // Remove system fields
    delete body.id;
    delete body.store_id;
    delete body.created_at;

    if (!(await verifyContentItemOwnership(db, section, id, auth.user))) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    const { data, error } = await db
        .from(section)
        .update(body)
        .eq('id', id)
        .select()
        .single();

    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    return c.json(success(data));
});

// DELETE /resume/:section/:id
router.delete('/:section/:id', async (c) => {
    const auth = c.get('auth');
    const section = c.req.param('section');
    const id = c.req.param('id');
    const db = getSupabaseAdmin(c);
    const validSections = ['skills', 'education', 'work_experience', 'certifications'];

    if (!validSections.includes(section)) {
        return c.json({ error: { code: 'VALIDATION', message: `Invalid section: ${section}` } }, 400);
    }

    if (!(await verifyContentItemOwnership(db, section, id, auth.user))) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    const { error } = await db.from(section).delete().eq('id', id);

    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    return c.json({ data: { deleted: true } });
});

// POST /resume/export — Export resume data for PDF generation
router.post('/export', async (c) => {
    const auth = c.get('auth');
    const body = await c.req.json();
    const { store_id, template } = body;
    const db = getSupabaseAdmin(c);

    if (!store_id) {
        return c.json({ error: { code: 'VALIDATION', message: 'store_id required' } }, 400);
    }

    const ownsStore = await verifyStoreOwnership(db, store_id, auth.user);
    if (!ownsStore) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    // Fetch all resume data in parallel
    const [skills, education, workExperience, certifications, store] = await Promise.all([
        db.from('skills').select('*').eq('store_id', store_id).order('display_order'),
        db.from('education').select('*').eq('store_id', store_id).order('start_date', { ascending: false }),
        db.from('work_experience').select('*').eq('store_id', store_id).order('start_date', { ascending: false }),
        db.from('certifications').select('*').eq('store_id', store_id).order('issue_date', { ascending: false }),
        db.from('sites').select('store_name, tagline, logo_url, meta_title, meta_description').eq('id', store_id).single(),
    ]);

    const resumeData = {
        store: store.data,
        skills: skills.data || [],
        education: education.data || [],
        work_experience: workExperience.data || [],
        certifications: certifications.data || [],
        template: template || 'modern',
        exported_at: new Date().toISOString(),
    };

    // Save as version
    await db.from('resume_versions').insert({
        store_id,
        version_data: resumeData,
        template: template || 'modern',
    });

    return c.json(success(resumeData));
});

// GET /resume/versions — List resume versions for a store
router.get('/versions', async (c) => {
    const auth = c.get('auth');
    const storeId = c.req.query('store_id');
    const db = getSupabaseAdmin(c);

    if (!storeId) {
        return c.json({ error: { code: 'VALIDATION', message: 'store_id required' } }, 400);
    }

    const ownsStore = await verifyStoreOwnership(db, storeId, auth.user);
    if (!ownsStore) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    const { data, error } = await db
        .from('resume_versions')
        .select('id, template, created_at')
        .eq('store_id', storeId)
        .order('created_at', { ascending: false })
        .limit(20);

    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    return c.json(success(data || []));
});

async function verifyStoreOwnership(
    db: ReturnType<typeof getSupabaseAdmin>,
    storeId: string,
    authUser: WorkerAuthUser
) {
    const customUser = await resolveCustomUser(db, authUser);
    return customUser ? verifySiteOwnership(db, storeId, customUser.id, authUser.storeId) : false;
}

async function verifyContentItemOwnership(
    db: ReturnType<typeof getSupabaseAdmin>,
    tableName: string,
    id: string,
    authUser: WorkerAuthUser
) {
    const customUser = await resolveCustomUser(db, authUser);
    if (!customUser) return false;

    const buildOwnershipQuery = (includeDeletedAtFilter: boolean) => {
        let query = db
            .from(tableName)
            .select('store_id')
            .eq('id', id);

        if (includeDeletedAtFilter) query = query.is('deleted_at', null);
        return query.single();
    };

    let { data, error } = await buildOwnershipQuery(true);
    if (isMissingDeletedAtError(error)) {
        ({ data, error } = await buildOwnershipQuery(false));
    }
    if (error) return false;

    const ownedItem = data as ResumeContentOwnerRecord | null;
    if (!ownedItem?.store_id) return false;
    return verifySiteOwnership(db, ownedItem.store_id, customUser.id, authUser.storeId);
}

export default router;
