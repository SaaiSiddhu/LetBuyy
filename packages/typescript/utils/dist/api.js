/**
 * Shared API utilities for LetBuyy
 * Base configuration for API calls to api.letbuyy.store
 */
const DEFAULT_API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.letbuyy.store';
/**
 * Make an authenticated API request
 */
export async function apiRequest(endpoint, options = {}) {
    const { token, ...fetchOptions } = options;
    const headers = {
        'Content-Type': 'application/json',
        ...fetchOptions.headers,
    };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    try {
        const response = await fetch(`${DEFAULT_API_URL}${endpoint}`, {
            ...fetchOptions,
            headers,
        });
        const data = await response.json();
        if (!response.ok) {
            return {
                error: {
                    code: data.code || `HTTP_${response.status}`,
                    message: data.message || response.statusText,
                },
            };
        }
        return { data: data };
    }
    catch (error) {
        return {
            error: {
                code: 'NETWORK_ERROR',
                message: error instanceof Error ? error.message : 'Unknown error',
            },
        };
    }
}
/**
 * GET request helper
 */
export function apiGet(endpoint, token) {
    return apiRequest(endpoint, { method: 'GET', token });
}
/**
 * POST request helper
 */
export function apiPost(endpoint, body, token) {
    return apiRequest(endpoint, {
        method: 'POST',
        body: JSON.stringify(body),
        token,
    });
}
/**
 * PATCH request helper
 */
export function apiPatch(endpoint, body, token) {
    return apiRequest(endpoint, {
        method: 'PATCH',
        body: JSON.stringify(body),
        token,
    });
}
/**
 * DELETE request helper
 */
export function apiDelete(endpoint, token) {
    return apiRequest(endpoint, { method: 'DELETE', token });
}
//# sourceMappingURL=api.js.map