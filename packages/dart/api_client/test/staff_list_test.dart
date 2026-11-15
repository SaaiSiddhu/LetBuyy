import 'package:dio/dio.dart';
import 'package:letbuyy_api_client/letbuyy_api_client.dart';
import 'package:test/test.dart';

const store = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
JsonMap page(int number, {int total = 53}) => {
  'success': true,
  'data': List.generate(
    (total - (number - 1) * 50).clamp(0, 50),
    (i) => {
      'id': 'staff-${(number - 1) * 50 + i}',
      'store_id': store,
      'email': 'syn-staff@example.invalid',
    },
  ),
  'meta': {
    'page': number,
    'per_page': 50,
    'total': total,
    'total_pages': (total / 50).ceil(),
    'has_prev': number > 1,
    'has_next': number * 50 < total,
  },
};
void main() {
  for (final fault in [
    'none',
    'empty',
    'missing-meta',
    'missing-count',
    'wrong-page',
    'wrong-size',
    'wrong-end',
    'count-change',
    'duplicate',
    'foreign-store',
    'short-tail',
    'tail-denial',
    'tail-outage',
    'retired-frame',
  ]) {
    test('Dart complete Staff roster $fault', () async {
      Object frame = Object();
      final calls = <RequestOptions>[];
      final client = ApiClient(
        baseUrl: 'https://gateway.test/v1',
        maxRetries: 0,
        contextVersionProvider: () => frame,
      );
      addTearDown(client.close);
      client.dio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (r, h) {
            calls.add(r);
            final n = calls.length;
            final body = page(n, total: fault == 'empty' ? 0 : 53);
            final meta = body['meta'] as JsonMap;
            if (n == 2 && ['tail-denial', 'tail-outage'].contains(fault)) {
              h.resolve(
                Response(
                  requestOptions: r,
                  statusCode: fault == 'tail-denial' ? 403 : 503,
                  data: {
                    'error': {'code': 'SYNTHETIC', 'message': 'Unavailable'},
                  },
                ),
              );
              return;
            }
            if (n == 2)
              switch (fault) {
                case 'missing-meta':
                  body.remove('meta');
                  break;
                case 'missing-count':
                  meta.remove('total');
                  break;
                case 'wrong-page':
                  meta['page'] = 1;
                  break;
                case 'wrong-size':
                  meta['per_page'] = 49;
                  break;
                case 'wrong-end':
                  meta['has_next'] = true;
                  break;
                case 'count-change':
                  meta['total'] = 54;
                  break;
                case 'duplicate':
                  (body['data'] as List)[0]['id'] = 'staff-0';
                  break;
                case 'foreign-store':
                  (body['data'] as List)[0]['store_id'] = 'foreign';
                  break;
                case 'short-tail':
                  (body['data'] as List).removeLast();
                  break;
              }
            if (fault == 'retired-frame') frame = Object();
            h.resolve(Response(requestOptions: r, statusCode: 200, data: body));
          },
        ),
      );
      if (fault == 'none' || fault == 'empty') {
        final rows = await client.employees.list(storeId: store);
        expect(rows, hasLength(fault == 'empty' ? 0 : 53));
        expect(calls, hasLength(fault == 'empty' ? 1 : 2));
        for (final r in calls) {
          expect(r.queryParameters['store_id'], store);
          expect(r.queryParameters['limit'], 50);
        }
      } else {
        await expectLater(
          client.employees.list(storeId: store),
          throwsA(
            isA<ApiException>().having(
              (e) => e.statusCode,
              'status',
              fault == 'retired-frame'
                  ? 409
                  : fault == 'tail-denial'
                  ? 403
                  : 503,
            ),
          ),
        );
        expect(calls, hasLength(fault == 'retired-frame' ? 1 : 2));
      }
    });
  }
}
