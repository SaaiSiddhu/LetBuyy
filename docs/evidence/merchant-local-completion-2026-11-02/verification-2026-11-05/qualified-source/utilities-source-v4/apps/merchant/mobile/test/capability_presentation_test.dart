// Actual unchanged availability/copy policy with readable, current-route presentation.
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_store/widgets/shared/capability_gate.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'supporting_presentation_test.dart' as s;

void main() {
  WidgetController.hitTestWarningShouldBeFatal = true;
  setUpAll(initializeLetbuyyTypography);
  testWidgets('available gate retains the supplied child identity', (
    tester,
  ) async {
    const child = Text('Existing available content');
    await s.mount(
      tester,
      s.HealthTransport(),
      child: const Scaffold(
        body: CapabilityGate(
          availability: FeatureAvailability.available,
          child: child,
        ),
      ),
    );
    expect(find.byWidget(child), findsOneWidget);
    expect(find.byType(FilledButton), findsNothing);
  });
  for (final disposed in [false, true]) {
    testWidgets('retired capability action is inert disposed=$disposed', (
      tester,
    ) async {
      var calls = 0;
      final owner = await s.mount(
        tester,
        s.HealthTransport(),
        child: Scaffold(
          body: CapabilityGate(
            availability: FeatureAvailability.providerSetupRequired,
            primaryActionLabel: 'Review supported setup',
            onPrimaryAction: () => calls++,
          ),
        ),
      );
      final old = tester
          .widget<ButtonStyleButton>(s.button('Review supported setup'))
          .onPressed!;
      if (disposed) {
        await tester.pumpWidget(
          const MaterialApp(home: Text('New destination')),
        );
      } else {
        await s.cover(tester, owner.navigator);
      }
      old();
      await tester.pumpAndSettle();
      expect(calls, 0);
      expect(tester.takeException(), isNull);
    });
  }
  for (final dark in [false, true]) {
    for (final state in FeatureAvailability.values.where(
      (v) => v != FeatureAvailability.available,
    )) {
      testWidgets(
        'unavailable state $state stays readable at320dp scale2.4 dark=$dark',
        (tester) async {
          var calls = 0;
          const title = 'Review the currently selected store configuration';
          const description =
              'This workflow needs the supported configuration before it can continue. '
              'Your existing saved records remain available through their current authorized destinations.';
          const action = 'Review the supported store setup';
          await s.mount(
            tester,
            s.HealthTransport(),
            dark: dark,
            size: const Size(320, 360),
            scale: 2.4,
            child: Scaffold(
              body: CapabilityGate(
                availability: state,
                title: title,
                description: description,
                primaryActionLabel: action,
                onPrimaryAction: () => calls++,
              ),
            ),
          );
          await tester.pumpAndSettle();
          expect(tester.takeException(), isNull);
          expect(find.text(title), findsOneWidget);
          expect(find.text(description), findsOneWidget);
          for (final element in find.byType(Text).evaluate()) {
            if (element.renderObject case final RenderParagraph text) {
              expect(text.didExceedMaxLines, isFalse);
            }
          }
          await tester.ensureVisible(s.button(action));
          await tester.tap(s.button(action));
          await tester.pumpAndSettle();
          expect(calls, 1);
          expect(tester.takeException(), isNull);
        },
      );
    }
  }
  testWidgets(
    'all existing internal-copy patterns retain their safe fallbacks',
    (tester) async {
      for (final copy in [
        'SKIP_NEEDS_HUMAN',
        'SKIP-NEEDS-BACKEND',
        'S-001',
        'needs backend',
        'backend contract',
        'PlatformBlocked',
      ]) {
        await s.mount(
          tester,
          s.HealthTransport(),
          child: Scaffold(
            body: CapabilityGate(
              availability: FeatureAvailability.providerSetupRequired,
              title: copy,
              description: copy,
              primaryActionLabel: copy,
              onPrimaryAction: () {},
            ),
          ),
        );
        expect(find.text(copy), findsNothing);
        expect(find.text('Feature setup required'), findsOneWidget);
        expect(
          find.text('This workflow is unavailable until setup is completed.'),
          findsOneWidget,
        );
        expect(s.button('Continue'), findsOneWidget);
        expect(tester.takeException(), isNull);
      }
    },
  );
}
