import 'dart:async';
import 'dart:io';
import 'package:crypto/crypto.dart';
import 'package:flutter/services.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:image_picker/image_picker.dart';
import 'package:letbuyy_store/services/native_media_selection.dart';
import 'package:letbuyy_store/services/security_command_store.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  late Directory directory;
  MerchantSecurityContext? scope;
  late SecurityCommandStore commands;
  NativeMediaSelection controller({
    TargetPlatform platform = TargetPlatform.android,
    Future<LostDataResponse> Function()? lost,
  }) => NativeMediaSelection(
    contextProvider: () => scope,
    commands: commands,
    platform: platform,
    directoryProvider: () async => directory,
    retrieveLostData: lost ?? () async => LostDataResponse.empty(),
  );
  Future<File> input([String name = 'original.jpg']) async {
    final file = File('${directory.path}/$name');
    await file.writeAsBytes([255, 216, 255, 224, 1, 2, 3, 4]);
    return file;
  }

  setUp(() async {
    FlutterSecureStorage.setMockInitialValues({});
    scope = (actorId: 'owner-a', storeId: 'site-a', version: 1);
    commands = SecurityCommandStore(environment: 'local');
    directory = await Directory.systemTemp.createTemp(
      'merchant-native-selection-test-',
    );
  });
  tearDown(() async {
    await directory.delete(recursive: true);
  });

  test(
    'iOS interrupted picker remains unavailable until an explicit discard and reselect',
    () async {
      final first = controller(platform: TargetPlatform.iOS),
          pending = Completer<XFile?>();
      final original = first.pick(
        purpose: 'public-media-video',
        kind: 'video',
        maxBytes: 100,
        pick: () => pending.future,
      );
      while (await commands.readExclusive('native-media-selection') == null) {
        await Future<void>.delayed(Duration.zero);
      }
      first.dispose();
      final restored = controller(
        platform: TargetPlatform.iOS,
        lost: () async =>
            throw StateError('iOS must never call Android recovery'),
      );
      await restored.initialize();
      expect(restored.error, isNull);
      expect(restored.hasSelection, isTrue);
      expect(restored.canRecover, isFalse);
      await expectLater(
        restored.recover('public-media-video'),
        throwsA(isA<Exception>()),
      );
      await restored.discard();
      pending.complete(null);
      await original;
      expect(
        await restored.pick(
          purpose: 'public-media-video',
          kind: 'video',
          maxBytes: 100,
          pick: () async => null,
        ),
        isNull,
      );
      restored.dispose();
    },
  );
  test(
    'startup failure blocks new OS UI and sanitizes native error details',
    () async {
      final selection = controller(
        lost: () async => throw PlatformException(
          code: 'native_error',
          message: 'private native URI and account detail',
        ),
      );
      await selection.initialize();
      var called = false;
      expect(selection.error, isNot(contains('private native URI')));
      await expectLater(
        selection.pick(
          purpose: 'public-media-image',
          kind: 'image',
          maxBytes: 100,
          pick: () async {
            called = true;
            return null;
          },
        ),
        throwsA(isA<Exception>()),
      );
      expect(called, isFalse);
      selection.dispose();
    },
  );
  test(
    'a file outside the retained private path cannot borrow a saved request key',
    () async {
      final original = await input(), selection = controller();
      final selected = (await selection.pick(
        purpose: 'public-media-image',
        kind: 'image',
        maxBytes: 100,
        pick: () async => XFile(original.path),
      ))!;
      final key = selection.keyForFile(selected);
      expect(
        () => selection.keyForFile(
          XFile('${directory.path}/forged/$key/${selected.name}'),
        ),
        throwsA(isA<Exception>()),
      );
      selection.dispose();
    },
  );
  for (final filesProvider in [false, true]) {
    test(
      'unknown type or wrong OS-provider lost result cannot attach filesProvider$filesProvider',
      () async {
        final file = await input();
        final first = controller(), pending = Completer<XFile?>();
        final old = first.pick(
          purpose: 'public-media-image',
          kind: 'image',
          imagePickerSource: !filesProvider,
          maxBytes: 100,
          pick: () => pending.future,
        );
        while (await commands.readExclusive('native-media-selection') == null) {
          await Future<void>.delayed(Duration.zero);
        }
        first.dispose();
        final restored = controller(
          lost: () async => LostDataResponse(
            file: XFile(file.path),
            files: [XFile(file.path)],
            type: filesProvider ? RetrieveType.image : null,
          ),
        );
        await restored.initialize();
        expect(restored.canRecover, isFalse);
        await expectLater(
          restored.recover('public-media-image'),
          throwsA(isA<Exception>()),
        );
        expect(await file.exists(), isTrue);
        await restored.discard();
        pending.complete(null);
        await old;
        restored.dispose();
      },
    );
  }
  test(
    'a reselected private file keeps its original backend key and family through completion',
    () async {
      final file = await input(), selection = controller();
      const originalKey = 'retained-upload-key-0001';
      final selected = (await selection.pick(
        purpose: 'private-kyc-business_pan',
        kind: 'image',
        maxBytes: 100,
        draft: {
          'operation': 'kyc-upload',
          'operation_key': originalKey,
          'document_type': 'business_pan',
        },
        pick: () async => XFile(file.path),
      ))!;
      expect(selection.keyForFile(selected), isNot(originalKey));
      expect(
        selection.operationKeyForFile(selected, 'kyc-upload'),
        originalKey,
      );
      await selection.completeOperation(originalKey, 'media-upload');
      expect(selection.hasSelection, isTrue);
      await selection.bindInput(selected, {
        'document_type': 'business_pan',
        'reference': '1234',
        'transport': 'private',
      });
      await expectLater(
        selection.bindInput(selected, {
          'document_type': 'business_pan',
          'reference': '1234',
          'transport': 'india',
        }),
        throwsA(isA<Exception>()),
      );
      await selection.completeOperation(originalKey, 'kyc-upload');
      expect(selection.hasSelection, isFalse);
      expect(await file.exists(), isTrue);
      selection.dispose();
    },
  );
  test(
    'owner and purpose are durable before OS UI opens; cancellation clears only its intent',
    () async {
      final selection = controller();
      var called = false;
      final result = await selection.pick(
        purpose: 'public-media-image',
        kind: 'image',
        maxBytes: 100,
        pick: () async {
          called = true;
          final saved = await commands.readExclusive('native-media-selection');
          expect(saved!.actor, 'owner-a');
          expect(saved.store, 'site-a');
          expect(saved.intent['purpose'], 'public-media-image');
          expect(saved.intent['stage'], 'picking');
          return null;
        },
      );
      expect(called, isTrue);
      expect(result, isNull);
      expect(await commands.readExclusive('native-media-selection'), isNull);
      selection.dispose();
    },
  );

  test(
    'death in camera retains actual lost bytes; a new actor/store/purpose never receives them',
    () async {
      final file = await input();
      final first = controller(), picker = Completer<XFile?>();
      final pending = first.pick(
        purpose: 'private-kyc-business_pan',
        kind: 'image',
        maxBytes: 100,
        pick: () => picker.future,
      );
      while (await commands.readExclusive('native-media-selection') == null) {
        await Future<void>.delayed(Duration.zero);
      }
      first.dispose();
      var retrievals = 0;
      final restored = controller(
        lost: () async {
          retrievals++;
          return LostDataResponse(
            file: XFile(file.path),
            files: [XFile(file.path)],
            type: RetrieveType.image,
          );
        },
      );
      await restored.initialize();
      await restored.initialize();
      expect(retrievals, 1);
      expect(restored.canRecover, isTrue);
      await expectLater(
        restored.recover('public-media-image'),
        throwsA(isA<Exception>()),
      );
      scope = (actorId: 'owner-b', storeId: 'site-a', version: 2);
      expect(restored.belongsToCurrentOwner, isFalse);
      expect(restored.purpose, isNull);
      await expectLater(
        restored.recover('private-kyc-business_pan'),
        throwsA(isA<Exception>()),
      );
      await expectLater(restored.discard(), throwsA(isA<Exception>()));
      scope = (actorId: 'owner-a', storeId: 'site-b', version: 3);
      await expectLater(
        restored.recover('private-kyc-business_pan'),
        throwsA(isA<Exception>()),
      );
      scope = (actorId: 'owner-a', storeId: 'site-a', version: 4);
      final recovered = await restored.recover('private-kyc-business_pan');
      expect(recovered.path, isNot(file.path));
      expect(await recovered.readAsBytes(), await file.readAsBytes());
      final key = restored.keyForFile(recovered);
      expect(
        key,
        (await commands.readExclusive('native-media-selection'))!.key,
      );
      picker.complete(null);
      await pending;
      // A retired original Dart callback must not erase the recovered record.
      expect(
        (await commands.readExclusive('native-media-selection'))!.key,
        key,
      );
      await restored.completeKey(key);
      expect(await File(recovered.path).exists(), isFalse);
      expect(await file.exists(), isTrue);
      restored.dispose();
    },
  );

  test(
    'file bytes and original request key survive another restart without a new allocation',
    () async {
      final file = await input();
      final first = controller();
      final selected = (await first.pick(
        purpose: 'public-media-image',
        kind: 'image',
        maxBytes: 100,
        pick: () async => XFile(file.path),
      ))!;
      final key = first.keyForFile(selected);
      final raw = (await commands.readExclusive(
        'native-media-selection',
      ))!.encoded;
      first.dispose();
      final restored = controller();
      await restored.initialize();
      final again = await restored.recover('public-media-image');
      expect(restored.keyForFile(again), key);
      expect(
        (await commands.readExclusive('native-media-selection'))!.encoded,
        raw,
      );
      expect(
        (await commands.readExclusive(
          'native-media-selection',
        ))!.intent['sha256'],
        sha256.convert(await file.readAsBytes()).toString(),
      );
      restored.dispose();
    },
  );

  test(
    'unowned lost results are quarantined; no account may reinterpret them as public media',
    () async {
      final file = await input('private-document.jpg');
      final selection = controller(
        lost: () async =>
            LostDataResponse(file: XFile(file.path), type: RetrieveType.image),
      );
      await selection.initialize();
      expect(selection.unclaimed, isTrue);
      expect(selection.canRecover, isFalse);
      expect(selection.purpose, isNull);
      await expectLater(
        selection.recover('public-media-image'),
        throwsA(isA<Exception>()),
      );
      var picked = false;
      await expectLater(
        selection.pick(
          purpose: 'public-media-image',
          kind: 'image',
          maxBytes: 100,
          pick: () async {
            picked = true;
            return null;
          },
        ),
        throwsA(isA<Exception>()),
      );
      expect(picked, isFalse);
      await selection.discard();
      expect(await file.exists(), isTrue);
      expect(await commands.readExclusive('native-media-selection'), isNull);
      selection.dispose();
    },
  );

  test(
    'iOS never calls Android recovery and retains ordinary explicit file selection',
    () async {
      var retrievals = 0;
      final selection = controller(
        platform: TargetPlatform.iOS,
        lost: () async {
          retrievals++;
          throw UnimplementedError();
        },
      );
      final file = await input('clip.mov');
      final selected = await selection.pick(
        purpose: 'public-media-video',
        kind: 'video',
        maxBytes: 100,
        pick: () async => XFile(file.path),
      );
      expect(selected, isNotNull);
      expect(retrievals, 0);
      selection.dispose();
    },
  );

  test(
    'oversized input and modified private copy cannot be recovered or uploaded',
    () async {
      final file = await input();
      final selection = controller();
      await expectLater(
        selection.pick(
          purpose: 'public-media-image',
          kind: 'image',
          maxBytes: 4,
          pick: () async => XFile(file.path),
        ),
        throwsA(isA<Exception>()),
      );
      expect(selection.canRecover, isFalse);
      await selection.discard();
      final selected = (await selection.pick(
        purpose: 'public-media-image',
        kind: 'image',
        maxBytes: 100,
        pick: () async => XFile(file.path),
      ))!;
      await File(selected.path).writeAsBytes([8, 9]);
      await expectLater(
        selection.recover('public-media-image'),
        throwsA(isA<Exception>()),
      );
      selection.dispose();
    },
  );

  test(
    'late completion after account switch is retained for its original owner, never delivered',
    () async {
      final file = await input();
      final selection = controller();
      final selected = await selection.pick(
        purpose: 'public-media-image',
        kind: 'image',
        maxBytes: 100,
        pick: () async {
          scope = (actorId: 'owner-b', storeId: 'site-b', version: 2);
          return XFile(file.path);
        },
      );
      expect(selected, isNull);
      expect(selection.canRecover, isFalse);
      scope = (actorId: 'owner-a', storeId: 'site-a', version: 3);
      expect(selection.canRecover, isTrue);
      expect(
        await (await selection.recover('public-media-image')).readAsBytes(),
        await file.readAsBytes(),
      );
      selection.dispose();
    },
  );

  test(
    'private upload details freeze on first submission and restore the original reference',
    () async {
      final file = await input();
      final selection = controller();
      final picked = (await selection.pick(
        purpose: 'private-kyc-business_pan',
        kind: 'image',
        maxBytes: 100,
        draft: {'document_type': 'business_pan', 'reference': ''},
        pick: () async => XFile(file.path),
      ))!;
      await selection.bindInput(picked, {
        'document_type': 'business_pan',
        'reference': '1234',
      });
      await expectLater(
        selection.bindInput(picked, {
          'document_type': 'business_pan',
          'reference': '9999',
        }),
        throwsA(isA<Exception>()),
      );
      expect(selection.draftForFile(picked)['reference'], '1234');
      selection.dispose();
    },
  );

  test(
    'permission denial is cancellable; concurrent picker and in-flight upload cannot overwrite intent',
    () async {
      final selection = controller();
      await expectLater(
        selection.pick(
          purpose: 'public-media-image',
          kind: 'image',
          maxBytes: 100,
          pick: () async => throw PlatformException(code: 'camera_denied'),
        ),
        throwsA(isA<PlatformException>()),
      );
      expect(selection.hasSelection, isFalse);
      final file = await input();
      final picker = Completer<XFile?>();
      final pending = selection.pick(
        purpose: 'public-media-image',
        kind: 'image',
        maxBytes: 100,
        pick: () => picker.future,
      );
      while (!selection.busy) {
        await Future<void>.delayed(Duration.zero);
      }
      await expectLater(
        selection.pick(
          purpose: 'private-kyc-business_pan',
          kind: 'image',
          maxBytes: 100,
          pick: () async => null,
        ),
        throwsA(isA<Exception>()),
      );
      picker.complete(XFile(file.path));
      final picked = (await pending)!;
      final key = selection.claimUpload(picked);
      await expectLater(selection.discard(), throwsA(isA<Exception>()));
      selection.releaseUpload(key);
      await selection.completeKey(key);
      expect(selection.hasSelection, isFalse);
      selection.dispose();
    },
  );
}
