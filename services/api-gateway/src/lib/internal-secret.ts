import { timingSafeEqualText } from './crypto';

type InternalSecretEnv = {
    INTERNAL_API_SECRET?: string;
    INTERNAL_API_SECRET_PREVIOUS?: string;
    LETBUYY_INTERNAL_API_SECRET?: string;
    LETBUYY_INTERNAL_API_SECRET_PREVIOUS?: string;
    WORKER_INTERNAL_API_SECRET?: string;
};

type HeaderReader = {
    header(name: string): string | undefined;
};

export function isInternalApiSecretRequest(env: InternalSecretEnv, req: HeaderReader): boolean {
    const provided = req.header('X-Internal-API-Secret');
    if (!provided) return false;

    const secrets = [
        env.INTERNAL_API_SECRET,
        env.INTERNAL_API_SECRET_PREVIOUS,
        env.LETBUYY_INTERNAL_API_SECRET,
        env.LETBUYY_INTERNAL_API_SECRET_PREVIOUS,
        env.WORKER_INTERNAL_API_SECRET,
    ].filter((secret): secret is string => Boolean(secret));

    return secrets.some((secret) => timingSafeEqualText(provided, secret));
}
