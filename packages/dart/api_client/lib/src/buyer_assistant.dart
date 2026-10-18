import 'api_client.dart';
import 'buyer_sign_in.dart' show letbuyyBuyerSessionHeader;
import 'types.dart';

class BuyerAssistantHistoryMessage {
  const BuyerAssistantHistoryMessage({required this.role, required this.text});
  final String role;
  final String text;
  JsonMap toJson() => {'role': role, 'text': text};
}

class BuyerAssistantResult {
  const BuyerAssistantResult({
    required this.requestId,
    required this.conversationId,
    required this.status,
    this.text,
  });
  final String requestId;
  final String conversationId;
  final String status;
  final String? text;
}

/// BUYER-auth only. No model, credentials, private profile, actions or SDK leaks
/// into this transport. Ambiguous requests are never automatically retried.
class BuyerAssistantApi {
  BuyerAssistantApi(this._client);
  final ApiClient _client;
  static final _uuid = RegExp(
    r'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$',
  );
  Future<BuyerAssistantResult> submit(
    String sessionToken, {
    required String requestId,
    required String conversationId,
    required String prompt,
    List<BuyerAssistantHistoryMessage> history = const [],
  }) async {
    if (sessionToken.isEmpty ||
        !_uuid.hasMatch(requestId) ||
        !_uuid.hasMatch(conversationId) ||
        prompt.trim().isEmpty ||
        prompt.trim().length > 2000 ||
        history.length > 8 ||
        history.any(
          (m) =>
              !{'user', 'assistant'}.contains(m.role) ||
              m.text.trim().isEmpty ||
              m.text.length > 2000,
        )) {
      throw ArgumentError('Invalid assistant request.');
    }
    final context = _client.captureRequestContext();
    final body = asJsonMap(
      await _client.post(
        '/storefront/buyer/assistant',
        body: {
          'request_id': requestId,
          'conversation_id': conversationId,
          'prompt': prompt.trim(),
          'history': history.map((m) => m.toJson()).toList(growable: false),
        },
        options: ApiRequestOptions(
          headers: {letbuyyBuyerSessionHeader: sessionToken},
          idempotencyKey: requestId,
          maxRetries: 0,
          expectedContextVersion: context,
        ),
      ),
    );
    final data = body['data'];
    if (data is! Map ||
        data['request_id'] != requestId ||
        data['conversation_id'] != conversationId ||
        data.keys.any(
          (key) => !{
            'request_id',
            'conversation_id',
            'status',
            'text',
          }.contains(key),
        ))
      throw _invalid();
    final status = data['status'];
    if (status == 'completed') {
      final text = data['text'];
      if (text is! String || text.trim().isEmpty || text.length > 8000)
        throw _invalid();
      return BuyerAssistantResult(
        requestId: requestId,
        conversationId: conversationId,
        status: status,
        text: text,
      );
    }
    if (!{
          'unavailable',
          'quota_exceeded',
          'in_progress',
          'outcome_unknown',
          'result_unavailable',
        }.contains(status) ||
        data.containsKey('text'))
      throw _invalid();
    return BuyerAssistantResult(
      requestId: requestId,
      conversationId: conversationId,
      status: status as String,
    );
  }

  static ApiException _invalid() => const ApiException(
    message: 'Unexpected assistant response.',
    statusCode: 502,
    code: 'INVALID_RESPONSE',
  );
}
