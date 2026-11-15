import 'dart:async';
import 'dart:convert';
import 'dart:math';

import 'package:flutter/material.dart';
import 'package:video_player/video_player.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'package:webview_flutter_wkwebview/webview_flutter_wkwebview.dart';

// WebKit supplies the iOS WebM decoder; the existing preview continues to own
// controls, route/lifecycle checks and retries. This never creates a player in a list.
bool usesMerchantWebMPreview(String mime, TargetPlatform platform) =>
    platform == TargetPlatform.iOS &&
    mime.split(';').first.trim().toLowerCase() == 'video/webm';

bool merchantWebMNavigationAllowed(
  String url,
  Uri media, {
  required bool documentLoaded,
  required bool isMainFrame,
}) =>
    isMainFrame &&
    !documentLoaded &&
    (url == 'about:blank' || url == '${_mediaUri(media).origin}/');

Uri _mediaUri(Uri uri) {
  if (!['https', 'http'].contains(uri.scheme) ||
      uri.host.isEmpty ||
      uri.userInfo.isNotEmpty ||
      !RegExp(r'^[a-zA-Z0-9.:\[\]-]+$').hasMatch(uri.host)) {
    throw const FormatException('A public HTTP media URL is required.');
  }
  return uri;
}

String merchantWebMDocument(Uri uri, String nonce) {
  _mediaUri(uri);
  if (!RegExp(r'^[a-zA-Z0-9_-]{24,64}$').hasMatch(nonce)) {
    throw const FormatException('Invalid video document nonce.');
  }
  const escape = HtmlEscape(HtmlEscapeMode.attribute);
  final source = escape.convert(uri.toString());
  final origin = escape.convert(uri.origin);
  return '''<!doctype html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; base-uri 'none'; form-action 'none'; frame-src 'none'; media-src $origin; style-src 'nonce-$nonce'; script-src 'nonce-$nonce'">
<style nonce="$nonce">html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#000}video{width:100%;height:100%;object-fit:contain}</style>
</head><body><video id="video" aria-label="Video preview" playsinline webkit-playsinline muted preload="metadata" src="$source"></video>
<script nonce="$nonce">
(()=>{'use strict';const video=document.getElementById('video');
const nonce=${jsonEncode(nonce)};
function emit(){MerchantVideo.postMessage(JSON.stringify({nonce,ready:video.readyState>=1,duration:Number.isFinite(video.duration)?video.duration:0,position:video.currentTime,width:video.videoWidth,height:video.videoHeight,playing:!video.paused,volume:video.muted?0:video.volume,error:!!video.error}));}
for(const event of ['loadedmetadata','canplay','play','pause','timeupdate','seeked','volumechange','error'])video.addEventListener(event,emit);
document.addEventListener('visibilitychange',()=>{if(document.hidden)video.pause();});
window.merchantVideo={play:()=>{video.play().then(emit).catch(error=>{if(error?.name==='AbortError'){emit();return;}MerchantVideo.postMessage(JSON.stringify({nonce,error:true}));});},pause:()=>{video.pause();emit();},seek:seconds=>{video.currentTime=seconds;emit();},volume:level=>{video.muted=level===0;video.volume=level;emit();},loop:enabled=>{video.loop=enabled;emit();},retire:()=>{video.pause();video.removeAttribute('src');video.load();}};
emit();})();</script></body></html>''';
}

/// A small platform port keeps bridge validation and retired-command races
/// testable without replacing native playback in device acceptance.
abstract interface class MerchantWebVideoTransport {
  Future<void> load(
    String document,
    Uri origin, {
    required void Function(String) onMessage,
    required VoidCallback onFailure,
  });
  Future<void> command(String script);
  Widget get view;
  Future<void> close();
}

class _WebKitVideoTransport implements MerchantWebVideoTransport {
  final _controller = WebViewController.fromPlatformCreationParams(
    WebKitWebViewControllerCreationParams(
      allowsInlineMediaPlayback: true,
      mediaTypesRequiringUserAction: const <PlaybackMediaTypes>{},
    ),
  );
  bool _loaded = false;

  @override
  Future<void> load(
    String document,
    Uri origin, {
    required void Function(String) onMessage,
    required VoidCallback onFailure,
  }) async {
    await _controller.setJavaScriptMode(JavaScriptMode.unrestricted);
    await _controller.setBackgroundColor(Colors.black);
    await _controller.setNavigationDelegate(
      NavigationDelegate(
        onNavigationRequest: (request) =>
            merchantWebMNavigationAllowed(
              request.url,
              origin,
              documentLoaded: _loaded,
              isMainFrame: request.isMainFrame,
            )
            ? NavigationDecision.navigate
            : NavigationDecision.prevent,
        onPageFinished: (_) => _loaded = true,
        onWebResourceError: (error) {
          if (error.isForMainFrame == true) onFailure();
        },
      ),
    );
    await _controller.addJavaScriptChannel(
      'MerchantVideo',
      onMessageReceived: (message) => onMessage(message.message),
    );
    await _controller.loadHtmlString(document, baseUrl: '${origin.origin}/');
  }

  @override
  Widget get view => WebViewWidget(controller: _controller);

  @override
  Future<void> command(String script) => _controller.runJavaScript(script);

  @override
  Future<void> close() async {
    try {
      await command('window.merchantVideo?.retire();');
      await _controller.removeJavaScriptChannel('MerchantVideo');
      await _controller.loadHtmlString('<!doctype html><title></title>');
    } catch (_) {
      // The native view may already have been removed with the dialog.
    }
  }
}

class MerchantWebMVideoController extends VideoPlayerController {
  MerchantWebMVideoController(super.uri, {MerchantWebVideoTransport? transport})
    : _uri = _mediaUri(uri),
      _transport = transport,
      super.networkUrl();

  final Uri _uri;
  MerchantWebVideoTransport? _transport;
  final _ready = Completer<void>();
  final String _nonce = base64Url
      .encode(List<int>.generate(24, (_) => Random.secure().nextInt(256)))
      .replaceAll('=', '');
  bool _started = false, _closed = false, _wantsPlaying = false;
  bool? _wantedMuted;

  Widget get view => _transport?.view ?? const SizedBox.shrink();

  @override
  Future<void> initialize() async {
    if (_closed) throw StateError('Video preview was closed.');
    if (_started) {
      await _ready.future;
      if (_closed || value.hasError)
        throw StateError('Video preview is unavailable.');
      return;
    }
    _started = true;
    _transport ??= _WebKitVideoTransport();
    try {
      await _transport!.load(
        merchantWebMDocument(_uri, _nonce),
        _uri,
        onMessage: _message,
        onFailure: _fail,
      );
      await _ready.future.timeout(const Duration(seconds: 20));
      if (_closed || value.hasError)
        throw StateError('Video preview is unavailable.');
    } catch (_) {
      _fail();
      rethrow;
    }
  }

  void _fail() {
    if (_closed) return;
    value = value.copyWith(
      isPlaying: false,
      errorDescription: 'Video preview is unavailable on this device.',
    );
    if (!_ready.isCompleted) {
      _ready.complete();
    }
  }

  void _message(String message) {
    if (_closed || value.hasError || message.length > 2048) return;
    try {
      final data = jsonDecode(message);
      if (data is! Map<String, dynamic> || data['nonce'] != _nonce) return;
      if (data['error'] == true) {
        _fail();
        return;
      }
      if (data['ready'] != true) return;
      double number(String key, double max) {
        final raw = data[key];
        if (raw is! num || !raw.isFinite || raw < 0 || raw > max) {
          throw const FormatException('Invalid media playback state.');
        }
        return raw.toDouble();
      }

      final duration = number('duration', 31536000);
      final position = number('position', duration);
      final width = number('width', 32768), height = number('height', 32768);
      final volume = number('volume', 1);
      if (duration <= 0 ||
          width <= 0 ||
          height <= 0 ||
          data['playing'] is! bool) {
        throw const FormatException('Invalid media metadata.');
      }
      // A queued play/volume event must not undo a later pause or mute request.
      if (!_wantsPlaying && data['playing'] == true) {
        unawaited(_command('pause()'));
      }
      if (_wantedMuted == true && volume != 0) {
        unawaited(_command('volume(0)'));
      }
      value = value.copyWith(
        duration: Duration(milliseconds: (duration * 1000).round()),
        position: Duration(milliseconds: (position * 1000).round()),
        size: Size(width, height),
        isInitialized: true,
        isPlaying: _wantsPlaying && data['playing'] == true,
        volume: _wantedMuted == true ? 0 : volume,
      );
      if (!_ready.isCompleted) _ready.complete();
    } on FormatException {
      // Ignore malformed/foreign bridge messages; no URL or native details leak.
    }
  }

  Future<void> _command(String command) async {
    if (_closed || _transport == null) return;
    try {
      await _transport!.command('window.merchantVideo?.$command;');
    } catch (_) {
      _fail();
    }
  }

  @override
  Future<void> play() async {
    if (_closed) return;
    _wantsPlaying = true;
    await _command('play()');
  }

  @override
  Future<void> pause() async {
    _wantsPlaying = false;
    await _command('pause()');
  }

  @override
  Future<void> seekTo(Duration position) => _command(
    'seek(${(position.inMilliseconds.clamp(0, value.duration.inMilliseconds) / 1000)})',
  );

  @override
  Future<void> setVolume(double volume) async {
    _wantedMuted = volume == 0;
    await _command('volume(${volume.clamp(0, 1)})');
  }

  @override
  Future<void> setLooping(bool looping) => _command('loop($looping)');

  @override
  Future<void> dispose() async {
    if (_closed) return;
    _closed = true;
    _wantsPlaying = false;
    if (_started && !_ready.isCompleted) {
      _ready.complete();
    }
    try {
      await _transport?.close().timeout(const Duration(seconds: 5));
    } catch (_) {
      // Retired native views may be suspended; late bridge events are fenced.
    }
    await super.dispose();
  }
}
