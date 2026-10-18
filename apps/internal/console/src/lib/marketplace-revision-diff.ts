type JsonObject = Record<string, unknown>;

function flatten(value: unknown, prefix = ''): Map<string, string> {
    const result = new Map<string, string>();
    if (Array.isArray(value)) {
        if (value.length === 0) result.set(prefix, '[]');
        value.forEach((item, index) => flatten(item, `${prefix}[${index}]`).forEach((v, k) => result.set(k, v)));
    } else if (value && typeof value === 'object') {
        const entries = Object.entries(value as JsonObject);
        if (entries.length === 0) result.set(prefix, '{}');
        entries.forEach(([key, item]) => flatten(item, prefix ? `${prefix}.${key}` : key).forEach((v, k) => result.set(k, v)));
    } else {
        result.set(prefix, value === null || value === undefined ? '—' : String(value));
    }
    return result;
}

export function buildMarketplaceRevisionDiff(previous: JsonObject | null, submitted: JsonObject | null) {
    if (!submitted) return [];
    // A first submission has no baseline object. Flattening `{}` would create a
    // synthetic root row with an empty field name, which is misleading in the
    // review table.
    const before = previous ? flatten(previous) : new Map<string, string>();
    const after = flatten(submitted);
    return [...new Set([...before.keys(), ...after.keys()])]
        .filter((path) => before.get(path) !== after.get(path))
        .map((path) => ({ path, before: before.get(path) ?? '—', after: after.get(path) ?? '—' }));
}

export function getSafeMarketplaceEvidenceLinks(snapshot: JsonObject | null): string[] {
    if (!snapshot) return [];
    const product = snapshot.product && typeof snapshot.product === 'object' ? snapshot.product as JsonObject : {};
    const variants = Array.isArray(snapshot.variants) ? snapshot.variants as JsonObject[] : [];
    const candidates = [
        ...(Array.isArray(product.images) ? product.images : []),
        product.thumbnail_url,
        ...variants.map((variant) => variant.image_url),
    ];
    return [...new Set(candidates.filter((value): value is string => typeof value === 'string'))]
        .map((value) => {
            try {
                const url = new URL(value);
                return (url.protocol === 'https:' || url.protocol === 'http:') && !url.username && !url.password
                    ? url.toString()
                    : null;
            } catch { return null; }
        })
        .filter((value): value is string => value !== null);
}
