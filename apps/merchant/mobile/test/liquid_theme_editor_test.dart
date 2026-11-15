import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:letbuyy_store/app/store_context.dart';
import 'package:letbuyy_store/models/store_model.dart';
import 'package:letbuyy_store/screens/editor/section_editor_screen.dart';
import 'package:letbuyy_store/screens/customize/theme_screen.dart';
import 'package:letbuyy_store/screens/preview/live_preview_screen.dart';
import 'package:letbuyy_store/services/api_client.dart';
import 'package:letbuyy_store/services/store_service.dart';
import 'package:letbuyy_store/services/theme_service.dart';

// Controlled HTTP-boundary tests exercise the actual native editor and service.
// This is a conservation/failure fixture, not ten-package or device acceptance.
Map<String, dynamic> document(String slug) => {
  'themeId': slug,
  'rendererEngine': 'liquid',
  'unknownRoot': {'retain': true},
  'liquidBundle': {
    'package': {'slug': slug, 'version': '2.0.0'},
    'renderer': {'engine': 'liquid'},
    'sections': {
      'niche-hero': {'source': 'Immutable package source'},
    },
  },
  'templates': {
    'index': {
      'order': ['hero'],
      'sections': {
        'hero': {
          'type': 'niche-hero',
          'settings': {
            'heading': 'A considered design',
            'futureSetting': {'retain': 7},
          },
          'blocks': {
            'card': {
              'type': 'custom-card',
              'settings': {'title': 'Original card'},
              'blocks': {
                'badge': {
                  'type': 'badge',
                  'settings': {'label': 'Original badge'},
                },
              },
              'block_order': ['badge'],
            },
          },
          'block_order': ['card'],
        },
      },
    },
    'product': {
      'order': ['detail'],
      'sections': {
        'detail': {
          'type': 'niche-product',
          'settings': {'copy': 'Product content'},
        },
      },
    },
    'header': {
      'order': ['announcement', 'nav'],
      'sections': {
        'announcement': {
          'type': 'announcement',
          'settings': {'text': 'Original announcement'},
        },
        'nav': {
          'type': 'navigation',
          'settings': {'menu': 'menu-a'},
        },
      },
    },
    'footer': {'order': [], 'sections': {}},
  },
  'settings_data': {
    'current': {'brand': 'Original brand'},
    'presets': {
      'Original': {'brand': 'Original brand'},
    },
  },
};

class _Api extends ApiClient {
  _Api({this.slug = 'letbuyy-summit'})
    : super(baseUrl: 'https://owned.invalid') {
    config = document(slug);
  }
  final String slug;
  Object identity = ('actor-a', 'store-a');
  int version = 0;
  bool loseNextSave = false, conflict = false;
  late Map<String, dynamic> config;
  final saves = <Map<String, dynamic>>[], queries = <Map<String, dynamic>>[];
  @override
  Object captureRequestContext() => identity;
  @override
  Future<JsonMap> requestJson(String path, {ApiRequestOptions? options}) async {
    if (path.endsWith('/editor')) {
      final key = options?.query?['template_key'] ?? 'index';
      queries.add({'template_key': key});
      return {
        'store': {'id': 'store-a'},
        'theme': {
          'slug': slug,
          'name': 'Kindred',
          'theme_instance_id': 'instance-a',
          'theme_package_version_id': 'version-a',
        },
        'version': version,
        'draft': {'exists': version > 0},
        'template_key': key,
        'template_config': config,
        'schemas': {
          'sections': {
            'niche-hero': {
              'name': 'Gift finder',
              'settings_schema': {
                'heading': {'type': 'text', 'label': 'Heading'},
              },
              'blocks_schema': {
                'custom-card': {
                  'name': 'Gift card',
                  'fields': {
                    'title': {'type': 'text', 'label': 'Title'},
                  },
                },
              },
            },
            'niche-product': {
              'name': 'Product information',
              'settings_schema': {
                'copy': {'type': 'textarea', 'label': 'Product copy'},
              },
            },
          },
          'blocks': {
            'badge': {
              'name': 'Gift badge',
              'fields': {
                'label': {'type': 'text', 'label': 'Badge label'},
              },
            },
          },
          'settings': {
            'settings': {
              'brand': {
                'label': 'Brand',
                'fields': {
                  'brand': {'type': 'text', 'label': 'Brand name'},
                },
              },
            },
          },
        },
      };
    }
    if (path.endsWith('/editor/draft')) {
      final body = Map<String, dynamic>.from(
        jsonDecode(jsonEncode(options?.body)) as Map,
      );
      saves.add(body);
      if (conflict)
        throw const ApiException(
          message: 'Synthetic stale version',
          statusCode: 409,
          code: 'CONFLICT',
        );
      if (loseNextSave) {
        loseNextSave = false;
        throw const ApiException(
          message: 'Synthetic lost response',
          statusCode: 503,
          code: 'SYNTHETIC',
        );
      }
      version = (body['base_version'] as int) + 1;
      config = Map<String, dynamic>.from(body['template_config'] as Map);
      return {
        'version': version,
        'current_version': version,
        'replayed': false,
        'saved_at': '2026-11-11T07:00:00Z',
        'draft': {'version': version},
      };
    }
    throw StateError('Unexpected controlled request: $path');
  }
}

class _Stores extends StoreContext {
  _Stores(_Api api) : super(storeService: StoreService(api: api));
  StoreModel store = StoreModel(
    id: 'store-a',
    sellerId: 'actor-a',
    name: 'Synthetic gifts',
    tagline: '',
    subdomain: '',
    storeUrl: '',
    themeId: 'letbuyy-summit',
    createdAt: DateTime(2026),
    updatedAt: DateTime(2026),
  );
  @override
  Future<StoreModel?> ensureSelectedStore({bool force = false}) async => store;
  void changed() => notifyListeners();
}

Future<_Stores> mount(
  WidgetTester tester,
  _Api api, {
  GlobalKey<SectionEditorScreenState>? key,
  Widget? home,
  Size size = const Size(430, 1600),
  double textScale = 1,
  String subdomain = '',
}) async {
  tester.view.physicalSize = size;
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);
  final stores = _Stores(api);
  if (subdomain.isNotEmpty)
    stores.store = stores.store.copyWith(subdomain: subdomain);
  await tester.pumpWidget(
    MultiProvider(
      providers: [
        ChangeNotifierProvider<StoreContext>.value(value: stores),
        ChangeNotifierProvider(create: (_) => ThemeService(api: api)),
      ],
      child: MaterialApp(
        builder: (context, child) => MediaQuery(
          data: MediaQuery.of(
            context,
          ).copyWith(textScaler: TextScaler.linear(textScale)),
          child: child!,
        ),
        home:
            home ??
            SectionEditorScreen(
              key: key,
              themeSlug: api.slug,
              expectedStoreId: 'store-a',
            ),
      ),
    ),
  );
  await tester.pumpAndSettle();
  return stores;
}

class _LibraryApi extends _Api {
  int previewAttempts = 0;
  @override
  Future<dynamic> request(String path, {ApiRequestOptions? options}) async {
    if (path == '/themes')
      return {
        'data': <dynamic>[],
        'current_theme': slug,
        'current_theme_record': {
          'id': 'theme-a',
          'slug': slug,
          'name': 'Kindred',
        },
        'store_status': 'draft',
      };
    if (path.endsWith('/releases')) return {'data': <dynamic>[]};
    throw StateError('Unexpected controlled library read');
  }

  @override
  Future<JsonMap> requestJson(String path, {ApiRequestOptions? options}) async {
    if (path == '/themes/library') return {'themes': <dynamic>[]};
    if (path.endsWith('/preview-session')) {
      previewAttempts++;
      throw const ApiException(
        message: 'Synthetic preview unavailable',
        statusCode: 503,
        code: 'SYNTHETIC',
      );
    }
    return super.requestJson(path, options: options);
  }
}

Future<void> editHeading(WidgetTester tester, String value) async {
  await tester.tap(find.text('Gift finder'));
  await tester.pumpAndSettle();
  await tester.tap(find.text('Edit settings'));
  await tester.pumpAndSettle();
  await tester.enterText(find.byType(TextFormField), value);
  await tester.tap(find.text('Apply'));
  await tester.pumpAndSettle();
}

void main() {
  testWidgets(
    'library creates an editable draft without claiming a second theme copy',
    (tester) async {
      final api = _LibraryApi();
      await mount(
        tester,
        api,
        home: const ThemeScreen(),
        subdomain: 'synthetic',
      );
      expect(find.text('Duplicate'), findsNothing);
      await tester.tap(find.text('Create draft'));
      await tester.pumpAndSettle();
      expect(api.saves, hasLength(1));
      final saved = api.saves.single['template_config'] as Map;
      expect(saved['liquidBundle'], document(api.slug)['liquidBundle']);
      expect(saved.containsKey('duplicatedAt'), false);
      expect(find.text('Draft created'), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );
  testWidgets(
    'library preview failure stays unavailable instead of opening an unsigned or legacy preview',
    (tester) async {
      final api = _LibraryApi()..version = 1;
      await mount(
        tester,
        api,
        home: const ThemeScreen(),
        subdomain: 'synthetic',
      );
      await tester.tap(find.text('Preview'));
      await tester.pumpAndSettle();
      expect(api.previewAttempts, 1);
      expect(find.byType(LivePreviewScreen), findsNothing);
      expect(
        find.textContaining('saved design preview could not load'),
        findsOneWidget,
      );
      expect(tester.takeException(), isNull);
    },
  );
  testWidgets(
    'publication confirmation remains usable at 320dp and 2.4 text scale without sending a mutation on cancel',
    (tester) async {
      final api = _Api()..version = 1;
      await mount(tester, api, size: const Size(320, 700), textScale: 2.4);
      await tester.tap(find.text('Publish'));
      await tester.pumpAndSettle();
      expect(find.text('Publish saved design?'), findsOneWidget);
      expect(tester.takeException(), isNull);
      await tester.tap(find.text('Cancel'));
      await tester.pumpAndSettle();
      expect(api.saves, isEmpty);
      expect(tester.takeException(), isNull);
    },
  );
  testWidgets(
    'niche Liquid edit keeps groups, blocks, other pages and source on save',
    (tester) async {
      final api = _Api(), original = document('letbuyy-summit');
      await mount(tester, api);
      expect(find.text('Gift finder'), findsOneWidget);
      expect(find.text('Add section'), findsNothing);
      await editHeading(tester, 'A gift for them');
      await tester.tap(find.text('Save draft'));
      await tester.pumpAndSettle();
      final saved = api.saves.single['template_config'] as Map;
      expect(saved['liquidBundle'], original['liquidBundle']);
      expect(
        (saved['templates'] as Map)['header'],
        (original['templates'] as Map)['header'],
      );
      expect(
        (saved['templates'] as Map)['product'],
        (original['templates'] as Map)['product'],
      );
      final hero =
          (((saved['templates'] as Map)['index'] as Map)['sections']
                  as Map)['hero']
              as Map;
      expect(
        hero['blocks'],
        ((((original['templates'] as Map)['index'] as Map)['sections']
                as Map)['hero']
            as Map)['blocks'],
      );
      expect((hero['settings'] as Map)['heading'], 'A gift for them');
      expect((hero['settings'] as Map)['futureSetting'], {'retain': 7});
      expect(find.text('Saved draft · revision 1'), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );
  testWidgets(
    'tab reload preserves dirty Liquid edits; account change removes controls',
    (tester) async {
      final api = _Api(), key = GlobalKey<SectionEditorScreenState>();
      final stores = await mount(tester, api, key: key);
      await editHeading(tester, 'Keep this native draft');
      await key.currentState!.reloadStore();
      await tester.pumpAndSettle();
      expect(api.queries.length, 1);
      expect(find.text('Unsaved changes'), findsOneWidget);
      api.identity = ('actor-b', 'store-b');
      stores.changed();
      await tester.pumpAndSettle();
      expect(find.text('Save draft'), findsNothing);
      expect(api.saves, isEmpty);
      expect(tester.takeException(), isNull);
    },
  );
  testWidgets('response loss locks new edits and retries exact save identity', (
    tester,
  ) async {
    final api = _Api()..loseNextSave = true;
    await mount(tester, api);
    await editHeading(tester, 'Recover this exact design');
    await tester.tap(find.text('Save draft'));
    await tester.pumpAndSettle();
    expect(find.text('Retry save'), findsOneWidget);
    final settings = tester.widget<OutlinedButton>(
      find.widgetWithText(OutlinedButton, 'Edit settings'),
    );
    expect(settings.onPressed, isNull);
    await tester.tap(find.text('Retry save'));
    await tester.pumpAndSettle();
    expect(api.saves.length, 2);
    expect(api.saves[1], api.saves[0]);
    expect(find.text('Saved draft · revision 1'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
  testWidgets(
    'stale revision retains local draft and requires deliberate reload',
    (tester) async {
      final api = _Api()..conflict = true;
      await mount(tester, api);
      await editHeading(tester, 'Keep after conflict');
      await tester.tap(find.text('Save draft'));
      await tester.pumpAndSettle();
      expect(
        find.textContaining('This theme changed elsewhere'),
        findsOneWidget,
      );
      expect(find.text('Unsaved changes'), findsOneWidget);
      expect(
        tester
            .widget<FilledButton>(
              find.widgetWithText(FilledButton, 'Save draft'),
            )
            .onPressed,
        isNull,
      );
      expect(tester.takeException(), isNull);
    },
  );
  testWidgets(
    'page selection uses the product API scope without rewriting home',
    (tester) async {
      final api = _Api();
      await mount(tester, api);
      await tester.tap(find.byType(DropdownButtonFormField<String>));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Product').last);
      await tester.pumpAndSettle();
      expect(api.queries.last['template_key'], 'product');
      expect(find.text('Product information'), findsOneWidget);
      expect(api.saves, isEmpty);
      expect(tester.takeException(), isNull);
    },
  );
}
