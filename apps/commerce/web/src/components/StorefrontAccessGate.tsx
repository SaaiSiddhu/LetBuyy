import type { ReactNode } from 'react';
import { Lock } from '@letbuyy/ui';
import styles from './storefront-access-gate.module.css';
export default function StorefrontAccessGate({ storeName, message, passwordProtected = false, children }: {
    storeName: string;
    message?: string | null;
    passwordProtected?: boolean;
    children?: ReactNode;
}) {
    return <main className={styles.page}>
        <section className={styles.card} aria-labelledby="storefront-access-title">
            <div className={styles.icon}><Lock size={24} aria-hidden="true"/></div>
            <p className={styles.eyebrow}>{passwordProtected ? 'Password protected' : 'Opening soon'}</p>
            <h1 id="storefront-access-title">{storeName}</h1>
            <p className={styles.message}>{message || (passwordProtected ? 'Enter the store password to continue.' : 'This storefront is currently unavailable. Please check back soon.')}</p>
            {children}
        </section>
        <a className={styles.brand} href="https://letbuyy.com">Powered by LetBuyy</a>
    </main>;
}
