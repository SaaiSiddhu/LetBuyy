import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:url_launcher/url_launcher.dart';

/// Live preview screen with WebView
class LivePreviewScreen extends StatefulWidget {
  final String storeUrl;
  final String storeName;

  const LivePreviewScreen({
    super.key,
    required this.storeUrl,
    required this.storeName,
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
    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setNavigationDelegate(
        NavigationDelegate(
          onPageStarted: (url) {
            if (mounted) setState(() => _isLoading = true);
          },
          onPageFinished: (url) {
            if (mounted) setState(() => _isLoading = false);
          },
          onWebResourceError: (error) {
            if (mounted) setState(() => _isLoading = false);
          },
        ),
      )
      ..loadRequest(uri);
  }

  @override
  Widget build(BuildContext context) {
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
      body: Stack(
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
