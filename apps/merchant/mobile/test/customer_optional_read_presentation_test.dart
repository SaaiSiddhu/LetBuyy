import 'dart:async';
import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_store/services/api_client.dart';
import 'package:letbuyy_store/services/cache_service.dart';
import 'package:letbuyy_store/services/customer_service.dart';
import 'customer_read_presentation_test.dart' as primary;

class OptionalCustomerTransport extends primary.CustomerReadTransport {
  Future<List<JsonMap>> Function(String)? optionalReply;
  @override
  Future<T> requestData<T>(
    String path, {
    ApiRequestOptions? options,
    required JsonDecoder<T> decoder,
  }) async => decoder(
    optionalReply == null ? [optionalRow()] : await optionalReply!(path),
  );
}

JsonMap optionalRow() => {
  'id': 'synthetic-optional-id',
  'store_id': primary.site,
  'customer_email': 'a@example.invalid',
  'note': 'Synthetic private note',
  'full_name': 'Synthetic address',
  'address_line1': 'Fixture',
  'city': 'Bengaluru',
  'state': 'Karnataka',
  'postal_code': '560001',
  'country': 'IN',
};
Future<Object> optionalRead(CustomerService service, String kind) async =>
    kind == 'notes'
    ? await service.fetchNotes('a@example.invalid', storeId: primary.site)
    : await service.fetchAddresses('a@example.invalid', storeId: primary.site);
void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  for (final kind in ['notes', 'addresses']) {
    for (final status in [401, 403])
      test(
        'current $kind$status retires shared private presentation after populated controls',
        () async {
          final api = OptionalCustomerTransport(),
              cache = CacheService.memory(
                actorIdProvider: () => 'synthetic-actor',
              );
          final current = CustomerService(api: api, cache: cache);
          try {
            final profile = await current.fetchCustomerByEmail(
              'a@example.invalid',
              storeId: primary.site,
            );
            expect(current.hasFreshCustomer(profile), isTrue);
            expect(await optionalRead(current, kind), hasLength(1));
            api.optionalReply = (_) async => throw primary.failure(status);
            await expectLater(
              optionalRead(current, kind),
              throwsA(isA<ApiException>()),
            );
            expect(current.hasDeniedRead(primary.site), isTrue);
            expect(current.hasFreshCustomer(profile), isFalse);
            expect(
              current.cachedCustomerByEmail(
                'a@example.invalid',
                storeId: primary.site,
              ),
              isNull,
            );
          } finally {
            current.dispose();
            api.close();
          }
        },
      );
    for (final identity in ['store', 'email'])
      test(
        '$kind rejects a wrong $identity optional response before presentation',
        () async {
          final api = OptionalCustomerTransport();
          final current = CustomerService(api: api);
          try {
            expect(await optionalRead(current, kind), hasLength(1));
            final row = optionalRow();
            row[identity == 'store'
                ? 'store_id'
                : 'customer_email'] = identity == 'store'
                ? '22222222-2222-4222-8222-222222222222'
                : 'b@example.invalid';
            api.optionalReply = (_) async => [row];
            await expectLater(
              optionalRead(current, kind),
              throwsA(
                isA<ApiException>().having(
                  (e) => e.code,
                  'code',
                  'CUSTOMER_SCOPE_MISMATCH',
                ),
              ),
            );
          } finally {
            current.dispose();
            api.close();
          }
        },
      );
    test(
      'older $kind positive cannot settle after a newer same-store profile denial',
      () async {
        final api = OptionalCustomerTransport();
        final service = CustomerService(api: api),
            held = Completer<List<JsonMap>>();
        try {
          await service.fetchCustomerByEmail(
            'a@example.invalid',
            storeId: primary.site,
          );
          expect(await optionalRead(service, kind), hasLength(1));
          api.optionalReply = (_) => held.future;
          final old = optionalRead(service, kind),
              outcome = expectLater(old, throwsA(isA<ApiException>()));
          api.reply = () async => throw primary.failure(403);
          await expectLater(
            service.fetchCustomerByEmail(
              'a@example.invalid',
              storeId: primary.site,
            ),
            throwsA(isA<ApiException>()),
          );
          held.complete([optionalRow()]);
          await outcome;
          expect(service.hasDeniedRead(primary.site), isTrue);
        } finally {
          if (!held.isCompleted) held.complete([optionalRow()]);
          service.dispose();
          api.close();
        }
      },
    );
  }
}
