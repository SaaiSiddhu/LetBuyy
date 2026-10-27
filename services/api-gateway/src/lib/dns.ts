const DNS_RESOLVERS = [
    'https://cloudflare-dns.com/dns-query',
    'https://dns.google/resolve',
] as const;

export type DnsRecordType = 'TXT' | 'CNAME' | 'MX' | 'NS';

export async function resolveDoh(domain: string, type: DnsRecordType, options: { signal?: AbortSignal; requireConclusive?: boolean } = {}): Promise<string[]> {
    const answers: string[] = [];
    let conclusive = 0;
    const queries = DNS_RESOLVERS.map(async (resolver) => {
        const url = new URL(resolver);
        url.searchParams.set('name', domain);
        url.searchParams.set('type', type);
        const response = await fetch(url.toString(), {
            headers: { accept: 'application/dns-json' },
            ...(options.signal ? { signal: options.signal } : {}),
            ...(options.requireConclusive ? { redirect: 'manual' as const } : {}),
        });
        if (!response.ok) return;
        const body = await response.json() as { Status?: number; Answer?: Array<{ data?: string }> };
        if (options.requireConclusive) {
            if (body.Status !== 0 && body.Status !== 3) return;
            conclusive++;
            if (body.Status === 3) return;
        }
        const records = options.requireConclusive ? (body.Answer || []).slice(0, 128) : body.Answer || [];
        for (const answer of records) {
            if (typeof answer.data !== 'string' || (options.requireConclusive && answer.data.length > 2048)) continue;
            const value = answer.data.replace(/^"|"$/g, '').replace(/\.$/, '');
            answers.push(options.requireConclusive && type === 'TXT' ? value : value.toLowerCase());
        }
    });
    if (options.requireConclusive) {
        await Promise.allSettled(queries);
        if (!conclusive) throw new Error('DNS verification is unavailable');
    } else await Promise.all(queries);
    return answers;
}

export async function resolveMxOrNsSnapshot(domain: string): Promise<{ mx: string[]; ns: string[] }> {
    const [mx, ns] = await Promise.all([
        resolveDoh(domain, 'MX').catch(() => []),
        resolveDoh(domain, 'NS').catch(() => []),
    ]);
    return { mx, ns };
}
