// ============================================================
// CUSTOMER AUTH CONTEXT — Client-side authentication state
// Provides login/logout/session state to all storefront components
// ============================================================

'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

// ============================================================
// Types
// ============================================================

interface CustomerInfo {
    id: string;
    email: string;
    fullName: string | null;
    storeId: string;
}

interface CustomerAuthContextType {
    // State
    customer: CustomerInfo | null;
    isAuthenticated: boolean;
    isLoading: boolean;

    // Actions
    login: (email: string, password: string, storeId: string, turnstileToken?: string | null) => Promise<LoginResult>;
    setPassword: (email: string, password: string, storeId: string, resetToken?: string) => Promise<LoginResult>;
    register: (email: string, password: string, storeId: string, fullName?: string | null, turnstileToken?: string | null) => Promise<LoginResult>;
    checkEmail: (email: string, storeId: string) => Promise<EmailCheckResult>;
    logout: () => Promise<void>;
    refreshSession: () => Promise<void>;
}

interface LoginResult {
    success: boolean;
    error?: string;
    customer?: CustomerInfo;
}

interface EmailCheckResult {
    exists: boolean;
    hasPassword: boolean;
    status: string;
}

// ============================================================
// Context
// ============================================================

const CustomerAuthContext = createContext<CustomerAuthContextType | null>(null);

export function useCustomerAuth(): CustomerAuthContextType {
    const context = useContext(CustomerAuthContext);
    if (!context) {
        throw new Error('useCustomerAuth must be used within a CustomerAuthProvider');
    }
    return context;
}

// ============================================================
// Provider
// ============================================================

interface Props {
    children: React.ReactNode;
    storeId?: string;
}

export function CustomerAuthProvider({ children }: Props) {
    const [customer, setCustomer] = useState<CustomerInfo | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // ── Check Session on Mount ──────────────────────────────
    const refreshSession = useCallback(async () => {
        try {
            const res = await fetch('/api/customer/session');
            const data = await res.json();

            if (data.authenticated && data.customer) {
                setCustomer(data.customer);
            } else {
                setCustomer(null);
            }
        } catch {
            setCustomer(null);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        refreshSession();
    }, [refreshSession]);

    // ── Check Email ─────────────────────────────────────────
    const checkEmail = useCallback(async (
        email: string,
        sid: string
    ): Promise<EmailCheckResult> => {
        const res = await fetch(
            `/api/customer/check?email=${encodeURIComponent(email)}&storeId=${sid}`
        );
        return res.json();
    }, []);

    // ── Login ───────────────────────────────────────────────
    const login = useCallback(async (
        email: string,
        password: string,
        sid: string,
        turnstileToken?: string | null
    ): Promise<LoginResult> => {
        try {
            const res = await fetch('/api/customer/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password, storeId: sid, turnstileToken }),
            });

            const data = await res.json();

            if (!res.ok) {
                return { success: false, error: data.error || 'Login failed' };
            }

            setCustomer(data.customer);

            // Sync local wishlist after login
            syncLocalWishlist();

            return { success: true, customer: data.customer };
        } catch {
            return { success: false, error: 'Network error. Please try again.' };
        }
    }, []);

    // ── Set Password (First Time) ───────────────────────────
    const setPassword = useCallback(async (
        email: string,
        password: string,
        sid: string,
        resetToken?: string
    ): Promise<LoginResult> => {
        if (!resetToken) {
            return { success: false, error: 'Reset link is required to set a password.' };
        }

        try {
            const res = await fetch('/api/customer/set-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password, storeId: sid, resetToken }),
            });

            const data = await res.json();

            if (!res.ok) {
                return { success: false, error: data.error || 'Failed to set password' };
            }

            setCustomer(data.customer);

            // Sync local wishlist after account creation
            syncLocalWishlist();

            return { success: true, customer: data.customer };
        } catch {
            return { success: false, error: 'Network error. Please try again.' };
        }
    }, []);

    // ── Register (First-time account, LB-12) ────────────────
    const register = useCallback(async (
        email: string,
        password: string,
        sid: string,
        fullName?: string | null,
        turnstileToken?: string | null
    ): Promise<LoginResult> => {
        try {
            const res = await fetch('/api/customer/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password, storeId: sid, fullName, turnstileToken }),
            });

            const data = await res.json();

            if (!res.ok) {
                return { success: false, error: data.error || 'Registration failed' };
            }

            setCustomer(data.customer);
            syncLocalWishlist();

            return { success: true, customer: data.customer };
        } catch {
            return { success: false, error: 'Network error. Please try again.' };
        }
    }, []);

    // ── Logout ──────────────────────────────────────────────
    const logout = useCallback(async () => {
        try {
            await fetch('/api/customer/logout', { method: 'POST' });
        } finally {
            setCustomer(null);
        }
    }, []);

    // ── Sync Local Wishlist on Login ────────────────────────
    const syncLocalWishlist = async () => {
        try {
            const stored = localStorage.getItem('lb_wishlist');
            if (!stored) return;

            const localItems = JSON.parse(stored);
            if (!Array.isArray(localItems) || localItems.length === 0) return;

            await fetch('/api/customer/wishlist/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ productIds: localItems }),
            });

            // Clear local storage after successful sync
            localStorage.removeItem('lb_wishlist');
        } catch {
            console.warn('[Auth] Wishlist sync failed');
        }
    };

    // ── Context Value ───────────────────────────────────────
    const value: CustomerAuthContextType = {
        customer,
        isAuthenticated: !!customer,
        isLoading,
        login,
        setPassword,
        register,
        checkEmail,
        logout,
        refreshSession,
    };

    return (
        <CustomerAuthContext.Provider value={value}>
            {children}
        </CustomerAuthContext.Provider>
    );
}
