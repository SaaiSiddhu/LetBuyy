import React from 'react';
import { createLetbuyyBrandVariables, letbuyyTokenCss, type LetbuyyBrandInput, type LetbuyyDensity, type LetbuyySurface, type LetbuyyTheme } from './tokens';
import { TokenStyleBoundary } from './token-style-boundary';

type LetbuyyRootStyle = React.CSSProperties & Record<`--${string}`, string | number | undefined>;

export interface DesignSystemRootProps {
    children: React.ReactNode;
    surface?: LetbuyySurface;
    theme?: LetbuyyTheme | 'auto';
    density?: LetbuyyDensity;
    brand?: LetbuyyBrandInput;
    className?: string;
    includeTokenStyles?: boolean;
    style?: React.CSSProperties;
}

export function DesignSystemRoot({
    children,
    surface = 'admin',
    theme = 'auto',
    density = 'compact',
    brand,
    className = '',
    includeTokenStyles = true,
    style,
}: DesignSystemRootProps) {
    const brandVariables = createLetbuyyBrandVariables(brand) as LetbuyyRootStyle;
    const hasBrandVariables = Object.keys(brandVariables).length > 0;
    const rootStyle = hasBrandVariables ? { ...brandVariables, ...style } : style;

    return (
        <TokenStyleBoundary includeTokenStyles={includeTokenStyles} tokenCss={letbuyyTokenCss}>
            <div
                className={className}
                data-letbuyy-design-system="true"
                data-letbuyy-surface={surface}
                data-letbuyy-theme={theme}
                data-letbuyy-density={density}
                style={rootStyle}
            >
                {children}
            </div>
        </TokenStyleBoundary>
    );
}
