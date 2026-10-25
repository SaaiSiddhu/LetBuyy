'use client'

import {
    Banner,
    Page,
    PageHeader,
    SaveBar,
    type LucideIcon,
    type MaterialIconName,
    type PageHeaderAction,
    type PageHeaderProps,
    type SaveBarProps,
} from '@letbuyy/ui'
import { SETTINGS_NAV_ITEMS } from './settings-navigation'

interface SettingsPaneProps {
    title: string
    description: string
    store: string
    children: React.ReactNode
    breadcrumbs?: Array<{ label: string; href?: string }>
    eyebrow?: string
    iconName?: MaterialIconName
    navigationKey?: string
    guidance?: {
        title: string
        body: React.ReactNode
        variant?: 'info' | 'success' | 'warning' | 'critical'
    }
    primaryAction?: PageHeaderAction
    secondaryActions?: PageHeaderAction[]
    saveBar?: SaveBarProps
    header?: Pick<PageHeaderProps, 'identity' | 'titleAdornment' | 'showDescription' | 'showBreadcrumbs' | 'renderAction' | 'overflowAction'>
}

/**
 * Same icon as the sidebar row for this page — looked up from the SAME
 * SETTINGS_NAV_ITEMS the sidebar itself renders from, not a second,
 * independently-maintained choice. Without this, PageHeader's own fallback
 * (getPageIconName) guesses from the title string and has no entry for most
 * of these titles, so it defaulted to a generic document icon for pages
 * like General/Business details/Security while others coincidentally hit a
 * different generic guess — neither matched the row you clicked to get here.
 */
function findSidebarIcon(title: string, navigationKey?: string): LucideIcon | undefined {
    return SETTINGS_NAV_ITEMS.find((item) => navigationKey ? item.href === navigationKey : item.label === title)?.Icon
}

/**
 * Renders the header icon for a page. The icon component is a stable reference out of SETTINGS_NAV_ITEMS (a module-level
 * constant), never something created while rendering; it reaches this module-level component as a prop, so the element
 * type SettingsPane renders is static and no component is looked up and instantiated inside SettingsPane's own render
 * (react-hooks/static-components). Same DOM as rendering the icon directly.
 */
function SidebarTitleIcon({ Icon }: { Icon: LucideIcon }) {
    return <Icon className="letbuyy-icon" aria-hidden="true" />
}

export function SettingsPane({
    title,
    description,
    store,
    children,
    breadcrumbs,
    eyebrow,
    iconName,
    navigationKey,
    guidance,
    primaryAction,
    secondaryActions,
    saveBar,
    header,
}: SettingsPaneProps) {
    const SidebarIcon = findSidebarIcon(title, navigationKey)

    return (
        <Page>
            <PageHeader
                recipe="settings"
                {...header}
                title={title}
                description={description}
                eyebrow={eyebrow}
                icon={SidebarIcon ? <SidebarTitleIcon Icon={SidebarIcon} /> : undefined}
                iconName={SidebarIcon ? undefined : iconName}
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

            {saveBar && <SaveBar {...saveBar} />}
        </Page>
    )
}
