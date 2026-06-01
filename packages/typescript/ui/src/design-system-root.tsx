import React from 'react';

export interface DesignSystemRootProps {
    children: React.ReactNode;
    surface?: 'admin' | 'marketplace' | 'storefront' | 'identity' | 'operations';
    className?: string;
}

export function DesignSystemRoot({
    children,
    surface = 'admin',
    className = '',
}: DesignSystemRootProps) {
    return (
        <div
            className={className}
            data-letbuyy-design-system="true"
            data-letbuyy-surface={surface}
        >
            {children}
        </div>
    );
}
