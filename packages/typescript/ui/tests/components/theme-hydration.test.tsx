import React from 'react';
import { renderToString } from 'react-dom/server';
import { hydrateRoot, type Root } from 'react-dom/client';
import { act } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LetbuyyThemeProvider } from '../../src/theme-provider';

describe('Saved theme hydration', () => {
    it.each([
        { initial: 'light', saved: 'dark' },
        { initial: 'dark', saved: 'light' },
    ] as const)('reconciles a saved $saved choice with server $initial tokens', async ({ initial, saved }) => {
        const storageKey = 'synthetic-theme-hydration';
        const html = document.documentElement;
        const oldTheme = html.getAttribute('data-theme');
        const oldClass = html.className;
        const oldStyle = html.getAttribute('style');
        const cachedWindow = window as Window & { __letbuyyResolvedTheme?: 'light' | 'dark' };
        const oldCachedTheme = cachedWindow.__letbuyyResolvedTheme;
        const container = document.createElement('div');
        let root: Root | undefined;
        const app = <LetbuyyThemeProvider defaultTheme={initial} storageKey={storageKey}><p>Theme content</p></LetbuyyThemeProvider>;
        try {
            localStorage.removeItem(storageKey);
            delete cachedWindow.__letbuyyResolvedTheme;
            container.innerHTML = renderToString(app);
            expect(container.querySelector('[data-letbuyy-design-system]')?.getAttribute('data-letbuyy-theme')).toBe(initial);
            // ThemeScript applies the persisted choice before React hydrates.
            localStorage.setItem(storageKey, saved);
            html.dataset.theme = saved;
            cachedWindow.__letbuyyResolvedTheme = saved;
            document.body.append(container);
            await act(async () => { root = hydrateRoot(container, app); });
            expect(html.dataset.theme).toBe(saved);
            expect(container.querySelector('[data-letbuyy-design-system]')?.getAttribute('data-letbuyy-theme')).toBe(saved);
        } finally {
            if (root) await act(async () => root?.unmount());
            container.remove(); localStorage.removeItem(storageKey);
            if (oldTheme === null) html.removeAttribute('data-theme'); else html.setAttribute('data-theme', oldTheme);
            html.className = oldClass;
            if (oldStyle === null) html.removeAttribute('style'); else html.setAttribute('style', oldStyle);
            cachedWindow.__letbuyyResolvedTheme = oldCachedTheme;
        }
    });
});
