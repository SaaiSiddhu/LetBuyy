'use client'

import {
    Banner,
    Page,
    PageHeader,
    SaveBar,
    type PageHeaderAction,
    type SaveBarProps,
} from '@letbuyy/ui'

interface SettingsPaneProps {
    title: string
    description: string
    store: string
    children: React.ReactNode
    breadcrumbs?: Array<{ label: string; href?: string }>
    eyebrow?: string
    guidance?: {
        title: string
        body: React.ReactNode
        variant?: 'info' | 'success' | 'warning' | 'critical'
    }
    primaryAction?: PageHeaderAction
    secondaryActions?: PageHeaderAction[]
    saveBar?: Pick<SaveBarProps, 'state' | 'onSave' | 'onDiscard' | 'saveLabel' | 'discardLabel'>
}

export function SettingsPane({
    title,
    description,
    store,
    children,
    breadcrumbs,
    eyebrow,
    guidance,
    primaryAction,
    secondaryActions,
    saveBar,
}: SettingsPaneProps) {
    return (
        <Page>
            <PageHeader
                title={title}
                description={description}
                eyebrow={eyebrow}
                breadcrumbs={breadcrumbs ?? [{ label: 'Settings', href: `/${store}/settings` }, { label: title }]}
                primaryAction={primaryAction}
                secondaryActions={secondaryActions}
            />

            {guidance && (
                <Banner variant={guidance.variant ?? 'info'} title={guidance.title}>
                    {guidance.body}
                </Banner>
            )}

            {children}

            {saveBar && (
                <SaveBar
                    state={saveBar.state}
                    onSave={saveBar.onSave}
                    onDiscard={saveBar.onDiscard}
                    saveLabel={saveBar.saveLabel}
                    discardLabel={saveBar.discardLabel}
                />
            )}
        </Page>
    )
}
