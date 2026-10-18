// Boundary-only tests; interceptors do not prove Gateway ownership or device login.
import 'package:dio/dio.dart';
import 'package:letbuyy_api_client/letbuyy_api_client.dart';
import 'package:test/test.dart';

const site = '22222222-2222-4222-8222-222222222222';
({BuyerLoyaltyApi api, List<RequestOptions> requests}) transport(
  Object? body, {
  int status = 200,
}) {
  final requests = <RequestOptions>[];
  final dio = Dio();
  dio.interceptors.add(
    InterceptorsWrapper(
      onRequest: (r, h) {
        requests.add(r);
        h.resolve(Response(requestOptions: r, statusCode: status, data: body));
      },
    ),
  );
  return (
    api: BuyerLoyaltyApi(
      ApiClient(
        baseUrl: 'https://gateway.example.invalid/v1',
        dio: dio,
        maxRetries: 0,
      ),
    ),
    requests: requests,
  );
}

JsonMap enrolled(Object balance) => {
  'site_id': site,
  'enrolled': true,
  'balance': balance,
  'is_active': true,
};
JsonMap entry(Object points) => {
  'id': 'entry-1',
  'entry_type': 'earned',
  'points': points,
  'balance_after': points,
  'order_id': null,
  'created_at': '2026-10-16T00:00:00Z',
};
void main() {
  test('summary binds the seller path and only the canonical buyer header, preserving exact integer strings', () async {
    final h = transport({
      'success': true,
      'data': enrolled('9007199254740993'),
    });
    expect(
      (await h.api.summary('synthetic-buyer', site))['balance'],
      '9007199254740993',
    );
    final request = h.requests.single;
    expect(request.uri.path, '/v1/storefront/buyer/loyalty/$site');
    expect(request.headers[letbuyyBuyerSessionHeader], 'synthetic-buyer');
    expect(request.headers.containsKey('Authorization'), isFalse);
    expect(request.queryParameters, isEmpty);
  });
  test('not enrolled, enrolled zero and paused remain distinct', () async {
    final absent = transport({
      'data': {'site_id': site, 'enrolled': false, 'balance': null},
    });
    expect((await absent.api.summary('token', site))['balance'], isNull);
    final zero = transport({'data': enrolled(0)});
    expect((await zero.api.summary('token', site))['balance'], '0');
    final paused = transport({
      'data': {...enrolled(7), 'is_active': false},
    });
    expect((await paused.api.summary('token', site))['is_active'], false);
  });
  test('bounded recent history preserves integer precision without a caller-selected buyer', () async {
    final h = transport({
      'data': [entry('9007199254740993')],
    });
    expect(
      (await h.api.history('token', site, limit: 1)).single['points'],
      '9007199254740993',
    );
    expect(
      h.requests.single.uri.path,
      '/v1/storefront/buyer/loyalty/$site/history',
    );
    expect(h.requests.single.queryParameters, {'limit': 1});
    expect(h.requests.single.headers[letbuyyBuyerSessionHeader], 'token');
  });
  test('invalid seller and history limits never send a request', () async {
    final h = transport({});
    await expectLater(
      h.api.summary('token', '../other-buyer'),
      throwsArgumentError,
    );
    for (final limit in [0, 101]) {
      await expectLater(
        h.api.history('token', site, limit: limit),
        throwsRangeError,
      );
    }
    expect(h.requests, isEmpty);
  });
  test(
    'malformed or unsafe summaries fail rather than inventing a zero balance',
    () async {
      for (final data in [
        enrolled(9007199254740992),
        enrolled(1.5),
        enrolled('-1'),
        enrolled('1e3'),
        {...enrolled(4), 'site_id': '11111111-1111-4111-8111-111111111111'},
        {...enrolled(4), 'is_active': 'true'},
        {'site_id': site, 'enrolled': false, 'balance': 0},
      ]) {
        final h = transport({'data': data});
        await expectLater(
          h.api.summary('token', site),
          throwsA(
            isA<ApiException>().having(
              (e) => e.code,
              'code',
              'INVALID_RESPONSE',
            ),
          ),
        );
      }
    },
  );
  test('malformed, oversized or unsafe history is an error rather than empty activity', () async {
    for (final data in [
      'wrong',
      [
        {...entry(1), 'created_at': 'invalid'},
      ],
      [entry(9007199254740992)],
      [entry(1), entry(2)],
    ]) {
      final h = transport({'data': data});
      await expectLater(
        h.api.history('token', site, limit: 1),
        throwsA(
          isA<ApiException>().having((e) => e.code, 'code', 'INVALID_RESPONSE'),
        ),
      );
    }
  });
  test('expired session, ownership denial and server failure remain failures for both reads', () async {
    for (final status in [401, 403, 500, 503]) {
      final h = transport({
        'error': {'code': 'UNAVAILABLE', 'message': 'Unavailable'},
      }, status: status);
      await expectLater(
        h.api.summary('token', site),
        throwsA(
          isA<ApiException>().having((e) => e.statusCode, 'status', status),
        ),
      );
      await expectLater(
        h.api.history('token', site),
        throwsA(
          isA<ApiException>().having((e) => e.statusCode, 'status', status),
        ),
      );
    }
  });
}
