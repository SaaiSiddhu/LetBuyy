import 'package:flutter/material.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart' as mobile_tokens;
import 'package:flutter/services.dart';
import 'package:flutter/rendering.dart';

import 'dart:ui';
import 'dart:io';

import 'package:url_launcher/url_launcher.dart';
import 'package:share_plus/share_plus.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:path_provider/path_provider.dart';
import 'package:provider/provider.dart';

import '../../app/store_context.dart';
import '../shared/merchant_store_view.dart';
import '../shared/merchant_product_usage.dart';
import '../shared/accessible_tap_region.dart';

import '../../services/subscription_catalog.dart';
import '../../theme/app_theme_colors.dart';
import '../../models/store_model.dart';
import '../shared/cached_merchant_image.dart';

/// Premium Hero Store Card - COMPACT ENHANCED VERSION
class HeroStoreCard extends StatefulWidget {
  final StoreModel store;
  final VoidCallback onPublishToggle;
  final MerchantBillingState? billing;
  final String? storefrontUrl;
  final VoidCallback? onPlanTap;
  final bool isPublishing;
  final VoidCallback? onAnalyticsTap;
  final VoidCallback? onSettingsTap;

  const HeroStoreCard({
    super.key,
    required this.store,
    required this.onPublishToggle,
    this.billing,
    this.storefrontUrl,
    this.onPlanTap,
    this.isPublishing = false,
    this.onAnalyticsTap,
    this.onSettingsTap,
  });

  @override
  State<HeroStoreCard> createState() => _HeroStoreCardState();
}

class _HeroStoreCardState extends State<HeroStoreCard> {
  final FocusNode _storeUrlFocusNode = FocusNode(debugLabel: 'Copy store URL');
  late final MerchantStoreView? _view;
  bool _qrOpening = false;
  late AppThemeColors colors;

  @override
  void initState() {
    super.initState();
    final stores = context.read<StoreContext?>();
    _view = stores != null && stores.selectedStoreId == widget.store.id
        ? (key: stores.requestContextKey, storeId: widget.store.id)
        : null;
  }

  @override
  void dispose() {
    _storeUrlFocusNode.dispose();
    super.dispose();
  }

  String get _publicUrl => widget.storefrontUrl ?? widget.store.publicUrl;

  bool get _current => mounted && merchantStoreViewCurrent(context, _view);

  Future<void> _copyStoreUrl() async {
    if (!_current) return;
    final url = _publicUrl;
    try {
      await Clipboard.setData(ClipboardData(text: url));
      if (!_current) return;
      HapticFeedback.lightImpact();
      mobile_tokens.showLetbuyyOperationFeedback(
        context,
        message: 'URL copied!',
      );
    } catch (_) {
      if (_current)
        mobile_tokens.showLetbuyyOperationFeedback(
          context,
          message: 'The store link could not be copied. Try again.',
          isError: true,
        );
    }
  }

  Future<void> _visitStore() async {
    if (!_current) return;
    try {
      final opened = await launchUrl(Uri.parse(_publicUrl));
      if (!opened && _current)
        mobile_tokens.showLetbuyyOperationFeedback(
          context,
          message: 'Could not open the store link. Try again.',
          isError: true,
        );
    } catch (_) {
      if (_current)
        mobile_tokens.showLetbuyyOperationFeedback(
          context,
          message: 'Could not open the store link. Try again.',
          isError: true,
        );
    }
  }

  Future<void> _shareStore() async {
    if (!_current) return;
    HapticFeedback.mediumImpact();
    try {
      await Share.share(
        '🏪 Check out ${widget.store.name} on LetBuyy!\n\n$_publicUrl',
        subject: '${widget.store.name} - LetBuyy Store',
      );
    } catch (_) {
      if (_current)
        mobile_tokens.showLetbuyyOperationFeedback(
          context,
          message: 'Could not open share options. Try again.',
          isError: true,
        );
    }
  }

  Future<void> _showQRCode() async {
    if (!_current || _qrOpening) return;
    setState(() => _qrOpening = true);
    HapticFeedback.mediumImpact();
    try {
      await mobile_tokens.showLetbuyyFormSheet<void>(
        context: context,
        builder: (_) => _QRCodeBottomSheet(
          view: _view!,
          storeName: widget.store.name,
          storeUrl: _publicUrl,
          subdomain: widget.store.subdomain,
          logoUrl: widget.store.logoUrl,
        ),
      );
    } finally {
      if (mounted) setState(() => _qrOpening = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final stores = context.watch<StoreContext?>();
    colors = AppThemeColors.of(context);
    final theme = Theme.of(context);
    if (stores != null && !_current) {
      return const Card(
        child: Padding(
          padding: EdgeInsets.all(mobile_tokens.LetbuyySpacingTokens.space20),
          child: Text('Store access changed. Reload the selected store.'),
        ),
      );
    }
    return Card(
      margin: EdgeInsets.zero,
      child: Padding(
        padding: const EdgeInsets.all(
          mobile_tokens.LetbuyySpacingTokens.space20,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _buildStoreLogo(),
                const SizedBox(
                  width: mobile_tokens.LetbuyySpacingTokens.space16,
                ),
                Expanded(child: _buildStoreInfo()),
              ],
            ),
            const SizedBox(height: mobile_tokens.LetbuyySpacingTokens.space12),
            Align(
              alignment: AlignmentDirectional.centerStart,
              child: Chip(
                avatar: Icon(
                  widget.store.isPublished
                      ? Icons.check_circle_outline
                      : Icons.edit_outlined,
                ),
                label: Text(widget.store.isPublished ? 'Published' : 'Draft'),
              ),
            ),
            const SizedBox(height: mobile_tokens.LetbuyySpacingTokens.space16),
            Wrap(
              spacing: mobile_tokens.LetbuyySpacingTokens.space8,
              runSpacing: mobile_tokens.LetbuyySpacingTokens.space8,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                OutlinedButton.icon(
                  style: OutlinedButton.styleFrom(
                    minimumSize: const Size.square(
                      mobile_tokens.LetbuyySpacingTokens.space48,
                    ),
                  ),
                  onPressed: _current ? _visitStore : null,
                  icon: const Icon(Icons.open_in_new),
                  label: const Text('Visit'),
                ),
                FilledButton.icon(
                  style: FilledButton.styleFrom(
                    minimumSize: const Size.square(
                      mobile_tokens.LetbuyySpacingTokens.space48,
                    ),
                  ),
                  onPressed: !_current || widget.isPublishing
                      ? null
                      : widget.onPublishToggle,
                  icon: widget.isPublishing
                      ? mobile_tokens.LoadingIndicator(
                          size: mobile_tokens.LetbuyySpacingTokens.space20,
                          color: theme.colorScheme.onSurfaceVariant,
                        )
                      : Icon(
                          widget.store.isPublished
                              ? Icons.cloud_off_outlined
                              : Icons.rocket_launch_outlined,
                        ),
                  label: Text(
                    widget.isPublishing
                        ? 'Publishing…'
                        : widget.store.isPublished
                        ? 'Unpublish'
                        : 'Go Live',
                  ),
                ),
                IconButton(
                  style: IconButton.styleFrom(
                    minimumSize: const Size.square(
                      mobile_tokens.LetbuyySpacingTokens.space48,
                    ),
                  ),
                  tooltip: 'Share store',
                  onPressed: _current ? _shareStore : null,
                  icon: const Icon(Icons.share_outlined),
                ),
                IconButton(
                  style: IconButton.styleFrom(
                    minimumSize: const Size.square(
                      mobile_tokens.LetbuyySpacingTokens.space48,
                    ),
                  ),
                  tooltip: 'Store QR code',
                  onPressed: _current && !_qrOpening ? _showQRCode : null,
                  icon: const Icon(Icons.qr_code_2),
                ),
                IconButton(
                  style: IconButton.styleFrom(
                    minimumSize: const Size.square(
                      mobile_tokens.LetbuyySpacingTokens.space48,
                    ),
                  ),
                  tooltip: 'Store settings',
                  onPressed: _current ? widget.onSettingsTap : null,
                  icon: const Icon(Icons.settings_outlined),
                ),
              ],
            ),
            const Divider(height: mobile_tokens.LetbuyySpacingTokens.space32),
            Text('Plan', style: theme.textTheme.titleSmall),
            const SizedBox(height: mobile_tokens.LetbuyySpacingTokens.space8),
            _buildSubscriptionRow(),
          ],
        ),
      ),
    );
  }

  Widget _buildStoreLogo() {
    return Container(
      width: 52,
      height: 52,
      decoration: BoxDecoration(
        gradient: widget.store.logoUrl == null
            ? const LinearGradient(
                colors: [Color(0xFFF8FAFC), Colors.white],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              )
            : null,
        color: widget.store.logoUrl != null ? Colors.white : null,
        borderRadius: BorderRadius.circular(14),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.2),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
        image: widget.store.logoUrl != null
            ? DecorationImage(
                image: cachedMerchantImageProvider(widget.store.logoUrl!),
                fit: BoxFit.cover,
              )
            : null,
      ),
      child: widget.store.logoUrl == null
          ? Center(
              child: ShaderMask(
                shaderCallback: (bounds) => const LinearGradient(
                  colors: [
                    mobile_tokens.LetbuyyColorTokens.brandPrimary,
                    Color(0xFF7C3AED),
                    Color(0xFF6D28D9),
                  ],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ).createShader(bounds),
                child: const Icon(
                  Icons.storefront_rounded, // Premium modern icon
                  color: Colors.white,
                  size: 26,
                ),
              ),
            )
          : null,
    );
  }

  Widget _buildStoreInfo() {
    final theme = Theme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(widget.store.name, style: theme.textTheme.titleLarge),
        const SizedBox(height: mobile_tokens.LetbuyySpacingTokens.space8),
        AccessibleTapRegion(
          excludeChildSemantics: true,
          focusNode: _storeUrlFocusNode,
          label: 'Copy store URL',
          hint: '$_publicUrl to clipboard',
          onTap: _current ? _copyStoreUrl : null,
          child: Focus(
            key: const ValueKey('hero-store-url-focus'),
            focusNode: _storeUrlFocusNode,
            onKeyEvent: (_, event) {
              if (_current &&
                  event is KeyDownEvent &&
                  (event.logicalKey == LogicalKeyboardKey.enter ||
                      event.logicalKey == LogicalKeyboardKey.space)) {
                _copyStoreUrl();
                return KeyEventResult.handled;
              }
              return KeyEventResult.ignored;
            },
            child: InkWell(
              canRequestFocus: false,
              onTap: _current ? _copyStoreUrl : null,
              child: ConstrainedBox(
                constraints: const BoxConstraints(minHeight: 48),
                child: Row(
                  children: [
                    const Icon(Icons.link),
                    const SizedBox(
                      width: mobile_tokens.LetbuyySpacingTokens.space8,
                    ),
                    Expanded(
                      child: Text(
                        _publicUrl.replaceFirst(RegExp(r'^https?://'), ''),
                        style: theme.textTheme.bodyMedium,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildQuickStatsRow() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: Colors.black.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceAround,
        children: [
          _buildStatItem(
            Icons.shopping_bag_outlined,
            widget.store.totalOrders.toString(),
            'Orders',
          ),
          _buildStatDivider(),
          _buildStatItem(
            Icons.inventory_2_outlined,
            widget.store.productCount.toString(),
            'Products',
          ),
          _buildStatDivider(),
          _buildStatItem(
            Icons.visibility_outlined,
            _formatNumber(widget.store.viewCount),
            'Views',
          ),
        ],
      ),
    );
  }

  Widget _buildStatItem(IconData icon, String value, String label) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, color: Colors.white.withValues(alpha: 0.6), size: 13),
        const SizedBox(width: 5),
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              value,
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.bold,
                color: Colors.white,
              ),
            ),
            Text(
              label,
              style: TextStyle(
                fontSize: 8,
                color: Colors.white.withValues(alpha: 0.5),
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildStatDivider() {
    return Container(
      height: 24,
      width: 1,
      color: Colors.white.withValues(alpha: 0.1),
    );
  }

  String _formatNumber(int n) {
    if (n >= 1000000) return '${(n / 1000000).toStringAsFixed(1)}M';
    if (n >= 1000) return '${(n / 1000).toStringAsFixed(1)}K';
    return n.toString();
  }

  Widget _buildQuickActionIcon(
    IconData icon,
    String label,
    VoidCallback? onTap,
  ) {
    return Semantics(
      container: true,
      excludeSemantics: true,
      button: true,
      enabled: onTap != null,
      label: label,
      hint: onTap == null ? 'Unavailable' : null,
      onTap: onTap,
      child: SizedBox(
        width: 44,
        height: 48,
        child: Center(
          child: InkWell(
            customBorder: const CircleBorder(),
            onTap: onTap == null
                ? null
                : () {
                    HapticFeedback.lightImpact();
                    onTap();
                  },
            child: Ink(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.12),
                shape: BoxShape.circle,
                border: Border.all(color: Colors.white.withValues(alpha: 0.15)),
              ),
              child: Icon(
                icon,
                color: Colors.white.withValues(alpha: 0.85),
                size: 16,
              ),
            ),
          ),
        ),
      ),
    );
  }

  /// Subscription info row with plan, usage, and upgrade
  Widget _buildSubscriptionRow() {
    final billing = widget.billing;
    final planName = billing == null
        ? 'Billing unavailable'
        : '${billing.planName}${billing.id != null && !billing.active ? ' (${billing.status})' : ''}';
    final theme = Theme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(planName, style: theme.textTheme.bodyLarge),
        const SizedBox(height: mobile_tokens.LetbuyySpacingTokens.space16),
        MerchantProductUsage(billing: billing),
        const SizedBox(height: mobile_tokens.LetbuyySpacingTokens.space12),
        Align(
          alignment: AlignmentDirectional.centerStart,
          child: TextButton.icon(
            onPressed: _current ? widget.onPlanTap : null,
            icon: const Icon(Icons.diamond_outlined),
            label: const Text('Plans'),
          ),
        ),
      ],
    );
  }
}

/// Compact Action Button
class _CompactActionButton extends StatefulWidget {
  final IconData icon;
  final String label;
  final String hint;
  final VoidCallback onTap;
  final bool isLoading;
  final bool isPrimary;

  const _CompactActionButton({
    required this.icon,
    required this.label,
    required this.hint,
    required this.onTap,
    this.isLoading = false,
    this.isPrimary = false,
  });

  @override
  State<_CompactActionButton> createState() => _CompactActionButtonState();
}

class _CompactActionButtonState extends State<_CompactActionButton> {
  bool _isPressed = false;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    return Semantics(
      container: true,
      excludeSemantics: true,
      button: true,
      enabled: !widget.isLoading,
      label: widget.label,
      hint: widget.hint,
      onTap: widget.isLoading ? null : widget.onTap,
      child: ConstrainedBox(
        constraints: const BoxConstraints(minHeight: 48),
        child: Focus(
          onFocusChange: (focused) {
            if (_isPressed != focused) setState(() => _isPressed = focused);
          },
          child: InkWell(
            borderRadius: BorderRadius.circular(10),
            onHighlightChanged: (pressed) {
              if (_isPressed != pressed) setState(() => _isPressed = pressed);
            },
            onTap: widget.isLoading
                ? null
                : () {
                    HapticFeedback.mediumImpact();
                    widget.onTap();
                  },
            child: AnimatedScale(
              scale: _isPressed ? 0.98 : 1.0,
              duration: const Duration(milliseconds: 100),
              child: Ink(
                padding: const EdgeInsets.symmetric(vertical: 10),
                decoration: BoxDecoration(
                  gradient: widget.isPrimary
                      ? const LinearGradient(
                          colors: [Colors.white, Color(0xFFF5F5F5)],
                        )
                      : null,
                  color: widget.isPrimary
                      ? null
                      : Colors.white.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(
                    color: widget.isPrimary
                        ? Colors.transparent
                        : Colors.white.withValues(alpha: 0.2),
                  ),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    if (widget.isLoading)
                      SizedBox(
                        width: 14,
                        height: 14,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: widget.isPrimary
                              ? mobile_tokens.LetbuyyColorTokens.brandPrimary
                              : Colors.white,
                        ),
                      )
                    else
                      Icon(
                        widget.icon,
                        size: 14,
                        color: widget.isPrimary
                            ? mobile_tokens.LetbuyyColorTokens.brandPrimary
                            : Colors.white,
                      ),
                    const SizedBox(width: 5),
                    Flexible(
                      child: Text(
                        widget.label,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          color: widget.isPrimary
                              ? mobile_tokens.LetbuyyColorTokens.brandPrimary
                              : Colors.white,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// QR Code Bottom Sheet with LetBuyy Branding
class _QRCodeBottomSheet extends StatefulWidget {
  final MerchantStoreView view;
  final String storeName;
  final String storeUrl;
  final String subdomain;
  final String? logoUrl;

  const _QRCodeBottomSheet({
    required this.view,
    required this.storeName,
    required this.storeUrl,
    required this.subdomain,
    this.logoUrl,
  });

  @override
  State<_QRCodeBottomSheet> createState() => _QRCodeBottomSheetState();
}

class _QRCodeBottomSheetState extends State<_QRCodeBottomSheet> {
  final _qrKey = GlobalKey();
  bool _isSharing = false;
  String? _error;
  bool get _current =>
      mounted && merchantStoreViewCurrent(context, widget.view);

  Future<void> _shareQRAsImage() async {
    if (!_current || _isSharing) return;
    final storeName = widget.storeName,
        storeUrl = widget.storeUrl,
        subdomain = widget.subdomain;
    bool currentIntent() =>
        _current &&
        widget.storeName == storeName &&
        widget.storeUrl == storeUrl &&
        widget.subdomain == subdomain;
    setState(() {
      _isSharing = true;
      _error = null;
    });
    HapticFeedback.mediumImpact();
    try {
      await WidgetsBinding.instance.endOfFrame;
      if (!currentIntent()) return;
      final boundary =
          _qrKey.currentContext?.findRenderObject() as RenderRepaintBoundary?;
      if (boundary == null) throw StateError('QR image unavailable');
      final image = await boundary.toImage(pixelRatio: 3.0);
      ByteData? byteData;
      try {
        if (!currentIntent()) return;
        byteData = await image.toByteData(format: ImageByteFormat.png);
      } finally {
        image.dispose();
      }
      if (!currentIntent()) return;
      if (byteData == null) throw StateError('QR image unavailable');
      final bytes = byteData.buffer.asUint8List();
      final tempDir = await getTemporaryDirectory();
      if (!currentIntent()) return;
      final file = File('${tempDir.path}/${subdomain}_qr.png');
      await file.writeAsBytes(bytes);
      if (!currentIntent()) return;
      await Share.shareXFiles(
        [XFile(file.path)],
        text: '🏪 Scan to visit $storeName!\n$storeUrl',
        subject: '$storeName - QR Code',
      );
    } catch (_) {
      if (_current)
        setState(
          () => _error =
              'The share result could not be confirmed. '
              'Check the destination before sharing again.',
        );
    } finally {
      if (mounted) setState(() => _isSharing = false);
    }
  }

  Future<void> _copyLink() async {
    if (!_current || _isSharing) return;
    try {
      await Clipboard.setData(ClipboardData(text: widget.storeUrl));
      if (!_current) return;
      HapticFeedback.lightImpact();
      mobile_tokens.showLetbuyyOperationFeedback(
        context,
        message: 'URL copied!',
      );
      Navigator.pop(context);
    } catch (_) {
      if (_current)
        setState(
          () => _error = 'The store link could not be copied. Try again.',
        );
    }
  }

  @override
  Widget build(BuildContext context) {
    context.watch<StoreContext>();
    if (!_current)
      return const mobile_tokens.LetbuyyFormSheet(
        title: 'Store access changed',
        child: Text(
          'Close this QR code and reopen it from the selected store.',
        ),
      );
    final theme = Theme.of(context);
    return mobile_tokens.LetbuyyFormSheet(
      title: 'Store QR code',
      canDismiss: !_isSharing,
      actions: [
        OutlinedButton.icon(
          onPressed: _isSharing ? null : _copyLink,
          icon: const Icon(Icons.copy),
          label: const Text('Copy Link'),
        ),
        FilledButton.icon(
          onPressed: _isSharing ? null : _shareQRAsImage,
          icon: const Icon(Icons.share_outlined),
          label: Text(_isSharing ? 'Sharing…' : 'Share QR'),
        ),
      ],
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          RepaintBoundary(
            key: _qrKey,
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.all(
                mobile_tokens.LetbuyySpacingTokens.space20,
              ),
              color: mobile_tokens.LetbuyyPrimitiveTokens.purple700,
              child: Column(
                children: [
                  LayoutBuilder(
                    builder: (_, bounds) => Container(
                      padding: const EdgeInsets.all(
                        mobile_tokens.LetbuyySpacingTokens.space16,
                      ),
                      color: Colors.white,
                      child: QrImageView(
                        data: widget.storeUrl,
                        version: QrVersions.auto,
                        size:
                            (bounds.maxWidth -
                                    mobile_tokens.LetbuyySpacingTokens.space32)
                                .clamp(1.0, 180.0),
                        errorCorrectionLevel: QrErrorCorrectLevel.H,
                        eyeStyle: const QrEyeStyle(
                          eyeShape: QrEyeShape.square,
                          color: Color(0xFF1E1B4B),
                        ),
                        dataModuleStyle: const QrDataModuleStyle(
                          dataModuleShape: QrDataModuleShape.square,
                          color: Color(0xFF1E1B4B),
                        ),
                        embeddedImage: const AssetImage(
                          'assets/icons/app_icon.png',
                        ),
                        embeddedImageStyle: const QrEmbeddedImageStyle(
                          size: Size(40, 40),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(
                    height: mobile_tokens.LetbuyySpacingTokens.space16,
                  ),
                  Text(
                    widget.storeName,
                    textAlign: TextAlign.center,
                    style: theme.textTheme.titleLarge?.copyWith(
                      color: Colors.white,
                    ),
                  ),
                  const SizedBox(
                    height: mobile_tokens.LetbuyySpacingTokens.space8,
                  ),
                  Text(
                    widget.storeUrl.replaceFirst(RegExp(r'^https?://'), ''),
                    textAlign: TextAlign.center,
                    style: theme.textTheme.bodyMedium?.copyWith(
                      color: Colors.white,
                    ),
                  ),
                  const SizedBox(
                    height: mobile_tokens.LetbuyySpacingTokens.space16,
                  ),
                  Text(
                    'Scan to visit store',
                    style: theme.textTheme.bodyMedium?.copyWith(
                      color: Colors.white,
                    ),
                  ),
                ],
              ),
            ),
          ),
          if (_error != null)
            Padding(
              padding: const EdgeInsets.only(
                top: mobile_tokens.LetbuyySpacingTokens.space16,
              ),
              child: Semantics(
                liveRegion: true,
                child: Text(
                  _error!,
                  style: theme.textTheme.bodyMedium?.copyWith(
                    color: theme.colorScheme.error,
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}
