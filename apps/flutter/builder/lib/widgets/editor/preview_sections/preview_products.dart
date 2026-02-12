import 'package:flutter/material.dart';
import 'package:letbuyy_models/letbuyy_models.dart';
import '../../../models/store_model.dart';

/// Preview of product grid / featured products section
/// Applies theme colors from store.templateConfig.themeSettings
class PreviewProducts extends StatelessWidget {
  final SectionModel section;
  final StoreModel? store;

  const PreviewProducts({
    super.key,
    required this.section,
    this.store,
  });

  // Theme color helpers
  Color get _primaryColor {
    final hex = store?.templateConfig?.themeSettings.primaryColor ?? '#6366F1';
    return _hexToColor(hex);
  }
  
  Color get _secondaryColor {
    final hex = store?.templateConfig?.themeSettings.secondaryColor ?? '#8B5CF6';
    return _hexToColor(hex);
  }
  
  Color get _accentColor {
    final hex = store?.templateConfig?.themeSettings.accentColor ?? '#E5E5E5';
    return _hexToColor(hex);
  }
  
  String get _fontFamily => store?.templateConfig?.themeSettings.fontFamily ?? 'Inter';

  Color _hexToColor(String hex) {
    hex = hex.replaceAll('#', '');
    if (hex.length == 6) hex = 'FF$hex';
    return Color(int.parse(hex, radix: 16));
  }

  @override
  Widget build(BuildContext context) {
    final settings = section.settings;
    final title = settings['title'] as String? ?? 'Our Products';
    final subtitle = settings['subtitle'] as String?;
    
    int parseInt(dynamic value, int defaultValue) {
      if (value is int) return value;
      if (value is String) return int.tryParse(value) ?? defaultValue;
      return defaultValue;
    }

    final sectionsColumns = parseInt(settings['columns'], 2);
    final columns = sectionsColumns < 1 ? 1 : sectionsColumns;
    final productCount = parseInt(settings['productCount'], 4);
    
    final isCarousel = section.type == SectionType.featuredProducts;

    return Container(
      padding: const EdgeInsets.symmetric(vertical: 24, horizontal: 16),
      color: Colors.grey[50],
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (isCarousel)
                      Text(
                        'COLLECTION',
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.bold,
                          color: _primaryColor,
                          letterSpacing: 1.2,
                          fontFamily: _fontFamily,
                        ),
                      ),
                    const SizedBox(height: 4),
                    Text(
                      title,
                      style: TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.bold,
                        color: const Color(0xFF1F2937),
                        height: 1.2,
                        fontFamily: _fontFamily,
                      ),
                    ),
                    if (subtitle != null && subtitle.isNotEmpty) ...[
                      const SizedBox(height: 4),
                      Text(
                        subtitle,
                        style: TextStyle(
                          fontSize: 13,
                          color: Colors.grey[600],
                          fontFamily: _fontFamily,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              if (isCarousel) ...[
                Row(
                  children: [
                    _NavButton(icon: Icons.chevron_left, primaryColor: _primaryColor),
                    const SizedBox(width: 8),
                    _NavButton(icon: Icons.chevron_right, primaryColor: _primaryColor),
                  ],
                ),
              ] else ...[
                 Text(
                  'View All →',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: _primaryColor,
                    fontFamily: _fontFamily,
                  ),
                ),
              ],
            ],
          ),
          const SizedBox(height: 20),
          
          if (isCarousel)
            SizedBox(
              height: 240,
              child: ListView.builder(
                scrollDirection: Axis.horizontal,
                itemCount: productCount > 4 ? 4 : productCount,
                itemBuilder: (context, index) => Padding(
                  padding: const EdgeInsets.only(right: 16),
                  child: SizedBox(
                    width: 160,
                    child: _buildProductCard(index, compact: true),
                  ),
                ),
              ),
            )
          else
            GridView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: columns,
                childAspectRatio: 0.70,
                crossAxisSpacing: 12,
                mainAxisSpacing: 20,
              ),
              itemCount: productCount > 4 ? 4 : productCount,
              itemBuilder: (context, index) => _buildProductCard(index),
            ),
        ],
      ),
    );
  }

  Widget _buildProductCard(int index, {bool compact = false}) {
    // Generate theme-based placeholder colors
    final baseColor = _primaryColor;
    final colors = [
      baseColor.withValues(alpha: 0.15),
      baseColor.withValues(alpha: 0.2),
      _secondaryColor.withValues(alpha: 0.15),
      _secondaryColor.withValues(alpha: 0.2),
    ];
    
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.05),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Product image placeholder
          Expanded(
            flex: 3,
            child: Stack(
              children: [
                Container(
                  color: colors[index % colors.length],
                  child: Center(
                    child: Icon(
                      Icons.favorite,
                      size: compact ? 24 : 32,
                      color: _primaryColor.withValues(alpha: 0.5),
                    ),
                  ),
                ),
                Positioned(
                  top: 8, right: 8,
                  child: Container(
                    padding: const EdgeInsets.all(4),
                    decoration: const BoxDecoration(
                      color: Colors.white,
                      shape: BoxShape.circle,
                    ),
                    child: Icon(Icons.favorite, size: 14, color: _primaryColor),
                  ),
                ),
              ],
            ),
          ),
          
          // Product info
          Expanded(
            flex: 2,
            child: Padding(
              padding: const EdgeInsets.all(8),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Category',
                        style: TextStyle(
                          fontSize: 9,
                          fontWeight: FontWeight.bold,
                          color: _primaryColor.withValues(alpha: 0.6),
                          letterSpacing: 0.5,
                          fontFamily: _fontFamily,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        'Product Name ${index + 1}',
                        style: TextStyle(
                          fontSize: compact ? 12 : 13,
                          fontWeight: FontWeight.w600,
                          color: Colors.grey[800],
                          fontFamily: _fontFamily,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Flexible(
                        child: Text(
                          '₹${(index + 1) * 499}',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.bold,
                            color: _primaryColor,
                            fontFamily: _fontFamily,
                          ),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      if (!compact)
                        Container(
                          padding: const EdgeInsets.all(3),
                          decoration: BoxDecoration(
                            color: _primaryColor,
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: const Icon(Icons.add, size: 10, color: Colors.white),
                        ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _NavButton extends StatelessWidget {
  final IconData icon;
  final Color primaryColor;
  
  const _NavButton({required this.icon, required this.primaryColor});
  
  @override
  Widget build(BuildContext context) {
    return Container(
      width: 28, height: 28,
      decoration: BoxDecoration(
        color: Colors.white,
        shape: BoxShape.circle,
        border: Border.all(color: primaryColor.withValues(alpha: 0.3)),
      ),
      child: Icon(icon, size: 16, color: primaryColor),
    );
  }
}
