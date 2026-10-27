import { LetbuyyApiError } from '@letbuyy/api-client'
import { MerchantApiRequestError } from './client'

const QUERY_COST_RATE_LIMITED = 'QUERY_COST_RATE_LIMITED'
// One short retry can recover a transport interruption. Foreground rendering
// must not spend 19.75 seconds sleeping or amplify an overloaded query bucket.
// Read deadlines belong to the transport; explicit page retry handles recovery.
const MERCHANT_READ_RETRY_DELAYS_MS = [200] as const

/**
 * Extract the HTTP status code carried by a typed API error.
 * Returns null for non-HTTP failures (network, timeout, unexpected throws),
 * which must be classified separately from known HTTP failures.
 */
export function apiErrorStatus(error: unknown): number | null {
    if (error instanceof LetbuyyApiError) return error.status
    if (error instanceof MerchantApiRequestError) return error.status
    return null
}

function apiErrorCode(error: unknown): string | null {
    if (error instanceof LetbuyyApiError) return error.code
    if (error instanceof MerchantApiRequestError) {
        const payload = error.payload
        if (
            payload &&
            typeof payload === 'object' &&
            'error' in payload &&
            payload.error &&
            typeof payload.error === 'object' &&
            'code' in payload.error &&
            typeof payload.error.code === 'string'
        ) {
            return payload.error.code
        }
    }
    return null
}

export function isQueryCostRateLimited(error: unknown): boolean {
    return apiErrorStatus(error) === 429 && apiErrorCode(error) === QUERY_COST_RATE_LIMITED
}

async function wait(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Retry known transient transport failures once. Throttles, deadlines and
 * unexpected programming/configuration errors must surface without a retry storm.
 */
function isRetryableReadError(error: unknown): boolean {
    const status = apiErrorStatus(error)
    if (status === null) return error instanceof TypeError && error.message === 'fetch failed'
    return status === 502 || status === 503 || status === 504
}

export async function retryMerchantRead<T>(operation: () => Promise<T>): Promise<T> {
    let attempt = 0
    const startedAt = Date.now()

    while (true) {
        try {
            return await operation()
        } catch (error) {
            const delay = MERCHANT_READ_RETRY_DELAYS_MS[attempt]
            if (delay === undefined || !isRetryableReadError(error) || Date.now() - startedAt + delay > 1_000) {
                throw error
            }

            attempt += 1
            await wait(delay)
        }
    }
}

