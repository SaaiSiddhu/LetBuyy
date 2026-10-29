import { z } from 'zod';
import type { TurnstileManagementConfig } from '@letbuyy/infrastructure/cloudflare-adapter';

export const TurnstileDomainRequestSchema = z.object({
    site_id: z.string().uuid(),
    hostname: z.string().min(3).max(253).regex(/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/),
}).strict();
const ManagementSchema = z.object({
    accountId: z.string().regex(/^[a-f0-9]{32}$/),
    siteKey: z.string().min(1).max(32).regex(/^[A-Za-z0-9_-]+$/),
    apiToken: z.string().trim().min(20).max(512),
    configurationId: z.string().uuid(),
}).strict();

export function turnstileDomainManagement(env: { TURNSTILE_DOMAIN_MANAGEMENT?: string }): (TurnstileManagementConfig & { configurationId: string }) | null {
    try {
        const parsed = ManagementSchema.safeParse(JSON.parse(env.TURNSTILE_DOMAIN_MANAGEMENT || 'null'));
        return parsed.success ? parsed.data : null;
    } catch { return null; }
}
