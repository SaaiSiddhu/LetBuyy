import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:image_picker/image_picker.dart';
import 'package:letbuyy_store/screens/auth/error_screen.dart';
import 'package:letbuyy_store/services/api_client.dart';
import 'package:letbuyy_store/widgets/shared/image_source_sheet.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'supporting_presentation_test.dart' as s;
import 'coupon_presentation_test.dart' as f;

Finder scroll() => find
    .byWidgetPredicate(
      (w) => w is Scrollable && w.axisDirection == AxisDirection.down,
    )
    .last;
Future<void> reveal(WidgetTester tester, Finder target) async {
  if (target.evaluate().isEmpty) {
    await tester.scrollUntilVisible(target, 120, scrollable: scroll());
  } else {
    await tester.ensureVisible(target);
  }
  await tester.pumpAndSettle();
}

void main() {
  setUpAll(initializeLetbuyyTypography);
  for (final score in [0, 49, 50, 84, 85, 100]) {
    testWidgets(
      'confirmed health score $score retains original normalization and label',
      (tester) async {
        final api = s.HealthTransport()
          ..healthReply = (_) async => s.health(score: score);
        await s.mount(tester, api);
        await tester.pumpAndSettle();
        expect(find.text('$score/100'), findsOneWidget);
        expect(
          find.text(
            score >= 85
                ? 'Ready'
                : score >= 50
                ? 'Needs attention'
                : 'Action needed',
          ),
          findsOneWidget,
        );
        expect(api.healthReads.single, '/stores/${f.site}/health');
      },
    );
  }
  for (final value in ['not-a-number', double.nan, double.infinity]) {
    testWidgets(
      'malformed health score is unavailable without a render crash value=$value',
      (tester) async {
        final api = s.HealthTransport()
          ..healthReply = (_) async => s.health(score: value);
        await s.mount(tester, api);
        await tester.pumpAndSettle();
        expect(find.text('Score unavailable'), findsOneWidget);
        expect(tester.takeException(), isNull);
      },
    );
  }
  for (final status in [401, 403, 503]) {
    testWidgets(
      'health refresh $status keeps only a permitted prior assessment',
      (tester) async {
        final api = s.HealthTransport();
        await s.mount(tester, api);
        await tester.pumpAndSettle();
        expect(find.text('Private A health'), findsOneWidget);
        api.healthReply = (_) async => throw ApiException(
          message: 'Synthetic failure',
          statusCode: status,
          code: 'SYNTHETIC',
        );
        await tester.tap(s.refresh());
        await tester.pumpAndSettle();
        expect(
          find.text('Private A health'),
          status == 503 ? findsOneWidget : findsNothing,
        );
        expect(
          find.textContaining('Showing the last confirmed assessment'),
          status == 503 ? findsOneWidget : findsNothing,
        );
        expect(tester.takeException(), isNull);
      },
    );
  }
  for (final disposed in [false, true]) {
    testWidgets(
      'old health refresh callback is inert after covered/disposed=$disposed',
      (tester) async {
        final api = s.HealthTransport(), owner = await s.mount(tester, api);
        final reads = api.healthReads.length;
        final callback = tester.widget<IconButton>(s.refresh()).onPressed!;
        if (disposed) {
          await tester.pumpWidget(
            const MaterialApp(home: Text('Other destination')),
          );
        } else {
          await s.cover(tester, owner.navigator);
        }
        callback();
        await tester.pumpAndSettle();
        expect(api.healthReads.length, reads);
        expect(tester.takeException(), isNull);
        expect(find.text('Store Health'), findsNothing);
      },
    );
  }
  testWidgets(
    'health action keeps its exact named route and retires after refresh',
    (tester) async {
      final api = s.HealthTransport();
      await s.mount(tester, api);
      await tester.pumpAndSettle();
      await reveal(tester, s.button('Review catalog'));
      final old = tester
          .widget<ButtonStyleButton>(s.button('Review catalog'))
          .onPressed!;
      await tester.tap(s.refresh());
      await tester.pumpAndSettle();
      old();
      await tester.pumpAndSettle();
      expect(find.text('Opened /products'), findsNothing);
      await reveal(tester, s.button('Review catalog'));
      await tester.tap(s.button('Review catalog'));
      await tester.pumpAndSettle();
      expect(find.text('Opened /products'), findsOneWidget);
    },
  );
  testWidgets(
    'held health refresh exposes shell progress without duplicate reads',
    (tester) async {
      final api = s.HealthTransport(), held = Completer<JsonMap>();
      await s.mount(tester, api);
      await tester.pumpAndSettle();
      api.healthReply = (_) => held.future;
      final callback = tester.widget<IconButton>(s.refresh()).onPressed!;
      callback();
      callback();
      await tester.pump();
      expect(api.healthReads.length, 2);
      expect(find.byKey(const Key('merchant-list-progress')), findsOneWidget);
      expect(find.text('Private A health'), findsOneWidget);
      held.complete(s.health());
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
    },
  );
  testWidgets(
    'health Retry works after selecting no store then failing selection',
    (tester) async {
      final api = s.HealthTransport();
      final owner = await s.mount(tester, api);
      await tester.pumpAndSettle();
      owner.scope.selection = () async => throw const ApiException(
        message: 'Synthetic selection unavailable',
        statusCode: 503,
        code: 'SYNTHETIC',
      );
      owner.scope.retire();
      await tester.pumpAndSettle();
      expect(find.text('Private A health'), findsNothing);
      owner.scope.selection = () async => owner.scope.selectedStore;
      await tester.tap(s.refresh());
      await tester.pumpAndSettle();
      expect(find.text('Private A health'), findsOneWidget);
    },
  );
  for (final dark in [false, true]) {
    testWidgets(
      'long health labels, status, summary and action flow at large text dark=$dark',
      (tester) async {
        final api = s.HealthTransport()
          ..healthReply = (_) async => {
            ...s.health(),
            'pillars': [
              {
                'id': 'long',
                'label':
                    'A deliberately long full health signal name with its saved identity',
                'score': 88,
                'status': 'ready',
                'summary':
                    'Complete saved health summary remains readable without shrinking or truncation.',
                'route': '/products',
                'action_label': 'Review the complete product catalog',
              },
            ],
          };
        await s.mount(
          tester,
          api,
          size: const Size(320, 640),
          scale: 2.4,
          dark: dark,
        );
        await tester.pumpAndSettle();
        await reveal(tester, s.button('Review the complete product catalog'));
        expect(tester.takeException(), isNull);
        await tester.tap(s.button('Review the complete product catalog'));
        await tester.pumpAndSettle();
        expect(find.text('Opened /products'), findsOneWidget);
      },
    );
    testWidgets(
      'recovery message and footer stay readable at large text dark=$dark',
      (tester) async {
        var backs = 0;
        await s.mount(
          tester,
          s.HealthTransport(),
          size: const Size(320, 400),
          scale: 2.4,
          dark: dark,
          child: ErrorScreen(
            title: 'Saved sign-in is temporarily unavailable',
            message:
                'Your original sign-in remains saved. Retry to confirm the current account before opening a store.',
            onRetry: () {},
            onBackToLogin: () => backs++,
          ),
        );
        await tester.pumpAndSettle();
        await reveal(tester, s.button('Retry saved sign-in'));
        expect(tester.takeException(), isNull);
        await tester.tap(s.button('Back to Login'));
        await tester.pumpAndSettle();
        expect(backs, 1);
      },
    );
  }
  testWidgets(
    'retired ErrorScreen callbacks cannot use updated auth-owner callbacks',
    (tester) async {
      var old = 0, fresh = 0;
      final key = GlobalKey();
      await s.mount(
        tester,
        s.HealthTransport(),
        child: ErrorScreen(
          key: key,
          title: 'Old recovery',
          message: 'Old',
          onRetry: () => old++,
        ),
      );
      final callback = tester
          .widget<ButtonStyleButton>(s.button('Retry saved sign-in'))
          .onPressed!;
      await s.mount(
        tester,
        s.HealthTransport(),
        child: ErrorScreen(
          key: key,
          title: 'New recovery',
          message: 'New',
          onRetry: () => fresh++,
        ),
      );
      callback();
      await tester.pumpAndSettle();
      expect(old, 0);
      expect(fresh, 0);
      await tester.tap(s.button('Retry saved sign-in'));
      await tester.pumpAndSettle();
      expect(fresh, 1);
    },
  );
  for (final camera in [false, true]) {
    testWidgets(
      'image selection returns exact enum and old callback cannot pop the owner camera=$camera',
      (tester) async {
        ImageSource? selected;
        var returns = 0;
        await s.mount(
          tester,
          s.HealthTransport(),
          child: Builder(
            builder: (context) => Scaffold(
              body: TextButton(
                onPressed: () async {
                  selected = await showImageSourceSheet(context);
                  returns++;
                },
                child: const Text('Open image'),
              ),
            ),
          ),
        );
        await tester.tap(find.text('Open image'));
        await tester.pumpAndSettle();
        final tile = find.widgetWithText(
          ListTile,
          camera ? 'Take photo' : 'Photo library',
        );
        final callback = tester.widget<ListTile>(tile).onTap!;
        callback();
        await tester.pumpAndSettle();
        expect(selected, camera ? ImageSource.camera : ImageSource.gallery);
        expect(returns, 1);
        callback();
        await tester.pumpAndSettle();
        expect(find.text('Open image'), findsOneWidget);
        expect(returns, 1);
        expect(tester.takeException(), isNull);
      },
    );
  }
  testWidgets(
    'image selection cancellation preserves the original null outcome',
    (tester) async {
      ImageSource? selected = ImageSource.camera;
      await s.mount(
        tester,
        s.HealthTransport(),
        child: Builder(
          builder: (context) => Scaffold(
            body: TextButton(
              onPressed: () async {
                selected = await showImageSourceSheet(context);
              },
              child: const Text('Open image'),
            ),
          ),
        ),
      );
      await tester.tap(find.text('Open image'));
      await tester.pumpAndSettle();
      await tester.tap(find.byTooltip('Close'));
      await tester.pumpAndSettle();
      expect(selected, isNull);
      expect(find.text('Open image'), findsOneWidget);
    },
  );
}
