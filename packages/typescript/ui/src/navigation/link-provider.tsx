'use client';

import React, { createContext, useContext } from 'react';

export interface NavigationLinkProviderProps {
    linkComponent: React.ComponentType<React.AnchorHTMLAttributes<HTMLAnchorElement>>;
    children: React.ReactNode;
}

const NavigationLinkContext = createContext<NavigationLinkProviderProps['linkComponent'] | null>(null);

/** Let each app retain its router while shared primitives keep ordinary anchor semantics. */
export function NavigationLinkProvider({ linkComponent, children }: NavigationLinkProviderProps) {
    return <NavigationLinkContext.Provider value={linkComponent}>{children}</NavigationLinkContext.Provider>;
}

export function useNavigationLink() {
    return useContext(NavigationLinkContext) ?? 'a';
}
