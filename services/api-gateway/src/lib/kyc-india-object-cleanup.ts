import { cleanupKycIndiaS3ObjectVersions } from '@letbuyy/infrastructure/storage-adapter';
import type { Env } from '../index';
import { getSupabaseAdminFromEnv } from './supabase';

type Database = ReturnType<typeof getSupabaseAdminFromEnv>;
type DocumentType = 'business_pan' | 'gst_certificate' | 'bank_proof' | 'address_proof' | 'identity_proof';
type CleanupJob = {
    id: string; site_id: string; object_key: string; document_type: DocumentType;
    purpose: 'replaced_object' | 'upload_reservation'; attempts: number;
    object_version_id: string | null;
};

async function currentReference(db: Database, job: CleanupJob): Promise<{
    version: string | null; provider: string | null;
} | null> {
    const { data, error } = await db.from('merchant_kyc_documents')
        .select('id,metadata').eq('site_id', job.site_id).is('deleted_at', null);
    if (error) throw new Error('KYC India evidence lookup unavailable');
    const references = (data || []).filter(row => row.metadata?.private_object_key === job.object_key);
    if (references.length > 1) throw new Error('KYC India object has multiple current references');
    if (!references.length) return null;
    return { version: typeof references[0].metadata?.private_object_version_id === 'string'
        ? references[0].metadata.private_object_version_id : null,
    provider: typeof references[0].metadata?.private_storage_provider === 'string'
        ? references[0].metadata.private_storage_provider : null };
}

/** Bounded Gateway cron path; closed outside owned tests until Mumbai IAM and retention pass. */
export async function drainKycIndiaObjectCleanup(env: Env, limit = 20,
    removeVersions: typeof cleanupKycIndiaS3ObjectVersions = cleanupKycIndiaS3ObjectVersions): Promise<{
        scanned: number; deleted: number; retained: number; deferred: number;
    }> {
    if (env.ENVIRONMENT !== 'test' || env.KYC_INDIA_CLEANUP_ENABLED !== 'true')
        return { scanned: 0, deleted: 0, retained: 0, deferred: 0 };
    if (!env.KYC_INDIA_BUCKET || !env.KYC_INDIA_ACCOUNT_ID
        || !env.KYC_INDIA_CLEANUP_ACCESS_KEY_ID || !env.KYC_INDIA_CLEANUP_SECRET_ACCESS_KEY)
        throw new Error('KYC India cleanup is not configured');
    const db = getSupabaseAdminFromEnv(env);
    const { data, error } = await db.rpc('list_due_kyc_india_cleanup_v1', {
        p_limit: Math.min(Math.max(limit, 1), 50),
    });
    if (error) throw new Error('KYC India cleanup queue unavailable');
    const jobs = (data || []) as CleanupJob[];
    let deleted = 0;
    let retained = 0;
    let deferred = 0;
    for (const job of jobs) {
        try {
            const receiptId = job.object_key.split('/')[3];
            if (!/^[a-f0-9-]{36}$/i.test(receiptId)
                || job.object_key !== `kyc/${job.site_id}/${job.document_type}/${receiptId}`
                || !['business_pan', 'gst_certificate', 'bank_proof', 'address_proof', 'identity_proof'].includes(job.document_type))
                throw new Error('KYC India cleanup key is outside its owned namespace');
            const { data: current, error: lookupError } = await db.from('kyc_private_object_cleanup_jobs')
                .select('id,status,storage_provider,purpose,object_key,object_version_id,next_attempt_at')
                .eq('id', job.id).eq('site_id', job.site_id)
                .eq('storage_provider', 'aws_s3_mumbai').is('deleted_at', null).maybeSingle();
            if (lookupError || !current || !['pending', 'deleting'].includes(current.status)
                || current.object_key !== job.object_key || current.purpose !== job.purpose
                || current.object_version_id !== job.object_version_id
                || Date.parse(current.next_attempt_at) > Date.now())
                throw new Error('KYC India cleanup receipt changed');
            const { data: claim, error: claimError } = await db.rpc('claim_due_kyc_india_cleanup_v1', {
                p_id: job.id, p_site: job.site_id,
            });
            if (claimError) throw new Error('KYC India cleanup claim unavailable');
            if (claim === 'retained') {
                retained++;
                continue;
            }
            if (claim !== 'delete') throw new Error('KYC India cleanup claim refused');
            const reference = await currentReference(db, job);
            if (reference) throw new Error('KYC India cleanup found a current reference after claim');
            const removal = await removeVersions({
                siteId: job.site_id, documentType: job.document_type, receiptId,
                bucket: env.KYC_INDIA_BUCKET, expectedBucketOwner: env.KYC_INDIA_ACCOUNT_ID,
                region: 'ap-south-1', accessKeyId: env.KYC_INDIA_CLEANUP_ACCESS_KEY_ID,
                secretAccessKey: env.KYC_INDIA_CLEANUP_SECRET_ACCESS_KEY,
                sessionToken: env.KYC_INDIA_CLEANUP_SESSION_TOKEN,
            });
            if (removal.remaining) throw new Error('KYC India object versions remain');
            const { data: result, error: updateError } = await db.from('kyc_private_object_cleanup_jobs')
                .update({ status: 'completed', outcome: 'deleted', completed_at: new Date().toISOString() })
                .eq('id', job.id).eq('site_id', job.site_id)
                .eq('storage_provider', 'aws_s3_mumbai').eq('status', 'deleting')
                .eq('object_key', job.object_key).select('id').maybeSingle();
            if (updateError || !result) throw new Error('KYC India deletion receipt unavailable');
            deleted++;
        } catch {
            deferred++;
            const seconds = Math.min(3600, 30 * 2 ** Math.min(job.attempts, 7));
            await db.from('kyc_private_object_cleanup_jobs').update({
                attempts: job.attempts + 1,
                next_attempt_at: new Date(Date.now() + seconds * 1000).toISOString(),
            }).eq('id', job.id).eq('site_id', job.site_id)
                .eq('storage_provider', 'aws_s3_mumbai').in('status', ['pending', 'deleting']);
        }
    }
    return { scanned: jobs.length, deleted, retained, deferred };
}
