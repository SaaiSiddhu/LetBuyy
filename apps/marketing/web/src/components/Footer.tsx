'use client'

import { useCopy } from '@/components/i18n/useCopy'

import { useRef, useState } from 'react'
import Link from '@/components/i18n/LocaleLink'
import {
    Button,
    Modal,
    Check,
    Checkbox,
    Facebook,
    Instagram,
    Linkedin,
    Youtube,
} from '@letbuyy/ui'
import BrandLogo from './BrandLogo'
import { XMark } from './BrandGlyphs'
import LanguageSwitcher from './i18n/LanguageSwitcher'
import { getDictionaryForSegment } from '@/lib/i18n'
import { localeFromPathname } from '@/lib/i18n/routing'
import Copy from '@/components/i18n/Copy'
import { usePathname } from 'next/navigation'
import { BRAND_PROFILES } from '@letbuyy/shared-types'
import { getPlatformNavigationLinks } from '@/lib/platform-links'

const platformLinks = getPlatformNavigationLinks()
const platformHref = (label: string) => platformLinks.find((link) => link.label === label)?.href ?? '/'

const footerColumns = [
    {
        title: 'letbuyy',
        links: [
            { label: 'whatIsLetbuyy', href: '/' },
            { label: 'pricing', href: '/pricing' },
            { label: 'startYourStore', href: '/create' },
        ],
    },
    {
        title: 'ecosystem',
        links: [
            { label: 'themeGuide', href: platformHref('Themes') },
            { label: 'appGuide', href: platformHref('Apps') },
            { label: 'developerDocs', href: platformHref('Developers') },
            { label: 'merchantLogin', href: platformHref('Log in') },
        ],
    },
    {
        title: 'resources',
        links: [
            { label: 'allResources', href: '/resources' },
            { label: 'ecommerceGuides', href: '/resources/ecommerce' },
            { label: 'developerDocs', href: '/resources/developers' },
            { label: 'changelog', href: '/resources/changelog' },
        ],
    },
    {
        title: 'support',
        links: [
            { label: 'supportCentre', href: '/support' },
            { label: 'contactUs', href: '/contact' },
            { label: 'grievanceRedressal', href: '/legal/grievance' },
            { label: 'security', href: '/legal/security' },
            { label: 'accountAccess', href: platformHref('Log in') },
        ],
    },
] as const

/* Every policy lives under /legal/<slug>; /legal is the index. The four here
   are the ones people look for in a footer — the rest are one click deeper. */
const legalLinks = [
    { label: 'legal', href: '/legal' },
    { label: 'terms', href: '/legal/terms' },
    { label: 'privacy', href: '/legal/privacy' },
    { label: 'refunds', href: '/legal/refunds' },
    { label: 'sitemap', href: '/sitemap' },
] as const

/* Built from BRAND_PROFILES so the handles live in one place — that registry
   also feeds Organization.sameAs in the structured data, and a footer link
   disagreeing with sameAs is exactly the kind of mismatch that weakens entity
   recognition. Accounts with no URL yet are filtered out rather than linked to
   a guessed handle. */
const socialLinks = [
    { label: 'Facebook', href: BRAND_PROFILES.facebook, icon: Facebook },
    { label: 'X', href: BRAND_PROFILES.x, icon: XMark },
    { label: 'YouTube', href: BRAND_PROFILES.youtube, icon: Youtube },
    { label: 'Instagram', href: BRAND_PROFILES.instagram, icon: Instagram },
    { label: 'LinkedIn', href: BRAND_PROFILES.linkedin, icon: Linkedin },
].filter(link => link.href)

const privacyChoicesIconUrl = '/assets/legal/privacy-choices.svg'

export default function Footer() {
    const { t } = useCopy()
    /* The footer is already a client component, so it reads the locale from
       the pathname rather than threading a prop through every page. */
    const pathname = usePathname()
    const dict = getDictionaryForSegment(localeFromPathname(pathname).segment)
    const [privacyPanelOpen, setPrivacyPanelOpen] = useState(false)
    const [analyticsEnabled, setAnalyticsEnabled] = useState(false)
    const [personalizationEnabled, setPersonalizationEnabled] = useState(false)

    const privacyReturnRef = useRef<HTMLElement | null>(null)
    const [privacyError, setPrivacyError] = useState('')

    function openPrivacyChoices() {
        privacyReturnRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
        setPrivacyError('')
        try {
            const saved: unknown = JSON.parse(window.localStorage.getItem('letbuyy_privacy_choices') ?? 'null')
            if (saved && typeof saved === 'object') {
                const choices = saved as Record<string, unknown>
                setAnalyticsEnabled(choices.analytics === true)
                setPersonalizationEnabled(choices.personalization === true)
            }
        } catch {
            setPrivacyError('Saved choices could not be read. You can choose again below.')
        }
        setPrivacyPanelOpen(true)
    }

    function savePrivacyChoices() {
        try {
            window.localStorage.setItem(
                'letbuyy_privacy_choices',
                JSON.stringify({
                    analytics: analyticsEnabled,
                    personalization: personalizationEnabled,
                    savedAt: new Date().toISOString(),
                }),
            )
            setPrivacyPanelOpen(false)
        } catch {
            setPrivacyError('Your browser could not save these choices. Please allow site storage and try again.')
        }
    }

    return (
        <footer className="footer" aria-labelledby="site-footer-heading">
            <div className="footer-container">
                <h2 id="site-footer-heading" className="sr-only">
                    {dict.footer.heading}
                </h2>

                <div className="footer-nav">
                    <div className="footer-brand">
                        <Link href="/" className="footer-mark" aria-label={t("LetBuyy home")}>
                            <BrandLogo className="footer-logo-image" width={178} height={58} />
                        </Link>


                    </div>

                    <div className="footer-columns">
                        {footerColumns.map((column) => (
                            <nav key={column.title} className="footer-column" aria-label={dict.footer.columns[column.title]}>
                                <h3 className="footer-column-title">{dict.footer.columns[column.title]}</h3>
                                <ul className="footer-links">
                                    {column.links.map((link) => (
                                        <li key={link.label}>
                                            <Link href={link.href} className="footer-link">
                                                {dict.footer.links[link.label]}
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                            </nav>
                        ))}
                    </div>
                </div>

                <div className="footer-rule" aria-hidden="true" />

                <div className="footer-meta">
                    <div className="footer-region-row" aria-label={dict.footer.regionAndLanguage}>
                        <LanguageSwitcher dict={dict} />
                    </div>

                    <nav className="footer-legal-row" aria-label={dict.footer.legalLinks}>
                        {legalLinks.map((link) => (
                            <Link key={link.label} href={link.href} className="footer-legal-link">
                                {dict.footer.links[link.label]}
                            </Link>
                        ))}
                        <Button
                            unstyled
                            type="button"
                            className="footer-privacy-choice"
                            onClick={openPrivacyChoices}
                        >
                            <span>{dict.footer.privacyChoices}</span>
                            <img src={privacyChoicesIconUrl} alt="" width="32" height="16" aria-hidden="true" />
                        </Button>
                    </nav>

                    <nav className="footer-social" aria-label={dict.footer.socialLinks}>
                        {socialLinks.map((link) => {
                            const Icon = link.icon
                            return (
                                <a key={link.label} href={link.href} target="_blank" rel="noopener noreferrer" aria-label={link.label}>
                                    <Icon width={24} height={24} aria-hidden="true" />
                                </a>
                            )
                        })}
                    </nav>
                </div>

                <p className="footer-copyright">
                    © {new Date().getFullYear()} LetBuyy. {dict.footer.allRightsReserved}
                </p>
            </div>

            <Modal className="marketing-dialog" open={privacyPanelOpen} onClose={() => setPrivacyPanelOpen(false)} title={dict.footer.privacyChoices} returnFocusRef={privacyReturnRef}>
                    <div>
                        <img className="footer-privacy-icon" src={privacyChoicesIconUrl} alt="" width="48" height="24" aria-hidden="true" />
                        {privacyError && <p role="alert"><Copy text={privacyError} /></p>}
                        <p>
                            {dict.footer.privacyIntro}
                        </p>

                        <div className="footer-privacy-options">
                            <label className="footer-privacy-option footer-privacy-option-locked">
                                <span>
                                    <strong>{dict.footer.essential}</strong>
                                    <small>{dict.footer.essentialNote}</small>
                                </span>
                                <span className="footer-privacy-check">
                                    <Check width={16} height={16} aria-hidden="true" />
                                </span>
                            </label>

                            <label className="footer-privacy-option">
                                <span>
                                    <strong>{dict.footer.analytics}</strong>
                                    <small>{dict.footer.analyticsNote}</small>
                                </span>
                                <Checkbox
                                    unstyled
                                    label={dict.footer.analytics}
                                    checked={analyticsEnabled}
                                    onCheckedChange={setAnalyticsEnabled}
                                />
                            </label>

                            <label className="footer-privacy-option">
                                <span>
                                    <strong>{dict.footer.personalization}</strong>
                                    <small>{dict.footer.personalizationNote}</small>
                                </span>
                                <Checkbox
                                    unstyled
                                    label={dict.footer.personalization}
                                    checked={personalizationEnabled}
                                    onCheckedChange={setPersonalizationEnabled}
                                />
                            </label>
                        </div>

                        <Button unstyled type="button" className="footer-privacy-save" onClick={savePrivacyChoices}>
                            {dict.footer.saveChoices}
                        </Button>
                    </div>
            </Modal>
        </footer>
    )
}
