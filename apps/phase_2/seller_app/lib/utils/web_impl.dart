// ignore: avoid_web_libraries_in_flutter
import 'dart:html' as html;

/// Update browser URL without navigation (web only)
void updateBrowserUrl(String newUrl) {
  html.window.history.replaceState(null, '', newUrl);
}
