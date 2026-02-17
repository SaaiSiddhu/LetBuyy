/**
 * Urban Kicks Theme
 * 
 * Top-level barrel export for the Urban Kicks theme.
 * 
 * This theme is the first to use the isolated theme architecture:
 * - `preview/` — Self-contained preview pages with mock data
 * - `dynamic/` — Theme-specific config and page components for real data
 * 
 * Usage:
 * ```tsx
 * // Preview mode (mock data)
 * import { HomePage } from '@stores/urban-kicks/preview';
 * 
 * // Dynamic mode (real data)  
 * import { generateThemeCSS, THEME_ID } from '@stores/urban-kicks/dynamic';
 * ```
 */

// Preview module — mock data pages
export * as preview from './preview';

// Dynamic module — real data config and pages
export * as dynamic from './dynamic';

// Theme metadata
export const THEME_SLUG = 'urban-kicks';
export const THEME_NAME = 'Urban Kicks';
export const THEME_DESCRIPTION = 'A modern sneaker & streetwear storefront theme with premium aesthetics';
