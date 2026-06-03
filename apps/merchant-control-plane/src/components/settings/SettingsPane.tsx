import type { ReactNode } from 'react'
import { Page, PageContent, PageHeader, type MaterialIconName, type PageHeaderAction, type PageIdentity } from '@letbuyy/ui'

interface SettingsPaneProps {
    store: string
    title: string
    description?: string
    identity?: PageIdentity
    iconName?: MaterialIconName
    primaryAction?: PageHeaderAction
    secondaryActions?: PageHeaderAction[]
    children: ReactNode
    saveBar?: ReactNode
}

export function SettingsPane({
    store,
    title,
    description,
    identity = 'settings',
    iconName,
    primaryAction,
    secondaryActions,
    children,
    saveBar,
}: SettingsPaneProps) {
    const breadcrumbs = title === 'Settings'
        ? [{ label: 'Settings' }]
        : [{ label: 'Settings', href: `/${store}/settings` }, { label: title }]

    return (
        <Page className="max-w-[var(--lb-size-page-max)] px-0 py-0">
            <PageHeader
                title={title}
                description={description}
                identity={identity}
                iconName={iconName}
                showBreadcrumbs
                showDescription={Boolean(description)}
                breadcrumbs={breadcrumbs}
                primaryAction={primaryAction}
                secondaryActions={secondaryActions}
            />
            <PageContent>{children}</PageContent>
            {saveBar}
        </Page>
    )
}
