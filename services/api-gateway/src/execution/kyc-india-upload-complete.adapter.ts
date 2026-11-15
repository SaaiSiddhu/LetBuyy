import { headKycIndiaS3Object } from '@letbuyy/infrastructure/storage-adapter';
import type { Env } from '../index';
import { AppError, ForbiddenError } from '../lib/errors';
import type { TenantContext } from '../lib/tenant-context';
import type { getSupabaseAdmin } from '../lib/supabase';

type Db = ReturnType<typeof getSupabaseAdmin>;
type DocumentType = 'business_pan' | 'gst_certificate' | 'bank_proof' | 'address_proof' | 'identity_proof';

interface IndiaReceipt {
    id: string;
    created_by: string;
    site_id: string;
    object_key: string;
    document_type: DocumentType;
    status: 'pending' | 'completed';
    outcome: 'retained' | 'deleted' | null;
    expected_sha256_hex: string;
    expected_bytes: number;
    expected_content_type: 'application/pdf' | 'image/jpeg' | 'image/png';
    reference_last4: string;
    upload_idempotency_key: string;
    object_version_id: string | null;
    head_verified_at: string | null;
    next_attempt_at: string;
}

interface CurrentDocument {
    id: string;
    status: string;
    updated_at: string;
    metadata: Record<string, unknown>;
}

export interface IndiaUploadCompletionInput {
    store_id: string;
    receipt_id: string;
    version_id: string;
}

function unavailable(): never {
    throw new AppError('Private document verification is unavailable. Retry later.', 503, 'KYC_INDIA_COMPLETION_UNAVAILABLE');
}

function conflict(): never {
    throw new AppError('This upload changed or expired. Reload and upload the document again.', 409, 'KYC_INDIA_COMPLETION_CONFLICT');
}

async function retainVerifiedReceipt(db: Db, tenant: TenantContext, receipt: IndiaReceipt,
    versionId: string): Promise<void> {
    if (receipt.status === 'completed' && receipt.outcome === 'retained') return;
    const { data: retained, error: retainError } = await db.from('kyc_private_object_cleanup_jobs')
        .update({ status: 'completed', outcome: 'retained', completed_at: new Date().toISOString() })
        .eq('id', receipt.id).eq('site_id', tenant.siteId)
        .eq('storage_provider', 'aws_s3_mumbai').eq('purpose', 'upload_reservation')
        .eq('status', 'pending').eq('object_version_id', versionId)
        .not('head_verified_at', 'is', null).select('id').maybeSingle();
    if (retainError || !retained) unavailable();
}

/** Verified S3 metadata is the only input allowed to attach bytes to the KYC row. */
export async function completeIndiaUpload(env: Env, db: Db, tenant: TenantContext,
    input: IndiaUploadCompletionInput, idempotencyKey: string) {
    if (tenant.siteId !== input.store_id || !tenant.userId) throw new ForbiddenError('Not authorized for this store');
    const { data: found, error: lookupError } = await db.from('kyc_private_object_cleanup_jobs')
        .select('id,created_by,site_id,object_key,document_type,status,outcome,expected_sha256_hex,expected_bytes,expected_content_type,reference_last4,upload_idempotency_key,object_version_id,head_verified_at,next_attempt_at')
        .eq('site_id', tenant.siteId).eq('id', input.receipt_id)
        .eq('storage_provider', 'aws_s3_mumbai').eq('purpose', 'upload_reservation')
        .is('deleted_at', null).maybeSingle();
    if (lookupError) unavailable();
    const receipt = found as IndiaReceipt | null;
    if (!receipt) throw new AppError('Upload receipt was not found.', 404, 'KYC_INDIA_RECEIPT_NOT_FOUND');
    if (receipt.created_by !== tenant.userId
        || receipt.upload_idempotency_key !== idempotencyKey
        || receipt.object_key !== `kyc/${tenant.siteId}/${receipt.document_type}/${receipt.id}`
        || !['business_pan', 'gst_certificate', 'bank_proof', 'address_proof', 'identity_proof'].includes(receipt.document_type)
        || receipt.status === 'completed' && receipt.outcome !== 'retained'
        || receipt.object_version_id && receipt.object_version_id !== input.version_id) conflict();

    const currentLookup = () => db.from('merchant_kyc_documents').select('*')
        .eq('site_id', tenant.siteId).eq('document_type', receipt.document_type)
        .is('deleted_at', null).maybeSingle();
    const { data: before, error: currentError } = await currentLookup();
    if (currentError) unavailable();
    const prior = before as CurrentDocument | null;
    if (prior?.metadata?.private_upload_receipt_id === receipt.id
        && prior.metadata.private_object_version_id === input.version_id) {
        // Evidence may have committed before a failed retain write. Repair the
        // receipt before reporting a successful replay so cleanup cannot delete it.
        await retainVerifiedReceipt(db, tenant, receipt, input.version_id);
        return { document_id: prior.id, receipt_id: receipt.id, document_status: prior.status,
            evidence_scan_status: prior.metadata.malware_scan_status || 'pending', replay: true };
    }
    if (receipt.status !== 'pending' || Date.parse(receipt.next_attempt_at) <= Date.now()
        || receipt.object_version_id && !receipt.head_verified_at) conflict();

    const bucket = env.KYC_INDIA_BUCKET;
    const expectedBucketOwner = env.KYC_INDIA_ACCOUNT_ID;
    const accessKeyId = env.KYC_INDIA_HEAD_ACCESS_KEY_ID;
    const secretAccessKey = env.KYC_INDIA_HEAD_SECRET_ACCESS_KEY;
    if (!bucket || !expectedBucketOwner || !accessKeyId || !secretAccessKey) unavailable();
    try {
        await headKycIndiaS3Object({
            siteId: tenant.siteId, documentType: receipt.document_type, intentId: receipt.id,
            bucket, expectedBucketOwner, region: 'ap-south-1', accessKeyId, secretAccessKey,
            sessionToken: env.KYC_INDIA_HEAD_SESSION_TOKEN,
            versionId: input.version_id, expectedBytes: receipt.expected_bytes,
            contentType: receipt.expected_content_type, sha256Hex: receipt.expected_sha256_hex,
        });
    } catch (error) {
        if (String(error).includes('KYC_INDIA_S3_HEAD_INVALID')) {
            throw new AppError('The uploaded file did not match its receipt. Upload it again.', 422, 'KYC_INDIA_OBJECT_MISMATCH');
        }
        unavailable();
    }

    if (!receipt.object_version_id) {
        const verifiedAt = new Date().toISOString();
        const { data: verifiedReceipt, error: receiptError } = await db.from('kyc_private_object_cleanup_jobs')
            .update({ object_version_id: input.version_id, head_verified_at: verifiedAt })
            .eq('id', receipt.id).eq('site_id', tenant.siteId)
            .eq('storage_provider', 'aws_s3_mumbai').eq('purpose', 'upload_reservation')
            .eq('status', 'pending')
            .is('object_version_id', null).select('id').maybeSingle();
        if (receiptError) unavailable();
        if (!verifiedReceipt) conflict();
    }

    const mode = env.KYC_PROVIDER_MODE === 'live' ? 'live' : 'sandbox';
    const liveProvider = env.KYC_PROVIDER === 'signzy' || env.KYC_PROVIDER === 'hyperverge'
        ? env.KYC_PROVIDER : 'unconfigured';
    const now = new Date().toISOString();
    const values = {
        site_id: tenant.siteId, document_type: receipt.document_type,
        document_number_last4: receipt.reference_last4,
        status: 'submitted', provider: mode === 'live' ? liveProvider : 'letbuyy_sandbox_kyc',
        provider_mode: mode, provider_reference: null,
        file_url: null, file_name: null, rejection_reason: null,
        metadata: {
            private_storage_provider: 'aws_s3_mumbai',
            private_object_key: receipt.object_key,
            private_object_version_id: input.version_id,
            private_upload_receipt_id: receipt.id,
            sha256: receipt.expected_sha256_hex,
            byte_size: Number(receipt.expected_bytes),
            content_type: receipt.expected_content_type,
            malware_scan_status: 'pending', provider_review_required: true,
            provider_verified: false, sandbox: mode === 'sandbox',
            idempotency_key: idempotencyKey,
            provider_unavailable: mode === 'live' && liveProvider === 'unconfigured',
        },
        submitted_by: tenant.userId, submitted_at: now,
        verified_at: null, rejected_at: null, reviewed_by: null,
        updated_by: tenant.userId,
    };
    const result = prior
        ? await db.from('merchant_kyc_documents').update(values)
            .eq('id', prior.id).eq('site_id', tenant.siteId).eq('updated_at', prior.updated_at)
            .is('deleted_at', null).select('id').maybeSingle()
        : await db.from('merchant_kyc_documents').insert({
            id: crypto.randomUUID(), ...values, created_by: tenant.userId,
        }).select('id').maybeSingle();
    if (result.error?.code === '23505' || !result.error && !result.data) conflict();
    if (result.error || !result.data) unavailable();

    await retainVerifiedReceipt(db, tenant, receipt, input.version_id);
    return { document_id: String(result.data.id), receipt_id: receipt.id,
        document_status: 'submitted', evidence_scan_status: 'pending', replay: false };
}
