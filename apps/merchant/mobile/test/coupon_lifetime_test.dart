import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_models/letbuyy_models.dart' hide JsonMap;
import 'package:letbuyy_store/screens/discounts/coupon_form_screen.dart';
import 'package:letbuyy_store/services/api_client.dart';
import 'package:letbuyy_store/services/coupon_service.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'coupon_presentation_test.dart' as f;

PaginatedResponse<JsonMap> page(
  List<JsonMap> rows, {
  int number = 1,
  int total = 1,
  bool more = false,
  bool meta = true,
}) => PaginatedResponse(
  data: rows,
  total: total,
  page: number,
  limit: 50,
  hasMore: more,
  meta: meta
      ? {'total': total, 'page': number, 'per_page': 50, 'has_next': more}
      : {},
);
Finder scroll() => find
    .byWidgetPredicate(
      (w) => w is Scrollable && w.axisDirection == AxisDirection.down,
    )
    .first;
Future<void> top(WidgetTester tester) async {
  await tester.drag(scroll(), const Offset(0, 10000));
  await tester.pumpAndSettle();
}

Widget entry({CouponContract? coupon, String store = f.site}) => Builder(
  builder: (context) => Scaffold(
    body: TextButton(
      onPressed: () => Navigator.of(context).push(
        MaterialPageRoute<bool>(
          builder: (_) => CouponFormScreen(storeId: store, coupon: coupon),
        ),
      ),
      child: const Text('Open editor'),
    ),
  ),
);
Future<void> open(WidgetTester tester) async {
  await tester.tap(find.text('Open editor'));
  await tester.pumpAndSettle();
}

void main() {
  setUpAll(initializeLetbuyyTypography);
  test('read metadata is unavailable when not actually supplied', () async {
    final api = f.CouponTransport()
      ..pageReply = (_) async => page([f.coupon()], total: 99, meta: false);
    final service = CouponService(api: api);
    addTearDown(api.close);
    addTearDown(service.dispose);
    final result = await service.readCouponsPage(f.site);
    expect(result.rows.single.code, 'SYNTHETIC');
    expect(result.total, isNull);
    expect(result.hasNext, isNull);
  });
  for (final malformed in [
    'foreign row',
    'missing row scope',
    'wrong page',
    'wrong limit',
  ]) {
    test('read rejects $malformed without publishing private data', () async {
      final api = f.CouponTransport();
      final service = CouponService(api: api);
      addTearDown(api.close);
      addTearDown(service.dispose);
      await service.fetchCoupons(f.site);
      api.pageReply = (_) async => PaginatedResponse(
        data: [
          {
            ...f.coupon(),
            if (malformed == 'foreign row') 'store_id': 'other',
            if (malformed == 'missing row scope') 'store_id': null,
          },
        ],
        total: 1,
        page: 1,
        limit: 50,
        hasMore: false,
        meta: {
          'page': malformed == 'wrong page' ? 2 : 1,
          'per_page': malformed == 'wrong limit' ? 20 : 50,
        },
      );
      await expectLater(
        service.fetchCoupons(f.site),
        throwsA(isA<ApiException>()),
      );
      expect(service.coupons, isEmpty);
    });
  }
  test('older page cannot replace a newer successful read', () async {
    final api = f.CouponTransport(),
        held = Completer<PaginatedResponse<JsonMap>>();
    final service = CouponService(api: api);
    addTearDown(api.close);
    addTearDown(service.dispose);
    api.pageReply = (_) => held.future;
    final old = expectLater(
      service.fetchCoupons(f.site),
      throwsA(isA<ApiException>()),
    );
    api.pageReply = (_) async => page([
      {...f.coupon(), 'code': 'CURRENT'},
    ]);
    await service.fetchCoupons(f.site);
    held.complete(page([f.coupon()]));
    await old;
    expect(service.coupons.single.code, 'CURRENT');
    expect(service.isLoading, isFalse);
  });
  test(
    'retired context hides prior rows and late completion cannot publish them',
    () async {
      final api = f.CouponTransport(),
          held = Completer<PaginatedResponse<JsonMap>>();
      final service = CouponService(api: api);
      addTearDown(api.close);
      addTearDown(service.dispose);
      await service.fetchCoupons(f.site);
      api.pageReply = (_) => held.future;
      final old = expectLater(
        service.fetchCoupons(f.site),
        throwsA(isA<ApiException>()),
      );
      api.epoch++;
      expect(service.coupons, isEmpty);
      held.complete(page([f.coupon()]));
      await old;
      expect(service.coupons, isEmpty);
      expect(service.isLoading, isFalse);
    },
  );
  test('disposed read retires its notifier before completion', () async {
    final api = f.CouponTransport(),
        held = Completer<PaginatedResponse<JsonMap>>();
    final service = CouponService(api: api);
    addTearDown(api.close);
    var notifications = 0;
    service.addListener(() => notifications++);
    api.pageReply = (_) => held.future;
    final old = expectLater(
      service.fetchCoupons(f.site),
      throwsA(isA<ApiException>()),
    );
    expect(notifications, 1);
    service.dispose();
    held.complete(page([f.coupon()]));
    await old;
    expect(notifications, 1);
  });
  for (final status in [401, 403, 503]) {
    testWidgets('refresh $status retains only permitted confirmed content', (
      tester,
    ) async {
      final api = f.CouponTransport();
      await f.mount(tester, api);
      await f.reveal(tester, find.text('SYNTHETIC'));
      api.pageReply = (_) async => throw ApiException(
        message: 'Synthetic failure',
        statusCode: status,
        code: 'SYNTHETIC',
      );
      await tester.tap(f.icon('Refresh coupons'));
      await tester.pumpAndSettle();
      expect(
        find.text('SYNTHETIC'),
        status == 503 ? findsOneWidget : findsNothing,
      );
      await top(tester);
      expect(
        find.textContaining(
          status == 503
              ? 'Showing the last confirmed page'
              : 'Coupons unavailable',
        ),
        findsOneWidget,
      );
      expect(api.commands, isEmpty);
    });
  }
  testWidgets(
    'refresh progress remains visible after scrolling beyond the header',
    (tester) async {
      final api = f.CouponTransport(),
          held = Completer<PaginatedResponse<JsonMap>>();
      await f.mount(tester, api);
      await f.reveal(tester, find.text('SYNTHETIC'));
      api.pageReply = (_) => held.future;
      await tester.tap(f.icon('Refresh coupons'));
      await tester.pump();
      final progress = find.byKey(const Key('merchant-list-progress'));
      expect(progress, findsOneWidget);
      expect(tester.getRect(progress).top, greaterThanOrEqualTo(0));
      expect(tester.getRect(progress).bottom, lessThan(844));
      expect(find.text('SYNTHETIC'), findsOneWidget);
      held.complete(page([f.coupon()]));
      await tester.pumpAndSettle();
      expect(progress, findsNothing);
    },
  );
  testWidgets('filter and pagination describe the server matching population', (
    tester,
  ) async {
    final api = f.CouponTransport()
      ..pageReply = (options) async {
        final number = options!.query!['page'] as int;
        return page(
          [
            {...f.coupon(), 'code': 'PAGE$number'},
          ],
          number: number,
          total: 75,
          more: number == 1,
        );
      };
    await f.mount(tester, api);
    await f.reveal(tester, f.icon('Next page'));
    await tester.tap(f.icon('Next page'));
    await tester.pumpAndSettle();
    expect(api.queries.last['page'], 2);
    await top(tester);
    await tester.tap(find.byType(FilterChip));
    await tester.pumpAndSettle();
    expect(api.queries.last['page'], 1);
    expect(api.queries.last['status'], 'active');
    expect(api.queries.last.containsKey('is_active'), isFalse);
    expect(find.text('75'), findsOneWidget);
    expect(find.text('Applied filter: active, not expired'), findsOneWidget);
  });
  testWidgets('A-B-A retires a held read and old row action callbacks', (
    tester,
  ) async {
    final api = f.CouponTransport(),
        held = Completer<PaginatedResponse<JsonMap>>();
    final owner = await f.mount(tester, api);
    await f.reveal(tester, find.text('Deactivate'));
    final callback = tester
        .widget<TextButton>(find.widgetWithText(TextButton, 'Deactivate'))
        .onPressed!;
    api.pageReply = (_) => held.future;
    await tester.tap(f.icon('Refresh coupons'));
    await tester.pump();
    owner.scope.retire(store: '33333333-3333-4333-8333-333333333333');
    await tester.pump();
    owner.scope.retire(store: f.site);
    await tester.pump();
    callback();
    api.pageReply = (_) async => page([
      {...f.coupon(), 'code': 'CURRENT'},
    ]);
    held.complete(page([f.coupon()]));
    await tester.pumpAndSettle();
    expect(api.commands, isEmpty);
    expect(find.text('SYNTHETIC'), findsNothing);
    expect(tester.takeException(), isNull);
  });
  for (final disposed in [false, true]) {
    testWidgets(
      'captured actions cannot act after covered/disposed=$disposed',
      (tester) async {
        final api = f.CouponTransport();
        final owner = await f.mount(tester, api);
        await f.reveal(tester, find.text('Deactivate'));
        final callbacks = ['Edit', 'Deactivate', 'Remove']
            .map(
              (label) => tester
                  .widget<TextButton>(find.widgetWithText(TextButton, label))
                  .onPressed!,
            )
            .toList();
        final reads = api.queries.length;
        if (disposed) {
          await tester.pumpWidget(
            const MaterialApp(home: Text('Unrelated destination')),
          );
        } else {
          owner.navigator.currentState!.push(
            MaterialPageRoute<void>(
              builder: (_) => const Scaffold(body: Text('Cover')),
            ),
          );
        }
        await tester.pumpAndSettle();
        for (final callback in callbacks) {
          callback();
        }
        await tester.pumpAndSettle();
        expect(api.commands, isEmpty);
        expect(api.queries.length, reads);
        expect(find.byType(CouponFormScreen), findsNothing);
        expect(tester.takeException(), isNull);
      },
    );
  }
  for (final dark in [false, true]) {
    testWidgets(
      'large text keeps long saved records and actions readable dark=$dark',
      (tester) async {
        final api = f.CouponTransport()
          ..rows = [
            {
              ...f.coupon(),
              'code': 'SYNTHETIC_CODE_WITH_LONG_IDENTIFIABLE_NAME',
              'description':
                  'Full saved description that remains available with large text and a narrow mobile window.',
              'usage_count': null,
            },
          ];
        await f.mount(
          tester,
          api,
          dark: dark,
          scale: 2.4,
          size: const Size(320, 640),
        );
        await f.reveal(tester, find.text('Remove'));
        expect(find.text('Unavailable/unlimited used'), findsOneWidget);
        expect(tester.takeException(), isNull);
        expect(api.commands, isEmpty);
      },
    );
    testWidgets(
      'large editor supports exact value, dirty Back and keyboard dark=$dark',
      (tester) async {
        final api = f.CouponTransport();
        await f.mount(
          tester,
          api,
          screen: entry(coupon: CouponContract.fromJson(f.coupon())),
          dark: dark,
          scale: 2.4,
          size: const Size(320, 640),
        );
        await open(tester);
        await f.reveal(tester, f.field('Code'));
        await tester.enterText(f.field('Code'), 'EDITED');
        tester.view.viewInsets = const FakeViewPadding(bottom: 220);
        await tester.pump();
        await tester.binding.handlePopRoute();
        await tester.pumpAndSettle();
        expect(find.text('Discard changes?'), findsOneWidget);
        await tester.tap(find.widgetWithText(TextButton, 'Cancel').last);
        await tester.pumpAndSettle();
        expect(find.byType(CouponFormScreen), findsOneWidget);
        expect(api.commands, isEmpty);
        expect(tester.takeException(), isNull);
        tester.view.resetViewInsets();
      },
    );
  }
  testWidgets(
    'edit sends exact fractional value, ISO start and original null-clear/default rules',
    (tester) async {
      final api = f.CouponTransport();
      final row = {...f.coupon(), 'starts_at': '2026-10-31T10:30:00+05:30'};
      await f.mount(
        tester,
        api,
        screen: entry(coupon: CouponContract.fromJson(row)),
      );
      await open(tester);
      await tester.tap(find.widgetWithText(FilledButton, 'Save coupon'));
      await tester.pumpAndSettle();
      final payload = api.commands.single.options.body as Map;
      expect(payload['value'], 12.75);
      expect(payload['starts_at'], row['starts_at']);
      expect(payload['expires_at'], isNull);
      expect(payload['maximum_discount'], isNull);
      expect(payload['per_customer_limit'], 1);
      expect(payload['currency'], 'INR');
      expect(api.commands.single.options.method, HttpMethod.patch);
      expect(find.text('Open editor'), findsOneWidget);
    },
  );
  testWidgets(
    'unconfirmed save retains draft and never submits a fresh retry',
    (tester) async {
      final api = f.CouponTransport()
        ..commandReply = (_, __) async => throw const ApiException(
          message: 'Synthetic lost reply',
          statusCode: 503,
          code: 'SYNTHETIC',
        );
      await f.mount(
        tester,
        api,
        screen: entry(coupon: CouponContract.fromJson(f.coupon())),
      );
      await open(tester);
      final callback = tester
          .widget<FilledButton>(
            find.widgetWithText(FilledButton, 'Save coupon'),
          )
          .onPressed!;
      callback();
      callback();
      await tester.pumpAndSettle();
      expect(api.commands.length, 1);
      expect(find.text('Save unconfirmed'), findsOneWidget);
      expect(find.text('Save coupon'), findsNothing);
      callback();
      await tester.pumpAndSettle();
      expect(api.commands.length, 1);
      await tester.tap(find.text('Close and review'));
      await tester.pumpAndSettle();
      expect(find.text('Open editor'), findsOneWidget);
    },
  );
  testWidgets('foreign-store editor blocks original captured input and save', (
    tester,
  ) async {
    final api = f.CouponTransport();
    final owner = await f.mount(
      tester,
      api,
      screen: entry(coupon: CouponContract.fromJson(f.coupon())),
    );
    await open(tester);
    final callback = tester
        .widget<FilledButton>(find.widgetWithText(FilledButton, 'Save coupon'))
        .onPressed!;
    owner.scope.retire(store: '33333333-3333-4333-8333-333333333333');
    await tester.pumpAndSettle();
    callback();
    await tester.pumpAndSettle();
    expect(find.text('Store access changed'), findsOneWidget);
    expect(f.field('Code'), findsNothing);
    expect(api.commands, isEmpty);
  });
  for (final outcome in [true, false, null]) {
    testWidgets(
      'validation preserves actual $outcome result and existing subtotal wire field',
      (tester) async {
        final api = f.CouponTransport()
          ..validation = {if (outcome != null) 'valid': outcome};
        await f.mount(tester, api);
        await tester.tap(find.text('Validate'));
        await tester.pumpAndSettle();
        await tester.enterText(f.field('Code'), ' CODE ');
        await tester.enterText(f.field('Cart subtotal'), '1000');
        await tester.tap(find.text('Validate').last);
        await tester.pumpAndSettle();
        expect(api.commands.single.options.body, {
          'store_id': f.site,
          'code': 'CODE',
          'order_total': 1000.0,
        });
        expect(
          find.text(
            outcome == true
                ? 'Code is available'
                : outcome == false
                ? 'Code is unavailable'
                : 'Availability unconfirmed',
          ),
          findsOneWidget,
        );
        expect(find.text('Coupon is valid'), findsNothing);
        expect(tester.takeException(), isNull);
      },
    );
  }
}
