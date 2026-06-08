import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';

class AppLocalizations {
  const AppLocalizations(this.locale);

  final Locale locale;

  static const supportedLocales = [
    Locale('en'),
    Locale('hi'),
    Locale('ta'),
    Locale('bn'),
    Locale('kn'),
    Locale('mr'),
    Locale('te'),
  ];

  static const LocalizationsDelegate<AppLocalizations> delegate =
      _AppLocalizationsDelegate();

  static AppLocalizations of(BuildContext context) {
    return Localizations.of<AppLocalizations>(context, AppLocalizations) ??
        const AppLocalizations(Locale('en'));
  }

  String get appTitle => _value('appTitle');
  String get selectStore => _value('selectStore');
  String get switchStore => _value('switchStore');
  String get storeSwitcherLabel => _value('storeSwitcherLabel');
  String get noStoreSelected => _value('noStoreSelected');
  String get offlineMode => _value('offlineMode');
  String get cachedDataNotice => _value('cachedDataNotice');
  String get deepLinkUnsupported => _value('deepLinkUnsupported');

  String _value(String key) {
    final languageCode = locale.languageCode;
    return _localizedValues[languageCode]?[key] ??
        _localizedValues['en']![key]!;
  }
}

class _AppLocalizationsDelegate
    extends LocalizationsDelegate<AppLocalizations> {
  const _AppLocalizationsDelegate();

  @override
  bool isSupported(Locale locale) {
    return AppLocalizations.supportedLocales.any(
      (supported) => supported.languageCode == locale.languageCode,
    );
  }

  @override
  Future<AppLocalizations> load(Locale locale) {
    return SynchronousFuture<AppLocalizations>(AppLocalizations(locale));
  }

  @override
  bool shouldReload(_AppLocalizationsDelegate old) => false;
}

const _localizedValues = {
  'en': {
    'appTitle': 'LetBuyy Store Builder',
    'selectStore': 'Select store',
    'switchStore': 'Switch store',
    'storeSwitcherLabel': 'Selected store switcher',
    'noStoreSelected': 'No store selected',
    'offlineMode': 'Offline mode',
    'cachedDataNotice': 'Showing cached data while the network is unavailable.',
    'deepLinkUnsupported': 'This link is not supported on mobile yet.',
  },
  'hi': {
    'appTitle': 'LetBuyy स्टोर बिल्डर',
    'selectStore': 'स्टोर चुनें',
    'switchStore': 'स्टोर बदलें',
    'storeSwitcherLabel': 'चयनित स्टोर स्विचर',
    'noStoreSelected': 'कोई स्टोर चयनित नहीं',
    'offlineMode': 'ऑफलाइन मोड',
    'cachedDataNotice': 'नेटवर्क उपलब्ध नहीं है, कैश डेटा दिखाया जा रहा है।',
    'deepLinkUnsupported': 'यह लिंक अभी मोबाइल पर समर्थित नहीं है।',
  },
  'ta': {
    'appTitle': 'LetBuyy கடை பில்டர்',
    'selectStore': 'கடையை தேர்வு செய்',
    'switchStore': 'கடையை மாற்று',
    'storeSwitcherLabel': 'தேர்ந்தெடுத்த கடை மாற்றி',
    'noStoreSelected': 'கடை தேர்வு செய்யப்படவில்லை',
    'offlineMode': 'ஆஃப்லைன் முறை',
    'cachedDataNotice': 'நெட்வொர்க் இல்லை, கேஷ் தரவு காட்டப்படுகிறது.',
    'deepLinkUnsupported': 'இந்த இணைப்பு இன்னும் மொபைலில் ஆதரிக்கப்படவில்லை.',
  },
  'bn': {
    'appTitle': 'LetBuyy স্টোর বিল্ডার',
    'selectStore': 'স্টোর নির্বাচন করুন',
    'switchStore': 'স্টোর বদলান',
    'storeSwitcherLabel': 'নির্বাচিত স্টোর সুইচার',
    'noStoreSelected': 'কোনো স্টোর নির্বাচিত নেই',
    'offlineMode': 'অফলাইন মোড',
    'cachedDataNotice': 'নেটওয়ার্ক নেই, ক্যাশ ডেটা দেখানো হচ্ছে।',
    'deepLinkUnsupported': 'এই লিঙ্কটি এখনও মোবাইলে সমর্থিত নয়।',
  },
  'kn': {
    'appTitle': 'LetBuyy ಅಂಗಡಿ ಬಿಲ್ಡರ್',
    'selectStore': 'ಅಂಗಡಿ ಆಯ್ಕೆಮಾಡಿ',
    'switchStore': 'ಅಂಗಡಿ ಬದಲಿಸಿ',
    'storeSwitcherLabel': 'ಆಯ್ದ ಅಂಗಡಿ ಸ್ವಿಚರ್',
    'noStoreSelected': 'ಯಾವುದೇ ಅಂಗಡಿ ಆಯ್ಕೆಯಾಗಿಲ್ಲ',
    'offlineMode': 'ಆಫ್‌ಲೈನ್ ಮೋಡ್',
    'cachedDataNotice': 'ನೆಟ್‌ವರ್ಕ್ ಇಲ್ಲ, ಕ್ಯಾಶ್ ಡೇಟಾ ತೋರಿಸಲಾಗುತ್ತಿದೆ.',
    'deepLinkUnsupported': 'ಈ ಲಿಂಕ್ ಇನ್ನೂ ಮೊಬೈಲ್‌ನಲ್ಲಿ ಬೆಂಬಲಿತವಾಗಿಲ್ಲ.',
  },
  'mr': {
    'appTitle': 'LetBuyy स्टोअर बिल्डर',
    'selectStore': 'स्टोअर निवडा',
    'switchStore': 'स्टोअर बदला',
    'storeSwitcherLabel': 'निवडलेला स्टोअर स्विचर',
    'noStoreSelected': 'कोणतेही स्टोअर निवडलेले नाही',
    'offlineMode': 'ऑफलाइन मोड',
    'cachedDataNotice': 'नेटवर्क उपलब्ध नाही, कॅशे डेटा दाखवला जात आहे.',
    'deepLinkUnsupported': 'ही लिंक अजून मोबाइलवर समर्थित नाही.',
  },
  'te': {
    'appTitle': 'LetBuyy స్టోర్ బిల్డర్',
    'selectStore': 'స్టోర్ ఎంచుకోండి',
    'switchStore': 'స్టోర్ మార్చండి',
    'storeSwitcherLabel': 'ఎంచుకున్న స్టోర్ స్విచర్',
    'noStoreSelected': 'స్టోర్ ఎంచుకోలేదు',
    'offlineMode': 'ఆఫ్‌లైన్ మోడ్',
    'cachedDataNotice': 'నెట్‌వర్క్ అందుబాటులో లేదు, క్యాష్ డేటా చూపబడుతోంది.',
    'deepLinkUnsupported': 'ఈ లింక్ ఇంకా మొబైల్‌లో మద్దతు లేదు.',
  },
};
