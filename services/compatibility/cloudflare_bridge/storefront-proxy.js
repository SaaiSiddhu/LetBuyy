/**
 * Cloudflare Worker: Storefront Proxy
 * 
 * This worker proxies all *.letbuyy.store requests to Vercel
 * while preserving the original hostname for subdomain routing.
 */

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        const hostname = url.hostname;

        // Only proxy letbuyy.store subdomains
        if (!hostname.endsWith('.letbuyy.store')) {
            return fetch(request);
        }

        // Extract subdomain (e.g., "dohi" from "dohi.letbuyy.store")
        const subdomain = hostname.split('.')[0];

        // Build the Vercel URL (same path and query string)
        const vercelUrl = `https://letbuyy-storefront.vercel.app${url.pathname}${url.search}`;

        // Clone request headers and add forwarding headers
        const headers = new Headers(request.headers);
        headers.set('X-Forwarded-Host', hostname);
        headers.set('X-Forwarded-Proto', 'https');
        headers.set('X-Store-Subdomain', subdomain);

        // Forward the request to Vercel
        const response = await fetch(vercelUrl, {
            method: request.method,
            headers: headers,
            body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
            redirect: 'manual', // Don't follow redirects, let client handle them
        });

        // Clone the response and return it
        const responseHeaders = new Headers(response.headers);

        // Remove headers that shouldn't be passed through
        responseHeaders.delete('content-encoding');

        return new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers: responseHeaders,
        });
    }
};
