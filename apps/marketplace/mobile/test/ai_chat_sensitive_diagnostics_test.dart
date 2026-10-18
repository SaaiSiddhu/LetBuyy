@Timeout(Duration(minutes: 4))
library;

import 'dart:async';
import 'dart:convert';
import 'dart:developer' as developer;
import 'dart:io';
import 'dart:isolate';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_api_client/letbuyy_api_client.dart';
import 'package:letbuyy_marketplace_models/letbuyy_marketplace_models.dart';
import 'package:letbuyy_marketplace_services/letbuyy_marketplace_services.dart';
import 'package:shared_preferences/shared_preferences.dart';

const _private = 'N8_SYNTHETIC_PRIVATE_PROMPT_URL_KEY_PROFILE';
const _allowedDiagnostics = {
  'AI_MESSAGE_FAILED',
  'AI_PROFILE_CONTEXT_FAILED',
  'AI_HISTORY_ITEM_DROPPED',
  'AI_PROVIDER_UNAVAILABLE',
  'AI_PROVIDER_REQUEST_STARTED',
  'AI_PROVIDER_EMPTY',
  'AI_PROVIDER_RESPONSE_READY',
  'AI_PROVIDER_FAILED',
  'AI_TOOL_STARTED',
  'AI_TOOL_COMPLETED',
  'AI_TOOL_FAILED',
  'AI_TOOL_RESPONSE_STARTED',
  'AI_TOOL_RESPONSE_FAILED',
  'AI_SEARCH_STARTED',
  'AI_SEARCH_COMPLETED',
  'AI_SEARCH_FAILED',
  'AI_PRODUCT_DETAILS_FAILED',
  'AI_PROFILE_FAILED',
  'AI_CATEGORIES_COMPLETED',
  'AI_CATEGORIES_FAILED',
  'AI_CACHE_PRIME_FAILED',
};

// Flutter disables VM logging in ordinary test processes. In that lane, run
// these same cases once in an owned, serial Flutter fixture with VM logging.
// Relay every case from the JSON reporter; never echo captured service URLs or
// raw test errors. The outer test process waits while the fixture executes.
Uri? _loggingUri;
_LoggingFixture? _fixture;

class _LoggingFixture {
  final names = <String>[];
  final passed = <String>{};
  Process? _process;

  Future<void> run() async {
    final sdk = Platform.environment['FLUTTER_ROOT'];
    if (sdk == null) fail('The Flutter runner must provide FLUTTER_ROOT.');
    final flutter = File(
      '$sdk/bin/${Platform.isWindows ? 'flutter.bat' : 'flutter'}',
    );
    if (!flutter.existsSync()) fail('The Flutter fixture runner is missing.');
    final tests = <int, String>{};
    var suiteSucceeded = false;
    var invalidResult = false;
    final process = await Process.start(
      flutter.path,
      [
        'test',
        '--no-pub',
        '--concurrency=1',
        '--enable-vmservice',
        '--reporter=json',
        '--timeout=30s',
        'test/ai_chat_sensitive_diagnostics_test.dart',
      ],
      workingDirectory: Directory.current.path,
      environment: {'LETBUYY_AI_LOGGING_FIXTURE': '1'},
      runInShell: Platform.isWindows,
    );
    _process = process;
    print('Local logging fixture PID ${process.pid}; outer process waiting.');
    final output = process.stdout
        .transform(utf8.decoder)
        .transform(const LineSplitter())
        .listen((line) {
          // Engine announcements can precede JSON. They stay private in memory.
          Map<String, dynamic> event;
          try {
            final decoded = jsonDecode(line);
            if (decoded is! Map<String, dynamic>) return;
            event = decoded;
          } on FormatException {
            return;
          }
          if (event['type'] == 'testStart') {
            final test = event['test'] as Map<String, dynamic>;
            tests[test['id'] as int] = test['name'] as String;
          } else if (event['type'] == 'testDone') {
            final name = tests[event['testID']];
            if (!names.contains(name)) return;
            if (event['result'] == 'success' &&
                event['skipped'] == false &&
                event['hidden'] == false &&
                passed.add(name!)) {
              return;
            }
            invalidResult = true;
          } else if (event['type'] == 'done') {
            suiteSucceeded = event['success'] == true;
          }
        });
    // Drain without exposing provider fixtures, assertion payloads or VM URLs.
    final outputDone = output.asFuture<void>();
    final errors = process.stderr.drain<void>();
    try {
      final exitCode = await process.exitCode.timeout(
        const Duration(minutes: 3),
      );
      await outputDone.timeout(const Duration(seconds: 5));
      await errors.timeout(const Duration(seconds: 5));
      expect(
        exitCode,
        0,
        reason:
            'The owned logging fixture must pass. Failed or absent cases: '
            '${names.where((name) => !passed.contains(name)).join('; ')}',
      );
      expect(suiteSucceeded, isTrue);
      expect(invalidResult, isFalse, reason: 'No skipped or hidden cases.');
      expect(
        passed,
        unorderedEquals(names),
        reason: 'Every real diagnostic case must complete successfully.',
      );
      print(
        'Local logging fixture PID ${process.pid} exited; '
        'verified all ${passed.length} real cases.',
      );
    } finally {
      await close();
    }
  }

  Future<void> close() async {
    final process = _process;
    if (process == null) return;
    _process = null;
    process.kill();
    try {
      await process.exitCode.timeout(const Duration(seconds: 5));
    } on TimeoutException {
      process.kill(ProcessSignal.sigkill);
      await process.exitCode;
    }
  }
}

void _diagnosticTest(String name, Future<void> Function() body) {
  final fixture = _fixture;
  fixture?.names.add(name);
  test(
    name,
    fixture == null
        ? body
        : () async {
            expect(
              fixture.passed,
              contains(name),
              reason: 'The actual logging fixture must execute this case.',
            );
          },
  );
}

// This override is scoped only to the validated loopback WebSocket connection.
// SDK and canonical requests use mocked transports; no provider is contacted.
class _LocalVmHttp extends HttpOverrides {}

class _Logs {
  late WebSocket _socket;
  late StreamSubscription<dynamic> _subscription;
  final _pending = <int, Completer<void>>{};
  final records = <Map<String, dynamic>>[];
  Completer<void>? _barrier;
  var _id = 0;
  late String _isolate;

  Future<void> start() async {
    final uri = _loggingUri;
    if (uri == null || !{'127.0.0.1', '::1', 'localhost'}.contains(uri.host)) {
      fail('The loopback logging service was not initialized.');
    }
    _isolate = developer.Service.getIsolateId(Isolate.current)!;
    try {
      _socket = await HttpOverrides.runWithHttpOverrides(
        () => WebSocket.connect(uri.toString()),
        _LocalVmHttp(),
      );
    } catch (_) {
      fail('Could not attach to the local test logging stream.');
    }
    _subscription = _socket.listen((message) {
      final data = jsonDecode(message as String) as Map<String, dynamic>;
      final id = data['id'];
      if (id is int) {
        final pending = _pending.remove(id);
        if (data.containsKey('error')) {
          pending?.completeError(StateError('Local logging RPC failed.'));
        } else {
          pending?.complete();
        }
      }
      if (data['method'] != 'streamNotify') return;
      final params = data['params'] as Map<String, dynamic>;
      if (params['streamId'] != 'Logging') return;
      final event = params['event'] as Map<String, dynamic>;
      if ((event['isolate'] as Map?)?['id'] != _isolate) return;
      final record = event['logRecord'] as Map<String, dynamic>;
      if ((record['loggerName'] as Map?)?['valueAsString'] ==
          'n8.test.barrier') {
        if (!(_barrier?.isCompleted ?? true)) _barrier!.complete();
      } else {
        records.add(record);
      }
    });
    final id = ++_id;
    final ready = Completer<void>();
    _pending[id] = ready;
    _socket.add(
      jsonEncode({
        'jsonrpc': '2.0',
        'id': id,
        'method': 'streamListen',
        'params': {'streamId': 'Logging'},
      }),
    );
    await ready.future.timeout(const Duration(seconds: 5));
  }

  Future<void> flush() async {
    _barrier = Completer<void>();
    developer.log('flush', name: 'n8.test.barrier');
    await _barrier!.future.timeout(const Duration(seconds: 5));
  }

  Future<void> close() async {
    await _subscription.cancel();
    await _socket.close();
  }

  void expectPrivateDiagnosticsAbsent() {
    expect(
      jsonEncode(records).contains(_private),
      isFalse,
      reason: 'Diagnostic messages must not include synthetic private input.',
    );
    expect(
      records,
      isNotEmpty,
      reason: 'The actual logging stream must observe the exercised branch.',
    );
    for (final record in records) {
      expect((record['loggerName'] as Map?)?['valueAsString'], 'letbuyy.ai');
      expect(
        _allowedDiagnostics.contains(
          (record['message'] as Map?)?['valueAsString'],
        ),
        isTrue,
        reason: 'Only fixed allowlisted reason codes may be logged.',
      );
      for (final field in ['error', 'stackTrace']) {
        final value = record[field];
        expect(
          value == null || (value is Map && value['kind'] == 'Null'),
          isTrue,
          reason: 'Logs must not attach raw error objects or stack traces.',
        );
      }
    }
  }
}

class _PrivateHistoryMessage extends ChatMessage {
  _PrivateHistoryMessage(String sessionId)
    : super(
        id: 'history',
        text: 'safe',
        sessionId: sessionId,
        messageType: MessageType.user,
        timestamp: DateTime.utc(2026),
      );
  @override
  bool get isUser => throw StateError(_private);
}

const _buyer = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa';
({ApiClient client, List<RequestOptions> requests}) _gateway(
  FutureOr<Response<dynamic>> Function(RequestOptions) handler,
) {
  final requests = <RequestOptions>[];
  final dio = Dio()
    ..interceptors.add(
      InterceptorsWrapper(
        onRequest: (o, h) async {
          requests.add(o);
          try {
            h.resolve(await handler(o));
          } catch (_) {
            h.reject(
              DioException(
                requestOptions: o,
                message: _private,
                error: StateError(_private),
              ),
            );
          }
        },
      ),
    );
  return (
    client: ApiClient(
      baseUrl: 'https://gateway.invalid/v1',
      dio: dio,
      maxRetries: 0,
    ),
    requests: requests,
  );
}

Response<dynamic> _answer(
  RequestOptions o, {
  String status = 'completed',
  String? text = _private,
  Map<String, Object?> extra = const {},
}) => Response(
  requestOptions: o,
  statusCode: 200,
  data: {
    'success': true,
    'data': {
      'request_id': (o.data as Map)['request_id'],
      'conversation_id': (o.data as Map)['conversation_id'],
      'status': status,
      if (status == 'completed') 'text': text,
      ...extra,
    },
  },
);
Future<AIChatService> _service(ApiClient client) async {
  final service = AIChatService.forTesting()
    ..configure(client: client, accounts: BuyerAccountApi(client))
    ..updateAuth(
      buyerId: _buyer,
      sessionToken: 'synthetic-session',
      email: 'synthetic@example.invalid',
    );
  await service.initSession();
  return service;
}

ApiClient _failingGateway() => ApiClient(
  baseUrl: 'https://gateway.invalid/v1',
  maxRetries: 0,
  dio: Dio()
    ..interceptors.add(
      InterceptorsWrapper(
        onRequest: (o, h) {
          h.reject(
            DioException(
              requestOptions: o,
              message: _private,
              error: StateError(_private),
            ),
          );
        },
      ),
    ),
);

Future<void> main() async {
  TestWidgetsFlutterBinding.ensureInitialized();
  final info = await developer.Service.getInfo().timeout(
    const Duration(seconds: 5),
  );
  _loggingUri = info.serverWebSocketUri;
  if (_loggingUri == null) {
    if (Platform.environment['LETBUYY_AI_LOGGING_FIXTURE'] == '1') {
      fail('The owned fixture must enable its loopback logging service.');
    }
    final fixture = _fixture = _LoggingFixture();
    setUpAll(fixture.run);
    tearDownAll(fixture.close);
  }
  setUp(() => SharedPreferences.setMockInitialValues({}));

  _diagnosticTest(
    'query and transport exception stay out of logs and client errors',
    () async {
      final logs = _Logs();
      await logs.start();
      addTearDown(logs.close);
      final dio = Dio()
        ..interceptors.add(
          InterceptorsWrapper(
            onRequest: (o, h) {
              h.reject(
                DioException(
                  requestOptions: o,
                  message: _private,
                  error: StateError(_private),
                ),
              );
            },
          ),
        );
      final client = ApiClient(
        baseUrl: 'https://gateway.invalid/v1',
        dio: dio,
        maxRetries: 0,
      );
      final service = AIChatService.forTesting()
        ..configure(client: client, accounts: BuyerAccountApi(client));
      final result = await service.handleProductSearch(_private);
      await logs.flush();
      expect(result['success'], isFalse);
      expect(
        jsonEncode(result).contains(_private),
        isFalse,
        reason:
            'A failed tool response must not echo private transport details.',
      );
      logs.expectPrivateDiagnosticsAbsent();
    },
  );

  _diagnosticTest(
    'thrown reply error and stack never attach to diagnostic records',
    () async {
      final logs = _Logs();
      await logs.start();
      addTearDown(logs.close);
      final service = AIChatService.forTesting(
        reply: (_, _) =>
            Future.error(StateError(_private), StackTrace.fromString(_private)),
      );
      await service.initSession();
      final result = await service.processUserMessage(_private);
      await logs.flush();
      expect(result.messageType, MessageType.error);
      expect(result.text.contains(_private), isFalse);
      expect(result.errorMessage!.contains(_private), isFalse);
      logs.expectPrivateDiagnosticsAbsent();
    },
  );

  _diagnosticTest(
    'history exception interpolation never enters diagnostic records',
    () async {
      final logs = _Logs();
      await logs.start();
      addTearDown(logs.close);
      final service = AIChatService.forTesting();
      await service.initSession();
      expect(
        await service.buildChatHistory([
          _PrivateHistoryMessage(service.currentSessionId),
        ]),
        isEmpty,
      );
      await logs.flush();
      logs.expectPrivateDiagnosticsAbsent();
    },
  );

  _diagnosticTest(
    'Gateway failure produces fixed client error without private diagnostic object',
    () async {
      final logs = _Logs();
      await logs.start();
      addTearDown(logs.close);
      final h = _gateway(
        (o) => Response(
          requestOptions: o,
          statusCode: 503,
          data: {
            'success': false,
            'error': {'code': 'PRIVATE', 'message': _private},
          },
        ),
      );
      final service = await _service(h.client);
      final result = await service.processUserMessage(_private);
      await logs.flush();
      expect(result.messageType, MessageType.error);
      expect(result.errorMessage, 'AI_PROVIDER_FAILED');
      expect(result.text.contains(_private), isFalse);
      expect(h.requests.single.path, endsWith('/storefront/buyer/assistant'));
      logs.expectPrivateDiagnosticsAbsent();
    },
  );
  _diagnosticTest(
    'server tool and private function payloads are rejected without catalog dispatch',
    () async {
      final logs = _Logs();
      await logs.start();
      addTearDown(logs.close);
      final h = _gateway(
        (o) => _answer(
          o,
          extra: {
            'tools': [
              {'name': 'searchProducts', 'error': _private},
            ],
          },
        ),
      );
      final service = await _service(h.client);
      final result = await service.processUserMessage(_private);
      await logs.flush();
      expect(result.errorMessage, 'AI_PROVIDER_FAILED');
      expect(h.requests, hasLength(1));
      expect(result.text.contains(_private), isFalse);
      logs.expectPrivateDiagnosticsAbsent();
    },
  );
  _diagnosticTest(
    'explicit own profile failure stays private and is never sent to assistant by default',
    () async {
      final logs = _Logs();
      await logs.start();
      addTearDown(logs.close);
      final service = await _service(_failingGateway());
      final profile = await service.handleUserProfile();
      await logs.flush();
      expect(jsonEncode(profile).contains(_private), isFalse);
      expect(profile.containsKey('error'), isTrue);
      logs.expectPrivateDiagnosticsAbsent();
    },
  );
  _diagnosticTest(
    'malformed response and raw error stack never enter client fields or diagnostic records',
    () async {
      final logs = _Logs();
      await logs.start();
      addTearDown(logs.close);
      final h = _gateway(
        (_) =>
            Future.error(StateError(_private), StackTrace.fromString(_private)),
      );
      final service = await _service(h.client);
      final result = await service.processUserMessage(_private);
      await logs.flush();
      expect(result.errorMessage, 'AI_PROVIDER_FAILED');
      expect(result.text.contains(_private), isFalse);
      logs.expectPrivateDiagnosticsAbsent();
    },
  );
  _diagnosticTest(
    'unknown private action name and arguments are never executed or interpolated',
    () async {
      final logs = _Logs();
      await logs.start();
      addTearDown(logs.close);
      final h = _gateway(
        (o) => _answer(
          o,
          extra: {
            'function_call': {
              'name': _private,
              'args': {'secret': _private},
            },
          },
        ),
      );
      final service = await _service(h.client);
      final result = await service.processUserMessage(_private);
      await logs.flush();
      expect(result.errorMessage, 'AI_PROVIDER_FAILED');
      expect(h.requests, hasLength(1));
      expect(result.text.contains(_private), isFalse);
      logs.expectPrivateDiagnosticsAbsent();
    },
  );
  _diagnosticTest(
    'normal private answer remains available to buyer but never appears in diagnostics',
    () async {
      final logs = _Logs();
      await logs.start();
      addTearDown(logs.close);
      final h = _gateway((o) => _answer(o));
      final service = await _service(h.client);
      final result = await service.processUserMessage(_private);
      await logs.flush();
      expect(result.text, _private);
      expect(result.category, 'ai_text');
      expect(h.requests, hasLength(1));
      expect(
        (h.requests.single.data as Map)['history'],
        isEmpty,
        reason: 'Hidden profile/orders/support context must not be submitted.',
      );
      logs.expectPrivateDiagnosticsAbsent();
    },
  );
  _diagnosticTest(
    'unavailable server profile orders and coupons stay truthful without provider calls',
    () async {
      final logs = _Logs();
      await logs.start();
      addTearDown(logs.close);
      final h = _gateway((o) => _answer(o, status: 'unavailable', text: null));
      final service = await _service(h.client);
      final result = await service.processUserMessage(_private);
      expect(result.category, 'ai_offline');
      expect(h.requests, hasLength(1));
      expect((await service.handleGetOrders())['success'], isFalse);
      expect((await service.handleGetCoupons())['success'], isFalse);
      await logs.flush();
      logs.expectPrivateDiagnosticsAbsent();
    },
  );
  _diagnosticTest(
    'successful public search preserves private query and product result while diagnostics stay fixed',
    () async {
      final logs = _Logs();
      await logs.start();
      addTearDown(logs.close);
      final h = _gateway(
        (o) => Response(
          requestOptions: o,
          statusCode: 200,
          data: {
            'success': true,
            'data': [
              {
                'listing_id': 'listing-1',
                'product_id': 'product-1',
                'site_id': 'site-1',
                'name': _private,
                'price': 120,
                'approved_at': '2026-10-01T00:00:00Z',
              },
            ],
            'meta': {'limit': 8, 'next_cursor': null},
          },
        ),
      );
      final service = await _service(h.client);
      final result = await service.handleProductSearch(_private);
      expect(result['success'], isTrue);
      expect(jsonEncode(result).contains(_private), isTrue);
      expect(h.requests.single.queryParameters['search'], _private);
      await logs.flush();
      logs.expectPrivateDiagnosticsAbsent();
    },
  );
}
