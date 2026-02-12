/**
 * Shared API utilities for LetBuyy
 * Base configuration for API calls to api.letbuyy.store
 */

const DEFAULT_API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.letbuyy.store';

interface ApiRequestOptions extends RequestInit {
    token?: string;
}

interface ApiResponse<T> {
    data?: T;
    error?: {
        code: string;
        message: string;
    };
}

/**
 * Make an authenticated API request
 */
export async function apiRequest<T>(
    endpoint: string,
    options: ApiRequestOptions = {}
): Promise<ApiResponse<T>> {
    const { token, ...fetchOptions } = options;

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(fetchOptions.headers as Record<string, string>),
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

        return { data: data as T };
    } catch (error) {
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
export function apiGet<T>(endpoint: string, token?: string) {
    return apiRequest<T>(endpoint, { method: 'GET', token });
}

/**
 * POST request helper
 */
export function apiPost<T>(endpoint: string, body: unknown, token?: string) {
    return apiRequest<T>(endpoint, {
        method: 'POST',
        body: JSON.stringify(body),
        token,
    });
}

/**
 * PATCH request helper
 */
export function apiPatch<T>(endpoint: string, body: unknown, token?: string) {
    return apiRequest<T>(endpoint, {
        method: 'PATCH',
        body: JSON.stringify(body),
        token,
    });
}

/**
 * DELETE request helper
 */
export function apiDelete<T>(endpoint: string, token?: string) {
    return apiRequest<T>(endpoint, { method: 'DELETE', token });
}
