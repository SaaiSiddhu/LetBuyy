import { Hono } from 'hono';
import type { Env } from '../index';

const router = new Hono<{ Bindings: Env }>();

// POST /upload — Upload file to R2
router.post('/', async (c) => {
    const auth = c.get('auth');
    const contentType = c.req.header('Content-Type') || '';

    if (!contentType.includes('multipart/form-data') && !contentType.includes('application/octet-stream')) {
        return c.json({ error: { code: 'VALIDATION', message: 'Expected file upload' } }, 400);
    }

    try {
        const formData = await c.req.formData();
        const fileEntry = formData.get('file');
        const folderEntry = formData.get('folder');

        if (
            !fileEntry ||
            typeof fileEntry === 'string' ||
            typeof (fileEntry as { stream?: unknown }).stream !== 'function'
        ) {
            return c.json({ error: { code: 'VALIDATION', message: 'No file provided' } }, 400);
        }

        const file = fileEntry as File;
        const folder =
            typeof folderEntry === 'string' && folderEntry.trim().length > 0
                ? folderEntry.trim()
                : 'uploads';

        // Validate file size (10MB max)
        if (file.size > 10 * 1024 * 1024) {
            return c.json({ error: { code: 'VALIDATION', message: 'File too large (max 10MB)' } }, 400);
        }

        // Generate unique path
        const ext = file.name.split('.').pop() || 'bin';
        const key = `${folder}/${auth.user.id}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;

        // Upload to R2
        await c.env.R2_BUCKET.put(key, file.stream(), {
            httpMetadata: { contentType: file.type },
        });

        // Return public URL
        const publicUrl = `https://cdn.letbuyy.store/${key}`;

        return c.json({
            data: {
                url: publicUrl,
                key,
                size: file.size,
                content_type: file.type,
            },
        }, 201);
    } catch (err) {
        console.error('Upload error:', err);
        return c.json({ error: { code: 'UPLOAD_ERROR', message: 'Failed to upload file' } }, 500);
    }
});

// DELETE /upload/:key — Delete file from R2
router.delete('/*', async (c) => {
    const key = c.req.path.replace('/upload/', '');
    if (!key) {
        return c.json({ error: { code: 'VALIDATION', message: 'File key required' } }, 400);
    }

    try {
        await c.env.R2_BUCKET.delete(key);
        return c.json({ data: { deleted: true } });
    } catch (err) {
        return c.json({ error: { code: 'DELETE_ERROR', message: 'Failed to delete file' } }, 500);
    }
});

export default router;
