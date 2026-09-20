// lib/screens/admin/products/widgets/product_form.dart
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:letbuyy_services/letbuyy_services.dart';

class ProductForm extends StatefulWidget {
  final TextEditingController nameController;
  final TextEditingController priceController;
  final TextEditingController originalPriceController;
  final TextEditingController descriptionController;
  final String? selectedCategory;
  final String? selectedSubCategory;
  final String? selectedSubSubCategory; // ✅ NEW: 3rd level
  final bool isFeatured;
  final bool isVerified;
  final bool isTrending;
  final Function(String?) onCategoryChanged;
  final Function(String?) onSubCategoryChanged;
  final Function(String?)? onSubSubCategoryChanged; // ✅ NEW (Optional)
  final Function(bool?) onFeaturedChanged;
  final Function(bool?) onVerifiedChanged;
  final Function(bool?) onTrendingChanged;

  const ProductForm({
    super.key,
    required this.nameController,
    required this.priceController,
    required this.originalPriceController,
    required this.descriptionController,
    required this.selectedCategory,
    this.selectedSubCategory,
    this.selectedSubSubCategory,
    required this.isFeatured,
    required this.isVerified,
    required this.isTrending,
    required this.onCategoryChanged,
    required this.onSubCategoryChanged,
    this.onSubSubCategoryChanged,
    required this.onFeaturedChanged,
    required this.onVerifiedChanged,
    required this.onTrendingChanged,
  });

  @override
  State<ProductForm> createState() => _ProductFormState();
}

class _ProductFormState extends State<ProductForm> {
  @override
  Widget build(BuildContext context) {
    final themeProvider = Provider.of<ThemeProvider>(context);
    final isDark = themeProvider.isDarkMode;
    final accentColor = isDark ? AppColors.primaryLight : AppColors.primary;
    final inputFillColor =
        isDark ? const Color(0xFF2C2C2C) : Colors.grey.shade50;

    return ListView(
      padding: const EdgeInsets.all(16),
      addAutomaticKeepAlives: true,
      children: [
        // Header Section
        _buildSectionHeader(
          title: 'Product Information',
          icon: Icons.inventory_2_outlined,
          isDark: isDark,
          accentColor: accentColor,
        ),
        const SizedBox(height: 16),

        // Product Name
        _buildTextFormField(
          controller: widget.nameController,
          label: 'Product Name *',
          hint: 'e.g., Organic Fertilizer',
          icon: Icons.label_outline,
          isDark: isDark,
          fillColor: inputFillColor,
          validator: (v) =>
              v?.isEmpty ?? true ? 'Product name is required' : null,
        ),
        const SizedBox(height: 16),

        // Category Section Header
        _buildSectionHeader(
          title: 'Category',
          icon: Icons.category_outlined,
          isDark: isDark,
          accentColor: accentColor,
        ),
        const SizedBox(height: 12),

        // ========== LEVEL 1: Main Category ==========
        RepaintBoundary(
          child: Consumer<CategoryProvider>(
            builder: (context, categoryProvider, child) {
              final mainCategories = categoryProvider.mainCategories;

              if (mainCategories.isEmpty) {
                return Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: isDark
                        ? const Color(0xFF2C2C2C)
                        : Colors.grey.shade50,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color: isDark ? Colors.grey[700]! : Colors.grey[300]!,
                    ),
                  ),
                  child: Text(
                    'No categories available',
                    style: TextStyle(
                      color: isDark ? Colors.grey[400] : Colors.grey[600],
                    ),
                  ),
                );
              }

              // ✅ FIX: Check if selected category exists in the list
              final selectedCategoryExists = widget.selectedCategory == null ||
                  mainCategories.any((c) => c.id == widget.selectedCategory);
              final dropdownValue =
                  selectedCategoryExists ? widget.selectedCategory : null;

              return Padding(
                padding: const EdgeInsets.symmetric(horizontal: 0),
                child: SizedBox(
                  width: double.infinity,
                  height: 70,
                  child: DropdownButtonFormField<String>(
                    key: ValueKey('category_${widget.selectedCategory}'),
                    initialValue: dropdownValue,
                    decoration: InputDecoration(
                      labelText: 'Main Category *',
                      labelStyle: TextStyle(
                        color: isDark ? Colors.grey[400] : Colors.grey[600],
                        fontWeight: FontWeight.w600,
                      ),
                      hintText: 'Select a main category',
                      hintStyle: TextStyle(
                        color: isDark ? Colors.grey[600] : Colors.grey[400],
                      ),
                      prefixIcon: Icon(
                        Icons.layers_outlined,
                        color: isDark ? Colors.grey[400] : Colors.grey[600],
                      ),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: BorderSide(
                          color: isDark
                              ? Colors.grey[700]!
                              : Colors.grey[300]!,
                        ),
                      ),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: BorderSide(
                          color: isDark
                              ? Colors.grey[700]!
                              : Colors.grey[300]!,
                        ),
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: BorderSide(
                          color: accentColor,
                          width: 2,
                        ),
                      ),
                      filled: true,
                      fillColor: inputFillColor,
                      contentPadding: const EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 16,
                      ),
                    ),
                    dropdownColor: isDark
                        ? const Color(0xFF2C2C2C)
                        : Colors.white,
                    style: TextStyle(
                      color: isDark ? Colors.white : Colors.black87,
                      fontSize: 14,
                      fontWeight: FontWeight.w500,
                    ),
                    items: mainCategories
                        .map((cat) => DropdownMenuItem(
                              value: cat.id,
                              child: Text(
                                cat.name,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ))
                        .toList(),
                    onChanged: (categoryId) {
                      widget.onCategoryChanged(categoryId);
                    },
                    validator: (v) =>
                        v == null ? 'Main category is required' : null,
                    isExpanded: true,
                  ),
                ),
              );
            },
          ),
        ),
        const SizedBox(height: 16),

        // ========== LEVEL 2: Sub Category ==========
        if (widget.selectedCategory != null)
          RepaintBoundary(
            child: Consumer<CategoryProvider>(
              builder: (context, categoryProvider, child) {
                final subCategories = categoryProvider
                    .getSubCategories(widget.selectedCategory!);

                if (subCategories.isEmpty) {
                  return Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: isDark
                          ? const Color(0xFF2C2C2C)
                          : Colors.grey.shade50,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                        color: isDark
                            ? Colors.grey[700]!
                            : Colors.grey[300]!,
                      ),
                    ),
                    child: Text(
                      'No subcategories available',
                      style: TextStyle(
                        color: isDark
                            ? Colors.grey[400]
                            : Colors.grey[600],
                        fontSize: 13,
                      ),
                    ),
                  )
                      .animate()
                      .fadeIn(duration: 300.ms)
                      .slideY(begin: -0.1, end: 0);
                }

                // ✅ FIX: Check if selected subcategory exists
                final selectedSubExists = widget.selectedSubCategory == null ||
                    widget.selectedSubCategory == '' ||
                    subCategories
                        .any((c) => c.id == widget.selectedSubCategory);
                final dropdownSubValue =
                    selectedSubExists ? (widget.selectedSubCategory ?? '') : '';

                return Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 0),
                  child: SizedBox(
                    width: double.infinity,
                    height: 70,
                    child: DropdownButtonFormField<String>(
                      key: ValueKey(
                          'subcategory_${widget.selectedSubCategory}'),
                      initialValue: dropdownSubValue,
                      decoration: InputDecoration(
                        labelText: 'Subcategory',
                        labelStyle: TextStyle(
                          color: isDark
                              ? Colors.grey[400]
                              : Colors.grey[600],
                          fontWeight: FontWeight.w600,
                        ),
                        hintText: 'Select a subcategory',
                        hintStyle: TextStyle(
                          color: isDark
                              ? Colors.grey[600]
                              : Colors.grey[400],
                        ),
                        prefixIcon: Icon(
                          Icons.subdirectory_arrow_right,
                          color: isDark
                              ? Colors.grey[400]
                              : Colors.grey[600],
                        ),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                          borderSide: BorderSide(
                            color: isDark
                                ? Colors.grey[700]!
                                : Colors.grey[300]!,
                          ),
                        ),
                        enabledBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                          borderSide: BorderSide(
                            color: isDark
                                ? Colors.grey[700]!
                                : Colors.grey[300]!,
                          ),
                        ),
                        focusedBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                          borderSide: BorderSide(
                            color: accentColor,
                            width: 2,
                          ),
                        ),
                        filled: true,
                        fillColor: inputFillColor,
                        contentPadding: const EdgeInsets.symmetric(
                          horizontal: 12,
                          vertical: 16,
                        ),
                      ),
                      dropdownColor: isDark
                          ? const Color(0xFF2C2C2C)
                          : Colors.white,
                      style: TextStyle(
                        color: isDark
                            ? Colors.white
                            : Colors.black87,
                        fontSize: 14,
                        fontWeight: FontWeight.w500,
                      ),
                      items: [
                        DropdownMenuItem(
                          value: '',
                          child: Text(
                            'None',
                            style: TextStyle(
                              color: isDark
                                  ? Colors.grey[500]
                                  : Colors.grey[600],
                              fontStyle: FontStyle.italic,
                            ),
                          ),
                        ),
                        ...subCategories
                            .map((cat) => DropdownMenuItem(
                                  value: cat.id,
                                  child: Text(
                                    cat.name,
                                    overflow:
                                        TextOverflow.ellipsis,
                                  ),
                                ))
                            ,
                      ],
                      onChanged: (value) {
                        widget.onSubCategoryChanged(
                            value == null || value.isEmpty
                                ? null
                                : value);
                      },
                      isExpanded: true,
                    ),
                  ),
                )
                    .animate()
                    .fadeIn(duration: 300.ms)
                    .slideY(begin: -0.1, end: 0);
              },
            ),
          ),
        const SizedBox(height: 16),

        // ========== LEVEL 3: Sub-Sub Category (NEW) ==========
        if (widget.selectedSubCategory != null &&
            widget.selectedSubCategory!.isNotEmpty)
          RepaintBoundary(
            child: Consumer<CategoryProvider>(
              builder: (context, categoryProvider, child) {
                final subSubCategories = categoryProvider
                    .getSubCategories(widget.selectedSubCategory!);

                if (subSubCategories.isEmpty) {
                  return Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: isDark
                          ? const Color(0xFF2C2C2C)
                          : Colors.grey.shade50,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                        color: isDark
                            ? Colors.grey[700]!
                            : Colors.grey[300]!,
                      ),
                    ),
                    child: Text(
                      'No sub-subcategories available',
                      style: TextStyle(
                        color: isDark
                            ? Colors.grey[400]
                            : Colors.grey[600],
                        fontSize: 13,
                      ),
                    ),
                  )
                      .animate()
                      .fadeIn(duration: 300.ms)
                      .slideY(begin: -0.1, end: 0);
                }

                // ✅ FIX: Check if selected subsubcategory exists
                final selectedSubSubExists =
                    widget.selectedSubSubCategory == null ||
                        widget.selectedSubSubCategory == '' ||
                        subSubCategories.any(
                            (c) => c.id == widget.selectedSubSubCategory);
                final dropdownSubSubValue = selectedSubSubExists
                    ? (widget.selectedSubSubCategory ?? '')
                    : '';

                return Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 0),
                  child: SizedBox(
                    width: double.infinity,
                    height: 70,
                    child: DropdownButtonFormField<String>(
                      key: ValueKey(
                          'subsubcategory_${widget.selectedSubSubCategory}'),
                      initialValue: dropdownSubSubValue,
                      decoration: InputDecoration(
                        labelText: 'Sub-Subcategory',
                        labelStyle: TextStyle(
                          color: isDark
                              ? Colors.grey[400]
                              : Colors.grey[600],
                          fontWeight: FontWeight.w600,
                        ),
                        hintText: 'Select a sub-subcategory',
                        hintStyle: TextStyle(
                          color: isDark
                              ? Colors.grey[600]
                              : Colors.grey[400],
                        ),
                        prefixIcon: Icon(
                          Icons.category_rounded,
                          color: isDark
                              ? Colors.grey[400]
                              : Colors.grey[600],
                        ),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                          borderSide: BorderSide(
                            color: isDark
                                ? Colors.grey[700]!
                                : Colors.grey[300]!,
                          ),
                        ),
                        enabledBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                          borderSide: BorderSide(
                            color: isDark
                                ? Colors.grey[700]!
                                : Colors.grey[300]!,
                          ),
                        ),
                        focusedBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                          borderSide: BorderSide(
                            color: accentColor,
                            width: 2,
                          ),
                        ),
                        filled: true,
                        fillColor: inputFillColor,
                        contentPadding: const EdgeInsets.symmetric(
                          horizontal: 12,
                          vertical: 16,
                        ),
                      ),
                      dropdownColor: isDark
                          ? const Color(0xFF2C2C2C)
                          : Colors.white,
                      style: TextStyle(
                        color: isDark
                            ? Colors.white
                            : Colors.black87,
                        fontSize: 14,
                        fontWeight: FontWeight.w500,
                      ),
                      items: [
                        DropdownMenuItem(
                          value: '',
                          child: Text(
                            'None',
                            style: TextStyle(
                              color: isDark
                                  ? Colors.grey[500]
                                  : Colors.grey[600],
                              fontStyle: FontStyle.italic,
                            ),
                          ),
                        ),
                        ...subSubCategories
                            .map((cat) => DropdownMenuItem(
                                  value: cat.id,
                                  child: Text(
                                    cat.name,
                                    overflow:
                                        TextOverflow.ellipsis,
                                  ),
                                ))
                            ,
                      ],
                      onChanged: (value) {
                        if (widget.onSubSubCategoryChanged != null) {
                          widget.onSubSubCategoryChanged!(
                              value == null || value.isEmpty
                                  ? null
                                  : value);
                        }
                      },
                      isExpanded: true,
                    ),
                  ),
                )
                    .animate()
                    .fadeIn(duration: 300.ms)
                    .slideY(begin: -0.1, end: 0);
              },
            ),
          ),
        const SizedBox(height: 24),

        // Pricing Section Header
        _buildSectionHeader(
          title: 'Pricing',
          icon: Icons.local_offer_outlined,
          isDark: isDark,
          accentColor: accentColor,
        ),
        const SizedBox(height: 12),

        _buildTextFormField(
          controller: widget.priceController,
          label: 'Sale Price (₹) *',
          hint: '100',
          icon: Icons.currency_rupee,
          isDark: isDark,
          fillColor: inputFillColor,
          keyboardType: TextInputType.number,
          validator: (v) {
            if (v?.isEmpty ?? true) return 'Required';
            if (double.tryParse(v!) == null) return 'Invalid';
            return null;
          },
        ),
        const SizedBox(height: 16),
        _buildTextFormField(
          controller: widget.originalPriceController,
          label: 'Original Price (₹)',
          hint: '150',
          icon: Icons.money_off,
          isDark: isDark,
          fillColor: inputFillColor,
          keyboardType: TextInputType.number,
          validator: (v) {
            if (v != null &&
                v.isNotEmpty &&
                double.tryParse(v) == null) {
              return 'Invalid price';
            }
            return null;
          },
        ),
        const SizedBox(height: 24),

        // Description Section Header
        _buildSectionHeader(
          title: 'Details',
          icon: Icons.description_outlined,
          isDark: isDark,
          accentColor: accentColor,
        ),
        const SizedBox(height: 12),

        _buildTextFormField(
          controller: widget.descriptionController,
          label: 'Description *',
          hint: 'Detailed product description...',
          icon: Icons.description_outlined,
          isDark: isDark,
          fillColor: inputFillColor,
          maxLines: 5,
          validator: (v) =>
              v?.isEmpty ?? true ? 'Description is required' : null,
        ),
        const SizedBox(height: 24),

        // Visibility Section Header
        _buildSectionHeader(
          title: 'Visibility & Badges',
          icon: Icons.visibility_outlined,
          isDark: isDark,
          accentColor: accentColor,
        ),
        const SizedBox(height: 12),

        _buildToggleCard(
          title: 'Featured Product',
          subtitle: 'Show on homepage and get better visibility',
          value: widget.isFeatured,
          onChanged: widget.onFeaturedChanged,
          icon: Icons.star_rounded,
          color: AppColors.warning,
          isDark: isDark,
        ),
        const SizedBox(height: 12),

        _buildToggleCard(
          title: 'Verified Product',
          subtitle: 'Show a "Verified by LetBuyy" badge',
          value: widget.isVerified,
          onChanged: widget.onVerifiedChanged,
          icon: Icons.verified_user_rounded,
          color: Colors.blue,
          isDark: isDark,
        ),
        const SizedBox(height: 12),

        _buildToggleCard(
          title: 'Trending Product',
          subtitle: 'Show a "Trending" badge',
          value: widget.isTrending,
          onChanged: widget.onTrendingChanged,
          icon: Icons.local_fire_department_rounded,
          color: Colors.red,
          isDark: isDark,
        ),
        const SizedBox(height: 32),
      ],
    );
  }

  Widget _buildSectionHeader({
    required String title,
    required IconData icon,
    required bool isDark,
    required Color accentColor,
  }) {
    return Row(
      children: [
        Container(
          width: 4,
          height: 24,
          decoration: BoxDecoration(
            color: accentColor,
            borderRadius: BorderRadius.circular(2),
          ),
        ),
        const SizedBox(width: 12),
        Icon(
          icon,
          size: 20,
          color: accentColor,
        ),
        const SizedBox(width: 8),
        Text(
          title,
          style: TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.bold,
            color: isDark ? Colors.white : Colors.black87,
          ),
        ),
      ],
    );
  }

  Widget _buildTextFormField({
    required TextEditingController controller,
    required String label,
    required String hint,
    required IconData icon,
    required bool isDark,
    required Color fillColor,
    int maxLines = 1,
    TextInputType? keyboardType,
    String? Function(String?)? validator,
  }) {
    return TextFormField(
      controller: controller,
      decoration: InputDecoration(
        labelText: label,
        labelStyle: TextStyle(
          color: isDark ? Colors.grey[400] : Colors.grey[600],
          fontWeight: FontWeight.w600,
        ),
        hintText: hint,
        hintStyle: TextStyle(
          color: isDark ? Colors.grey[600] : Colors.grey[400],
        ),
        prefixIcon: Icon(
          icon,
          color: isDark ? Colors.grey[400] : Colors.grey[600],
        ),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(
            color: isDark ? Colors.grey[700]! : Colors.grey[300]!,
          ),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(
            color: isDark ? Colors.grey[700]! : Colors.grey[300]!,
          ),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(
            color: isDark ? AppColors.primaryLight : AppColors.primary,
            width: 2,
          ),
        ),
        filled: true,
        fillColor: fillColor,
        alignLabelWithHint: maxLines > 1,
      ),
      style: TextStyle(
        color: isDark ? Colors.white : Colors.black,
        fontSize: 14,
      ),
      maxLines: maxLines,
      keyboardType: keyboardType,
      validator: validator,
      textCapitalization: TextCapitalization.sentences,
    );
  }

  Widget _buildToggleCard({
    required String title,
    required String subtitle,
    required bool value,
    required Function(bool?) onChanged,
    required IconData icon,
    required Color color,
    required bool isDark,
  }) {
    return Container(
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1E1E1E) : Colors.white,
        border: Border.all(
          color: value
              ? color.withValues(alpha: 0.5)
              : (isDark ? Colors.grey[800]! : Colors.grey.shade300),
          width: value ? 2 : 1,
        ),
        borderRadius: BorderRadius.circular(12),
        boxShadow: value
            ? [
                BoxShadow(
                  color: color.withValues(alpha: 0.15),
                  blurRadius: 8,
                  offset: const Offset(0, 2),
                )
              ]
            : null,
      ),
      child: SwitchListTile(
        title: Text(
          title,
          style: TextStyle(
            fontWeight: FontWeight.bold,
            color: isDark ? Colors.white : Colors.black87,
            fontSize: 14,
          ),
        ),
        subtitle: Text(
          subtitle,
          style: TextStyle(
            fontSize: 12,
            color: isDark ? Colors.grey[400] : Colors.grey[600],
          ),
        ),
        value: value,
        onChanged: onChanged,
        activeThumbColor: color,
        secondary: Container(
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(
            color: value ? color.withValues(alpha: 0.2) : Colors.transparent,
            borderRadius: BorderRadius.circular(8),
          ),
          child: Icon(
            icon,
            color: value ? color : (isDark ? Colors.grey[600] : Colors.grey),
            size: 20,
          ),
        ),
      ),
    );
  }
}