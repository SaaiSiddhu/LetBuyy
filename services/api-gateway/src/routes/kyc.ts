import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../index';
import { getSupabaseAdmin, getSupabaseAdminUnguarded, success } from '../lib/supabase';
import { resolveTenantContextForOwnedSite } from '../lib/tenant-context';
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
    file_url: z.string().url().optional(),
    file_name: z.string().trim().min(1).max(255).optional(),
    idempotency_key: z.string().min(8).max(160).optional(),
}).refine((value) => Boolean(value.document_number_last4 || value.file_url), {
    message: 'Document evidence is required',
    path: ['file_url'],
});

type StoreQuery = z.infer<typeof StoreQuerySchema>;
type SubmitKycDocumentInput = z.infer<typeof SubmitKycDocumentSchema>;

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
    return value === 'hyperverge' || value === 'manual' || value === 'signzy' ? value : 'signzy';
}

function serializeDocument(row: KycDocumentRow) {
    return {
        id: row.id,
        site_id: row.site_id,
        document_type: row.document_type,
        status: row.status,
        provider: row.provider,
        provider_mode: row.provider_mode,
        provider_reference: row.provider_reference || null,
        document_number_last4: row.document_number_last4 || null,
        file_url: row.file_url || null,
        file_name: row.file_name || null,
        rejection_reason: row.rejection_reason || null,
        metadata: row.metadata || {},
        submitted_at: row.submitted_at || null,
        verified_at: row.verified_at || null,
        rejected_at: row.rejected_at || null,
        created_at: row.created_at || null,
        updated_at: row.updated_at || null,
        deleted_at: row.deleted_at || null,
    };
}

function overallStatus(rows: KycDocumentRow[]) {
    if (rows.some((row) => row.status === 'rejected')) return 'rejected';
    const byType = new Map(rows.map((row) => [row.document_type, row]));
    const required = REQUIRED_DOCUMENTS.filter((item) => item.required);
    if (required.every((item) => byType.get(item.document_type)?.status === 'verified')) return 'verified';
    if (rows.some((row) => row.status === 'needs_review')) return 'needs_review';
    if (rows.some((row) => row.status === 'submitted' || row.status === 'verified')) return 'in_progress';
    return 'not_started';
}

function nextAction(status: string): string {
    if (status === 'verified') return 'Business verification is complete.';
    if (status === 'rejected') return 'Review the rejected document and submit an updated proof.';
    if (status === 'needs_review') return 'A submitted document needs review.';
    if (status === 'in_progress') return 'Submit the remaining required documents.';
    return 'Submit business PAN, bank proof, and address proof.';
}

function buildOverview(siteId: string, rows: KycDocumentRow[], mode: MerchantKycProviderMode) {
    const byType = new Map(rows.map((row) => [row.document_type, row]));
    const status = overallStatus(rows);
    return {
        site_id: siteId,
        overall_status: status,
        provider_mode: mode,
        required_documents: REQUIRED_DOCUMENTS.map((item) => ({
            ...item,
            status: byType.get(item.document_type)?.status || null,
        })),
        documents: rows.map(serializeDocument),
        next_action: nextAction(status),
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

async function loadDocument(db: ReturnType<typeof getSupabaseAdminUnguarded>, id: string): Promise<KycDocumentRow | null> {
    const { data, error } = await db
        .from('merchant_kyc_documents')
        .select('*')
        .eq('id', id)
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

async function saveDocument(
    db: ReturnType<typeof getSupabaseAdmin>,
    env: Env,
    tenant: { siteId: string; userId: string | null },
    body: SubmitKycDocumentInput,
): Promise<KycDocumentRow> {
    const { data: existing, error: existingError } = await db
        .from('merchant_kyc_documents')
        .select('*')
        .eq('site_id', tenant.siteId)
        .eq('document_type', body.document_type)
        .is('deleted_at', null)
        .maybeSingle();

    if (existingError) throw new Error(`KYC document lookup failed: ${existingError.message}`);

    const documentId = (existing as { id?: string } | null)?.id || crypto.randomUUID();
    const now = new Date().toISOString();
    const verification = await verifyWithProvider(env, {
        siteId: tenant.siteId,
        documentId,
        documentType: body.document_type,
        documentNumberLast4: body.document_number_last4 || null,
        fileUrl: body.file_url || null,
    });
    const status = verification.status;
    const values = {
        site_id: tenant.siteId,
        document_type: body.document_type,
        status,
        provider: verification.provider,
        provider_mode: verification.providerMode,
        provider_reference: verification.providerReference,
        document_number_last4: body.document_number_last4 || null,
        file_url: body.file_url || null,
        file_name: body.file_name || null,
        rejection_reason: verification.rejectionReason || null,
        metadata: {
            ...verification.metadata,
            idempotency_key: body.idempotency_key || null,
        },
        submitted_by: tenant.userId,
        submitted_at: now,
        verified_at: status === 'verified' ? now : null,
        rejected_at: status === 'rejected' ? now : null,
        updated_by: tenant.userId,
    };

    if (existing) {
        const { data, error } = await db
            .from('merchant_kyc_documents')
            .update(values)
            .eq('id', documentId)
            .eq('site_id', tenant.siteId)
            .select('*')
            .single();
        if (error) throw new Error(`KYC document update failed: ${error.message}`);
        return data as unknown as KycDocumentRow;
    }

    const { data, error } = await db
        .from('merchant_kyc_documents')
        .insert({ id: documentId, ...values, created_by: tenant.userId })
        .select('*')
        .single();
    if (error) throw new Error(`KYC document insert failed: ${error.message}`);
    return data as unknown as KycDocumentRow;
}

router.get('/', validate('query', StoreQuerySchema), async (c) => {
    const query = c.get('validatedQuery') as StoreQuery;
    const db = getSupabaseAdmin(c);
    const tenant = await resolveTenantContextForOwnedSite(c, query.store_id);
    const rows = await loadDocuments(db, tenant.siteId);
    return c.json(success(buildOverview(tenant.siteId, rows, providerMode(c.env))));
});

router.post('/documents', validate('json', SubmitKycDocumentSchema), async (c) => {
    const body = c.get('validatedBody') as SubmitKycDocumentInput;
    const db = getSupabaseAdmin(c);
    const tenant = await resolveTenantContextForOwnedSite(c, body.store_id);
    const document = await saveDocument(db, c.env, tenant, body);
    const rows = await loadDocuments(db, tenant.siteId);
    return c.json(success({
        document: serializeDocument(document),
        overview: buildOverview(tenant.siteId, rows, providerMode(c.env)),
    }), 201);
});

router.post('/documents/:id/refresh', async (c) => {
    const db = getSupabaseAdmin(c);
    const document = await loadDocument(getSupabaseAdminUnguarded(c), c.req.param('id'));
    if (!document) {
        return c.json({ error: { code: 'KYC_DOCUMENT_NOT_FOUND', message: 'KYC document not found' } }, 404);
    }
    const tenant = await resolveTenantContextForOwnedSite(c, document.site_id);
    const verification = await verifyWithProvider(c.env, {
        siteId: tenant.siteId,
        documentId: document.id,
        documentType: document.document_type,
        documentNumberLast4: document.document_number_last4 || null,
        fileUrl: document.file_url || null,
    });
    const now = new Date().toISOString();
    const status = verification.status;
    const { data, error } = await db
        .from('merchant_kyc_documents')
        .update({
            status,
            provider: verification.provider,
            provider_mode: verification.providerMode,
            provider_reference: verification.providerReference,
            rejection_reason: verification.rejectionReason || null,
            metadata: verification.metadata,
            verified_at: status === 'verified' ? now : null,
            rejected_at: status === 'rejected' ? now : null,
            updated_by: tenant.userId,
        })
        .eq('id', document.id)
        .eq('site_id', tenant.siteId)
        .select('*')
        .single();

    if (error) throw new Error(`KYC document refresh failed: ${error.message}`);
    const rows = await loadDocuments(db, tenant.siteId);
    return c.json(success({
        document: serializeDocument(data as unknown as KycDocumentRow),
        overview: buildOverview(tenant.siteId, rows, providerMode(c.env)),
    }));
});

export default router;
