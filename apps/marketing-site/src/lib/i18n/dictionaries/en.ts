/**
 * English source dictionary.
 *
 * This is the contract: `Dictionary` is `typeof en`, so a missing or misnamed
 * key in Tamil or Hindi is a type error rather than a blank string in
 * production. Add a key here first, then the compiler tells you what else to
 * write.
 *
 * Long-form content (the 15 legal documents, the 36-article library) is NOT
 * here. Those live in their own libraries and are served in English across all
 * locales — see `contentFallback` below for the notice shown on those pages.
 */
export const en = {
    meta: {
        title: 'LetBuyy — India-first commerce operating system',
        description:
            'Launch an online store in India with UPI, cash on delivery, GST invoices and shipping built in. 0% commission on your sales.',
    },

    nav: {
        whyLetbuyy: 'Why LetBuyy',
        products: 'Products',
        themes: 'Themes',
        apps: 'Apps',
        developers: 'Developers',
        pricing: 'Pricing',
        logIn: 'Log in',
        startForFree: 'Start for free',
        openMenu: 'Open menu',
        closeMenu: 'Close menu',
        back: 'Back',
        mainNavigation: 'Main navigation',
        mobileNavigation: 'Mobile navigation',
    },

    footer: {
        heading: 'LetBuyy footer',
        regionAndLanguage: 'Region and language',
        changeRegion: 'Change region and language',
        legalLinks: 'Legal links',
        socialLinks: 'Social links',
        allRightsReserved: 'All rights reserved.',
        merchantAppForAndroid: 'Merchant app for Android',
        comingSoonTo: 'Coming soon to',
        comingSoon: 'Coming soon',
        getItOn: 'Get it on',
        download: 'Download',
        googlePlay: 'Google Play',
        androidApk: 'Android APK',
        launchingWithBeta: 'Launching with the private beta.',
        privacyChoices: 'Your Privacy Choices',
        privacyIntro:
            'Choose how LetBuyy uses optional cookies and similar technologies on this marketing site.',
        essential: 'Essential',
        essentialNote: 'Required for security, routing, and checkout-safe experiences.',
        analytics: 'Analytics',
        analyticsNote: 'Help us understand page performance and product interest.',
        personalization: 'Personalization',
        personalizationNote: 'Remember non-sensitive marketing preferences for future visits.',
        saveChoices: 'Save choices',
        closePrivacy: 'Close privacy choices',
        columns: {
            letbuyy: 'LetBuyy',
            ecosystem: 'Ecosystem',
            resources: 'Resources',
            support: 'Support',
        },
        links: {
            whatIsLetbuyy: 'What is LetBuyy?',
            pricing: 'Pricing',
            startYourStore: 'Start your store',
            platformSitemap: 'Platform sitemap',
            themeMarketplace: 'Theme Marketplace',
            appMarketplace: 'App Marketplace',
            developerDocs: 'Developer Docs',
            merchantLogin: 'Merchant login',
            allResources: 'All resources',
            ecommerceGuides: 'Ecommerce guides',
            changelog: 'Changelog',
            contactUs: 'Contact us',
            grievanceRedressal: 'Grievance redressal',
            security: 'Security',
            accountAccess: 'Account access',
            publicSitemap: 'Public sitemap',
            legal: 'Legal',
            terms: 'Terms',
            privacy: 'Privacy',
            refunds: 'Refunds',
            sitemap: 'Sitemap',
        },
    },

    languageSwitcher: {
        title: 'Region and language',
        country: 'Country',
        language: 'Language',
        close: 'Close',
        apply: 'Apply',
        currentlyViewing: 'Currently viewing',
        moreCountriesSoon: 'More countries coming as LetBuyy expands.',
    },

    contact: {
        title: 'Talk to us',
        intro:
            'LetBuyy is built in India, for Indian sellers. Whichever route you take below reaches a person — we answer in English, Hindi and Tamil.',
        merchantSupport: 'Merchant support',
        merchantSupportNote: 'Questions about your store, orders, payments or GST.',
        sales: 'Sales',
        salesNote: 'Pricing, migration from another platform, or a larger catalogue.',
        developers: 'Developers',
        developersNote: 'API keys, webhooks, apps and theme development.',
        developerDocs: 'Developer docs',
        accountAccess: 'Account access',
        accountAccessNote: 'Trouble signing in to an existing store.',
        merchantLogin: 'Merchant login',
        somethingElse: 'Looking for something else? Try the',
        guideLibrary: 'guide library',
        pricingPage: 'pricing page',
        siteIndex: 'full site index',
    },

    legal: {
        title: 'Legal',
        intro:
            'Every agreement, policy and disclosure that governs LetBuyy — written to be read, not to be survived. One page per subject, plain language at the top of each, and the exact clause underneath.',
        documents: 'Documents',
        revised: 'Revised',
        jurisdiction: 'Jurisdiction',
        india: 'India',
        appliesTo: 'Applies to',
        clauses: 'Clauses',
        readingTime: 'Reading time',
        minutes: 'min',
        inShort: 'In short',
        inShortCaveat:
            'This summary is written to be understood. The clauses below are what actually applies — where the two differ, the clauses govern.',
        questionsTitle: 'Questions about this document',
        previous: 'Previous',
        next: 'Next',
        cannotFind: 'Can’t find what you need?',
        cannotFindNote:
            'If a policy does not answer your question, ask us rather than guessing. We would rather write a clearer clause than argue about an unclear one.',
        fileGrievance: 'File a grievance',
        note: 'Note',
    },

    /**
     * Shown on pages whose body is served in English regardless of locale.
     * Deliberately explicit about *why* rather than a bare "English only":
     * for the legal pages the English text is the operative one, and a reader
     * needs to know that, not just notice the language.
     */
    contentFallback: {
        legalTitle: 'Available in English',
        legalBody:
            'LetBuyy’s legal documents are published in English. Translations may follow, but the English text is the version that applies. Ask us if any clause is unclear and we will explain it in your language.',
        articleTitle: 'This guide is in English',
        articleBody:
            'We have not translated this guide yet. The rest of the site is available in your language, and translated guides will appear here as they are written.',
    },

    common: {
        skipToContent: 'Skip to content',
        loading: 'Loading',
        readMore: 'Read more',
        backToTop: 'Back to top',
        search: 'Search',
    },
}
/* Deliberately NOT `as const`: that would make every value a literal type, so
   `ta.ts` could only ever contain the English strings. Without it the shape —
   and therefore the missing-key check — is preserved while values widen to
   string. */

export type Dictionary = typeof en
