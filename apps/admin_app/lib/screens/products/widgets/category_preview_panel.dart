// lib/screens/products/widgets/category_preview_panel.dart
// 📱 Marketplace-Matching Category Preview Panel

import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:letbuyy_marketplace_ui_kit/letbuyy_marketplace_ui_kit.dart';

/// Preview panel that shows exactly how the category will appear in the marketplace
class CategoryPreviewPanel extends StatelessWidget {
  final String categoryName;
  final String description;
  final String? iconImageUrl;
  final String? bannerImageUrl;
  final Uint8List? localIconBytes;
  final Uint8List? localBannerBytes;
  final String? iconName;
  final int level;
  final String? parentName;
  final bool isActive;

  const CategoryPreviewPanel({
    super.key,
    required this.categoryName,
    required this.description,
    this.iconImageUrl,
    this.bannerImageUrl,
    this.localIconBytes,
    this.localBannerBytes,
    this.iconName,
    this.level = 0,
    this.parentName,
    this.isActive = true,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final accentColor = AppColors.primary;

    return Container(
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1A1A1A) : Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isDark ? Colors.white.withValues(alpha: 0.05) : Colors.grey[200]!,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.05),
            blurRadius: 20,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: isDark 
                  ? Colors.white.withValues(alpha: 0.03)
                  : Colors.grey.withValues(alpha: 0.03),
              borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
            ),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: accentColor.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Icon(
                    Icons.preview_outlined,
                    size: 18,
                    color: accentColor,
                  ),
                ),
                const SizedBox(width: 12),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Live Preview',
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.bold,
                        color: isDark ? Colors.white : Colors.black87,
                      ),
                    ),
                    Text(
                      'Exactly as shown in marketplace',
                      style: TextStyle(
                        fontSize: 11,
                        color: Colors.grey[500],
                      ),
                    ),
                  ],
                ),
                const Spacer(),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: isActive 
                        ? AppColors.success.withValues(alpha: 0.1)
                        : Colors.grey.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        width: 6,
                        height: 6,
                        decoration: BoxDecoration(
                          color: isActive ? AppColors.success : Colors.grey,
                          shape: BoxShape.circle,
                        ),
                      ),
                      const SizedBox(width: 4),
                      Text(
                        isActive ? 'Active' : 'Inactive',
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w600,
                          color: isActive ? AppColors.success : Colors.grey,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),

          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // 1. Sidebar Item Preview (for main categories)
                  if (level == 0) ...[
                    _buildSectionLabel('Sidebar Preview', Icons.view_sidebar_outlined, isDark),
                    const SizedBox(height: 12),
                    _buildSidebarPreview(isDark, accentColor),
                    const SizedBox(height: 24),
                  ],

                  // 2. Banner Card Preview
                  _buildSectionLabel('Banner Card Preview', Icons.panorama_outlined, isDark),
                  const SizedBox(height: 12),
                  _buildBannerCardPreview(isDark, accentColor),
                  const SizedBox(height: 24),

                  // 3. Subcategory Card Preview (for level 1+)
                  if (level >= 1) ...[
                    _buildSectionLabel('Subcategory Card Preview', Icons.grid_view_rounded, isDark),
                    const SizedBox(height: 12),
                    _buildSubcategoryCardPreview(isDark, accentColor),
                    const SizedBox(height: 24),
                  ],

                  // 4. Hierarchy Position
                  _buildSectionLabel('Category Hierarchy', Icons.account_tree_outlined, isDark),
                  const SizedBox(height: 12),
                  _buildHierarchyPreview(isDark, accentColor),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSectionLabel(String title, IconData icon, bool isDark) {
    return Row(
      children: [
        Icon(icon, size: 14, color: Colors.grey[500]),
        const SizedBox(width: 6),
        Text(
          title,
          style: TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w600,
            color: Colors.grey[500],
            letterSpacing: 0.5,
          ),
        ),
      ],
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SIDEBAR PREVIEW - Exact copy from marketplace
  // ════════════════════════════════════════════════════════════════════════════
  Widget _buildSidebarPreview(bool isDark, Color accentColor) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1A1A1A) : Colors.grey[50],
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: isDark ? Colors.white.withValues(alpha: 0.05) : Colors.grey[200]!,
        ),
      ),
      child: Row(
        children: [
          // Actual sidebar item
          Container(
            width: 80,
            padding: const EdgeInsets.symmetric(vertical: 10),
            decoration: BoxDecoration(
              color: accentColor.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: accentColor.withValues(alpha: 0.3)),
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                // Icon container - 44x44
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: accentColor.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Center(
                    child: _buildIconImage(28, 28, accentColor),
                  ),
                ),
                const SizedBox(height: 6),
                // Name
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 2),
                  child: Text(
                    categoryName.isEmpty ? 'Category' : categoryName,
                    textAlign: TextAlign.center,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 9,
                      fontWeight: FontWeight.w700,
                      color: accentColor,
                      height: 1.1,
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 16),
          // Dimension labels
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _buildDimensionRow('Container', '80 × auto', isDark),
                _buildDimensionRow('Icon box', '44 × 44 px', isDark),
                _buildDimensionRow('Icon image', '28 × 28 px', isDark),
                _buildDimensionRow('Font size', '9 px', isDark),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // BANNER CARD PREVIEW - Exact copy from marketplace
  // ════════════════════════════════════════════════════════════════════════════
  Widget _buildBannerCardPreview(bool isDark, Color accentColor) {
    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.1),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(16),
        child: Stack(
          children: [
            // Background Image - 100px height, full width
            _buildBannerImage(accentColor),
            
            // Gradient Overlay
            Container(
              height: 100,
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [
                    Colors.black.withValues(alpha: 0.5),
                    Colors.black.withValues(alpha: 0.2),
                  ],
                  begin: Alignment.bottomCenter,
                  end: Alignment.topCenter,
                ),
              ),
            ),
            
            // Content
            Positioned(
              left: 14,
              bottom: 14,
              right: 14,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    categoryName.isEmpty ? 'Category Name' : categoryName,
                    style: const TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                      color: Colors.white,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.2),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: const Text(
                          '5 subcategories',
                          style: TextStyle(
                            fontSize: 10,
                            color: Colors.white,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),

            // Dimension label
            Positioned(
              top: 8,
              right: 8,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: Colors.black54,
                  borderRadius: BorderRadius.circular(4),
                ),
                child: const Text(
                  '100px height',
                  style: TextStyle(
                    fontSize: 9,
                    color: Colors.white70,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SUBCATEGORY CARD PREVIEW - Exact copy from marketplace
  // ════════════════════════════════════════════════════════════════════════════
  Widget _buildSubcategoryCardPreview(bool isDark, Color accentColor) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1A1A1A) : Colors.grey[50],
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: isDark ? Colors.white.withValues(alpha: 0.05) : Colors.grey[200]!,
        ),
      ),
      child: Row(
        children: [
          // Actual subcategory card (as in 3-column grid)
          Container(
            width: 90,
            decoration: BoxDecoration(
              color: isDark ? const Color(0xFF1E1E1E) : Colors.white,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color: isDark ? Colors.white.withValues(alpha: 0.05) : Colors.grey[200]!,
              ),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.04),
                  blurRadius: 8,
                  offset: const Offset(0, 2),
                ),
              ],
            ),
            child: Column(
              children: [
                // Image (60%)
                Container(
                  height: 60,
                  decoration: BoxDecoration(
                    borderRadius: const BorderRadius.vertical(top: Radius.circular(12)),
                    color: isDark ? Colors.grey[800] : Colors.grey[100],
                  ),
                  child: ClipRRect(
                    borderRadius: const BorderRadius.vertical(top: Radius.circular(12)),
                    child: _buildIconImage(double.infinity, 60, accentColor, fit: BoxFit.cover),
                  ),
                ),
                // Name (40%)
                Padding(
                  padding: const EdgeInsets.all(8),
                  child: Text(
                    categoryName.isEmpty ? 'Category' : categoryName,
                    textAlign: TextAlign.center,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w600,
                      color: isDark ? Colors.white : Colors.black87,
                      height: 1.2,
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 16),
          // Dimension labels
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _buildDimensionRow('Grid', '3 columns', isDark),
                _buildDimensionRow('Aspect ratio', '0.85', isDark),
                _buildDimensionRow('Image area', '60%', isDark),
                _buildDimensionRow('Name area', '40%', isDark),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // HIERARCHY PREVIEW
  // ════════════════════════════════════════════════════════════════════════════
  Widget _buildHierarchyPreview(bool isDark, Color accentColor) {
    final levelLabels = ['Main Category', 'Subcategory', 'Sub-Subcategory'];
    
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1A1A1A) : Colors.grey[50],
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: isDark ? Colors.white.withValues(alpha: 0.05) : Colors.grey[200]!,
        ),
      ),
      child: Column(
        children: [
          // Level indicator
          Row(
            children: List.generate(3, (i) {
              final isCurrentLevel = i == level;
              return Expanded(
                child: Container(
                  margin: EdgeInsets.only(right: i < 2 ? 8 : 0),
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  decoration: BoxDecoration(
                    color: isCurrentLevel 
                        ? accentColor.withValues(alpha: 0.15)
                        : (isDark ? Colors.white.withValues(alpha: 0.03) : Colors.grey[100]),
                    borderRadius: BorderRadius.circular(8),
                    border: isCurrentLevel 
                        ? Border.all(color: accentColor.withValues(alpha: 0.5))
                        : null,
                  ),
                  child: Column(
                    children: [
                      Text(
                        'L$i',
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.bold,
                          color: isCurrentLevel ? accentColor : Colors.grey[400],
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        levelLabels[i],
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          fontSize: 8,
                          color: isCurrentLevel 
                              ? (isDark ? Colors.white70 : Colors.black54)
                              : Colors.grey[400],
                        ),
                      ),
                    ],
                  ),
                ),
              );
            }),
          ),
          
          // Parent info
          if (parentName != null && parentName!.isNotEmpty) ...[
            const SizedBox(height: 16),
            Row(
              children: [
                Icon(Icons.subdirectory_arrow_right, 
                    size: 16, color: Colors.grey[400]),
                const SizedBox(width: 8),
                Text(
                  'Parent: ',
                  style: TextStyle(
                    fontSize: 11,
                    color: Colors.grey[500],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(
                    color: accentColor.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    parentName!,
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: accentColor,
                    ),
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildDimensionRow(String label, String value, bool isDark) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: TextStyle(
              fontSize: 10,
              color: Colors.grey[500],
            ),
          ),
          Text(
            value,
            style: TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.w600,
              color: isDark ? Colors.white70 : Colors.black54,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildIconImage(double width, double height, Color accentColor, {BoxFit fit = BoxFit.cover}) {
    // Priority: local bytes > URL > fallback icon
    if (localIconBytes != null) {
      return Image.memory(
        localIconBytes!,
        width: width.isFinite ? width : null,
        height: height,
        fit: fit,
      );
    }
    
    if (iconImageUrl?.isNotEmpty == true) {
      return CachedNetworkImage(
        imageUrl: iconImageUrl!,
        width: width.isFinite ? width : null,
        height: height,
        fit: fit,
        errorWidget: (_, __, ___) => Icon(
          Icons.category_outlined,
          size: 22,
          color: accentColor,
        ),
      );
    }
    
    return Icon(
      _getCategoryIcon(iconName),
      size: 22,
      color: accentColor,
    );
  }

  Widget _buildBannerImage(Color accentColor) {
    // Priority: local bytes > URL > gradient fallback
    if (localBannerBytes != null) {
      return Image.memory(
        localBannerBytes!,
        height: 100,
        width: double.infinity,
        fit: BoxFit.cover,
      );
    }
    
    if (bannerImageUrl?.isNotEmpty == true) {
      return CachedNetworkImage(
        imageUrl: bannerImageUrl!,
        height: 100,
        width: double.infinity,
        fit: BoxFit.cover,
        errorWidget: (_, __, ___) => Container(
          height: 100,
          decoration: BoxDecoration(
            gradient: LinearGradient(
              colors: [accentColor, accentColor.withValues(alpha: 0.6)],
            ),
          ),
        ),
      );
    }
    
    // Fallback gradient
    return Container(
      height: 100,
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [accentColor, accentColor.withValues(alpha: 0.6)],
        ),
      ),
    );
  }

  IconData _getCategoryIcon(String? iconName) {
    if (iconName == null || iconName.isEmpty) return Icons.category_outlined;
    
    final iconMap = {
      'shopping_bag': Icons.shopping_bag_outlined,
      'phone_android': Icons.phone_android_outlined,
      'computer': Icons.computer_outlined,
      'watch': Icons.watch_outlined,
      'headphones': Icons.headphones_outlined,
      'home': Icons.home_outlined,
      'kitchen': Icons.kitchen_outlined,
      'chair': Icons.chair_outlined,
      'checkroom': Icons.checkroom_outlined,
      'face': Icons.face_outlined,
      'sports': Icons.sports_outlined,
      'toys': Icons.toys_outlined,
      'book': Icons.book_outlined,
      'local_grocery_store': Icons.local_grocery_store_outlined,
      'pets': Icons.pets_outlined,
      'child_care': Icons.child_care_outlined,
      'car_repair': Icons.car_repair_outlined,
      'diamond': Icons.diamond_outlined,
    };
    
    return iconMap[iconName] ?? Icons.category_outlined;
  }
}
