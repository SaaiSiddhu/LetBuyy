/** Internal SigV4 primitives shared by the Mumbai KYC S3 request signers. */
export async function kycIndiaHmac(key: Uint8Array, value: string): Promise<Uint8Array> {
  const imported = await crypto.subtle.importKey('raw', key as BufferSource,
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', imported, new TextEncoder().encode(value)));
}

export function kycIndiaHex(bytes: Uint8Array): string {
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function signKycIndiaS3String(secret: string, date: string, stringToSign: string): Promise<string> {
  let key = await kycIndiaHmac(new TextEncoder().encode(`AWS4${secret}`), date);
  for (const part of ['ap-south-1', 's3', 'aws4_request']) key = await kycIndiaHmac(key, part);
  return kycIndiaHex(await kycIndiaHmac(key, stringToSign));
}
