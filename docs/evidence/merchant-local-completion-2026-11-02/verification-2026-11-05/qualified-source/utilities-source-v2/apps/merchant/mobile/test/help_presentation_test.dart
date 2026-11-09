// Native launcher transport is mocked. These tests never send email or open URLs.
import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_store/screens/settings/help_screen.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'supporting_presentation_test.dart' as s;

const channel = MethodChannel('plugins.flutter.io/url_launcher');
const email = 'mailto:support@letbuyy.com?subject=LetBuyy Store Support';

void main() {
  WidgetController.hitTestWarningShouldBeFatal = true;
  setUpAll(initializeLetbuyyTypography);

  void launcher(Future<Object?> Function(MethodCall call) handle) {
    final messenger =
        TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger;
    messenger.setMockMethodCallHandler(channel, handle);
    addTearDown(() => messenger.setMockMethodCallHandler(channel, null));
  }

  for (final failure in ['unsupported', 'false', 'throw']) {
    testWidgets('Help gives truthful native launch feedback: $failure', (
      tester,
    ) async {
      var checks = 0, launches = 0;
      launcher((call) async {
        if (call.method == 'canLaunch') {
          checks++;
          return failure != 'unsupported';
        }
        expect(call.method, 'launch');
        launches++;
        if (failure == 'throw')
          throw PlatformException(
            code: 'SYNTHETIC_FAILURE',
            message: 'Private plugin diagnostic',
          );
        return false;
      });
      await s.mount(tester, s.HealthTransport(), child: const HelpScreen());
      await tester.tap(s.button('Email support'));
      await tester.pumpAndSettle();
      expect(checks, 1);
      expect(launches, failure == 'unsupported' ? 0 : 1);
      expect(find.textContaining('Could not open'), findsOneWidget);
      expect(find.textContaining('Private plugin diagnostic'), findsNothing);
      expect(tester.takeException(), isNull);
    });
  }

  for (final disposed in [false, true]) {
    testWidgets(
      'old Help action is inert after retirement disposed=$disposed',
      (tester) async {
        var calls = 0;
        launcher((call) async {
          calls++;
          return false;
        });
        final owner = await s.mount(
          tester,
          s.HealthTransport(),
          child: const HelpScreen(),
        );
        final old = tester
            .widget<ButtonStyleButton>(s.button('Email support'))
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
      },
    );
  }

  testWidgets('Help does not duplicate a native support-app launch', (
    tester,
  ) async {
    final held = Completer<bool>();
    addTearDown(() {
      if (!held.isCompleted) held.complete(false);
    });
    var checks = 0, launches = 0;
    launcher((call) async {
      if (call.method == 'canLaunch') {
        checks++;
        return held.future;
      }
      launches++;
      return true;
    });
    await s.mount(tester, s.HealthTransport(), child: const HelpScreen());
    final callback = tester
        .widget<ButtonStyleButton>(s.button('Email support'))
        .onPressed!;
    callback();
    callback();
    await tester.pump();
    expect(checks, 1);
    held.complete(true);
    await tester.pumpAndSettle();
    expect(launches, 1);
    expect(tester.takeException(), isNull);
  });

  for (final disposed in [false, true]) {
    testWidgets(
      'held Help check cannot launch after retirement disposed=$disposed',
      (tester) async {
        final held = Completer<bool>();
        addTearDown(() {
          if (!held.isCompleted) held.complete(false);
        });
        var checks = 0, launches = 0;
        launcher((call) async {
          if (call.method == 'canLaunch') {
            checks++;
            return held.future;
          }
          launches++;
          return true;
        });
        final owner = await s.mount(
          tester,
          s.HealthTransport(),
          child: const HelpScreen(),
        );
        await tester.tap(s.button('Email support'));
        await tester.pump();
        expect(checks, 1);
        if (disposed) {
          await tester.pumpWidget(
            const MaterialApp(home: Text('New destination')),
          );
        } else {
          await s.cover(tester, owner.navigator);
        }
        held.complete(true);
        await tester.pumpAndSettle();
        expect(launches, 0);
        expect(find.textContaining('Could not open'), findsNothing);
        expect(tester.takeException(), isNull);
      },
    );
  }

  testWidgets('Help retires a held check across a cover round trip', (
    tester,
  ) async {
    final held = Completer<bool>();
    addTearDown(() {
      if (!held.isCompleted) held.complete(false);
    });
    var checks = 0, launches = 0;
    launcher((call) async {
      if (call.method == 'canLaunch') {
        checks++;
        return held.future;
      }
      launches++;
      return true;
    });
    final owner = await s.mount(
      tester,
      s.HealthTransport(),
      child: const HelpScreen(),
    );
    await tester.tap(s.button('Email support'));
    await tester.pump();
    expect(checks, 1);
    await s.cover(tester, owner.navigator);
    owner.navigator.currentState!.pop();
    await tester.pumpAndSettle();
    held.complete(true);
    await tester.pumpAndSettle();
    expect(launches, 0);
    expect(tester.takeException(), isNull);
  });

  testWidgets(
    'email and documentation keep their original URI and launch mode',
    (tester) async {
      final launches = <Map<Object?, Object?>>[];
      launcher((call) async {
        if (call.method == 'launch')
          launches.add(Map<Object?, Object?>.from(call.arguments as Map));
        return true;
      });
      await s.mount(tester, s.HealthTransport(), child: const HelpScreen());
      await tester.tap(s.button('Email support'));
      await tester.pumpAndSettle();
      expect(launches, hasLength(1));
      expect(launches[0]['url'], Uri.parse(email).toString());
      final link = find.text('Documentation');
      await tester.scrollUntilVisible(
        link,
        160,
        scrollable: find
            .byWidgetPredicate(
              (w) => w is Scrollable && w.axisDirection == AxisDirection.down,
            )
            .last,
      );
      await tester.tap(link);
      await tester.pumpAndSettle();
      expect(launches, hasLength(2));
      expect(launches[1]['url'], 'https://docs.letbuyy.com');
      expect(launches[1]['useSafariVC'], isFalse);
      expect(launches[1]['useWebView'], isFalse);
      expect(tester.takeException(), isNull);
    },
  );

  for (final dark in [false, true]) {
    testWidgets('Help actions remain readable at320dp scale2.4 dark=$dark', (
      tester,
    ) async {
      await s.mount(
        tester,
        s.HealthTransport(),
        dark: dark,
        size: const Size(320, 620),
        scale: 2.4,
        child: const HelpScreen(),
      );
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
      await tester.ensureVisible(s.button('Email support'));
      expect(s.button('Email support'), findsOneWidget);
      expect(find.textContaining('within seconds'), findsNothing);
    });
  }
}
