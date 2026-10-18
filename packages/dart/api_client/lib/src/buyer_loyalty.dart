import 'api_client.dart';
import 'buyer_sign_in.dart' show letbuyyBuyerSessionHeader;
import 'types.dart';

/// Read-only transport for the existing per-seller loyalty ledger. The Gateway
/// derives the buyer from the canonical session; no caller-selected buyer or
/// store-customer identifier is sent. Integer strings preserve ledger precision.
class BuyerLoyaltyApi {
  BuyerLoyaltyApi(this._client);
  final ApiClient _client;
  static final _uuid = RegExp(
    r'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$',
  );

  String _path(String siteId) {
    if (!_uuid.hasMatch(siteId))
      throw ArgumentError.value(siteId, 'siteId', 'must be a seller UUID');
    return '/storefront/buyer/loyalty/${Uri.encodeComponent(siteId)}';
  }

  Future<JsonMap> summary(String sessionToken, String siteId) async {
    final body = asJsonMap(
      await _client.get(
        _path(siteId),
        options: ApiRequestOptions(
          headers: {letbuyyBuyerSessionHeader: sessionToken},
        ),
      ),
    );
    final data = body['data'];
    if (data is! Map ||
        data['site_id'] is! String ||
        (data['site_id'] as String).toLowerCase() != siteId.toLowerCase() ||
        data['enrolled'] is! bool)
      throw _invalid();
    if (data['enrolled'] == false) {
      if (data['balance'] != null) throw _invalid();
      return Map<String, dynamic>.unmodifiable({
        'site_id': data['site_id'],
        'enrolled': false,
        'balance': null,
      });
    }
    if (data['is_active'] is! bool) throw _invalid();
    final balance = _integer(data['balance']);
    if (balance.startsWith('-')) throw _invalid();
    return Map<String, dynamic>.unmodifiable({
      ...asJsonMap(data),
      'balance': balance,
    });
  }

  /// A bounded recent-activity window, not a claim to the buyer's full history.
  Future<List<JsonMap>> history(
    String sessionToken,
    String siteId, {
    int limit = 25,
  }) async {
    RangeError.checkValueInInterval(limit, 1, 100, 'limit');
    final body = asJsonMap(
      await _client.get(
        '${_path(siteId)}/history',
        options: ApiRequestOptions(
          headers: {letbuyyBuyerSessionHeader: sessionToken},
          query: {'limit': limit},
        ),
      ),
    );
    final data = body['data'];
    if (data is! List || data.length > limit) throw _invalid();
    return List.unmodifiable(
      data.map((row) {
        if (row is! Map ||
            row['id'] is! String ||
            (row['id'] as String).isEmpty ||
            row['entry_type'] is! String ||
            (row['entry_type'] as String).isEmpty ||
            row['created_at'] is! String ||
            DateTime.tryParse(row['created_at'] as String) == null ||
            (row['order_id'] != null && row['order_id'] is! String))
          throw _invalid();
        return Map<String, dynamic>.unmodifiable({
          ...asJsonMap(row),
          'points': _integer(row['points']),
          'balance_after': _integer(row['balance_after']),
        });
      }),
    );
  }

  static String _integer(Object? value) {
    if (value is int && value.abs() <= 9007199254740991)
      return value.toString();
    if (value is String && RegExp(r'^-?(0|[1-9][0-9]*)$').hasMatch(value))
      return value;
    throw _invalid();
  }

  static ApiException _invalid() => const ApiException(
    message: 'Unexpected rewards response.',
    statusCode: 502,
    code: 'INVALID_RESPONSE',
  );
}
