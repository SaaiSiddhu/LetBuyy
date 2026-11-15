// Actual OrderService/shared SDK/cache. The synthetic transport controls only
// completion; these tests do not establish hosted authorization or SQL effects.
import 'dart:async';
import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_store/services/api_client.dart';
import 'package:letbuyy_store/services/cache_service.dart';
import 'package:letbuyy_store/services/order_service.dart';
import 'orders_read_presentation_test.dart' as read;

class DetailReadTransport extends read.ReadTransport {
  final details = <ApiRequestOptions?>[];
  Future<JsonMap> Function()? detailReply;
  @override
  Future<JsonMap> requestJson(String path, {ApiRequestOptions? options}) async {
    expect(path, '/orders/${read.recordId}');
    details.add(options);
    return detailReply == null ? read.orderRow() : detailReply!();
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  for (final status in [401, 403, 404]) {
    test(
      'populated detail live$status cannot become a cached confirmation or reappear after offline failure',
      () async {
        final api = DetailReadTransport();
        final cache = CacheService.memory(
          actorIdProvider: () => 'synthetic-actor',
        );
        final service = OrderService(api: api, cache: cache);
        try {
          final positive = await service.fetchOrder(read.recordId);
          expect(positive.orderNumber, 'SYNTHETIC-A');
          expect(service.hasFreshOrder(read.recordId), isTrue);
          expect(
            cache.readJsonMap(CacheService.orderDetailKey(read.recordId)),
            isNotNull,
          );
          api.detailReply = () async => throw read.failure(status);
          await expectLater(
            service.fetchOrder(read.recordId),
            throwsA(
              isA<ApiException>().having((e) => e.statusCode, 'status', status),
            ),
          );
          expect(service.cachedOrder(read.recordId), isNull);
          expect(service.hasFreshOrder(read.recordId), isFalse);
          // UI denial admission never erases or rewrites the existing saved bytes.
          expect(
            cache.readJsonMap(CacheService.orderDetailKey(read.recordId)),
            isNotNull,
          );
          api.detailReply = () async => throw read.failure(503);
          await expectLater(
            service.fetchOrder(read.recordId),
            throwsA(isA<ApiException>()),
          );
          api.detailReply = () async =>
              read.orderRow(number: 'SYNTHETIC-RECONFIRMED');
          expect(
            (await service.fetchOrder(read.recordId)).orderNumber,
            'SYNTHETIC-RECONFIRMED',
          );
        } finally {
          service.dispose();
          api.close();
        }
      },
    );
  }
  test(
    'same-owner offline detail retains the original saved value without changing its cache key',
    () async {
      final api = DetailReadTransport(),
          cache = CacheService.memory(actorIdProvider: () => 'synthetic-actor');
      final service = OrderService(api: api, cache: cache);
      try {
        await service.fetchOrder(read.recordId);
        final original = cache.readJsonMap(
          CacheService.orderDetailKey(read.recordId),
        );
        api.detailReply = () async => throw read.failure(503);
        expect(
          (await service.fetchOrder(read.recordId)).orderNumber,
          'SYNTHETIC-A',
        );
        expect(
          cache.readJsonMap(CacheService.orderDetailKey(read.recordId)),
          original,
        );
      } finally {
        service.dispose();
        api.close();
      }
    },
  );
  test(
    'held detail from a retired context cannot return or write its private row into the new actor cache',
    () async {
      final api = DetailReadTransport(), held = Completer<JsonMap>();
      final cache = CacheService.memory(
        actorIdProvider: () => api.epoch.toString(),
      );
      final service = OrderService(api: api, cache: cache);
      try {
        api.detailReply = () => held.future;
        final pending = service.fetchOrder(read.recordId);
        final rejection = expectLater(pending, read.changed());
        api.epoch = 'synthetic-actor-b';
        held.complete(read.orderRow(number: 'FORMER-ACTOR'));
        await rejection;
        expect(
          cache.readJsonMap(CacheService.orderDetailKey(read.recordId)),
          isNull,
        );
      } finally {
        service.dispose();
        api.close();
      }
    },
  );
  test('disposed detail reader cannot return or cache a held result', () async {
    final api = DetailReadTransport(),
        held = Completer<JsonMap>(),
        cache = CacheService.memory();
    final service = OrderService(api: api, cache: cache);
    api.detailReply = () => held.future;
    final pending = service.fetchOrder(read.recordId);
    final rejection = expectLater(pending, read.changed());
    service.dispose();
    held.complete(read.orderRow());
    try {
      await rejection;
      expect(
        cache.readJsonMap(CacheService.orderDetailKey(read.recordId)),
        isNull,
      );
    } finally {
      api.close();
    }
  });
  test(
    'a different detail record cannot be admitted under the requested record cache key',
    () async {
      final api = DetailReadTransport(), cache = CacheService.memory();
      final service = OrderService(api: api, cache: cache);
      try {
        api.detailReply = () async => {
          ...read.orderRow(),
          'id': 'wrong-record',
        };
        await expectLater(
          service.fetchOrder(read.recordId),
          throwsA(isA<FormatException>()),
        );
        expect(
          cache.readJsonMap(CacheService.orderDetailKey(read.recordId)),
          isNull,
        );
      } finally {
        service.dispose();
        api.close();
      }
    },
  );
  test(
    'captured store is a detail admission condition, never a new HTTP tenant grant',
    () async {
      final api = DetailReadTransport(), cache = CacheService.memory();
      final service = OrderService(api: api, cache: cache);
      try {
        api.detailReply = () async => read.orderRow(store: read.otherSite);
        await expectLater(
          service.fetchOrder(read.recordId, expectedStoreId: read.site),
          throwsA(isA<FormatException>()),
        );
        expect(service.hasFreshOrder(read.recordId), isFalse);
        expect(
          cache.readJsonMap(CacheService.orderDetailKey(read.recordId)),
          isNull,
        );
        expect(api.details.single!.expectedContextVersion, api.epoch);
        expect(api.details.single!.query, isNull);
      } finally {
        service.dispose();
        api.close();
      }
    },
  );
  test(
    'a superseded same-record detail read cannot replace the latest cache or live provenance',
    () async {
      final api = DetailReadTransport(),
          cache = CacheService.memory(),
          held = Completer<JsonMap>();
      final service = OrderService(api: api, cache: cache);
      try {
        api.detailReply = () => held.future;
        final original = service.fetchOrder(read.recordId);
        final rejected = expectLater(original, read.changed());
        api.detailReply = () async => read.orderRow(number: 'LATEST-SYNTHETIC');
        await service.fetchOrder(read.recordId);
        expect(service.hasFreshOrder(read.recordId), isTrue);
        held.complete(read.orderRow(number: 'SUPERSEDED-PRIVATE'));
        await rejected;
        expect(
          cache.readJsonMap(
            CacheService.orderDetailKey(read.recordId),
          )!['order_number'],
          'LATEST-SYNTHETIC',
        );
        expect(service.hasFreshOrder(read.recordId), isTrue);
      } finally {
        service.dispose();
        api.close();
      }
    },
  );
  test('A to B to a new A session cannot settle the first A detail', () async {
    final api = DetailReadTransport()..epoch = 0;
    final cache = CacheService.memory(
          actorIdProvider: () => 'same-synthetic-actor',
        ),
        held = Completer<JsonMap>();
    final service = OrderService(api: api, cache: cache);
    try {
      api.detailReply = () => held.future;
      final original = service.fetchOrder(read.recordId);
      final rejected = expectLater(original, read.changed());
      api.epoch = 1;
      api.epoch = 2;
      api.detailReply = () async => read.orderRow(number: 'CURRENT-NEW-A');
      await service.fetchOrder(read.recordId);
      held.complete(read.orderRow(number: 'FORMER-A-SESSION'));
      await rejected;
      expect(service.hasFreshOrder(read.recordId), isTrue);
      expect(
        cache.readJsonMap(
          CacheService.orderDetailKey(read.recordId),
        )!['order_number'],
        'CURRENT-NEW-A',
      );
    } finally {
      service.dispose();
      api.close();
    }
  });
  test(
    'a saved detail with foreign store identity cannot be adopted on transport failure',
    () async {
      final api = DetailReadTransport(), cache = CacheService.memory();
      final service = OrderService(api: api, cache: cache);
      try {
        await cache.writeJson(
          CacheService.orderDetailKey(read.recordId),
          read.orderRow(store: read.otherSite),
        );
        api.detailReply = () async => throw read.failure(503);
        await expectLater(
          service.fetchOrder(read.recordId, expectedStoreId: read.site),
          throwsA(isA<FormatException>()),
        );
        expect(service.cachedOrder(read.recordId), isNull);
        expect(service.hasFreshOrder(read.recordId), isFalse);
        expect(
          cache.readJsonMap(
            CacheService.orderDetailKey(read.recordId),
          )!['store_id'],
          read.otherSite,
          reason: 'Original saved bytes/retention are unchanged.',
        );
      } finally {
        service.dispose();
        api.close();
      }
    },
  );
}
