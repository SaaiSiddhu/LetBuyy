import { z } from 'zod';

const SiteverifyResponse = z.object({
    success: z.boolean(),
    'error-codes': z.array(z.string()).optional(),
});

export type TurnstileVerification =
    | { success: true }
    | { success: false; reason: 'invalid' | 'unavailable' };

/** Transport only: each runtime retains its own auth, realm and development policy. */
export async function verifyCloudflareTurnstile(input: {
    secret: string | undefined;
    token: string | null;
    remoteIp?: string;
    fetcher?: typeof fetch;
    timeoutMs?: number;
}): Promise<TurnstileVerification> {
    if (!input.token || input.token.length > 2048 || !input.token.trim()) {
        return { success: false, reason: 'invalid' };
    }
    if (!input.secret?.trim()) return { success: false, reason: 'unavailable' };
    const controller = new AbortController();
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<never>((_, reject) => {
        timeout = setTimeout(() => {
            controller.abort();
            reject(new Error('Verification deadline exceeded'));
        }, input.timeoutMs ?? 8000);
    });
    try {
        const result = await Promise.race([deadline, (async (): Promise<TurnstileVerification> => {
            const body = new URLSearchParams({ secret: input.secret!, response: input.token! });
            if (input.remoteIp) body.set('remoteip', input.remoteIp);
            const response = await (input.fetcher || fetch)('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
                method: 'POST', body, signal: controller.signal,
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            });
            if (!response.ok) return { success: false, reason: 'unavailable' };
            const parsed = SiteverifyResponse.safeParse(await response.json());
            if (!parsed.success) return { success: false, reason: 'unavailable' };
            return parsed.data.success ? { success: true } : { success: false, reason: 'invalid' };
        })()]);
        return result;
    } catch {
        return { success: false, reason: 'unavailable' };
    } finally {
        clearTimeout(timeout);
    }
}
