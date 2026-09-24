import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:webview_flutter/webview_flutter.dart';

import '../../services/app_marketplace_service.dart';
import '../../theme/app_theme_colors.dart';
import '../../widgets/shared/capability_gate.dart';

class AppBridgeRuntimeScreen extends StatefulWidget {
  const AppBridgeRuntimeScreen({super.key, required this.session});

  final AppBridgeRuntimeSessionContract session;

  @override
  State<AppBridgeRuntimeScreen> createState() => _AppBridgeRuntimeScreenState();
}

class _AppBridgeRuntimeScreenState extends State<AppBridgeRuntimeScreen> {
  late final WebViewController _controller;
  bool _isLoading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setNavigationDelegate(
        NavigationDelegate(
          onPageStarted: (_) {
            if (mounted) {
              setState(() {
                _isLoading = true;
                _error = null;
              });
            }
          },
          onPageFinished: (_) async {
            await _injectBridge();
            if (mounted) setState(() => _isLoading = false);
          },
          onWebResourceError: (_) {
            if (mounted) {
              setState(() {
                _isLoading = false;
                _error = 'This app could not load inside the mobile host.';
              });
            }
          },
          onNavigationRequest: (request) {
            if (widget.session.host.allowsUrl(request.url)) {
              return NavigationDecision.navigate;
            }
            unawaited(_openExternalUrl(request.url));
            return NavigationDecision.prevent;
          },
        ),
      )
      ..addJavaScriptChannel(
        widget.session.host.messageChannel,
        onMessageReceived: _handleBridgeMessage,
      );

    final uri = widget.session.initialUri;
    if (uri == null) {
      _error = 'This app does not expose a mobile-safe URL.';
      _isLoading = false;
      return;
    }
    unawaited(_controller.loadRequest(uri));
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    return Scaffold(
      backgroundColor: colors.bgStart,
      appBar: AppBar(
        backgroundColor: colors.card,
        foregroundColor: colors.textPrimary,
        title: Text(widget.session.title),
        actions: [
          IconButton(
            tooltip: 'Open externally',
            icon: const Icon(Icons.open_in_new_rounded),
            onPressed: () => _openExternalUrl(widget.session.initialUrl),
          ),
        ],
      ),
      body: Stack(
        children: [
          WebViewWidget(controller: _controller),
          if (_isLoading)
            LinearProgressIndicator(color: colors.accent, minHeight: 3),
          if (_error != null)
            CapabilityGate(
              availability: FeatureAvailability.temporarilyUnavailable,
              title: 'App unavailable',
              description: _error,
              icon: Icons.extension_off_outlined,
              primaryActionLabel: 'Open externally',
              onPrimaryAction: () =>
                  _openExternalUrl(widget.session.installation.app.appUrl),
            ),
        ],
      ),
    );
  }

  Future<void> _injectBridge() async {
    final contextJson = jsonEncode({
      'version': '2026-06-01',
      'hostVersion': widget.session.host.hostVersion,
      'storeId': widget.session.storeId,
      'installationId': widget.session.installationId,
      'appId': widget.session.appId,
      'apiBaseUrl': widget.session.apiBaseUrl,
      'expiresAt': widget.session.expiresAt,
      'scopes': widget.session.scopes,
      'capabilities': widget.session.capabilities,
      'tokenTransport': widget.session.host.tokenTransport,
    });
    final namespace = jsonEncode(widget.session.host.jsNamespace);
    final channel = jsonEncode(widget.session.host.messageChannel);
    final script =
        '''
(function () {
  const namespace = $namespace;
  const context = $contextJson;
  const callbacks = window.__letbuyyAppBridgeCallbacks || {};
  window.__letbuyyAppBridgeCallbacks = callbacks;
  window.__letbuyyAppBridgeResolve = function (id, payload) {
    if (!callbacks[id]) return;
    callbacks[id].resolve(payload);
    delete callbacks[id];
  };
  window.__letbuyyAppBridgeReject = function (id, message) {
    if (!callbacks[id]) return;
    callbacks[id].reject(new Error(message || 'Bridge request failed'));
    delete callbacks[id];
  };
  const nativeChannel = window[$channel];
  const bridge = {
    version: context.version,
    context: context,
    getSession: function () {
      return Promise.resolve(context);
    },
    fetch: function (path) {
      const requestId = 'lb_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2);
      return new Promise(function (resolve, reject) {
        callbacks[requestId] = { resolve: resolve, reject: reject };
        nativeChannel.postMessage(JSON.stringify({
          type: 'api.fetch',
          id: requestId,
          method: 'GET',
          path: path
        }));
      });
    },
    toast: function (message) {
      nativeChannel.postMessage(JSON.stringify({ type: 'toast', message: String(message || '') }));
    },
    redirect: function (url) {
      nativeChannel.postMessage(JSON.stringify({ type: 'navigation.redirect', url: String(url || '') }));
    }
  };
  window[namespace] = bridge;
  window.LetBuyy = window.LetBuyy || {};
  window.LetBuyy.appBridge = bridge;
  window.dispatchEvent(new CustomEvent('letbuyy:app-bridge-ready', { detail: context }));
})();''';
    await _controller.runJavaScript(script);
  }

  Future<void> _handleBridgeMessage(JavaScriptMessage message) async {
    final Object? decoded;
    try {
      decoded = jsonDecode(message.message);
    } catch (_) {
      return;
    }
    if (decoded is! Map) return;
    final type = decoded['type']?.toString();
    switch (type) {
      case 'toast':
        _showSnack(_safeCopy(decoded['message']?.toString(), 'Done.'));
        return;
      case 'navigation.redirect':
        final url = decoded['url']?.toString() ?? '';
        await _openExternalUrl(url);
        return;
      case 'api.fetch':
        if (!widget.session.capabilities.contains('api.fetch')) return;
        await _handleBridgeFetch(decoded);
        return;
      default:
        return;
    }
  }

  Future<void> _handleBridgeFetch(Map<dynamic, dynamic> message) async {
    final id = message['id']?.toString();
    final path = message['path']?.toString();
    if (id == null || id.isEmpty || path == null || path.isEmpty) return;
    try {
      final result = await context
          .read<AppMarketplaceService>()
          .fetchEmbeddedBridgeData(session: widget.session, path: path);
      await _completeBridgeRequest(id, result);
    } catch (_) {
      await _rejectBridgeRequest(id, 'Bridge request failed');
    }
  }

  Future<void> _completeBridgeRequest(String id, Map<String, dynamic> payload) {
    return _controller.runJavaScript(
      'window.__letbuyyAppBridgeResolve && '
      'window.__letbuyyAppBridgeResolve(${jsonEncode(id)}, ${jsonEncode(payload)});',
    );
  }

  Future<void> _rejectBridgeRequest(String id, String message) {
    return _controller.runJavaScript(
      'window.__letbuyyAppBridgeReject && '
      'window.__letbuyyAppBridgeReject(${jsonEncode(id)}, ${jsonEncode(message)});',
    );
  }

  Future<void> _openExternalUrl(String url) async {
    final uri = Uri.tryParse(url);
    if (uri == null || !uri.hasScheme) {
      _showSnack('App link is unavailable.');
      return;
    }
    final opened = await launchUrl(uri, mode: LaunchMode.externalApplication);
    if (!opened) _showSnack('App link could not be opened.');
  }

  void _showSnack(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(_safeCopy(message, 'Action could not complete.'))),
    );
  }

  String _safeCopy(String? value, String fallback) {
    final text = value?.trim();
    if (text == null || text.isEmpty) return fallback;
    final internal = RegExp(
      r'(SKIP_NEEDS_HUMAN|SKIP-NEEDS-BACKEND|S-0\d{2}|needs backend|backend contract|PlatformBlocked)',
      caseSensitive: false,
    );
    return internal.hasMatch(text) ? fallback : text;
  }
}
