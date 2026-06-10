type ProviderMode = 'sandbox' | 'live'

const toneByMode: Record<ProviderMode, string> = {
    sandbox: 'border-[var(--lb-color-warning)] bg-[var(--lb-color-warning-soft)] text-[var(--lb-color-warning)]',
    live: 'border-[var(--lb-color-success)] bg-[var(--lb-color-success-soft)] text-[var(--lb-color-success)]',
}

export function normalizeProviderMode(value: unknown): ProviderMode | null {
    if (value === 'test') return 'sandbox'
    return value === 'sandbox' || value === 'live' ? value : null
}

export function ProviderModeBadge({ mode }: { mode: ProviderMode | null | undefined }) {
    if (!mode) return null

    return (
        <span
            aria-label={`Provider mode ${mode}`}
            className={`inline-flex max-w-full items-center rounded-full border px-[var(--lb-space-2)] py-[2px] text-[11px] font-[var(--lb-font-weight-semibold)] uppercase leading-[var(--lb-line-height-caption)] ${toneByMode[mode]}`}
        >
            {mode}
        </span>
    )
}
