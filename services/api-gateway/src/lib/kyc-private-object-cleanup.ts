import type { Env } from '../index';
import { AppError } from './errors';
import { getSupabaseAdminFromEnv } from './supabase';

type KycDatabase = ReturnType<typeof getSupabaseAdminFromEnv>;

interface CleanupJob {
    id: string;
    site_id: string;
    object_key: string;
    purpose: 'replaced_object' | 'upload_reservation';
    attempts: number;
}

/** R2 is a synthetic owned-test store only. India-only evidence must not enter a
 * deployed R2 bucket, whose APAC placement does not establish India residency. */
export function hasIsolatedKycPrivateBucket(env: Env): boolean {
    return env.ENVIRONMENT === 'test'
        && Boolean(env.KYC_PRIVATE_BUCKET && env.KYC_PRIVATE_BUCKET !== env.R2_BUCKET);
}

function isOwnedKycKey(siteId: string, key: string): boolean {
    return new RegExp(`^kyc/${siteId}/(?:business_pan|gst_certificate|bank_proof|address_proof|identity_proof)/[A-Za-z0-9_-]{1,160}$`).test(key);
}

async function isUnreferenced(db: KycDatabase, siteId: string, key: string): Promise<boolean> {
    const { data, error } = await db.from('merchant_kyc_documents')
        .select('id,metadata').eq('site_id', siteId).is('deleted_at', null);
    if (error) throw new Error('KYC evidence lookup failed');
    return !(data || []).some(row => row.metadata?.private_object_key === key);
}

async function isR2Receipt(db: KycDatabase, siteId: string, key: string): Promise<boolean> {
    const { data, error } = await db.from('kyc_private_object_cleanup_jobs')
        .select('storage_provider').eq('site_id', siteId).eq('object_key', key)
        .is('deleted_at', null).maybeSingle();
    if (error) throw new Error('KYC receipt provider lookup failed');
    return data?.storage_provider === 'r2_fixture';
}

/** A durable receipt must exist before R2 can contain the new private object. */
export async function reserveKycPrivateObject(db: KycDatabase, siteId: string, key: string): Promise<void> {
    if (!isOwnedKycKey(siteId, key)) throw new Error('KYC cleanup refused an unowned object key');
    const { error } = await db.from('kyc_private_object_cleanup_jobs').insert({
        site_id: siteId, object_key: key, purpose: 'upload_reservation',
        // An upload in progress must not race its own cleanup worker.
        next_attempt_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    });
    if (error) throw new AppError('Private document upload receipts are unavailable. Please retry later.',
        503, 'KYC_RECEIPT_UNAVAILABLE');
}

/** If this receipt update fails, cron will see the live reference and retain it. */
export async function markKycPrivateObjectRetained(db: KycDatabase, siteId: string, key: string): Promise<boolean> {
    if (!isOwnedKycKey(siteId, key)) throw new Error('KYC cleanup refused an unowned object key');
    const { error } = await db.from('kyc_private_object_cleanup_jobs')
        .update({ status: 'completed', outcome: 'retained', completed_at: new Date().toISOString() })
        .eq('site_id', siteId).eq('object_key', key).eq('purpose', 'upload_reservation').eq('status', 'pending');
    return !error;
}

/** A successful immediate delete is idempotent; the durable job covers a failed receipt update. */
export async function tryDeleteReplacedKycObject(
    db: KycDatabase, bucket: R2Bucket, siteId: string, key: string,
): Promise<boolean> {
    if (!isOwnedKycKey(siteId, key)) throw new Error('KYC cleanup refused an unowned object key');
    try {
        if (!await isR2Receipt(db, siteId, key)) return false;
        if (!await isUnreferenced(db, siteId, key)) return false;
        await bucket.delete(key);
    } catch {
        // The row-replacement trigger has already queued this key atomically.
        return false;
    }
    const { error } = await db.from('kyc_private_object_cleanup_jobs')
        .update({ status: 'completed', outcome: 'deleted', completed_at: new Date().toISOString() })
        .eq('site_id', siteId).eq('object_key', key).eq('status', 'pending');
    // If this write fails, scheduled deletion safely repeats the idempotent R2 delete.
    return !error;
}

/** Bounded retry from the existing api-gateway cron; no object key enters logs or public responses. */
export async function drainKycPrivateObjectCleanup(env: Env, limit = 20): Promise<{
    scanned: number; deleted: number; deferred: number;
}> {
    const bucket = env.KYC_PRIVATE_BUCKET;
    if (!bucket) return { scanned: 0, deleted: 0, deferred: 0 };
    if (!hasIsolatedKycPrivateBucket(env)) throw new Error('KYC R2 storage is unavailable outside isolated owned tests');
    const db = getSupabaseAdminFromEnv(env);
    const { data, error } = await db.rpc('list_due_kyc_private_cleanup_v1', {
        p_limit: Math.min(Math.max(limit, 1), 50),
    });
    if (error) throw new Error('KYC private cleanup queue could not be read');
    const jobs = (data || []) as CleanupJob[];
    let deleted = 0;
    let deferred = 0;
    for (const job of jobs) {
        try {
            if (!isOwnedKycKey(job.site_id, job.object_key)) throw new Error('Unowned KYC object key');
            // Defend even if the SQL filter has not deployed yet: an R2 sweep
            // can never mark an S3 version deleted or issue an R2 delete for it.
            if (!await isR2Receipt(db, job.site_id, job.object_key)) continue;
            if (!await isUnreferenced(db, job.site_id, job.object_key)) {
                if (job.purpose !== 'upload_reservation') throw new Error('Replaced KYC object is still referenced');
                const { error: retainedError } = await db.from('kyc_private_object_cleanup_jobs')
                    .update({ status: 'completed', outcome: 'retained', completed_at: new Date().toISOString() })
                    .eq('id', job.id).eq('site_id', job.site_id)
                    .eq('purpose', 'upload_reservation').eq('status', 'pending');
                if (retainedError) throw new Error('KYC retention receipt update failed');
                continue;
            }
            await bucket.delete(job.object_key);
            const { error: updateError } = await db.from('kyc_private_object_cleanup_jobs')
                .update({ status: 'completed', outcome: 'deleted', completed_at: new Date().toISOString() })
                .eq('id', job.id).eq('site_id', job.site_id).eq('status', 'pending');
            if (updateError) throw new Error('KYC cleanup receipt update failed');
            deleted += 1;
        } catch {
            deferred += 1;
            const seconds = Math.min(3600, 30 * 2 ** Math.min(job.attempts, 7));
            await db.from('kyc_private_object_cleanup_jobs').update({
                attempts: job.attempts + 1,
                next_attempt_at: new Date(Date.now() + seconds * 1000).toISOString(),
            }).eq('id', job.id).eq('site_id', job.site_id).eq('status', 'pending');
        }
    }
    return { scanned: jobs.length, deleted, deferred };
}
