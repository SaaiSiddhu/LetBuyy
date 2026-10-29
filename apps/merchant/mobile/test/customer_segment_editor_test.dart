import 'dart:async';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
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
        home: Scaffold(
          body: Builder(
            builder: (context) => TextButton(
              onPressed: () => showModalBottomSheet<CustomerSegmentContract>(
                context: context,
                isScrollControlled: true,
                builder: (_) => CustomerSegmentSheet(
                  storeId: 'a',
                  segment: editing
                      ? CustomerSegmentContract.fromJson(segment())
                      : null,
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
      final field = tester.widget<TextFormField>(
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
}
