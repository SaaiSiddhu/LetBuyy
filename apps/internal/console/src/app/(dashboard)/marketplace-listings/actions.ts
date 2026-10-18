'use server';

import { revalidatePath } from 'next/cache';
import { fetchConsoleApi } from '@/lib/console-api';
import { requireConsoleSession } from '@/lib/console-auth-server';
import { buildListingDecisionBody, type ListingDecision } from '@/lib/listing-decision';

async function decide(formData: FormData, decision: ListingDecision, operatorUserId: string) {
    const listingId = String(formData.get('listing_id') || '').trim();
    if (!listingId) throw new Error('A listing id is required.');
    const body = buildListingDecisionBody({
        decision,
        reason: String(formData.get('reason') || ''),
        idempotencyKey: String(formData.get('idempotency_key') || ''),
        operatorUserId,
    });
    const result = await fetchConsoleApi<{ data?: unknown }>(
        `/operations/marketplace-listings/${listingId}/${decision}`,
        { method: 'POST', body },
    );
    if (result.error) throw new Error(result.error);
    revalidatePath('/marketplace-listings');
    revalidatePath(`/marketplace-listings/${listingId}`);
}

export async function approveListing(formData: FormData) {
    const session = await requireConsoleSession({ mfa: true });
    if (!session.userId) throw new Error('The signed-in operator identity is unavailable. Sign in again.');
    await decide(formData, 'approve', session.userId);
}

export async function rejectListing(formData: FormData) {
    const session = await requireConsoleSession({ mfa: true });
    if (!session.userId) throw new Error('The signed-in operator identity is unavailable. Sign in again.');
    await decide(formData, 'reject', session.userId);
}

export async function takeDownListing(formData: FormData) {
    const session = await requireConsoleSession({ mfa: true });
    if (!session.userId) throw new Error('The signed-in operator identity is unavailable. Sign in again.');
    await decide(formData, 'take-down', session.userId);
}

export async function claimListingReview(formData: FormData) {
    const session = await requireConsoleSession({ mfa: true });
    if (!session.userId) throw new Error('The signed-in operator identity is unavailable. Sign in again.');
    const listingId = String(formData.get('listing_id') || '').trim();
    const idempotencyKey = String(formData.get('idempotency_key') || '').trim();
    const reason = String(formData.get('reason') || '').trim();
    const expectedVersion = Number(formData.get('expected_version'));
    if (!listingId || !idempotencyKey || idempotencyKey.length > 200) throw new Error('Reload the review details before claiming this listing.');
    if (reason.length < 8 || reason.length > 1000) throw new Error('Enter a claim reason of 8 to 1000 characters.');
    if (!Number.isInteger(expectedVersion) || expectedVersion < 1) throw new Error('Reload the review details before claiming this listing.');
    const result = await fetchConsoleApi<{ data?: unknown }>(
        `/operations/marketplace-listings/${listingId}/claim`,
        { method: 'POST', body: { reason, idempotency_key: idempotencyKey, expected_version: expectedVersion, operator_user_id: session.userId } },
    );
    if (result.error) throw new Error(result.error);
    revalidatePath('/marketplace-listings');
    revalidatePath(`/marketplace-listings/${listingId}`);
}

export async function assignListingReviewer(formData: FormData) {
    const session = await requireConsoleSession({ mfa: true });
    if (!session.userId) throw new Error('The signed-in operator identity is unavailable. Sign in again.');
    const listingId = String(formData.get('listing_id') || '').trim();
    const assigneeUserId = String(formData.get('assignee_user_id') || '').trim();
    const idempotencyKey = String(formData.get('idempotency_key') || '').trim();
    const reason = String(formData.get('reason') || '').trim();
    const expectedVersion = Number(formData.get('expected_version'));
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!listingId || !uuid.test(assigneeUserId)) throw new Error('Choose an active platform lead to assign this review.');
    if (!idempotencyKey || idempotencyKey.length > 200) throw new Error('Reload the review details before assigning this listing.');
    if (reason.length < 8 || reason.length > 1000) throw new Error('Enter an assignment reason of 8 to 1000 characters.');
    if (!Number.isInteger(expectedVersion) || expectedVersion < 1) throw new Error('Reload the review details before assigning this listing.');
    const result = await fetchConsoleApi<{ data?: unknown }>(
        `/operations/marketplace-listings/${listingId}/assign`,
        { method: 'POST', body: { assignee_user_id: assigneeUserId, reason, idempotency_key: idempotencyKey, expected_version: expectedVersion, operator_user_id: session.userId } },
    );
    if (result.error) throw new Error(result.error);
    revalidatePath('/marketplace-listings');
    revalidatePath(`/marketplace-listings/${listingId}`);
}
