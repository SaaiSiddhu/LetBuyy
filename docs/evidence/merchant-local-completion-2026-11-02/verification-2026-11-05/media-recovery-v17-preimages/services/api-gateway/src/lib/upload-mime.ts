// ──────────────────────────────────────────────────────────────────────────────
// Phase X — MIME allowlist for theme media and general file uploads.
//
// SVG POLICY: SVG uploads are REJECTED. Cloudflare Workers have no DOM parser;
// text/regex stripping of SVG scripts, event handlers, <use xlink:href>, and
// <foreignObject> is known-bypassable and must not be used in lieu of a full
// sanitizer. All legitimate theme-image use cases (hero images, logos rasterised,
// product backgrounds) are covered by JPEG/PNG/WebP/GIF.
//
// If SVG support is needed in future, add it as a separate upload pipeline with
// a server-side sanitization worker (e.g. DOMPurify in a Node.js worker, NOT
// inside the CF Worker itself).
// ──────────────────────────────────────────────────────────────────────────────

/** Allowed image MIME types. SVG is intentionally excluded — see SVG POLICY above. */
export const ALLOWED_IMAGE_MIMES = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
] as const;

/** Allowed video MIME types for storefront media. */
export const ALLOWED_VIDEO_MIMES = [
    'video/mp4',
    'video/webm',
    'video/quicktime',
] as const;

/** Allowed 3-D model MIME types (GLTF/GLB). */
export const ALLOWED_MODEL_MIMES = [
    'model/gltf-binary',
    'model/gltf+json',
] as const;

/** Complete upload MIME allowlist: images + videos + 3-D models. */
export const ALLOWED_UPLOAD_MIMES = [
    ...ALLOWED_IMAGE_MIMES,
    ...ALLOWED_VIDEO_MIMES,
    ...ALLOWED_MODEL_MIMES,
] as const;

export type AllowedUploadMime = (typeof ALLOWED_UPLOAD_MIMES)[number];

/** Short human-readable label for error messages. */
export const ALLOWED_MIME_LABEL =
    'jpeg, png, webp, gif, mp4, webm, quicktime, gltf-binary, gltf+json';

type ValidateMimeResult =
    | { ok: true; mime: string }
    | { ok: false; error: string };

/**
 * validateUploadMime — validates a file's content-type against the upload allowlist.
 *
 * Accepts any object with a `type: string` property so it can be called with a
 * real `File` object (in the gateway handler) or a plain stub (in unit tests).
 *
 * Returns { ok: true, mime }  when the MIME type is on the allowlist.
 * Returns { ok: false, error } with a human-readable rejection reason otherwise.
 *
 * Hard blocks (regardless of allowlist):
 *   - image/svg+xml and image/svg (SVG POLICY — see module comment)
 *   - text/html, text/javascript, application/javascript and variants
 *   - Empty / missing MIME type
 */
export function validateUploadMime(file: { type: string }): ValidateMimeResult {
    // Normalize: strip MIME parameters (e.g. '; charset=utf-8') and lowercase.
    const mime = (file.type || '').toLowerCase().split(';')[0].trim();

    if (!mime) {
        return {
            ok: false,
            error: `File MIME type is missing or empty. Allowed types: ${ALLOWED_MIME_LABEL}`,
        };
    }

    // Hard-block SVG (SVG POLICY).
    if (mime === 'image/svg+xml' || mime === 'image/svg') {
        return {
            ok: false,
            error: 'SVG uploads are not supported. Use JPEG, PNG, WebP, or GIF for images.',
        };
    }

    // Hard-block HTML and script types.
    if (
        mime === 'text/html' ||
        mime.startsWith('text/javascript') ||
        mime.startsWith('application/javascript') ||
        mime.startsWith('application/x-javascript')
    ) {
        return { ok: false, error: `MIME type '${mime}' is not allowed` };
    }

    // Allowlist check.
    const allowed: readonly string[] = ALLOWED_UPLOAD_MIMES;
    if (allowed.includes(mime)) {
        return { ok: true, mime };
    }

    return {
        ok: false,
        error: `MIME type '${mime}' is not allowed. Allowed types: ${ALLOWED_MIME_LABEL}`,
    };
}
