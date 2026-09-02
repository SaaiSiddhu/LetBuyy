// lib/screens/shop/widgets/filter_drawer.dart
// 💎 PREMIUM Database-Driven Filter Drawer with Smart Filters
// Price + Rating + Discount (from products) + Deals + Database Attributes

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:provider/provider.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:letbuyy_models/letbuyy_models.dart';
import 'package:letbuyy_services/letbuyy_services.dart';

class FilterDrawer extends StatefulWidget {
  final Function(Map<String, dynamic>) onApply;
  final Map<String, dynamic> initialFilters;
  final String? preSelectedCategoryId;
  final List<ProductModel> products;

  const FilterDrawer({
    super.key,
    required this.onApply,
    this.initialFilters = const {},
    this.preSelectedCategoryId,
    this.products = const [],
  });

  @override
  State<FilterDrawer> createState() => _FilterDrawerState();
}

class _FilterDrawerState extends State<FilterDrawer> {
  int _activeSection = 0;
  bool _isLoading = true;

  List<CategoryAttributeSchema> _allSchemas = [];
  List<AttributeField> _allFilterableAttributes = [];

  // Core filters
  late RangeValues _priceRange;
  double _minProductPrice = 0;
  double _maxProductPrice = 50000;
  
  // Rating filter (1-5 stars)
  int _selectedMinRating = 0;
  
  // Discount filter (based on actual product discounts)
  Set<int> _availableDiscounts = {};
  int _selectedMinDiscount = 0;
  
  // Deals toggle
  bool _dealsOnly = false;

  // Dynamic attribute filters
  final Map<String, Set<String>> _attributeFilters = {};
  final Map<String, Map<String, int>> _attributeValueCounts = {};

  final List<_FilterSection> _sections = [];
  final CategoryAttributeService _attributeService = CategoryAttributeService();

  @override
  void initState() {
    super.initState();
    _initializeFilters();
    _loadFilters();
  }

  void _initializeFilters() {
    final priceRange = widget.initialFilters['priceRange'];
    _priceRange = priceRange is RangeValues ? priceRange : const RangeValues(0, 50000);
    
    _selectedMinRating = (widget.initialFilters['minRating'] as num?)?.toInt() ?? 0;
    _selectedMinDiscount = (widget.initialFilters['minDiscount'] as num?)?.toInt() ?? 0;
    _dealsOnly = widget.initialFilters['dealsOnly'] ?? false;

    final attrFilters = widget.initialFilters['attributeFilters'];
    if (attrFilters is Map<String, dynamic>) {
      for (final entry in attrFilters.entries) {
        _attributeFilters[entry.key] = Set<String>.from(entry.value as List);
      }
    }
  }

  Future<void> _loadFilters() async {
    setState(() => _isLoading = true);

    try {
      List<ProductModel> products = widget.products;
      if (products.isEmpty && mounted) {
        try {
          final productProvider = Provider.of<ProductProvider>(context, listen: false);
          products = productProvider.products;
        } catch (_) {}
      }

      // Fetch category schemas from Firestore
      _allSchemas = await _attributeService.getAllCategorySchemas();

      final attributeMap = <String, AttributeField>{};
      for (final schema in _allSchemas) {
        for (final attr in schema.attributes) {
          if (attr.isFilterable && !attributeMap.containsKey(attr.key)) {
            attributeMap[attr.key] = attr;
          }
        }
      }

      _allFilterableAttributes = attributeMap.values.toList()
        ..sort((a, b) => a.displayOrder.compareTo(b.displayOrder));

      _aggregateProductData(products);
      _buildSections();
    } catch (e) {
      debugPrint('Error loading filters: $e');
    }

    if (mounted) setState(() => _isLoading = false);
  }

  void _aggregateProductData(List<ProductModel> products) {
    if (products.isEmpty) return;

    double minPrice = double.infinity;
    double maxPrice = 0;
    Set<int> discountBuckets = {};

    for (final product in products) {
      // Price
      if (product.price < minPrice) minPrice = product.price;
      if (product.price > maxPrice) maxPrice = product.price;

      // Discounts - collect actual discount percentages
      if (product.discount > 0) {
        // Round to nearest 5%
        int bucket = (product.discount / 5).floor() * 5;
        if (bucket >= 10) discountBuckets.add(bucket);
      }

      // Aggregate attribute values
      for (final attr in _allFilterableAttributes) {
        final key = attr.key;
        dynamic value = product.attributes[key] ??
            product.specifications?[key] ??
            product.attributes[attr.label] ??
            product.specifications?[attr.label];

        if (value == null) continue;

        _attributeValueCounts[key] ??= {};

        if (value is String && value.isNotEmpty) {
          _attributeValueCounts[key]![value] = (_attributeValueCounts[key]![value] ?? 0) + 1;
        } else if (value is List) {
          for (final v in value) {
            if (v is String && v.isNotEmpty) {
              _attributeValueCounts[key]![v] = (_attributeValueCounts[key]![v] ?? 0) + 1;
            }
          }
        }
      }
    }

    _minProductPrice = minPrice == double.infinity ? 0 : minPrice;
    _maxProductPrice = maxPrice == 0 ? 50000 : maxPrice;
    _availableDiscounts = discountBuckets;

    // Ensure min < max for RangeSlider
    if (_minProductPrice >= _maxProductPrice) {
      _maxProductPrice = _minProductPrice + 1000;
    }

    // Clamp price range values to be within bounds
    final clampedStart = _priceRange.start.clamp(_minProductPrice, _maxProductPrice);
    final clampedEnd = _priceRange.end.clamp(_minProductPrice, _maxProductPrice);
    _priceRange = RangeValues(clampedStart, clampedEnd > clampedStart ? clampedEnd : _maxProductPrice);
  }

  void _buildSections() {
    _sections.clear();

    // 1. Price (always first)
    _sections.add(_FilterSection(
      title: 'Price',
      icon: FontAwesomeIcons.indianRupeeSign,
      type: _FilterType.price,
    ));

    // 2. Rating
    _sections.add(_FilterSection(
      title: 'Rating',
      icon: FontAwesomeIcons.star,
      type: _FilterType.rating,
    ));

    // 3. Discount (only if products have discounts)
    if (_availableDiscounts.isNotEmpty) {
      _sections.add(_FilterSection(
        title: 'Discount',
        icon: FontAwesomeIcons.percent,
        type: _FilterType.discount,
      ));
    }

    // 4. Deals toggle (always show)
    _sections.add(_FilterSection(
      title: 'Deals',
      icon: FontAwesomeIcons.fire,
      type: _FilterType.deals,
    ));

    // 5+ Database-driven attributes
    for (final attr in _allFilterableAttributes) {
      final hasProductValues = _attributeValueCounts[attr.key]?.isNotEmpty ?? false;
      final hasSchemaOptions = attr.options.isNotEmpty;

      if (hasProductValues || hasSchemaOptions) {
        _sections.add(_FilterSection(
          title: attr.label,
          icon: _getAttributeIcon(attr.key),
          type: _FilterType.attribute,
          attributeKey: attr.key,
          attribute: attr,
        ));
      }
    }
  }

  IconData _getAttributeIcon(String key) {
    final k = key.toLowerCase();
    if (k.contains('color') || k.contains('colour')) return FontAwesomeIcons.palette;
    if (k.contains('size')) return FontAwesomeIcons.ruler;
    if (k.contains('ram') || k.contains('memory')) return FontAwesomeIcons.memory;
    if (k.contains('storage') || k.contains('disk')) return FontAwesomeIcons.hardDrive;
    if (k.contains('material') || k.contains('fabric')) return FontAwesomeIcons.shirt;
    if (k.contains('screen') || k.contains('display')) return FontAwesomeIcons.display;
    if (k.contains('processor') || k.contains('cpu')) return FontAwesomeIcons.microchip;
    if (k.contains('battery')) return FontAwesomeIcons.batteryFull;
    if (k.contains('brand')) return FontAwesomeIcons.tag;
    if (k.contains('weight')) return FontAwesomeIcons.weightScale;
    if (k.contains('connectivity') || k.contains('wifi')) return FontAwesomeIcons.wifi;
    if (k.contains('camera')) return FontAwesomeIcons.camera;
    if (k.contains('type') || k.contains('category')) return FontAwesomeIcons.layerGroup;
    return FontAwesomeIcons.sliders;
  }

  @override
  Widget build(BuildContext context) {
    final themeProvider = Provider.of<ThemeProvider>(context);
    final isDark = themeProvider.isDarkMode;
    final statusBarHeight = MediaQuery.of(context).padding.top;
    final accentColor = isDark ? AppColors.primaryLight : AppColors.primary;

    return Drawer(
      backgroundColor: isDark ? AppColors.backgroundDark : AppColors.background,
      width: MediaQuery.of(context).size.width * 0.88,
      child: Column(
        children: [
          _buildHeader(isDark, statusBarHeight, accentColor),
          Expanded(
            child: _isLoading
                ? _buildLoadingState(accentColor)
                : _sections.isEmpty
                    ? _buildEmptyState(isDark)
                    : Row(
                        children: [
                          _buildSidebar(isDark, accentColor),
                          Expanded(child: _buildContent(isDark, accentColor)),
                        ],
                      ),
          ),
          _buildFooter(isDark, accentColor),
        ],
      ),
    );
  }

  Widget _buildHeader(bool isDark, double statusBarHeight, Color accentColor) {
    final activeCount = _getActiveFilterCount();

    return Container(
      padding: EdgeInsets.only(top: statusBarHeight + 10, bottom: 14, left: 16, right: 12),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: isDark
              ? [AppColors.primaryDark, AppColors.primaryDarker, AppColors.surfaceDark]
              : [AppColors.primaryDark, AppColors.primary, AppColors.primaryLight],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        boxShadow: [
          BoxShadow(color: (isDark ? Colors.black : AppColors.primaryDark).withValues(alpha: 0.3), blurRadius: 12, offset: const Offset(0, 4)),
        ],
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: Colors.white.withValues(alpha: 0.2)),
            ),
            child: const Icon(FontAwesomeIcons.filter, color: Colors.white, size: 16),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Filters', style: TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.bold)),
                const SizedBox(height: 2),
                Text(
                  activeCount > 0 ? '$activeCount active' : '${_sections.length} available',
                  style: TextStyle(color: Colors.white.withValues(alpha: 0.75), fontSize: 12),
                ),
              ],
            ),
          ),
          if (activeCount > 0)
            GestureDetector(
              onTap: _clearAllFilters,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: Colors.white.withValues(alpha: 0.3)),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.refresh_rounded, color: Colors.white.withValues(alpha: 0.9), size: 14),
                    const SizedBox(width: 4),
                    Text('Reset', style: TextStyle(color: Colors.white.withValues(alpha: 0.95), fontSize: 12, fontWeight: FontWeight.w600)),
                  ],
                ),
              ),
            ),
          const SizedBox(width: 8),
          GestureDetector(
            onTap: () => Navigator.pop(context),
            child: Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.15), borderRadius: BorderRadius.circular(10)),
              child: const Icon(Icons.close_rounded, color: Colors.white, size: 20),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSidebar(bool isDark, Color accentColor) {
    return Container(
      width: 80,
      decoration: BoxDecoration(
        color: isDark ? AppColors.surfaceDark : Colors.grey[50],
        border: Border(right: BorderSide(color: isDark ? Colors.white10 : Colors.grey[200]!)),
      ),
      child: ListView.builder(
        padding: const EdgeInsets.symmetric(vertical: 8),
        itemCount: _sections.length,
        itemBuilder: (context, index) {
          final section = _sections[index];
          final isActive = _activeSection == index;
          final hasSelection = _sectionHasSelection(section);

          return InkWell(
            onTap: () {
              setState(() => _activeSection = index);
              HapticFeedback.selectionClick();
            },
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 10),
              margin: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
              decoration: BoxDecoration(
                color: isActive ? accentColor.withValues(alpha: isDark ? 0.2 : 0.1) : null,
                borderRadius: BorderRadius.circular(10),
                border: isActive ? Border.all(color: accentColor.withValues(alpha: 0.3)) : null,
              ),
              child: Column(
                children: [
                  Stack(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(
                          color: isActive ? accentColor.withValues(alpha: 0.2) : (isDark ? Colors.white.withValues(alpha: 0.05) : Colors.grey.withValues(alpha: 0.08)),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Icon(section.icon, size: 14, color: isActive ? accentColor : (isDark ? Colors.white54 : Colors.grey[600])),
                      ),
                      if (hasSelection)
                        Positioned(
                          top: 0,
                          right: 0,
                          child: Container(
                            width: 8,
                            height: 8,
                            decoration: BoxDecoration(
                              color: Colors.green,
                              shape: BoxShape.circle,
                              border: Border.all(color: isDark ? AppColors.surfaceDark : Colors.white, width: 1.5),
                            ),
                          ),
                        ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    section.title,
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 9,
                      fontWeight: isActive ? FontWeight.bold : FontWeight.w500,
                      color: isActive ? accentColor : (isDark ? Colors.white60 : Colors.grey[600]),
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
          ).animate(delay: (index * 25).ms).fadeIn();
        },
      ),
    );
  }

  Widget _buildLoadingState(Color accentColor) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          SizedBox(width: 32, height: 32, child: CircularProgressIndicator(strokeWidth: 3, valueColor: AlwaysStoppedAnimation(accentColor))),
          const SizedBox(height: 12),
          Text('Loading filters...', style: TextStyle(color: Colors.grey[500], fontSize: 12)),
        ],
      ),
    );
  }

  Widget _buildEmptyState(bool isDark) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.filter_list_off_rounded, size: 48, color: Colors.grey[400]),
          const SizedBox(height: 12),
          Text('No filters available', style: TextStyle(color: Colors.grey[500], fontSize: 14, fontWeight: FontWeight.w500)),
        ],
      ),
    );
  }

  bool _sectionHasSelection(_FilterSection section) {
    switch (section.type) {
      case _FilterType.price:
        return _priceRange.start > _minProductPrice || _priceRange.end < _maxProductPrice;
      case _FilterType.rating:
        return _selectedMinRating > 0;
      case _FilterType.discount:
        return _selectedMinDiscount > 0;
      case _FilterType.deals:
        return _dealsOnly;
      case _FilterType.attribute:
        return _attributeFilters[section.attributeKey]?.isNotEmpty ?? false;
    }
  }

  Widget _buildContent(bool isDark, Color accentColor) {
    if (_activeSection >= _sections.length) return const SizedBox();
    final section = _sections[_activeSection];

    return Align(
      alignment: Alignment.topLeft,
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(12, 12, 12, 16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Section Header
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              margin: const EdgeInsets.only(bottom: 12),
              decoration: BoxDecoration(
                color: accentColor.withValues(alpha: isDark ? 0.12 : 0.08),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(section.icon, color: accentColor, size: 12),
                  const SizedBox(width: 6),
                  Text(section.title, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: isDark ? Colors.white : Colors.black87)),
                ],
              ),
            ),
            // Content based on type
            _buildSectionContent(section, isDark, accentColor),
          ],
        ),
      ),
    );
  }

  Widget _buildSectionContent(_FilterSection section, bool isDark, Color accentColor) {
    switch (section.type) {
      case _FilterType.price:
        return _buildPriceSection(isDark, accentColor);
      case _FilterType.rating:
        return _buildRatingSection(isDark, accentColor);
      case _FilterType.discount:
        return _buildDiscountSection(isDark, accentColor);
      case _FilterType.deals:
        return _buildDealsSection(isDark, accentColor);
      case _FilterType.attribute:
        return _buildAttributeSection(section.attribute!, isDark, accentColor);
    }
  }

  Widget _buildPriceSection(bool isDark, Color accentColor) {
    // Ensure valid min/max
    final minPrice = _minProductPrice;
    final maxPrice = _maxProductPrice > minPrice ? _maxProductPrice : minPrice + 1000;
    
    // Ensure price range is within bounds for RangeSlider
    final safeStart = _priceRange.start.clamp(minPrice, maxPrice);
    final safeEnd = _priceRange.end.clamp(minPrice, maxPrice);
    final safeRange = RangeValues(
      safeStart, 
      safeEnd >= safeStart ? safeEnd : maxPrice,
    );
    
    final priceChips = [
      ('Under ₹500', 0.0, 500.0),
      ('₹500 - ₹1K', 500.0, 1000.0),
      ('₹1K - ₹5K', 1000.0, 5000.0),
      ('₹5K - ₹10K', 5000.0, 10000.0),
      ('₹10K+', 10000.0, maxPrice),
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Wrap(
          spacing: 6,
          runSpacing: 6,
          children: priceChips.map((chip) {
            final isSelected = _priceRange.start == chip.$2 && _priceRange.end == chip.$3;
            return _buildChip(chip.$1, isSelected, isDark, accentColor, () {
              setState(() => _priceRange = RangeValues(chip.$2, chip.$3.clamp(minPrice, maxPrice)));
            });
          }).toList(),
        ),
        const SizedBox(height: 16),
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: isDark ? Colors.white.withValues(alpha: 0.04) : Colors.grey[100],
            borderRadius: BorderRadius.circular(10),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Custom Range', style: TextStyle(fontWeight: FontWeight.w600, color: isDark ? Colors.white60 : Colors.grey[700], fontSize: 11)),
              const SizedBox(height: 10),
              RangeSlider(
                values: safeRange,
                min: minPrice,
                max: maxPrice,
                divisions: 20,
                activeColor: accentColor,
                inactiveColor: accentColor.withValues(alpha: 0.2),
                labels: RangeLabels('₹${safeRange.start.round()}', '₹${safeRange.end.round()}'),
                onChanged: (values) => setState(() => _priceRange = values),
              ),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  _priceLabel('₹${safeRange.start.round()}', accentColor),
                  Text('to', style: TextStyle(color: isDark ? Colors.white38 : Colors.grey[500], fontSize: 11)),
                  _priceLabel('₹${safeRange.end.round()}', accentColor),
                ],
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _priceLabel(String text, Color accentColor) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(color: accentColor.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(6)),
      child: Text(text, style: TextStyle(color: accentColor, fontWeight: FontWeight.bold, fontSize: 11)),
    );
  }

  Widget _buildRatingSection(bool isDark, Color accentColor) {
    return Column(
      children: [5, 4, 3, 2, 1].map((rating) {
        final isSelected = _selectedMinRating == rating;
        return InkWell(
          onTap: () {
            setState(() => _selectedMinRating = isSelected ? 0 : rating);
            HapticFeedback.selectionClick();
          },
          borderRadius: BorderRadius.circular(10),
          child: Container(
            padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 12),
            margin: const EdgeInsets.only(bottom: 6),
            decoration: BoxDecoration(
              color: isSelected ? accentColor.withValues(alpha: 0.12) : (isDark ? Colors.white.withValues(alpha: 0.04) : Colors.grey[100]),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: isSelected ? accentColor : Colors.transparent),
            ),
            child: Row(
              children: [
                ...List.generate(5, (i) => Icon(
                  i < rating ? Icons.star_rounded : Icons.star_outline_rounded,
                  color: Colors.amber,
                  size: 18,
                )),
                const SizedBox(width: 8),
                Text('& Up', style: TextStyle(color: isDark ? Colors.white60 : Colors.grey[600], fontSize: 12)),
                const Spacer(),
                if (isSelected) Icon(Icons.check_circle_rounded, color: accentColor, size: 18),
              ],
            ),
          ),
        );
      }).toList(),
    );
  }

  Widget _buildDiscountSection(bool isDark, Color accentColor) {
    // Sort available discounts descending
    final sortedDiscounts = _availableDiscounts.toList()..sort((a, b) => b.compareTo(a));

    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: sortedDiscounts.map((discount) {
        final isSelected = _selectedMinDiscount == discount;
        return _buildChip('$discount% off or more', isSelected, isDark, accentColor, () {
          setState(() => _selectedMinDiscount = isSelected ? 0 : discount);
        });
      }).toList(),
    );
  }

  Widget _buildDealsSection(bool isDark, Color accentColor) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: _dealsOnly ? AppColors.error.withValues(alpha: 0.1) : (isDark ? Colors.white.withValues(alpha: 0.04) : Colors.grey[100]),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: _dealsOnly ? AppColors.error : Colors.transparent),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: _dealsOnly 
                    ? [AppColors.error, const Color(0xFFDC2626)]
                    : [Colors.grey.withValues(alpha: 0.3), Colors.grey.withValues(alpha: 0.2)],
              ),
              borderRadius: BorderRadius.circular(10),
            ),
            child: const Text('🔥', style: TextStyle(fontSize: 16)),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Active Deals Only',
                  style: TextStyle(fontWeight: FontWeight.bold, color: isDark ? Colors.white : Colors.black87, fontSize: 14),
                ),
                Text(
                  'Show products with special deals',
                  style: TextStyle(color: isDark ? Colors.white54 : Colors.grey[600], fontSize: 11),
                ),
              ],
            ),
          ),
          Switch(
            value: _dealsOnly,
            onChanged: (v) {
              setState(() => _dealsOnly = v);
              HapticFeedback.selectionClick();
            },
            activeThumbColor: AppColors.error,
            activeTrackColor: AppColors.error.withValues(alpha: 0.3),
          ),
        ],
      ),
    );
  }

  Widget _buildAttributeSection(AttributeField attr, bool isDark, Color accentColor) {
    final productValues = _attributeValueCounts[attr.key] ?? {};
    List<String> allOptions = [];

    final sortedProductValues = productValues.entries.toList()..sort((a, b) => b.value.compareTo(a.value));
    allOptions.addAll(sortedProductValues.map((e) => e.key));

    for (final opt in attr.options) {
      if (!allOptions.contains(opt)) allOptions.add(opt);
    }

    if (allOptions.isEmpty) {
      return Container(
        padding: const EdgeInsets.all(20),
        child: Column(
          children: [
            Icon(Icons.inbox_outlined, size: 36, color: Colors.grey[400]),
            const SizedBox(height: 8),
            Text('No options available', style: TextStyle(color: Colors.grey[500], fontSize: 12)),
          ],
        ),
      );
    }

    _attributeFilters[attr.key] ??= {};

    return Wrap(
      spacing: 6,
      runSpacing: 6,
      children: allOptions.map((option) {
        final isSelected = _attributeFilters[attr.key]!.contains(option);
        final count = productValues[option] ?? 0;
        return _buildChipWithCount(option, count, isSelected, isDark, accentColor, () {
          setState(() {
            if (isSelected) {
              _attributeFilters[attr.key]!.remove(option);
            } else {
              _attributeFilters[attr.key]!.add(option);
            }
          });
        });
      }).toList(),
    );
  }

  Widget _buildChip(String label, bool isSelected, bool isDark, Color accentColor, VoidCallback onTap) {
    return GestureDetector(
      onTap: () {
        onTap();
        HapticFeedback.selectionClick();
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: isSelected ? accentColor.withValues(alpha: 0.15) : (isDark ? Colors.white.withValues(alpha: 0.05) : Colors.grey[100]),
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: isSelected ? accentColor : Colors.transparent, width: 1.5),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: isSelected ? accentColor : (isDark ? Colors.white70 : Colors.grey[700]),
            fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
            fontSize: 11,
          ),
        ),
      ),
    );
  }

  Widget _buildChipWithCount(String label, int count, bool isSelected, bool isDark, Color accentColor, VoidCallback onTap) {
    return GestureDetector(
      onTap: () {
        onTap();
        HapticFeedback.selectionClick();
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          color: isSelected ? accentColor.withValues(alpha: 0.15) : (isDark ? Colors.white.withValues(alpha: 0.05) : Colors.grey[100]),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: isSelected ? accentColor : Colors.transparent, width: 1.5),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(label, style: TextStyle(color: isSelected ? accentColor : (isDark ? Colors.white70 : Colors.grey[700]), fontWeight: isSelected ? FontWeight.bold : FontWeight.w500, fontSize: 11)),
            if (count > 0) ...[
              const SizedBox(width: 4),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                decoration: BoxDecoration(color: isSelected ? accentColor.withValues(alpha: 0.3) : (isDark ? Colors.white10 : Colors.grey[200]), borderRadius: BorderRadius.circular(8)),
                child: Text('$count', style: TextStyle(fontSize: 9, fontWeight: FontWeight.bold, color: isSelected ? accentColor : (isDark ? Colors.white54 : Colors.grey))),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildFooter(bool isDark, Color accentColor) {
    final activeCount = _getActiveFilterCount();

    return Container(
      padding: const EdgeInsets.fromLTRB(16, 10, 16, 14),
      decoration: BoxDecoration(
        color: isDark ? AppColors.surfaceDark : Colors.white,
        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.08), blurRadius: 12, offset: const Offset(0, -4))],
      ),
      child: SafeArea(
        top: false,
        child: SizedBox(
          height: 48,
          child: ElevatedButton(
            onPressed: _applyFilters,
            style: ElevatedButton.styleFrom(
              backgroundColor: accentColor,
              foregroundColor: Colors.white,
              elevation: 0,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.check_rounded, size: 18),
                const SizedBox(width: 8),
                Text(
                  activeCount > 0 ? 'Apply $activeCount Filter${activeCount > 1 ? 's' : ''}' : 'Apply Filters',
                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  int _getActiveFilterCount() {
    int count = 0;
    if (_priceRange.start > _minProductPrice || _priceRange.end < _maxProductPrice) count++;
    if (_selectedMinRating > 0) count++;
    if (_selectedMinDiscount > 0) count++;
    if (_dealsOnly) count++;
    for (final filters in _attributeFilters.values) {
      count += filters.length;
    }
    return count;
  }

  void _clearAllFilters() {
    setState(() {
      _priceRange = RangeValues(_minProductPrice, _maxProductPrice);
      _selectedMinRating = 0;
      _selectedMinDiscount = 0;
      _dealsOnly = false;
      _attributeFilters.clear();
    });
    HapticFeedback.mediumImpact();
  }

  void _applyFilters() {
    HapticFeedback.heavyImpact();
    final attrFilters = <String, List<String>>{};
    for (final entry in _attributeFilters.entries) {
      if (entry.value.isNotEmpty) attrFilters[entry.key] = entry.value.toList();
    }
    widget.onApply({
      'priceRange': _priceRange,
      'minRating': _selectedMinRating,
      'minDiscount': _selectedMinDiscount,
      'dealsOnly': _dealsOnly,
      'attributeFilters': attrFilters,
    });
    Navigator.pop(context);
  }
}

enum _FilterType { price, rating, discount, deals, attribute }

class _FilterSection {
  final String title;
  final IconData icon;
  final _FilterType type;
  final String? attributeKey;
  final AttributeField? attribute;

  _FilterSection({
    required this.title,
    required this.icon,
    required this.type,
    this.attributeKey,
    this.attribute,
  });
}