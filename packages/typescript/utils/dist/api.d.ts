/**
 * Shared API utilities for LetBuyy
 * Base configuration for API calls to api.letbuyy.store
 */
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
export declare function apiRequest<T>(endpoint: string, options?: ApiRequestOptions): Promise<ApiResponse<T>>;
/**
 * GET request helper
 */
export declare function apiGet<T>(endpoint: string, token?: string): Promise<ApiResponse<T>>;
/**
 * POST request helper
 */
export declare function apiPost<T>(endpoint: string, body: unknown, token?: string): Promise<ApiResponse<T>>;
/**
 * PATCH request helper
 */
export declare function apiPatch<T>(endpoint: string, body: unknown, token?: string): Promise<ApiResponse<T>>;
/**
 * DELETE request helper
 */
export declare function apiDelete<T>(endpoint: string, token?: string): Promise<ApiResponse<T>>;
export {};
//# sourceMappingURL=api.d.ts.map