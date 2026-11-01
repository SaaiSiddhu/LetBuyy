import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { z } from 'zod';
import type { Env } from '../index';
import { AppError } from '../lib/errors';
import { IdempotencyExecutionAdapter } from '../execution/idempotency-execution.adapter';
import { getSupabaseAdmin, success } from '../lib/supabase';
import { resolveTenantContextForOwnedSite } from '../lib/tenant-context';
import { acceptsLiveKycApproval, effectiveKycDocumentStatus, hasLiveProviderEvidence } from '../lib/kyc-evidence-status';
import { validate } from '../middleware/validation';
import {
    createKycVerificationAdapter,
    type MerchantKycDocumentStatus,
    type MerchantKycDocumentType,
    type MerchantKycProvider,
    type MerchantKycProviderMode,
} from '@letbuyy/infrastructure/kyc-verification-adapter';

const router = new Hono<{ Bindings: Env }>();

const DocumentTypeSchema = z.enum([
    'business_pan',
    'gst_certificate',
    'bank_proof',
    'address_proof',
    'identity_proof',
]);

const StoreQuerySchema = z.object({
    store_id: z.string().uuid(),
});

const SubmitKycDocumentSchema = StoreQuerySchema.extend({
    document_type: DocumentTypeSchema,
    document_number_last4: z.string().trim().min(2).max(8).regex(/^[A-Za-z0-9]+$/).optional(),
    // Identity and bank documents must use the private upload flow, never a URL.
    file_url: z.never().optional(),
    file_name: z.never().optional(),
    idempotency_key: z.string().min(8).max(160).optional(),
}).refine((value) => Boolean(value.document_number_last4), {
    message: 'Enter a reference; private document upload is a separate step',
    path: ['document_number_last4'],
});

type StoreQuery = z.infer<typeof StoreQuerySchema>;

interface KycDocumentRow extends Record<string, unknown> {
    id: string;
    site_id: string;
    document_type: MerchantKycDocumentType;
    status: 'draft' | MerchantKycDocumentStatus;
    provider: string;
    provider_mode: MerchantKycProviderMode;
    provider_reference?: string | null;
    document_number_last4?: string | null;
    file_url?: string | null;
    file_name?: string | null;
    rejection_reason?: string | null;
    metadata?: Record<string, unknown> | null;
    submitted_at?: string | null;
    verified_at?: string | null;
    rejected_at?: string | null;
    created_at?: string | null;
    updated_at?: string | null;
    deleted_at?: string | null;
}

const REQUIRED_DOCUMENTS: Array<{ document_type: MerchantKycDocumentType; title: string; required: boolean }> = [
    { document_type: 'business_pan', title: 'Business PAN', required: true },
    { document_type: 'bank_proof', title: 'Bank proof', required: true },
    { document_type: 'address_proof', title: 'Business address proof', required: true },
    { document_type: 'gst_certificate', title: 'GST certificate', required: false },
];

function providerMode(env: Env): MerchantKycProviderMode {
    return env.KYC_PROVIDER_MODE === 'live' ? 'live' : 'sandbox';
}

function providerName(env: Env): MerchantKycProvider {
    if (providerMode(env) === 'sandbox') return 'letbuyy_sandbox_kyc';
    const value = env.KYC_PROVIDER;
    return value === 'hyperverge' || value === 'manual' || value === 'signzy' ? value : 'manual';
}

function serializeDocument(row: KycDocumentRow) {
    const scan = row.metadata?.malware_scan_status;
    const evidenceScanStatus = row.metadata?.private_object_key
        ? scan === 'clean' || scan === 'rejected'
            ? scan : 'pending'
        : null;
    return {
        id: row.id,
        site_id: row.site_id,
        document_type: row.document_type,
        status: effectiveKycDocumentStatus(row),
        provider: row.provider,
        provider_mode: row.provider_mode,
        provider_reference: row.provider_reference || null,
        document_number_last4: row.document_number_last4 || null,
        // Existing historical URL values are not exposed as document download links.
        rejection_reason: row.rejection_reason || null,
        // Private object keys, provider payloads, and upload hashes are server-only.
        has_private_upload: Boolean(row.metadata?.private_object_key),
        evidence_scan_status: evidenceScanStatus,
        provider_unavailable: row.metadata?.provider_unavailable === true,
        submitted_at: row.submitted_at || null,
        verified_at: hasLiveProviderEvidence(row) ? row.verified_at || null : null,
        rejected_at: row.rejected_at || null,
        created_at: row.created_at || null,
        updated_at: row.updated_at || null,
        deleted_at: row.deleted_at || null,
    };
}

export function deriveKycOverallStatus(rows: KycDocumentRow[]) {
    if (rows.some((row) => effectiveKycDocumentStatus(row) === 'rejected')) return 'rejected';
    const byType = new Map(rows.map((row) => [row.document_type, row]));
    const required = REQUIRED_DOCUMENTS.filter((item) => item.required);
    if (required.every((item) => {
        const row = byType.get(item.document_type);
        return Boolean(row && hasLiveProviderEvidence(row));
    })) return 'verified';
    if (rows.some((row) => effectiveKycDocumentStatus(row) === 'needs_review')) return 'needs_review';
    if (rows.some((row) => effectiveKycDocumentStatus(row) === 'submitted')) return 'in_progress';
    return 'not_started';
}

function nextAction(status: string, rows: KycDocumentRow[], mode: MerchantKycProviderMode): string {
    if (status === 'verified') return 'Business verification is complete.';
    if (status === 'rejected') return 'Review the rejected document and submit an updated proof.';
    if (rows.some((row) => row.metadata?.private_object_key && row.metadata.malware_scan_status === 'rejected'))
        return 'A document failed its security scan. Replace that file to continue verification.';
    if (rows.length === 0) return 'Upload business PAN, bank proof, and address proof privately.';
    const byType = new Map(rows.map((row) => [row.document_type, row]));
    if (REQUIRED_DOCUMENTS.some((item) => item.required && !byType.get(item.document_type)?.metadata?.private_object_key))
        return mode === 'sandbox'
            ? 'Upload the remaining required documents privately. Sandbox uploads are not provider reviewed and cannot enable live payouts.'
            : 'Upload the remaining required documents privately. Reference digits alone are not verification evidence.';
    if (mode === 'sandbox' && rows.some((row) => row.metadata?.private_object_key && row.metadata.malware_scan_status !== 'clean'))
        return 'Sandbox upload received. Security scan pending. It is not provider reviewed and cannot enable live payouts.';
    if (mode === 'sandbox' && rows.length > 0) return 'Sandbox uploads are stored for testing only. They are not provider reviewed and cannot enable live payouts.';
    if (rows.some((row) => row.metadata?.private_object_key && row.metadata.malware_scan_status !== 'clean'))
        return 'A security scan is pending before provider review can begin.';
    if (rows.some((row) => row.metadata?.provider_unavailable)) return 'Verification provider is unavailable. Your submission remains pending; retry later.';
    if (status === 'needs_review') return 'A submitted document needs review.';
    if (status === 'in_progress') return 'Your submitted documents are awaiting provider review.';
    return 'Submit business PAN, bank proof, and address proof.';
}

function buildOverview(siteId: string, rows: KycDocumentRow[], mode: MerchantKycProviderMode) {
    const byType = new Map(rows.map((row) => [row.document_type, row]));
    const derived = deriveKycOverallStatus(rows);
    const status = mode === 'sandbox' && derived === 'verified' ? 'in_progress' : derived;
    return {
        site_id: siteId,
        overall_status: status,
        provider_mode: mode,
        required_documents: REQUIRED_DOCUMENTS.map((item) => ({
            ...item,
            status: byType.get(item.document_type)
                ? serializeDocument(byType.get(item.document_type)!).status : null,
        })),
        documents: rows.map(serializeDocument),
        next_action: nextAction(status, rows, mode),
    };
}

async function loadDocuments(db: ReturnType<typeof getSupabaseAdmin>, siteId: string): Promise<KycDocumentRow[]> {
    const { data, error } = await db
        .from('merchant_kyc_documents')
        .select('*')
        .eq('site_id', siteId)
        .is('deleted_at', null)
        .order('updated_at', { ascending: false });

    if (error) throw new Error(`KYC document lookup failed: ${error.message}`);
    return (data || []) as unknown as KycDocumentRow[];
}

async function loadDocument(db: ReturnType<typeof getSupabaseAdmin>, id: string, siteId: string): Promise<KycDocumentRow | null> {
    const { data, error } = await db
        .from('merchant_kyc_documents')
        .select('*')
        .eq('id', id)
        .eq('site_id', siteId)
        .is('deleted_at', null)
        .maybeSingle();

    if (error) throw new Error(`KYC document lookup failed: ${error.message}`);
    return (data as unknown as KycDocumentRow | null) || null;
}

function verificationUnavailableResult(
    env: Env,
    input: { documentType: MerchantKycDocumentType; documentId: string },
) {
    return {
        status: 'submitted' as const,
        provider: providerName(env),
        providerMode: providerMode(env),
        providerReference: null,
        rejectionReason: null,
        metadata: {
            provider_unavailable: true,
            document_type: input.documentType,
            document_id: input.documentId,
            checked_at: new Date().toISOString(),
        },
    };
}

async function verifyWithProvider(
    env: Env,
    input: {
        siteId: string;
        documentId: string;
        documentType: MerchantKycDocumentType;
        documentNumberLast4?: string | null;
        fileUrl?: string | null;
    },
) {
    try {
        const adapter = createKycVerificationAdapter({
            provider: providerName(env),
            mode: providerMode(env),
            apiKey: env.KYC_PROVIDER_API_KEY,
            accountId: env.KYC_PROVIDER_ACCOUNT_ID,
        });
        return await adapter.verifyDocument({
            siteId: input.siteId,
            documentId: input.documentId,
            documentType: input.documentType,
            documentNumberLast4: input.documentNumberLast4,
            fileUrl: input.fileUrl,
        });
    } catch {
        return verificationUnavailableResult(env, input);
    }
}

router.get('/', validate('query', StoreQuerySchema), async (c) => {
    const query = c.get('validatedQuery') as StoreQuery;
    const db = getSupabaseAdmin(c);
    const tenant = await resolveTenantContextForOwnedSite(c, query.store_id);
    const rows = await loadDocuments(db, tenant.siteId);
    return c.json(success(buildOverview(tenant.siteId, rows, providerMode(c.env))));
});

router.post('/documents', validate('json', SubmitKycDocumentSchema), async (c) => {
    // The JSON endpoint predates private evidence upload. A last-four reference
    // cannot represent a submitted document or authorize provider review.
    return c.json({ error: { code: 'KYC_PRIVATE_UPLOAD_REQUIRED',
        message: 'Upload the document privately to submit it for verification.' } }, 410);
});

// Evidence stays in a dedicated private R2 bucket. No public URL or object key
// is returned to the merchant, storefront, or provider adapter.
router.post('/documents/upload', bodyLimit({ maxSize: 6 * 1024 * 1024 }), async (c) => {
    const idempotencyKey = c.req.header('X-Idempotency-Key');
    if (!idempotencyKey || idempotencyKey.length < 8 || idempotencyKey.length > 160) {
        return c.json({ error: { code: 'IDEMPOTENCY_KEY_REQUIRED', message: 'A valid idempotency key is required.' } }, 400);
    }
    const bucket = c.env.KYC_PRIVATE_BUCKET;
    if (!bucket) return c.json({ error: { code: 'KYC_UPLOAD_UNAVAILABLE', message: 'Private document upload is not configured. Please retry later.' } }, 503);
    const declaredLength = Number(c.req.header('content-length') || 0);
    if (declaredLength > 6 * 1024 * 1024) return c.json({ error: { code: 'KYC_FILE_TOO_LARGE', message: 'Choose a document under 5 MB.' } }, 413);
    let form: FormData;
    try { form = await c.req.formData(); }
    catch { return c.json({ error: { code: 'KYC_INVALID_UPLOAD', message: 'Upload a valid document.' } }, 400); }
    const input = StoreQuerySchema.extend({ document_type: DocumentTypeSchema, document_number_last4: z.string().trim().min(2).max(8).regex(/^[A-Za-z0-9]+$/) }).safeParse({
        store_id: form.get('store_id'),
        document_type: form.get('document_type'),
        document_number_last4: form.get('document_number_last4'),
    });
    if (!input.success) return c.json({ error: { code: 'KYC_INVALID_UPLOAD', message: 'Choose a document type and enter its final reference characters.' } }, 400);
    const file = form.get('file') as File | string | null;
    if (!(file instanceof File) || file.size === 0 || file.size > 5 * 1024 * 1024) {
        return c.json({ error: { code: 'KYC_INVALID_FILE', message: 'Choose a PDF, JPEG, or PNG under 5 MB.' } }, 400);
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    const pdf = bytes.length >= 5 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2d;
    const jpeg = bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    const png = bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((byte, index) => bytes[index] === byte);
    const contentType = pdf ? 'application/pdf' : jpeg ? 'image/jpeg' : png ? 'image/png' : null;
    if (!contentType || (file.type !== contentType && file.type !== 'application/octet-stream')) return c.json({ error: { code: 'KYC_UNSUPPORTED_FILE', message: 'Only PDF, JPEG, and PNG documents are accepted.' } }, 415);

    const db = getSupabaseAdmin(c);
    const tenant = await resolveTenantContextForOwnedSite(c, input.data.store_id);
    const { data: existing, error: lookupError } = await db.from('merchant_kyc_documents').select('*')
        .eq('site_id', tenant.siteId).eq('document_type', input.data.document_type).is('deleted_at', null).maybeSingle();
    if (lookupError) throw new Error('KYC document lookup failed');
    const prior = existing as KycDocumentRow | null;
    const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), (byte) => byte.toString(16).padStart(2, '0')).join('');
    // The current document row alone cannot remember a key after replacement.
    // Claim it in the canonical site-scoped receipt store before the R2 write.
    const idempotency = new IdempotencyExecutionAdapter(db);
    const claim = await idempotency.begin({
        siteId: tenant.siteId,
        key: idempotencyKey,
        scope: `kyc:document-upload:${input.data.document_type}`,
        requestBody: { document_type: input.data.document_type, document_number_last4: input.data.document_number_last4, sha256: digest },
        requestId: c.req.header('X-Request-ID') || null,
        expiresInSeconds: 30 * 24 * 60 * 60,
    });
    if (claim.kind === 'claimed' && claim.id === 'dev-idempotency-id') {
        throw new AppError('Private document upload receipts are unavailable. Please retry later.', 503, 'KYC_RECEIPT_UNAVAILABLE');
    }
    if (prior?.metadata?.idempotency_key === idempotencyKey) {
        if (prior.metadata.sha256 !== digest || prior.document_number_last4 !== input.data.document_number_last4) {
            if (claim.kind === 'claimed') await idempotency.fail(claim.id);
            return c.json({ error: { code: 'IDEMPOTENCY_CONFLICT', message: 'This upload key was already used for a different document.' } }, 409);
        }
        const rows = await loadDocuments(db, tenant.siteId);
        if (claim.kind === 'claimed') await idempotency.complete({ id: claim.id,
            responseBody: { success: true, data: { document_id: prior.id } }, statusCode: 201,
            resourceType: 'merchant_kyc_document', resourceId: prior.id });
        return c.json(success({ document: serializeDocument(prior), overview: buildOverview(tenant.siteId, rows, providerMode(c.env)) }), 200);
    }
    if (claim.kind === 'replay') {
        return c.json({ error: { code: 'KYC_UPLOAD_SUPERSEDED', message: 'This upload was replaced by a newer document. Reload its status.' } }, 409);
    }
    const key = `kyc/${tenant.siteId}/${input.data.document_type}/${crypto.randomUUID()}`;
    try {
        await bucket.put(key, bytes, { httpMetadata: { contentType, contentDisposition: 'attachment' } });
        const now = new Date().toISOString();
        const values = {
            site_id: tenant.siteId,
            document_type: input.data.document_type,
            document_number_last4: input.data.document_number_last4,
            status: 'submitted',
            provider: providerName(c.env),
            provider_mode: providerMode(c.env),
            provider_reference: null,
            file_url: null,
            file_name: null,
            rejection_reason: null,
            metadata: { private_object_key: key, sha256: digest, content_type: contentType, byte_size: bytes.length,
                malware_scan_status: 'pending', provider_review_required: true, idempotency_key: idempotencyKey },
            submitted_by: tenant.userId,
            submitted_at: now,
            verified_at: null,
            rejected_at: null,
            updated_by: tenant.userId,
        };
        let document: KycDocumentRow;
        try {
            const result = prior
                ? await db.from('merchant_kyc_documents').update(values)
                    .eq('id', prior.id).eq('site_id', tenant.siteId).eq('updated_at', prior.updated_at)
                    .is('deleted_at', null).select('*').maybeSingle()
                : await db.from('merchant_kyc_documents').insert({ id: crypto.randomUUID(), ...values, created_by: tenant.userId }).select('*').maybeSingle();
            if (result.error?.code === '23505' || (!result.error && !result.data))
                throw new AppError('This document changed while you were uploading. Reload and try again.', 409, 'KYC_CONFLICT');
            if (result.error || !result.data) throw new Error('KYC document save failed');
            document = result.data as KycDocumentRow;
        } catch (error) {
            await bucket.delete(key);
            throw error;
        }
        const oldKey = prior?.metadata?.private_object_key;
        if (typeof oldKey === 'string' && oldKey.startsWith(`kyc/${tenant.siteId}/`)) await bucket.delete(oldKey);
        const rows = await loadDocuments(db, tenant.siteId);
        await idempotency.complete({ id: claim.id,
            responseBody: { success: true, data: { document_id: document.id } }, statusCode: 201,
            resourceType: 'merchant_kyc_document', resourceId: document.id });
        return c.json(success({ document: serializeDocument(document), overview: buildOverview(tenant.siteId, rows, providerMode(c.env)) }), 201);
    } catch (error) {
        await idempotency.fail(claim.id);
        throw error;
    }
});

router.post('/documents/:id/refresh', validate('query', StoreQuerySchema), async (c) => {
    const db = getSupabaseAdmin(c);
    const tenant = await resolveTenantContextForOwnedSite(c, (c.get('validatedQuery') as StoreQuery).store_id);
    const document = await loadDocument(db, c.req.param('id'), tenant.siteId);
    if (!document) {
        return c.json({ error: { code: 'KYC_DOCUMENT_NOT_FOUND', message: 'KYC document not found' } }, 404);
    }
    // A live provider must never receive an unscanned or historical reference-only
    // document. The merchant can refresh the truthful current status while the
    // trusted scanner is pending or has rejected the file, without a paid lookup.
    if (providerMode(c.env) === 'live'
        && (typeof document.metadata?.private_object_key !== 'string'
            || document.metadata.malware_scan_status !== 'clean')) {
        const rows = await loadDocuments(db, tenant.siteId);
        return c.json(success({
            document: serializeDocument(document),
            overview: buildOverview(tenant.siteId, rows, providerMode(c.env)),
        }));
    }
    const verification = await verifyWithProvider(c.env, {
        siteId: tenant.siteId,
        documentId: document.id,
        documentType: document.document_type,
        documentNumberLast4: document.document_number_last4 || null,
        fileUrl: document.file_url || null,
    });
    const now = new Date().toISOString();
    const providerMetadata: Record<string, unknown> = verification.metadata;
    const providerApproved = acceptsLiveKycApproval(document, verification);
    const status = verification.status === 'verified' && !providerApproved
        ? 'needs_review' : verification.status;
    const { data, error } = await db
        .from('merchant_kyc_documents')
        .update({
            status,
            provider: verification.provider,
            provider_mode: verification.providerMode,
            provider_reference: verification.providerReference,
            rejection_reason: verification.rejectionReason || null,
            metadata: {
                ...(document.metadata || {}),
                // Provider output must not overwrite the private object pointer,
                // file digest, or trusted scanner verdict. Store only reviewed flags.
                provider_unavailable: providerMetadata.provider_unavailable === true,
                sandbox: verification.providerMode === 'sandbox',
                manual_review_required: providerMetadata.manual_review_required === true
                    || (verification.status === 'verified' && !providerApproved),
                provider_checked_at: now,
                // A pending/outage result revokes any previous provider approval.
                provider_verified: providerApproved,
            },
            verified_at: providerApproved ? now : null,
            rejected_at: status === 'rejected' ? now : null,
            updated_by: tenant.userId,
        })
        .eq('id', document.id)
        .eq('site_id', tenant.siteId)
        // A new upload reuses this row. Never let a response for the previous
        // evidence overwrite its object pointer, status, or provider decision.
        .eq('updated_at', document.updated_at)
        .is('deleted_at', null)
        .select('*')
        .maybeSingle();

    if (error) throw new Error(`KYC document refresh failed: ${error.message}`);
    if (!data) throw new AppError('This document changed during verification. Reload its current status.', 409, 'KYC_CONFLICT');
    const rows = await loadDocuments(db, tenant.siteId);
    return c.json(success({
        document: serializeDocument(data as unknown as KycDocumentRow),
        overview: buildOverview(tenant.siteId, rows, providerMode(c.env)),
    }));
});

export default router;
