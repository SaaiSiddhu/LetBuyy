'use client';

import React from 'react';
import { Button } from './button';
import { ChevronRight } from './icons';
import { cx } from './utils';
import { useNavigationLink } from './navigation/link-provider';

export interface BreadcrumbItem {
    label: string;
    href?: string;
    onClick?: () => void;
}

export interface BreadcrumbsProps extends React.HTMLAttributes<HTMLElement> {
    items: BreadcrumbItem[];
    separator?: 'chevron' | 'slash';
    currentTone?: 'emphasis' | 'inherit';
}

export function Breadcrumbs({
    items,
    separator = 'chevron',
    currentTone = 'emphasis',
    className = '',
    ...props
}: BreadcrumbsProps) {
    const Link = useNavigationLink();
    if (items.length === 0) return null;

    return (
        <nav aria-label="Breadcrumb" className={cx('text-[length:var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[color:var(--lb-color-text-subdued)]', className)} {...props}>
            <ol className="flex flex-wrap items-center gap-[var(--lb-space-2)]">
                {items.map((item, index) => {
                    const current = index === items.length - 1;
                    return (
                        <li key={`${item.label}-${index}`} className="flex items-center gap-[var(--lb-space-2)]">
                            {item.href ? (
                                <Link className="rounded-[var(--lb-radius-sm)] hover:text-[color:var(--lb-color-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)]" href={item.href} aria-current={current ? 'page' : undefined}>
                                    {item.label}
                                </Link>
                            ) : item.onClick ? (
                                <Button
                                    unstyled
                                    type="button"
                                    className="rounded-[var(--lb-radius-sm)] hover:text-[color:var(--lb-color-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)]"
                                    onClick={item.onClick}
                                    aria-current={current ? 'page' : undefined}
                                >
                                    {item.label}
                                </Button>
                            ) : (
                                <span aria-current={current ? 'page' : undefined} className={current && currentTone === 'emphasis' ? 'text-[color:var(--lb-color-text)]' : undefined}>{item.label}</span>
                            )}
                            {!current && (
                                separator === 'slash'
                                    ? <span aria-hidden="true">/</span>
                                    : <ChevronRight className="h-[var(--lb-density-table-icon-size)] w-[var(--lb-density-table-icon-size)]" aria-hidden="true" />
                            )}
                        </li>
                    );
                })}
            </ol>
        </nav>
    );
}
