import { createMiddleware } from 'hono/factory';
import type { Env } from '../index';

export type GatewayFeatureFlag = 'FEATURE_GRAPHQL' | 'FEATURE_EXTENSIONS' | 'FEATURE_LIQUID';

type FeatureFlagEnv = Pick<Env, GatewayFeatureFlag | 'ENVIRONMENT' | 'APP_ENV' | 'NODE_ENV'>;

function normalizedFlagValue(value: string | undefined): string | null {
    const normalized = value?.trim().toLowerCase();
    return normalized || null;
}

function isProductionRuntime(env: FeatureFlagEnv): boolean {
    return [env.ENVIRONMENT, env.APP_ENV, env.NODE_ENV]
        .filter((value): value is string => typeof value === 'string')
        .some((value) => value.toLowerCase() === 'production');
}

export function isGatewayFeatureEnabled(env: FeatureFlagEnv, flag: GatewayFeatureFlag): boolean {
    const value = normalizedFlagValue(env[flag]);
    if (value) {
        return ['1', 'true', 'on', 'enabled', 'yes'].includes(value);
    }

    return !isProductionRuntime(env);
}

export function featureGate(flag: GatewayFeatureFlag, code: string, message: string) {
    return createMiddleware<{ Bindings: Env }>(async (c, next) => {
        if (isGatewayFeatureEnabled(c.env, flag)) {
            await next();
            return;
        }

        return c.json(
            {
                success: false,
                error: {
                    code,
                    message,
                },
            },
            404,
        );
    });
}
