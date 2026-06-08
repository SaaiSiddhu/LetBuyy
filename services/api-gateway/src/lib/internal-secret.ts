import { timingSafeEqualText } from './crypto';

type InternalSecretEnv = {
    INTERNAL_API_SECRET?: string;
};

type HeaderReader = {
    header(name: string): string | undefined;
};

export function isInternalApiSecretRequest(env: InternalSecretEnv, req: HeaderReader): boolean {
    const secret = env.INTERNAL_API_SECRET;
    if (!secret) return false;
    return timingSafeEqualText(req.header('X-Internal-API-Secret'), secret);
}
