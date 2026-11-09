import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_store/widgets/shared/merchant_webm_video_controller.dart';

class WebVideoTransport implements MerchantWebVideoTransport {
  late String document, nonce;
  late void Function(String) message;
  final commands = <String>[];
  bool closed = false;
  @override
  Widget get view => const SizedBox();
  @override
  Future<void> load(
    String document,
    Uri origin, {
    required void Function(String) onMessage,
    required VoidCallback onFailure,
  }) async {
    this.document = document;
    nonce = RegExp(r'<script nonce="([^"]+)"').firstMatch(document)!.group(1)!;
    message = onMessage;
  }

  void send([Map<String, Object?> changes = const {}]) => message(
    jsonEncode({
      'nonce': nonce,
      'ready': true,
      'duration': 3,
      'position': 0,
      'width': 64,
      'height': 64,
      'playing': false,
      'volume': 0,
      'error': false,
      ...changes,
    }),
  );
  @override
  Future<void> command(String script) async => commands.add(script);
  @override
  Future<void> close() async => closed = true;
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  final uri = Uri.parse(
    'https://cdn.example.test/assets/public-media/video.webm',
  );

  test('only iOS WebM selects WebKit; native MOV and Android stay native', () {
    expect(usesMerchantWebMPreview('video/webm', TargetPlatform.iOS), isTrue);
    expect(
      usesMerchantWebMPreview('VIDEO/WEBM; codecs=vp8', TargetPlatform.iOS),
      isTrue,
    );
    for (final mime in [
      'video/quicktime',
      'video/mp4',
      'application/octet-stream',
    ]) {
      expect(usesMerchantWebMPreview(mime, TargetPlatform.iOS), isFalse);
    }
    expect(
      usesMerchantWebMPreview('video/webm', TargetPlatform.android),
      isFalse,
    );
  });

  test(
    'document confines scripts/media and escapes hostile URL attributes',
    () {
      final document = merchantWebMDocument(
        Uri.parse(
          'https://cdn.example.test/a.webm?name="><script>bad()</script>&a=b',
        ),
        'synthetic_video_document_nonce_1',
      );
      expect(document, contains("default-src 'none'"));
      expect(document, contains('media-src https://cdn.example.test;'));
      expect(document, contains("frame-src 'none'"));
      expect(
        document,
        contains("script-src 'nonce-synthetic_video_document_nonce_1'"),
      );
      expect(document, contains('&amp;a=b'));
      expect(document, isNot(contains('<script>bad()')));
      expect(document, isNot(contains('autoplay')));
      expect(document, contains('document.hidden)video.pause()'));
      expect(RegExp('<script ').allMatches(document).length, 1);
    },
  );

  for (final value in [
    'javascript:alert(1)',
    'file:///private/document.webm',
    'data:video/webm;base64,AA',
    'https://owner:secret@cdn.example.test/video.webm',
  ]) {
    test('rejects unsafe media origin $value before platform creation', () {
      expect(
        () => MerchantWebMVideoController(Uri.parse(value)),
        throwsFormatException,
      );
    });
  }

  test(
    'navigation admits only initial owned document and no nested/external pages',
    () {
      for (final initial in ['about:blank', 'https://cdn.example.test/']) {
        expect(
          merchantWebMNavigationAllowed(
            initial,
            uri,
            documentLoaded: false,
            isMainFrame: true,
          ),
          isTrue,
        );
        expect(
          merchantWebMNavigationAllowed(
            initial,
            uri,
            documentLoaded: true,
            isMainFrame: true,
          ),
          isFalse,
        );
        expect(
          merchantWebMNavigationAllowed(
            initial,
            uri,
            documentLoaded: false,
            isMainFrame: false,
          ),
          isFalse,
        );
      }
      for (final other in [
        'https://elsewhere.example/',
        'https://cdn.example.test/login',
        'javascript:alert(1)',
        'file:///tmp/a',
      ]) {
        expect(
          merchantWebMNavigationAllowed(
            other,
            uri,
            documentLoaded: false,
            isMainFrame: true,
          ),
          isFalse,
        );
      }
    },
  );

  test(
    'metadata, play, seek and mute use actual nonce-bound bridge readback',
    () async {
      final transport = WebVideoTransport();
      final controller = MerchantWebMVideoController(uri, transport: transport);
      final initialized = controller.initialize();
      transport.message('not JSON');
      transport.send({'nonce': 'foreign', 'playing': true});
      transport.send({'duration': -1});
      transport.send({'volume': 5});
      expect(controller.value.isInitialized, isFalse);
      transport.send();
      await initialized;
      expect(controller.value.duration, const Duration(seconds: 3));
      expect(controller.value.size, const Size(64, 64));
      expect(controller.value.isPlaying, isFalse);
      expect(controller.httpHeaders, isEmpty);
      await controller.play();
      transport.send({'playing': true, 'position': 1.2});
      expect(controller.value.isPlaying, isTrue);
      expect(controller.value.position, const Duration(milliseconds: 1200));
      await controller.seekTo(const Duration(seconds: 10));
      expect(transport.commands.last, contains('seek(3.0)'));
      await controller.setVolume(1);
      transport.send({'playing': true, 'volume': 1});
      expect(controller.value.volume, 1);
      await controller.setVolume(0);
      transport.send({'playing': true, 'volume': 1});
      expect(controller.value.volume, 0);
      expect(transport.commands.last, contains('volume(0)'));
      await controller.dispose();
    },
  );

  test(
    'late play cannot undo pause and disposed bridge cannot change state',
    () async {
      final transport = WebVideoTransport();
      final controller = MerchantWebMVideoController(uri, transport: transport);
      final initialized = controller.initialize();
      transport.send();
      await initialized;
      await controller.play();
      await controller.pause();
      transport.send({'playing': true, 'position': 1});
      expect(controller.value.isPlaying, isFalse);
      expect(transport.commands.last, contains('pause()'));
      final state = controller.value;
      await controller.dispose();
      transport.send({'playing': true, 'position': 2});
      await controller.play();
      expect(controller.value, same(state));
      expect(transport.closed, isTrue);
    },
  );

  test(
    'decoder error is sanitized and cannot later become a success',
    () async {
      final transport = WebVideoTransport();
      final controller = MerchantWebMVideoController(uri, transport: transport);
      final initialized = expectLater(
        controller.initialize(),
        throwsStateError,
      );
      transport.send({'error': true, 'message': 'Private native details'});
      await initialized;
      expect(controller.value.errorDescription, isNot(contains('Private')));
      transport.send();
      expect(controller.value.isInitialized, isFalse);
      await controller.dispose();
    },
  );

  test(
    'closing during initialization releases wait without an unhandled error',
    () async {
      final transport = WebVideoTransport();
      final controller = MerchantWebMVideoController(uri, transport: transport);
      final initialized = expectLater(
        controller.initialize(),
        throwsStateError,
      );
      await controller.dispose();
      await initialized;
      transport.send();
      expect(controller.value.isInitialized, isFalse);
      await expectLater(controller.initialize(), throwsStateError);
    },
  );
}
