// Only the owned loopback TLS proxy may supply the public request host to Next.
// This is a local platform fixture; deployment/application origin guards are unchanged.
export function isOwnedNextIngress(headers, { port, checkoutOrigin, rootDomain }) {
    try {
        const host = headers.host;
        if (typeof host !== 'string' || host !== host.toLowerCase() || /[\s,/@\\]/.test(host)) return false;
        const forwardedHost = headers['x-forwarded-host'], protocol = headers['x-forwarded-proto'];
        if (forwardedHost !== undefined && forwardedHost !== host) return false;
        if (protocol !== undefined && !['http', 'https'].includes(protocol)) return false;
        const incoming = new URL(`${protocol || 'http'}://${host}`), checkout = new URL(checkoutOrigin);
        if (incoming.username || incoming.password || incoming.pathname !== '/' || incoming.search || incoming.hash) return false;
        const local = incoming.hostname === 'localhost' || /^[a-z0-9-]+(?:\.[a-z0-9-]+)*\.localhost$/.test(incoming.hostname);
        const canonical = rootDomain && rootDomain !== 'localhost'
            && (incoming.hostname === rootDomain || incoming.hostname.endsWith('.' + rootDomain));
        if (!local && !canonical) return false;
        return protocol === 'https' ? incoming.port === checkout.port : local && Number(incoming.port) === port;
    } catch { return false; }
}
