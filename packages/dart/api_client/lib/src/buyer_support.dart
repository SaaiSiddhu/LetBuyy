import 'api_client.dart';
import 'buyer_sign_in.dart' show letbuyyBuyerSessionHeader;
import 'types.dart';

class BuyerSupportPage {
  BuyerSupportPage({
    required List<JsonMap> items,
    required this.hasMore,
    this.nextCursor,
  }) : items = List<JsonMap>.unmodifiable(
         items.map((item) => Map<String, dynamic>.unmodifiable(item)),
       );
  final List<JsonMap> items;
  final bool hasMore;
  final String? nextCursor;
}

class BuyerSupportReceipt {
  const BuyerSupportReceipt._(
    this.key,
    this.operation,
    this.ticketId,
    this.messageId,
    this.confirmedAt,
  );
  final String key;
  final String operation;
  final String ticketId;
  final String messageId;
  final String confirmedAt;
}

class BuyerSupportCreatedTicket {
  const BuyerSupportCreatedTicket._(
    this.ticket,
    this.complaintCopy,
    this.receipt,
  );
  final JsonMap ticket;
  final JsonMap complaintCopy;
  final BuyerSupportReceipt receipt;
}

class BuyerSupportReply {
  const BuyerSupportReply._(this.message, this.receipt);
  final JsonMap message;
  final BuyerSupportReceipt receipt;
}

/// Canonical buyer-owned public support. Legacy reads retain their bounded
/// array contract; cursor pages provide complete public history. Every native
/// mutation requires the caller's durably saved logical action key.
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
    return _tickets(result);
  }

  static List<JsonMap> _tickets(List<dynamic> result) {
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
    return _messages(result, ticketId);
  }

  static List<JsonMap> _messages(List<dynamic> result, String ticketId) {
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

  Future<BuyerSupportPage> listTicketPage(
    String sessionToken, {
    int limit = maxTickets,
    String? cursor,
  }) => _page(
    '/storefront/buyer/support/tickets',
    sessionToken,
    limit,
    maxTickets,
    cursor,
    null,
  );

  Future<BuyerSupportPage> listPublicMessagePage(
    String sessionToken,
    String ticketId, {
    int limit = maxMessages,
    String? cursor,
  }) {
    _id(ticketId);
    return _page(
      '/storefront/buyer/support/tickets/${Uri.encodeComponent(ticketId)}/messages',
      sessionToken,
      limit,
      maxMessages,
      cursor,
      ticketId,
    );
  }

  Future<BuyerSupportPage> _page(
    String path,
    String token,
    int limit,
    int maximum,
    String? cursor,
    String? ticketId,
  ) async {
    RangeError.checkValueInInterval(limit, 1, maximum, 'limit');
    if (cursor != null && (cursor.isEmpty || cursor.length > 1024))
      throw ArgumentError('Invalid support cursor.');
    _token(token);
    final response = await _client.get(
      path,
      options: ApiRequestOptions(
        headers: {letbuyyBuyerSessionHeader: token},
        query: {
          'pagination': 'cursor',
          'limit': limit,
          if (cursor != null) 'cursor': cursor,
        },
      ),
    );
    final data = _data(response);
    if (data['items'] is! List || data['has_more'] is! bool) throw _invalid();
    final rows = data['items'] as List;
    final more = data['has_more'] as bool, next = data['next_cursor'];
    if (rows.length > limit ||
        (more &&
            (rows.isEmpty ||
                next is! String ||
                next.isEmpty ||
                next.length > 1024)) ||
        (!more && next != null))
      throw _invalid();
    final items = ticketId == null ? _tickets(rows) : _messages(rows, ticketId);
    return BuyerSupportPage(
      items: items,
      hasMore: more,
      nextCursor: next as String?,
    );
  }

  Future<BuyerSupportCreatedTicket> createTicket(
    String sessionToken, {
    required String key,
    required String subject,
    required String body,
    String? siteId,
    String? orderId,
  }) async {
    _key(key);
    _token(sessionToken);
    final normalizedSubject = _text(subject, 200),
        normalizedBody = _text(body, 4000);
    if (siteId != null) _id(siteId);
    if (orderId != null) _id(orderId);
    final data = _data(
      await _client.post(
        '/storefront/buyer/support/tickets',
        options: ApiRequestOptions(
          headers: {letbuyyBuyerSessionHeader: sessionToken},
          idempotencyKey: key,
          maxRetries: 0,
          body: {
            'subject': normalizedSubject,
            'body': normalizedBody,
            if (siteId != null) 'site_id': siteId,
            if (orderId != null) 'order_id': orderId,
          },
        ),
      ),
    );
    final ticket = _tickets([data]).single;
    final receipt = _receipt(
      data['mutation_receipt'],
      key,
      'create',
      ticket['id'] as String,
    );
    final copy = data['complaint_copy'];
    if (copy is! Map ||
        copy['subject'] != normalizedSubject ||
        ticket['subject'] != normalizedSubject ||
        copy['body'] != normalizedBody ||
        copy['recorded_at'] != receipt.confirmedAt ||
        data['receipt_confirmed_at'] != receipt.confirmedAt)
      throw _invalid();
    return BuyerSupportCreatedTicket._(
      ticket,
      Map<String, dynamic>.unmodifiable({
        'subject': copy['subject'],
        'body': copy['body'],
        'recorded_at': copy['recorded_at'],
      }),
      receipt,
    );
  }

  Future<BuyerSupportReply> reply(
    String sessionToken,
    String ticketId, {
    required String key,
    required String body,
  }) async {
    _key(key);
    _id(ticketId);
    _token(sessionToken);
    final normalizedBody = _text(body, 4000);
    final data = _data(
      await _client.post(
        '/storefront/buyer/support/tickets/${Uri.encodeComponent(ticketId)}/messages',
        options: ApiRequestOptions(
          headers: {letbuyyBuyerSessionHeader: sessionToken},
          idempotencyKey: key,
          maxRetries: 0,
          body: {'body': normalizedBody},
        ),
      ),
    );
    final message = _messages([data], ticketId).single;
    final receipt = _receipt(data['mutation_receipt'], key, 'reply', ticketId);
    if (message['author_type'] != 'requester' ||
        message['body'] != normalizedBody ||
        message['id'] != receipt.messageId ||
        message['created_at'] != receipt.confirmedAt)
      throw _invalid();
    return BuyerSupportReply._(message, receipt);
  }

  static BuyerSupportReceipt _receipt(
    Object? value,
    String key,
    String operation,
    String ticketId,
  ) {
    if (value is! Map ||
        value['key'] != key ||
        value['operation'] != operation ||
        value['ticket_id'] != ticketId ||
        value['message_id'] is! String ||
        !_uuid.hasMatch(value['message_id'] as String))
      throw _invalid();
    _date(value['confirmed_at']);
    return BuyerSupportReceipt._(
      key,
      operation,
      ticketId,
      value['message_id'] as String,
      value['confirmed_at'] as String,
    );
  }

  static Map<dynamic, dynamic> _data(Object? response) {
    if (response is! Map ||
        response['success'] != true ||
        response['data'] is! Map)
      throw _invalid();
    return response['data'] as Map;
  }

  static void _id(String value) {
    if (!_uuid.hasMatch(value))
      throw ArgumentError('Invalid support resource.');
  }

  static void _key(String value) {
    if (value.length < 8 ||
        value.length > 200 ||
        value.trim() != value ||
        RegExp(r'[\x00-\x1f\x7f]').hasMatch(value))
      throw ArgumentError('Invalid saved support action key.');
  }

  static void _token(String value) {
    if (value.trim().isEmpty)
      throw ArgumentError('A buyer session is required.');
  }

  static String _text(String value, int maximum) {
    final normalized = value.trim();
    if (normalized.isEmpty || normalized.length > maximum)
      throw ArgumentError('Invalid support text.');
    return normalized;
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
