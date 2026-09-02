export interface Env {
  readonly APP_ENV: string;
  readonly MEDIA_BUCKET?: R2Bucket;
  readonly MEDIA_PUBLIC_BASE_URL?: string;
  readonly MEDIA_SIGNING_SECRET?: string;
}

export type UploadTokenPayload = {
  readonly key: string;
  readonly contentType: string;
  readonly expiresAt: number;
  readonly purpose: string;
};

const allowedContentTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'application/pdf',
]);

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/health') {
      return Response.json({
        ok: true,
        service: 'media-gateway',
        environment: env.APP_ENV,
      });
    }

    if (url.pathname === '/v1/media/uploads' && request.method === 'POST') {
      return createUploadIntent(request, env);
    }

    if (url.pathname.startsWith('/v1/media/upload/') && request.method === 'PUT') {
      return receiveUpload(request, env, url.pathname.split('/').pop() ?? '');
    }

    if (url.pathname.startsWith('/cdn/') && request.method === 'GET') {
      return serveMedia(request, env, decodeURIComponent(url.pathname.slice('/cdn/'.length)));
    }

    return Response.json(
      {
        success: false,
        error: { code: 'media.route_not_found' },
      },
      { status: 404 },
    );
  },
};

async function createUploadIntent(request: Request, env: Env): Promise<Response> {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const contentType = typeof body.contentType === 'string'
    ? body.contentType
    : typeof body.content_type === 'string'
    ? body.content_type
    : 'image/jpeg';
  if (!allowedContentTypes.has(contentType)) {
    return jsonError('media.content_type_not_allowed', 415);
  }
  if (!env.MEDIA_BUCKET || !env.MEDIA_SIGNING_SECRET) {
    // [SKIPPED — NEEDS HUMAN: bind MEDIA_BUCKET R2 bucket and MEDIA_SIGNING_SECRET in Cloudflare Worker secrets]
    return Response.json({
      success: true,
      data: {
        skipped: true,
        reason: 'R2 media bucket or signing secret is not configured.',
        requiredEnv: ['MEDIA_BUCKET', 'MEDIA_SIGNING_SECRET'],
      },
    });
  }

  const key = mediaKeyForUpload({
    purpose: stringValue(body.purpose) ?? 'general',
    fileName: stringValue(body.fileName) ?? stringValue(body.file_name),
  });
  const payload: UploadTokenPayload = {
    key,
    contentType,
    purpose: stringValue(body.purpose) ?? 'general',
    expiresAt: Math.floor(Date.now() / 1000) + 10 * 60,
  };
  const token = await signUploadToken(payload, env.MEDIA_SIGNING_SECRET);
  const origin = new URL(request.url).origin;
  return Response.json({
    success: true,
    data: {
      key,
      uploadUrl: `${origin}/v1/media/upload/${token}`,
      method: 'PUT',
      contentType,
      publicUrl: publicUrlForKey(env, key, origin),
      expiresAt: new Date(payload.expiresAt * 1000).toISOString(),
    },
  });
}

async function receiveUpload(request: Request, env: Env, token: string): Promise<Response> {
  if (!env.MEDIA_BUCKET || !env.MEDIA_SIGNING_SECRET) {
    return jsonError('media.r2_not_configured', 503);
  }
  const payload = await verifyUploadToken(token, env.MEDIA_SIGNING_SECRET);
  if (!payload || payload.expiresAt < Math.floor(Date.now() / 1000)) {
    return jsonError('media.upload_token_invalid', 401);
  }
  const contentType = request.headers.get('content-type') ?? payload.contentType;
  if (contentType !== payload.contentType || !allowedContentTypes.has(contentType)) {
    return jsonError('media.content_type_mismatch', 415);
  }
  if (!request.body) {
    return jsonError('media.body_required', 400);
  }

  await env.MEDIA_BUCKET.put(payload.key, request.body, {
    httpMetadata: { contentType },
    customMetadata: { purpose: payload.purpose },
  });

  return Response.json({
    success: true,
    data: {
      key: payload.key,
      publicUrl: publicUrlForKey(env, payload.key, new URL(request.url).origin),
    },
  });
}

async function serveMedia(request: Request, env: Env, key: string): Promise<Response> {
  if (env.MEDIA_PUBLIC_BASE_URL && new URL(request.url).searchParams.has('width')) {
    const url = `${env.MEDIA_PUBLIC_BASE_URL.replace(/\/+$/, '')}/${key}`;
    const width = Number.parseInt(new URL(request.url).searchParams.get('width') ?? '', 10);
    const quality = Number.parseInt(new URL(request.url).searchParams.get('quality') ?? '82', 10);
    return fetch(url, {
      cf: {
        image: {
          width: Number.isFinite(width) ? width : undefined,
          quality: Number.isFinite(quality) ? quality : 82,
          fit: 'scale-down',
        },
      },
    } as RequestInit);
  }

  const object = await env.MEDIA_BUCKET?.get(key);
  if (!object) {
    return jsonError('media.not_found', 404);
  }
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  headers.set('cache-control', 'public, max-age=31536000, immutable');
  return new Response(object.body, { headers });
}

export function mediaKeyForUpload(input: { readonly purpose: string; readonly fileName?: string | null }): string {
  const purpose = sanitizePathPart(input.purpose || 'general');
  const rawFileName = (input.fileName || 'upload.bin').split(/[\\/]/).filter(Boolean).pop() ?? 'upload.bin';
  const fileName = sanitizePathPart(rawFileName);
  const date = new Date().toISOString().slice(0, 10);
  return `${purpose}/${date}/${crypto.randomUUID()}-${fileName}`;
}

export async function signUploadToken(payload: UploadTokenPayload, secret: string): Promise<string> {
  const encodedPayload = base64UrlEncodeText(JSON.stringify(payload));
  const signature = await hmac(encodedPayload, secret);
  return `${encodedPayload}.${signature}`;
}

export async function verifyUploadToken(token: string, secret: string): Promise<UploadTokenPayload | null> {
  const [encodedPayload, signature] = token.split('.');
  if (!encodedPayload || !signature) {
    return null;
  }
  const expected = await hmac(encodedPayload, secret);
  if (!constantTimeEqual(signature, expected)) {
    return null;
  }
  const decoded = JSON.parse(base64UrlDecodeText(encodedPayload)) as UploadTokenPayload;
  if (!decoded.key || !decoded.contentType || !decoded.expiresAt || !decoded.purpose) {
    return null;
  }
  return decoded;
}

function publicUrlForKey(env: Env, key: string, origin: string): string {
  const base = env.MEDIA_PUBLIC_BASE_URL?.replace(/\/+$/, '') ?? `${origin}/cdn`;
  return `${base}/${key}`;
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function sanitizePathPart(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'file';
}

async function hmac(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
  return base64UrlEncodeBytes(new Uint8Array(signature));
}

function base64UrlEncodeText(value: string): string {
  return base64UrlEncodeBytes(new TextEncoder().encode(value));
}

function base64UrlEncodeBytes(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function base64UrlDecodeText(value: string): string {
  const padded = value.replaceAll('-', '+').replaceAll('_', '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(padded);
  return new TextDecoder().decode(Uint8Array.from(binary, (character) => character.charCodeAt(0)));
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let mismatch = 0;
  for (let index = 0; index < a.length; index += 1) {
    mismatch |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return mismatch === 0;
}

function jsonError(code: string, status: number): Response {
  return Response.json({ success: false, error: { code } }, { status });
}
