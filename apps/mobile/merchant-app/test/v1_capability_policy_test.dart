import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_store/app/routes.dart';
import 'package:letbuyy_store/config/v1_capability_policy.dart';
import 'package:letbuyy_store/screens/apps/apps_screen.dart';
import 'package:letbuyy_store/widgets/shared/capability_gate.dart';

/// Scenario 19 ("deep links cannot bypass capability gates") and scenario 20
/// ("excluded V1 features are not reachable") from the launch-readiness
/// package. Both are asserted against `AppRoutes.generateRoute`, because that
/// is the layer a deep link actually goes through — a test that only checked
/// the navigation lists would pass while the alias routes stayed open.
void main() {
  Widget pageFor(String path) {
    final route =
        AppRoutes.generateRoute(RouteSettings(name: path)) as MaterialPageRoute;
    return route.builder(_FakeContext());
  }

  group('V1 capability policy', () {
    test('the app marketplace is closed on every route that reaches it', () {
      // AppsScreen is registered under three separate paths. Gating one of them
      // would leave the other two live.
      for (final id in [
        AppRouteId.apps,
        AppRouteId.featureAppMarketplace,
        AppRouteId.featureEmbeddedAppBridge,
      ]) {
        expect(
          V1CapabilityPolicy.isGated(id),
          isTrue,
          reason: '$id must be gated — ART-22 / NEVER-R3',
        );
        expect(
          V1CapabilityPolicy.isForbidden(id),
          isTrue,
          reason: '$id is constitutionally forbidden, not merely deferred',
        );
      }
    });

    test('deferred capabilities are gated but not marked forbidden', () {
      for (final id in [
        AppRouteId.giftCards,
        AppRouteId.featureGiftCards,
        AppRouteId.connectRazorpay,
        AppRouteId.staff,
      ]) {
        expect(V1CapabilityPolicy.isGated(id), isTrue, reason: '$id');
        expect(
          V1CapabilityPolicy.isForbidden(id),
          isFalse,
          reason: '$id is deferred work, not a constitutional prohibition',
        );
      }
    });

    test('in-scope V1 capabilities are untouched', () {
      for (final id in [
        AppRouteId.products,
        AppRouteId.orders,
        AppRouteId.inventory,
        AppRouteId.customers,
        AppRouteId.analytics,
        AppRouteId.taxes,
      ]) {
        expect(
          V1CapabilityPolicy.availabilityFor(id),
          FeatureAvailability.available,
          reason: '$id is inside the frozen V1 scope and must not be gated',
        );
      }
    });

    test('an unlisted route defaults to available', () {
      // Adding a screen must never silently gate it.
      expect(
        V1CapabilityPolicy.availabilityFor(AppRouteId.help),
        FeatureAvailability.available,
      );
    });

    test('every gated capability explains itself to the merchant', () {
      for (final id in AppRouteId.values.where(V1CapabilityPolicy.isGated)) {
        expect(V1CapabilityPolicy.titleFor(id), isNotNull, reason: '$id');
        expect(
          V1CapabilityPolicy.descriptionFor(id),
          isNotNull,
          reason: '$id must say why, not just refuse',
        );
        expect(V1CapabilityPolicy.titleFor(id), isNotEmpty, reason: '$id');
      }
    });
  });

  group('route resolution enforces the policy', () {
    test('a deep link to a forbidden path never builds the real screen', () {
      for (final path in const [
        '/apps',
        '/features/app-marketplace',
        '/features/embedded-app-bridge',
      ]) {
        final page = pageFor(path);
        expect(
          buildsAppsScreen(page),
          isFalse,
          reason: '$path must not construct AppsScreen',
        );
      }
    });

    test('a gated route resolves to a CapabilityGate', () {
      final page = pageFor('/apps') as Scaffold;
      expect(page.body, isA<CapabilityGate>());
    });

    test('an in-scope route still builds its real screen', () {
      final page = pageFor(AppRoutes.products);
      expect(
        page,
        isNot(
          isA<Scaffold>().having((s) => s.body, 'body', isA<CapabilityGate>()),
        ),
      );
    });
  });
}

bool buildsAppsScreen(Widget page) {
  if (page is AppsScreen) return true;
  if (page is Scaffold) return page.body is AppsScreen;
  return false;
}

class _FakeContext extends StatelessElement {
  _FakeContext() : super(const _Nothing());
}

class _Nothing extends StatelessWidget {
  const _Nothing();
  @override
  Widget build(BuildContext context) => const SizedBox.shrink();
}
