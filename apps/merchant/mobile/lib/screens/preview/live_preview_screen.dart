import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';
import '../../theme/app_theme_colors.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:provider/provider.dart';
import '../../app/store_context.dart';
import '../../services/theme_service.dart';

/// Live preview screen with WebView
class LivePreviewScreen extends StatefulWidget {
  final String storeUrl;
  final String storeName;
  final String? notice;
  final Object? expectedThemeContext;

  const LivePreviewScreen({
    super.key,
    required this.storeUrl,
    required this.storeName,
    this.notice,
    this.expectedThemeContext,
  });

  @override
  State<LivePreviewScreen> createState() => _LivePreviewScreenState();
}

class _LivePreviewScreenState extends State<LivePreviewScreen> {
  WebViewController? _controller;

  Uri? get _previewUri {
    final uri = Uri.tryParse(widget.storeUrl);
    return uri != null &&
            (uri.scheme == 'https' || uri.scheme == 'http') &&
            uri.host.isNotEmpty &&
            uri.userInfo.isEmpty
        ? uri
        : null;
  }

  bool _isLoading = true;
  bool _failed = false;
  bool _retired = false;
  Uri? _documentUri;
  @override
  void initState() {
    super.initState();
    _initController();
  }

  void _initController() {
    final uri = _previewUri;
    if (uri == null) {
      _isLoading = false;
      return;
    }
    _documentUri = uri;
    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setNavigationDelegate(
        NavigationDelegate(
          onPageStarted: (url) {
            _documentUri = Uri.tryParse(url);
            if (mounted && !_retired)
              setState(() {
                _isLoading = true;
                _failed = false;
              });
          },
          onPageFinished: (url) {
            if (mounted && !_retired) setState(() => _isLoading = false);
          },
          onWebResourceError: (error) {
            if (mounted && !_retired && error.isForMainFrame != false) {
              setState(() {
                _isLoading = false;
                _failed = true;
              });
            }
          },
          onHttpError: (error) {
            if (mounted && !_retired && error.request?.uri == _documentUri) {
              setState(() {
                _isLoading = false;
                _failed = true;
              });
            }
          },
          onNavigationRequest: (request) =>
              _retired && request.url != 'about:blank'
              ? NavigationDecision.prevent
              : NavigationDecision.navigate,
        ),
      )
      ..loadRequest(uri);
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    if (widget.expectedThemeContext != null) {
      context.watch<StoreContext>();
      if (context.read<ThemeService>().captureContext() !=
          widget.expectedThemeContext) {
        if (!_retired) {
          _retired = true;
          _controller?.loadRequest(Uri.parse('about:blank'));
        }
        return Scaffold(
          appBar: AppBar(title: const Text('Theme preview')),
          body: const Center(
            child: Padding(
              padding: EdgeInsets.all(24),
              child: Text(
                'The active account or store changed. Close this preview and reopen it from the theme library.',
              ),
            ),
          ),
        );
      }
    }
    return Scaffold(
      backgroundColor: colors.bgStart,
      appBar: AppBar(
        title: Text(widget.storeName),
        backgroundColor: colors.card,
        surfaceTintColor: colors.card,
        foregroundColor: colors.textPrimary,
        actions: [
          // Refresh
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            onPressed: _controller == null ? null : () => _controller!.reload(),
            tooltip: 'Refresh',
          ),
          // Open in browser
          IconButton(
            icon: const Icon(Icons.open_in_browser_rounded),
            onPressed: _previewUri == null ? null : () => _openInBrowser(),
            tooltip: 'Open in browser',
          ),
        ],
      ),
      body: Column(
        children: [
          if (widget.notice != null)
            Material(
              color: Theme.of(context).colorScheme.surface,
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Text(widget.notice!, textAlign: TextAlign.center),
              ),
            ),
          Expanded(
            child: Stack(
              children: [
                Center(
                  child: Container(
                    width: double.infinity,
                    margin: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: colors.card,
                      borderRadius: BorderRadius.circular(16),
                      boxShadow: [
                        BoxShadow(
                          color: Theme.of(
                            context,
                          ).shadowColor.withValues(alpha: 0.1),
                          blurRadius: 20,
                          offset: const Offset(0, 10),
                        ),
                      ],
                    ),
                    clipBehavior: Clip.antiAlias,
                    child: _controller != null
                        ? WebViewWidget(controller: _controller!)
                        : const Center(child: Text('Store URL not available')),
                  ),
                ),
                if (_isLoading)
                  Container(
                    color: colors.card.withValues(alpha: 0.9),
                    child: Center(
                      child: CircularProgressIndicator(
                        valueColor: AlwaysStoppedAnimation(colors.accent),
                      ),
                    ),
                  ),
                if (_failed)
                  Positioned.fill(
                    child: ColoredBox(
                      color: Theme.of(context).colorScheme.surface,
                      child: Center(
                        child: Padding(
                          padding: const EdgeInsets.all(24),
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const Text(
                                'This preview could not load. Your published store has not changed.',
                                textAlign: TextAlign.center,
                              ),
                              const SizedBox(height: 16),
                              OutlinedButton(
                                onPressed: () =>
                                    _controller?.loadRequest(_previewUri!),
                                child: const Text('Retry preview'),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _openInBrowser() async {
    final uri = _previewUri;
    if (uri == null) return;
    try {
      if (await canLaunchUrl(uri) &&
          await launchUrl(uri, mode: LaunchMode.externalApplication))
        return;
    } catch (_) {
      /* Show the same actionable unavailable state below. */
    }
    if (mounted)
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'The preview could not open in your browser. Retry from this screen.',
          ),
        ),
      );
  }
}
