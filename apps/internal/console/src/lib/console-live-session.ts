import { fetchConsoleApi, type ConsoleDataResponse } from './console-api';
import { readConsoleSession } from './console-session';

/** Request-independent adapter used by proxy, Route Handlers and Server Actions. */
export async function readCurrentConsoleSession(cookieValue: string | null | undefined) {
    const session = await readConsoleSession(cookieValue);
    if (!session?.sessionId || !cookieValue) return null;
    const result = await fetchConsoleApi<ConsoleDataResponse<{ actor_id: string; session_id: string; mfa_verified: boolean }>>(
        '/internal/console/sessions/current', { sessionToken: cookieValue });
    const live = result.data?.data;
    if (result.error || !live || live.session_id !== session.sessionId || live.actor_id !== session.userId || live.mfa_verified !== session.mfaVerified) return null;
    return { ...session, userId: live.actor_id };
}
