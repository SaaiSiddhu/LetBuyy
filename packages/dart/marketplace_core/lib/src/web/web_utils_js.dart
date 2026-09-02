// packages/core/lib/src/web/web_utils_js.dart
// Web-specific implementation using JS interop

import 'dart:js_interop';
import 'dart:js_interop_unsafe';

/// Dispatch a resize event to force Flutter to recalculate layout
void dispatchResizeEvent() {
  try {
    // Use globalContext to safely access window and create/dispatch event
    final window = globalContext;
    final event = window.callMethod('eval'.toJS, "new Event('resize')".toJS);
    window.callMethod('dispatchEvent'.toJS, event);
  } catch (_) {
    // Ignore errors - this is a best-effort fix
  }
}
