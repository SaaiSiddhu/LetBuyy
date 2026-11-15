// Existing service/SDK/cache with controlled transport completion. This is
// client lifetime/record admission evidence, not hosted database permission.
import 'dart:async';
import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_store/services/api_client.dart';
import 'package:letbuyy_store/services/cache_service.dart';
import 'package:letbuyy_store/services/customer_service.dart';

const site = '11111111-1111-4111-8111-111111111111';
JsonMap profile({
  String email = 'a@example.invalid',
  String name = 'Current synthetic profile',
}) => {
  'id': 'synthetic-profile-$email',
  'store_id': site,
  'email': email,
  'display_name': name,
  'status': 'active',
  'order_count': 1,
  'total_spent': 19.25,
};
ApiException failure(int status) => ApiException(
  message: 'Synthetic unavailable',
  statusCode: status,
  code: 'SYNTHETIC_READ_FAILURE',
);

class CustomerReadTransport extends ApiClient {
  CustomerReadTransport()
    : super(
        baseUrl: 'https://customer-read.synthetic.invalid/v1',
        maxRetries: 0,
      );
  int epoch = 0;
  Future<JsonMap> Function()? reply;
  @override
  Object captureRequestContext() => epoch;
  @override
  Future<JsonMap> requestJson(
    String path, {
    ApiRequestOptions? options,
  }) async => reply == null ? profile() : reply!();
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  for (final status in [401, 403, 404])
    test(
      'newer current$status retires an older same-record positive before it can repopulate cache',
      () async {
        final api = CustomerReadTransport(),
            cache = CacheService.memory(
              actorIdProvider: () => 'synthetic-actor',
            );
        final service = CustomerService(api: api, cache: cache);
        final held = Completer<JsonMap>();
        try {
          expect(
            (await service.fetchCustomerByEmail(
              'a@example.invalid',
              storeId: site,
            )).email,
            'a@example.invalid',
          );
          expect(
            service.cachedCustomerByEmail('a@example.invalid', storeId: site),
            isNotNull,
          );
          api.reply = () => held.future;
          final old = service.fetchCustomerByEmail(
                'a@example.invalid',
                storeId: site,
              ),
              outcome = expectLater(old, throwsA(isA<ApiException>()));
          api.reply = () async => throw failure(status);
          await expectLater(
            service.fetchCustomerByEmail('a@example.invalid', storeId: site),
            throwsA(isA<ApiException>()),
          );
          expect(
            service.cachedCustomerByEmail('a@example.invalid', storeId: site),
            isNull,
          );
          held.complete(profile(name: 'Retired late synthetic profile'));
          await outcome;
          expect(
            service.cachedCustomerByEmail('a@example.invalid', storeId: site),
            isNull,
          );
        } finally {
          if (!held.isCompleted) held.complete(profile());
          service.dispose();
          api.close();
        }
      },
    );
  test(
    'newer same-store read denial cannot be cleared by an older different-record positive',
    () async {
      final api = CustomerReadTransport(),
          cache = CacheService.memory(actorIdProvider: () => 'synthetic-actor');
      final service = CustomerService(api: api, cache: cache);
      final held = Completer<JsonMap>();
      try {
        await service.fetchCustomerByEmail('a@example.invalid', storeId: site);
        api.reply = () => held.future;
        final old = service.fetchCustomerByEmail(
              'a@example.invalid',
              storeId: site,
            ),
            outcome = expectLater(old, throwsA(isA<ApiException>()));
        api.reply = () async => throw failure(403);
        await expectLater(
          service.fetchCustomerByEmail('b@example.invalid', storeId: site),
          throwsA(isA<ApiException>()),
        );
        expect(
          service.cachedCustomerByEmail('a@example.invalid', storeId: site),
          isNull,
        );
        held.complete(profile());
        await outcome;
        expect(
          service.cachedCustomerByEmail('a@example.invalid', storeId: site),
          isNull,
        );
        api.reply = () async => throw failure(503);
        await expectLater(
          service.fetchCustomerByEmail('a@example.invalid', storeId: site),
          throwsA(isA<ApiException>()),
        );
        expect(
          service.cachedCustomerByEmail('a@example.invalid', storeId: site),
          isNull,
        );
        api.reply = () async => profile(name: 'Reconfirmed synthetic profile');
        expect(
          (await service.fetchCustomerByEmail(
            'a@example.invalid',
            storeId: site,
          )).displayName,
          'Reconfirmed synthetic profile',
        );
      } finally {
        if (!held.isCompleted) held.complete(profile());
        service.dispose();
        api.close();
      }
    },
  );
  test(
    'newer same-record positive remains the stored result after older completion',
    () async {
      final api = CustomerReadTransport(),
          cache = CacheService.memory(actorIdProvider: () => 'synthetic-actor');
      final service = CustomerService(api: api, cache: cache);
      final held = Completer<JsonMap>();
      try {
        await service.fetchCustomerByEmail('a@example.invalid', storeId: site);
        api.reply = () => held.future;
        final old = service.fetchCustomerByEmail(
              'a@example.invalid',
              storeId: site,
            ),
            outcome = expectLater(old, throwsA(isA<ApiException>()));
        api.reply = () async => profile(name: 'New current profile');
        await service.fetchCustomerByEmail('a@example.invalid', storeId: site);
        held.complete(profile(name: 'Old superseded profile'));
        await outcome;
        expect(
          service
              .cachedCustomerByEmail('a@example.invalid', storeId: site)!
              .displayName,
          'New current profile',
        );
      } finally {
        if (!held.isCompleted) held.complete(profile());
        service.dispose();
        api.close();
      }
    },
  );
  test(
    'same-store wrong-email response cannot become the requested cached identity',
    () async {
      final api = CustomerReadTransport(),
          cache = CacheService.memory(actorIdProvider: () => 'synthetic-actor');
      final service = CustomerService(api: api, cache: cache);
      try {
        await service.fetchCustomerByEmail('a@example.invalid', storeId: site);
        api.reply = () async => profile(email: 'b@example.invalid');
        await expectLater(
          service.fetchCustomerByEmail('a@example.invalid', storeId: site),
          throwsA(isA<ApiException>()),
        );
        expect(
          service.cachedCustomerByEmail('a@example.invalid', storeId: site),
          isNull,
        );
      } finally {
        service.dispose();
        api.close();
      }
    },
  );
  test(
    'disposed detail read cannot publish or replace its existing stored bytes',
    () async {
      final api = CustomerReadTransport(),
          cache = CacheService.memory(actorIdProvider: () => 'synthetic-actor');
      final service = CustomerService(api: api, cache: cache);
      final held = Completer<JsonMap>();
      await service.fetchCustomerByEmail('a@example.invalid', storeId: site);
      final key = CacheService.customerDetailKey(site, 'a@example.invalid'),
          before = cache.readJsonMap(
            CacheService.customerDetailKey(site, 'a@example.invalid'),
          );
      api.reply = () => held.future;
      final old = service.fetchCustomerByEmail(
            'a@example.invalid',
            storeId: site,
          ),
          outcome = expectLater(old, throwsA(isA<ApiException>()));
      service.dispose();
      held.complete(profile(name: 'Disposed late profile'));
      try {
        await outcome;
        expect(cache.readJsonMap(key), before);
        expect(
          service.cachedCustomerByEmail('a@example.invalid', storeId: site),
          isNull,
        );
      } finally {
        api.close();
      }
    },
  );
  test(
    'live, stored and retired detail models keep distinct current-view provenance',
    () async {
      final api = CustomerReadTransport(),
          cache = CacheService.memory(actorIdProvider: () => 'synthetic-actor');
      final service = CustomerService(api: api, cache: cache);
      try {
        final live = await service.fetchCustomerByEmail(
          'a@example.invalid',
          storeId: site,
        );
        expect(service.hasFreshCustomer(live), isTrue);
        api.reply = () async => throw failure(503);
        final stored = await service.fetchCustomerByEmail(
          'a@example.invalid',
          storeId: site,
        );
        expect(stored.email, live.email);
        expect(service.hasFreshCustomer(stored), isFalse);
        expect(service.hasFreshCustomer(live), isFalse);
        api.reply = () async => profile(name: 'Reconfirmed current profile');
        final current = await service.fetchCustomerByEmail(
          'a@example.invalid',
          storeId: site,
        );
        expect(service.hasFreshCustomer(current), isTrue);
        api.epoch++;
        expect(service.hasFreshCustomer(current), isFalse);
      } finally {
        service.dispose();
        api.close();
      }
    },
  );
}
