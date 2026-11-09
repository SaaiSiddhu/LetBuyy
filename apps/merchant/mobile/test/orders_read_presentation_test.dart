// The real SDK and CacheService with synthetic transport/IO completion only.
// These tests qualify UI read lifetime/provenance, not SQL or hosted permission.
import 'dart:async';
import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_store/services/api_client.dart';
import 'package:letbuyy_store/services/cache_service.dart';
import 'package:letbuyy_store/services/order_service.dart';

const site = '11111111-1111-4111-8111-111111111111';
const otherSite = '33333333-3333-4333-8333-333333333333';
const recordId = '22222222-2222-4222-8222-222222222222';
JsonMap orderRow({String store = site, String number = 'SYNTHETIC-A'}) => {
  'id': recordId,
  'store_id': store,
  'order_number': number,
  'status': 'confirmed',
  'payment_status': 'pending',
  'fulfillment_status': 'unfulfilled',
  'customer_name': 'Synthetic private record',
  'currency': 'INR',
  'total': 129.75,
  'subtotal': 129.75,
  'discount_amount': 0,
  'shipping_amount': 0,
  'tax_amount': 0,
  'line_items': [],
};
PaginatedResponse<JsonMap> page({
  String store = site,
  String number = 'SYNTHETIC-A',
}) => PaginatedResponse(
  data: [orderRow(store: store, number: number)],
  total: 1,
  page: 1,
  limit: 20,
  hasMore: true,
  nextCursor: 'synthetic-next',
);
ApiException failure(int status) => ApiException(
  message: 'Synthetic read failure',
  statusCode: status,
  code: 'SYNTHETIC_READ_FAILURE',
);
Matcher changed() => throwsA(
  isA<ApiException>().having((e) => e.code, 'code', 'SESSION_CONTEXT_CHANGED'),
);

class ReadTransport extends ApiClient {
  ReadTransport()
    : super(baseUrl: 'https://orders.synthetic.invalid/v1', maxRetries: 0);
  Object epoch = 'synthetic-actor-a';
  final calls = <ApiRequestOptions>[];
  Future<PaginatedResponse<JsonMap>> Function(ApiRequestOptions)? reply;
  @override
  Object captureRequestContext() => epoch;
  @override
  Future<PaginatedResponse<JsonMap>> requestPaginatedJson(
    String path, {
    ApiRequestOptions? options,
  }) async {
    expect(path, '/orders');
    calls.add(options!);
    return reply == null ? page() : reply!(options);
  }
}

class DelayedCache extends CacheService {
  DelayedCache({required super.actorIdProvider}) : super.memory();
  final entered = Completer<void>(), release = Completer<void>();
  final writes = <String>[];
  @override
  Future<void> writeJson(String key, Object? value) async {
    writes.add(key);
    await super.writeJson(key, value);
    if (!entered.isCompleted) {
      entered.complete();
      await release.future;
    }
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  for (final status in [401, 403, 404]) {
    test(
      'live$status retires populated rows and cursor rather than returning saved data',
      () async {
        final api = ReadTransport();
        final cache = CacheService.memory(
          actorIdProvider: () => api.epoch.toString(),
        );
        final service = OrderService(api: api, cache: cache);
        try {
          final positive = await service.fetchOrders(site);
          expect(positive.single.orderNumber, 'SYNTHETIC-A');
          expect(service.hasFreshOrders, isTrue);
          expect(service.ordersNextCursor, 'synthetic-next');
          api.reply = (_) async => throw failure(status);
          await expectLater(
            service.fetchOrders(site),
            throwsA(
              isA<ApiException>().having((e) => e.statusCode, 'status', status),
            ),
          );
          expect(service.orders, isEmpty);
          expect(service.ordersNextCursor, isNull);
          expect(service.hasFreshOrders, isFalse);
          expect(service.cachedOrder(recordId), isNull);
          // The existing actor-bound stored bytes remain intact; this is a UI
          // denial marker, not a storage-format/retention change.
          expect(
            cache.readJsonMap(CacheService.orderDetailKey(recordId)),
            isNotNull,
          );
          api.reply = (_) async => throw failure(503);
          await expectLater(
            service.fetchOrders(site),
            throwsA(
              isA<ApiException>().having((e) => e.statusCode, 'status', 503),
            ),
          );
          expect(service.orders, isEmpty);
          api.reply = (_) async => page(number: 'SYNTHETIC-RECONFIRMED');
          expect(
            (await service.fetchOrders(site)).single.orderNumber,
            'SYNTHETIC-RECONFIRMED',
          );
          expect(service.hasFreshOrders, isTrue);
        } finally {
          service.dispose();
          api.close();
        }
      },
    );
  }
  test(
    'actor change removes private getters before another frame or request; fresh denial cannot adopt them',
    () async {
      final api = ReadTransport();
      final actual = OrderService(api: api);
      try {
        await actual.fetchOrders(site);
        api.epoch = 'synthetic-actor-b';
        expect(actual.orders, isEmpty);
        expect(actual.statusCounts, isEmpty);
        expect(actual.ordersNextCursor, isNull);
        api.reply = (_) async => throw failure(403);
        await expectLater(
          actual.fetchOrders(site),
          throwsA(
            isA<ApiException>().having((e) => e.statusCode, 'status', 403),
          ),
        );
        expect(actual.orders, isEmpty);
      } finally {
        actual.dispose();
        api.close();
      }
    },
  );
  test(
    'same-context same-query offline results retain their saved provenance',
    () async {
      final api = ReadTransport();
      final service = OrderService(api: api);
      try {
        await service.fetchOrders(site);
        api.reply = (_) async => throw failure(503);
        expect(
          (await service.fetchOrders(site)).single.orderNumber,
          'SYNTHETIC-A',
        );
        expect(service.hasFreshOrders, isFalse);
        expect(api.calls.last.query, {
          'store_id': site,
          'page': 1,
          'limit': 20,
        });
        expect(api.calls.last.expectedContextVersion, api.epoch);
      } finally {
        service.dispose();
        api.close();
      }
    },
  );
  test(
    'another query cannot borrow the previous page after a failed read',
    () async {
      final api = ReadTransport();
      final service = OrderService(api: api);
      try {
        await service.fetchOrders(site);
        api.reply = (_) async => throw failure(503);
        await expectLater(
          service.fetchOrders(
            site,
            status: 'pending',
            page: 2,
            cursor: ' opaque cursor ',
            customerEmail: ' synthetic@example.invalid ',
          ),
          throwsA(isA<ApiException>()),
        );
        expect(service.orders, isEmpty);
        expect(service.ordersNextCursor, isNull);
        expect(api.calls.last.query, {
          'store_id': site,
          'status': 'pending',
          'page': 2,
          'limit': 20,
          'cursor': 'opaque cursor',
          'customer_email': 'synthetic@example.invalid',
        });
      } finally {
        service.dispose();
        api.close();
      }
    },
  );
  test(
    'late prior actor result cannot settle or write after the new actor read',
    () async {
      final api = ReadTransport();
      final cache = CacheService.memory(
        actorIdProvider: () => api.epoch.toString(),
      );
      final service = OrderService(api: api, cache: cache),
          old = Completer<PaginatedResponse<JsonMap>>();
      try {
        api.reply = (_) => old.future;
        final first = service.fetchOrders(site);
        final rejected = expectLater(first, changed());
        expect(service.isLoading, isTrue);
        api.epoch = 'synthetic-actor-b';
        expect(service.isLoading, isFalse);
        api.reply = (_) async => page(number: 'SYNTHETIC-B');
        await service.fetchOrders(site);
        old.complete(page());
        await rejected;
        expect(service.orders.single.orderNumber, 'SYNTHETIC-B');
        expect(service.hasFreshOrders, isTrue);
        expect(service.isLoading, isFalse);
        expect(
          cache.readJsonMap(
            CacheService.orderDetailKey(recordId),
          )?['order_number'],
          'SYNTHETIC-B',
        );
        api.epoch = 'synthetic-actor-a';
        expect(
          cache.readJsonMap(CacheService.orderDetailKey(recordId)),
          isNull,
        );
      } finally {
        service.dispose();
        api.close();
      }
    },
  );
  test(
    'superseded same-context request cannot clear or replace a later loaded page',
    () async {
      final api = ReadTransport();
      final service = OrderService(api: api),
          old = Completer<PaginatedResponse<JsonMap>>();
      try {
        api.reply = (_) => old.future;
        final first = service.fetchOrders(site);
        final rejected = expectLater(first, changed());
        api.reply = (_) async => page(number: 'SYNTHETIC-LATEST');
        await service.fetchOrders(site, status: 'confirmed');
        old.complete(page());
        await rejected;
        expect(service.orders.single.orderNumber, 'SYNTHETIC-LATEST');
        expect(service.isLoading, isFalse);
      } finally {
        service.dispose();
        api.close();
      }
    },
  );
  test(
    'retirement during an acknowledged cache write cannot continue into another actor detail cache',
    () async {
      final api = ReadTransport();
      final cache = DelayedCache(actorIdProvider: () => api.epoch.toString());
      final service = OrderService(api: api, cache: cache);
      try {
        final reading = service.fetchOrders(site);
        final rejected = expectLater(reading, changed());
        await cache.entered.future;
        final originalKey = CacheService.ordersKey(site, page: 1, limit: 20);
        expect(cache.readJsonList(originalKey), isNotEmpty);
        api.epoch = 'synthetic-actor-b';
        cache.release.complete();
        await rejected;
        expect(cache.writes, [originalKey]);
        expect(
          cache.readJsonMap(CacheService.orderDetailKey(recordId)),
          isNull,
        );
        expect(service.orders, isEmpty);
      } finally {
        if (!cache.release.isCompleted) cache.release.complete();
        service.dispose();
        api.close();
      }
    },
  );
  test(
    'wrong-store rows fail admission instead of becoming current data',
    () async {
      final api = ReadTransport();
      final service = OrderService(api: api);
      try {
        await service.fetchOrders(site);
        api.reply = (_) async => page(store: otherSite);
        await expectLater(
          service.fetchOrders(site),
          throwsA(isA<FormatException>()),
        );
        expect(service.orders, isEmpty);
        expect(service.hasFreshOrders, isFalse);
      } finally {
        service.dispose();
        api.close();
      }
    },
  );
  test(
    'disposed presentation owner rejects its held read without notifications or cache writes',
    () async {
      final api = ReadTransport();
      final cache = CacheService.memory();
      final service = OrderService(api: api, cache: cache);
      final held = Completer<PaginatedResponse<JsonMap>>();
      var notifications = 0;
      service.addListener(() => notifications++);
      api.reply = (_) => held.future;
      final reading = service.fetchOrders(site);
      final rejected = expectLater(reading, changed());
      final before = notifications;
      service.dispose();
      held.complete(page());
      await rejected;
      expect(notifications, before);
      expect(
        cache.readJsonList(CacheService.ordersKey(site, page: 1, limit: 20)),
        isEmpty,
      );
      api.close();
    },
  );
}
