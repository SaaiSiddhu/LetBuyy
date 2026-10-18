import 'api_client.dart';
import 'buyer_sign_in.dart' show letbuyyBuyerSessionHeader;
import 'types.dart';

/// Read-only, session-owned public support projections. The current Gateway has
/// bounded windows, not pagination: latest 50 tickets and first 200 messages.
/// Creation, replies and attachments require separate canonical write contracts.
class BuyerSupportApi {
  BuyerSupportApi(this._client);
  final ApiClient _client;

  static const maxTickets = 50;
  static const maxMessages = 200;
  static final _uuid = RegExp(
    r'^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',
    caseSensitive: false,
  );
  static final _timestamp = RegExp(
    r'^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$',
  );

  Future<List<JsonMap>> listTickets(
    String sessionToken, {
    int limit = maxTickets,
  }) async {
    RangeError.checkValueInInterval(limit, 1, maxTickets, 'limit');
    final result = await _read(
      '/storefront/buyer/support/tickets',
      sessionToken,
      query: {'limit': limit},
    );
    if (result.length > limit) throw _invalid();
    return _project(result, (row) {
      for (final field in ['ticket_ref', 'subject', 'topic']) {
        if (!row.containsKey(field) ||
            (row[field] != null && row[field] is! String))
          throw _invalid();
      }
      if (row['status'] is! String || (row['status'] as String).trim().isEmpty)
        throw _invalid();
      _date(row['created_at']);
      if (!row.containsKey('last_agent_message_at')) throw _invalid();
      if (row['last_agent_message_at'] != null)
        _date(row['last_agent_message_at']);
      return {
        for (final field in [
          'id',
          'ticket_ref',
          'subject',
          'status',
          'topic',
          'created_at',
          'last_agent_message_at',
        ])
          field: row[field],
      };
    });
  }

  /// The requested ticket's ownership is checked by the Gateway before reading
  /// messages. No email, selected site or caller-supplied owner grants authority.
  Future<List<JsonMap>> listPublicMessages(
    String sessionToken,
    String ticketId,
  ) async {
    if (!_uuid.hasMatch(ticketId))
      throw ArgumentError.value(ticketId, 'ticketId', 'must be a ticket UUID');
    final result = await _read(
      '/storefront/buyer/support/tickets/${Uri.encodeComponent(ticketId)}/messages',
      sessionToken,
    );
    if (result.length > maxMessages) throw _invalid();
    return _project(result, (row) {
      if (!['requester', 'agent', 'system'].contains(row['author_type']) ||
          row['body'] is! String)
        throw _invalid();
      // These fields are absent from the normal public projection. If a changed
      // server supplies them, never display an explicitly private/foreign row.
      if (row.containsKey('visibility') && row['visibility'] != 'public')
        throw _invalid();
      if (row.containsKey('ticket_id') &&
          (row['ticket_id'] is! String ||
              (row['ticket_id'] as String).toLowerCase() !=
                  ticketId.toLowerCase()))
        throw _invalid();
      _date(row['created_at']);
      return {
        for (final field in ['id', 'author_type', 'body', 'created_at'])
          field: row[field],
      };
    });
  }

  Future<List<dynamic>> _read(
    String path,
    String token, {
    QueryParams? query,
  }) async {
    if (token.trim().isEmpty)
      throw ArgumentError('A buyer session is required.');
    final body = await _client.get(
      path,
      options: ApiRequestOptions(
        headers: {letbuyyBuyerSessionHeader: token},
        query: query,
      ),
    );
    if (body is! Map || body['success'] != true || body['data'] is! List)
      throw _invalid();
    return body['data'] as List;
  }

  static List<JsonMap> _project(
    List<dynamic> rows,
    JsonMap Function(Map<dynamic, dynamic>) project,
  ) {
    final ids = <String>{};
    return List<JsonMap>.unmodifiable(
      rows.map((row) {
        if (row is! Map ||
            row['id'] is! String ||
            !_uuid.hasMatch(row['id'] as String) ||
            !ids.add((row['id'] as String).toLowerCase()))
          throw _invalid();
        return Map<String, dynamic>.unmodifiable(project(row));
      }),
    );
  }

  static void _date(Object? value) {
    if (value is! String ||
        !_timestamp.hasMatch(value) ||
        DateTime.tryParse(value) == null)
      throw _invalid();
  }

  static ApiException _invalid() => const ApiException(
    message: 'Unexpected public support response.',
    statusCode: 502,
    code: 'INVALID_RESPONSE',
  );
}
