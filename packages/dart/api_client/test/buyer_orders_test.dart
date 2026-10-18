// Transport/response-boundary tests. Actual Gateway/database ownership is proved
// separately by the owned order lane, never by this Dio interceptor.
import 'package:dio/dio.dart';
import 'package:letbuyy_api_client/letbuyy_api_client.dart';
import 'package:test/test.dart';

const orderId = '11111111-1111-4111-8111-111111111111';
const siteId = '22222222-2222-4222-8222-222222222222';

({BuyerOrdersApi api, List<RequestOptions> requests}) transport(Object? body, {int status = 200}) {
  final dio = Dio();
  final requests = <RequestOptions>[];
  dio.interceptors.add(InterceptorsWrapper(onRequest: (request, handler) {
    requests.add(request);
    handler.resolve(Response(requestOptions: request, statusCode: status, data: body));
  }));
  return (api: BuyerOrdersApi(ApiClient(baseUrl: 'https://gateway.example.invalid/v1', dio: dio, maxRetries: 0)), requests: requests);
}

void main() {
  test('cursor list uses only the canonical buyer session and preserves gateway records', () async {
    final h = transport({'success': true, 'data': {'orders': [{'id': orderId, 'site_id': siteId, 'total': null}], 'has_more': true, 'next_cursor': 'opaque+/='}});
    final page = await h.api.list('synthetic-buyer-token', limit: 1, cursor: 'previous+/=');
    expect(page.orders.single['total'], isNull);
    expect(page.hasMore, isTrue);
    expect(page.nextCursor, 'opaque+/=');
    expect(h.requests.single.uri.path, '/v1/storefront/buyer/orders');
    expect(h.requests.single.queryParameters, {'limit': 1, 'cursor': 'previous+/='});
    expect(h.requests.single.headers[letbuyyBuyerSessionHeader], 'synthetic-buyer-token');
    expect(h.requests.single.headers.containsKey('Authorization'), isFalse);
    expect(h.requests.single.queryParameters.containsKey('buyer_account_id'), isFalse);
    expect(h.requests.single.queryParameters.containsKey('site_id'), isFalse);
  });

  test('invalid pagination arguments never send a request', () async {
    final h = transport({});
    for (final limit in [0, 51]) {
      await expectLater(h.api.list('token', limit: limit), throwsRangeError);
    }
    await expectLater(h.api.list('token', cursor: ''), throwsArgumentError);
    expect(h.requests, isEmpty);
  });

  test('malformed pages fail explicitly instead of pretending the buyer has no orders', () async {
    for (final data in [
      {'orders': [], 'has_more': true, 'next_cursor': null},
      {'orders': 'wrong', 'has_more': false, 'next_cursor': null},
      {'orders': [{'id': orderId}], 'has_more': false, 'next_cursor': null},
      {'orders': [], 'has_more': 'false', 'next_cursor': null},
    ]) {
      final h = transport({'success': true, 'data': data});
      await expectLater(h.api.list('token'), throwsA(isA<ApiException>().having((e) => e.code, 'code', 'INVALID_RESPONSE')));
    }
  });

  test('detail uses the exact order path without a client-supplied site or owner', () async {
    final h = transport({'success': true, 'data': {'order': {'id': orderId, 'site_id': siteId, 'items': [], 'shipping_address': {'line1': 'Synthetic Street'}}}});
    final order = await h.api.get('synthetic-buyer-token', orderId);
    expect(order['shipping_address'], {'line1': 'Synthetic Street'});
    expect(h.requests.single.uri.path, '/v1/storefront/buyer/orders/$orderId');
    expect(h.requests.single.queryParameters, isEmpty);
    expect(h.requests.single.headers[letbuyyBuyerSessionHeader], 'synthetic-buyer-token');
  });

  test('a mismatched detail or malformed items cannot be shown as the requested order', () async {
    for (final order in [
      {'id': siteId, 'site_id': siteId, 'items': []},
      {'id': orderId, 'site_id': siteId, 'items': ['wrong']},
      {'id': orderId, 'items': []},
    ]) {
      final h = transport({'success': true, 'data': {'order': order}});
      await expectLater(h.api.get('token', orderId), throwsA(isA<ApiException>().having((e) => e.code, 'code', 'INVALID_RESPONSE')));
    }
  });

  test('ownership denial and an unavailable server remain errors, never empty history', () async {
    for (final status in [401, 404, 500]) {
      final h = transport({'success': false, 'error': {'code': status == 404 ? 'NOT_FOUND' : 'UNAVAILABLE', 'message': 'Unavailable'}}, status: status);
      await expectLater(h.api.get('token', orderId), throwsA(isA<ApiException>().having((e) => e.statusCode, 'status', status)));
      expect(h.requests.length, 1);
    }
  });
}
