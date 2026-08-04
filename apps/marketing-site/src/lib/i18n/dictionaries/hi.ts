import type { Dictionary } from './en'

/**
 * Hindi.
 *
 * Same contract as Tamil: typed against the English source so it cannot drift.
 * Product nouns Indian sellers already use in English — UPI, GST, API, COD,
 * LetBuyy — stay in English rather than being rendered in Devanagari
 * transliteration, which is how sellers actually speak about them.
 */
export const hi: Dictionary = {
    meta: {
        title: 'LetBuyy — भारत के लिए बना कॉमर्स ऑपरेटिंग सिस्टम',
        description:
            'UPI, कैश ऑन डिलीवरी, GST इनवॉइस और शिपिंग के साथ भारत में अपनी ऑनलाइन दुकान शुरू करें। आपकी बिक्री पर 0% कमीशन।',
    },

    nav: {
        whyLetbuyy: 'LetBuyy क्यों',
        products: 'प्रोडक्ट',
        themes: 'थीम',
        apps: 'ऐप्स',
        developers: 'डेवलपर',
        pricing: 'कीमत',
        logIn: 'लॉग इन',
        startForFree: 'मुफ़्त शुरू करें',
        openMenu: 'मेन्यू खोलें',
        closeMenu: 'मेन्यू बंद करें',
        back: 'वापस',
        mainNavigation: 'मुख्य नेविगेशन',
        mobileNavigation: 'मोबाइल नेविगेशन',
    },

    footer: {
        heading: 'LetBuyy फ़ुटर',
        regionAndLanguage: 'क्षेत्र और भाषा',
        changeRegion: 'क्षेत्र और भाषा बदलें',
        legalLinks: 'क़ानूनी लिंक',
        socialLinks: 'सोशल लिंक',
        allRightsReserved: 'सर्वाधिकार सुरक्षित।',
        merchantAppForAndroid: 'Android के लिए मर्चेंट ऐप',
        comingSoonTo: 'जल्द आ रहा है',
        comingSoon: 'जल्द आ रहा है',
        getItOn: 'डाउनलोड करें',
        download: 'डाउनलोड',
        googlePlay: 'Google Play',
        androidApk: 'Android APK',
        launchingWithBeta: 'प्राइवेट बीटा के साथ लॉन्च होगा।',
        privacyChoices: 'आपकी प्राइवेसी पसंद',
        privacyIntro:
            'चुनें कि इस साइट पर LetBuyy वैकल्पिक कुकीज़ का उपयोग कैसे करे।',
        essential: 'ज़रूरी',
        essentialNote: 'सुरक्षा, रूटिंग और सुरक्षित चेकआउट के लिए आवश्यक।',
        analytics: 'एनालिटिक्स',
        analyticsNote: 'पेज परफ़ॉर्मेंस और रुचि समझने में मदद करता है।',
        personalization: 'निजीकरण',
        personalizationNote: 'ग़ैर-संवेदनशील पसंद अगली बार के लिए याद रखता है।',
        saveChoices: 'पसंद सहेजें',
        closePrivacy: 'प्राइवेसी विकल्प बंद करें',
        columns: {
            letbuyy: 'LetBuyy',
            ecosystem: 'इकोसिस्टम',
            resources: 'संसाधन',
            support: 'सहायता',
        },
        links: {
            whatIsLetbuyy: 'LetBuyy क्या है?',
            pricing: 'कीमत',
            startYourStore: 'अपनी दुकान शुरू करें',
            platformSitemap: 'प्लेटफ़ॉर्म साइटमैप',
            themeMarketplace: 'थीम मार्केटप्लेस',
            appMarketplace: 'ऐप मार्केटप्लेस',
            developerDocs: 'डेवलपर डॉक्स',
            merchantLogin: 'मर्चेंट लॉगिन',
            allResources: 'सभी संसाधन',
            ecommerceGuides: 'ईकॉमर्स गाइड',
            changelog: 'चेंजलॉग',
            contactUs: 'संपर्क करें',
            grievanceRedressal: 'शिकायत निवारण',
            security: 'सुरक्षा',
            accountAccess: 'खाता एक्सेस',
            publicSitemap: 'सार्वजनिक साइटमैप',
            legal: 'क़ानूनी',
            terms: 'शर्तें',
            privacy: 'प्राइवेसी',
            refunds: 'रिफ़ंड',
            sitemap: 'साइटमैप',
        },
    },

    languageSwitcher: {
        title: 'क्षेत्र और भाषा',
        country: 'देश',
        language: 'भाषा',
        close: 'बंद करें',
        apply: 'लागू करें',
        currentlyViewing: 'अभी देख रहे हैं',
        moreCountriesSoon: 'LetBuyy के विस्तार के साथ और देश जुड़ेंगे।',
    },

    contact: {
        title: 'हमसे बात करें',
        intro:
            'LetBuyy भारत में, भारतीय विक्रेताओं के लिए बनाया गया है। नीचे दिया कोई भी रास्ता एक असली व्यक्ति तक पहुँचता है — हम अंग्रेज़ी, हिन्दी और तमिल में जवाब देते हैं।',
        merchantSupport: 'मर्चेंट सहायता',
        merchantSupportNote: 'आपकी दुकान, ऑर्डर, पेमेंट या GST से जुड़े सवाल।',
        sales: 'सेल्स',
        salesNote: 'कीमत, दूसरे प्लेटफ़ॉर्म से माइग्रेशन, या बड़ा कैटलॉग।',
        developers: 'डेवलपर',
        developersNote: 'API की, webhooks, ऐप्स और थीम डेवलपमेंट।',
        developerDocs: 'डेवलपर डॉक्स',
        accountAccess: 'खाता एक्सेस',
        accountAccessNote: 'मौजूदा दुकान में साइन इन करने में दिक़्क़त।',
        merchantLogin: 'मर्चेंट लॉगिन',
        somethingElse: 'कुछ और खोज रहे हैं? देखें',
        guideLibrary: 'गाइड लाइब्रेरी',
        pricingPage: 'कीमत पेज',
        siteIndex: 'पूरा साइट इंडेक्स',
    },

    legal: {
        title: 'क़ानूनी',
        intro:
            'LetBuyy को चलाने वाला हर अनुबंध और नीति — पढ़ने के लिए लिखी गई, झेलने के लिए नहीं। हर विषय का अपना पेज, ऊपर सरल भाषा और नीचे असली शर्त।',
        documents: 'दस्तावेज़',
        revised: 'संशोधित',
        jurisdiction: 'अधिकार क्षेत्र',
        india: 'भारत',
        appliesTo: 'किन पर लागू',
        clauses: 'शर्तें',
        readingTime: 'पढ़ने का समय',
        minutes: 'मिनट',
        inShort: 'संक्षेप में',
        inShortCaveat:
            'यह सारांश समझने के लिए लिखा गया है। नीचे दी शर्तें ही वास्तव में लागू होती हैं — अंतर होने पर शर्तें ही मान्य होंगी।',
        questionsTitle: 'इस दस्तावेज़ से जुड़े सवाल',
        previous: 'पिछला',
        next: 'अगला',
        cannotFind: 'जो चाहिए वह नहीं मिला?',
        cannotFindNote:
            'अगर किसी नीति में आपके सवाल का जवाब नहीं है, तो अंदाज़ा लगाने के बजाय हमसे पूछें।',
        fileGrievance: 'शिकायत दर्ज करें',
        note: 'ध्यान दें',
    },

    contentFallback: {
        legalTitle: 'अंग्रेज़ी में उपलब्ध',
        legalBody:
            'LetBuyy के क़ानूनी दस्तावेज़ अंग्रेज़ी में प्रकाशित होते हैं। अनुवाद बाद में आ सकते हैं, लेकिन अंग्रेज़ी पाठ ही लागू होने वाला संस्करण है। कोई शर्त स्पष्ट न हो तो हमसे पूछें — हम आपकी भाषा में समझाएँगे।',
        articleTitle: 'यह गाइड अंग्रेज़ी में है',
        articleBody:
            'हमने इस गाइड का अनुवाद अभी नहीं किया है। बाक़ी साइट आपकी भाषा में उपलब्ध है, और अनुवादित गाइड यहाँ दिखने लगेंगी।',
    },

    common: {
        skipToContent: 'सामग्री पर जाएँ',
        loading: 'लोड हो रहा है',
        readMore: 'और पढ़ें',
        backToTop: 'ऊपर जाएँ',
        search: 'खोजें',
    },
}
