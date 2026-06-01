'use client';

import { createContext, useContext, useState, useCallback } from 'react';
import type { AuthSessionUser } from '@letbuyy/shared-types';

const ACCOUNTS_URL = process.env.NEXT_PUBLIC_ACCOUNTS_URL || 'http://localhost:3000';

interface AuthState {
    user: AuthSessionUser | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    signOut: () => Promise<void>;
}

interface AuthProviderOptions {
    initialAuthenticated?: boolean;
    initialUser?: AuthSessionUser | null;
}

export const AuthContext = createContext<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
    signOut: async () => { },
});

/* ─── Hook ─── */
export function useAuth() {
    return useContext(AuthContext);
}

export function useAuthProvider(options: AuthProviderOptions = {}): AuthState {
    const [user, setUser] = useState<AuthSessionUser | null>(options.initialUser ?? null);
    const [isAuthenticated, setIsAuthenticated] = useState(Boolean(options.initialAuthenticated));

    const signOut = useCallback(async () => {
        try {
            await fetch(`${ACCOUNTS_URL}/api/auth/logout`, {
                method: 'POST',
                credentials: 'include',
            });
        } finally {
            setUser(null);
            setIsAuthenticated(false);
            if (typeof window !== 'undefined') {
                const loginUrl = new URL('/lookup', ACCOUNTS_URL);
                loginUrl.searchParams.set('return_to', window.location.href);
                window.location.href = loginUrl.toString();
            }
        }
    }, []);

    return {
        user,
        isAuthenticated,
        isLoading: false,
        signOut,
    };
}
