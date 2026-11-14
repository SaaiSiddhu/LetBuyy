const DNS_RESOLVERS = [
    'https://cloudflare-dns.com/dns-query',
    'https://dns.google/resolve',
] as const;

export type DnsRecordType = 'TXT' | 'CNAME' | 'MX' | 'NS';

export async function resolveDoh(domain: string, type: DnsRecordType): Promise<string[]> {
    const answers: string[] = [];
    await Promise.all(DNS_RESOLVERS.map(async (resolver) => {
        const url = new URL(resolver);
        url.searchParams.set('name', domain);
        url.searchParams.set('type', type);
        const response = await fetch(url.toString(), {
            headers: { accept: 'application/dns-json' },
        });
        if (!response.ok) return;
        const body = await response.json() as { Answer?: Array<{ data?: string }> };
        for (const answer of body.Answer || []) {
            if (answer.data) answers.push(answer.data.replace(/^"|"$/g, '').replace(/\.$/, '').toLowerCase());
        }
    }));
    return answers;
}

export async function resolveMxOrNsSnapshot(domain: string): Promise<{ mx: string[]; ns: string[] }> {
    const [mx, ns] = await Promise.all([
        resolveDoh(domain, 'MX').catch(() => []),
        resolveDoh(domain, 'NS').catch(() => []),
    ]);
    return { mx, ns };
}
