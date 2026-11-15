// ProductService + actual SDK/Dio request boundary. Owned Gateway and native
// journeys independently establish authority, effects and device acceptance.
import 'dart:async';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_store/services/api_client.dart';
import 'package:letbuyy_store/services/product_service.dart';

const site = 'aaaaaaaa-1111-4111-8111-111111111111',
    product = 'bbbbbbbb-2222-4222-8222-222222222222',
    variant = 'cccccccc-3333-4333-8333-333333333333',
    key = 'dddddddd-4444-4444-8444-444444444444';
JsonMap input() => {
  'store_id': site,
  'name': 'Synthetic code product',
  'price': 125,
  'stock': 0,
  'metadata': {
    'specifications': {'Code': 'A-1'},
  },
  'product_options': [
    {
      'name': 'Code',
      'position': 0,
      'values': ['A-1'],
    },
  ],
  'variants': [
    {
      'title': 'A-1',
      'stock': 0,
      'options': {'Code': 'A-1'},
    },
  ],
};
JsonMap response() => {
  'data': {
    'id': product,
    'store_id': site,
    'name': 'Synthetic code product',
    'price': 125,
    'stock': 0,
    'version': 7,
    'images': [],
  },
};

class Harness {
  final dio = Dio();
  late final ApiClient api;
  late final ProductService service;
  Harness() {
    api = ApiClient(
      baseUrl: 'https://synthetic-gateway.example.invalid',
      storeId: site,
      dio: dio,
      maxRetries: 0,
    );
    service = ProductService(api: api);
  }
  void close() {
    service.dispose();
    api.close();
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  for (final editing in [false, true])
    test(
      'catalog Code specification and option reach canonical transport editing=$editing',
      () async {
        final h = Harness();
        addTearDown(h.close);
        var calls = 0;
        h.dio.interceptors.add(
          InterceptorsWrapper(
            onRequest: (request, handler) {
              calls++;
              final body = request.data as Map;
              expect((body['metadata'] as Map)['specifications'], {
                'Code': 'A-1',
              });
              expect((((body['variants'] as List).single as Map)['options']), {
                'Code': 'A-1',
              });
              expect(request.headers['X-Idempotency-Key'], key);
              handler.resolve(
                Response<Object?>(
                  requestOptions: request,
                  statusCode: editing ? 200 : 201,
                  data: response(),
                ),
              );
            },
          ),
        );
        if (editing) {
          final fields = input()..remove('store_id');
          (fields['variants'] as List).single['id'] = variant;
          await h.service.updateProduct(
            product,
            fields,
            storeId: site,
            version: 1,
            idempotencyKey: key,
          );
        } else {
          await h.service.createProductCommand(
            storeId: site,
            input: input(),
            idempotencyKey: key,
            maxRetries: 0,
          );
        }
        expect(calls, 1);
      },
    );
  test(
    'creation captures nested caller input before awaiting acknowledgement',
    () async {
      final h = Harness();
      addTearDown(h.close);
      final seen =
          Completer<
            ({RequestOptions request, RequestInterceptorHandler handler})
          >();
      h.dio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (request, handler) =>
              seen.complete((request: request, handler: handler)),
        ),
      );
      final original = input(),
          saved = h.service.createProductCommand(
            storeId: site,
            input: original,
            idempotencyKey: key,
            maxRetries: 0,
          );
      final captured = await seen.future;
      original['name'] = 'Changed while in flight';
      ((original['metadata'] as Map)['specifications'] as Map)['Code'] = 'B-2';
      (((original['variants'] as List).single as Map)['options']
              as Map)['Code'] =
          'B-2';
      captured.handler.resolve(
        Response<Object?>(
          requestOptions: captured.request,
          statusCode: 201,
          data: response(),
        ),
      );
      expect((await saved)['id'], product);
      final wire = captured.request.data as Map;
      expect(wire['name'], 'Synthetic code product');
      expect((wire['metadata'] as Map)['specifications'], {'Code': 'A-1'});
      expect((((wire['variants'] as List).single as Map)['options']), {
        'Code': 'A-1',
      });
      expect(captured.request.headers['X-Idempotency-Key'], key);
      expect(h.service.products, hasLength(1));
    },
  );
}
