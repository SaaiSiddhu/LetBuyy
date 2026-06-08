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
  static const features = <PlatformBlockedFeature>[];

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
    throw SkipNeedsBackendException(feature.id, feature.missingContract);
  }
}
