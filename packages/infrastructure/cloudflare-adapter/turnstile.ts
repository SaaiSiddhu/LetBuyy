/** Provider configuration only. This adapter never creates widgets or rotates secrets. */
export interface TurnstileManagementConfig { accountId: string; siteKey: string; apiToken: string }
export type TurnstileCoverage = { status: 'ready' | 'pending' | 'capacity_reached' | 'unavailable' | 'configuration_required' };
interface Widget {
    sitekey: string; name: string; domains: string[]; mode: 'managed'; clearance_level: 'no_clearance';
    bot_fight_mode?: boolean; offlabel?: boolean; ephemeral_id?: boolean; region?: string;
}

export function isTurnstileHostname(value: string): boolean {
    return value.length <= 253 && value === value.toLowerCase()
        && /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(value);
}
function configured(config: TurnstileManagementConfig): boolean {
    return /^[a-f0-9]{32}$/.test(config.accountId) && /^[A-Za-z0-9_-]{1,32}$/.test(config.siteKey)
        && Boolean(config.apiToken.trim());
}
function widget(body: unknown, siteKey: string): Widget | null {
    if (!body || typeof body !== 'object') return null;
    const envelope = body as Record<string, unknown>;
    if (envelope.success !== true || !envelope.result || typeof envelope.result !== 'object') return null;
    const row = envelope.result as Record<string, unknown>;
    if (row.sitekey !== siteKey || typeof row.name !== 'string' || row.mode !== 'managed'
        || row.clearance_level !== 'no_clearance' || !Array.isArray(row.domains)
        || !row.domains.length || row.domains.length > 10
        || !row.domains.every(host => typeof host === 'string' && isTurnstileHostname(host))) return null;
    for (const key of ['bot_fight_mode', 'offlabel', 'ephemeral_id']) {
        if (row[key] !== undefined && typeof row[key] !== 'boolean') return null;
    }
    if (row.region !== undefined && !['world', 'china'].includes(String(row.region))) return null;
    return row as unknown as Widget;
}
const covered = (row: Widget, host: string) => row.domains.some(parent => host === parent || host.endsWith('.' + parent));

/** Read-only; no credential, provider response body or widget secret leaves this module. */
export async function readTurnstileCoverage(config: TurnstileManagementConfig, host: string, fetcher = fetch): Promise<TurnstileCoverage> {
    if (!configured(config) || !isTurnstileHostname(host)) return { status: 'configuration_required' };
    try {
        const row = await request(config, undefined, fetcher, Date.now() + 4000);
        if (!row) return { status: 'configuration_required' };
        return { status: covered(row, host) ? 'ready' : row.domains.length >= 10 ? 'capacity_reached' : 'pending' };
    } catch { return { status: 'unavailable' }; }
}

/** Caller must serialize this operation and prove exact domain ownership/routing/HTTPS. */
export async function authorizeTurnstileHostname(config: TurnstileManagementConfig, host: string, fetcher = fetch): Promise<TurnstileCoverage & { uncertain?: boolean }> {
    if (!configured(config) || !isTurnstileHostname(host)) return { status: 'configuration_required' };
    let writeDispatched = false;
    try {
        const deadline = Date.now() + 8000;
        const current = await request(config, undefined, fetcher, deadline);
        if (!current) return { status: 'configuration_required' };
        if (covered(current, host)) return { status: 'ready' };
        if (current.domains.length >= 10) return { status: 'capacity_reached' };
        const domains = [...new Set([...current.domains, host])];
        // Preserve every existing setting. Never use provider defaults to rewrite security policy.
        const update: Record<string, unknown> = { domains, name: current.name, mode: current.mode, clearance_level: current.clearance_level };
        for (const key of ['bot_fight_mode', 'offlabel', 'ephemeral_id', 'region'] as const) {
            if (current[key] !== undefined) update[key] = current[key];
        }
        writeDispatched = true;
        const saved = await request(config, update, fetcher, deadline);
        const observed = await request(config, undefined, fetcher, deadline);
        const unchanged = (row: Widget | null) => row && row.name === current.name && row.domains.length === domains.length
            && domains.every(domain => row.domains.includes(domain))
            && ['bot_fight_mode', 'offlabel', 'ephemeral_id', 'region'].every(key => row[key as keyof Widget] === current[key as keyof Widget]);
        if (!unchanged(saved) || !unchanged(observed)) return { status: 'unavailable', uncertain: true };
        return { status: 'ready' };
    } catch { return { status: 'unavailable', ...(writeDispatched ? { uncertain: true } : {}) }; }
}

async function request(config: TurnstileManagementConfig, update: Record<string, unknown> | undefined, fetcher: typeof fetch, deadline: number): Promise<Widget | null> {
    const remaining = Math.min(4000, deadline - Date.now());
    if (remaining <= 0) throw new Error('Provider deadline');
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
        return await Promise.race([new Promise<never>((_, reject) => {
            timer = setTimeout(() => { controller.abort(); reject(new Error('Provider deadline')); }, remaining);
        }), (async () => {
            const response = await fetcher(`https://api.cloudflare.com/client/v4/accounts/${config.accountId}/challenges/widgets/${config.siteKey}`, {
                method: update ? 'PUT' : 'GET', redirect: 'manual', signal: controller.signal,
                headers: { Authorization: `Bearer ${config.apiToken}`, 'Content-Type': 'application/json' },
                ...(update ? { body: JSON.stringify(update) } : {}),
            });
            if (!response.ok) throw new Error('Provider unavailable');
            return widget(await response.json(), config.siteKey);
        })()]);
    } finally { if (timer) clearTimeout(timer); }
}
