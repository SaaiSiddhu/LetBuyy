import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../../index';
import { AppError } from '../../lib/errors';
import { getSupabaseAdmin, success } from '../../lib/supabase';
import { requireConsolePermission } from '../../identity-foundation/console-approval-repository';
import { effectiveKycDocumentStatus, type KycEvidenceStatusRow } from '../../lib/kyc-evidence-status';
import { hasIsolatedKycPrivateBucket } from '../../lib/kyc-private-object-cleanup';
import { signKycIndiaS3ReviewUrl } from '@letbuyy/infrastructure/storage-adapter';

const router = new Hono<{ Bindings: Env }>();

const SiteQuery = z.object({
    siteId: z.string().uuid(),
    reason: z.string().trim().min(8).max(1000),
});
const DocumentQuery = SiteQuery.extend({ documentId: z.string().uuid() });
const PageQuery = SiteQuery.extend({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(20).default(20),
});
type KycRow = KycEvidenceStatusRow & {
    id: string;
    site_id: string;
    document_type: string;
    document_number_last4: string | null;
    submitted_at: string | null;
    updated_at: string;
    metadata: Record<string, unknown> | null;
};

function publicReviewRow(row: KycRow) {
    return {
        id: row.id,
        site_id: row.site_id,
        document_type: row.document_type,
        status: effectiveKycDocumentStatus(row),
        provider_mode: row.provider_mode,
        document_number_last4: row.document_number_last4,
        submitted_at: row.submitted_at,
        updated_at: row.updated_at,
        has_private_upload: typeof row.metadata?.private_object_key === 'string',
        malware_scan_status: row.metadata?.malware_scan_status === 'clean' || row.metadata?.malware_scan_status === 'rejected'
            ? row.metadata.malware_scan_status : 'pending',
    };
}

async function auditRead(c: Parameters<typeof requireConsolePermission>[0], actor: {
    actor_id: string; email: string; is_super_admin: boolean; session_id: string;
}, input: { action: string; siteId: string; documentId?: string; reason: string }) {
    const { error } = await getSupabaseAdmin(c).from('audit_logs').insert({
        actor_id: actor.actor_id,
        actor_type: actor.is_super_admin ? 'super_admin' : 'employee',
        actor_email: actor.email,
        action: input.action,
        resource_type: input.documentId ? 'merchant_kyc_document' : 'site',
        resource_id: input.documentId || input.siteId,
        metadata: { site_id: input.siteId, reason: input.reason, session_id: actor.session_id,
            source: 'platform-console' },
        ip_address: c.req.header('CF-Connecting-IP') || null,
        user_agent: c.req.header('User-Agent') || null,
    });
    if (error) throw new AppError('Evidence access audit is unavailable.', 503, 'KYC_AUDIT_UNAVAILABLE');
}

router.get('/sites/:siteId/documents', async (c) => {
    const parsed = PageQuery.safeParse({ siteId: c.req.param('siteId'), reason: c.req.query('reason'),
        page: c.req.query('page'), limit: c.req.query('limit') });
    if (!parsed.success) throw new AppError('A valid site, page and review reason are required.', 400, 'KYC_REVIEW_QUERY_INVALID');
    const { state } = await requireConsolePermission(c, 'merchant:pii', true);
    const { siteId, reason, page, limit } = parsed.data;
    const db = getSupabaseAdmin(c);
    const { data, error, count } = await db.from('merchant_kyc_documents')
        .select('id,site_id,document_type,status,provider,provider_mode,provider_reference,document_number_last4,submitted_at,updated_at,metadata', { count: 'exact' })
        .eq('site_id', siteId).is('deleted_at', null).order('updated_at', { ascending: false })
        .range((page - 1) * limit, page * limit - 1);
    if (error) throw new AppError('KYC evidence is unavailable.', 503, 'KYC_REVIEW_UNAVAILABLE');
    await auditRead(c, state, { action: 'kyc.evidence.list', siteId, reason });
    return c.json(success({ data: ((data || []) as KycRow[]).map(publicReviewRow), page, limit, total: count || 0 }));
});

router.get('/sites/:siteId/documents/:documentId/file', async (c) => {
    const parsed = DocumentQuery.safeParse({ siteId: c.req.param('siteId'), documentId: c.req.param('documentId'),
        reason: c.req.query('reason') });
    if (!parsed.success) throw new AppError('A valid site, document and review reason are required.', 400, 'KYC_REVIEW_QUERY_INVALID');
    const { state } = await requireConsolePermission(c, 'merchant:pii', true);
    const { siteId, documentId, reason } = parsed.data;
    const { data, error } = await getSupabaseAdmin(c).from('merchant_kyc_documents')
        .select('id,site_id,document_type,status,provider,provider_mode,provider_reference,document_number_last4,submitted_at,updated_at,metadata')
        .eq('id', documentId).eq('site_id', siteId).is('deleted_at', null).maybeSingle();
    if (error) throw new AppError('KYC evidence is unavailable.', 503, 'KYC_REVIEW_UNAVAILABLE');
    if (!data) throw new AppError('KYC evidence was not found.', 404, 'KYC_DOCUMENT_NOT_FOUND');
    const row = data as KycRow;
    const key = row.metadata?.private_object_key;
    if (typeof key !== 'string' || !key.startsWith(`kyc/${siteId}/${row.document_type}/`))
        throw new AppError('Private evidence is unavailable.', 503, 'KYC_PRIVATE_EVIDENCE_UNAVAILABLE');
    if (row.metadata?.malware_scan_status !== 'clean')
        throw new AppError('This evidence is quarantined until its safety scan passes.', 409, 'KYC_EVIDENCE_QUARANTINED');
    if (row.metadata?.private_storage_provider === 'aws_s3_mumbai') {
        const env = c.env;
        if (env.ENVIRONMENT !== 'test' || env.KYC_INDIA_REVIEW_ENABLED !== 'true'
            || !env.KYC_INDIA_BUCKET || !env.KYC_INDIA_REVIEW_ACCESS_KEY_ID
            || !env.KYC_INDIA_REVIEW_SECRET_ACCESS_KEY)
            throw new AppError('India private evidence review is not available yet.', 503, 'KYC_INDIA_REVIEW_UNAVAILABLE');
        const receiptId = row.metadata.private_upload_receipt_id;
        const versionId = row.metadata.private_object_version_id;
        const scanEventId = row.metadata.scan_event_id;
        const contentType = row.metadata.content_type;
        if (typeof receiptId !== 'string' || typeof versionId !== 'string'
            || typeof scanEventId !== 'string'
            || !['business_pan', 'gst_certificate', 'bank_proof', 'address_proof', 'identity_proof'].includes(row.document_type)
            || !['application/pdf', 'image/jpeg', 'image/png'].includes(contentType as string))
            throw new AppError('Private evidence is unavailable.', 503, 'KYC_PRIVATE_EVIDENCE_UNAVAILABLE');
        const { data: receipt, error: receiptError } = await getSupabaseAdmin(c)
            .from('kyc_private_object_cleanup_jobs')
            .select('id,site_id,object_key,document_type,storage_provider,purpose,status,outcome,object_version_id,head_verified_at,expected_content_type,scan_event_id,scan_verdict,scan_completed_at')
            .eq('id', receiptId).eq('site_id', siteId).eq('storage_provider', 'aws_s3_mumbai')
            .eq('purpose', 'upload_reservation').is('deleted_at', null).maybeSingle();
        if (receiptError || !receipt || receipt.object_key !== key
            || key !== `kyc/${siteId}/${row.document_type}/${receiptId}`
            || receipt.document_type !== row.document_type
            || receipt.object_version_id !== versionId || !receipt.head_verified_at
            || receipt.expected_content_type !== contentType
            || receipt.status !== 'completed' || receipt.outcome !== 'retained'
            || receipt.scan_event_id !== scanEventId || receipt.scan_verdict !== 'clean'
            || !receipt.scan_completed_at)
            throw new AppError('Private evidence is unavailable.', 503, 'KYC_PRIVATE_EVIDENCE_UNAVAILABLE');
        // The audit commits before a bearer URL can be issued. Never log the URL.
        await auditRead(c, state, { action: 'kyc.evidence.download_ticket', siteId, documentId, reason });
        let location: string;
        try {
            location = await signKycIndiaS3ReviewUrl({
                siteId, documentType: row.document_type as 'business_pan', receiptId,
                versionId, bucket: env.KYC_INDIA_BUCKET, region: 'ap-south-1',
                contentType: contentType as 'application/pdf',
                accessKeyId: env.KYC_INDIA_REVIEW_ACCESS_KEY_ID,
                secretAccessKey: env.KYC_INDIA_REVIEW_SECRET_ACCESS_KEY,
                sessionToken: env.KYC_INDIA_REVIEW_SESSION_TOKEN,
            });
        } catch {
            throw new AppError('India private evidence review is unavailable.', 503, 'KYC_INDIA_REVIEW_UNAVAILABLE');
        }
        return new Response(null, { status: 302, headers: {
            Location: location, 'Cache-Control': 'private, no-store, max-age=0',
            'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff',
        } });
    }
    if (row.metadata?.private_storage_provider !== undefined
        && row.metadata.private_storage_provider !== 'r2_fixture')
        throw new AppError('Private evidence storage is unavailable.', 503, 'KYC_PRIVATE_STORAGE_UNAVAILABLE');
    const bucket = c.env.KYC_PRIVATE_BUCKET;
    if (!bucket || !hasIsolatedKycPrivateBucket(c.env))
        throw new AppError('Private evidence storage is unavailable.', 503, 'KYC_PRIVATE_STORAGE_UNAVAILABLE');
    // A failed audit must prevent the sensitive bytes from being released.
    await auditRead(c, state, { action: 'kyc.evidence.download', siteId, documentId, reason });
    const object = await bucket.get(key);
    if (!object) throw new AppError('Private evidence is unavailable.', 503, 'KYC_PRIVATE_EVIDENCE_UNAVAILABLE');
    const contentType = row.metadata?.content_type;
    const safeType = contentType === 'application/pdf' || contentType === 'image/jpeg' || contentType === 'image/png'
        ? contentType : 'application/octet-stream';
    const extension = safeType === 'application/pdf' ? 'pdf' : safeType === 'image/jpeg' ? 'jpg' : safeType === 'image/png' ? 'png' : 'bin';
    return new Response(object.body, { headers: {
        'Content-Type': safeType,
        'Content-Disposition': `attachment; filename="kyc-evidence.${extension}"`,
        'Cache-Control': 'private, no-store, max-age=0',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': 'sandbox',
    } });
});

export default router;
