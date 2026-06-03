'use client';

import React, { useId } from 'react';
import { Calendar, Check, ChevronRight, Loader2, X } from './icons';
import { type LetbuyyDensity } from './tokens';
import { cx } from './utils';

export interface ChartDatum {
    label: string;
    value: number;
}

export interface ChartProps extends React.HTMLAttributes<HTMLDivElement> {
    data: ChartDatum[];
    type?: 'line' | 'bar' | 'area';
    ariaLabel: string;
    height?: 'sm' | 'md' | 'lg';
    showGrid?: boolean;
    showLabels?: boolean;
    valueFormatter?: (value: number) => string;
}

const chartHeightClasses: Record<NonNullable<ChartProps['height']>, string> = {
    sm: 'h-[var(--lb-size-chart-height-sm)]',
    md: 'h-[var(--lb-size-chart-height-md)]',
    lg: 'h-[var(--lb-size-chart-height-lg)]',
};

function buildChartPoints(data: ChartDatum[]) {
    const chartWidth = 100;
    const chartHeight = 64;
    const insetX = 8;
    const insetTop = 8;
    const insetBottom = 16;
    const plotWidth = chartWidth - insetX * 2;
    const plotHeight = chartHeight - insetTop - insetBottom;
    const max = Math.max(...data.map((item) => item.value), 0);
    const min = Math.min(...data.map((item) => item.value), 0);
    const range = max - min || 1;
    const yForValue = (value: number) => insetTop + plotHeight - ((value - min) / range) * plotHeight;

    const points = data.map((item, index) => {
        const x = insetX + (index / Math.max(data.length - 1, 1)) * plotWidth;
        const y = yForValue(item.value);
        return { ...item, x, y };
    });

    return { chartWidth, chartHeight, insetX, insetTop, insetBottom, plotWidth, plotHeight, max, min, points, yForValue };
}

export function Chart({
    data,
    type = 'line',
    ariaLabel,
    height = 'md',
    showGrid = true,
    showLabels = true,
    valueFormatter = (value) => value.toLocaleString(),
    className = '',
    ...props
}: ChartProps) {
    const titleId = useId();
    const safeData = data.filter((item) => Number.isFinite(item.value));

    if (safeData.length === 0) {
        return (
            <div
                className={cx(
                    'grid place-items-center rounded-[var(--lb-component-card-radius)] border border-dashed border-[var(--lb-color-border)] bg-[var(--lb-color-surface-subdued)] p-[var(--lb-density-card-padding)] text-[length:var(--lb-font-size-body)] leading-[var(--lb-line-height-body)] text-[color:var(--lb-color-text-subdued)]',
                    chartHeightClasses[height],
                    className,
                )}
                role="status"
                {...props}
            >
                No chart data
            </div>
        );
    }

    const { chartWidth, chartHeight, insetX, insetTop, insetBottom, plotWidth, plotHeight, max, min, points, yForValue } = buildChartPoints(safeData);
    const linePoints = points.map((point) => `${point.x},${point.y}`).join(' ');
    const areaPoints = `${insetX},${chartHeight - insetBottom} ${linePoints} ${chartWidth - insetX},${chartHeight - insetBottom}`;
    const barSlot = plotWidth / safeData.length;

    return (
        <div
            className={cx(
                'rounded-[var(--lb-component-card-radius)] border border-[var(--lb-component-card-border)] bg-[var(--lb-component-card-bg)] p-[var(--lb-density-card-padding)] text-[color:var(--lb-component-card-text)] shadow-[var(--lb-component-card-shadow)]',
                className,
            )}
            {...props}
        >
            <svg
                className={cx('block w-full overflow-visible', chartHeightClasses[height])}
                viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                role="img"
                aria-labelledby={titleId}
                preserveAspectRatio="none"
            >
                <title id={titleId}>{ariaLabel}</title>
                {showGrid && (
                    <g aria-hidden="true" stroke="var(--lb-color-border)" strokeWidth="0.35">
                        {[0, 1, 2, 3].map((step) => {
                            const y = insetTop + (plotHeight / 3) * step;
                            return <line key={step} x1={insetX} x2={chartWidth - insetX} y1={y} y2={y} />;
                        })}
                    </g>
                )}
                {type === 'bar' ? (
                    <g aria-hidden="true">
                        {points.map((point, index) => {
                            const y = yForValue(point.value);
                            const baseline = yForValue(0);
                            const heightValue = Math.max(Math.abs(baseline - y), 0.8);
                            const x = insetX + index * barSlot + barSlot * 0.2;
                            return (
                                <rect
                                    key={`${point.label}-${index}`}
                                    x={x}
                                    y={Math.min(y, baseline)}
                                    width={Math.max(barSlot * 0.6, 1)}
                                    height={heightValue}
                                    rx="1.2"
                                    fill="var(--lb-color-primary)"
                                />
                            );
                        })}
                    </g>
                ) : (
                    <g aria-hidden="true">
                        {type === 'area' && <polygon points={areaPoints} fill="var(--lb-color-primary-soft)" />}
                        <polyline points={linePoints} fill="none" stroke="var(--lb-color-primary)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                        {points.map((point, index) => (
                            <circle key={`${point.label}-${index}`} cx={point.x} cy={point.y} r="1.4" fill="var(--lb-component-card-bg)" stroke="var(--lb-color-primary)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
                        ))}
                    </g>
                )}
            </svg>
            {showLabels && (
                <div className="mt-[var(--lb-space-2)] flex items-center justify-between text-[length:var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[color:var(--lb-color-text-subdued)]" aria-hidden="true">
                    <span>{safeData[0]?.label}</span>
                    <span>{safeData[safeData.length - 1]?.label}</span>
                </div>
            )}
            <dl className="sr-only">
                <dt>Maximum</dt>
                <dd>{valueFormatter(max)}</dd>
                <dt>Minimum</dt>
                <dd>{valueFormatter(min)}</dd>
                {safeData.map((item) => (
                    <React.Fragment key={item.label}>
                        <dt>{item.label}</dt>
                        <dd>{valueFormatter(item.value)}</dd>
                    </React.Fragment>
                ))}
            </dl>
        </div>
    );
}

export interface DateRangeValue {
    start: string;
    end: string;
    compareToPrevious?: boolean;
}

export interface DateRangePickerProps extends Omit<React.HTMLAttributes<HTMLFieldSetElement>, 'onChange'> {
    label?: string;
    value: DateRangeValue;
    onChange: (value: DateRangeValue) => void;
    startLabel?: string;
    endLabel?: string;
    compareLabel?: string;
}

export function DateRangePicker({
    label = 'Date range',
    value,
    onChange,
    startLabel = 'Start date',
    endLabel = 'End date',
    compareLabel = 'Compare to previous period',
    className = '',
    ...props
}: DateRangePickerProps) {
    const startId = useId();
    const endId = useId();
    const compareId = useId();

    return (
        <fieldset
            className={cx('grid gap-[var(--lb-space-3)] rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-component-card-bg)] p-[var(--lb-density-card-padding)]', className)}
            {...props}
        >
            <legend className="flex items-center gap-[var(--lb-space-2)] text-[length:var(--lb-font-size-small)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-small)] text-[color:var(--lb-color-text)]">
                <Calendar className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)] text-[color:var(--lb-color-text-subdued)]" aria-hidden="true" />
                {label}
            </legend>
            <div className="grid gap-[var(--lb-space-3)] sm:grid-cols-2">
                <label className="grid gap-[var(--lb-space-1)] text-[length:var(--lb-font-size-small)] font-[var(--lb-font-weight-medium)] leading-[var(--lb-line-height-small)] text-[color:var(--lb-color-text)]" htmlFor={startId}>
                    {startLabel}
                    <input
                        id={startId}
                        type="date"
                        className="h-[var(--lb-density-input-height)] rounded-[var(--lb-radius-lg)] border border-[var(--lb-component-input-border)] bg-[var(--lb-component-input-bg)] px-[var(--lb-space-3)] text-[length:var(--lb-font-size-body)] leading-[var(--lb-line-height-body)] text-[color:var(--lb-component-input-text)] focus-visible:outline-none focus-visible:border-[var(--lb-component-input-focus-border)] focus-visible:ring-2 focus-visible:ring-[var(--lb-component-input-focus-ring)]"
                        value={value.start}
                        onChange={(event) => onChange({ ...value, start: event.target.value })}
                    />
                </label>
                <label className="grid gap-[var(--lb-space-1)] text-[length:var(--lb-font-size-small)] font-[var(--lb-font-weight-medium)] leading-[var(--lb-line-height-small)] text-[color:var(--lb-color-text)]" htmlFor={endId}>
                    {endLabel}
                    <input
                        id={endId}
                        type="date"
                        className="h-[var(--lb-density-input-height)] rounded-[var(--lb-radius-lg)] border border-[var(--lb-component-input-border)] bg-[var(--lb-component-input-bg)] px-[var(--lb-space-3)] text-[length:var(--lb-font-size-body)] leading-[var(--lb-line-height-body)] text-[color:var(--lb-component-input-text)] focus-visible:outline-none focus-visible:border-[var(--lb-component-input-focus-border)] focus-visible:ring-2 focus-visible:ring-[var(--lb-component-input-focus-ring)]"
                        value={value.end}
                        onChange={(event) => onChange({ ...value, end: event.target.value })}
                    />
                </label>
            </div>
            <label className="flex min-h-[var(--lb-density-pill-height)] items-center gap-[var(--lb-space-2)] text-[length:var(--lb-font-size-body)] leading-[var(--lb-line-height-body)] text-[color:var(--lb-color-text)]" htmlFor={compareId}>
                <input
                    id={compareId}
                    type="checkbox"
                    checked={Boolean(value.compareToPrevious)}
                    onChange={(event) => onChange({ ...value, compareToPrevious: event.target.checked })}
                />
                {compareLabel}
            </label>
        </fieldset>
    );
}

export interface DensityToggleProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> {
    value: LetbuyyDensity;
    onChange: (density: LetbuyyDensity) => void;
    options?: LetbuyyDensity[];
}

const densityLabels: Record<LetbuyyDensity, string> = {
    compact: 'Compact',
    comfortable: 'Comfortable',
    spacious: 'Spacious',
};

export function DensityToggle({ value, onChange, options = ['compact', 'comfortable', 'spacious'], className = '', ...props }: DensityToggleProps) {
    return (
        <div
            className={cx('inline-flex rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface-subdued)] p-[var(--lb-space-1)]', className)}
            role="group"
            aria-label="Density"
            {...props}
        >
            {options.map((density) => {
                const active = density === value;
                return (
                    <button
                        key={density}
                        type="button"
                        className={cx(
                            'inline-flex h-[var(--lb-density-pill-height)] items-center gap-[var(--lb-space-1)] rounded-[var(--lb-radius-md)] px-[var(--lb-space-3)] text-[length:var(--lb-font-size-badge)] font-[var(--lb-font-weight-medium)] leading-[var(--lb-line-height-badge)] transition-colors duration-[var(--lb-motion-fast)] ease-[var(--lb-ease-standard)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)]',
                            active
                                ? 'bg-[var(--lb-component-card-bg)] text-[color:var(--lb-color-text)] shadow-[var(--lb-shadow-sm)]'
                                : 'text-[color:var(--lb-color-text-subdued)] hover:text-[color:var(--lb-color-text)]',
                        )}
                        aria-pressed={active}
                        onClick={() => onChange(density)}
                    >
                        {active && <Check className="h-[var(--lb-density-table-icon-size)] w-[var(--lb-density-table-icon-size)]" aria-hidden="true" />}
                        {densityLabels[density]}
                    </button>
                );
            })}
        </div>
    );
}

export interface FilterChip {
    id?: string;
    label: string;
    value?: string;
    onRemove?: () => void;
}

export interface FilterChipsProps extends React.HTMLAttributes<HTMLDivElement> {
    chips: FilterChip[];
    onClearAll?: () => void;
    clearAllLabel?: string;
}

export function FilterChips({ chips, onClearAll, clearAllLabel = 'Clear all', className = '', ...props }: FilterChipsProps) {
    if (chips.length === 0) return null;

    return (
        <div className={cx('flex flex-wrap items-center gap-[var(--lb-space-2)]', className)} aria-label="Active filters" {...props}>
            {chips.map((chip) => (
                <span
                    key={chip.id ?? `${chip.label}-${chip.value ?? ''}`}
                    className="inline-flex min-h-[var(--lb-density-pill-height)] items-center gap-[var(--lb-space-1)] rounded-[var(--lb-radius-full)] border border-[var(--lb-component-badge-accent-border)] bg-[var(--lb-component-badge-accent-bg)] px-[var(--lb-space-2)] text-[length:var(--lb-font-size-badge)] font-[var(--lb-font-weight-medium)] leading-[var(--lb-line-height-badge)] text-[color:var(--lb-component-badge-accent-text)]"
                >
                    <span>{chip.label}</span>
                    {chip.value && <span className="text-[color:var(--lb-color-text-subdued)]">{chip.value}</span>}
                    {chip.onRemove && (
                        <button
                            type="button"
                            className="inline-flex h-[var(--lb-density-table-icon-size)] w-[var(--lb-density-table-icon-size)] items-center justify-center rounded-[var(--lb-radius-full)] hover:bg-[var(--lb-color-primary-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)]"
                            onClick={chip.onRemove}
                            aria-label={`Remove ${chip.label}${chip.value ? ` ${chip.value}` : ''}`}
                        >
                            <X className="h-[var(--lb-density-table-icon-size)] w-[var(--lb-density-table-icon-size)]" aria-hidden="true" />
                        </button>
                    )}
                </span>
            ))}
            {onClearAll && (
                <button
                    type="button"
                    className="h-[var(--lb-density-pill-height)] rounded-[var(--lb-radius-full)] px-[var(--lb-space-2)] text-[length:var(--lb-font-size-badge)] font-[var(--lb-font-weight-medium)] leading-[var(--lb-line-height-badge)] text-[color:var(--lb-color-text-subdued)] hover:bg-[var(--lb-color-surface-subdued)] hover:text-[color:var(--lb-color-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)]"
                    onClick={onClearAll}
                >
                    {clearAllLabel}
                </button>
            )}
        </div>
    );
}

export interface ProgressBarProps extends React.HTMLAttributes<HTMLDivElement> {
    value: number;
    max?: number;
    label?: string;
    showValue?: boolean;
}

export function ProgressBar({ value, max = 100, label, showValue = false, className = '', ...props }: ProgressBarProps) {
    const percent = Math.max(0, Math.min(100, max > 0 ? (value / max) * 100 : 0));

    return (
        <div className={cx('grid gap-[var(--lb-space-2)]', className)} {...props}>
            {(label || showValue) && (
                <div className="flex items-center justify-between gap-[var(--lb-space-3)] text-[length:var(--lb-font-size-caption)] font-[var(--lb-font-weight-medium)] leading-[var(--lb-line-height-caption)] text-[color:var(--lb-color-text-subdued)]">
                    {label && <span>{label}</span>}
                    {showValue && <span>{Math.round(percent)}%</span>}
                </div>
            )}
            <div
                className="h-[var(--lb-space-2)] overflow-hidden rounded-[var(--lb-radius-full)] bg-[var(--lb-color-surface-subdued)]"
                role="progressbar"
                aria-label={label}
                aria-valuemin={0}
                aria-valuemax={max}
                aria-valuenow={Math.max(0, Math.min(max, value))}
            >
                <div
                    className="h-full rounded-[var(--lb-radius-full)] bg-[var(--lb-color-primary)] transition-[width] duration-[var(--lb-motion-slow)] ease-[var(--lb-ease-standard)]"
                    style={{ width: `${percent}%` }}
                />
            </div>
        </div>
    );
}

export interface BreadcrumbItem {
    label: string;
    href?: string;
    onClick?: () => void;
}

export interface BreadcrumbsProps extends React.HTMLAttributes<HTMLElement> {
    items: BreadcrumbItem[];
}

export function Breadcrumbs({ items, className = '', ...props }: BreadcrumbsProps) {
    if (items.length === 0) return null;

    return (
        <nav aria-label="Breadcrumb" className={cx('text-[length:var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[color:var(--lb-color-text-subdued)]', className)} {...props}>
            <ol className="flex flex-wrap items-center gap-[var(--lb-space-2)]">
                {items.map((item, index) => {
                    const current = index === items.length - 1;
                    return (
                        <li key={`${item.label}-${index}`} className="flex items-center gap-[var(--lb-space-2)]">
                            {item.href ? (
                                <a className="rounded-[var(--lb-radius-sm)] hover:text-[color:var(--lb-color-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)]" href={item.href} aria-current={current ? 'page' : undefined}>
                                    {item.label}
                                </a>
                            ) : item.onClick ? (
                                <button type="button" className="rounded-[var(--lb-radius-sm)] hover:text-[color:var(--lb-color-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)]" onClick={item.onClick} aria-current={current ? 'page' : undefined}>
                                    {item.label}
                                </button>
                            ) : (
                                <span aria-current={current ? 'page' : undefined} className={current ? 'text-[color:var(--lb-color-text)]' : undefined}>{item.label}</span>
                            )}
                            {!current && <ChevronRight className="h-[var(--lb-density-table-icon-size)] w-[var(--lb-density-table-icon-size)]" aria-hidden="true" />}
                        </li>
                    );
                })}
            </ol>
        </nav>
    );
}

export interface DescriptionListItem {
    term: React.ReactNode;
    description: React.ReactNode;
}

export interface DescriptionListProps extends React.HTMLAttributes<HTMLDListElement> {
    items: DescriptionListItem[];
    columns?: 1 | 2;
}

export function DescriptionList({ items, columns = 1, className = '', ...props }: DescriptionListProps) {
    return (
        <dl
            className={cx(
                'grid gap-x-[var(--lb-density-card-gap)] gap-y-[var(--lb-space-3)]',
                columns === 2 && 'md:grid-cols-2',
                className,
            )}
            {...props}
        >
            {items.map((item, index) => (
                <div key={index} className="grid gap-[var(--lb-space-1)]">
                    <dt className="text-[length:var(--lb-font-size-caption)] font-[var(--lb-font-weight-medium)] leading-[var(--lb-line-height-caption)] text-[color:var(--lb-color-text-subdued)]">
                        {item.term}
                    </dt>
                    <dd className="m-0 min-w-0 text-[length:var(--lb-font-size-body)] leading-[var(--lb-line-height-body)] text-[color:var(--lb-color-text)]">
                        {item.description}
                    </dd>
                </div>
            ))}
        </dl>
    );
}

export interface DividerProps extends React.HTMLAttributes<HTMLHRElement> {
    orientation?: 'horizontal' | 'vertical';
}

export function Divider({ orientation = 'horizontal', className = '', ...props }: DividerProps) {
    if (orientation === 'vertical') {
        return (
            <hr
                className={cx('m-0 min-h-[var(--lb-density-button-height)] w-px self-stretch border-0 bg-[var(--lb-color-border)]', className)}
                aria-orientation="vertical"
                {...props}
            />
        );
    }

    return <hr className={cx('m-0 h-px w-full border-0 bg-[var(--lb-color-border)]', className)} {...props} />;
}

export interface SpinnerProps extends React.HTMLAttributes<HTMLSpanElement> {
    label?: string;
    size?: 'sm' | 'md' | 'lg';
}

const spinnerSizeClasses: Record<NonNullable<SpinnerProps['size']>, string> = {
    sm: 'h-[var(--lb-density-table-icon-size)] w-[var(--lb-density-table-icon-size)]',
    md: 'h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]',
    lg: 'h-[var(--lb-density-button-height)] w-[var(--lb-density-button-height)]',
};

export function Spinner({ label = 'Loading', size = 'md', className = '', ...props }: SpinnerProps) {
    return (
        <span className={cx('inline-flex items-center gap-[var(--lb-space-2)] text-[color:var(--lb-color-text-subdued)]', className)} role="status" aria-label={label} {...props}>
            <Loader2 className={cx('animate-spin', spinnerSizeClasses[size])} aria-hidden="true" />
            <span className="sr-only">{label}</span>
        </span>
    );
}

export interface TextStyleProps extends React.HTMLAttributes<HTMLElement> {
    children: React.ReactNode;
    as?: 'span' | 'p' | 'strong' | 'em' | 'code';
    variant?: 'body' | 'subdued' | 'strong' | 'positive' | 'negative' | 'code';
}

const textStyleClasses: Record<NonNullable<TextStyleProps['variant']>, string> = {
    body: 'text-[length:var(--lb-font-size-body)] leading-[var(--lb-line-height-body)] text-[color:var(--lb-color-text)]',
    subdued: 'text-[length:var(--lb-font-size-body)] leading-[var(--lb-line-height-body)] text-[color:var(--lb-color-text-subdued)]',
    strong: 'font-[var(--lb-font-weight-semibold)] text-[color:var(--lb-color-text)]',
    positive: 'font-[var(--lb-font-weight-medium)] text-[color:var(--lb-color-success)]',
    negative: 'font-[var(--lb-font-weight-medium)] text-[color:var(--lb-color-critical)]',
    code: 'rounded-[var(--lb-radius-sm)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface-subdued)] px-[var(--lb-space-1)] py-[var(--lb-space-0)] font-mono text-[length:var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[color:var(--lb-color-text)]',
};

export function TextStyle({ children, as, variant = 'body', className = '', ...props }: TextStyleProps) {
    const Element = as ?? (variant === 'code' ? 'code' : 'span');

    return React.createElement(
        Element,
        {
            className: cx(textStyleClasses[variant], className),
            ...props,
        },
        children,
    );
}
