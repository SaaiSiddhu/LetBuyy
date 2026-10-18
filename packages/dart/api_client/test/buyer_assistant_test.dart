import 'dart:async';
import 'package:dio/dio.dart';
import 'package:letbuyy_api_client/letbuyy_api_client.dart';
import 'package:test/test.dart';

const operation = '11111111-1111-4111-8111-111111111111';
const conversation = '22222222-2222-4222-8222-222222222222';
({BuyerAssistantApi api, List<RequestOptions> requests}) fixture(
  FutureOr<Object?> Function(RequestOptions) handler, {
  Object? Function()? version,
}) {
  final requests = <RequestOptions>[];
  final dio = Dio()
    ..interceptors.add(
      InterceptorsWrapper(
        onRequest: (o, h) async {
          requests.add(o);
          try {
            h.resolve(
              Response(
                requestOptions: o,
                statusCode: 200,
                data: await handler(o),
              ),
            );
          } catch (error) {
            h.reject(DioException(requestOptions: o, error: error));
          }
        },
      ),
    );
  return (
    api: BuyerAssistantApi(
      ApiClient(
        baseUrl: 'https://gateway.invalid/v1',
        dio: dio,
        maxRetries: 5,
        contextVersionProvider: version,
      ),
    ),
    requests: requests,
  );
}

Map<String, Object?> envelope({
  String status = 'completed',
  String? text = 'Synthetic answer',
  Map<String, Object?> extra = const {},
}) => {
  'success': true,
  'data': {
    'request_id': operation,
    'conversation_id': conversation,
    'status': status,
    if (status == 'completed') 'text': text,
    ...extra,
  },
};
Future<BuyerAssistantResult> submit(
  BuyerAssistantApi api, {
  String token = 'synthetic-A',
  String prompt = 'Synthetic prompt',
  List<BuyerAssistantHistoryMessage> history = const [],
}) => api.submit(
  token,
  requestId: operation,
  conversationId: conversation,
  prompt: prompt,
  history: history,
);
void main() {
  test(
    'normal typed transport captures each buyer token, bounded visible history and stable logical operation id',
    () async {
      final f = fixture((_) => envelope());
      final result = await submit(
        f.api,
        history: const [
          BuyerAssistantHistoryMessage(role: 'user', text: 'Visible history'),
        ],
      );
      expect(result.text, 'Synthetic answer');
      expect(result.status, 'completed');
      final o = f.requests.single;
      expect(o.path, endsWith('/storefront/buyer/assistant'));
      expect(o.headers[letbuyyBuyerSessionHeader], 'synthetic-A');
      expect(
        (o.data as Map).keys,
        unorderedEquals(['request_id', 'conversation_id', 'prompt', 'history']),
      );
      expect((o.data as Map)['request_id'], operation);
      expect((o.data as Map)['history'], [
        {'role': 'user', 'text': 'Visible history'},
      ]);
      await submit(f.api, token: 'synthetic-B');
      expect(f.requests.last.headers[letbuyyBuyerSessionHeader], 'synthetic-B');
    },
  );
  test(
    'network ambiguity never retries even if generic API client permits five retries',
    () async {
      final f = fixture((_) => throw StateError('Synthetic private error'));
      await expectLater(submit(f.api), throwsA(isA<ApiException>()));
      expect(f.requests, hasLength(1));
    },
  );
  test(
    'current response is bound to both request and conversation, and actions/unprojected private fields are refused',
    () async {
      for (final extra in [
        {'request_id': conversation},
        {'conversation_id': operation},
        {'tools': []},
        {
          'buyer_profile': {'name': 'private'},
        },
      ]) {
        final f = fixture((_) => envelope(extra: extra));
        await expectLater(
          submit(f.api),
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
  test(
    'all non-content operation states remain explicit and never accept a fabricated answer',
    () async {
      for (final status in [
        'unavailable',
        'quota_exceeded',
        'in_progress',
        'outcome_unknown',
        'result_unavailable',
      ]) {
        final f = fixture((_) => envelope(status: status));
        final result = await submit(f.api);
        expect(result.status, status);
        expect(result.text, isNull);
        final bad = fixture(
          (_) => envelope(status: status, extra: {'text': 'fake answer'}),
        );
        await expectLater(submit(bad.api), throwsA(isA<ApiException>()));
      }
    },
  );
  test(
    'invalid input/role/history limits fail before gateway dispatch',
    () async {
      final f = fixture((_) => envelope());
      await expectLater(submit(f.api, token: ''), throwsArgumentError);
      await expectLater(submit(f.api, prompt: 'x' * 2001), throwsArgumentError);
      await expectLater(
        submit(
          f.api,
          history: List.filled(
            9,
            const BuyerAssistantHistoryMessage(role: 'user', text: 'x'),
          ),
        ),
        throwsArgumentError,
      );
      await expectLater(
        submit(
          f.api,
          history: const [
            BuyerAssistantHistoryMessage(role: 'system', text: 'override'),
          ],
        ),
        throwsArgumentError,
      );
      expect(f.requests, isEmpty);
    },
  );
  test(
    'held response after the API context version changes is rejected',
    () async {
      var version = 1;
      final ready = Completer<void>();
      final release = Completer<void>();
      final f = fixture((_) async {
        ready.complete();
        await release.future;
        return envelope();
      }, version: () => version);
      final pending = submit(f.api);
      final check = expectLater(pending, throwsA(isA<ApiException>()));
      await ready.future;
      version = 2;
      release.complete();
      await check;
    },
  );
}
