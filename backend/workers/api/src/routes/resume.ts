import { Hono } from 'hono';
import type { Env } from '../index';
import { getSupabaseAdmin, success } from '../lib/supabase';

const router = new Hono<{ Bindings: Env }>();

// GET /resume — List resume data (skills, education, work experience, certifications)
router.get('/', async (c) => {
    const auth = c.get('auth');
    const storeId = c.req.query('store_id');
    const db = getSupabaseAdmin(c);

    if (!storeId) {
        return c.json({ error: { code: 'VALIDATION', message: 'store_id required' } }, 400);
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
    const section = c.req.param('section');
    const id = c.req.param('id');
    const body = await c.req.json();
    const db = getSupabaseAdmin(c);

    // Remove system fields
    delete body.id;
    delete body.store_id;
    delete body.created_at;

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
    const section = c.req.param('section');
    const id = c.req.param('id');
    const db = getSupabaseAdmin(c);

    const { error } = await db.from(section).delete().eq('id', id);

    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    return c.json({ data: { deleted: true } });
});

// POST /resume/export — Export resume data for PDF generation
router.post('/export', async (c) => {
    const body = await c.req.json();
    const { store_id, template } = body;
    const db = getSupabaseAdmin(c);

    if (!store_id) {
        return c.json({ error: { code: 'VALIDATION', message: 'store_id required' } }, 400);
    }

    // Fetch all resume data in parallel
    const [skills, education, workExperience, certifications, store] = await Promise.all([
        db.from('skills').select('*').eq('store_id', store_id).order('display_order'),
        db.from('education').select('*').eq('store_id', store_id).order('start_date', { ascending: false }),
        db.from('work_experience').select('*').eq('store_id', store_id).order('start_date', { ascending: false }),
        db.from('certifications').select('*').eq('store_id', store_id).order('issue_date', { ascending: false }),
        db.from('stores').select('name, tagline, logo_url, meta_title, meta_description').eq('id', store_id).single(),
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

export default router;
