import 'dart:async';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:letbuyy_store/theme/store_theme.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:letbuyy_models/letbuyy_models.dart'
    show CustomerSegmentContract;
import 'package:letbuyy_store/app/store_context.dart';
import 'package:letbuyy_store/screens/customers/customer_segment_sheet.dart';
import 'package:letbuyy_store/services/customer_service.dart';
import 'customer_scope_boundary_test.dart' as fixture;

Map<String, dynamic> segment({Map<String, dynamic>? input}) => {
  'id': 'segment_1',
  'store_id': 'a',
  'name': 'Saved segment',
  'description': 'Saved description',
  'customer_count': 1,
  'rules': {
    'status': 'disabled',
    'accepts_marketing': false,
    'tags_any': ['vip'],
    'min_order_count': 0,
    'min_total_spent': 150.75,
    'last_order_after': '2026-10-01T00:00:00.000Z',
    'last_order_before': '2026-10-30T23:59:59.999Z',
  },
  ...?input,
};

Future<StoreContext> pumpEditor(
  WidgetTester tester,
  void Function(RequestOptions, RequestInterceptorHandler) handle, {
  bool editing = false,
  bool dark = false,
  double textScale = 1,
}) async {
  SharedPreferences.setMockInitialValues({});
  late StoreContext stores;
  final api = fixture.client(handle, scope: () => stores.requestContextKey);
  stores = StoreContext(storeService: fixture.FixedStores(api));
  await stores.loadStores();
  await tester.pumpWidget(
    MultiProvider(
      providers: [
        ChangeNotifierProvider.value(value: stores),
        ChangeNotifierProvider(create: (_) => CustomerService(api: api)),
      ],
      child: MaterialApp(
        theme: dark ? StoreTheme.dark() : StoreTheme.light(),
        builder: (context, child) => MediaQuery(
          data: MediaQuery.of(
            context,
          ).copyWith(textScaler: TextScaler.linear(textScale)),
          child: child!,
        ),
        home: Scaffold(
          body: Builder(
            builder: (context) => TextButton(
              onPressed: () =>
                  Navigator.of(context).push<CustomerSegmentContract>(
                    MaterialPageRoute<CustomerSegmentContract>(
                      builder: (_) => CustomerSegmentSheet(
                        storeId: 'a',
                        segment: editing
                            ? CustomerSegmentContract.fromJson(segment())
                            : null,
                      ),
                    ),
                  ),
              child: const Text('Open editor'),
            ),
          ),
        ),
      ),
    ),
  );
  await tester.tap(find.text('Open editor'));
  await tester.pumpAndSettle();
  return stores;
}

Future<void> tapSave(
  WidgetTester tester, [
  String label = 'Save segment',
]) async {
  await tester.ensureVisible(find.text(label));
  await tester.tap(find.text(label));
  await tester.pumpAndSettle();
}

void main() {
  setUpAll(initializeLetbuyyTypography);
  for (final dark in [false, true]) {
    for (final scale in [1.0, 2.4]) {
      testWidgets(
        'segment floating labels clear the preceding field at scale$scale dark$dark',
        (tester) async {
          await pumpEditor(
            tester,
            (r, h) => fixture.respond(r, h, {}),
            dark: dark,
            textScale: scale,
          );
          final nameInput = find.descendant(
            of: find.byKey(const ValueKey('segment-Segment name')),
            matching: find.byType(EditableText),
          );
          final outline = InputDecorator.containerOf(
            tester.element(nameInput),
          )!;
          final border = Rect.fromPoints(
            outline.localToGlobal(Offset.zero),
            outline.localToGlobal(outline.size.bottomRight(Offset.zero)),
          );
          final label = tester.renderObject<RenderBox>(
            find.descendant(
              of: find.byKey(const ValueKey('segment-Description')),
              matching: find.text('Description'),
            ),
          );
          final paintedLabel = Rect.fromPoints(
            label.localToGlobal(Offset.zero),
            label.localToGlobal(label.size.bottomRight(Offset.zero)),
          );
          expect(
            paintedLabel.top,
            greaterThan(border.bottom),
            reason:
                'The next persistent label must not touch or overlap the preceding field outline.',
          );
          expect(tester.takeException(), isNull);
        },
      );
    }
  }

  testWidgets(
    'editing preserves all canonical rules and confirms the server readback',
    (tester) async {
      final writes = <RequestOptions>[];
      var saved = segment();
      await pumpEditor(tester, (r, h) {
        if (r.method == 'PATCH') {
          writes.add(r);
          saved = segment(
            input: {
              'description': null,
              ...Map<String, dynamic>.from(r.data as Map),
            },
          );
        }
        fixture.respond(r, h, r.method == 'GET' ? [saved] : saved);
      }, editing: true);
      expect(find.text('150.75'), findsOneWidget);
      expect(find.text('Does not accept marketing'), findsOneWidget);
      await tester.enterText(
        find.byKey(const ValueKey('segment-Segment name')),
        'Edited segment',
      );
      await tapSave(tester);
      expect(writes.single.path, endsWith('/customers/segments/segment_1'));
      final input = writes.single.data as Map;
      expect(input['name'], 'Edited segment');
      expect(input['description'], 'Saved description');
      expect(input['rules'], segment()['rules']);
      expect(find.text('Edit segment'), findsNothing);
    },
  );

  testWidgets('invalid dates and negative rules cannot issue a mutation', (
    tester,
  ) async {
    final writes = <RequestOptions>[];
    await pumpEditor(tester, (r, h) {
      writes.add(r);
      fixture.respond(r, h, segment());
    });
    await tester.enterText(
      find.byKey(const ValueKey('segment-Segment name')),
      'Invalid segment',
    );
    await tester.enterText(
      find.byKey(const ValueKey('segment-Minimum orders')),
      '-1',
    );
    await tester.enterText(
      find.byKey(const ValueKey('segment-Last order from (YYYY-MM-DD)')),
      '2026-02-31',
    );
    await tapSave(tester);
    expect(find.text('Enter a non-negative whole number.'), findsOneWidget);
    expect(find.text('Enter a valid date as YYYY-MM-DD.'), findsOneWidget);
    expect(writes, isEmpty);
  });

  testWidgets(
    'an uncertain creation retry retains exactly one logical key and payload',
    (tester) async {
      final writes = <RequestOptions>[];
      Map<String, dynamic>? saved;
      await pumpEditor(tester, (r, h) {
        if (r.method == 'POST') {
          writes.add(r);
          saved = segment(
            input: {
              'description': null,
              ...Map<String, dynamic>.from(r.data as Map),
            },
          );
          fixture.respond(r, h, saved!, status: writes.length == 1 ? 503 : 200);
        } else {
          fixture.respond(r, h, [saved!]);
        }
      });
      await tester.enterText(
        find.byKey(const ValueKey('segment-Segment name')),
        'Retry customers',
      );
      await tester.enterText(
        find.byKey(const ValueKey('segment-Minimum spend (INR)')),
        '150.75',
      );
      await tapSave(tester);
      final field = tester.widget<CustomTextField>(
        find.byKey(const ValueKey('segment-Segment name')),
      );
      expect(field.enabled, isFalse);
      await tapSave(tester, 'Retry save');
      expect(writes.length, 2);
      expect(writes.first.headers['X-Idempotency-Key'], isNotEmpty);
      expect(
        writes.last.headers['X-Idempotency-Key'],
        writes.first.headers['X-Idempotency-Key'],
      );
      expect(writes.last.data, writes.first.data);
      expect((writes.last.data as Map)['rules'], {
        'tags_any': [],
        'min_total_spent': 150.75,
      });
    },
  );

  testWidgets(
    'a confirmation retry reads the saved record without creating another',
    (tester) async {
      var creates = 0, reads = 0;
      Map<String, dynamic>? saved;
      await pumpEditor(tester, (r, h) {
        if (r.method == 'POST') {
          ++creates;
          saved = segment(
            input: {
              'description': null,
              ...Map<String, dynamic>.from(r.data as Map),
            },
          );
          fixture.respond(r, h, saved!);
        } else {
          ++reads;
          fixture.respond(
            r,
            h,
            reads == 1 ? {} : [saved!],
            status: reads == 1 ? 503 : 200,
          );
        }
      });
      await tester.enterText(
        find.byKey(const ValueKey('segment-Segment name')),
        'Confirmed customers',
      );
      await tapSave(tester);
      await tapSave(tester, 'Retry confirmation');
      expect(creates, 1);
      expect(reads, 2);
      expect(find.text('Create segment'), findsNothing);
    },
  );

  testWidgets(
    'a segment form and its rules disappear when store access changes',
    (tester) async {
      final calls = <RequestOptions>[];
      final stores = await pumpEditor(tester, (r, h) {
        calls.add(r);
        fixture.respond(r, h, {});
      }, editing: true);
      await stores.selectStore(stores.stores.last);
      await tester.pumpAndSettle();
      expect(find.text('Saved segment'), findsNothing);
      expect(find.text('150.75'), findsNothing);
      expect(find.text('Save segment'), findsNothing);
      expect(
        find.text(
          'Store access changed. Close this form and reload the selected store.',
        ),
        findsOneWidget,
      );
      expect(calls, isEmpty);
    },
  );

  testWidgets('a retired preview cannot display a count for changed rules', (
    tester,
  ) async {
    final started = Completer<void>(), release = Completer<void>();
    await pumpEditor(tester, (r, h) async {
      started.complete();
      await release.future;
      fixture.respond(r, h, {'store_id': 'a', 'customer_count': 37});
    });
    await tester.enterText(
      find.byKey(const ValueKey('segment-Segment name')),
      'Preview customers',
    );
    await tester.ensureVisible(find.text('Preview'));
    await tester.tap(find.text('Preview'));
    for (var attempt = 0; attempt < 10 && !started.isCompleted; attempt++) {
      await tester.pump(const Duration(milliseconds: 50));
    }
    expect(
      started.isCompleted,
      isTrue,
      reason: 'Preview must dispatch before its response is held.',
    );
    await tester.enterText(
      find.byKey(const ValueKey('segment-Minimum spend (INR)')),
      '250',
    );
    release.complete();
    await tester.pumpAndSettle();
    expect(find.text('37 customers'), findsNothing);
  });
  testWidgets(
    'dirty header and system Back retain rules until explicit discard',
    (tester) async {
      final calls = <RequestOptions>[];
      await pumpEditor(tester, (r, h) {
        calls.add(r);
        fixture.respond(r, h, {});
      });
      final field = find.byKey(const ValueKey('segment-Segment name'));
      await tester.enterText(field, 'Unsubmitted segment');
      await tester.pump();
      await tester.tap(find.byTooltip('Back'));
      await tester.pumpAndSettle();
      expect(find.text('Discard changes?'), findsOneWidget);
      await tester.tap(find.text('Cancel'));
      await tester.pumpAndSettle();
      expect(
        tester.widget<CustomTextField>(field).controller!.text,
        'Unsubmitted segment',
      );
      await tester.binding.handlePopRoute();
      await tester.pumpAndSettle();
      await tester.tap(find.text('Discard changes'));
      await tester.pumpAndSettle();
      expect(find.text('Open editor'), findsOneWidget);
      expect(calls, isEmpty);
    },
  );

  testWidgets(
    'pending Save blocks Back and close; uncertain exit explains refresh without a second command',
    (tester) async {
      final entered = Completer<void>(), release = Completer<void>();
      final writes = <RequestOptions>[];
      await pumpEditor(tester, (r, h) async {
        writes.add(r);
        entered.complete();
        await release.future;
        fixture.respond(r, h, {}, status: 503);
      });
      await tester.enterText(
        find.byKey(const ValueKey('segment-Segment name')),
        'Uncertain segment',
      );
      await tester.tap(find.text('Save segment'));
      for (var n = 0; n < 20 && !entered.isCompleted; n++) {
        await tester.pump(const Duration(milliseconds: 50));
      }
      expect(entered.isCompleted, isTrue);
      expect(
        tester
            .widget<IconButton>(
              find.byWidgetPredicate(
                (w) => w is IconButton && w.tooltip == 'Back',
              ),
            )
            .onPressed,
        isNull,
      );
      expect(
        tester
            .widget<TextButton>(find.widgetWithText(TextButton, 'Close'))
            .onPressed,
        isNull,
      );
      await tester.binding.handlePopRoute();
      await tester.pump();
      expect(find.text('Discard changes?'), findsNothing);
      expect(find.text('Confirming…'), findsOneWidget);
      release.complete();
      await tester.pumpAndSettle();
      await tester.tap(find.text('Close'));
      await tester.pumpAndSettle();
      expect(find.textContaining('may already have completed'), findsOneWidget);
      await tester.tap(find.text('Cancel'));
      await tester.pumpAndSettle();
      expect(find.text('Retry save'), findsOneWidget);
      expect(writes.length, 1);
    },
  );

  for (final dark in [false, true]) {
    testWidgets(
      'full-page segment reflows at large text and narrow keyboard height in ${dark ? 'dark' : 'light'}',
      (tester) async {
        tester.view.physicalSize = const Size(360, 640);
        tester.view.devicePixelRatio = 1;
        addTearDown(tester.view.resetPhysicalSize);
        addTearDown(tester.view.resetDevicePixelRatio);
        addTearDown(tester.view.resetViewInsets);
        await pumpEditor(
          tester,
          (r, h) => fixture.respond(r, h, {}),
          textScale: 2.4,
          dark: dark,
        );
        expect(find.byType(LetbuyyEditorScaffold), findsOneWidget);
        expect(find.byType(BottomSheet), findsNothing);
        await tester.enterText(
          find.byKey(const ValueKey('segment-Segment name')),
          'A long customer segment draft',
        );
        tester.view.viewInsets = const FakeViewPadding(bottom: 220);
        await tester.pumpAndSettle();
        expect(
          tester
              .getRect(find.widgetWithText(FilledButton, 'Save segment'))
              .bottom,
          lessThanOrEqualTo(420),
        );
        expect(tester.takeException(), isNull);
      },
    );
  }

  testWidgets(
    'bounded status sheet applies only the chosen draft and Cancel preserves existing rules',
    (tester) async {
      final writes = <RequestOptions>[];
      await pumpEditor(tester, (r, h) {
        writes.add(r);
        fixture.respond(r, h, {});
      }, editing: true);
      final status = find.widgetWithText(OutlinedButton, 'Customer status');
      await tester.ensureVisible(status);
      await tester.tap(status);
      await tester.pumpAndSettle();
      await tester.tap(find.text('Active'));
      await tester.pump();
      await tester.tap(find.text('Cancel'));
      await tester.pumpAndSettle();
      expect(
        find.descendant(of: status, matching: find.text('Disabled')),
        findsOneWidget,
      );
      await tester.tap(status);
      await tester.pumpAndSettle();
      await tester.tap(find.text('Invited'));
      await tester.pump();
      await tester.tap(find.text('Apply selection'));
      await tester.pumpAndSettle();
      expect(
        find.descendant(of: status, matching: find.text('Invited')),
        findsOneWidget,
      );
      expect(writes, isEmpty);
      expect(tester.widget<OutlinedButton>(status).focusNode!.hasFocus, isTrue);
      expect(tester.takeException(), isNull);
    },
  );
}
