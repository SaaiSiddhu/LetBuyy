// lib/services/deep_link_service_web.dart
// Web-specific implementation using dart:html

// ignore: avoid_web_libraries_in_flutter
import 'dart:html' as html;

/// Get initial URL from browser location (web only)
String? getInitialUrl() {
  try {
    return html.window.location.href;
  } catch (e) {
    return null;
  }
}
