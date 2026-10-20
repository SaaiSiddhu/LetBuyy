import { Hono } from 'hono';
import type { Env } from '../index';
import { ALLOWED_UPLOAD_MIMES } from '../lib/upload-mime';

const router = new Hono<{ Bindings: Env }>();
// The shared bucket also contains protected files. Neither possession of a key
// nor an upload-shaped path is sufficient to make those files public.
router.on(['GET', 'HEAD'], '/*', async c => {
    let key: string;
    try { key = decodeURIComponent(c.req.path.slice('/assets/'.length)); }
    catch { return c.notFound(); }
    if (!key.startsWith('public-media/') || key.split('/').some(part => !part || part === '.' || part === '..') || /[\x00-\x1f\x7f\\]/.test(key)) {
        c.header('Cache-Control', 'no-store');
        return c.notFound();
    }
    if (!c.env.R2_BUCKET) return c.json({ error: { code: 'STORAGE_UNAVAILABLE' } }, 503);
    try {
        const object = c.req.method === 'HEAD' ? await c.env.R2_BUCKET.head(key) : await c.env.R2_BUCKET.get(key);
        const type = object?.httpMetadata?.contentType;
        if (!object || object.customMetadata?.visibility !== 'public' || object.customMetadata?.delivery !== 'letbuyy-public-v1'
            || !type || !(ALLOWED_UPLOAD_MIMES as readonly string[]).includes(type)) {
            c.header('Cache-Control', 'no-store'); return c.notFound();
        }
        const headers = new Headers({
            'Content-Type': type, 'Content-Length': String(object.size),
            'ETag': object.httpEtag, 'Cache-Control': 'public, max-age=300',
            'X-Content-Type-Options': 'nosniff',
            'Content-Security-Policy': "default-src 'none'; sandbox",
        });
        // Keys are unique; bounded caching allows deletion to retire cached media.
        if (c.req.header('If-None-Match') === object.httpEtag) {
            headers.delete('Content-Length'); return new Response(null, { status: 304, headers });
        }
        return new Response(c.req.method === 'HEAD' ? null : (object as R2ObjectBody).body, { headers });
    } catch {
        return c.json({ error: { code: 'STORAGE_UNAVAILABLE' } }, 503);
    }
});
export default router;
