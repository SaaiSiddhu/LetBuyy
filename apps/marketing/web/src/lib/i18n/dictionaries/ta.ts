import type { Dictionary } from './en'

/**
 * Tamil.
 *
 * Typed as `Dictionary`, so this file cannot drift from the English source —
 * a missing key fails the build rather than rendering blank.
 *
 * Product nouns that Tamil sellers use in English every day are left in
 * English on purpose: UPI, GST, API, LetBuyy. Translating "GST" to
 * "சரக்கு மற்றும் சேவை வரி" in a nav label reads as a textbook, not as
 * software people use.
 */
export const ta: Dictionary = {
    meta: {
        title: 'LetBuyy — இந்தியாவுக்கான வணிக இயங்குதளம்',
        description:
            'UPI, பணம் செலுத்தி பெறுதல் (COD), GST விலைப்பட்டியல் மற்றும் அனுப்புதல் அனைத்தும் உள்ளடங்கிய ஆன்லைன் கடையை இந்தியாவில் தொடங்குங்கள். உங்கள் விற்பனையில் 0% கமிஷன்.',
    },

    nav: {
        whyLetbuyy: 'ஏன் LetBuyy',
        products: 'தயாரிப்புகள்',
        themes: 'வடிவமைப்புகள்',
        apps: 'ஆப்ஸ்',
        developers: 'டெவலப்பர்கள்',
        pricing: 'விலை',
        logIn: 'உள்நுழைக',
        startForFree: 'இலவசமாக தொடங்குங்கள்',
        openMenu: 'மெனுவைத் திறக்க',
        closeMenu: 'மெனுவை மூட',
        back: 'பின்செல்',
        mainNavigation: 'முதன்மை வழிசெலுத்தல்',
        mobileNavigation: 'மொபைல் வழிசெலுத்தல்',
    },

    footer: {
        heading: 'LetBuyy அடிக்குறிப்பு',
        regionAndLanguage: 'பகுதி மற்றும் மொழி',
        changeRegion: 'பகுதி மற்றும் மொழியை மாற்ற',
        legalLinks: 'சட்ட இணைப்புகள்',
        socialLinks: 'சமூக ஊடக இணைப்புகள்',
        allRightsReserved: 'அனைத்து உரிமைகளும் பாதுகாக்கப்பட்டவை.',
        merchantAppForAndroid: 'Android-க்கான வணிகர் ஆப்',
        comingSoonTo: 'விரைவில் வரும்',
        comingSoon: 'விரைவில்',
        getItOn: 'பெறுக',
        download: 'பதிவிறக்கம்',
        googlePlay: 'Google Play',
        androidApk: 'Android APK',
        launchingWithBeta: 'தனிப்பட்ட பீட்டாவுடன் வெளியிடப்படும்.',
        privacyChoices: 'உங்கள் தனியுரிமை விருப்பங்கள்',
        privacyIntro:
            'இந்த தளத்தில் விருப்பத் தேர்வு குக்கீகளை LetBuyy எவ்வாறு பயன்படுத்துகிறது என்பதைத் தேர்வு செய்யுங்கள்.',
        essential: 'அத்தியாவசியம்',
        essentialNote: 'பாதுகாப்பு, வழிசெலுத்தல் மற்றும் பாதுகாப்பான செக்அவுட்டுக்குத் தேவை.',
        analytics: 'பகுப்பாய்வு',
        analyticsNote: 'பக்க செயல்திறனையும் ஆர்வத்தையும் புரிந்துகொள்ள உதவுகிறது.',
        personalization: 'தனிப்பயனாக்கம்',
        personalizationNote: 'முக்கியமற்ற விருப்பங்களை அடுத்த வருகைக்கு நினைவில் வைக்கும்.',
        saveChoices: 'விருப்பங்களைச் சேமி',
        closePrivacy: 'தனியுரிமை விருப்பங்களை மூட',
        columns: {
            letbuyy: 'LetBuyy',
            ecosystem: 'சூழல் அமைப்பு',
            resources: 'வளங்கள்',
            support: 'உதவி',
        },
        links: {
            whatIsLetbuyy: 'LetBuyy என்றால் என்ன?',
            pricing: 'விலை',
            startYourStore: 'உங்கள் கடையைத் தொடங்குங்கள்',
            platformSitemap: 'தள வரைபடம்',
            themeMarketplace: 'வடிவமைப்பு சந்தை',
            appMarketplace: 'ஆப் சந்தை',
            developerDocs: 'டெவலப்பர் ஆவணங்கள்',
            merchantLogin: 'வணிகர் உள்நுழைவு',
            allResources: 'அனைத்து வளங்களும்',
            ecommerceGuides: 'இணைய வணிக வழிகாட்டிகள்',
            changelog: 'மாற்றப் பதிவு',
            contactUs: 'எங்களைத் தொடர்பு கொள்ள',
            grievanceRedressal: 'குறைதீர்ப்பு',
            security: 'பாதுகாப்பு',
            accountAccess: 'கணக்கு அணுகல்',
            publicSitemap: 'பொது தள வரைபடம்',
            legal: 'சட்டம்',
            terms: 'விதிமுறைகள்',
            privacy: 'தனியுரிமை',
            refunds: 'பணத்திரும்பம்',
            sitemap: 'தள வரைபடம்',
        },
    },

    languageSwitcher: {
        title: 'பகுதி மற்றும் மொழி',
        country: 'நாடு',
        language: 'மொழி',
        close: 'மூடு',
        apply: 'பயன்படுத்து',
        currentlyViewing: 'தற்போது பார்ப்பது',
        moreCountriesSoon: 'LetBuyy விரிவடையும்போது மேலும் நாடுகள் சேர்க்கப்படும்.',
    },

    contact: {
        title: 'எங்களிடம் பேசுங்கள்',
        intro:
            'LetBuyy இந்தியாவில், இந்திய விற்பனையாளர்களுக்காக உருவாக்கப்பட்டது. கீழே உள்ள எந்த வழியிலும் ஒரு நபரை அடையலாம் — நாங்கள் ஆங்கிலம், இந்தி மற்றும் தமிழில் பதிலளிக்கிறோம்.',
        merchantSupport: 'வணிகர் உதவி',
        merchantSupportNote: 'உங்கள் கடை, ஆர்டர்கள், பணப்பரிவர்த்தனை அல்லது GST பற்றிய கேள்விகள்.',
        sales: 'விற்பனை',
        salesNote: 'விலை, வேறு தளத்திலிருந்து மாற்றம், அல்லது பெரிய தயாரிப்புப் பட்டியல்.',
        developers: 'டெவலப்பர்கள்',
        developersNote: 'API விசைகள், webhooks, ஆப்ஸ் மற்றும் வடிவமைப்பு உருவாக்கம்.',
        developerDocs: 'டெவலப்பர் ஆவணங்கள்',
        accountAccess: 'கணக்கு அணுகல்',
        accountAccessNote: 'ஏற்கனவே உள்ள கடையில் உள்நுழைவதில் சிக்கல்.',
        merchantLogin: 'வணிகர் உள்நுழைவு',
        somethingElse: 'வேறு ஏதாவது தேடுகிறீர்களா? முயற்சிக்கவும்',
        guideLibrary: 'வழிகாட்டி நூலகம்',
        pricingPage: 'விலைப் பக்கம்',
        siteIndex: 'முழு தள அட்டவணை',
    },

    legal: {
        title: 'சட்டம்',
        intro:
            'LetBuyy-ஐ நிர்வகிக்கும் ஒவ்வொரு ஒப்பந்தமும், கொள்கையும் — படிக்கும்படி எழுதப்பட்டவை. ஒரு தலைப்புக்கு ஒரு பக்கம், மேலே எளிய விளக்கம், கீழே சரியான விதிமுறை.',
        documents: 'ஆவணங்கள்',
        revised: 'திருத்தப்பட்டது',
        jurisdiction: 'அதிகார எல்லை',
        india: 'இந்தியா',
        appliesTo: 'யாருக்குப் பொருந்தும்',
        clauses: 'விதிமுறைகள்',
        readingTime: 'படிக்கும் நேரம்',
        minutes: 'நிமிடம்',
        inShort: 'சுருக்கமாக',
        inShortCaveat:
            'இந்தச் சுருக்கம் புரிந்துகொள்ள எழுதப்பட்டது. கீழே உள்ள விதிமுறைகளே உண்மையில் பொருந்தும் — இரண்டும் வேறுபட்டால், விதிமுறைகளே செல்லும்.',
        questionsTitle: 'இந்த ஆவணம் குறித்த கேள்விகள்',
        previous: 'முந்தையது',
        next: 'அடுத்தது',
        cannotFind: 'தேவையானது கிடைக்கவில்லையா?',
        cannotFindNote:
            'ஒரு கொள்கை உங்கள் கேள்விக்குப் பதிலளிக்கவில்லை என்றால், ஊகிக்காமல் எங்களிடம் கேளுங்கள்.',
        fileGrievance: 'குறை தெரிவிக்க',
        note: 'குறிப்பு',
    },

    contentFallback: {
        legalTitle: 'ஆங்கிலத்தில் கிடைக்கிறது',
        legalBody:
            'LetBuyy-இன் சட்ட ஆவணங்கள் ஆங்கிலத்தில் வெளியிடப்படுகின்றன. மொழிபெயர்ப்புகள் பின்னர் வரலாம், ஆனால் ஆங்கிலப் பதிப்பே பொருந்தக்கூடியது. ஏதேனும் விதிமுறை தெளிவில்லை என்றால் கேளுங்கள் — உங்கள் மொழியில் விளக்குகிறோம்.',
        articleTitle: 'இந்த வழிகாட்டி ஆங்கிலத்தில் உள்ளது',
        articleBody:
            'இந்த வழிகாட்டியை நாங்கள் இன்னும் மொழிபெயர்க்கவில்லை. தளத்தின் மற்ற பகுதிகள் உங்கள் மொழியில் கிடைக்கின்றன, மொழிபெயர்க்கப்பட்ட வழிகாட்டிகள் இங்கே தோன்றும்.',
    },

    common: {
        skipToContent: 'உள்ளடக்கத்திற்குச் செல்',
        loading: 'ஏற்றுகிறது',
        readMore: 'மேலும் படிக்க',
        backToTop: 'மேலே செல்',
        search: 'தேடல்',
    },
}
