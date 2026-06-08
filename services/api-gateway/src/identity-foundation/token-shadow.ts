export interface VerificationTokenShadowWrite {
  token: string;
  tokenHash: string;
  tokenHashAlgorithm: 'sha256';
  writeLegacyPlaintext: true;
  writeShadowHash: boolean;
}

export async function hashVerificationToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function planVerificationTokenShadowWrite(
  token: string,
  featureEnabled: boolean,
): Promise<VerificationTokenShadowWrite> {
  return {
    token,
    tokenHash: await hashVerificationToken(token),
    tokenHashAlgorithm: 'sha256',
    writeLegacyPlaintext: true,
    writeShadowHash: featureEnabled,
  };
}

export function sanitizeRawTokenPayload<T extends Record<string, unknown>>(
  payload: T,
  featureEnabled: boolean,
): T | Omit<T, 'token' | 'rawToken' | 'otp'> {
  if (!featureEnabled) return payload;
  const { token: _token, rawToken: _rawToken, otp: _otp, ...rest } = payload;
  return rest;
}
