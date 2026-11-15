import 'dart:convert';
import '../../config/app_config.dart';

/// Ephemeral presentation state. Only the existing server can verify a proof.
/// It is never persisted and supplies no identity, session or permission.
class MerchantTurnstileAttempt {
  int _generation = 0;
  String? _token;
  bool ready = false, error = false, expired = false;
  String? get token => _token;
  bool current(int generation) => generation == _generation;
  int begin() {
    _generation++;
    _token = null;
    ready = false;
    error = false;
    expired = false;
    return _generation;
  }

  void pageReady(int generation) {
    if (current(generation)) ready = true;
  }

  void succeed(int generation, String value) {
    if (!current(generation)) return;
    if (value.trim().isEmpty) {
      fail(generation);
      return;
    }
    _token = value.trim();
    ready = true;
    error = false;
    expired = false;
  }

  void fail(int generation) {
    if (current(generation)) {
      _token = null;
      ready = true;
      error = true;
      expired = false;
    }
  }

  void expire(int generation) {
    if (current(generation)) {
      _token = null;
      ready = true;
      error = false;
      expired = true;
    }
  }

  bool resourceFailure(int generation, {required bool? isForMainFrame}) {
    // Turnstile uses subframe/network probes which may intentionally fail.
    // Actual widget failures still arrive through its error callback.
    if (!current(generation) || isForMainFrame == false) return false;
    fail(generation);
    return true;
  }

  String? takeToken() {
    final value = error || expired ? null : _token;
    if (value != null) invalidate();
    return value;
  }

  void invalidate() {
    _generation++;
    _token = null;
    ready = false;
    error = false;
    expired = true;
  }
}

/// Shared document for the two existing Merchant verification surfaces.
String merchantTurnstileDocument(
  String siteKey, {
  required bool isDark,
  bool centered = false,
}) {
  final key = jsonEncode(
    siteKey,
  ).replaceAll('<', r'\u003c').replaceAll('>', r'\u003e');
  return '''<!doctype html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>html,body{margin:0;padding:0;background:transparent;min-height:100%;display:flex;align-items:center;justify-content:${centered ? 'center' : 'flex-start'};}#ts{display:inline-block;min-height:70px;}</style>
<script src="${const HtmlEscape(HtmlEscapeMode.attribute).convert(AppConfig.challengeScriptUrl)}" onerror="TurnstileError.postMessage('script-load')"></script>
</head><body><div id="ts"></div><script>
function renderMerchantVerification(){
 if(!window.turnstile){TurnstileError.postMessage('script-unavailable');return;}
 window.turnstile.render('#ts',{sitekey:$key,theme:'${isDark ? 'dark' : 'light'}',size:'normal',
  callback:function(value){TurnstileToken.postMessage(value);},
  'error-callback':function(){TurnstileError.postMessage('challenge-failed');return true;},
  'expired-callback':function(){TurnstileExpired.postMessage('expired');}});
}
renderMerchantVerification();
</script></body></html>''';
}
