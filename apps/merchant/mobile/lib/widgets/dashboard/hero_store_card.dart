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

class _HeroStoreCardState extends State<HeroStoreCard>
    with TickerProviderStateMixin {
  final FocusNode _storeUrlFocusNode = FocusNode(debugLabel: 'Copy store URL');
  late AnimationController _pulseController;
  late AnimationController _shimmerController;
  late AppThemeColors colors;

  @override
  void initState() {
    super.initState();
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 2),
    )..repeat(reverse: true);

    _shimmerController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 4),
    )..repeat();
  }

  @override
  void dispose() {
    _pulseController.dispose();
    _shimmerController.dispose();
    _storeUrlFocusNode.dispose();
    super.dispose();
  }

  String get _publicUrl => widget.storefrontUrl ?? widget.store.publicUrl;

  void _copyStoreUrl() {
    Clipboard.setData(ClipboardData(text: _publicUrl));
    HapticFeedback.lightImpact();
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: const Row(
          children: [
            Icon(Icons.check_circle, color: Colors.white, size: 16),
            SizedBox(width: 8),
            Text('URL copied!', style: TextStyle(fontSize: 13)),
          ],
        ),
        backgroundColor: colors.success,
        behavior: SnackBarBehavior.floating,
        margin: const EdgeInsets.all(16),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        duration: const Duration(seconds: 2),
      ),
    );
  }

  Future<void> _shareStore() async {
    HapticFeedback.mediumImpact();
    try {
      await Share.share(
        '🏪 Check out ${widget.store.name} on LetBuyy!\n\n$_publicUrl',
        subject: '${widget.store.name} - LetBuyy Store',
      );
    } catch (_) {
      if (mounted)
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Could not open share options. Try again.'),
          ),
        );
    }
  }

  void _showQRCode() {
    HapticFeedback.mediumImpact();
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (context) => _QRCodeBottomSheet(
        storeName: widget.store.name,
        storeUrl: _publicUrl,
        subdomain: widget.store.subdomain,
        logoUrl: widget.store.logoUrl,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    colors = AppThemeColors.of(context);
    return ClipRRect(
      borderRadius: BorderRadius.circular(24),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 16, sigmaY: 16),
        child: Container(
          decoration: BoxDecoration(
            gradient: colors.heroGradient,
            borderRadius: BorderRadius.circular(24),
            boxShadow: [
              BoxShadow(
                color: mobile_tokens.LetbuyyColorTokens.brandPrimary.withValues(
                  alpha: 0.35,
                ),
                blurRadius: 24,
                offset: const Offset(0, 10),
              ),
            ],
          ),
          child: Stack(
            children: [
              // Animated shimmer overlay
              _buildShimmerOverlay(),

              // Content
              Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    // Row 1: Logo + Info + Status
                    Row(
                      children: [
                        _buildStoreLogo(),
                        const SizedBox(width: 12),
                        Expanded(child: _buildStoreInfo()),
                        _buildStatusBadge(),
                      ],
                    ),

                    const SizedBox(height: 16),

                    // Row 2: Action Buttons + Quick Actions
                    Row(
                      children: [
                        // Main action buttons
                        Expanded(
                          flex: 2,
                          child: Row(
                            children: [
                              Expanded(
                                child: _CompactActionButton(
                                  icon: Icons.open_in_new_rounded,
                                  label: 'Visit',
                                  hint: 'Open the public storefront',
                                  onTap: () => launchUrl(Uri.parse(_publicUrl)),
                                ),
                              ),
                              const SizedBox(width: 8),
                              Expanded(
                                child: _CompactActionButton(
                                  icon: widget.store.isPublished
                                      ? Icons.cloud_off_outlined
                                      : Icons.rocket_launch_rounded,
                                  label: widget.store.isPublished
                                      ? 'Unpublish'
                                      : 'Go Live',
                                  hint: widget.store.isPublished
                                      ? 'Change the storefront publication status'
                                      : 'Publish the storefront',
                                  onTap: widget.onPublishToggle,
                                  isLoading: widget.isPublishing,
                                  isPrimary: !widget.store.isPublished,
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(width: 10),
                        // Quick action icons
                        _buildQuickActionIcon(
                          Icons.share_rounded,
                          'Share store',
                          _shareStore,
                        ),
                        const SizedBox(width: 6),
                        _buildQuickActionIcon(
                          Icons.qr_code_2_rounded,
                          'Store QR code',
                          _showQRCode,
                        ),
                        const SizedBox(width: 6),
                        _buildQuickActionIcon(
                          Icons.settings_outlined,
                          'Store settings',
                          widget.onSettingsTap,
                        ),
                      ],
                    ),

                    const SizedBox(height: 14),

                    // Subscription Row
                    _buildSubscriptionRow(),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildShimmerOverlay() {
    return AnimatedBuilder(
      animation: _shimmerController,
      builder: (context, child) {
        return Positioned.fill(
          child: Container(
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(24),
              gradient: LinearGradient(
                begin: Alignment(-1.5 + _shimmerController.value * 3, -0.5),
                end: Alignment(-0.5 + _shimmerController.value * 3, 0.5),
                colors: [
                  Colors.transparent,
                  Colors.white.withValues(alpha: 0.08),
                  Colors.transparent,
                ],
              ),
            ),
          ),
        );
      },
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
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          widget.store.name,
          style: TextStyle(
            fontSize: 17,
            fontWeight: FontWeight.bold,
            color: Colors.white,
            letterSpacing: -0.3,
          ),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
        const SizedBox(height: 4),
        Semantics(
          container: true,
          excludeSemantics: true,
          button: true,
          enabled: true,
          label: 'Copy store URL',
          hint: '$_publicUrl to clipboard',
          onTap: _copyStoreUrl,
          child: ConstrainedBox(
            constraints: const BoxConstraints(minHeight: 48),
            child: Center(
              child: Focus(
                key: const ValueKey('hero-store-url-focus'),
                focusNode: _storeUrlFocusNode,
                onKeyEvent: (_, event) {
                  if (event is KeyDownEvent &&
                      (event.logicalKey == LogicalKeyboardKey.enter ||
                          event.logicalKey == LogicalKeyboardKey.space)) {
                    _copyStoreUrl();
                    return KeyEventResult.handled;
                  }
                  return KeyEventResult.ignored;
                },
                child: InkWell(
                  canRequestFocus: false,
                  borderRadius: BorderRadius.circular(8),
                  onTap: _copyStoreUrl,
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        Icons.link_rounded,
                        size: 11,
                        color: Colors.white.withValues(alpha: 0.7),
                      ),
                      const SizedBox(width: 4),
                      Flexible(
                        child: Text(
                          '${widget.store.subdomain}.letbuyy.com',
                          style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w500,
                            color: Colors.white.withValues(alpha: 0.8),
                          ),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      const SizedBox(width: 4),
                      Icon(
                        Icons.copy_rounded,
                        size: 10,
                        color: Colors.white.withValues(alpha: 0.5),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildStatusBadge() {
    return AnimatedBuilder(
      animation: _pulseController,
      builder: (context, child) {
        final isLive = widget.store.isPublished;
        return Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
          decoration: BoxDecoration(
            color: isLive
                ? colors.success.withValues(
                    alpha: 0.15 + 0.1 * _pulseController.value,
                  )
                : colors.warning.withValues(alpha: 0.15),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(
              color: isLive
                  ? colors.success.withValues(alpha: 0.4)
                  : colors.warning.withValues(alpha: 0.4),
              width: 1,
            ),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 6,
                height: 6,
                decoration: BoxDecoration(
                  color: isLive ? colors.success : colors.warning,
                  shape: BoxShape.circle,
                  boxShadow: isLive
                      ? [
                          BoxShadow(
                            color: colors.success.withValues(
                              alpha: 0.5 * _pulseController.value,
                            ),
                            blurRadius: 6,
                            spreadRadius: 1,
                          ),
                        ]
                      : null,
                ),
              ),
              const SizedBox(width: 5),
              Text(
                isLive ? 'Live' : 'Draft',
                style: TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w600,
                  color: isLive ? colors.success : colors.warning,
                ),
              ),
            ],
          ),
        );
      },
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
    final isUnlimited =
        billing?.productLimitKnown == true && billing?.productLimit == null;
    final usagePercent = (billing?.productUsageFraction ?? 0) * 100;
    final planName = billing == null
        ? 'Billing unavailable'
        : '${billing.planName}${billing.id != null && !billing.active ? ' (${billing.status})' : ''}';
    final planEmoji = billing?.active == true ? '⭐' : '🎁';
    const planColor = Colors.white;

    Color progressColor;
    if (isUnlimited) {
      progressColor = const Color(0xFF10B981);
    } else if (usagePercent >= 90) {
      progressColor = const Color(0xFFEF4444);
    } else if (usagePercent >= 75) {
      progressColor = const Color(0xFFF59E0B);
    } else {
      progressColor = const Color(0xFF10B981);
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: Colors.black.withValues(alpha: 0.20),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
      ),
      child: Row(
        children: [
          // Plan Badge
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: planColor.withValues(alpha: 0.2),
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: planColor.withValues(alpha: 0.4)),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(planEmoji, style: TextStyle(fontSize: 12)),
                const SizedBox(width: 4),
                Text(
                  planName,
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: planColor,
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(width: 10),

          // Product Usage
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Flexible(
                      child: Text(
                        'Products Used',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          fontSize: 9,
                          color: Colors.white.withValues(alpha: 0.6),
                        ),
                      ),
                    ),
                    const SizedBox(width: 6),
                    Flexible(
                      child: Text(
                        billing?.compactProductUsageLabel ?? 'Unavailable',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        textAlign: TextAlign.end,
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w600,
                          color: Colors.white.withValues(alpha: 0.9),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                ClipRRect(
                  borderRadius: BorderRadius.circular(2),
                  child: LinearProgressIndicator(
                    value: isUnlimited ? 0.05 : usagePercent / 100,
                    backgroundColor: Colors.white.withValues(alpha: 0.1),
                    valueColor: AlwaysStoppedAnimation<Color>(progressColor),
                    minHeight: 3,
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(width: 10),

          // Open the canonical catalog for every tier.
          TextButton.icon(
            onPressed: widget.onPlanTap,
            style: TextButton.styleFrom(
              foregroundColor: Colors.white,
              minimumSize: const Size(48, 48),
            ),
            icon: const Icon(Icons.arrow_upward_rounded, size: 12),
            label: const Text('Plans', style: TextStyle(fontSize: 11)),
          ),
        ],
      ),
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
  final String storeName;
  final String storeUrl;
  final String subdomain;
  final String? logoUrl;

  const _QRCodeBottomSheet({
    required this.storeName,
    required this.storeUrl,
    required this.subdomain,
    this.logoUrl,
  });

  @override
  State<_QRCodeBottomSheet> createState() => _QRCodeBottomSheetState();
}

class _QRCodeBottomSheetState extends State<_QRCodeBottomSheet> {
  final GlobalKey _qrKey = GlobalKey();
  bool _isSharing = false;

  Future<void> _shareQRAsImage() async {
    setState(() => _isSharing = true);
    HapticFeedback.mediumImpact();

    try {
      await WidgetsBinding.instance.endOfFrame;
      if (!mounted) return;
      // Capture the QR card as image
      final boundary =
          _qrKey.currentContext?.findRenderObject() as RenderRepaintBoundary?;
      if (boundary == null) return;

      final image = await boundary.toImage(pixelRatio: 3.0);
      final byteData = await image.toByteData(format: ImageByteFormat.png);
      if (byteData == null) return;

      final bytes = byteData.buffer.asUint8List();

      // Save to temp file and share
      final tempDir = await getTemporaryDirectory();
      final file = File('${tempDir.path}/${widget.subdomain}_qr.png');
      await file.writeAsBytes(bytes);

      await Share.shareXFiles(
        [XFile(file.path)],
        text: '🏪 Scan to visit ${widget.storeName}!\n${widget.storeUrl}',
        subject: '${widget.storeName} - QR Code',
      );
    } catch (e) {
      if (mounted)
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Could not share the QR image. Try again.'),
          ),
        );
    } finally {
      if (mounted) setState(() => _isSharing = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [colors.card, colors.bgEnd],
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
        ),
        borderRadius: const BorderRadius.vertical(top: Radius.circular(32)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Handle
          Padding(
            padding: const EdgeInsets.only(top: 16, bottom: 20),
            child: Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.2),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),

          // Branded QR Card (capturable) - Edge to Edge
          RepaintBoundary(
            key: _qrKey,
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 28),
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  colors: [
                    mobile_tokens.LetbuyyColorTokens.brandPrimary,
                    Color(0xFF7C3AED),
                    Color(0xFF6D28D9),
                  ],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  // QR Code Container
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: QrImageView(
                      data: widget.storeUrl,
                      version: QrVersions.auto,
                      size: 180,
                      errorCorrectionLevel: QrErrorCorrectLevel
                          .H, // High error correction for logo overlay
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
                  const SizedBox(height: 18),

                  // Store Name
                  Text(
                    widget.storeName,
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                      color: Colors.white,
                    ),
                    textAlign: TextAlign.center,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 6),

                  // URL Chip
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 6,
                    ),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.2),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          Icons.link_rounded,
                          size: 12,
                          color: Colors.white.withValues(alpha: 0.9),
                        ),
                        const SizedBox(width: 6),
                        Text(
                          '${widget.subdomain}.letbuyy.com',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w500,
                            color: Colors.white.withValues(alpha: 0.95),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 14),

                  // Scan instruction
                  Text(
                    'Scan to visit store',
                    style: TextStyle(
                      fontSize: 12,
                      color: Colors.white.withValues(alpha: 0.7),
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 24),

          // Action buttons
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 24),
            child: Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: () {
                      Clipboard.setData(ClipboardData(text: widget.storeUrl));
                      HapticFeedback.lightImpact();
                      Navigator.pop(context);
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(
                          content: const Row(
                            children: [
                              Icon(
                                Icons.check_circle,
                                color: Colors.white,
                                size: 16,
                              ),
                              SizedBox(width: 8),
                              Text('URL copied!'),
                            ],
                          ),
                          backgroundColor: colors.success,
                          behavior: SnackBarBehavior.floating,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(10),
                          ),
                        ),
                      );
                    },
                    icon: const Icon(Icons.copy_rounded, size: 16),
                    label: Text('Copy Link'),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: colors.textPrimary,
                      side: BorderSide(color: colors.divider),
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14),
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: FilledButton.icon(
                    onPressed: _isSharing ? null : _shareQRAsImage,
                    icon: _isSharing
                        ? const SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white,
                            ),
                          )
                        : const Icon(Icons.share_rounded, size: 16),
                    label: Text(_isSharing ? 'Sharing...' : 'Share QR'),
                    style: FilledButton.styleFrom(
                      backgroundColor:
                          mobile_tokens.LetbuyyColorTokens.brandPrimary,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
          SizedBox(height: MediaQuery.of(context).padding.bottom + 16),
        ],
      ),
    );
  }
}
