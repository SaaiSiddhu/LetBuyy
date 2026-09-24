import type { CSSProperties } from 'react'
import { MaterialIcon, type MaterialIconName } from '@letbuyy/ui'

export type AuthIconName =
    | 'account_circle'
    | 'add'
    | 'article'
    | 'arrow_back'
    | 'arrow_forward'
    | 'auto_awesome'
    | 'cancel'
    | 'check'
    | 'check_circle'
    | 'contact_page'
    | 'currency_rupee'
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
    | 'local_shipping'
    | 'lock'
    | 'logout'
    | 'mail'
    | 'menu_book'
    | 'passkey'
    | 'palette'
    | 'radio_button_unchecked'
    | 'receipt_long'
    | 'rocket_launch'
    | 'shopping_cart'
    | 'storefront'
    | 'verified'
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

export function AuthIcon({ name, size = 20, className, style, title }: AuthIconProps) {
    return (
        <MaterialIcon
            aria-hidden={title ? undefined : true}
            aria-label={title}
            className={['auth-icon-svg', className].filter(Boolean).join(' ')}
            focusable="false"
            name={name as MaterialIconName}
            role={title ? 'img' : undefined}
            size={size}
            style={style}
        />
    )
}
