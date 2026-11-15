import 'dart:async';
import 'dart:io';
import 'package:dio/dio.dart';
import 'package:file_picker/file_picker.dart';
import 'package:image_picker/image_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:provider/provider.dart';
import 'package:letbuyy_store/app/store_context.dart';
import 'package:letbuyy_store/services/media_service.dart';
import 'package:letbuyy_store/services/native_media_selection.dart';
import 'package:letbuyy_store/screens/content/media_library_screen.dart';
import 'media_library_recovery_test.dart' as fixtures;

class ModelPicker extends FilePicker {
  Future<FilePickerResult?> Function() result = () async => null;
  int calls = 0;
  @override
  Future<FilePickerResult?> pickFiles({
    String? dialogTitle,
    String? initialDirectory,
    FileType type = FileType.any,
    List<String>? allowedExtensions,
    Function(FilePickerStatus)? onFileLoading,
    bool allowCompression = false,
    int compressionQuality = 0,
    bool allowMultiple = false,
    bool withData = false,
    bool withReadStream = false,
    bool lockParentWindow = false,
    bool readSequential = false,
  }) {
    calls++;
    expect(
      type,
      FileType.any,
      reason: 'GLTF can have no registered native UTI',
    );
    expect(allowMultiple, isFalse);
    expect(withData, isFalse);
    return result();
  }
}

void main() {
  late ModelPicker picker;
  late Directory directory;
  setUp(() {
    FlutterSecureStorage.setMockInitialValues({});
    FilePicker? prior;
    try {
      prior = FilePicker.platform;
    } catch (_) {
      /* Unregistered in this test isolate. */
    }
    picker = ModelPicker();
    FilePicker.platform = picker;
    addTearDown(() {
      if (prior != null) FilePicker.platform = prior;
    });
    directory = Directory.systemTemp.createTempSync('merchant-model-picker-');
  });
  tearDown(() => directory.deleteSync(recursive: true));
  File model([String suffix = 'gltf']) =>
      File('${directory.path}/synthetic.$suffix')..writeAsBytesSync([1, 2, 3]);
  FilePickerResult chosen(File file) => FilePickerResult([
    PlatformFile(
      name: file.path.split('/').last,
      size: file.lengthSync(),
      path: file.path,
    ),
  ]);
  fixtures.Fixture fixture() {
    final f = fixtures.Fixture();
    f.nativeSelection = NativeMediaSelection(
      contextProvider: () => (
        actorId: f.stores.actor,
        storeId: f.stores.store,
        version: f.stores.requestContextKey,
      ),
      directoryProvider: () async => directory,
      retrieveLostData: () async => LostDataResponse.empty(),
    );
    return f;
  }

  Future<void> ioTurns(WidgetTester tester, bool Function() completed) async {
    for (var i = 0; i < 100 && !completed(); i++) {
      await tester.pump(const Duration(milliseconds: 10));
      await tester.runAsync(
        () => Future<void>.delayed(const Duration(milliseconds: 10)),
      );
    }
    expect(
      completed(),
      isTrue,
      reason: 'The complete native selection/SDK/UI continuation must settle',
    );
    await tester.pumpAndSettle();
  }

  Future<void> chooseModel(
    WidgetTester tester, {
    Future<void>? registered,
    bool video = false,
  }) async {
    await tester.tap(find.text('Upload'));
    await tester.pumpAndSettle();
    await tester.tap(find.text(video ? 'Upload video' : 'Upload 3D model'));
    if (video) {
      await tester.pumpAndSettle();
      await tester.tap(find.text('Files'));
    }
    await ioTurns(tester, () => picker.calls == 1);
    if (registered != null) {
      var completed = false;
      registered.then((_) => completed = true);
      // File hashing and native-client completions need real I/O turns as well
      // as the widget fake clock; neither alone can drive this whole journey.
      for (var i = 0; i < 100 && !completed; i++) {
        await tester.pump(const Duration(milliseconds: 10));
        await tester.runAsync(
          () => Future<void>.delayed(const Duration(milliseconds: 10)),
        );
      }
      expect(
        completed,
        isTrue,
        reason: 'The Media registration must actually finish',
      );
      await ioTurns(
        tester,
        () => find.text('Media uploaded').evaluate().isNotEmpty,
      );
    }
    await tester.pumpAndSettle();
  }

  testWidgets('general Media exposes the canonical GLB/GLTF import action', (
    tester,
  ) async {
    final f = fixture();
    await f.mount(tester);
    await tester.tap(find.text('Upload'));
    await tester.pumpAndSettle();
    expect(find.text('Upload 3D model'), findsOneWidget);
    expect(find.textContaining('GLB or GLTF'), findsOneWidget);
    expect(f.calls.every((call) => call.method == 'GET'), isTrue);
  });
  for (final mode in [
    'cancel',
    'denied',
    'wrong-type',
    'store',
    'covered-route',
  ]) {
    testWidgets('$mode model selection dispatches no upload or registration', (
      tester,
    ) async {
      final f = fixture();
      await f.mount(tester);
      final pending = Completer<FilePickerResult?>();
      if (mode == 'denied')
        picker.result = () async => throw PlatformException(
          code: 'permission_denied',
          message: 'Private file-provider details',
        );
      else if (mode == 'wrong-type')
        picker.result = () async => chosen(model('png'));
      else if (mode == 'store' || mode == 'covered-route')
        picker.result = () => pending.future;
      await chooseModel(tester);
      if (mode == 'store')
        f.stores.change(actorId: 'another-actor', storeId: 'store-b');
      if (mode == 'covered-route') {
        Navigator.of(tester.element(find.byType(MediaLibraryScreen))).push(
          MaterialPageRoute<void>(
            builder: (_) => const Scaffold(body: Text('Another task')),
          ),
        );
        await tester.pumpAndSettle();
      }
      if (!pending.isCompleted) pending.complete(chosen(model()));
      await ioTurns(tester, () => !f.nativeSelection!.busy);
      expect(picker.calls, 1);
      expect(f.calls.where((call) => call.method != 'GET'), isEmpty);
      final saved = await const FlutterSecureStorage().readAll();
      expect(
        saved.keys.where(
          (key) => key.startsWith('letbuyy.security.command.v1:'),
        ),
        isEmpty,
      );
      expect(
        f.nativeSelection!.hasSelection,
        !['cancel', 'denied'].contains(mode),
      );
      if (mode == 'store')
        expect(f.nativeSelection!.belongsToCurrentOwner, isFalse);
      expect(
        find.textContaining('Private file-provider details'),
        findsNothing,
      );
      if (mode == 'denied')
        expect(find.textContaining('Could not open files'), findsOneWidget);
      if (mode == 'wrong-type')
        expect(find.textContaining('Choose a GLB or GLTF'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });
  }

  for (final extension in ['GLB', 'gltf', 'mp4', 'mov', 'webm']) {
    testWidgets(
      '$extension imports with its original MIME and durable Media registration',
      (tester) async {
        final f = fixture();
        final file = model(extension);
        final video = ['mp4', 'mov', 'webm'].contains(extension);
        picker.result = () async => chosen(file);
        Map<String, dynamic>? uploaded, observedPart;
        Object? createKey;
        final registered = Completer<void>();
        f.api.dio.interceptors.removeLast();
        f.api.dio.interceptors.add(
          InterceptorsWrapper(
            onRequest: (o, h) {
              f.calls.add(o);
              final mime = {
                'GLB': 'model/gltf-binary',
                'gltf': 'model/gltf+json',
                'mp4': 'video/mp4',
                'mov': 'video/quicktime',
                'webm': 'video/webm',
              }[extension]!;
              Object data;
              if (o.path.endsWith('/upload')) {
                final form = o.data as FormData;
                observedPart = {
                  'type': form.files.single.value.contentType.toString(),
                  'filename': form.files.single.value.filename,
                  'key': o.headers['X-Idempotency-Key'],
                };
                data = {
                  'url': 'https://synthetic.invalid/model.$extension',
                  'key': 'public-media/model.$extension',
                  'store_id': 'store-a',
                  'size': 3,
                  'content_type': mime,
                  'media_type': video ? 'video' : 'other',
                };
              } else if (o.method == 'POST') {
                createKey = o.headers['X-Idempotency-Key'];
                uploaded = {
                  ...o.data as Map<String, dynamic>,
                  'id': 'model-1',
                  'media_type': video ? 'video' : 'other',
                };
                registered.complete();
                data = uploaded!;
              } else {
                data = [
                  uploaded ??
                      {
                        'id': 'old-document',
                        'store_id': 'store-a',
                        'filename': 'document-1.pdf',
                        'url': 'https://synthetic.invalid/old.pdf',
                        'mime_type': 'application/pdf',
                        'media_type': 'document',
                        'size_bytes': 3,
                      },
                ];
              }
              h.resolve(
                Response(
                  requestOptions: o,
                  statusCode: o.method == 'POST' ? 201 : 200,
                  data: {
                    'data': data,
                    'meta': {'has_next': false},
                  },
                ),
              );
            },
          ),
        );
        await f.mount(tester);
        await chooseModel(tester, registered: registered.future, video: video);
        expect(
          observedPart?['type'],
          {
            'GLB': 'model/gltf-binary',
            'gltf': 'model/gltf+json',
            'mp4': 'video/mp4',
            'mov': 'video/quicktime',
            'webm': 'video/webm',
          }[extension],
        );
        expect(observedPart?['filename'], 'synthetic.$extension');
        expect(observedPart?['key'], startsWith('media-upload-'));
        expect(createKey, startsWith('media-create-'));
        expect(uploaded?['filename'], 'synthetic.$extension');
        expect(uploaded?['media_type'], video ? 'video' : 'other');
        expect(find.text('synthetic.$extension'), findsOneWidget);
        if (!video) expect(find.text('3D model'), findsOneWidget);
        expect(f.calls.where((call) => call.method == 'POST'), hasLength(2));
        expect(f.media.hasPendingUpload, isFalse);
        expect(await const FlutterSecureStorage().readAll(), isEmpty);
      },
    );
  }

  testWidgets(
    'large-text upload choices scroll and product picker stays image-only',
    (tester) async {
      final f = fixture();
      tester.view.physicalSize = const Size(320, 700);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      Widget surface(bool imageOnly) => MultiProvider(
        providers: [
          ChangeNotifierProvider<NativeMediaSelection>.value(
            value: f.nativeSelection!,
          ),
          ChangeNotifierProvider<StoreContext>.value(value: f.stores),
          ChangeNotifierProvider<MediaService>.value(value: f.media),
        ],
        child: MaterialApp(
          builder: (context, child) => MediaQuery(
            data: MediaQuery.of(
              context,
            ).copyWith(textScaler: TextScaler.linear(2.4)),
            child: child!,
          ),
          home: MediaLibraryScreen(
            key: ValueKey(imageOnly),
            selectProductImage: imageOnly,
          ),
        ),
      );
      addTearDown(() async {
        await tester.pumpWidget(const SizedBox.shrink());
        f.media.dispose();
        f.nativeSelection?.dispose();
        f.stores.dispose();
        f.api.close();
      });
      await tester.pumpWidget(surface(false));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Upload'));
      await tester.pumpAndSettle();
      await tester.ensureVisible(find.text('Upload 3D model'));
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox.shrink());
      await tester.pumpWidget(surface(true));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Upload'));
      await tester.pumpAndSettle();
      expect(find.text('Upload image'), findsOneWidget);
      expect(find.text('Upload video'), findsNothing);
      expect(find.text('Upload 3D model'), findsNothing);
      expect(picker.calls, 0);
      expect(tester.takeException(), isNull);
    },
  );
}
