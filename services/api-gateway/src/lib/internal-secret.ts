import { timingSafeEqualText } from './crypto';

type InternalSecretEnv = {
    INTERNAL_API_SECRET?: string;
    WORKER_INTERNAL_API_SECRET?: string;
};

type HeaderReader = {
    header(name: string): string | undefined;
};

export function isInternalApiSecretRequest(env: InternalSecretEnv, req: HeaderReader): boolean {
    const headerSecret = req.header('X-Internal-API-Secret');
    if (!headerSecret) return false;

    return [env.INTERNAL_API_SECRET, env.WORKER_INTERNAL_API_SECRET]
        .filter((secret): secret is string => Boolean(secret))
        .some((secret) => timingSafeEqualText(headerSecret, secret));
}
