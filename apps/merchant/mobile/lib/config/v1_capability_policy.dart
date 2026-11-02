import '../app/routes.dart';
import '../widgets/shared/capability_gate.dart';

/// The single source of truth for which merchant capabilities are inside the
/// frozen V1 scope, and what an out-of-scope capability tells the merchant.
///
/// Why this exists as a policy rather than a set of edits to the navigation
/// lists: `AppRoutes` registers 91 routes, 36 of them `/features/*` aliases, and
/// 31 screens are reachable from two or three different paths — the app
/// marketplace from three. Hiding a navigation entry therefore hides nothing; a
/// deep link still resolves. The policy is consulted inside
/// `AppRoutes.generateRoute`, which is the one place every route — primary and
/// alias — has to pass through.
///
/// Scope authority:
/// `LAUNCH_READINESS_2026_06_12/MERCHANT_APP_V1_FEATURE_READINESS_2026_08_09/05_V1_SCOPE_FREEZE_AND_EXCLUSIONS.md`
///
/// Two different reasons appear below and they must not be conflated:
///
///  * `_forbidden` — capabilities the LetBuyy Constitution prohibits as live
///    capability (ART-16, ART-22, NEVER-R3, R-12: no third-party app
///    marketplace, and no third-party/extension code executing in a live path).
///    These are closed, not deferred. Reopening one is an ARB act at a named
///    business trigger, never an engineering decision.
///
///  * `_deferred` — capabilities that are simply not finished enough to ship,
///    and would mislead a merchant if presented as working. These come back
///    when the underlying work lands.
///
/// Nothing here deletes a screen. The code stays; the route refuses to present
/// it as a working feature.
class V1CapabilityPolicy {
  const V1CapabilityPolicy._();

  /// Constitutionally forbidden as live capability. Not a roadmap item.
  static const Map<AppRouteId, _GateCopy> _forbidden = {
    AppRouteId.apps: _GateCopy(
      title: 'App marketplace is not available',
      description:
          'LetBuyy does not run a third-party app marketplace. Everything your '
          'store needs is built in.',
    ),
    AppRouteId.featureAppMarketplace: _GateCopy(
      title: 'App marketplace is not available',
      description:
          'LetBuyy does not run a third-party app marketplace. Everything your '
          'store needs is built in.',
    ),
    AppRouteId.featureEmbeddedAppBridge: _GateCopy(
      title: 'Embedded apps are not available',
      description:
          'LetBuyy does not run third-party app code inside your store.',
    ),
  };

  /// Real capabilities that are not finished. Presenting them as working would
  /// be dishonest, so they are gated with the truth instead.
  static const Map<AppRouteId, _GateCopy> _deferred = {
    AppRouteId.giftCards: _GateCopy(
      title: 'Gift cards are not ready',
      description:
          'Gift cards are still being completed. Codes issued now could not be '
          'redeemed at checkout, so the feature stays closed until that works '
          'end to end.',
    ),
    AppRouteId.featureGiftCards: _GateCopy(
      title: 'Gift cards are not ready',
      description:
          'Gift cards are still being completed. Codes issued now could not be '
          'redeemed at checkout, so the feature stays closed until that works '
          'end to end.',
    ),
  };

  /// Capabilities that exist but are only usable on the desktop dashboard.
  static const Map<AppRouteId, _GateCopy> _desktopOnly = {};

  /// The availability of the capability behind [id].
  ///
  /// Defaults to [FeatureAvailability.available]: a route is in scope unless
  /// this policy says otherwise, so adding a screen never silently gates it.
  static FeatureAvailability availabilityFor(AppRouteId id) {
    final copy = _copyFor(id);
    return copy?.availability ?? FeatureAvailability.available;
  }

  /// True when [id] is outside the frozen V1 scope for any reason.
  static bool isGated(AppRouteId id) =>
      availabilityFor(id) != FeatureAvailability.available;

  /// True when [id] is constitutionally forbidden rather than merely deferred.
  /// Callers must not offer a "coming soon" affordance for these.
  static bool isForbidden(AppRouteId id) => _forbidden.containsKey(id);

  static String? titleFor(AppRouteId id) => _copyFor(id)?.title;

  static String? descriptionFor(AppRouteId id) => _copyFor(id)?.description;

  static _GateCopy? _copyFor(AppRouteId id) =>
      _forbidden[id] ?? _deferred[id] ?? _desktopOnly[id];
}

class _GateCopy {
  const _GateCopy({
    required this.title,
    required this.description,
    this.availability = FeatureAvailability.temporarilyUnavailable,
  });

  final String title;
  final String description;
  final FeatureAvailability availability;
}
