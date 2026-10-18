import 'dart:async';
import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_store/services/ai_studio_service.dart';
import 'package:letbuyy_store/services/api_client.dart';

class _PlannedThemeApi extends ApiClient {
  _PlannedThemeApi() : super(baseUrl: 'https://owned.invalid');
  Object identity = ('actor-a', 'store-a');
  int version = 5;
  bool missingVersion = false;
  final planning = Completer<JsonMap>();
  final planningStarted = Completer<void>();
  final paths = <String>[];
  final writes = <Map<String, dynamic>>[];
  @override
  Object captureRequestContext() => identity;
  @override
  Future<dynamic> request(String path, {ApiRequestOptions? options}) async {
    paths.add(path);
    if (path == '/themes') return {'data': [], 'current_theme': 'modern'};
    throw StateError('Unexpected catalog request');
  }

  @override
  Future<JsonMap> requestJson(String path, {ApiRequestOptions? options}) async {
    paths.add(path);
    if (path.endsWith('/editor'))
      return {
        if (!missingVersion) 'version': version,
        'store': {'id': 'store-a'},
        'theme': {'slug': 'modern'},
        'draft': {'exists': true},
        'template_config': {},
      };
    if (path == '/ai/operator') {
      planningStarted.complete();
      return planning.future;
    }
    if (path.endsWith('/editor/draft')) {
      writes.add(
        Map<String, dynamic>.from(jsonDecode(jsonEncode(options?.body)) as Map),
      );
      throw const ApiException(
        message: 'Other session saved during planning',
        statusCode: 409,
        code: 'CONFLICT',
      );
    }
    throw StateError('Unexpected tool request');
  }
}

JsonMap plan() => {
  'store_id': 'store-a',
  'conversation_id': 'synthetic-plan',
  'message': 'Synthetic owned plan',
  'tool_calls': [
    {
      'id': 'owned-theme-call',
      'tool': 'draft_homepage_section',
      'label': 'Draft homepage',
      'status': 'ready',
      'payload': {
        'theme_slug': 'modern',
        'template_config': {
          'themeId': 'modern',
          'sections': {'template': []},
        },
      },
    },
  ],
};

void main() {
  test('theme operator retains the revision captured before planning and reports a later conflict honestly', () async {
    final api = _PlannedThemeApi(), service = AiStudioService(api: api);
    final result = service.runOperatorCommand(
      storeId: 'store-a',
      message: 'Draft a homepage',
    );
    await api.planningStarted.future;
    api.version = 6;
    api.planning.complete(plan());
    expect((await result).toolCalls.single.status, 'unavailable');
    expect(
      api.paths.indexOf('/themes/modern/editor'),
      lessThan(api.paths.indexOf('/ai/operator')),
    );
    expect(api.paths.where((p) => p.endsWith('/editor')), hasLength(1));
    expect(api.writes.single['base_version'], 5);
    expect(api.writes.single['idempotency_key'], 'ai-theme:owned-theme-call');
    expect(api.writes.single['client'], 'flutter-builder');
  });

  test(
    'theme operator cannot write when the canonical editor supplied no version',
    () async {
      final api = _PlannedThemeApi()..missingVersion = true;
      final service = AiStudioService(api: api);
      final result = service.runOperatorCommand(
        storeId: 'store-a',
        message: 'Draft a homepage',
      );
      await api.planningStarted.future;
      api.planning.complete(plan());
      expect((await result).toolCalls.single.status, 'unavailable');
      expect(api.writes, isEmpty);
    },
  );

  test(
    'account change during planning fences the result before any theme write',
    () async {
      final api = _PlannedThemeApi(), service = AiStudioService(api: api);
      final result = service.runOperatorCommand(
        storeId: 'store-a',
        message: 'Draft a homepage',
      );
      final rejected = expectLater(result, throwsA(isA<StateError>()));
      await api.planningStarted.future;
      api.identity = ('actor-b', 'store-a');
      api.planning.complete(plan());
      await rejected;
      expect(api.writes, isEmpty);
    },
  );
}
