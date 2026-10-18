/** Export download links use a dedicated internal signing secret, never a user session key. */
export function requireExportSigningSecret(secret: string | undefined): string {
    if (!secret) throw new Error('CSV export jobs require INTERNAL_API_SECRET.');
    return secret;
}
