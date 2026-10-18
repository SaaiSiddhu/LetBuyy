// The adapter records dispatch, not only the error seen after a response.
// These are transport-boundary races, not Gateway/database ownership proof.
import 'dart:async';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:letbuyy_api_client/letbuyy_api_client.dart';
import 'package:test/test.dart';

class RecordingAdapter implements HttpClientAdapter {
  final requests = <RequestOptions>[];
  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    requests.add(options);
    return ResponseBody.fromString(
      '{"data":{"saved":true}}',
      200,
      headers: {
        'content-type': ['application/json'],
      },
    );
  }

  @override
  void close({bool force = false}) {}
}

void main() {
  for (final lookup in ['token', 'store']) {
    test(
      'a context change while awaiting $lookup must refuse before dispatch',
      () async {
        var epoch = 1;
        final entered = Completer<void>(), delayed = Completer<String?>();
        final adapter = RecordingAdapter(), dio = Dio();
        dio.httpClientAdapter = adapter;
        final client = ApiClient(
          baseUrl: 'https://gateway.example.invalid/v1',
          dio: dio,
          maxRetries: 0,
          contextVersionProvider: () => epoch,
          tokenProvider: () {
            if (lookup == 'token') {
              entered.complete();
              return delayed.future;
            }
            return 'synthetic-account-a';
          },
          storeIdProvider: () {
            if (lookup == 'store') {
              entered.complete();
              return delayed.future;
            }
            return 'store-a';
          },
        );
        final result = expectLater(
          client.requestJson(
            '/loyalty/program',
            options: const ApiRequestOptions(
              method: HttpMethod.put,
              body: {'store_id': 'store-a', 'is_active': true},
              idempotencyKey: 'synthetic-context-save',
            ),
          ),
          throwsA(
            isA<ApiException>().having(
              (error) => error.code,
              'code',
              'SESSION_CONTEXT_CHANGED',
            ),
          ),
        );
        await entered.future;
        epoch = 2;
        delayed.complete(lookup == 'token' ? 'synthetic-account-b' : 'store-b');
        await result;
        expect(
          adapter.requests,
          isEmpty,
          reason: 'a post-response denial cannot undo a dispatched mutation',
        );
        client.close();
      },
    );
  }
  test(
    'stable asynchronous credentials still dispatch the intended request once',
    () async {
      final adapter = RecordingAdapter(), dio = Dio();
      dio.httpClientAdapter = adapter;
      final client = ApiClient(
        baseUrl: 'https://gateway.example.invalid/v1',
        dio: dio,
        maxRetries: 0,
        contextVersionProvider: () => 1,
        tokenProvider: () async => 'synthetic-account-a',
        storeIdProvider: () async => 'store-a',
      );
      expect(await client.requestJson('/probe'), {'saved': true});
      expect(
        adapter.requests.single.headers['Authorization'],
        'Bearer synthetic-account-a',
      );
      expect(adapter.requests.single.headers['X-Store-ID'], 'store-a');
      client.close();
    },
  );
  test('an explicitly captured context survives options copy and client clone and refuses an already changed command', () async {
    var epoch = 1;
    final dio = Dio(), adapter = RecordingAdapter();
    dio.httpClientAdapter = adapter;
    final client = ApiClient(
      baseUrl: 'https://gateway.example.invalid/v1',
      dio: dio,
      maxRetries: 0,
      contextVersionProvider: () => epoch,
    );
    final captured = client.captureRequestContext();
    epoch = 2;
    final copy = client.withOptions(headers: {'X-Probe': 'clone'});
    await expectLater(
      copy.requestJson(
        '/probe',
        options: ApiRequestOptions(expectedContextVersion: captured)
            .copyWith(method: HttpMethod.put),
      ),
      throwsA(
        isA<ApiException>().having(
          (e) => e.code,
          'code',
          'SESSION_CONTEXT_CHANGED',
        ),
      ),
    );
    expect(adapter.requests, isEmpty);
    client.close();
  });
  test('a store-only change in the composite context refuses credentials before dispatch', () async {
    var store = 'store-a';
    final delayed = Completer<String?>(), entered = Completer<void>();
    final dio = Dio(), adapter = RecordingAdapter();
    dio.httpClientAdapter = adapter;
    final client = ApiClient(
      baseUrl: 'https://gateway.example.invalid/v1',
      dio: dio,
      maxRetries: 0,
      contextVersionProvider: () => (1, 'actor-a', store),
      tokenProvider: () {
        entered.complete();
        return delayed.future;
      },
    );
    final result = expectLater(
      client.requestJson('/probe'),
      throwsA(
        isA<ApiException>().having(
          (e) => e.code,
          'code',
          'SESSION_CONTEXT_CHANGED',
        ),
      ),
    );
    await entered.future;
    store = 'store-b';
    delayed.complete('synthetic-a');
    await result;
    expect(adapter.requests, isEmpty);
    client.close();
  });
}
