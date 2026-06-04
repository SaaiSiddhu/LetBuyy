import 'package:flutter/material.dart';
import 'package:letbuyy_models/letbuyy_models.dart';
import 'package:webview_flutter/webview_flutter.dart';

import '../../models/store_model.dart';

/// Storefront-backed preview of the active theme draft.
class WebsitePreview extends StatelessWidget {
  final StoreModel? store;
  final List<SectionModel> sections;
  final String? previewUrl;
  final String? selectedSectionId;
  final ValueChanged<SectionModel>? onSectionTap;
  final ValueChanged<SectionModel>? onSectionUpdate;
  final void Function(SectionModel section, int direction)? onMoveSection;
  final VoidCallback? onAddSection;
  final double zoomLevel;
  final String deviceMode;

  const WebsitePreview({
    super.key,
    this.store,
    required this.sections,
    this.previewUrl,
    this.selectedSectionId,
    this.onSectionTap,
    this.onSectionUpdate,
    this.onMoveSection,
    this.onAddSection,
    this.zoomLevel = 1.0,
    this.deviceMode = 'phone',
  });

  @override
  Widget build(BuildContext context) {
    final selectedSection = _selectedSection;

    return Container(
      decoration: const BoxDecoration(color: Colors.white),
      clipBehavior: Clip.antiAlias,
      child: Stack(
        children: [
          if (previewUrl != null && previewUrl!.isNotEmpty)
            _StorefrontPreviewWebView(
              url: previewUrl!,
              zoomLevel: zoomLevel,
              deviceMode: deviceMode,
            )
          else
            _PreviewUnavailable(store: store),
          if (selectedSection != null)
            Positioned(
              left: 8,
              right: 8,
              top: 8,
              child: _SelectedSectionOverlay(
                section: selectedSection,
                onTap: () => onSectionTap?.call(selectedSection),
                onMoveUp: selectedSection.type == SectionType.header
                    ? null
                    : () => onMoveSection?.call(selectedSection, -1),
                onMoveDown: selectedSection.type == SectionType.footer
                    ? null
                    : () => onMoveSection?.call(selectedSection, 1),
              ),
            ),
          if (onAddSection != null)
            Positioned(
              right: 12,
              bottom: 12,
              child: FloatingActionButton.small(
                onPressed: onAddSection,
                backgroundColor: const Color(0xFF8B5CF6),
                foregroundColor: Colors.white,
                child: const Icon(Icons.add_rounded),
              ),
            ),
        ],
      ),
    );
  }

  SectionModel? get _selectedSection {
    if (selectedSectionId == null) return null;
    for (final section in sections) {
      if (section.id == selectedSectionId) return section;
    }
    return null;
  }
}

class _StorefrontPreviewWebView extends StatefulWidget {
  final String url;
  final double zoomLevel;
  final String deviceMode;

  const _StorefrontPreviewWebView({
    required this.url,
    required this.zoomLevel,
    required this.deviceMode,
  });

  @override
  State<_StorefrontPreviewWebView> createState() =>
      _StorefrontPreviewWebViewState();
}

class _StorefrontPreviewWebViewState extends State<_StorefrontPreviewWebView> {
  late final WebViewController _controller;
  bool _isLoading = true;
  Object? _error;

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
            await _applyZoom();
            if (mounted) setState(() => _isLoading = false);
          },
          onWebResourceError: (error) {
            if (mounted) {
              setState(() {
                _isLoading = false;
                _error = error.description;
              });
            }
          },
        ),
      )
      ..loadRequest(Uri.parse(widget.url));
  }

  @override
  void didUpdateWidget(covariant _StorefrontPreviewWebView oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.url != widget.url) {
      _controller.loadRequest(Uri.parse(widget.url));
    } else if (oldWidget.zoomLevel != widget.zoomLevel) {
      _applyZoom();
    }
  }

  Future<void> _applyZoom() async {
    final scale = (widget.zoomLevel / 0.7).clamp(0.5, 1.5).toStringAsFixed(2);
    await _controller.runJavaScript('''
      document.documentElement.style.zoom = '$scale';
      document.body.dataset.letbuyyFlutterViewport = '${widget.deviceMode}';
    ''');
  }

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        WebViewWidget(controller: _controller),
        if (_error != null) _PreviewError(message: _error.toString()),
        if (_isLoading)
          Container(
            color: Colors.white.withValues(alpha: 0.82),
            child: const Center(
              child: CircularProgressIndicator(strokeWidth: 2),
            ),
          ),
      ],
    );
  }
}

class _SelectedSectionOverlay extends StatelessWidget {
  final SectionModel section;
  final VoidCallback? onTap;
  final VoidCallback? onMoveUp;
  final VoidCallback? onMoveDown;

  const _SelectedSectionOverlay({
    required this.section,
    this.onTap,
    this.onMoveUp,
    this.onMoveDown,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
        decoration: BoxDecoration(
          color: const Color(0xFF8B5CF6),
          borderRadius: BorderRadius.circular(10),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.18),
              blurRadius: 12,
              offset: const Offset(0, 6),
            ),
          ],
        ),
        child: Row(
          children: [
            const Icon(
              Icons.drag_indicator_rounded,
              color: Colors.white70,
              size: 16,
            ),
            const SizedBox(width: 6),
            Expanded(
              child: Text(
                section.type.displayName,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
            _OverlayIconButton(
              icon: Icons.arrow_upward_rounded,
              onTap: onMoveUp,
            ),
            _OverlayIconButton(
              icon: Icons.arrow_downward_rounded,
              onTap: onMoveDown,
            ),
          ],
        ),
      ),
    );
  }
}

class _OverlayIconButton extends StatelessWidget {
  final IconData icon;
  final VoidCallback? onTap;

  const _OverlayIconButton({required this.icon, this.onTap});

  @override
  Widget build(BuildContext context) {
    return IconButton(
      onPressed: onTap,
      icon: Icon(icon, size: 14),
      color: Colors.white,
      disabledColor: Colors.white38,
      visualDensity: VisualDensity.compact,
      constraints: const BoxConstraints(minWidth: 28, minHeight: 28),
      padding: EdgeInsets.zero,
    );
  }
}

class _PreviewUnavailable extends StatelessWidget {
  final StoreModel? store;

  const _PreviewUnavailable({this.store});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.public_off_rounded, color: Color(0xFF64748B)),
            const SizedBox(height: 10),
            Text(
              store?.subdomain.isNotEmpty == true
                  ? 'Preview unavailable'
                  : 'Store preview pending',
              textAlign: TextAlign.center,
              style: const TextStyle(
                color: Color(0xFF334155),
                fontSize: 13,
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _PreviewError extends StatelessWidget {
  final String message;

  const _PreviewError({required this.message});

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: Alignment.bottomCenter,
      child: Container(
        margin: const EdgeInsets.all(12),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        decoration: BoxDecoration(
          color: const Color(0xFF991B1B),
          borderRadius: BorderRadius.circular(10),
        ),
        child: Text(
          message,
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
          style: const TextStyle(color: Colors.white, fontSize: 11),
        ),
      ),
    );
  }
}
