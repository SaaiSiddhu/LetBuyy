import 'dart:ui'; // For BackdropFilter
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:share_plus/share_plus.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';

import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:letbuyy_models/letbuyy_models.dart';
import 'package:letbuyy_services/letbuyy_services.dart';

class ProductShareWidget extends StatefulWidget {
  final ProductModel product;

  const ProductShareWidget({
    super.key,
    required this.product,
  });

  @override
  State<ProductShareWidget> createState() => _ProductShareWidgetState();
}

class _ProductShareWidgetState extends State<ProductShareWidget>
    with SingleTickerProviderStateMixin {
  late AnimationController _animationController;

  static const String baseProductUrl = 'https://letbuyy.com/product/';

  @override
  void initState() {
    super.initState();
    _animationController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 300),
    );
    _animationController.forward();
  }

  @override
  void dispose() {
    _animationController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final themeProvider = Provider.of<ThemeProvider>(context);
    final isDark = themeProvider.isDarkMode;

    return BackdropFilter(
      filter: ImageFilter.blur(sigmaX: 5, sigmaY: 5),
      child: SlideTransition(
        position: Tween<Offset>(
          begin: const Offset(0, 1),
          end: Offset.zero,
        ).animate(
          CurvedAnimation(parent: _animationController, curve: Curves.easeOutCubic),
        ),
        child: Container(
          decoration: BoxDecoration(
            color: isDark ? const Color(0xFF1E1E1E) : Colors.white,
            borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
          ),
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                // Drag Handle
                Padding(
                  padding: const EdgeInsets.only(top: 12),
                  child: Container(
                    width: 40,
                    height: 5,
                    decoration: BoxDecoration(
                      color: isDark ? Colors.grey[700] : Colors.grey[300],
                      borderRadius: BorderRadius.circular(2.5),
                    ),
                  ),
                ),

                // Header
                _buildHeader(isDark),

                // Product Card
                _buildProductCard(isDark),

                const SizedBox(height: 16),

                // Share Options Title
                _buildSectionTitle('Share via...', isDark),
                const SizedBox(height: 12),

                // Social Share Options - 6 in a row
                _buildSocialOptions(isDark),

                const SizedBox(height: 16),

                // Direct Share Options Title
                _buildSectionTitle('More options', isDark),
                const SizedBox(height: 12),

                // Direct Share Options
                _buildDirectShareOptions(isDark),

                SizedBox(height: 16 + MediaQuery.of(context).padding.bottom),
              ],
            ),
          ),
        ),
      ),
    );
  }

  // Header
  Widget _buildHeader(bool isDark) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          const SizedBox(width: 40), // Spacer for centering
          Text(
            'Share Product',
            style: TextStyle(
              fontWeight: FontWeight.w800,
              fontSize: 18,
              color: isDark ? Colors.white : Colors.black87,
            ),
          ),
          GestureDetector(
            onTap: () => Navigator.pop(context),
            child: Container(
              width: 40,
              height: 40,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: isDark ? const Color(0xFF2C2C2C) : Colors.grey[100],
                shape: BoxShape.circle,
              ),
              child: Icon(Icons.close, size: 20, color: isDark ? Colors.grey[300] : Colors.grey[600]),
            ),
          ),
        ],
      ),
    );
  }

  // Section Title
  Widget _buildSectionTitle(String title, bool isDark) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Align(
        alignment: Alignment.centerLeft,
        child: Text(
          title,
          style: TextStyle(
            fontWeight: FontWeight.w700,
            fontSize: 16,
            color: isDark ? Colors.white : Colors.black87,
          ),
        ),
      ),
    );
  }

  // Product Card - Large & Theme-Aware
  Widget _buildProductCard(bool isDark) {
    final accentColor = isDark ? AppColors.primaryLight : AppColors.primary;
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
      child: _buildCardSection(
        isDark: isDark,
        padding: const EdgeInsets.all(12),
        child: Row(
          children: [
            // Product Image
            Container(
              width: 90,
              height: 90,
              decoration: BoxDecoration(
                color: isDark ? const Color(0xFF2C2C2C) : Colors.white,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: isDark ? Colors.grey[700]! : Colors.grey[200]!),
              ),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(8),
                child: Image.network(
                  widget.product.imageUrl ?? '',
                  fit: BoxFit.cover,
                  errorBuilder: (context, error, stackTrace) {
                    return Container(
                      color: isDark ? Colors.grey[800] : Colors.grey[200],
                      child: Icon(Icons.image_not_supported, size: 24, color: isDark ? Colors.grey[600] : Colors.grey[400]),
                    );
                  },
                ),
              ),
            ),
            const SizedBox(width: 16),

            // Product Info
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    widget.product.name,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontWeight: FontWeight.w700,
                      fontSize: 15,
                      color: isDark ? Colors.white : Colors.black87,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    '₹${widget.product.price.toStringAsFixed(0)}',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w800,
                      color: accentColor,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Row(
                    children: [
                      Icon(Icons.star_rounded, size: 16, color: Colors.amber[700]),
                      const SizedBox(width: 4),
                      Text(
                        '${widget.product.rating.toStringAsFixed(1)} (${widget.product.reviewCount} reviews)',
                        style: AppTextStyles.bodySmall.copyWith(
                          fontSize: 12,
                          color: isDark ? Colors.grey[400] : Colors.grey[600],
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  // Social Share Options - Realistic Icons and Colors
  Widget _buildSocialOptions(bool isDark) {
    final shareOptions = [
      _ShareOption(
        icon: FontAwesomeIcons.whatsapp,
        label: 'WhatsApp',
        color: const Color(0xFF25D366),
        onTap: () => _shareViaWhatsApp(),
      ),
      _ShareOption(
        icon: FontAwesomeIcons.telegram,
        label: 'Telegram',
        color: AppColors.info,
        onTap: () => _shareViaTelegram(),
      ),
      _ShareOption(
        icon: FontAwesomeIcons.facebook,
        label: 'Facebook',
        color: const Color(0xFF1877F2),
        onTap: () => _shareViaFacebook(),
      ),
      _ShareOption(
        icon: FontAwesomeIcons.xTwitter,
        label: 'Twitter',
        color: isDark ? Colors.white : const Color(0xFF000000),
        onTap: () => _shareViaTwitter(),
      ),
      _ShareOption(
        icon: FontAwesomeIcons.snapchat,
        label: 'Snapchat',
        color: const Color(0xFFFFFC00),
        onTap: () => _shareViaSnapchat(),
      ),
      _ShareOption(
        icon: Icons.mail_outline_rounded,
        label: 'Email',
        color: const Color(0xFFEA4335),
        onTap: () => _shareViaEmail(),
      ),
    ];

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: GridView.count(
        crossAxisCount: 6,
        mainAxisSpacing: 12,
        crossAxisSpacing: 12,
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        childAspectRatio: 0.85,
        children: shareOptions.map((option) => _buildShareButton(option, isDark)).toList(),
      ),
    );
  }

  // Direct Share Options - Compact Actions
  Widget _buildDirectShareOptions(bool isDark) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Column(
        children: [
          _buildDirectShareItem(
            icon: Icons.link_rounded,
            label: 'Copy Link',
            onTap: () => _copyLink(isDark),
            isDark: isDark,
          ),
          const SizedBox(height: 8),
          _buildDirectShareItem(
            icon: Icons.more_horiz_rounded,
            label: 'More Sharing Options',
            onTap: () => _showMoreOptions(),
            isDark: isDark,
          ),
        ],
      ),
    );
  }

  // Share Button Widget
  Widget _buildShareButton(_ShareOption option, bool isDark) {
    return GestureDetector(
      onTap: () {
        HapticFeedback.selectionClick();
        option.onTap();
      },
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 52,
            height: 52,
            decoration: BoxDecoration(
              color: isDark ? const Color(0xFF2C2C2C) : Colors.grey[100],
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: isDark ? Colors.grey[700]! : Colors.grey[200]!),
            ),
            child: Center(
              child: Icon(
                option.icon,
                color: option.color,
                size: 24,
              ),
            ),
          ),
          const SizedBox(height: 4),
          Text(
            option.label,
            style: AppTextStyles.bodySmall.copyWith(
              fontWeight: FontWeight.w500,
              fontSize: 10,
              color: isDark ? Colors.white70 : Colors.black87,
            ),
            textAlign: TextAlign.center,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    );
  }

  // Direct Share Item Widget
  Widget _buildDirectShareItem({
    required IconData icon,
    required String label,
    required VoidCallback onTap,
    required bool isDark,
  }) {
    return _buildCardSection(
      isDark: isDark,
      padding: const EdgeInsets.all(0),
      child: InkWell(
        onTap: () {
          HapticFeedback.selectionClick();
          onTap();
        },
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          child: Row(
            children: [
              Icon(icon, size: 22, color: isDark ? Colors.grey[300] : Colors.grey[700]),
              const SizedBox(width: 16),
              Expanded(
                child: Text(
                  label,
                  style: TextStyle(
                    fontWeight: FontWeight.w600,
                    fontSize: 14,
                    color: isDark ? Colors.white : Colors.black87,
                  ),
                ),
              ),
              Icon(Icons.arrow_forward_ios, size: 14, color: Colors.grey[400]),
            ],
          ),
        ),
      ),
    );
  }

  // Card section helper for consistent styling
  Widget _buildCardSection({
    required Widget child,
    required bool isDark,
    EdgeInsetsGeometry? padding,
  }) {
    return Container(
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1E1E1E) : Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: isDark ? Colors.grey[800]! : Colors.grey[200]!, width: 1),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: isDark ? 0.3 : 0.05),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Padding(padding: padding ?? EdgeInsets.zero, child: child),
    );
  }

  // Share functions

  void _shareViaWhatsApp() async {
    final text = _generateShareText();
    final encoded = Uri.encodeComponent(text);
    final url = 'https://wa.me/?text=$encoded';

    if (await canLaunchUrl(Uri.parse(url))) {
      await launchUrl(Uri.parse(url));
      Navigator.pop(context);
    } else {
      Share.share(text);
    }
  }

  void _shareViaTelegram() async {
    final text = _generateShareText();
    final encoded = Uri.encodeComponent(text);
    final url = 'https://t.me/share/url?url=${Uri.encodeComponent(getProductUrl())}&text=$encoded';

    if (await canLaunchUrl(Uri.parse(url))) {
      await launchUrl(Uri.parse(url));
      Navigator.pop(context);
    } else {
      Share.share(text);
    }
  }

  void _shareViaFacebook() async {
    final url = 'https://www.facebook.com/sharer/sharer.php?u=${getProductUrl()}&quote=${Uri.encodeComponent(widget.product.name)}';

    if (await canLaunchUrl(Uri.parse(url))) {
      await launchUrl(Uri.parse(url));
      Navigator.pop(context);
    } else {
      Share.share(widget.product.name);
    }
  }

  void _shareViaTwitter() async {
    final tweet = Uri.encodeComponent('Check out this amazing product: ${widget.product.name} - ${getProductUrl()} #LetBuyy');
    final url = 'https://twitter.com/intent/tweet?text=$tweet';

    if (await canLaunchUrl(Uri.parse(url))) {
      await launchUrl(Uri.parse(url));
      Navigator.pop(context);
    } else {
      Share.share(widget.product.name);
    }
  }

  void _shareViaSnapchat() {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Snapchat sharing is not supported at the moment.'),
      ),
    );
  }

  void _shareViaEmail() async {
    final subject = widget.product.name;
    final body = _generateShareText();
    final url = 'mailto:?subject=${Uri.encodeComponent(subject)}&body=${Uri.encodeComponent(body)}';

    if (await canLaunchUrl(Uri.parse(url))) {
      await launchUrl(Uri.parse(url));
      Navigator.pop(context);
    }
  }

  void _copyLink(bool isDark) {
    final url = getProductUrl();
    Clipboard.setData(ClipboardData(text: url));
    HapticFeedback.mediumImpact();

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Row(
          children: [
            Icon(Icons.check_circle, color: isDark ? Colors.black : Colors.white, size: 20),
            const SizedBox(width: 12),
            Text(
              'Link Copied!',
              style: TextStyle(
                fontWeight: FontWeight.bold,
                fontSize: 14,
                color: isDark ? Colors.black : Colors.white,
              ),
            ),
          ],
        ),
        backgroundColor: isDark ? AppColors.primaryLight : AppColors.primary,
        duration: const Duration(seconds: 2),
        behavior: SnackBarBehavior.floating,
        margin: const EdgeInsets.all(16),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      ),
    );
    Navigator.pop(context);
  }

  void _showMoreOptions() {
    final text = _generateShareText();
    Share.share(text, subject: widget.product.name);
  }

  String _generateShareText() {
    String productUrl = getProductUrl();
    String discountText = widget.product.discount > 0 ? '🎉 ${widget.product.discount}% OFF!\n' : '';
    String originalPriceText =
        widget.product.originalPrice != null ? '₹${widget.product.originalPrice!.toStringAsFixed(0)} \u2192 ' : '';

    return '''
🛍️ ${widget.product.name}

$originalPriceText₹${widget.product.price.toStringAsFixed(0)}
⭐ ${widget.product.rating.toStringAsFixed(1)} • ${widget.product.reviewCount} reviews
$discountText
🔗 $productUrl
''';
  }

  String getProductUrl() {
    return '$baseProductUrl${widget.product.id}';
  }
}

// Simple class for share option info
class _ShareOption {
  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback onTap;

  _ShareOption({
    required this.icon,
    required this.label,
    required this.color,
    required this.onTap,
  });
}
