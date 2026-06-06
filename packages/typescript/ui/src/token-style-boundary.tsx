'use client';

import React from 'react';

const TokenStyleContext = React.createContext(false);

export interface TokenStyleBoundaryProps {
    children: React.ReactNode;
    includeTokenStyles: boolean;
    tokenCss: string;
}

export function TokenStyleBoundary({
    children,
    includeTokenStyles,
    tokenCss,
}: TokenStyleBoundaryProps) {
    const hasInheritedTokenStyles = React.useContext(TokenStyleContext);
    const shouldRenderTokenStyles = includeTokenStyles && !hasInheritedTokenStyles;

    return (
        <TokenStyleContext.Provider value={hasInheritedTokenStyles || shouldRenderTokenStyles}>
            {shouldRenderTokenStyles && (
                <style
                    data-letbuyy-token-source="true"
                    dangerouslySetInnerHTML={{ __html: tokenCss }}
                />
            )}
            {children}
        </TokenStyleContext.Provider>
    );
}
