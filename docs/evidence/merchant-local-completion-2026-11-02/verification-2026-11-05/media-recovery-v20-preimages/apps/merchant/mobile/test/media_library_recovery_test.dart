import 'dart:async';
import 'package:dio/dio.dart';
import 'package:video_player/video_player.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:letbuyy_store/app/store_context.dart';
import 'package:letbuyy_store/models/store_model.dart';
import 'package:letbuyy_store/screens/content/media_library_screen.dart';
import 'package:letbuyy_store/services/api_client.dart';
import 'package:letbuyy_store/services/media_service.dart';
import 'kyc_containment_test.dart' show TestStores;

class LocalStores extends TestStores {
  LocalStores(super.api);
  bool unavailable = false;
  @override
  Future<StoreModel?> ensureSelectedStore({bool force = false}) async {
    if (unavailable)
      throw const ApiException(
        message: 'Synthetic unavailable',
        statusCode: 503,
        code: 'SYNTHETIC_UNAVAILABLE',
      );
    return super.ensureSelectedStore(force: force);
  }
}

class HeldController extends VideoPlayerController {
  HeldController(super.url) : super.networkUrl();
  final ready = Completer<void>();
  int loops = 0, plays = 0, disposals = 0;
  @override
  Future<void> initialize() => ready.future;
  @override
  Future<void> setLooping(bool looping) async {
    loops++;
  }

  @override
  Future<void> play() async {
    plays++;
  }

  @override
  Future<void> dispose() async {
    disposals++;
    await super.dispose();
  }
}

class Fixture {
  Fixture() {
    api = ApiClient(
      baseUrl: 'https://synthetic.invalid/v1',
      maxRetries: 0,
      contextVersionProvider: () => stores.requestContextKey,
    );
    stores = LocalStores(api);
    media = MediaService(api: api, storeIdProvider: () => stores.store);
    api.dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (o, h) {
          calls.add(o);
          final page = o.queryParameters['page'] ?? 1;
          final first = page == 1 ? 1 : 61;
          final last = page == 1 ? 60 : 61;
          h.resolve(
            Response(
              requestOptions: o,
              statusCode: 200,
              data: o.method == 'DELETE'
                  ? {
                      'data': {'deleted': true},
                    }
                  : {
                      'data': [
                        for (var i = first; i <= last; i++)
                          {
                            'id': 'media-$i',
                            'store_id': stores.store,
                            'filename': video && i == 1
                                ? 'synthetic-video.mp4'
                                : 'document-$i.pdf',
                            'url': 'https://synthetic.invalid/$i.pdf',
                            'mime_type': video && i == 1
                                ? 'video/mp4'
                                : 'application/pdf',
                            'media_type': video && i == 1
                                ? 'video'
                                : 'document',
                            'size_bytes': 12,
                            'storage_key': 'retained/$i',
                          },
                      ],
                      'meta': {
                        'page': page,
                        'per_page': 60,
                        'has_next': page == 1,
                        'has_prev': page != 1,
                        'next_cursor': page == 1 ? 'synthetic-next' : null,
                      },
                    },
            ),
          );
        },
      ),
    );
  }
  late ApiClient api;
  late LocalStores stores;
  late MediaService media;
  final calls = <RequestOptions>[];
  bool video = false;
  final controllers = <HeldController>[];
  Widget screen() => MultiProvider(
    providers: [
      ChangeNotifierProvider<StoreContext>.value(value: stores),
      ChangeNotifierProvider<MediaService>.value(value: media),
    ],
    child: MaterialApp(
      home: MediaLibraryScreen(
        videoControllerFactory: (uri) {
          final c = HeldController(uri);
          controllers.add(c);
          return c;
        },
      ),
    ),
  );
  Future<void> mount(WidgetTester tester, {bool loaded = true}) async {
    tester.view.physicalSize = const Size(1000, 1600);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    await tester.pumpWidget(screen());
    await tester.pumpAndSettle();
    if (loaded)
      expect(
        find.text(video ? 'synthetic-video.mp4' : 'document-1.pdf'),
        findsOneWidget,
      );
    addTearDown(() async {
      await tester.pumpWidget(const SizedBox.shrink());
      media.dispose();
      stores.dispose();
      api.close();
    });
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  for (final retirement in ['current', 'store', 'route']) {
    testWidgets(
      'video initialization plays only in its current surface ($retirement)',
      (tester) async {
        final f = Fixture()..video = true;
        await f.mount(tester);
        final preview = find
            .ancestor(
              of: find.byIcon(Icons.play_circle_outline_rounded).first,
              matching: find.byType(GestureDetector),
            )
            .first;
        await tester.tap(preview);
        await tester.pump();
        await tester.pump(const Duration(milliseconds: 350));
        expect(f.controllers, hasLength(2));
        if (retirement == 'store') {
          f.stores.change(actorId: 'another-actor', storeId: 'store-b');
          await tester.pump();
        } else if (retirement == 'route') {
          await tester.pumpWidget(const SizedBox.shrink());
        }
        for (final c in f.controllers) {
          c.ready.complete();
        }
        await tester.pump();
        await tester.pump(const Duration(milliseconds: 100));
        expect(
          f.controllers.map((c) => c.disposals),
          retirement == 'current' ? [0, 0] : [1, 1],
        );
        expect(
          f.controllers.map((c) => c.loops),
          retirement == 'current' ? [1, 1] : [0, 0],
        );
        expect(
          f.controllers.map((c) => c.plays),
          retirement == 'current' ? [0, 1] : [0, 0],
        );
        if (retirement == 'store') {
          expect(find.text('synthetic-video.mp4'), findsNothing);
          expect(find.text('Store access changed'), findsOneWidget);
        }
        expect(tester.takeException(), isNull);
      },
    );
  }
  testWidgets(
    'store bootstrap outage shows Retry and later recovers the populated library',
    (tester) async {
      final f = Fixture()..stores.unavailable = true;
      await f.mount(tester, loaded: false);
      expect(find.widgetWithText(OutlinedButton, 'Retry'), findsOneWidget);
      expect(
        find.text('Create or select a store before uploading media.'),
        findsNothing,
      );
      f.stores.unavailable = false;
      await tester.tap(find.widgetWithText(OutlinedButton, 'Retry'));
      await tester.pumpAndSettle();
      expect(find.text('document-1.pdf'), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );
  testWidgets(
    'media page controls reach beyond sixty and preserve applied query over an unsubmitted draft',
    (tester) async {
      final f = Fixture();
      await f.mount(tester);
      await tester.enterText(find.byType(TextField), 'unsent draft');
      await tester.tap(find.widgetWithText(TextButton, 'Next'));
      await tester.pumpAndSettle();
      expect(find.text('document-61.pdf'), findsOneWidget);
      expect(f.calls.last.queryParameters['page'], 2);
      expect(f.calls.last.queryParameters['search'], isNull);
      expect(find.text('Page 2'), findsOneWidget);
      expect(find.widgetWithText(TextButton, 'Previous'), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );
  for (final action in ['Edit media', 'Delete media']) {
    testWidgets(
      '$action retires old private fields and controls on store switch',
      (tester) async {
        final f = Fixture();
        await f.mount(tester);
        await tester.tap(find.byTooltip(action).first);
        await tester.pumpAndSettle();
        expect(find.byType(AlertDialog), findsOneWidget);
        f.stores.change(actorId: 'another-actor', storeId: 'store-b');
        await tester.pumpAndSettle();
        expect(find.text('Store access changed'), findsOneWidget);
        expect(find.widgetWithText(FilledButton, 'Save'), findsNothing);
        expect(find.widgetWithText(FilledButton, 'Delete'), findsNothing);
        expect(find.textContaining('document-1.pdf'), findsNothing);
        expect(f.calls.where((o) => o.method != 'GET'), isEmpty);
        expect(tester.takeException(), isNull);
      },
    );
  }
  testWidgets('library removal does not delete referenced storage bytes', (
    tester,
  ) async {
    final f = Fixture();
    await f.mount(tester);
    await tester.tap(find.byTooltip('Delete media').first);
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(FilledButton, 'Delete'));
    await tester.pumpAndSettle();
    final writes = f.calls.where((o) => o.method == 'DELETE').toList();
    expect(writes, hasLength(1));
    expect(writes.single.path, endsWith('/media/media-1'));
    expect(writes.single.headers['X-Store-ID'], 'store-a');
    expect(f.calls.where((o) => o.path.contains('/upload')), isEmpty);
    expect(tester.takeException(), isNull);
  });
}
