import React from 'react';
import { letbuyyTokenCss, type LetbuyyDensity, type LetbuyyTheme } from './tokens';

export interface DesignSystemRootProps {
    children: React.ReactNode;
    surface?: 'admin' | 'marketplace' | 'storefront' | 'identity' | 'operations';
    theme?: LetbuyyTheme | 'auto';
    density?: LetbuyyDensity;
    className?: string;
    includeTokenStyles?: boolean;
}

export function DesignSystemRoot({
    children,
    surface = 'admin',
    theme = 'auto',
    density = 'compact',
    className = '',
    includeTokenStyles = true,
}: DesignSystemRootProps) {
    return (
        <>
            {includeTokenStyles && (
                <style
                    data-letbuyy-token-source="true"
                    dangerouslySetInnerHTML={{ __html: letbuyyTokenCss }}
                />
            )}
            <div
                className={className}
                data-letbuyy-design-system="true"
                data-letbuyy-surface={surface}
                data-letbuyy-theme={theme === 'auto' ? undefined : theme}
                data-letbuyy-density={density}
            >
                {children}
            </div>
        </>
    );
}
