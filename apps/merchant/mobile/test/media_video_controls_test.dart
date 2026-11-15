import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:video_player/video_player.dart';
import 'package:letbuyy_store/app/store_context.dart';
import 'package:letbuyy_store/services/media_service.dart';
import 'package:letbuyy_store/screens/content/media_library_screen.dart';
import 'media_library_recovery_test.dart' as fixtures;

class ControlledVideo extends VideoPlayerController {
  ControlledVideo(super.uri, {this.fail = false}) : super.networkUrl();
  final bool fail;
  int plays = 0, pauses = 0, disposals = 0;
  @override
  Future<void> initialize() async {
    if (fail) throw StateError('Private decoder details');
    value = VideoPlayerValue(
      duration: const Duration(seconds: 10),
      size: const Size(16, 16),
      isInitialized: true,
    );
  }

  @override
  Future<void> setLooping(bool looping) async {}
  @override
  Future<void> play() async {
    plays++;
    value = value.copyWith(isPlaying: true);
  }

  @override
  Future<void> pause() async {
    pauses++;
    value = value.copyWith(isPlaying: false);
  }

  @override
  Future<void> setVolume(double volume) async {
    value = value.copyWith(volume: volume);
  }

  @override
  Future<void> seekTo(Duration position) async {
    value = value.copyWith(position: position);
  }

  @override
  Future<void> dispose() async {
    disposals++;
    await super.dispose();
  }
}

Future<void> mountVideo(
  WidgetTester tester,
  fixtures.Fixture f,
  List<ControlledVideo> controllers, {
  bool failDialog = false,
  double textScale = 1,
  bool openPreview = true,
}) async {
  tester.view.physicalSize = const Size(900, 1400);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);
  await tester.pumpWidget(
    MultiProvider(
      providers: [
        ChangeNotifierProvider<StoreContext>.value(value: f.stores),
        ChangeNotifierProvider<MediaService>.value(value: f.media),
      ],
      child: MaterialApp(
        builder: (context, child) => MediaQuery(
          data: MediaQuery.of(
            context,
          ).copyWith(textScaler: TextScaler.linear(textScale)),
          child: child!,
        ),
        home: MediaLibraryScreen(
          videoControllerFactory: (uri) {
            final c = ControlledVideo(
              uri,
              fail: failDialog && controllers.isEmpty,
            );
            controllers.add(c);
            return c;
          },
        ),
      ),
    ),
  );
  await tester.pumpAndSettle();
  addTearDown(() async {
    await tester.pumpWidget(const SizedBox.shrink());
    f.media.dispose();
    f.stores.dispose();
    f.api.close();
  });
  if (!openPreview) return;
  final semantics = tester.ensureSemantics();
  try {
    await tester.pump();
    final preview = find
        .bySemanticsLabel(RegExp('Play video synthetic-video\\.mp4'))
        .first;
    await tester.tap(preview);
    await tester.pumpAndSettle();
  } finally {
    semantics.dispose();
  }
}

void main() {
  setUp(() => FlutterSecureStorage.setMockInitialValues({}));
  testWidgets(
    'a loaded video library does not create decoders until explicit preview',
    (tester) async {
      final f = fixtures.Fixture()..video = true;
      final controllers = <ControlledVideo>[];
      await mountVideo(tester, f, controllers, openPreview: false);
      expect(find.text('synthetic-video.mp4'), findsOneWidget);
      expect(controllers, isEmpty);
    },
  );
  testWidgets('video preview supports explicit play pause and mute controls', (
    tester,
  ) async {
    final f = fixtures.Fixture()..video = true;
    final controllers = <ControlledVideo>[];
    await mountVideo(tester, f, controllers);
    expect(find.byTooltip('Pause video'), findsOneWidget);
    await tester.tap(find.byTooltip('Pause video'));
    await tester.pump();
    expect(controllers.last.value.isPlaying, isFalse);
    expect(find.byTooltip('Play video'), findsOneWidget);
    await tester.tap(find.byTooltip('Play video'));
    await tester.pump();
    expect(controllers.last.value.isPlaying, isTrue);
    expect(find.byTooltip('Unmute video'), findsOneWidget);
    await tester.tap(find.byTooltip('Unmute video'));
    await tester.pump();
    expect(controllers.last.value.volume, 1);
    expect(find.byTooltip('Mute video'), findsOneWidget);
  });
  testWidgets(
    'leaving the foreground pauses the video without automatic resumption',
    (tester) async {
      final f = fixtures.Fixture()..video = true;
      final controllers = <ControlledVideo>[];
      await mountVideo(tester, f, controllers);
      expect(controllers.last.value.isPlaying, isTrue);
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.inactive);
      await tester.pump();
      expect(controllers.last.value.isPlaying, isFalse);
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
      await tester.pump();
      expect(controllers.last.value.isPlaying, isFalse);
      expect(find.byTooltip('Play video'), findsOneWidget);
    },
  );
  testWidgets(
    'decoder failure offers retry and disposes the failed controller',
    (tester) async {
      final f = fixtures.Fixture()..video = true;
      final controllers = <ControlledVideo>[];
      await mountVideo(tester, f, controllers, failDialog: true);
      expect(find.text('Video could not load'), findsOneWidget);
      expect(find.textContaining('Private decoder details'), findsNothing);
      await tester.tap(find.text('Retry video'));
      await tester.pumpAndSettle();
      expect(controllers, hasLength(2));
      expect(controllers[0].disposals, 1);
      expect(find.byTooltip('Pause video'), findsOneWidget);
      expect(f.calls.every((call) => call.method == 'GET'), isTrue);
    },
  );
  testWidgets(
    'seeking changes the actual player position and close disposes its controller',
    (tester) async {
      final f = fixtures.Fixture()..video = true;
      final controllers = <ControlledVideo>[];
      await mountVideo(tester, f, controllers);
      await tester.drag(find.byType(Slider), const Offset(100, 0));
      await tester.pump();
      expect(controllers.last.value.position, greaterThan(Duration.zero));
      expect(find.textContaining('/ 00:10'), findsOneWidget);
      await tester.tap(find.byTooltip('Close preview'));
      await tester.pumpAndSettle();
      expect(controllers.last.disposals, 1);
    },
  );
  testWidgets(
    'covering the video route pauses it and returning never restarts audio',
    (tester) async {
      final f = fixtures.Fixture()..video = true;
      final controllers = <ControlledVideo>[];
      await mountVideo(tester, f, controllers);
      final navigator = Navigator.of(
        tester.element(find.byType(VideoPlayer).last),
      );
      navigator.push(
        MaterialPageRoute<void>(
          builder: (_) => const Scaffold(body: Text('Another task')),
        ),
      );
      await tester.pumpAndSettle();
      expect(controllers.last.value.isPlaying, isFalse);
      navigator.pop();
      await tester.pumpAndSettle();
      expect(controllers.last.value.isPlaying, isFalse);
      expect(find.byTooltip('Play video'), findsOneWidget);
    },
  );
  testWidgets('video controls remain reachable at320dp and2.4text', (
    tester,
  ) async {
    final f = fixtures.Fixture()..video = true;
    final controllers = <ControlledVideo>[];
    await mountVideo(tester, f, controllers, textScale: 2.4);
    tester.view.physicalSize = const Size(320, 700);
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.byTooltip('Pause video'));
    await tester.pumpAndSettle();
    await tester.tap(find.byTooltip('Pause video'));
    await tester.pump();
    expect(controllers.last.value.isPlaying, isFalse);
    expect(tester.takeException(), isNull);
  });
}
