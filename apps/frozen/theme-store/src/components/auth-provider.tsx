'use client';

import React from 'react';
import { AuthContext, useAuthProvider } from '@/hooks/useAuth';
import type { AuthSessionUser } from '@letbuyy/shared-types';

export default function AuthProvider({
    children,
    initialAuthenticated = false,
    initialUser = null,
}: {
    children: React.ReactNode;
    initialAuthenticated?: boolean;
    initialUser?: AuthSessionUser | null;
}) {
    const auth = useAuthProvider({ initialAuthenticated, initialUser });

    return (
        <AuthContext.Provider value={auth}>
            {children}
        </AuthContext.Provider>
    );
}
