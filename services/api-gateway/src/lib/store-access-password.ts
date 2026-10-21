import { argon2Verify, argon2id } from '#store-access-hashing';
import { AppError } from './errors';
import { StorePasswordWorkGate } from './store-password-work-gate';
const workGate = new StorePasswordWorkGate();
type WorkOptions = { signal?: AbortSignal };

const ARGON2_OPTIONS = {
    iterations: 3,
    parallelism: 1,
    memorySize: 19_456,
    hashLength: 32,
    outputType: 'encoded' as const,
};

const DUMMY_ARGON2ID_HASH = '$argon2id$v=19$m=19456,t=3,p=1$MTIzNDU2Nzg5MGFiY2RlZg$U9BIkBlrfZ8upk3pUE7Tz/wu5FScEVnDfOUMtt8qJUU';

function randomSalt(byteCount = 16): Uint8Array {
    const salt = new Uint8Array(byteCount);
    crypto.getRandomValues(salt);
    return salt;
}

export async function hashStoreAccessPassword(password: string, options: WorkOptions = {}): Promise<string> {
    return workGate.run(async () => {
        try {
            return await argon2id({ ...ARGON2_OPTIONS, password, salt: randomSalt() });
        } catch {
            throw new AppError('Store access is unavailable', 503, 'STOREFRONT_ACCESS_UNAVAILABLE');
        }
    }, options.signal);
}

export async function verifyStoreAccessPassword(password: string, encodedHash: string | null | undefined, options: WorkOptions = {}): Promise<boolean> {
    // Catch hash/state errors inside the admitted operation. A queue/abort refusal
    // must never trigger dummy hashing outside the resource bound.
    return workGate.run(async () => {
        try {
            const hash = encodedHash || DUMMY_ARGON2ID_HASH;
            const valid = await argon2Verify({ password, hash });
            return Boolean(encodedHash && valid);
        } catch {
            await argon2Verify({ password, hash: DUMMY_ARGON2ID_HASH }).catch(() => false);
            throw new AppError('Store access is unavailable', 503, 'STOREFRONT_ACCESS_UNAVAILABLE');
        }
    }, options.signal);
}
