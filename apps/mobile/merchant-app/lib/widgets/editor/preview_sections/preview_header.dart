import 'package:flutter/material.dart';
import 'package:letbuyy_models/letbuyy_models.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../../../models/store_model.dart';

/// Preview of header section in website preview
/// Matches storefront dynamic-header.tsx behavior exactly
class PreviewHeader extends StatelessWidget {
  final SectionModel section;
  final StoreModel? store;
  final String deviceMode; // 'phone', 'tablet', 'laptop'

  const PreviewHeader({
    super.key,
    required this.section,
    this.store,
    this.deviceMode = 'phone',
  });

  @override
  Widget build(BuildContext context) {
    final settings = section.settings;
    
    // Extract ALL settings with defaults (matching dynamic-header.tsx)
    final behavior = settings['behavior'] ?? 'hide-on-scroll';
    final logoPlacement = settings['logoPlacement'] ?? 'left';
    final displayMode = settings['displayMode'] ?? 'both';
    final navPlacement = settings['navPlacement'] ?? 'right';
    final showSearch = settings['showSearch'] as bool? ?? true;
    final showCart = settings['showCart'] as bool? ?? true;
    final showAccount = settings['showAccount'] as bool? ?? false;
    final navPages = _parseNavPages(settings['navPages']);
    
    // Get theme colors
    final primaryColor = _getPrimaryColor();
    final secondaryColor = _getSecondaryColor();
    
    // Show theme-colored header (like storefront non-scrolled state)
    // This matches how the header looks over the hero banner
    final headerBg = primaryColor;
    final textColor = Colors.white;
    final iconColor = Colors.white;
    
    // Responsive sizing
    final isPhone = deviceMode == 'phone';
    final isTablet = deviceMode == 'tablet';
    final isLaptop = deviceMode == 'laptop';
    
    // Number of nav links to show based on device
    final maxNavLinks = isPhone ? 0 : (isTablet ? 3 : 5);
    final visibleNavPages = navPages.where((p) => p['isVisible'] == true).take(maxNavLinks).toList();

    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: isPhone ? 12 : (isTablet ? 16 : 20),
        vertical: isPhone ? 10 : 12,
      ),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [primaryColor, secondaryColor],
        ),
      ),
      child: Row(
        children: [
          // MOBILE LAYOUT: Hamburger + Logo + Spacer + Icons
          if (isPhone) ...[
            Icon(Icons.menu, size: 22, color: iconColor),
            const SizedBox(width: 12),
            Expanded(child: _buildLogoAndName(displayMode, textColor)),
            _buildIconsRow(showSearch, showCart, showAccount, isPhone, iconColor, primaryColor),
          ] 
          // TABLET/LAPTOP LAYOUT: Respects logoPlacement
          else if (logoPlacement == 'center') ...[
            // Center placement: Logo centered, nav + icons on sides
            if (visibleNavPages.isNotEmpty) 
              _buildNavLinks(visibleNavPages, textColor),
            const Spacer(),
            _buildLogoAndName(displayMode, textColor),
            const Spacer(),
            _buildIconsRow(showSearch, showCart, showAccount, isPhone, iconColor, primaryColor),
          ] else ...[
            // Left placement: Logo left, nav centered, icons right
            _buildLogoAndName(displayMode, textColor),
            if (visibleNavPages.isNotEmpty)
              Expanded(
                child: Center(child: _buildNavLinks(visibleNavPages, textColor)),
              )
            else
              const Spacer(),
            _buildIconsRow(showSearch, showCart, showAccount, isPhone, iconColor, primaryColor),
          ],
        ],
      ),
    );
  }

  Widget _buildIconsRow(bool showSearch, bool showCart, bool showAccount, bool isPhone, Color? iconColor, Color primaryColor) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        if (showSearch)
          Padding(
            padding: const EdgeInsets.only(left: 8),
            child: Icon(Icons.search, size: isPhone ? 20 : 22, color: iconColor),
          ),
        if (showCart)
          Padding(
            padding: const EdgeInsets.only(left: 8),
            child: Stack(
              clipBehavior: Clip.none,
              children: [
                Icon(Icons.shopping_bag_outlined, size: isPhone ? 20 : 22, color: iconColor),
                Positioned(
                  top: -4,
                  right: -4,
                  child: Container(
                    width: 14,
                    height: 14,
                    decoration: BoxDecoration(
                      color: primaryColor,
                      shape: BoxShape.circle,
                    ),
                    child: const Center(
                      child: Text('2', style: TextStyle(
                        color: Colors.white,
                        fontSize: 8,
                        fontWeight: FontWeight.bold,
                      )),
                    ),
                  ),
                ),
              ],
            ),
          ),
        if (showAccount)
          Padding(
            padding: const EdgeInsets.only(left: 8),
            child: Icon(Icons.person_outline, size: isPhone ? 20 : 22, color: iconColor),
          ),
      ],
    );
  }

  Widget _buildLogoAndName(String displayMode, Color textColor) {
    final logoUrl = section.settings['logoUrl'] ?? store?.logoUrl;
    final hasLogo = logoUrl != null && logoUrl.toString().isNotEmpty;
    final storeName = store?.name ?? 'Store Name';
    
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        // Logo
        if (displayMode != 'name' && hasLogo)
          ClipRRect(
            borderRadius: BorderRadius.circular(6),
            child: CachedNetworkImage(
              imageUrl: logoUrl.toString(),
              width: 32,
              height: 32,
              fit: BoxFit.cover,
              errorWidget: (_, __, ___) => _buildLogoPlaceholder(),
            ),
          )
        else if (displayMode != 'name')
          _buildLogoPlaceholder(),
        
        // Store Name
        if (displayMode != 'logo') ...[
          if (displayMode != 'name') const SizedBox(width: 8),
          Text(
            storeName,
            style: TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.bold,
              color: textColor,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ],
    );
  }

  Widget _buildNavLinks(List<Map<String, dynamic>> pages, Color textColor) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: pages.map((page) => Padding(
        padding: const EdgeInsets.symmetric(horizontal: 8),
        child: Text(
          page['label'] ?? '',
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w500,
            color: textColor.withValues(alpha: 0.8),
          ),
        ),
      )).toList(),
    );
  }

  Widget _buildLogoPlaceholder() {
    return Container(
      width: 32,
      height: 32,
      decoration: BoxDecoration(
        color: _getPrimaryColor().withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Icon(Icons.store, size: 18, color: _getPrimaryColor()),
    );
  }

  List<Map<String, dynamic>> _parseNavPages(dynamic navPagesData) {
    if (navPagesData == null) {
      // Default nav pages
      return [
        {'id': 'home', 'label': 'Home', 'href': '/', 'isVisible': true},
        {'id': 'shop', 'label': 'Shop', 'href': '/shop', 'isVisible': true},
      ];
    }
    if (navPagesData is List) {
      return navPagesData.map((p) => p is Map<String, dynamic> ? p : <String, dynamic>{}).toList();
    }
    return [];
  }

  Color _getPrimaryColor() {
    final themeSettings = store?.templateConfig?.themeSettings;
    if (themeSettings != null) {
      try {
        final colorStr = themeSettings.primaryColor;
        if (colorStr.startsWith('#')) {
          return Color(int.parse('0xFF${colorStr.substring(1)}'));
        }
      } catch (_) {}
    }
    return const Color(0xFF6366F1);
  }

  Color _getSecondaryColor() {
    final themeSettings = store?.templateConfig?.themeSettings;
    if (themeSettings != null) {
      try {
        final colorStr = themeSettings.secondaryColor;
        if (colorStr.startsWith('#')) {
          return Color(int.parse('0xFF${colorStr.substring(1)}'));
        }
      } catch (_) {}
    }
    return const Color(0xFF8B5CF6);
  }
}
