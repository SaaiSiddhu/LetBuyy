import { assumeKycIndiaUploadRole, signKycIndiaS3Post,
    type KycIndiaContentType } from '@letbuyy/infrastructure/storage-adapter';
import type { Env } from '../index';
import { AppError, ForbiddenError } from '../lib/errors';
import type { TenantContext } from '../lib/tenant-context';
import { TenantTransactionUnavailableError, withTenantTx } from '../lib/tenant-transaction';

type DocumentType = 'business_pan' | 'gst_certificate' | 'bank_proof' | 'address_proof' | 'identity_proof';

export interface IndiaUploadIntentInput {
    store_id: string;
    document_type: DocumentType;
    document_number_last4: string;
    content_type: KycIndiaContentType;
    byte_size: number;
    sha256_hex: string;
}

interface ReceiptRow {
    id: string;
    status: string;
    expected_sha256_hex: string;
    expected_bytes: number;
    expected_content_type: string;
    reference_last4: string;
    intent_expires_at: Date | string;
    expired: boolean;
}

function unavailable(): never {
    throw new AppError('Private document upload is unavailable. Please retry later.', 503, 'KYC_INDIA_UPLOAD_UNAVAILABLE');
}

/** No document bytes cross the Gateway. The receipt commits before STS is contacted. */
export async function createIndiaUploadIntent(env: Env, tenant: TenantContext,
    input: IndiaUploadIntentInput, idempotencyKey: string) {
    if (tenant.siteId !== input.store_id || !tenant.userId) throw new ForbiddenError('Not authorized for this store');
    const bucket = env.KYC_INDIA_BUCKET;
    const accountId = env.KYC_INDIA_ACCOUNT_ID;
    const roleArn = env.KYC_INDIA_UPLOAD_ROLE_ARN;
    const sourceAccessKeyId = env.KYC_INDIA_STS_ACCESS_KEY_ID;
    const sourceSecretAccessKey = env.KYC_INDIA_STS_SECRET_ACCESS_KEY;
    if (!bucket || !accountId || !roleArn || !sourceAccessKeyId || !sourceSecretAccessKey) unavailable();
    let row: ReceiptRow;
    try {
        row = await withTenantTx(env, tenant, async tx => {
            const owner = await tx.unsafe(`SELECT id FROM public.sites WHERE id=$1::uuid
                AND custom_user_id=$2::uuid AND deleted_at IS NULL FOR UPDATE`,
            [tenant.siteId, tenant.userId]);
            if (owner.length !== 1) throw new ForbiddenError('Your access to this store changed');
            await tx.unsafe('SELECT set_config($1,$2,true)', ['app.actor_id', tenant.userId]);
            const id = crypto.randomUUID();
            await tx.unsafe(`INSERT INTO public.kyc_private_object_cleanup_jobs
                (id,site_id,object_key,purpose,storage_provider,document_type,expected_sha256_hex,
                 expected_bytes,expected_content_type,reference_last4,upload_idempotency_key,
                 intent_expires_at,next_attempt_at,created_by,updated_by)
                VALUES($1::uuid,$2::uuid,$3,'upload_reservation','aws_s3_mumbai',$4,$5,$6,$7,$8,$9,
                  now()+interval '3 minutes',now()+interval '6 minutes',$10::uuid,$10::uuid)
                ON CONFLICT DO NOTHING`,
            [id, tenant.siteId, `kyc/${tenant.siteId}/${input.document_type}/${id}`,
                input.document_type, input.sha256_hex, input.byte_size, input.content_type,
                input.document_number_last4, idempotencyKey, tenant.userId]);
            const rows = await tx.unsafe(`SELECT id,status,expected_sha256_hex,expected_bytes,
                expected_content_type,reference_last4,intent_expires_at,
                (intent_expires_at <= now()) AS expired
                FROM public.kyc_private_object_cleanup_jobs
                WHERE site_id=$1::uuid AND document_type=$2 AND upload_idempotency_key=$3
                  AND storage_provider='aws_s3_mumbai' AND purpose='upload_reservation'
                  AND deleted_at IS NULL`,
            [tenant.siteId, input.document_type, idempotencyKey]);
            if (rows.length !== 1) unavailable();
            return rows[0] as unknown as ReceiptRow;
        });
    } catch (error) {
        if (error instanceof AppError) throw error;
        if (error instanceof TenantTransactionUnavailableError) unavailable();
        unavailable();
    }
    if (row.expected_sha256_hex !== input.sha256_hex || Number(row.expected_bytes) !== input.byte_size
        || row.expected_content_type !== input.content_type
        || row.reference_last4 !== input.document_number_last4 || row.status !== 'pending' || row.expired) {
        throw new AppError('This upload key is already used or expired. Choose a new key and retry.', 409, 'KYC_INDIA_UPLOAD_CONFLICT');
    }
    try {
        const credentials = await assumeKycIndiaUploadRole({
            siteId: tenant.siteId, documentType: input.document_type, intentId: row.id,
            bucket, expectedBucketOwner: accountId, roleArn,
            sourceAccessKeyId, sourceSecretAccessKey,
            sourceSessionToken: env.KYC_INDIA_STS_SESSION_TOKEN,
        });
        const ticket = await signKycIndiaS3Post({
            siteId: tenant.siteId, documentType: input.document_type, objectId: row.id,
            bucket, region: 'ap-south-1', accessKeyId: credentials.accessKeyId,
            secretAccessKey: credentials.secretAccessKey, sessionToken: credentials.sessionToken,
            contentType: input.content_type, expectedBytes: input.byte_size,
            sha256Hex: input.sha256_hex, expiresInSeconds: 120,
        });
        if (ticket.objectKey !== credentials.objectKey
            || Date.parse(ticket.expiresAt) > Date.parse(String(row.intent_expires_at))
            || Date.parse(ticket.expiresAt) > Date.parse(credentials.expiresAt)) unavailable();
        return { receipt_id: row.id, method: ticket.method, url: ticket.url,
            fields: ticket.fields, expires_at: ticket.expiresAt,
            maximum_object_bytes: ticket.maximumObjectBytes };
    } catch {
        unavailable();
    }
}
