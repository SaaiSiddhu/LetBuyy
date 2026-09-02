import {
    Banner,
    Badge,
    Card,
    Code2,
    EmptyState,
    Section,
} from '@letbuyy/ui'
import { SettingsPane } from './SettingsPane'

interface BackendNeededPaneProps {
    store: string
    title: string
    description: string
    requirement: string
    details: string[]
    availableToday?: Array<{ label: string; value: string }>
}

export function BackendNeededPane({
    store,
    title,
    description,
    requirement,
    details,
    availableToday = [],
}: BackendNeededPaneProps) {
    return (
        <SettingsPane
            store={store}
            title={title}
            description={description}
            guidance={{
                title: '[SKIP - NEEDS BACKEND]',
                body: requirement,
                variant: 'warning',
            }}
        >
            {availableToday.length > 0 && (
                <Card>
                    <Section
                        title="Available today"
                        description="These related fields already exist in the current gateway response, but the requested pane cannot be completed until the missing backend contract is added."
                    >
                        <div className="grid gap-[var(--lb-space-3)] md:grid-cols-2">
                            {availableToday.map((item) => (
                                <div
                                    key={item.label}
                                    className="rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface-subdued)] p-[var(--lb-space-4)]"
                                >
                                    <p className="m-0 text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">
                                        {item.label}
                                    </p>
                                    <p className="m-0 mt-[var(--lb-space-1)] text-[var(--lb-font-size-body)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-body)] text-[var(--lb-color-text)]">
                                        {item.value || 'Not configured'}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </Section>
                </Card>
            )}

            <Card>
                <Section
                    title="Backend requirement"
                    description="WS9 is limited to frontend settings architecture, so missing contracts are documented instead of fabricated."
                    action={<Badge label="Backend needed" variant="warning" />}
                >
                    <EmptyState
                        icon={<Code2 className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />}
                        title="This settings pane is ready for a backend contract"
                        body={requirement}
                    />
                    <div className="grid gap-[var(--lb-space-3)]">
                        {details.map((detail) => (
                            <Banner key={detail} variant="info" title="Required contract detail">
                                {detail}
                            </Banner>
                        ))}
                    </div>
                </Section>
            </Card>
        </SettingsPane>
    )
}
