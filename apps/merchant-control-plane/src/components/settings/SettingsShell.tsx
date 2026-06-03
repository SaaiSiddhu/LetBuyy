import type { ReactNode } from 'react'
import { SettingsIndex } from './SettingsIndex'

interface SettingsShellProps {
    store: string
    storeName: string
    subdomain: string
    userName: string
    userEmail: string
    children: ReactNode
}

export function SettingsShell({
    store,
    storeName,
    subdomain,
    userName,
    userEmail,
    children,
}: SettingsShellProps) {
    return (
        <div className="min-h-screen bg-[var(--lb-color-background)] px-[var(--lb-space-3)] py-[var(--lb-space-3)] text-[color:var(--lb-color-text)] sm:px-[var(--lb-space-4)] lg:px-[var(--lb-space-6)]">
            <div className="mx-auto grid w-full max-w-[calc(var(--lb-size-page-max)+22rem)] gap-[var(--lb-space-4)] lg:grid-cols-[20rem_minmax(0,1fr)] lg:items-start">
                <SettingsIndex
                    store={store}
                    storeName={storeName}
                    subdomain={subdomain}
                    userName={userName}
                    userEmail={userEmail}
                />
                <section className="min-w-0" aria-label="Settings content" data-settings-savebar-host="true">
                    {children}
                </section>
            </div>
        </div>
    )
}
