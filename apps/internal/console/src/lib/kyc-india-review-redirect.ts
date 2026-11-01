/** Only pass a Gateway-issued, version-pinned Mumbai S3 reviewer ticket to the browser. */
export function safeKycIndiaReviewRedirect(raw: string | null, siteId: string): string | null {
    if (!raw || raw.length > 12_000) return null;
    let url: URL;
    try { url = new URL(raw); } catch { return null; }
    if (url.protocol !== 'https:' || url.username || url.password || url.port || url.hash
        || !/^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])?\.s3\.ap-south-1\.amazonaws\.com$/.test(url.hostname)
        || !new RegExp(`^/kyc/${siteId}/(?:business_pan|gst_certificate|bank_proof|address_proof|identity_proof)/[a-f0-9-]{36}$`, 'i').test(url.pathname)) return null;
    const required = ['versionId', 'X-Amz-Algorithm', 'X-Amz-Credential', 'X-Amz-Date',
        'X-Amz-Expires', 'X-Amz-SignedHeaders', 'X-Amz-Signature'];
    if (required.some(key => url.searchParams.getAll(key).length !== 1)
        || url.searchParams.get('versionId') === 'null'
        || !url.searchParams.get('versionId')
        || url.searchParams.get('X-Amz-Algorithm') !== 'AWS4-HMAC-SHA256'
        || url.searchParams.get('X-Amz-SignedHeaders') !== 'host'
        || !/^[a-f0-9]{64}$/.test(url.searchParams.get('X-Amz-Signature') || '')) return null;
    const ttl = Number(url.searchParams.get('X-Amz-Expires'));
    if (!Number.isSafeInteger(ttl) || ttl < 1 || ttl > 60) return null;
    return url.href;
}
