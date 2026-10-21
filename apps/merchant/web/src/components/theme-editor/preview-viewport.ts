export const PREVIEW_VIEWPORT_WIDTHS = { desktop: 1440, tablet: 820, mobile: 390 } as const;

export function fitPreviewViewport(viewport: keyof typeof PREVIEW_VIEWPORT_WIDTHS, availableWidth: number, availableHeight: number) {
    const width = PREVIEW_VIEWPORT_WIDTHS[viewport];
    const scale = Number.isFinite(availableWidth) && availableWidth > 0 ? Math.min(1, availableWidth / width) : 1;
    const height = Number.isFinite(availableHeight) && availableHeight > 0 ? Math.min(4096, Math.ceil(availableHeight / scale)) : 900;
    return { width, height, scale };
}
