import { Hono } from 'hono';
import type { Env } from '../index';
import { resolveCustomUser, verifySiteOwnership, type WorkerAuthUser } from '../lib/auth-user';
import { getSupabaseAdmin, success } from '../lib/supabase';

const router = new Hono<{ Bindings: Env }>();

const contentSectionTables = {
    skills: 'skills',
    education: 'education',
    work_experience: 'work_experience',
    certifications: 'certifications',
    testimonials: 'testimonials',
    projects: 'portfolio_projects',
} as const;

type ContentSection = keyof typeof contentSectionTables;

interface ContentOwnerRow {
    store_id?: string | null;
}

interface ContentItemRow extends ContentOwnerRow {
    [key: string]: unknown;
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

    if (!isContentSection(section)) {
        return c.json({ error: { code: 'VALIDATION', message: `Invalid section: ${section}` } }, 400);
    }

    if (!storeId) {
        return c.json({ error: { code: 'VALIDATION', message: 'store_id required' } }, 400);
    }

    const ownsStore = await verifyStoreOwnership(db, storeId, auth.user);
    if (!ownsStore) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    const sectionTable = contentSectionTables[section];
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

    return c.json(success((data || []).map((row) => normalizeContentItem(section, row))));
});

// POST /resume/section/:section — Tenant-scoped create for admin content modules
router.post('/section/:section', async (c) => {
    const auth = c.get('auth');
    const section = c.req.param('section');
    const body = await c.req.json() as Record<string, unknown>;
    const storeId = typeof body.store_id === 'string' ? body.store_id : null;
    const db = getSupabaseAdmin(c);

    if (!isContentSection(section)) {
        return c.json({ error: { code: 'VALIDATION', message: `Invalid section: ${section}` } }, 400);
    }

    if (!storeId) {
        return c.json({ error: { code: 'VALIDATION', message: 'store_id required' } }, 400);
    }

    const ownsStore = await verifyStoreOwnership(db, storeId, auth.user);
    if (!ownsStore) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    const payload = sanitizeContentInput(section, body, storeId);
    const { data, error } = await db
        .from(contentSectionTables[section])
        .insert(payload)
        .select()
        .single();

    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    return c.json(success(normalizeContentItem(section, data)), 201);
});

// PATCH /resume/section/:section/:id — Tenant-scoped update for admin content modules
router.patch('/section/:section/:id', async (c) => {
    const auth = c.get('auth');
    const section = c.req.param('section');
    const id = c.req.param('id');
    const body = await c.req.json() as Record<string, unknown>;
    const db = getSupabaseAdmin(c);

    if (!isContentSection(section)) {
        return c.json({ error: { code: 'VALIDATION', message: `Invalid section: ${section}` } }, 400);
    }

    const ownsItem = await verifyContentItemOwnership(db, contentSectionTables[section], id, auth.user);
    if (!ownsItem) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    const payload = sanitizeContentInput(section, body);
    const { data, error } = await db
        .from(contentSectionTables[section])
        .update(payload)
        .eq('id', id)
        .select()
        .single();

    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    return c.json(success(normalizeContentItem(section, data)));
});

// DELETE /resume/section/:section/:id — Soft delete tenant-scoped content
router.delete('/section/:section/:id', async (c) => {
    const auth = c.get('auth');
    const section = c.req.param('section');
    const id = c.req.param('id');
    const db = getSupabaseAdmin(c);

    if (!isContentSection(section)) {
        return c.json({ error: { code: 'VALIDATION', message: `Invalid section: ${section}` } }, 400);
    }

    const ownsItem = await verifyContentItemOwnership(db, contentSectionTables[section], id, auth.user);
    if (!ownsItem) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    const { error } = await db
        .from(contentSectionTables[section])
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

function isContentSection(section: string): section is ContentSection {
    return section in contentSectionTables;
}

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

    const ownedItem = data as ContentOwnerRow | null;
    if (!ownedItem?.store_id) return false;
    return verifySiteOwnership(db, ownedItem.store_id, customUser.id, authUser.storeId);
}

function sanitizeContentInput(section: ContentSection, body: Record<string, unknown>, storeId?: string) {
    const payload: Record<string, unknown> = {};
    if (storeId) payload.store_id = storeId;

    switch (section) {
        case 'skills': {
            copyKeys(body, payload, ['name', 'category', 'display_order']);
            const proficiency = toNumber(body.proficiency ?? body.proficiency_level);
            if (proficiency !== null) {
                payload.proficiency = proficiency;
                payload.proficiency_level = proficiency;
            }
            break;
        }
        case 'education':
            copyNullableKeys(body, payload, [
                'institution',
                'degree',
                'field_of_study',
                'start_date',
                'end_date',
                'grade',
                'description',
                'display_order',
            ]);
            break;
        case 'work_experience': {
            copyNullableKeys(body, payload, [
                'company',
                'location',
                'start_date',
                'end_date',
                'is_current',
                'description',
                'display_order',
            ]);
            const role = toNullableString(body.role ?? body.position);
            if (role !== undefined) {
                payload.role = role;
                payload.position = role;
            }
            break;
        }
        case 'certifications':
            copyNullableKeys(body, payload, [
                'name',
                'issuer',
                'credential_id',
                'credential_url',
                'issue_date',
                'expiry_date',
                'display_order',
            ]);
            break;
        case 'testimonials':
            copyNullableKeys(body, payload, [
                'author_name',
                'author_title',
                'author_company',
                'author_avatar',
                'content',
                'rating',
                'is_featured',
                'is_visible',
                'display_order',
            ]);
            break;
        case 'projects': {
            copyNullableKeys(body, payload, [
                'title',
                'description',
                'image_url',
                'start_date',
                'end_date',
                'is_visible',
                'display_order',
            ]);
            const url = toNullableString(body.url ?? body.live_url ?? body.project_url);
            if (url !== undefined) {
                payload.url = url;
                payload.live_url = url;
                payload.project_url = url;
            }
            const technologies = toStringArray(body.technologies ?? body.tags ?? body.categories);
            if (technologies) {
                payload.technologies = technologies;
                payload.tags = technologies;
            }
            break;
        }
    }

    return payload;
}

function normalizeContentItem(section: ContentSection, row: ContentItemRow) {
    if (section === 'skills') {
        return {
            ...row,
            proficiency: row.proficiency ?? row.proficiency_level ?? 50,
        };
    }

    if (section === 'work_experience') {
        return {
            ...row,
            role: row.role ?? row.position ?? '',
            description: row.description ?? (Array.isArray(row.responsibilities) ? row.responsibilities.join('\n') : null),
        };
    }

    if (section === 'education') {
        return {
            ...row,
            grade: row.grade ?? (row.gpa != null ? String(row.gpa) : null),
        };
    }

    if (section === 'testimonials') {
        return {
            ...row,
            is_visible: row.is_visible !== false,
        };
    }

    if (section === 'projects') {
        return {
            ...row,
            url: row.url ?? row.live_url ?? row.project_url ?? null,
            image_url: row.image_url ?? row.thumbnail_url ?? row.cover_image ?? null,
            technologies: Array.isArray(row.technologies)
                ? row.technologies
                : Array.isArray(row.tags)
                    ? row.tags
                    : [],
            is_visible: row.is_visible !== false,
        };
    }

    return row;
}

function copyKeys(source: Record<string, unknown>, target: Record<string, unknown>, keys: string[]) {
    for (const key of keys) {
        if (source[key] !== undefined) target[key] = source[key];
    }
}

function copyNullableKeys(source: Record<string, unknown>, target: Record<string, unknown>, keys: string[]) {
    for (const key of keys) {
        if (source[key] === undefined) continue;
        target[key] = source[key] === '' ? null : source[key];
    }
}

function toNumber(value: unknown) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim()) {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
}

function toNullableString(value: unknown) {
    if (value === undefined) return undefined;
    if (value === null) return null;
    if (typeof value !== 'string') return undefined;
    return value.trim() ? value : null;
}

function toStringArray(value: unknown) {
    if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string');
    if (typeof value === 'string') {
        return value
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean);
    }
    return null;
}

export default router;
