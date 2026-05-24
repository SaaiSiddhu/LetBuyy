'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { User, Session, AuthChangeEvent } from '@letbuyy/runtime-composition/identity-runtime-adapter';
import { getSupabaseClient } from '@/lib/supabase/client';

/* ─── Types ─── */
interface AuthState {
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    signOut: () => Promise<void>;
}

/* ─── Context ─── */
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

/* ─── Provider logic (used inside AuthProvider component) ─── */
export function useAuthProvider(): AuthState {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const supabase = getSupabaseClient();
        if (!supabase) {
            setUser(null);
            setIsLoading(false);
            return;
        }

        // 1. Check initial session
        supabase.auth.getSession().then(({ data: { session } }: { data: { session: Session | null } }) => {
            setUser(session?.user ?? null);
            setIsLoading(false);
        });

        // 2. Listen for auth changes (login, logout, token refresh)
        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
            setUser(session?.user ?? null);
            setIsLoading(false);
        });

        return () => subscription.unsubscribe();
    }, []);

    const signOut = useCallback(async () => {
        const supabase = getSupabaseClient();
        if (!supabase) {
            setUser(null);
            return;
        }
        await supabase.auth.signOut();
        setUser(null);
    }, []);

    return {
        user,
        isAuthenticated: !!user,
        isLoading,
        signOut,
    };
}
