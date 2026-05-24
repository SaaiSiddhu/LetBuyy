/**
 * Shared authentication utilities for LetBuyy
 * Used across: landing, admin, accounts, console, team apps
 */
/**
 * Get the current authenticated user
 */
export declare function getCurrentUser(): Promise<import("@supabase/auth-js").User | null>;
/**
 * Get the current session
 */
export declare function getCurrentSession(): Promise<import("@supabase/auth-js").Session | null>;
/**
 * Sign out the current user
 */
export declare function signOut(): Promise<void>;
/**
 * Check if user is authenticated
 */
export declare function isAuthenticated(): Promise<boolean>;
//# sourceMappingURL=auth.d.ts.map