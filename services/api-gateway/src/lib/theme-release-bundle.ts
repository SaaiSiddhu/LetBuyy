import { LiquidThemePackageBundleSchema } from '@letbuyy/theme-engine';

/** Publisher and private preview recognize the same validated captured bundle. */
export function resolveLiquidBundleArtifact(config: Record<string, unknown>): Record<string, unknown> | null {
    const result = LiquidThemePackageBundleSchema.safeParse(config?.liquidBundle);
    return result.success ? result.data as unknown as Record<string, unknown> : null;
}
