import React from 'react';
import type { CSSProperties } from 'react';
import { cx } from './utils';

function previewStyle(values: Record<string, string>) {
    return values as CSSProperties;
}

function radiusValue(radius: number | string) {
    if (typeof radius === 'number') return `${radius}px`;
    return /[a-z%)]$/i.test(radius) ? radius : `${radius}px`;
}

export interface ColorSwatchProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, 'style'> {
    color: string;
    label?: string;
    size?: 'sm' | 'md' | 'lg';
    shape?: 'circle' | 'rounded';
}

const swatchSizes: Record<NonNullable<ColorSwatchProps['size']>, string> = {
    sm: 'h-[var(--lb-space-4)] w-[var(--lb-space-4)]',
    md: 'h-[var(--lb-space-5)] w-[var(--lb-space-5)]',
    lg: 'h-[var(--lb-size-control-sm)] w-[var(--lb-size-control-sm)]',
};

export function ColorSwatch({
    color,
    label,
    size = 'md',
    shape = 'circle',
    className = '',
    ...props
}: ColorSwatchProps) {
    return (
        <span
            aria-hidden={label ? undefined : true}
            aria-label={label}
            className={cx(
                'inline-flex shrink-0 border border-[var(--lb-color-border)] bg-[var(--lb-preview-color)]',
                swatchSizes[size],
                shape === 'circle' ? 'rounded-[var(--lb-radius-full)]' : 'rounded-[var(--lb-radius-md)]',
                className,
            )}
            style={previewStyle({ '--lb-preview-color': color })}
            {...props}
        />
    );
}

export interface ColorPreviewBlockProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'style'> {
    color: string;
    label?: string;
}

export function ColorPreviewBlock({
    color,
    label,
    className = '',
    ...props
}: ColorPreviewBlockProps) {
    return (
        <div
            aria-hidden={label ? undefined : true}
            aria-label={label}
            className={cx('bg-[var(--lb-preview-color)]', className)}
            style={previewStyle({ '--lb-preview-color': color })}
            {...props}
        />
    );
}

export interface ColorPreviewSurfaceProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'style'> {
    color: string;
    label?: string;
}

export function ColorPreviewSurface({
    color,
    label,
    className = '',
    children,
    ...props
}: ColorPreviewSurfaceProps) {
    return (
        <div
            aria-hidden={label ? undefined : true}
            aria-label={label}
            className={cx('bg-[var(--lb-preview-color)]', className)}
            style={previewStyle({ '--lb-preview-color': color })}
            {...props}
        >
            {children}
        </div>
    );
}

export interface RadiusPreviewProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'style'> {
    radius: number | string;
    label?: string;
}

export function RadiusPreview({
    radius,
    label,
    className = '',
    children,
    ...props
}: RadiusPreviewProps) {
    return (
        <div
            aria-label={label}
            className={cx('rounded-[var(--lb-preview-radius)]', className)}
            style={previewStyle({ '--lb-preview-radius': radiusValue(radius) })}
            {...props}
        >
            {children}
        </div>
    );
}

export interface ColorPreviewButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'style'> {
    color: string;
    radius?: number | string;
}

export function ColorPreviewButton({
    color,
    radius = 'var(--lb-radius-lg)',
    className = '',
    children,
    type = 'button',
    ...props
}: ColorPreviewButtonProps) {
    return (
        <button
            className={cx(
                'inline-flex items-center justify-center rounded-[var(--lb-preview-radius)] bg-[var(--lb-preview-color)] transition-shadow duration-[var(--lb-motion-fast)] ease-[var(--lb-ease-standard)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)]',
                className,
            )}
            style={previewStyle({
                '--lb-preview-color': color,
                '--lb-preview-radius': radiusValue(radius),
            })}
            type={type}
            {...props}
        >
            {children}
        </button>
    );
}
