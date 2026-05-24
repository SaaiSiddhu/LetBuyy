/**
 * Shared authentication utilities for LetBuyy
 * Used across: landing, admin, accounts, console, team apps
 */
import { getSupabaseClient } from './supabase';
/**
 * Get the current authenticated user
 */
export async function getCurrentUser() {
    const supabase = getSupabaseClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) {
        console.error('Error getting current user:', error.message);
        return null;
    }
    return user;
}
/**
 * Get the current session
 */
export async function getCurrentSession() {
    const supabase = getSupabaseClient();
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) {
        console.error('Error getting session:', error.message);
        return null;
    }
    return session;
}
/**
 * Sign out the current user
 */
export async function signOut() {
    const supabase = getSupabaseClient();
    const { error } = await supabase.auth.signOut();
    if (error) {
        throw new Error(`Sign out failed: ${error.message}`);
    }
}
/**
 * Check if user is authenticated
 */
export async function isAuthenticated() {
    const session = await getCurrentSession();
    return session !== null;
}
//# sourceMappingURL=auth.js.map