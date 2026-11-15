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
        // One exact synthetic custom host is admitted only in the localhost
        // owned fixture. The outer TLS proxy still pins its host and port.
        const syntheticCustom = rootDomain === 'localhost' && incoming.hostname === 'shop.merchant.test';
        if (!local && !canonical && !syntheticCustom) return false;
        // Production buyer callbacks canonicalize non-local hosts to HTTPS443.
        // The owned TLS proxy's exact-host allowlist and Chromium resolver map
        // that public address to its ephemeral port without changing Host.
        return protocol === 'https' ? incoming.port === checkout.port || Boolean(canonical && incoming.port === '') : local && Number(incoming.port) === port;
    } catch { return false; }
}
