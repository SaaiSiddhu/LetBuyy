import React from 'react';
import { warnDeprecated } from './deprecations';
import {
    ColorPreviewBlock as PreviewColorPreviewBlock,
    ColorPreviewButton as PreviewColorPreviewButton,
    ColorPreviewSurface as PreviewColorPreviewSurface,
    ColorSwatch as PreviewColorSwatch,
    RadiusPreview as PreviewRadiusPreview,
    type ColorPreviewBlockProps,
    type ColorPreviewButtonProps,
    type ColorPreviewSurfaceProps,
    type ColorSwatchProps,
    type RadiusPreviewProps,
} from './preview-helpers';

function warnPreviewHelper(symbol: string) {
    warnDeprecated(symbol, '@letbuyy/ui/preview');
}

/**
 * @deprecated since 0.0.2. Import `ColorSwatch` from `@letbuyy/ui/preview`.
 */
export function ColorSwatch(props: ColorSwatchProps) {
    warnPreviewHelper('ColorSwatch');
    return <PreviewColorSwatch {...props} />;
}

/**
 * @deprecated since 0.0.2. Import `ColorPreviewBlock` from `@letbuyy/ui/preview`.
 */
export function ColorPreviewBlock(props: ColorPreviewBlockProps) {
    warnPreviewHelper('ColorPreviewBlock');
    return <PreviewColorPreviewBlock {...props} />;
}

/**
 * @deprecated since 0.0.2. Import `ColorPreviewSurface` from `@letbuyy/ui/preview`.
 */
export function ColorPreviewSurface(props: ColorPreviewSurfaceProps) {
    warnPreviewHelper('ColorPreviewSurface');
    return <PreviewColorPreviewSurface {...props} />;
}

/**
 * @deprecated since 0.0.2. Import `RadiusPreview` from `@letbuyy/ui/preview`.
 */
export function RadiusPreview(props: RadiusPreviewProps) {
    warnPreviewHelper('RadiusPreview');
    return <PreviewRadiusPreview {...props} />;
}

/**
 * @deprecated since 0.0.2. Import `ColorPreviewButton` from `@letbuyy/ui/preview`.
 */
export function ColorPreviewButton(props: ColorPreviewButtonProps) {
    warnPreviewHelper('ColorPreviewButton');
    return <PreviewColorPreviewButton {...props} />;
}

export type {
    ColorPreviewBlockProps,
    ColorPreviewButtonProps,
    ColorPreviewSurfaceProps,
    ColorSwatchProps,
    RadiusPreviewProps,
} from './preview-helpers';
