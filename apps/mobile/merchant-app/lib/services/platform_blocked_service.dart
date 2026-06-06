import 'package:flutter/foundation.dart';

import 'skip_needs_backend_exception.dart';

class PlatformBlockedFeature {
  const PlatformBlockedFeature({
    required this.id,
    required this.route,
    required this.title,
    required this.summary,
    required this.flagKey,
    required this.missingContract,
    required this.ledgerId,
  });

  final String id;
  final String route;
  final String title;
  final String summary;
  final String flagKey;
  final String missingContract;
  final String ledgerId;
}

class PlatformBlockedService extends ChangeNotifier {
  static const features = [
    PlatformBlockedFeature(
      id: 'MOBILE_PAYOUTS_SETTLEMENT',
      route: '/features/payouts-settlement',
      title: 'Payouts & Settlement',
      summary: 'Settlement batches, provider payout status, UTRs, and exports.',
      flagKey: 'mobile.payoutsSettlement',
      missingContract:
          'Gateway has no tenant-safe merchant payout, settlement, or UTR contract.',
      ledgerId: 'S-018',
    ),
    PlatformBlockedFeature(
      id: 'MOBILE_WALLET',
      route: '/features/wallet',
      title: 'Wallet',
      summary: 'Merchant wallet balance, credits, debits, holds, and top-ups.',
      flagKey: 'mobile.wallet',
      missingContract:
          'Gateway has no merchant wallet ledger or balance contract.',
      ledgerId: 'S-019',
    ),
    PlatformBlockedFeature(
      id: 'MOBILE_COMMISSION',
      route: '/features/commission',
      title: 'Commission',
      summary: 'Commission rules, order-level fees, and reconciliation.',
      flagKey: 'mobile.commission',
      missingContract:
          'Gateway has no merchant-facing commission schedule or reconciliation contract.',
      ledgerId: 'S-020',
    ),
    PlatformBlockedFeature(
      id: 'MOBILE_KYC',
      route: '/features/kyc',
      title: 'KYC',
      summary: 'Business verification, documents, bank proof, and approval.',
      flagKey: 'mobile.kyc',
      missingContract:
          'Gateway has no mobile-safe KYC document, verification, or provider status contract.',
      ledgerId: 'S-021',
    ),
    PlatformBlockedFeature(
      id: 'MOBILE_RETURNS',
      route: '/features/returns',
      title: 'Returns',
      summary: 'Return requests, RMAs, labels, inspections, and restocking.',
      flagKey: 'mobile.returns',
      missingContract: 'Gateway has no merchant return/RMA lifecycle contract.',
      ledgerId: 'S-022',
    ),
    PlatformBlockedFeature(
      id: 'MOBILE_TWO_FACTOR',
      route: '/features/two-factor',
      title: 'Two-factor Authentication',
      summary: 'TOTP setup, recovery codes, enforced roles, and sessions.',
      flagKey: 'mobile.twoFactor',
      missingContract:
          'Gateway has no merchant 2FA/passkey/session inventory contract for mobile.',
      ledgerId: 'S-023',
    ),
    PlatformBlockedFeature(
      id: 'MOBILE_BUSINESS_DETAILS',
      route: '/features/business-details',
      title: 'Business Details',
      summary: 'Legal entity, GSTIN, invoice profile, and billing address.',
      flagKey: 'mobile.businessDetails',
      missingContract:
          'Store PATCH does not expose a full business profile and invoice-address contract.',
      ledgerId: 'S-024',
    ),
    PlatformBlockedFeature(
      id: 'MOBILE_LOCALIZATION_MARKETS',
      route: '/features/localization-markets',
      title: 'Localization & Markets',
      summary: 'Markets, locales, currencies, and storefront translations.',
      flagKey: 'mobile.localizationMarkets',
      missingContract:
          'Gateway has no storefront markets, locale publishing, or translation contract.',
      ledgerId: 'S-025',
    ),
    PlatformBlockedFeature(
      id: 'MOBILE_CUSTOM_DATA',
      route: '/features/custom-data',
      title: 'Custom Data',
      summary: 'Metafields, definitions, namespaces, and validation rules.',
      flagKey: 'mobile.customData',
      missingContract:
          'Gateway has no merchant-safe metafield definition/value contract.',
      ledgerId: 'S-026',
    ),
    PlatformBlockedFeature(
      id: 'MOBILE_EMBEDDED_APP_BRIDGE_RUNTIME',
      route: '/features/embedded-app-bridge',
      title: 'Embedded App Bridge Runtime',
      summary: 'Native app-extension host, signed sessions, and UI rendering.',
      flagKey: 'mobile.embeddedAppBridgeRuntime',
      missingContract:
          'Mobile App Bridge runtime needs a signed native extension-host contract.',
      ledgerId: 'S-027',
    ),
  ];

  static PlatformBlockedFeature? featureForRoute(String? route) {
    if (route == null) return null;
    return _featureBy((feature) => feature.route == route);
  }

  static PlatformBlockedFeature? featureForId(String id) {
    return _featureBy((feature) => feature.id == id);
  }

  static PlatformBlockedFeature? _featureBy(
    bool Function(PlatformBlockedFeature feature) predicate,
  ) {
    for (final feature in features) {
      if (predicate(feature)) return feature;
    }
    return null;
  }

  Future<void> requireBackend(PlatformBlockedFeature feature) async {
    switch (feature.id) {
      case 'MOBILE_PAYOUTS_SETTLEMENT':
        // [SKIP-NEEDS-BACKEND: MOBILE_PAYOUTS_SETTLEMENT]
        throw SkipNeedsBackendException(feature.id, feature.missingContract);
      case 'MOBILE_WALLET':
        // [SKIP-NEEDS-BACKEND: MOBILE_WALLET]
        throw SkipNeedsBackendException(feature.id, feature.missingContract);
      case 'MOBILE_COMMISSION':
        // [SKIP-NEEDS-BACKEND: MOBILE_COMMISSION]
        throw SkipNeedsBackendException(feature.id, feature.missingContract);
      case 'MOBILE_KYC':
        // [SKIP-NEEDS-BACKEND: MOBILE_KYC]
        throw SkipNeedsBackendException(feature.id, feature.missingContract);
      case 'MOBILE_RETURNS':
        // [SKIP-NEEDS-BACKEND: MOBILE_RETURNS]
        throw SkipNeedsBackendException(feature.id, feature.missingContract);
      case 'MOBILE_TWO_FACTOR':
        // [SKIP-NEEDS-BACKEND: MOBILE_TWO_FACTOR]
        throw SkipNeedsBackendException(feature.id, feature.missingContract);
      case 'MOBILE_BUSINESS_DETAILS':
        // [SKIP-NEEDS-BACKEND: MOBILE_BUSINESS_DETAILS]
        throw SkipNeedsBackendException(feature.id, feature.missingContract);
      case 'MOBILE_LOCALIZATION_MARKETS':
        // [SKIP-NEEDS-BACKEND: MOBILE_LOCALIZATION_MARKETS]
        throw SkipNeedsBackendException(feature.id, feature.missingContract);
      case 'MOBILE_CUSTOM_DATA':
        // [SKIP-NEEDS-BACKEND: MOBILE_CUSTOM_DATA]
        throw SkipNeedsBackendException(feature.id, feature.missingContract);
      case 'MOBILE_EMBEDDED_APP_BRIDGE_RUNTIME':
        // [SKIP-NEEDS-BACKEND: MOBILE_EMBEDDED_APP_BRIDGE_RUNTIME]
        throw SkipNeedsBackendException(feature.id, feature.missingContract);
      default:
        throw SkipNeedsBackendException(feature.id, feature.missingContract);
    }
  }
}
