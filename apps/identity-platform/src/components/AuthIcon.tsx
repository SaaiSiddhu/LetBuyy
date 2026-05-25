import type { CSSProperties, ReactNode } from 'react'

export type AuthIconName =
    | 'account_circle'
    | 'article'
    | 'arrow_back'
    | 'arrow_forward'
    | 'auto_awesome'
    | 'cancel'
    | 'check_circle'
    | 'contact_page'
    | 'dark_mode'
    | 'dashboard_customize'
    | 'description'
    | 'edit'
    | 'edit_note'
    | 'error'
    | 'flash_on'
    | 'info'
    | 'language'
    | 'light_mode'
    | 'link'
    | 'lock'
    | 'logout'
    | 'mail'
    | 'menu_book'
    | 'passkey'
    | 'palette'
    | 'radio_button_unchecked'
    | 'rocket_launch'
    | 'shopping_cart'
    | 'storefront'
    | 'visibility'
    | 'visibility_off'
    | 'warning'
    | 'web'
    | 'work'

interface AuthIconProps {
    name: AuthIconName
    size?: number
    className?: string
    style?: CSSProperties
    title?: string
}

const paths: Record<AuthIconName, ReactNode> = {
    account_circle: (
        <>
            <circle cx="12" cy="12" r="9" />
            <circle cx="12" cy="10" r="3" />
            <path d="M6.5 18.5c1.3-2.2 3-3.3 5.5-3.3s4.2 1.1 5.5 3.3" />
        </>
    ),
    article: (
        <>
            <path d="M7 3h7l3 3v15H7z" />
            <path d="M14 3v4h4" />
            <path d="M9 11h6M9 15h6M9 19h4" />
        </>
    ),
    arrow_back: <path d="M19 12H5m6-6-6 6 6 6" />,
    arrow_forward: <path d="M5 12h14m-6-6 6 6-6 6" />,
    auto_awesome: (
        <>
            <path d="m12 3 1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5z" />
            <path d="m5 16 .7 2.1L8 19l-2.3.9L5 22l-.7-2.1L2 19l2.3-.9zM19 13l.6 1.7L21 15l-1.4.3L19 17l-.6-1.7L17 15l1.4-.3z" />
        </>
    ),
    cancel: (
        <>
            <circle cx="12" cy="12" r="9" />
            <path d="m9 9 6 6M15 9l-6 6" />
        </>
    ),
    check_circle: (
        <>
            <circle cx="12" cy="12" r="9" />
            <path d="m8 12.5 2.6 2.6L16.5 9" />
        </>
    ),
    contact_page: (
        <>
            <path d="M7 3h7l3 3v15H7z" />
            <path d="M14 3v4h4" />
            <circle cx="12" cy="12" r="2.2" />
            <path d="M8.8 18c.7-1.5 1.7-2.2 3.2-2.2s2.5.7 3.2 2.2" />
        </>
    ),
    dark_mode: <path d="M21 14.5A8 8 0 0 1 9.5 3 7 7 0 1 0 21 14.5Z" />,
    dashboard_customize: (
        <>
            <rect x="4" y="4" width="6" height="6" rx="1.5" />
            <rect x="14" y="4" width="6" height="6" rx="1.5" />
            <rect x="4" y="14" width="6" height="6" rx="1.5" />
            <path d="M17 14v6M14 17h6" />
        </>
    ),
    description: (
        <>
            <path d="M7 3h7l3 3v15H7z" />
            <path d="M14 3v4h4" />
            <path d="M9 12h6M9 16h6" />
        </>
    ),
    edit: (
        <>
            <path d="M4 20h4l11-11-4-4L4 16z" />
            <path d="m13.5 6.5 4 4" />
        </>
    ),
    edit_note: (
        <>
            <path d="M4 6h10M4 10h8M4 14h6" />
            <path d="M14 18h3.5L21 14.5 17.5 11 14 14.5z" />
        </>
    ),
    error: (
        <>
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v6M12 17h.01" />
        </>
    ),
    flash_on: <path d="M13 2 4 14h7l-1 8 10-13h-7z" />,
    info: (
        <>
            <circle cx="12" cy="12" r="9" />
            <path d="M12 11v6M12 7h.01" />
        </>
    ),
    language: (
        <>
            <circle cx="12" cy="12" r="9" />
            <path d="M3 12h18M12 3c2.5 2.5 3.8 5.5 3.8 9S14.5 18.5 12 21M12 3C9.5 5.5 8.2 8.5 8.2 12S9.5 18.5 12 21" />
        </>
    ),
    light_mode: (
        <>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </>
    ),
    link: (
        <>
            <path d="M10 13a5 5 0 0 0 7.1.2l2.1-2.1a5 5 0 0 0-7.1-7.1L11 5.1" />
            <path d="M14 11a5 5 0 0 0-7.1-.2l-2.1 2.1a5 5 0 0 0 7.1 7.1L13 18.9" />
        </>
    ),
    lock: (
        <>
            <rect x="5" y="10" width="14" height="10" rx="2" />
            <path d="M8 10V7a4 4 0 0 1 8 0v3" />
        </>
    ),
    logout: (
        <>
            <path d="M10 5H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h4" />
            <path d="M15 8l4 4-4 4M19 12H9" />
        </>
    ),
    mail: (
        <>
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <path d="m4 7 8 6 8-6" />
        </>
    ),
    menu_book: (
        <>
            <path d="M4 5.5A3.5 3.5 0 0 1 7.5 2H20v17H7.5A3.5 3.5 0 0 0 4 22z" />
            <path d="M4 5.5A3.5 3.5 0 0 1 7.5 2H20M4 18.5A3.5 3.5 0 0 1 7.5 15H20" />
        </>
    ),
    passkey: (
        <>
            <circle cx="8" cy="9" r="4" />
            <path d="M12 13 21 4M17 8l2 2M15 10l2 2" />
        </>
    ),
    palette: (
        <>
            <path d="M12 3a9 9 0 0 0 0 18h1.5a2 2 0 0 0 1.4-3.4 1.4 1.4 0 0 1 1-2.4H17a4 4 0 0 0 4-4A8.2 8.2 0 0 0 12 3Z" />
            <circle cx="7.5" cy="10" r=".5" />
            <circle cx="10" cy="7.5" r=".5" />
            <circle cx="14" cy="7.5" r=".5" />
            <circle cx="16.5" cy="10" r=".5" />
        </>
    ),
    radio_button_unchecked: <circle cx="12" cy="12" r="8" />,
    rocket_launch: (
        <>
            <path d="M13 4c3.5.3 5.7 2.5 6 6l-6 6-5-5z" />
            <path d="M7 12 4 15l5 5 3-3" />
            <path d="M9 15H5M12 18v-4" />
            <circle cx="15" cy="8" r="1.5" />
        </>
    ),
    shopping_cart: (
        <>
            <circle cx="9" cy="20" r="1" />
            <circle cx="18" cy="20" r="1" />
            <path d="M2 3h3l2.2 11.2A2 2 0 0 0 9.2 16h7.9a2 2 0 0 0 2-1.6L20.5 7H6" />
        </>
    ),
    storefront: (
        <>
            <path d="M4 10h16l-1-5H5z" />
            <path d="M5 10v10h14V10M9 20v-6h6v6" />
            <path d="M4 10c0 1.4 1.1 2.5 2.5 2.5S9 11.4 9 10M9 10c0 1.4 1.1 2.5 2.5 2.5S14 11.4 14 10M14 10c0 1.4 1.1 2.5 2.5 2.5S19 11.4 19 10" />
        </>
    ),
    visibility: (
        <>
            <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" />
            <circle cx="12" cy="12" r="3" />
        </>
    ),
    visibility_off: (
        <>
            <path d="m3 3 18 18" />
            <path d="M10.6 10.6A3 3 0 0 0 13.4 13.4" />
            <path d="M9.9 5.8A10.8 10.8 0 0 1 12 5.6c6.5 0 10 6.4 10 6.4a18.6 18.6 0 0 1-3.2 4.2M6.6 6.8C3.7 8.6 2 12 2 12s3.5 6.4 10 6.4c1.6 0 3-.4 4.2-1" />
        </>
    ),
    warning: (
        <>
            <path d="M12 3 2.5 20h19z" />
            <path d="M12 9v5M12 17h.01" />
        </>
    ),
    web: (
        <>
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <path d="M3 9h18" />
            <path d="M7 13h4M7 16h8" />
        </>
    ),
    work: (
        <>
            <rect x="3" y="7" width="18" height="13" rx="2" />
            <path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 12h18" />
        </>
    ),
}

export function AuthIcon({ name, size = 20, className, style, title }: AuthIconProps) {
    return (
        <svg
            aria-hidden={title ? undefined : true}
            className={['auth-icon-svg', className].filter(Boolean).join(' ')}
            fill="none"
            focusable="false"
            height={size}
            role={title ? 'img' : undefined}
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            style={style}
            viewBox="0 0 24 24"
            width={size}
            xmlns="http://www.w3.org/2000/svg"
        >
            {title ? <title>{title}</title> : null}
            {paths[name]}
        </svg>
    )
}
