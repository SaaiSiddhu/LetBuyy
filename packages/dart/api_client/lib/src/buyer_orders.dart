import 'api_client.dart';
import 'buyer_sign_in.dart' show letbuyyBuyerSessionHeader;
import 'types.dart';

/// Cursor transport metadata. Order records retain the gateway's JSON contract;
/// this does not invent a total or adapt them into the retired marketplace model.
class BuyerOrdersPage {
  const BuyerOrdersPage({required this.orders, required this.hasMore, this.nextCursor});

  final List<JsonMap> orders;
  final bool hasMore;
  final String? nextCursor;
}

/// Canonical, session-owned app order reads. The gateway resolves ownership from
/// buyer_order_links; neither a buyer id nor an email/site authority is supplied.
class BuyerOrdersApi {
  BuyerOrdersApi(this._client);
  final ApiClient _client;

  Future<BuyerOrdersPage> list(String sessionToken, {int limit = 20, String? cursor}) async {
    RangeError.checkValueInInterval(limit, 1, 50, 'limit');
    if (cursor != null && cursor.isEmpty) throw ArgumentError.value(cursor, 'cursor', 'must not be empty');
    final body = asJsonMap(await _client.get('/storefront/buyer/orders', options: ApiRequestOptions(
      headers: {letbuyyBuyerSessionHeader: sessionToken},
      query: {'limit': limit, if (cursor != null) 'cursor': cursor},
    )));
    final data = body['data'];
    if (data is! Map || data['orders'] is! List || data['has_more'] is! bool
        || (data['next_cursor'] != null && data['next_cursor'] is! String)
        || (data['has_more'] == true && (data['next_cursor'] is! String || (data['next_cursor'] as String).isEmpty))) {
      throw _invalid();
    }
    final orders = <JsonMap>[];
    for (final row in data['orders'] as List) {
      if (row is! Map || row['id'] is! String || (row['id'] as String).isEmpty
          || row['site_id'] is! String || (row['site_id'] as String).isEmpty) throw _invalid();
      orders.add(Map<String, dynamic>.unmodifiable(asJsonMap(row)));
    }
    return BuyerOrdersPage(orders: List.unmodifiable(orders), hasMore: data['has_more'] as bool, nextCursor: data['next_cursor'] as String?);
  }

  Future<JsonMap> get(String sessionToken, String orderId) async {
    final body = asJsonMap(await _client.get('/storefront/buyer/orders/${Uri.encodeComponent(orderId)}',
      options: ApiRequestOptions(headers: {letbuyyBuyerSessionHeader: sessionToken})));
    final data = body['data'];
    final order = data is Map ? data['order'] : null;
    if (order is! Map || order['id'] is! String || (order['id'] as String).toLowerCase() != orderId.toLowerCase()
        || order['site_id'] is! String || order['items'] is! List) throw _invalid();
    if ((order['items'] as List).any((item) => item is! Map)) throw _invalid();
    return Map<String, dynamic>.unmodifiable(asJsonMap(order));
  }

  static ApiException _invalid() => const ApiException(message: 'Unexpected order response.', statusCode: 502, code: 'INVALID_RESPONSE');
}
