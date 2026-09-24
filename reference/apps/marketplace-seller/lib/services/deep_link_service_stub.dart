// lib/services/deep_link_service_stub.dart
// Stub implementation for non-web platforms

/// Get initial URL - stub for non-web platforms
String? getInitialUrl() {
  // On mobile, deep links are handled via platform channels
  // This stub returns null, mobile uses app_links package instead
  return null;
}
