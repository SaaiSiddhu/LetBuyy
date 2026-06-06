import * as bcrypt from 'bcryptjs';

export const MERCHANT_PASSWORD_BCRYPT_ROUNDS = 12;

export async function hashMerchantPassword(password: string): Promise<string> {
    return bcrypt.hash(password, MERCHANT_PASSWORD_BCRYPT_ROUNDS);
}

export async function verifyMerchantPassword(password: string, hash: string): Promise<boolean> {
    if (!password || !hash) return false;
    return bcrypt.compare(password, hash);
}
