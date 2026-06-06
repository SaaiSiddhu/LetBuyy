type DevAuthBypassEnv = {
    NODE_ENV?: string
    APP_ENV?: string
    VERCEL_ENV?: string
    NEXT_PUBLIC_ENV?: string
    LETBUYY_ENABLE_DEV_AUTH_BYPASS?: string
}

function envValue(value: string | undefined): string {
    return String(value || '').toLowerCase()
}

export function isProductionIdentityRuntime(env: DevAuthBypassEnv = process.env): boolean {
    return envValue(env.NODE_ENV) === 'production'
        || envValue(env.APP_ENV) === 'production'
        || envValue(env.VERCEL_ENV) === 'production'
        || envValue(env.NEXT_PUBLIC_ENV) === 'production'
}

export function canUseIdentityDevAuthBypass(env: DevAuthBypassEnv = process.env): boolean {
    return !isProductionIdentityRuntime(env)
        && envValue(env.NODE_ENV) === 'development'
        && env.LETBUYY_ENABLE_DEV_AUTH_BYPASS === 'true'
}
