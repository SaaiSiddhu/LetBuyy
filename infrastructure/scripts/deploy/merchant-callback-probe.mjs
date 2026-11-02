/**
 * A route-presence probe only. Invalid scope exits before the receiver reads a
 * body or calls the Gateway; a successful probe is not a signed PSP callback.
 */
export async function verifyMerchantCallbackIngress(origin, fetchImpl = fetch) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  const url = new URL('/razorpay/merchant/not-a-site/not-a-credential', origin);
  try {
    const response = await fetchImpl(url, {
      method: 'POST',
      redirect: 'manual',
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => null);
    if (response.status !== 400 || payload?.error !== 'Invalid callback scope') {
      throw new Error(`Merchant Razorpay callback ingress is not deployed at ${url.origin} (HTTP ${response.status})`);
    }
    return response.status;
  } finally {
    clearTimeout(timeout);
  }
}
