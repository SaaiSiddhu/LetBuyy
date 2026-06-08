'use client'

import { Input, Search } from '@letbuyy/ui'

interface SettingsSearchProps {
    inputId: string
    value: string
    onChange: (value: string) => void
    resultCount: number
}

export function SettingsSearch({ inputId, value, onChange, resultCount }: SettingsSearchProps) {
    const resultCountId = `${inputId}-result-count`

    return (
        <div className="flex flex-col gap-[var(--lb-space-2)]">
            <label
                htmlFor={inputId}
                className="text-[var(--lb-font-size-caption)] font-[var(--lb-font-weight-medium)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]"
            >
                Search settings
            </label>
            <div className="relative">
                <Search
                    className="pointer-events-none absolute left-[var(--lb-space-3)] top-1/2 h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)] -translate-y-1/2 text-[var(--lb-color-text-subdued)]"
                    aria-hidden="true"
                />
                <Input unstyled
                    id={inputId}
                    type="search"
                    value={value}
                    onChange={(event) => onChange(event.target.value)}
                    placeholder="Search payments, domains, taxes..."
                    className="h-[var(--lb-size-control-md)] w-full rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] pl-[var(--lb-space-7)] pr-[var(--lb-space-3)] text-[var(--lb-font-size-body)] leading-[var(--lb-line-height-body)] text-[var(--lb-color-text)] placeholder:text-[var(--lb-color-text-subdued)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)]"
                    aria-describedby={resultCountId}
                />
            </div>
            <p
                id={resultCountId}
                className="m-0 text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]"
                aria-live="polite"
            >
                {value.trim() ? `${resultCount} matching setting${resultCount === 1 ? '' : 's'}` : 'Filter the settings index by task or keyword.'}
            </p>
        </div>
    )
}
