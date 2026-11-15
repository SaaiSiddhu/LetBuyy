import 'dart:async';
import 'package:flutter/services.dart';

abstract interface class AuthenticationBrowser {
  Stream<String?> get callbacks;
  Future<String?> initialCallback();
  Future<void> open(Uri url, String callbackScheme);
  Future<void> close();
}

/// OS-owned browser only. Never a credential WebView or JavaScript bridge.
class PlatformAuthenticationBrowser implements AuthenticationBrowser {
  PlatformAuthenticationBrowser({MethodChannel? channel})
    : _channel = channel ?? const MethodChannel('com.letbuyy.store/accounts') {
    _channel.setMethodCallHandler((call) async {
      if (call.method == 'callback' && call.arguments is String) {
        _callbacks.add(call.arguments as String);
      } else if (call.method == 'cancelled') {
        _callbacks.add(null);
      }
    });
  }
  final MethodChannel _channel;
  final _callbacks = StreamController<String?>.broadcast();
  @override
  Stream<String?> get callbacks => _callbacks.stream;
  @override
  Future<String?> initialCallback() =>
      _channel.invokeMethod<String>('takeInitialCallback');
  @override
  Future<void> open(Uri url, String callbackScheme) =>
      _channel.invokeMethod<void>('open', {
        'url': url.toString(),
        'callbackScheme': callbackScheme,
      });
  @override
  Future<void> close() => _channel.invokeMethod<void>('close');
}
