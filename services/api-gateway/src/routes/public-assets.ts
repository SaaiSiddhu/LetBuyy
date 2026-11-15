import { Hono } from 'hono';
import type { Env } from '../index';
import { ALLOWED_UPLOAD_MIMES } from '../lib/upload-mime';

const router = new Hono<{ Bindings: Env }>();
function isPublicMedia(object: R2Object | null): object is R2Object {
    const type = object?.httpMetadata?.contentType;
    return !!object && object.customMetadata?.visibility === 'public'
        && object.customMetadata?.delivery === 'letbuyy-public-v1'
        && !!type && (ALLOWED_UPLOAD_MIMES as readonly string[]).includes(type);
}

type ByteRange = { offset: number; length: number };
// This endpoint supports one bounded byte range. Unsupported/malformed sets can
// use the existing complete response; impossible bounds never become a full file.
function parseRange(value: string | undefined, size: number): ByteRange | 'unsatisfiable' | null {
    if (!value || value.length > 512 || size === 0) return null;
    const parts = /^bytes=(\d*)-(\d*)$/i.exec(value.trim());
    if (!parts || (!parts[1] && !parts[2])) return null;
    const total = BigInt(size);
    if (!parts[1]) {
        const suffix = BigInt(parts[2]);
        if (suffix === 0n) return 'unsatisfiable';
        const length = suffix < total ? suffix : total;
        return { offset: size - Number(length), length: Number(length) };
    }
    const start = BigInt(parts[1]);
    const end = parts[2] ? BigInt(parts[2]) : total - 1n;
    if (start >= total || end < start) return 'unsatisfiable';
    const last = end < total ? end : total - 1n;
    return { offset: Number(start), length: Number(last - start + 1n) };
}

// The shared bucket also contains protected files. Neither possession of a key
// nor an upload-shaped path is sufficient to make those files public. This gate
// precedes range/conditional status and length so protected objects stay opaque.
router.on(['GET', 'HEAD'], '/*', async c => {
    let key: string;
    try { key = decodeURIComponent(c.req.path.slice('/assets/'.length)); }
    catch { return c.notFound(); }
    if (!key.startsWith('public-media/') || key.split('/').some(part => !part || part === '.' || part === '..') || /[\x00-\x1f\x7f\\]/.test(key)) {
        c.header('Cache-Control', 'no-store'); return c.notFound();
    }
    const bucket = c.env.R2_BUCKET;
    if (!bucket) return c.json({ error: { code: 'STORAGE_UNAVAILABLE' } }, 503);
    try {
        const rangeHeader = c.req.method === 'GET' ? c.req.header('Range') : undefined;
        let object = c.req.method === 'HEAD' || rangeHeader ? await bucket.head(key) : await bucket.get(key);
        if (!isPublicMedia(object)) { c.header('Cache-Control', 'no-store'); return c.notFound(); }
        const headers = new Headers({
            'Content-Type': object.httpMetadata!.contentType!, 'Content-Length': String(object.size),
            'ETag': object.httpEtag, 'Cache-Control': 'public, max-age=300',
            'Accept-Ranges': 'bytes', 'X-Content-Type-Options': 'nosniff',
            'Content-Security-Policy': "default-src 'none'; sandbox",
        });
        if (c.req.header('If-None-Match') === object.httpEtag) {
            headers.delete('Content-Length'); return new Response(null, { status: 304, headers });
        }
        if (c.req.method === 'HEAD') return new Response(null, { headers });
        const ifRange = c.req.header('If-Range');
        const range = !ifRange || ifRange === object.httpEtag ? parseRange(rangeHeader, object.size) : null;
        if (range === 'unsatisfiable') return new Response(null, { status: 416, headers: {
            'Content-Range': `bytes */${object.size}`, 'Accept-Ranges': 'bytes',
            'Cache-Control': 'no-store', 'Content-Length': '0',
        } });
        if (range) {
            const partial = await bucket.get(key, { range, onlyIf: { etagMatches: object.etag } });
            if (!partial || !isPublicMedia(partial)) { c.header('Cache-Control', 'no-store'); return c.notFound(); }
            if (!('body' in partial)) return c.json({ error: { code: 'ASSET_CHANGED' } }, 503, { 'Cache-Control': 'no-store' });
            headers.set('Content-Length', String(range.length));
            headers.set('Content-Range', `bytes ${range.offset}-${range.offset + range.length - 1}/${object.size}`);
            return new Response(partial.body, { status: 206, headers });
        }
        // A mismatched If-Range or unsupported range set must deliver the whole
        // current representation. Re-check publication after the metadata read.
        if (!('body' in object)) {
            object = await bucket.get(key);
            if (!isPublicMedia(object) || !('body' in object)) { c.header('Cache-Control', 'no-store'); return c.notFound(); }
            headers.set('Content-Type', object.httpMetadata!.contentType!);
            headers.set('Content-Length', String(object.size)); headers.set('ETag', object.httpEtag);
        }
        return new Response((object as R2ObjectBody).body, { headers });
    } catch {
        return c.json({ error: { code: 'STORAGE_UNAVAILABLE' } }, 503, { 'Cache-Control': 'no-store' });
    }
});
export default router;
