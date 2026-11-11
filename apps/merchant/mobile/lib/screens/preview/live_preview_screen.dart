import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
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
            uri.host.isNotEmpty
        ? uri
        : null;
  }

  bool _isLoading = true;
  bool _failed = false;
  bool _retired = false;
  Uri? _documentUri;
  String _currentDevice = 'mobile';

  final Map<String, double> _deviceWidths = {
    'mobile': 375,
    'tablet': 768,
    'desktop': 1200,
  };

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
      backgroundColor: Colors.grey[200],
      appBar: AppBar(
        title: Text(widget.storeName),
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.white,
        actions: [
          // Device switcher
          PopupMenuButton<String>(
            icon: Icon(_getDeviceIcon()),
            tooltip: 'Switch device',
            onSelected: (device) {
              setState(() => _currentDevice = device);
            },
            itemBuilder: (context) => [
              _buildDeviceMenuItem(
                'mobile',
                Icons.phone_iphone_rounded,
                'Mobile',
              ),
              _buildDeviceMenuItem(
                'tablet',
                Icons.tablet_mac_rounded,
                'Tablet',
              ),
              _buildDeviceMenuItem(
                'desktop',
                Icons.computer_rounded,
                'Desktop',
              ),
            ],
          ),
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
                    width: _deviceWidths[_currentDevice],
                    margin: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(16),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.1),
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
                    color: Colors.white.withValues(alpha: 0.8),
                    child: Center(
                      child: CircularProgressIndicator(
                        valueColor: AlwaysStoppedAnimation(AppColors.primary),
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

  IconData _getDeviceIcon() {
    switch (_currentDevice) {
      case 'tablet':
        return Icons.tablet_mac_rounded;
      case 'desktop':
        return Icons.computer_rounded;
      default:
        return Icons.phone_iphone_rounded;
    }
  }

  PopupMenuItem<String> _buildDeviceMenuItem(
    String value,
    IconData icon,
    String label,
  ) {
    return PopupMenuItem(
      value: value,
      child: Row(
        children: [
          Icon(
            icon,
            size: 20,
            color: _currentDevice == value ? AppColors.primary : null,
          ),
          const SizedBox(width: 12),
          Text(
            label,
            style: TextStyle(
              fontWeight: _currentDevice == value ? FontWeight.w600 : null,
              color: _currentDevice == value ? AppColors.primary : null,
            ),
          ),
          if (_currentDevice == value) ...[
            const Spacer(),
            Icon(Icons.check_rounded, size: 18, color: AppColors.primary),
          ],
        ],
      ),
    );
  }

  Future<void> _openInBrowser() async {
    final uri = _previewUri;
    if (uri != null && await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }
}
