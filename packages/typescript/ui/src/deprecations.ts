const warnedDeprecations = new Set<string>();

function getNodeEnv() {
    const runtime = globalThis as typeof globalThis & {
        process?: { env?: { NODE_ENV?: string } };
    };

    return runtime.process?.env?.NODE_ENV;
}

export function warnDeprecated(symbol: string, replacement: string, since = '0.0.2') {
    if (getNodeEnv() === 'production' || warnedDeprecations.has(symbol)) return;
    warnedDeprecations.add(symbol);

    if (typeof console !== 'undefined' && typeof console.warn === 'function') {
        console.warn(`[letbuyy-ui] ${symbol} is deprecated since ${since}. Use ${replacement} instead.`);
    }
}
