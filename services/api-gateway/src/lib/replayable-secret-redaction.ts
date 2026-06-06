type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

const REPLAY_REDACTED_SECRET = '[REDACTED_REPLAY_SECRET]';
const REPLAY_SECRET_KEYS = new Set([
    'access_token',
    'accessToken',
    'refresh_token',
    'refreshToken',
    'signing_secret',
    'signingSecret',
    'client_secret',
    'clientSecret',
]);

export function redactReplayableSecrets(value: JsonValue): JsonValue {
    if (Array.isArray(value)) {
        return value.map((item) => redactReplayableSecrets(item));
    }

    if (!value || typeof value !== 'object') {
        return value;
    }

    return Object.fromEntries(
        Object.entries(value).map(([key, nested]) => [
            key,
            REPLAY_SECRET_KEYS.has(key) ? REPLAY_REDACTED_SECRET : redactReplayableSecrets(nested),
        ]),
    );
}
