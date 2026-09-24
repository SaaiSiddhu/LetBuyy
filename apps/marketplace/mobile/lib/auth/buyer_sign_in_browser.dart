// APPID-P4d — opens identity-platform in the system browser and brings its callback back to the app.
//
// Never a WebView (RFC 8252 §8.12): the buyer types their password into identity-platform's own page
// in a browser the app cannot read.
//
// Android: the app's own Custom Tab bridge (MainActivity.kt, BuyerSignInBridge.kt and
// BuyerSignInCallbackActivity.kt). A dedicated callback activity is what lets the browser's redirect
// come back to THIS running app and close the tab, instead of starting a second copy of the app on
// top of it, and without Flutter's own deep-link routing seeing the callback.
//
// iOS: SFSafariViewController through url_launcher, with the callback arriving as an app link. Not
// built or run in APPID-P4d: the build machine has no CocoaPods. See the phase evidence.

import 'dart:async';

import 'package:app_links/app_links.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:letbuyy_api_client/letbuyy_api_client.dart';
import 'package:url_launcher/url_launcher.dart';

abstract interface class BuyerSignInBrowser {
  /// Opens [url] and completes with the callback address, or null when the buyer came back to the
  /// app without one (closed the browser, or it was abandoned).
  Future<Uri?> authorize(Uri url);

  /// A callback that arrived while nothing was waiting for it: the app had been stopped while the
  /// browser was open. Returned once.
  Future<Uri?> takeLaunchCallback();

  /// The app is in the foreground again. A sign-in still waiting was abandoned; end it.
  Future<void> cancelWaiting();
}

BuyerSignInBrowser platformBuyerSignInBrowser() =>
    defaultTargetPlatform == TargetPlatform.iOS ? SafariBuyerSignInBrowser() : CustomTabBuyerSignInBrowser();

class CustomTabBuyerSignInBrowser implements BuyerSignInBrowser {
  static const MethodChannel _channel = MethodChannel('com.letbuyy.letbuyy/buyer_sign_in');

  @override
  Future<Uri?> authorize(Uri url) async {
    final callback = await _channel.invokeMethod<String>('authorize', {'url': url.toString()});
    return callback == null ? null : Uri.tryParse(callback);
  }

  @override
  Future<Uri?> takeLaunchCallback() async {
    final callback = await _channel.invokeMethod<String>('takeLaunchCallback');
    return callback == null ? null : Uri.tryParse(callback);
  }

  @override
  Future<void> cancelWaiting() => _channel.invokeMethod<void>('cancelWaiting');
}

class SafariBuyerSignInBrowser implements BuyerSignInBrowser {
  SafariBuyerSignInBrowser({AppLinks? links}) : _links = links ?? AppLinks();

  final AppLinks _links;
  Completer<Uri?>? _waiting;
  StreamSubscription<Uri>? _subscription;
  Uri? _launchCallback;
  bool _initialLinkRead = false;

  bool _isCallback(Uri uri) => uri.scheme == letbuyyMarketplaceAppCallbackScheme;

  void _listen() {
    _subscription ??= _links.uriLinkStream.listen((uri) {
      // The app's other links (letbuyy://, https://letbuyy.com) are not this feature's.
      if (!_isCallback(uri)) return;
      final waiting = _waiting;
      if (waiting == null) {
        _launchCallback = uri;
        return;
      }
      _waiting = null;
      unawaited(closeInAppWebView().catchError((Object _) {}));
      waiting.complete(uri);
    });
  }

  void _finish(Uri? value) {
    final waiting = _waiting;
    _waiting = null;
    if (waiting != null && !waiting.isCompleted) waiting.complete(value);
  }

  @override
  Future<Uri?> authorize(Uri url) async {
    _listen();
    _finish(null);
    final waiting = _waiting = Completer<Uri?>();
    final opened = await launchUrl(url, mode: LaunchMode.inAppBrowserView);
    if (!opened) {
      _finish(null);
      throw PlatformException(code: 'NO_BROWSER', message: 'No browser could open the sign-in page.');
    }
    return waiting.future;
  }

  @override
  Future<Uri?> takeLaunchCallback() async {
    _listen();
    if (!_initialLinkRead) {
      _initialLinkRead = true;
      final initial = await _links.getInitialLink();
      if (initial != null && _isCallback(initial)) return initial;
    }
    final kept = _launchCallback;
    _launchCallback = null;
    return kept;
  }

  @override
  Future<void> cancelWaiting() async {
    // SFSafariViewController is inside the app, so coming back to the foreground does not mean the
    // buyer left it. A waiting sign-in is ended by the buyer's Cancel, or replaced by a new one.
  }
}
