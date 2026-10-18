'use server';
import type { ReelReviewerCommand, ReelReadback } from '@letbuyy/api-client';
import { fetchConsoleApi } from '@/lib/console-api';
import { requireConsoleSession } from '@/lib/console-auth-server';

export async function loadReelReview(id: string) {
    const session = await requireConsoleSession();
    const result = await fetchConsoleApi<{ data: ReelReadback }>(`/internal/console/reels/${encodeURIComponent(id)}`);
    if (result.error) return { ok: false as const, message: result.error, code: result.code, actorId: session.userId };
    if (!result.data?.data) return { ok: false as const, message: 'Private revision readback is unavailable.', actorId: session.userId };
    return { ok: true as const, data: result.data.data, actorId: session.userId };
}
export async function reviewReel(id: string, siteId: string, actorId: string, command: ReelReviewerCommand) {
    const session = await requireConsoleSession({ mfa: true });
    if (!session.userId || session.userId !== actorId) return { ok: false as const, code: 'SESSION_CONTEXT_CHANGED', message: 'The reviewer account changed. Reload this review.', status: 409 };
    // Canonical Gateway/CMS schema owns validation. These arguments carry no
    // actor/MFA/approval authority; the real cookie is forwarded server-side.
    const result = await fetchConsoleApi<{ data: unknown }>(`/internal/console/reels/${encodeURIComponent(id)}`, {
        method: 'POST', query: { store_id: siteId }, body: command,
    });
    if (result.error) return { ok: false as const, code: result.code, message: result.error, status: result.status };
    return { ok: true as const };
}
