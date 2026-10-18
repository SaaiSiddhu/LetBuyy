import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_store/app/store_context.dart';
import 'package:letbuyy_store/models/store_model.dart';
import 'package:letbuyy_store/screens/editor/section_editor_screen.dart';
import 'package:letbuyy_store/services/api_client.dart';
import 'package:letbuyy_store/services/store_service.dart';
import 'package:letbuyy_store/services/theme_service.dart';
import 'package:provider/provider.dart';

// Mount the real editor/service with a controlled HTTP boundary. This fixture
// deliberately has no public subdomain; storefront WebView/device proof is a
// separate gate, while these tests exercise the actual editor interactions.
class _EditorApi extends ApiClient {
  _EditorApi() : super(baseUrl: 'https://owned.invalid');
  Object identity = ('actor-a', 'store-a');
  bool missingVersion = false;
  int version = 0;
  final saves = <Map<String, dynamic>>[];
  Future<JsonMap> Function(Map<String, dynamic>)? saveHandler;
  @override
  Object captureRequestContext() => identity;
  @override
  Future<JsonMap> requestJson(String path, {ApiRequestOptions? options}) async {
    if (path.endsWith('/editor'))
      return {
        if (!missingVersion) 'version': version,
        'store': {'id': 'store-a'},
        'theme': {'slug': 'modern'},
        'draft': {'exists': false},
        'template_config': {
          'themeId': 'modern',
          'sections': {'template': []},
        },
      };
    if (path.endsWith('/editor/draft')) {
      final body = Map<String, dynamic>.from(
        jsonDecode(jsonEncode(options?.body)) as Map,
      );
      saves.add(body);
      if (saveHandler != null) return saveHandler!(body);
      return receipt(body['base_version'] as int);
    }
    if (path.endsWith('/preview-session')) return {'preview_token': ''};
    throw StateError('Unexpected editor request');
  }

  JsonMap receipt(int base) => {
    'version': base + 1,
    'current_version': base + 1,
    'replayed': false,
    'saved_at': '2026-10-16T12:00:00Z',
    'draft': {'version': base + 1},
  };
}

class _Stores extends StoreContext {
  _Stores(_EditorApi api) : super(storeService: StoreService(api: api));
  final store = StoreModel(
    id: 'store-a',
    sellerId: 'actor-a',
    name: 'Synthetic editor store',
    tagline: '',
    subdomain: '',
    storeUrl: '',
    themeId: 'modern',
    createdAt: DateTime(2026),
    updatedAt: DateTime(2026),
  );
  @override
  Future<StoreModel?> ensureSelectedStore({bool force = false}) async => store;
}

Future<void> mount(WidgetTester tester, _EditorApi api) async {
  tester.view.resetPhysicalSize();
  tester.view.physicalSize = const Size(1200, 1600);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);
  final stores = _Stores(api), themes = ThemeService(api: api);
  await tester.pumpWidget(
    MultiProvider(
      providers: [
        ChangeNotifierProvider<StoreContext>.value(value: stores),
        ChangeNotifierProvider<ThemeService>.value(value: themes),
      ],
      child: const MaterialApp(home: SectionEditorScreen()),
    ),
  );
  await tester.pumpAndSettle();
}

Future<void> addHero(WidgetTester tester) async {
  await tester.tap(find.text('Add Section').first);
  await tester.pumpAndSettle();
  await tester.tap(find.text('Hero Banner').first);
  await tester.pumpAndSettle();
  ScaffoldMessenger.of(
    tester.element(find.byType(SectionEditorScreen)),
  ).clearSnackBars();
  await tester.pumpAndSettle();
}

void main() {
  testWidgets(
    'missing canonical revision blocks editing; explicit retry loads real version zero and saves it',
    (tester) async {
      final api = _EditorApi()..missingVersion = true;
      await mount(tester, api);
      expect(find.text('Retry loading draft'), findsOneWidget);
      expect(find.text('Store Designer'), findsNothing);
      expect(api.saves, isEmpty);
      api.missingVersion = false;
      await tester.tap(find.text('Retry loading draft'));
      await tester.pumpAndSettle();
      expect(find.text('Store Designer'), findsOneWidget);
      await addHero(tester);
      await tester.tap(find.text('Save', skipOffstage: false).first);
      await tester.pumpAndSettle();
      expect(api.saves.single['base_version'], 0);
      expect(api.saves.single['idempotency_key'], isNotEmpty);
      expect(find.text('Draft saved'), findsOneWidget);
    },
  );

  testWidgets(
    'conflict keeps local edits until the user explicitly reloads the latest draft',
    (tester) async {
      final api = _EditorApi();
      api.saveHandler = (_) async => throw const ApiException(
        message: 'Synthetic concurrent save',
        statusCode: 409,
        code: 'CONFLICT',
      );
      await mount(tester, api);
      await addHero(tester);
      await tester.tap(find.text('Save').first);
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));
      expect(find.text('Theme draft changed'), findsOneWidget);
      await tester.tap(find.text('Keep editing locally'));
      await tester.pumpAndSettle();
      expect(find.text('Save'), findsOneWidget);
      await tester.tap(find.text('Save'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));
      expect(api.saves, hasLength(2));
      expect(api.saves.every((s) => s['base_version'] == 0), isTrue);
      expect(api.saves[0]['template_config'], api.saves[1]['template_config']);
      api.version = 2;
      await tester.tap(find.text('Reload latest'));
      await tester.pumpAndSettle();
      expect(find.text('Saved'), findsOneWidget);
      expect(find.text('Theme draft changed'), findsNothing);
    },
  );

  testWidgets(
    'response loss exposes Recover save and resends the immutable accepted intent',
    (tester) async {
      final api = _EditorApi();
      var attempts = 0;
      api.saveHandler = (body) async {
        if (++attempts == 1)
          throw const ApiException(
            message: 'Synthetic committed reply loss',
            statusCode: 503,
            code: 'SYNTHETIC_RESPONSE_LOSS',
          );
        return api.receipt(body['base_version'] as int);
      };
      await mount(tester, api);
      await addHero(tester);
      await tester.tap(find.text('Save'));
      await tester.pumpAndSettle();
      expect(find.text('Recover save'), findsOneWidget);
      await tester.tap(find.text('Recover save'));
      await tester.pumpAndSettle();
      expect(api.saves, hasLength(2));
      expect(api.saves[0], api.saves[1]);
      expect(
        find.text(
          'Previous save recovered. Save again to include your latest local edits.',
        ),
        findsOneWidget,
      );
      expect(find.text('Save'), findsOneWidget);
    },
  );
}
