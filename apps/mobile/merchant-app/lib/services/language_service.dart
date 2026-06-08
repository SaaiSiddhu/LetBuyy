// lib/services/language_service.dart
// 🌐 LANGUAGE SERVICE - Handles i18n for the app

import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

enum AppLanguage { english, tamil, hindi, bengali, kannada, marathi, telugu }

class LanguageService extends ChangeNotifier {
  static const String _languageKey = 'app_language';

  AppLanguage _currentLanguage = AppLanguage.english;

  AppLanguage get currentLanguage => _currentLanguage;

  String get languageCode {
    return languageCodeFor(_currentLanguage);
  }

  String languageCodeFor(AppLanguage language) {
    switch (language) {
      case AppLanguage.english:
        return 'en';
      case AppLanguage.tamil:
        return 'ta';
      case AppLanguage.hindi:
        return 'hi';
      case AppLanguage.bengali:
        return 'bn';
      case AppLanguage.kannada:
        return 'kn';
      case AppLanguage.marathi:
        return 'mr';
      case AppLanguage.telugu:
        return 'te';
    }
  }

  String get languageName {
    return languageNameFor(_currentLanguage);
  }

  String languageNameFor(AppLanguage language) {
    switch (language) {
      case AppLanguage.english:
        return 'English';
      case AppLanguage.tamil:
        return 'தமிழ்';
      case AppLanguage.hindi:
        return 'हिंदी';
      case AppLanguage.bengali:
        return 'বাংলা';
      case AppLanguage.kannada:
        return 'ಕನ್ನಡ';
      case AppLanguage.marathi:
        return 'मराठी';
      case AppLanguage.telugu:
        return 'తెలుగు';
    }
  }

  String languageFlagFor(AppLanguage language) {
    return language == AppLanguage.english ? '🇬🇧' : '🇮🇳';
  }

  Future<void> loadLanguage() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final savedLanguage = prefs.getString(_languageKey);
      if (savedLanguage != null) {
        _currentLanguage = AppLanguage.values.firstWhere(
          (l) => l.name == savedLanguage,
          orElse: () => AppLanguage.english,
        );
        notifyListeners();
      }
    } catch (e) {
      debugPrint('Error loading language: $e');
    }
  }

  Future<void> setLanguage(AppLanguage language) async {
    _currentLanguage = language;
    notifyListeners();

    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_languageKey, language.name);
    } catch (e) {
      debugPrint('Error saving language: $e');
    }
  }

  // ============ TRANSLATIONS ============

  String get getStarted => _translation('getStarted');
  String get signInOrCreateStore => _translation('signInOrCreateStore');
  String get setYourPassword => _translation('setYourPassword');
  String get createPasswordToSecure => _translation('createPasswordToSecure');
  String get continueWithGoogle => _translation('continueWithGoogle');
  String get or => _translation('or');
  String get emailAddress => _translation('emailAddress');
  String get password => _translation('password');
  String get confirmPassword => _translation('confirmPassword');
  String get login => _translation('login');
  String get signUp => _translation('signUp');
  String get forgotPassword => _translation('forgotPassword');
  String get resetPassword => _translation('resetPassword');
  String get alreadyHaveAccount => _translation('alreadyHaveAccount');
  String get dontHaveAccount => _translation('dontHaveAccount');
  String get areYouLetBuyySeller => _translation('areYouLetBuyySeller');
  String get letBuyySeller => _translation('letBuyySeller');
  String get emailRequired => _translation('emailRequired');
  String get validEmail => _translation('validEmail');
  String get passwordRequired => _translation('passwordRequired');
  String get passwordMinLength => _translation('passwordMinLength');
  String get passwordNeedsLetter => _translation('passwordNeedsLetter');
  String get passwordNeedsNumber => _translation('passwordNeedsNumber');
  String get confirmPasswordRequired => _translation('confirmPasswordRequired');
  String get passwordsDoNotMatch => _translation('passwordsDoNotMatch');
  String get continueBtn => _translation('continueBtn');
  String get setPassword => _translation('setPassword');

  // ============ WIZARD TRANSLATIONS ============

  // Step Titles
  String get wizardSetupStore => _translation('wizardSetupStore');
  String get wizardNewOrExisting => _translation('wizardNewOrExisting');
  String get wizardNewBusiness => _translation('wizardNewBusiness');
  String get wizardJustStarting => _translation('wizardJustStarting');
  String get wizardExistingBusiness => _translation('wizardExistingBusiness');
  String get wizardAlreadyHaveBusiness =>
      _translation('wizardAlreadyHaveBusiness');
  String get wizardWhereToSell => _translation('wizardWhereToSell');
  String get wizardWhereToSellSubtitle =>
      _translation('wizardWhereToSellSubtitle');
  String get wizardWhatToSell => _translation('wizardWhatToSell');
  String get wizardWhatToSellSubtitle =>
      _translation('wizardWhatToSellSubtitle');
  String get wizardCategory => _translation('wizardCategory');
  String get wizardCategorySubtitle => _translation('wizardCategorySubtitle');
  String get wizardStoreName => _translation('wizardStoreName');
  String get wizardStoreNameSubtitle => _translation('wizardStoreNameSubtitle');
  String get wizardEnterStoreName => _translation('wizardEnterStoreName');
  String get wizardSubdomain => _translation('wizardSubdomain');
  String get wizardSubdomainSubtitle => _translation('wizardSubdomainSubtitle');
  String get wizardTheme => _translation('wizardTheme');
  String get wizardThemeSubtitle => _translation('wizardThemeSubtitle');

  // Common Wizard Buttons
  String get back => _translation('back');
  String get next => _translation('next');
  String get skipStep => _translation('skipStep');
  String get createStore => _translation('createStore');

  // Sales Channels
  String get onlineStore => _translation('onlineStore');
  String get retailStore => _translation('retailStore');
  String get socialMedia => _translation('socialMedia');
  String get marketplaces => _translation('marketplaces');
  String get eventsPopups => _translation('eventsPopups');

  // Product Types
  String get physicalProducts => _translation('physicalProducts');
  String get physicalProductsSubtitle =>
      _translation('physicalProductsSubtitle');
  String get digitalProducts => _translation('digitalProducts');
  String get digitalProductsSubtitle => _translation('digitalProductsSubtitle');
  String get dropshipping => _translation('dropshipping');
  String get dropshippingSubtitle => _translation('dropshippingSubtitle');
  String get services => _translation('services');
  String get servicesSubtitle => _translation('servicesSubtitle');
  String get printOnDemand => _translation('printOnDemand');
  String get printOnDemandSubtitle => _translation('printOnDemandSubtitle');
  String get decideLater => _translation('decideLater');
  String get decideLaterSubtitle => _translation('decideLaterSubtitle');

  // Categories
  String get fashionApparel => _translation('fashionApparel');
  String get electronics => _translation('electronics');
  String get beautyCosmetics => _translation('beautyCosmetics');
  String get homeDecor => _translation('homeDecor');
  String get foodBeverages => _translation('foodBeverages');
  String get sportsFitness => _translation('sportsFitness');
  String get booksStationery => _translation('booksStationery');
  String get other => _translation('other');

  // Subdomain Status
  String get checkingAvailability => _translation('checkingAvailability');
  String get subdomainAvailable => _translation('subdomainAvailable');
  String get subdomainTaken => _translation('subdomainTaken');

  // Logout Dialog
  String get logoutTitle => _translation('logoutTitle');
  String get logoutMessage => _translation('logoutMessage');
  String get cancel => _translation('cancel');
  String get logout => _translation('logout');

  String _translation(String key) {
    final values = _translations[key]!;
    return values[languageCode] ?? values['en']!;
  }

  static const Map<String, Map<String, String>> _translations = {
    'getStarted': {
      'en': 'Get Started',
      'ta': 'தொடங்குங்கள்',
      'hi': 'शुरू करें',
    },
    'signInOrCreateStore': {
      'en': 'Sign in or create your online store',
      'ta': 'உள்நுழையவும் அல்லது உங்கள் ஆன்லைன் கடையை உருவாக்கவும்',
      'hi': 'साइन इन करें या अपना ऑनलाइन स्टोर बनाएं',
    },
    'setYourPassword': {
      'en': 'Set Your Password',
      'ta': 'உங்கள் கடவுச்சொல்லை அமைக்கவும்',
      'hi': 'अपना पासवर्ड सेट करें',
    },
    'createPasswordToSecure': {
      'en': 'Create a password to secure your account',
      'ta': 'உங்கள் கணக்கை பாதுகாக்க கடவுச்சொல்லை உருவாக்கவும்',
      'hi': 'अपने खाते को सुरक्षित करने के लिए पासवर्ड बनाएं',
    },
    'continueWithGoogle': {
      'en': 'Continue with Google',
      'ta': 'Google உடன் தொடரவும்',
      'hi': 'Google के साथ जारी रखें',
    },
    'or': {'en': 'or', 'ta': 'அல்லது', 'hi': 'या'},
    'emailAddress': {
      'en': 'Email Address',
      'ta': 'மின்னஞ்சல் முகவரி',
      'hi': 'ईमेल पता',
    },
    'password': {'en': 'Password', 'ta': 'கடவுச்சொல்', 'hi': 'पासवर्ड'},
    'confirmPassword': {
      'en': 'Confirm Password',
      'ta': 'கடவுச்சொல்லை உறுதிப்படுத்து',
      'hi': 'पासवर्ड की पुष्टि करें',
    },
    'login': {'en': 'Login', 'ta': 'உள்நுழை', 'hi': 'लॉगिन'},
    'signUp': {'en': 'Sign Up', 'ta': 'பதிவு செய்', 'hi': 'साइन अप'},
    'forgotPassword': {
      'en': 'Forgot your password?',
      'ta': 'கடவுச்சொல் மறந்துவிட்டதா?',
      'hi': 'पासवर्ड भूल गए?',
    },
    'resetPassword': {
      'en': 'Reset password',
      'ta': 'கடவுச்சொல் மீட்டமை',
      'hi': 'पासवर्ड रीसेट करें',
    },
    'alreadyHaveAccount': {
      'en': 'Already have an account?',
      'ta': 'ஏற்கனவே கணக்கு உள்ளதா?',
      'hi': 'पहले से खाता है?',
    },
    'dontHaveAccount': {
      'en': "Don't have an account?",
      'ta': 'கணக்கு இல்லையா?',
      'hi': 'कोई खाता नहीं है?',
    },
    'areYouLetBuyySeller': {
      'en': 'Are you a ',
      'ta': 'நீங்கள் ',
      'hi': 'क्या आप ',
    },
    'letBuyySeller': {
      'en': 'LetBuyy seller',
      'ta': 'LetBuyy விற்பனையாளர்',
      'hi': 'LetBuyy विक्रेता',
    },
    'emailRequired': {
      'en': 'Email is required',
      'ta': 'மின்னஞ்சல் தேவை',
      'hi': 'ईमेल आवश्यक है',
    },
    'validEmail': {
      'en': 'Enter a valid email',
      'ta': 'சரியான மின்னஞ்சலை உள்ளிடவும்',
      'hi': 'मान्य ईमेल दर्ज करें',
    },
    'passwordRequired': {
      'en': 'Password is required',
      'ta': 'கடவுச்சொல் தேவை',
      'hi': 'पासवर्ड आवश्यक है',
    },
    'passwordMinLength': {
      'en': 'Password must be at least 8 characters',
      'ta': 'கடவுச்சொல் குறைந்தது 8 எழுத்துக்கள் இருக்க வேண்டும்',
      'hi': 'पासवर्ड कम से कम 8 अक्षर का होना चाहिए',
    },
    'passwordNeedsLetter': {
      'en': 'Password must contain at least one letter',
      'ta': 'கடவுச்சொல்லில் குறைந்தது ஒரு எழுத்து இருக்க வேண்டும்',
      'hi': 'पासवर्ड में कम से कम एक अक्षर होना चाहिए',
    },
    'passwordNeedsNumber': {
      'en': 'Password must contain at least one number',
      'ta': 'கடவுச்சொல்லில் குறைந்தது ஒரு எண் இருக்க வேண்டும்',
      'hi': 'पासवर्ड में कम से कम एक नंबर होना चाहिए',
    },
    'confirmPasswordRequired': {
      'en': 'Confirm password is required',
      'ta': 'கடவுச்சொல் உறுதிப்படுத்துதல் தேவை',
      'hi': 'पासवर्ड की पुष्टि आवश्यक है',
    },
    'passwordsDoNotMatch': {
      'en': 'Passwords do not match',
      'ta': 'கடவுச்சொற்கள் பொருந்தவில்லை',
      'hi': 'पासवर्ड मेल नहीं खाते',
    },
    'continueBtn': {'en': 'Continue', 'ta': 'தொடர்க', 'hi': 'जारी रखें'},
    'setPassword': {
      'en': 'Set Password',
      'ta': 'கடவுச்சொல் அமை',
      'hi': 'पासवर्ड सेट करें',
    },

    // ============ WIZARD TRANSLATIONS ============

    // Step Titles
    'wizardSetupStore': {
      'en': "Let's set up your store",
      'ta': 'உங்கள் கடையை அமைப்போம்',
      'hi': 'आइए आपका स्टोर सेट अप करें',
    },
    'wizardNewOrExisting': {
      'en': 'Is this for a new or existing business?',
      'ta': 'இது புதிய அல்லது ஏற்கனவே உள்ள வணிகத்திற்கா?',
      'hi': 'क्या यह नए या मौजूदा व्यवसाय के लिए है?',
    },
    'wizardNewBusiness': {
      'en': 'New business or idea',
      'ta': 'புதிய வணிகம் அல்லது யோசனை',
      'hi': 'नया व्यवसाय या विचार',
    },
    'wizardJustStarting': {
      'en': "I'm just starting out",
      'ta': 'நான் இப்போதுதான் தொடங்குகிறேன்',
      'hi': 'मैं अभी शुरू कर रहा हूं',
    },
    'wizardExistingBusiness': {
      'en': 'Existing business',
      'ta': 'ஏற்கனவே உள்ள வணிகம்',
      'hi': 'मौजूदा व्यवसाय',
    },
    'wizardAlreadyHaveBusiness': {
      'en': 'I already have a business',
      'ta': 'எனக்கு ஏற்கனவே ஒரு வணிகம் உள்ளது',
      'hi': 'मेरा पहले से व्यवसाय है',
    },
    'wizardWhereToSell': {
      'en': 'Where would you like to sell?',
      'ta': 'எங்கு விற்க விரும்புகிறீர்கள்?',
      'hi': 'आप कहाँ बेचना चाहेंगे?',
    },
    'wizardWhereToSellSubtitle': {
      'en': "We'll help you set up in these places",
      'ta': 'இந்த இடங்களில் அமைக்க உதவுவோம்',
      'hi': 'हम इन जगहों पर सेटअप में मदद करेंगे',
    },
    'wizardWhatToSell': {
      'en': 'What do you plan to sell?',
      'ta': 'என்ன விற்க திட்டமிடுகிறீர்கள்?',
      'hi': 'आप क्या बेचने की योजना बना रहे हैं?',
    },
    'wizardWhatToSellSubtitle': {
      'en': "We'll get you the right features and tools",
      'ta': 'சரியான அம்சங்களையும் கருவிகளையும் தருவோம்',
      'hi': 'हम आपको सही सुविधाएं और टूल्स देंगे',
    },
    'wizardCategory': {
      'en': 'What will you sell?',
      'ta': 'என்ன விற்பீர்கள்?',
      'hi': 'आप क्या बेचेंगे?',
    },
    'wizardCategorySubtitle': {
      'en': 'Choose the category that best describes your store',
      'ta': 'உங்கள் கடையை சிறந்த முறையில் விவரிக்கும் வகையை தேர்வு செய்க',
      'hi': 'वह श्रेणी चुनें जो आपके स्टोर का सबसे अच्छा वर्णन करती है',
    },
    'wizardStoreName': {
      'en': 'What should we call your store?',
      'ta': 'உங்கள் கடையை என்ன அழைக்க வேண்டும்?',
      'hi': 'हम आपके स्टोर को क्या बुलाएं?',
    },
    'wizardStoreNameSubtitle': {
      'en': 'You can change your store name anytime',
      'ta': 'எப்போது வேண்டுமானாலும் கடை பெயரை மாற்றலாம்',
      'hi': 'आप कभी भी स्टोर का नाम बदल सकते हैं',
    },
    'wizardEnterStoreName': {
      'en': 'Enter store name',
      'ta': 'கடை பெயரை உள்ளிடவும்',
      'hi': 'स्टोर का नाम दर्ज करें',
    },
    'wizardSubdomain': {
      'en': 'Choose your store URL',
      'ta': 'உங்கள் கடை URL ஐ தேர்வு செய்க',
      'hi': 'अपना स्टोर URL चुनें',
    },
    'wizardSubdomainSubtitle': {
      'en': 'This will be your store address',
      'ta': 'இது உங்கள் கடை முகவரியாக இருக்கும்',
      'hi': 'यह आपके स्टोर का पता होगा',
    },
    'wizardTheme': {
      'en': 'Choose your theme',
      'ta': 'உங்கள் தீம் தேர்வு செய்க',
      'hi': 'अपनी थीम चुनें',
    },
    'wizardThemeSubtitle': {
      'en': "Pick a look that matches your brand",
      'ta': 'உங்கள் பிராண்டுக்கு பொருத்தமான தோற்றத்தை தேர்வு செய்க',
      'hi': 'अपने ब्रांड से मेल खाता लुक चुनें',
    },

    // Common Wizard Buttons
    'back': {'en': '← Back', 'ta': '← பின்', 'hi': '← वापस'},
    'next': {'en': 'Next →', 'ta': 'அடுத்து →', 'hi': 'आगे →'},
    'skipStep': {
      'en': 'Skip this step →',
      'ta': 'இந்த படியை தவிர் →',
      'hi': 'इस चरण को छोड़ें →',
    },
    'createStore': {
      'en': 'Create Store',
      'ta': 'கடை உருவாக்கு',
      'hi': 'स्टोर बनाएं',
    },

    // Sales Channels
    'onlineStore': {
      'en': 'An online store',
      'ta': 'ஆன்லைன் கடை',
      'hi': 'ऑनलाइन स्टोर',
    },
    'retailStore': {
      'en': 'In person at retail store',
      'ta': 'சில்லறை கடையில் நேரில்',
      'hi': 'रिटेल स्टोर में व्यक्तिगत रूप से',
    },
    'socialMedia': {
      'en': 'Social media (WhatsApp, Instagram)',
      'ta': 'சமூக ஊடகம் (WhatsApp, Instagram)',
      'hi': 'सोशल मीडिया (WhatsApp, Instagram)',
    },
    'marketplaces': {
      'en': 'Online marketplaces',
      'ta': 'ஆன்லைன் சந்தைகள்',
      'hi': 'ऑनलाइन मार्केटप्लेस',
    },
    'eventsPopups': {
      'en': 'At events or pop-ups',
      'ta': 'நிகழ்வுகள் அல்லது பாப்-அப்களில்',
      'hi': 'इवेंट्स या पॉप-अप्स में',
    },

    // Product Types
    'physicalProducts': {
      'en': 'Products I buy or make myself',
      'ta': 'நான் வாங்கும் அல்லது தயாரிக்கும் பொருட்கள்',
      'hi': 'मैं जो प्रोडक्ट खरीदता या बनाता हूं',
    },
    'physicalProductsSubtitle': {
      'en': 'Products to ship',
      'ta': 'அனுப்ப வேண்டிய பொருட்கள்',
      'hi': 'शिप करने के लिए प्रोडक्ट',
    },
    'digitalProducts': {
      'en': 'Digital products',
      'ta': 'டிஜிட்டல் பொருட்கள்',
      'hi': 'डिजिटल प्रोडक्ट',
    },
    'digitalProductsSubtitle': {
      'en': 'Music, videos, ebooks, NFTs',
      'ta': 'இசை, வீடியோக்கள், மின்புத்தகங்கள், NFTக்கள்',
      'hi': 'म्यूजिक, वीडियो, ईबुक्स, NFTs',
    },
    'dropshipping': {
      'en': 'Dropshipping products',
      'ta': 'டிராப்ஷிப்பிங் பொருட்கள்',
      'hi': 'ड्रॉपशिपिंग प्रोडक्ट',
    },
    'dropshippingSubtitle': {
      'en': 'Shipped and packaged by a third party',
      'ta': 'மூன்றாம் தரப்பால் அனுப்பப்பட்டு பேக் செய்யப்படும்',
      'hi': 'थर्ड पार्टी द्वारा शिप और पैक किया गया',
    },
    'services': {'en': 'Services', 'ta': 'சேவைகள்', 'hi': 'सेवाएं'},
    'servicesSubtitle': {
      'en': 'Consulting, bookkeeping, lessons',
      'ta': 'ஆலோசனை, கணக்கு பராமரிப்பு, பாடங்கள்',
      'hi': 'कंसल्टिंग, बुककीपिंग, लेसन',
    },
    'printOnDemand': {
      'en': 'Print-on-demand products',
      'ta': 'பிரிண்ட்-ஆன்-டிமாண்ட் பொருட்கள்',
      'hi': 'प्रिंट-ऑन-डिमांड प्रोडक्ट',
    },
    'printOnDemandSubtitle': {
      'en': 'Products printed and shipped by a third party',
      'ta': 'மூன்றாம் தரப்பால் அச்சிட்டு அனுப்பப்படும் பொருட்கள்',
      'hi': 'थर्ड पार्टी द्वारा प्रिंट और शिप किए गए प्रोडक्ट',
    },
    'decideLater': {
      'en': "I'll decide later",
      'ta': 'பின்னர் முடிவு செய்வேன்',
      'hi': 'बाद में तय करूंगा',
    },
    'decideLaterSubtitle': {
      'en': 'Skip for now',
      'ta': 'இப்போது தவிர்',
      'hi': 'अभी के लिए छोड़ें',
    },

    // Categories
    'fashionApparel': {
      'en': 'Fashion & Apparel',
      'ta': 'ஃபேஷன் & ஆடை',
      'hi': 'फैशन और अपैरल',
    },
    'electronics': {
      'en': 'Electronics',
      'ta': 'மின்னணு சாதனங்கள்',
      'hi': 'इलेक्ट्रॉनिक्स',
    },
    'beautyCosmetics': {
      'en': 'Beauty & Cosmetics',
      'ta': 'அழகு & அழகு சாதனங்கள்',
      'hi': 'ब्यूटी और कॉस्मेटिक्स',
    },
    'homeDecor': {
      'en': 'Home & Decor',
      'ta': 'வீடு & அலங்காரம்',
      'hi': 'होम और डेकोर',
    },
    'foodBeverages': {
      'en': 'Food & Beverages',
      'ta': 'உணவு & பானங்கள்',
      'hi': 'फूड और बेवरेज',
    },
    'sportsFitness': {
      'en': 'Sports & Fitness',
      'ta': 'விளையாட்டு & உடற்பயிற்சி',
      'hi': 'स्पोर्ट्स और फिटनेस',
    },
    'booksStationery': {
      'en': 'Books & Stationery',
      'ta': 'புத்தகங்கள் & எழுது பொருட்கள்',
      'hi': 'किताबें और स्टेशनरी',
    },
    'other': {'en': 'Other', 'ta': 'மற்றவை', 'hi': 'अन्य'},

    // Subdomain Status
    'checkingAvailability': {
      'en': 'Checking availability...',
      'ta': 'கிடைக்கும்படி சரிபார்க்கிறது...',
      'hi': 'उपलब्धता जांच रहा है...',
    },
    'subdomainAvailable': {
      'en': 'Great! This URL is available',
      'ta': 'அருமை! இந்த URL கிடைக்கும்',
      'hi': 'बढ़िया! यह URL उपलब्ध है',
    },
    'subdomainTaken': {
      'en': 'This URL is already taken',
      'ta': 'இந்த URL ஏற்கனவே எடுக்கப்பட்டுள்ளது',
      'hi': 'यह URL पहले से लिया गया है',
    },

    // Logout Dialog
    'logoutTitle': {'en': 'Logout?', 'ta': 'வெளியேறவா?', 'hi': 'लॉग आउट करें?'},
    'logoutMessage': {
      'en': 'Are you sure you want to logout?',
      'ta': 'நிச்சயமாக வெளியேற விரும்புகிறீர்களா?',
      'hi': 'क्या आप वाकई लॉग आउट करना चाहते हैं?',
    },
    'cancel': {'en': 'Cancel', 'ta': 'ரத்து செய்', 'hi': 'रद्द करें'},
    'logout': {'en': 'Logout', 'ta': 'வெளியேறு', 'hi': 'लॉग आउट'},
  };
}
