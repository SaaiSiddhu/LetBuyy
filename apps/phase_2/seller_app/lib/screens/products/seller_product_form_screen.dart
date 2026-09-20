// lib/screens/products/seller_product_form_screen.dart
// Advanced, responsive product add/edit system with stepper wizard (Ported from Admin)

import 'dart:io';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_storage/firebase_storage.dart';
import 'package:image_picker/image_picker.dart';
import 'package:uuid/uuid.dart';

import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:letbuyy_models/letbuyy_models.dart';
import 'package:letbuyy_services/letbuyy_services.dart';
import 'package:letbuyy_core/letbuyy_core.dart';
import '../../providers/seller_provider.dart';
import '../../services/hsn_gst_service.dart';
import '../../services/product_draft_service.dart';
import 'widgets/dynamic_attribute_form_widget.dart';
import 'widgets/product_shipping_details_widget.dart';
import 'widgets/earnings_calculator_widget.dart';
import 'widgets/quality_checks_widget.dart';

class SellerProductFormScreen extends StatefulWidget {
  final ProductModel? product; // Optional product for edit mode
  
  const SellerProductFormScreen({super.key, this.product});

  @override
  State<SellerProductFormScreen> createState() => _SellerProductFormScreenState();
}

class _SellerProductFormScreenState extends State<SellerProductFormScreen> with TickerProviderStateMixin {
  final _formKey = GlobalKey<FormState>();
  final _firestore = FirebaseFirestore.instance;
  final _picker = ImagePicker();
  
  // Edit mode
  bool get _isEditMode => widget.product != null;
  
  // Step tracking
  int _currentStep = 0;
  bool _isLoading = false;
  bool _isUploading = false;
  double _uploadProgress = 0.0;
  int _currentImageIndex = 0;
  int _totalImages = 0;
  
  // Basic Info Controllers
  final _nameController = TextEditingController();
  final _descController = TextEditingController();
  final _priceController = TextEditingController();
  final _originalPriceController = TextEditingController();
  final _stockController = TextEditingController(text: '0');
  final _costPriceController = TextEditingController();
  
  // Category
  String? _selectedCategory;
  String? _selectedSubCategory;
  String? _selectedSubSubCategory;
  
  // Toggles
  bool _isFeatured = false;
  bool _isVerified = false;
  bool _isTrending = false;
  bool _isFreeDelivery = false;
  bool _expressDelivery = false;
  bool _codAvailable = true;
  final bool _returnable = true;
  final bool _exchangeable = true;
  String _returnPolicy = 'both'; // 'return', 'exchange', 'both'
  double _expressDeliveryPrice = 99;
  final bool _showMobilePreview = false;
  
  // Images
  final List<String> _images = [];
  
  // Shipping
  final _shippingDaysController = TextEditingController(text: '3-5');
  final _shippingPriceController = TextEditingController(text: '0');
  final _returnDaysController = TextEditingController(text: '7');
  final _weightController = TextEditingController(text: '0.5');
  final _lengthController = TextEditingController();
  final _widthController = TextEditingController();
  final _heightController = TextEditingController();
  
  // Specifications
  final Map<String, String> _specifications = {};
  final _specKeyController = TextEditingController();
  final _specValueController = TextEditingController();
  
  // Variants
  final List<ProductVariant> _variants = [];
  final List<VariantOption> _variantOptions = [];
  final _optionNameController = TextEditingController();
  
  // Seller ID (auto-detected from SellerProvider)
  String? _sellerId;
  
  // ✅ NEW: Keywords for search (max 3)
  final List<String> _keywords = [];
  final _keywordController = TextEditingController();

  // ✅ NEW: Dynamic Category Attributes (for faceted search)
  Map<String, dynamic> _productAttributes = {};
  Map<String, dynamic>? _pendingProductAttributes;

  // ✅ NEW: HSN/GST fields
  final _hsnCodeController = TextEditingController();
  double _gstRate = 18.0;
  GstRateInfo? _gstInfo;
  String? _draftId;
  
  // ✅ NEW: Compliance fields
  final _manufacturerController = TextEditingController();
  final _countryOfOriginController = TextEditingController(text: 'India');

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      Provider.of<CategoryProvider>(context, listen: false).loadCategories();
      // Auto-detect seller ID
      final sellerProvider = Provider.of<SellerProvider>(context, listen: false);
      _sellerId = sellerProvider.sellerId;
      
      if (_isEditMode) {
        _initProductData();
      }
    });
  }

  void _initProductData() {
    final p = widget.product!;
    
    // Basic Info
    _nameController.text = p.name;
    _descController.text = p.description;
    _priceController.text = p.salePrice.toString();
    _originalPriceController.text = p.originalPrice?.toString() ?? '';
    _stockController.text = p.stock.toString();
    
    // Category
    _selectedCategory = p.categoryId;
    _selectedSubCategory = p.subCategoryId;
    
    // Seller (use product's sellerId for edit mode)
    _sellerId = p.sellerId;
    
    // Images
    _images.addAll(p.images);
    
    // Toggles
    _isFeatured = p.isFeatured;
    _isTrending = p.isTrending;
    _isVerified = p.isVerified;
    
    // Shipping
    _shippingDaysController.text = p.shippingDays ?? '3-5';
    _shippingPriceController.text = (p.shippingPrice ?? 0).toString();
    _isFreeDelivery = p.isFreeDelivery ?? false;
    _expressDelivery = p.expressDelivery ?? false;
    
    // Specifications
    if (p.specifications != null) {
      _specifications.addAll(p.specifications!);
    }
    
    // Variants
    _variantOptions.addAll(p.variantOptions);
    _variants.addAll(p.variants);
    
    // ✅ NEW: Keywords
    _keywords.addAll(p.keywords);
    
    // ✅ NEW: Load product attributes
    _productAttributes = Map.from(p.attributes);
    _pendingProductAttributes = p.pendingAttributes != null 
        ? Map.from(p.pendingAttributes!) 
        : null;
    
    setState(() {});
  }

  @override
  void dispose() {
    _nameController.dispose();
    _descController.dispose();
    _priceController.dispose();
    _originalPriceController.dispose();
    _stockController.dispose();
    _costPriceController.dispose();
    _shippingDaysController.dispose();
    _shippingPriceController.dispose();
    _returnDaysController.dispose();
    _weightController.dispose();
    _lengthController.dispose();
    _widthController.dispose();
    _heightController.dispose();
    _specKeyController.dispose();
    _specValueController.dispose();
    _optionNameController.dispose();
    _keywordController.dispose();
    super.dispose();
  }

  // Calculate profit margin
  double get _profitMargin {
    final salePrice = double.tryParse(_priceController.text) ?? 0;
    final costPrice = double.tryParse(_costPriceController.text) ?? 0;
    if (salePrice <= 0 || costPrice <= 0) return 0;
    return ((salePrice - costPrice) / salePrice) * 100;
  }

  double get _profit {
    final salePrice = double.tryParse(_priceController.text) ?? 0;
    final costPrice = double.tryParse(_costPriceController.text) ?? 0;
    return salePrice - costPrice;
  }

  double get _discountPercent {
    final salePrice = double.tryParse(_priceController.text) ?? 0;
    final originalPrice = double.tryParse(_originalPriceController.text) ?? 0;
    if (originalPrice <= 0 || salePrice <= 0) return 0;
    return ((originalPrice - salePrice) / originalPrice) * 100;
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Provider.of<ThemeProvider>(context).isDarkMode;
    final width = MediaQuery.of(context).size.width;
    final isDesktop = width > 1100;
    final isTablet = width > 700 && width <= 1100;
    
    final accentColor = isDark ? AppColors.primaryLight : AppColors.primary;
    final bgColor = isDark ? const Color(0xFF121212) : const Color(0xFFF5F7FA);
    final cardColor = isDark ? const Color(0xFF1E1E1E) : Colors.white;

    return Scaffold(
      backgroundColor: bgColor,
      appBar: _buildAppBar(isDark, accentColor),
      body: SafeArea(
        child: isDesktop 
            ? _buildDesktopLayout(isDark, accentColor, cardColor)
            : _buildMobileLayout(isDark, accentColor, cardColor, isTablet),
      ),
    );
  }

  PreferredSizeWidget _buildAppBar(bool isDark, Color accentColor) {
    final steps = ['Basic Info', 'Images', 'Pricing & Stock', 'Specs & Variants', 'Shipping'];
    return AppBar(
      backgroundColor: isDark ? const Color(0xFF1E1E1E) : Colors.white,
      elevation: 0,
      leading: IconButton(
        icon: Icon(Icons.close_rounded, color: isDark ? Colors.white : Colors.black87),
        onPressed: () => Navigator.pop(context),
      ),
      title: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text(_isEditMode ? 'Edit Product' : 'Add New Product',
                style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18,
                  color: isDark ? Colors.white : Colors.black87)),
              if (_isEditMode) ...[
                const SizedBox(width: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(
                    color: Colors.orange.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: const Text('EDITING', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.orange)),
                ),
              ],
            ],
          ),
          Text('${steps[_currentStep]} (${_currentStep + 1}/${steps.length})',
            style: TextStyle(fontSize: 12, color: isDark ? Colors.white54 : Colors.black45)),
        ],
      ),
      actions: [
        if (_currentStep > 0)
          TextButton(
            onPressed: () => setState(() => _currentStep--),
            child: Text('Back', style: TextStyle(color: accentColor)),
          ),
        const SizedBox(width: 8),
        FilledButton(
          onPressed: _isLoading ? null : (_currentStep < 4 ? _nextStep : _submitProduct),
          style: FilledButton.styleFrom(backgroundColor: accentColor),
          child: _isLoading
              ? const SizedBox(width: 20, height: 20, 
                  child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
              : Text(_currentStep < 4 ? 'Next' : (_isEditMode ? 'Update' : 'Publish')),
        ),
        const SizedBox(width: 16),
      ],
    );
  }

  // Desktop: Side preview + Content
  Widget _buildDesktopLayout(bool isDark, Color accentColor, Color cardColor) {
    return Row(
      children: [
        // Side Preview Panel
        Container(
          width: 340,
          color: cardColor,
          child: Column(
            children: [
              const SizedBox(height: 24),
              _buildStepProgress(isDark, accentColor),
              const Divider(height: 32),
              Expanded(child: _buildProductPreviewCard(isDark, cardColor)),
              const SizedBox(height: 24),
            ],
          ),
        ),
        Container(width: 1, color: isDark ? Colors.white12 : Colors.black12),
        Expanded(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(32),
            child: Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 800),
                child: _buildStepContent(isDark, accentColor, cardColor),
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildMobileLayout(bool isDark, Color accentColor, Color cardColor, bool isTablet) {
    return Column(
      children: [
        _buildProgressBar(accentColor),
        // Mobile Preview Button - Opens fullscreen dialog
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          child: InkWell(
            onTap: () => _showPreviewDialog(isDark, cardColor),
            child: Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: accentColor.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(
                children: [
                  Icon(Icons.visibility, color: accentColor, size: 20),
                  const SizedBox(width: 8),
                  Text('Preview Product', style: TextStyle(color: accentColor, fontWeight: FontWeight.bold)),
                  const Spacer(),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(color: accentColor, borderRadius: BorderRadius.circular(6)),
                    child: const Text('LIVE', style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold)),
                  ),
                ],
              ),
            ),
          ),
        ),
        Expanded(
          child: SingleChildScrollView(
            padding: EdgeInsets.all(isTablet ? 24 : 16),
            child: _buildStepContent(isDark, accentColor, cardColor),
          ),
        ),
      ],
    );
  }

  void _showPreviewDialog(bool isDark, Color cardColor) {
    showDialog(
      context: context,
      useSafeArea: false,
      builder: (ctx) => Dialog.fullscreen(
        backgroundColor: isDark ? const Color(0xFF121212) : const Color(0xFFF5F7FA),
        child: Scaffold(
          backgroundColor: isDark ? const Color(0xFF121212) : const Color(0xFFF5F7FA),
          appBar: AppBar(
            backgroundColor: isDark ? const Color(0xFF1E1E1E) : Colors.white,
            leading: IconButton(
              icon: Icon(Icons.close, color: isDark ? Colors.white : Colors.black87),
              onPressed: () => Navigator.pop(ctx),
            ),
            title: Text('Product Preview', style: TextStyle(color: isDark ? Colors.white : Colors.black87)),
            actions: [
              Container(
                margin: const EdgeInsets.only(right: 16),
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(color: Colors.green.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(20)),
                child: Row(children: [
                  Icon(Icons.circle, color: Colors.green, size: 8),
                  const SizedBox(width: 6),
                  Text('Live Preview', style: TextStyle(color: Colors.green, fontSize: 12, fontWeight: FontWeight.bold)),
                ]),
              ),
            ],
          ),
          body: SingleChildScrollView(
            padding: const EdgeInsets.all(16),
            child: _buildFullPreviewContent(isDark, cardColor),
          ),
        ),
      ),
    );
  }

  Widget _buildFullPreviewContent(bool isDark, Color cardColor) {
    final salePrice = double.tryParse(_priceController.text) ?? 0;
    final originalPrice = double.tryParse(_originalPriceController.text) ?? 0;
    
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Product Card
        Container(
          decoration: BoxDecoration(
            color: cardColor,
            borderRadius: BorderRadius.circular(20),
            boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.1), blurRadius: 20)],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Image Gallery
              AspectRatio(
                aspectRatio: 1,
                child: Container(
                  decoration: BoxDecoration(
                    color: isDark ? Colors.grey[800] : Colors.grey[200],
                    borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
                    image: _images.isNotEmpty ? DecorationImage(image: NetworkImage(_images.first), fit: BoxFit.cover) : null,
                  ),
                  child: Stack(
                    children: [
                      if (_images.isEmpty) const Center(child: Icon(Icons.image_outlined, size: 64, color: Colors.grey)),
                      // Badges
                      Positioned(top: 12, left: 12, child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        if (_isFeatured) _buildBadge('⭐ Featured', Colors.amber),
                        if (_isTrending) _buildBadge('🔥 Trending', Colors.red),
                        if (_isVerified) _buildBadge('✓ Verified', Colors.blue),
                        if (_discountPercent > 0) _buildBadge('${_discountPercent.toInt()}% OFF', Colors.green),
                      ])),
                      // Image count
                      if (_images.length > 1)
                        Positioned(bottom: 12, right: 12, child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                          decoration: BoxDecoration(color: Colors.black54, borderRadius: BorderRadius.circular(20)),
                          child: Text('1/${_images.length}', style: const TextStyle(color: Colors.white, fontSize: 12)),
                        )),
                    ],
                  ),
                ),
              ),
              
              // Product Info
              Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(_nameController.text.isEmpty ? 'Product Name' : _nameController.text, style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: isDark ? Colors.white : Colors.black87)),
                    const SizedBox(height: 12),
                    Row(children: [
                      Text('₹${salePrice.toStringAsFixed(0)}', style: TextStyle(color: AppColors.primary, fontWeight: FontWeight.bold, fontSize: 24)),
                      if (originalPrice > salePrice) ...[
                        const SizedBox(width: 12),
                        Text('₹${originalPrice.toStringAsFixed(0)}', style: const TextStyle(color: Colors.grey, decoration: TextDecoration.lineThrough, fontSize: 16)),
                      ],
                    ]),
                    const SizedBox(height: 16),
                    
                    // Quick Info
                    Row(children: [
                      _buildInfoChip(Icons.inventory_2, '${_stockController.text} in stock', Colors.blue, isDark),
                      const SizedBox(width: 8),
                      if (_isFreeDelivery) _buildInfoChip(Icons.local_shipping, 'Free Delivery', Colors.green, isDark),
                      if (_expressDelivery) _buildInfoChip(Icons.flash_on, 'Express', Colors.orange, isDark),
                    ]),
                  ],
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 20),
        
        // Description
        if (_descController.text.isNotEmpty)
          _buildPreviewSection('Description', _descController.text, Icons.description, isDark, cardColor),
        
        // Specifications
        if (_specifications.isNotEmpty)
          _buildPreviewSection('Specifications', '', Icons.list_alt, isDark, cardColor, 
            child: Column(children: _specifications.entries.map((e) => Padding(
              padding: const EdgeInsets.symmetric(vertical: 4),
              child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                Text(e.key, style: TextStyle(color: Colors.grey)),
                Text(e.value, style: TextStyle(fontWeight: FontWeight.w600, color: isDark ? Colors.white : Colors.black87)),
              ]),
            )).toList()),
          ),
        
        // Shipping
        _buildPreviewSection('Delivery', '', Icons.local_shipping, isDark, cardColor,
          child: Column(children: [
            Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
              const Text('Delivery', style: TextStyle(color: Colors.grey)),
              Text(_isFreeDelivery ? 'FREE' : '₹${_shippingPriceController.text}', style: TextStyle(fontWeight: FontWeight.bold, color: _isFreeDelivery ? Colors.green : (isDark ? Colors.white : Colors.black87))),
            ]),
            if (_expressDelivery) Padding(padding: const EdgeInsets.only(top: 4), child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
              const Text('Express (1-2 days)', style: TextStyle(color: Colors.grey)),
              Text('₹${_expressDeliveryPrice.toInt()}', style: TextStyle(fontWeight: FontWeight.bold, color: Colors.orange)),
            ])),
            Padding(padding: const EdgeInsets.only(top: 4), child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
              const Text('Return/Exchange', style: TextStyle(color: Colors.grey)),
              Text('${_returnDaysController.text} days', style: TextStyle(fontWeight: FontWeight.bold, color: isDark ? Colors.white : Colors.black87)),
            ])),
          ]),
        ),
      ],
    );
  }

  Widget _buildInfoChip(IconData icon, String text, Color color, bool isDark) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(color: color.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(20)),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        Icon(icon, color: color, size: 14),
        const SizedBox(width: 4),
        Text(text, style: TextStyle(color: color, fontSize: 12, fontWeight: FontWeight.bold)),
      ]),
    );
  }

  Widget _buildPreviewSection(String title, String content, IconData icon, bool isDark, Color cardColor, {Widget? child}) {
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: cardColor, borderRadius: BorderRadius.circular(16)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Icon(icon, size: 18, color: AppColors.primary),
          const SizedBox(width: 8),
          Text(title, style: TextStyle(fontWeight: FontWeight.bold, color: isDark ? Colors.white : Colors.black87)),
        ]),
        const SizedBox(height: 12),
        child ?? Text(content, style: TextStyle(color: isDark ? Colors.white70 : Colors.black54)),
      ]),
    );
  }

  Widget _buildProgressBar(Color accentColor) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Row(
        children: List.generate(5, (i) {
          final isActive = i == _currentStep;
          final isComplete = i < _currentStep;
          return Expanded(
            child: Container(
              height: 6,
              margin: const EdgeInsets.symmetric(horizontal: 3),
              decoration: BoxDecoration(
                color: isComplete ? accentColor : (isActive ? accentColor.withValues(alpha: 0.5) : Colors.grey[300]),
                borderRadius: BorderRadius.circular(3),
              ),
            ),
          );
        }),
      ),
    );
  }

  Widget _buildStepProgress(bool isDark, Color accentColor) {
    final steps = [
      ('Basic Info', Icons.info_outline),
      ('Images', Icons.image_outlined),
      ('Pricing', Icons.attach_money),
      ('Specs', Icons.list_alt),
      ('Shipping', Icons.local_shipping_outlined),
    ];
    
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Column(
        children: steps.asMap().entries.map((e) {
          final i = e.key;
          final step = e.value;
          final isActive = i == _currentStep;
          final isComplete = i < _currentStep;
          
          return InkWell(
            onTap: () => setState(() => _currentStep = i),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              margin: const EdgeInsets.only(bottom: 4),
              decoration: BoxDecoration(
                color: isActive ? accentColor.withValues(alpha: 0.1) : Colors.transparent,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Row(
                children: [
                  Container(
                    width: 28, height: 28,
                    decoration: BoxDecoration(
                      color: isComplete ? accentColor : (isActive ? accentColor : Colors.grey[300]),
                      shape: BoxShape.circle,
                    ),
                    child: Icon(
                      isComplete ? Icons.check : step.$2,
                      size: 14,
                      color: isComplete || isActive ? Colors.white : Colors.grey[600],
                    ),
                  ),
                  const SizedBox(width: 12),
                  Text(step.$1, style: TextStyle(
                    fontWeight: isActive ? FontWeight.bold : FontWeight.normal,
                    color: isActive ? accentColor : (isDark ? Colors.white70 : Colors.black54),
                    fontSize: 13,
                  )),
                ],
              ),
            ),
          );
        }).toList(),
      ),
    );
  }

  // ==================== PRODUCT PREVIEW CARD ====================
  Widget _buildProductPreviewCard(bool isDark, Color cardColor) {
    final salePrice = double.tryParse(_priceController.text) ?? 0;
    final originalPrice = double.tryParse(_originalPriceController.text) ?? 0;
    
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Live Preview', style: TextStyle(fontWeight: FontWeight.bold,
              color: isDark ? Colors.white : Colors.black87)),
          const SizedBox(height: 12),
          
          // Product Card Preview
          Container(
            decoration: BoxDecoration(
              color: isDark ? Colors.grey[900] : Colors.white,
              borderRadius: BorderRadius.circular(16),
              boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.1), blurRadius: 10)],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Image
                AspectRatio(
                  aspectRatio: 1,
                  child: Container(
                    decoration: BoxDecoration(
                      color: isDark ? Colors.grey[800] : Colors.grey[200],
                      borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
                      image: _images.isNotEmpty
                          ? DecorationImage(image: NetworkImage(_images.first), fit: BoxFit.cover)
                          : null,
                    ),
                    child: Stack(
                      children: [
                        if (_images.isEmpty)
                          Center(child: Icon(Icons.image_outlined, size: 48, color: Colors.grey)),
                        // Badges
                        Positioned(
                          top: 8, left: 8,
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              if (_isFeatured)
                                _buildBadge('⭐ Featured', Colors.amber),
                              if (_isTrending)
                                _buildBadge('🔥 Trending', Colors.red),
                              if (_isVerified)
                                _buildBadge('✓ Verified', Colors.blue),
                              if (_discountPercent > 0)
                                _buildBadge('${_discountPercent.toInt()}% OFF', Colors.green),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                
                // Details
                Padding(
                  padding: const EdgeInsets.all(12),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        _nameController.text.isEmpty ? 'Product Name' : _nameController.text,
                        style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14,
                            color: isDark ? Colors.white : Colors.black87),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 8),
                      Row(
                        children: [
                          Text('₹${salePrice.toStringAsFixed(0)}',
                            style: TextStyle(color: AppColors.primary, fontWeight: FontWeight.bold, fontSize: 16)),
                          if (originalPrice > salePrice) ...[
                            const SizedBox(width: 8),
                            Text('₹${originalPrice.toStringAsFixed(0)}',
                              style: TextStyle(color: Colors.grey, decoration: TextDecoration.lineThrough, fontSize: 12)),
                          ],
                        ],
                      ),
                      const SizedBox(height: 8),
                      Row(
                        children: [
                          Icon(Icons.inventory_2, size: 14, color: Colors.grey),
                          const SizedBox(width: 4),
                          Text('${_stockController.text} in stock', style: TextStyle(color: Colors.grey, fontSize: 12)),
                          const Spacer(),
                          if (_isFreeDelivery) ...[
                            Icon(Icons.local_shipping, size: 14, color: Colors.green),
                            const SizedBox(width: 4),
                            Text('Free', style: TextStyle(color: Colors.green, fontSize: 12)),
                          ],
                        ],
                      ),
                      if (_specifications.isNotEmpty) ...[
                        const SizedBox(height: 12),
                        const Divider(),
                        ...(_specifications.entries.take(3).map((e) =>
                          Padding(
                            padding: const EdgeInsets.symmetric(vertical: 2),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text(e.key, style: TextStyle(color: Colors.grey, fontSize: 11)),
                                Text(e.value, style: TextStyle(color: isDark ? Colors.white70 : Colors.black54, fontSize: 11)),
                              ],
                            ),
                          ),
                        )),
                      ],
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBadge(String text, Color color) {
    return Container(
      margin: const EdgeInsets.only(bottom: 4),
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(4)),
      child: Text(text, style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold)),
    );
  }

  Widget _buildStepContent(bool isDark, Color accentColor, Color cardColor) {
    switch (_currentStep) {
      case 0: return _buildBasicInfoStep(isDark, accentColor, cardColor);
      case 1: return _buildImagesStep(isDark, accentColor, cardColor);
      case 2: return _buildPricingStep(isDark, accentColor, cardColor);
      case 3: return _buildSpecsVariantsStep(isDark, accentColor, cardColor);
      case 4: return _buildShippingStep(isDark, accentColor, cardColor);
      default: return const SizedBox();
    }
  }

  // ==================== STEP 1: Basic Info ====================
  Widget _buildBasicInfoStep(bool isDark, Color accentColor, Color cardColor) {
    return Form(
      key: _formKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildStepHeader('Basic Information', 'Product name, category & description', Icons.info_outline, isDark),
          const SizedBox(height: 24),
          
          _buildCard(isDark: isDark, cardColor: cardColor, child: _buildTextField(
            controller: _nameController,
            label: 'Product Name *',
            hint: 'e.g., Organic Fertilizer Premium',
            icon: Icons.inventory_2_outlined,
            isDark: isDark,
            validator: (v) => v?.isEmpty ?? true ? 'Required' : null,
            onChanged: (_) => setState(() {}),
          )),
          const SizedBox(height: 16),
          
          _buildCard(
            isDark: isDark, cardColor: cardColor,
            child: Consumer<CategoryProvider>(
              builder: (ctx, provider, _) {
                final categories = provider.mainCategories;
                return Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Category *', style: TextStyle(fontWeight: FontWeight.bold, 
                        color: isDark ? Colors.white : Colors.black87)),
                    const SizedBox(height: 12),
                    DropdownButtonFormField<String>(
                      initialValue: _selectedCategory,
                      decoration: _inputDecoration('Select Category', Icons.category_outlined, isDark),
                      items: categories.map((c) => DropdownMenuItem(value: c.id, child: Text(c.name))).toList(),
                      onChanged: (v) => setState(() { _selectedCategory = v; _selectedSubCategory = null; _selectedSubSubCategory = null; }),
                      validator: (v) => v == null ? 'Required' : null,
                    ),
                    if (_selectedCategory != null && provider.getSubCategories(_selectedCategory!).isNotEmpty) ...[
                      const SizedBox(height: 12),
                      DropdownButtonFormField<String>(
                        initialValue: _selectedSubCategory,
                        decoration: _inputDecoration('Subcategory', Icons.subdirectory_arrow_right, isDark),
                        items: provider.getSubCategories(_selectedCategory!).map((c) => 
                            DropdownMenuItem(value: c.id, child: Text(c.name))).toList(),
                        onChanged: (v) => setState(() { _selectedSubCategory = v; _selectedSubSubCategory = null; }),
                      ),
                    ],
                    if (_selectedSubCategory != null && provider.getSubCategories(_selectedSubCategory!).isNotEmpty) ...[
                      const SizedBox(height: 12),
                      DropdownButtonFormField<String>(
                        initialValue: _selectedSubSubCategory,
                        decoration: _inputDecoration('Sub-subcategory', Icons.account_tree_outlined, isDark),
                        items: provider.getSubCategories(_selectedSubCategory!).map((c) => 
                            DropdownMenuItem(value: c.id, child: Text(c.name))).toList(),
                        onChanged: (v) => setState(() => _selectedSubSubCategory = v),
                      ),
                    ],
                  ],
                );
              },
            ),
          ),
          const SizedBox(height: 16),
          
          _buildCard(isDark: isDark, cardColor: cardColor, child: _buildTextField(
            controller: _descController,
            label: 'Description *',
            hint: 'Describe your product in detail...',
            icon: Icons.description_outlined,
            isDark: isDark,
            maxLines: 4,
            validator: (v) => v?.isEmpty ?? true ? 'Required' : null,
          )),
          const SizedBox(height: 16),
          
          // ✅ NEW: Keywords Input (max 3)
          _buildCard(
            isDark: isDark, cardColor: cardColor,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Icon(Icons.tag, size: 20, color: isDark ? AppColors.primaryLight : AppColors.primary),
                    const SizedBox(width: 8),
                    Text('Search Keywords', style: TextStyle(fontWeight: FontWeight.bold, color: isDark ? Colors.white : Colors.black87)),
                    const Spacer(),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: _keywords.length >= 3 ? Colors.orange.withValues(alpha: 0.1) : Colors.green.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Text(
                        '${_keywords.length}/3',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                          color: _keywords.length >= 3 ? Colors.orange : Colors.green,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Text(
                  'Add up to 3 keywords to help customers find your product',
                  style: TextStyle(fontSize: 12, color: Colors.grey),
                ),
                const SizedBox(height: 12),
                
                // Keyword chips
                if (_keywords.isNotEmpty)
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: _keywords.map((keyword) => Chip(
                      label: Text(keyword),
                      labelStyle: TextStyle(
                        color: isDark ? Colors.white : AppColors.primary,
                        fontWeight: FontWeight.w500,
                      ),
                      backgroundColor: isDark ? AppColors.primary.withValues(alpha: 0.2) : AppColors.primary.withValues(alpha: 0.1),
                      deleteIcon: Icon(Icons.close, size: 16, color: isDark ? Colors.white70 : AppColors.primary),
                      onDeleted: () => setState(() => _keywords.remove(keyword)),
                    )).toList(),
                  ),
                if (_keywords.isNotEmpty) const SizedBox(height: 12),
                
                // Add keyword input
                if (_keywords.length < 3)
                  Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: _keywordController,
                          decoration: InputDecoration(
                            hintText: 'e.g., organic, fertilizer, garden',
                            hintStyle: TextStyle(color: Colors.grey[400], fontSize: 14),
                            filled: true,
                            fillColor: isDark ? Colors.grey[800] : Colors.grey[100],
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(12),
                              borderSide: BorderSide.none,
                            ),
                            contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                          ),
                          style: TextStyle(color: isDark ? Colors.white : Colors.black87),
                          textCapitalization: TextCapitalization.words,
                          onSubmitted: (value) {
                            if (value.trim().isNotEmpty && _keywords.length < 3) {
                              setState(() {
                                _keywords.add(value.trim().toLowerCase());
                                _keywordController.clear();
                              });
                            }
                          },
                        ),
                      ),
                      const SizedBox(width: 8),
                      IconButton(
                        onPressed: () {
                          final value = _keywordController.text.trim();
                          if (value.isNotEmpty && _keywords.length < 3) {
                            setState(() {
                              _keywords.add(value.toLowerCase());
                              _keywordController.clear();
                            });
                          }
                        },
                        icon: Container(
                          padding: const EdgeInsets.all(8),
                          decoration: BoxDecoration(
                            color: isDark ? AppColors.primaryLight : AppColors.primary,
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: const Icon(Icons.add, color: Colors.white, size: 20),
                        ),
                      ),
                    ],
                  ),
              ],
            ),
          ),

        ],
      ).animate().fadeIn(duration: 300.ms),
    );
  }

  // ==================== STEP 2: Media (Images & Videos) ====================
  Widget _buildImagesStep(bool isDark, Color accentColor, Color cardColor) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _buildStepHeader('Product Media', 'Upload images and videos', Icons.perm_media_outlined, isDark),
        const SizedBox(height: 24),
        
        // Upload Zone Card
        _buildCard(
          isDark: isDark, cardColor: cardColor,
          child: Column(
            children: [
              // Drag & Drop Zone
              InkWell(
                onTap: _isUploading ? null : _pickMultipleImages,
                borderRadius: BorderRadius.circular(16),
                child: Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(32),
                  decoration: BoxDecoration(
                    color: accentColor.withValues(alpha: 0.05),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: accentColor.withValues(alpha: 0.3), width: 2, style: BorderStyle.solid),
                  ),
                  child: Column(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: accentColor.withValues(alpha: 0.1),
                          shape: BoxShape.circle,
                        ),
                        child: Icon(Icons.cloud_upload_outlined, size: 40, color: accentColor),
                      ),
                      const SizedBox(height: 16),
                      Text('Drop files here or click to upload', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: isDark ? Colors.white : Colors.black87)),
                      const SizedBox(height: 8),
                      Text('PNG, JPG, WEBP up to 10MB each', style: TextStyle(color: Colors.grey, fontSize: 12)),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16),
              
              // Upload Options
              Row(
                children: [
                  Expanded(child: _buildUploadOption(Icons.photo_library, 'Gallery', 'Pick images', accentColor, isDark, _pickMultipleImages)),
                  const SizedBox(width: 12),
                  Expanded(child: _buildUploadOption(Icons.camera_alt, 'Camera', 'Take photo', Colors.orange, isDark, _pickSingleImage)),
                  const SizedBox(width: 12),
                  Expanded(child: _buildUploadOption(Icons.link, 'URL', 'Paste link', Colors.blue, isDark, _showUrlInputDialog)),
                ],
              ),
              
              // Upload Progress
              if (_isUploading) ...[
                const SizedBox(height: 16),
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: accentColor.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: accentColor.withValues(alpha: 0.3)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          SizedBox(
                            width: 24,
                            height: 24,
                            child: CircularProgressIndicator(
                              value: _uploadProgress,
                              strokeWidth: 3,
                              backgroundColor: accentColor.withValues(alpha: 0.2),
                              valueColor: AlwaysStoppedAnimation<Color>(accentColor),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  _totalImages > 1
                                      ? 'Uploading image $_currentImageIndex of $_totalImages...'
                                      : 'Uploading image...',
                                  style: TextStyle(color: accentColor, fontWeight: FontWeight.bold),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  '${(_uploadProgress * 100).toStringAsFixed(0)}% complete',
                                  style: TextStyle(color: Colors.grey, fontSize: 12),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      ClipRRect(
                        borderRadius: BorderRadius.circular(4),
                        child: LinearProgressIndicator(
                          value: _uploadProgress,
                          minHeight: 6,
                          backgroundColor: accentColor.withValues(alpha: 0.2),
                          valueColor: AlwaysStoppedAnimation<Color>(accentColor),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ],
          ),
        ),
        const SizedBox(height: 16),
        
        // Media Gallery
        if (_images.isNotEmpty)
          _buildCard(
            isDark: isDark, cardColor: cardColor,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(children: [
                      Icon(Icons.photo_library, color: accentColor, size: 20),
                      const SizedBox(width: 8),
                      Text('Media Gallery', style: TextStyle(fontWeight: FontWeight.bold, color: isDark ? Colors.white : Colors.black87)),
                    ]),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(color: accentColor.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(12)),
                      child: Text('${_images.length} file(s)', style: TextStyle(color: accentColor, fontWeight: FontWeight.bold, fontSize: 12)),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                Text('Drag to reorder • First image is the main cover', style: TextStyle(color: Colors.grey, fontSize: 12)),
                const SizedBox(height: 16),
                ReorderableListView.builder(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  buildDefaultDragHandles: false,
                  itemCount: _images.length,
                  onReorder: (oldIndex, newIndex) {
                    setState(() {
                      if (oldIndex < newIndex) newIndex--;
                      final item = _images.removeAt(oldIndex);
                      _images.insert(newIndex, item);
                    });
                  },
                  itemBuilder: (ctx, i) => _buildMediaTile(_images[i], i, isDark, accentColor),
                ),
              ],
            ),
          )
        else
          _buildCard(
            isDark: isDark, cardColor: cardColor,
            child: Container(
              padding: const EdgeInsets.all(32),
              child: Column(
                children: [
                  Icon(Icons.image_not_supported_outlined, size: 48, color: Colors.grey[400]),
                  const SizedBox(height: 12),
                  Text('No media uploaded yet', style: TextStyle(color: Colors.grey, fontWeight: FontWeight.w500)),
                  const SizedBox(height: 4),
                  Text('Upload at least 1 image to continue', style: TextStyle(color: Colors.grey[400], fontSize: 12)),
                ],
              ),
            ),
          ),
      ],
    ).animate().fadeIn(duration: 300.ms);
  }

  Widget _buildUploadOption(IconData icon, String title, String subtitle, Color color, bool isDark, VoidCallback onTap) {
    return InkWell(
      onTap: _isUploading ? null : onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: color.withValues(alpha: 0.3)),
        ),
        child: Column(
          children: [
            Icon(icon, color: color, size: 24),
            const SizedBox(height: 6),
            Text(title, style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: color)),
            Text(subtitle, style: TextStyle(fontSize: 10, color: Colors.grey)),
          ],
        ),
      ),
    );
  }

  Widget _buildMediaTile(String url, int index, bool isDark, Color accentColor) {
    final isVideo = url.contains('.mp4') || url.contains('.mov') || url.contains('video');
    return Container(
      key: ValueKey(url),
      margin: const EdgeInsets.only(bottom: 8),
      decoration: BoxDecoration(
        color: isDark ? Colors.black26 : Colors.grey[50],
        borderRadius: BorderRadius.circular(12),
        border: index == 0 ? Border.all(color: accentColor, width: 2) : null,
      ),
      child: Row(
        children: [
          // Drag Handle
          ReorderableDragStartListener(
            index: index,
            child: Container(
              padding: const EdgeInsets.all(12),
              child: Icon(Icons.drag_handle, color: Colors.grey),
            ),
          ),
          // Thumbnail
          Container(
            width: 60, height: 60,
            margin: const EdgeInsets.symmetric(vertical: 8),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(8),
              image: DecorationImage(image: NetworkImage(url), fit: BoxFit.cover),
            ),
            child: isVideo ? Container(
              decoration: BoxDecoration(color: Colors.black45, borderRadius: BorderRadius.circular(8)),
              child: const Icon(Icons.play_circle_outline, color: Colors.white, size: 24),
            ) : null,
          ),
          const SizedBox(width: 12),
          // Info
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    if (index == 0) Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      margin: const EdgeInsets.only(right: 6),
                      decoration: BoxDecoration(color: accentColor, borderRadius: BorderRadius.circular(4)),
                      child: const Text('MAIN', style: TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.bold)),
                    ),
                    Icon(isVideo ? Icons.videocam : Icons.image, size: 14, color: Colors.grey),
                    const SizedBox(width: 4),
                    Text(isVideo ? 'Video' : 'Image', style: TextStyle(color: Colors.grey, fontSize: 12)),
                  ],
                ),
                Text('media_${index + 1}', style: TextStyle(fontWeight: FontWeight.w500, color: isDark ? Colors.white70 : Colors.black54, fontSize: 13)),
              ],
            ),
          ),
          // Actions
          IconButton(icon: const Icon(Icons.delete_outline, color: Colors.red), onPressed: () => setState(() => _images.removeAt(index))),
        ],
      ),
    );
  }

  void _showUrlInputDialog() {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final controller = TextEditingController();
    final accentColor = AppColors.primary;
    
    showGeneralDialog(
      context: context,
      barrierDismissible: true,
      barrierLabel: 'URL Dialog',
      transitionDuration: const Duration(milliseconds: 200),
      pageBuilder: (ctx, anim1, anim2) => Container(),
      transitionBuilder: (ctx, anim1, anim2, child) {
        return ScaleTransition(
          scale: CurvedAnimation(parent: anim1, curve: Curves.easeOutBack),
          child: Dialog(
            backgroundColor: isDark ? const Color(0xFF1E1E1E) : Colors.white,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
            child: Container(
              width: 400,
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  // Header
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      gradient: LinearGradient(colors: [accentColor.withValues(alpha: 0.2), Colors.blue.withValues(alpha: 0.1)]),
                      shape: BoxShape.circle,
                    ),
                    child: Icon(Icons.link, color: accentColor, size: 32),
                  ),
                  const SizedBox(height: 16),
                  Text('Add Media from URL', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 20, color: isDark ? Colors.white : Colors.black87)),
                  const SizedBox(height: 8),
                  Text('Paste an image or video URL', style: TextStyle(color: Colors.grey, fontSize: 14)),
                  const SizedBox(height: 24),
                  
                  // Input
                  TextField(
                    controller: controller,
                    autofocus: true,
                    style: TextStyle(color: isDark ? Colors.white : Colors.black87),
                    decoration: InputDecoration(
                      labelText: 'Media URL',
                      hintText: 'https://example.com/image.jpg',
                      prefixIcon: Icon(Icons.link, color: accentColor),
                      filled: true,
                      fillColor: isDark ? Colors.black26 : Colors.grey[100],
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                      focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: accentColor, width: 2)),
                    ),
                  ),
                  const SizedBox(height: 24),
                  
                  // Buttons
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton(
                          onPressed: () => Navigator.pop(ctx),
                          style: OutlinedButton.styleFrom(padding: const EdgeInsets.symmetric(vertical: 14), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))),
                          child: const Text('Cancel'),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: FilledButton(
                          onPressed: () {
                            if (controller.text.trim().isNotEmpty) {
                              setState(() => _images.add(controller.text.trim()));
                              Navigator.pop(ctx);
                            }
                          },
                          style: FilledButton.styleFrom(padding: const EdgeInsets.symmetric(vertical: 14), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))),
                          child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                            const Icon(Icons.add, size: 18),
                            const SizedBox(width: 6),
                            const Text('Add Media'),
                          ]),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }

  Future<void> _pickSingleImage() async {
    try {
      final XFile? image = await _picker.pickImage(source: ImageSource.gallery, maxWidth: 1920, imageQuality: 85);
      if (image == null) return;
      setState(() => _isUploading = true);
      final url = await _uploadImage(image);
      if (url != null) setState(() => _images.add(url));
    } finally {
      setState(() => _isUploading = false);
    }
  }

  Future<void> _pickMultipleImages() async {
    try {
      final List<XFile> images = await _picker.pickMultiImage(maxWidth: 1920, imageQuality: 85);
      if (images.isEmpty) return;
      setState(() {
        _isUploading = true;
        _uploadProgress = 0.0;
        _currentImageIndex = 0;
        _totalImages = images.length;
      });
      for (int i = 0; i < images.length; i++) {
        setState(() {
          _currentImageIndex = i + 1;
          _uploadProgress = 0.0;
        });
        final url = await _uploadImage(images[i]);
        if (url != null) setState(() => _images.add(url));
      }
    } finally {
      setState(() {
        _isUploading = false;
        _uploadProgress = 0.0;
        _currentImageIndex = 0;
        _totalImages = 0;
      });
    }
  }

  Future<String?> _uploadImage(XFile image) async {
    try {
      final fileName = '${const Uuid().v4()}.jpg';
      final ref = FirebaseStorage.instance.ref().child('products').child(fileName);
      UploadTask task;
      if (kIsWeb) {
        final bytes = await image.readAsBytes();
        task = ref.putData(bytes, SettableMetadata(contentType: 'image/jpeg'));
      } else {
        task = ref.putFile(File(image.path));
      }
      
      // ✅ Track upload progress organically - shows real 0% → 10% → 30% etc.
      task.snapshotEvents.listen(
        (TaskSnapshot snapshot) {
          if (snapshot.totalBytes > 0 && mounted) {
            final progress = snapshot.bytesTransferred / snapshot.totalBytes;
            // Only update if progress changed by at least 1%
            if ((progress - _uploadProgress).abs() >= 0.01 || progress >= 1.0) {
              setState(() => _uploadProgress = progress);
              debugPrint('📤 Upload: ${(progress * 100).toStringAsFixed(0)}% (${snapshot.bytesTransferred}/${snapshot.totalBytes} bytes)');
            }
          }
        },
        onError: (e) => debugPrint('❌ Upload error: $e'),
      );
      
      // Wait for upload completion
      final snap = await task;
      
      // Ensure we show 100% complete
      if (mounted) {
        setState(() => _uploadProgress = 1.0);
      }
      
      return await snap.ref.getDownloadURL();
    } catch (e) {
      if (mounted) SnackbarHelper.showError(context, 'Upload failed: $e');
      return null;
    }
  }

  // ==================== STEP 3: Pricing ====================
  Widget _buildPricingStep(bool isDark, Color accentColor, Color cardColor) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _buildStepHeader('Pricing & Inventory', 'Set prices and manage stock', Icons.attach_money, isDark),
        const SizedBox(height: 24),
        
        // Profit Margin Calculator
        _buildCard(
          isDark: isDark, cardColor: cardColor,
          child: Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [accentColor.withValues(alpha: 0.1), accentColor.withValues(alpha: 0.05)],
              ),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Column(
              children: [
                Row(
                  children: [
                    Icon(Icons.calculate, color: accentColor),
                    const SizedBox(width: 8),
                    Text('Profit Calculator', style: TextStyle(fontWeight: FontWeight.bold, color: accentColor)),
                  ],
                ),
                const SizedBox(height: 16),
                Row(
                  children: [
                    Expanded(child: _buildMetricBox('Profit', '₹${_profit.toStringAsFixed(0)}', _profit >= 0 ? Colors.green : Colors.red, isDark)),
                    const SizedBox(width: 12),
                    Expanded(child: _buildMetricBox('Margin', '${_profitMargin.toStringAsFixed(1)}%', _profitMargin >= 20 ? Colors.green : Colors.orange, isDark)),
                    const SizedBox(width: 12),
                    Expanded(child: _buildMetricBox('Discount', '${_discountPercent.toStringAsFixed(0)}%', Colors.blue, isDark)),
                  ],
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 16),
        
        _buildCard(
          isDark: isDark, cardColor: cardColor,
          child: Column(
            children: [
              Row(
                children: [
                  Expanded(child: _buildTextField(
                    controller: _costPriceController,
                    label: 'Cost Price (₹)',
                    hint: '500',
                    icon: Icons.money,
                    isDark: isDark,
                    keyboardType: TextInputType.number,
                    onChanged: (_) => setState(() {}),
                  )),
                  const SizedBox(width: 16),
                  Expanded(child: _buildTextField(
                    controller: _priceController,
                    label: 'Sale Price (₹) *',
                    hint: '999',
                    icon: Icons.currency_rupee,
                    isDark: isDark,
                    keyboardType: TextInputType.number,
                    validator: (v) => v?.isEmpty ?? true ? 'Required' : null,
                    onChanged: (_) => setState(() {}),
                  )),
                ],
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(child: _buildTextField(
                    controller: _originalPriceController,
                    label: 'Original Price (₹)',
                    hint: '1299',
                    icon: Icons.money_off_outlined,
                    isDark: isDark,
                    keyboardType: TextInputType.number,
                    onChanged: (_) => setState(() {}),
                  )),
                  const SizedBox(width: 16),
                  Expanded(child: _buildTextField(
                    controller: _stockController,
                    label: 'Stock *',
                    hint: '100',
                    icon: Icons.inventory_outlined,
                    isDark: isDark,
                    keyboardType: TextInputType.number,
                    validator: (v) => v?.isEmpty ?? true ? 'Required' : null,
                    onChanged: (_) => setState(() {}),
                  )),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        
        // HSN Code & GST
        _buildCard(
          isDark: isDark, cardColor: cardColor,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(Icons.receipt_long, color: accentColor, size: 18),
                  const SizedBox(width: 8),
                  Text('Tax Details', style: TextStyle(fontWeight: FontWeight.bold, color: isDark ? Colors.white : Colors.black87)),
                ],
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(child: _buildTextField(
                    controller: _hsnCodeController,
                    label: 'HSN Code *',
                    hint: '85171290',
                    icon: Icons.numbers,
                    isDark: isDark,
                    keyboardType: TextInputType.number,
                    onChanged: (value) async {
                      if (value.length >= 4) {
                        final info = await HsnGstService.lookupHsn(value);
                        setState(() {
                          _gstInfo = info;
                          _gstRate = info.gstRate;
                        });
                      }
                    },
                  )),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: isDark ? Colors.white.withValues(alpha: 0.05) : Colors.grey.shade100,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: isDark ? Colors.white12 : Colors.grey.shade300),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('GST Rate', style: TextStyle(fontSize: 12, color: Colors.grey)),
                          const SizedBox(height: 4),
                          Text('${_gstRate.toInt()}%', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: accentColor)),
                          if (_gstInfo != null)
                            Text(_gstInfo!.isExempt ? 'EXEMPT' : 'TAXABLE', style: TextStyle(fontSize: 10, color: _gstInfo!.isExempt ? Colors.green : Colors.orange)),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        
        // Earnings Calculator Widget
        EarningsCalculatorWidget(
          sellingPrice: double.tryParse(_priceController.text) ?? 0,
          gstRate: _gstRate,
          isDark: isDark,
        ),
        const SizedBox(height: 16),
        
        // Note: Product badges (Featured, Verified, Trending) are set by Admin only
        // Sellers can request these badges through their dashboard
      ],
    ).animate().fadeIn(duration: 300.ms);
  }

  Widget _buildMetricBox(String label, String value, Color color, bool isDark) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: isDark ? Colors.black26 : Colors.white,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Column(
        children: [
          Text(value, style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18, color: color)),
          Text(label, style: TextStyle(fontSize: 11, color: Colors.grey)),
        ],
      ),
    );
  }

  // ==================== STEP 4: Specs & Variants ====================
  Widget _buildSpecsVariantsStep(bool isDark, Color accentColor, Color cardColor) {
    // Preset specifications
    final Map<String, List<String>> presetSpecs = {
      'Weight': ['100g', '250g', '500g', '1kg', '2kg', '5kg'],
      'Material': ['Cotton', 'Polyester', 'Leather', 'Metal', 'Plastic', 'Wood'],
      'Dimensions': ['10x10cm', '20x20cm', '30x30cm', 'Custom'],
      'Brand': <String>[],
      'Model': <String>[],
      'Warranty': ['6 months', '1 year', '2 years', '3 years'],
      'Country': ['India', 'China', 'USA', 'Japan', 'Korea'],
    };
    
    // Preset variant options
    final Map<String, List<String>> presetVariants = {
      'Size': ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'],
      'Color': ['Red', 'Blue', 'Green', 'Black', 'White', 'Yellow', 'Pink', 'Orange', 'Purple', 'Grey'],
      'Style': ['Regular', 'Slim Fit', 'Oversized', 'Cropped'],
      'Capacity': ['250ml', '500ml', '1L', '2L', '5L'],
      'Pack Size': ['Single', 'Pack of 2', 'Pack of 3', 'Pack of 5', 'Pack of 10'],
    };
    
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _buildStepHeader('Specifications & Variants', 'Add product details and options', Icons.list_alt, isDark),
        const SizedBox(height: 24),
        
        // ✅ NEW: Dynamic Category Attributes
        _buildCard(
          isDark: isDark, cardColor: cardColor,
          child: DynamicAttributeFormWidget(
            categoryId: _selectedCategory,
            attributes: _productAttributes,
            pendingAttributes: _pendingProductAttributes,
            sellerId: _sellerId,
            isDark: isDark,
            onChanged: (attrs, pending) {
              setState(() {
                _productAttributes = attrs;
                _pendingProductAttributes = pending;
              });
            },
          ),
        ),
        const SizedBox(height: 16),
        
        // Quick Add Specifications
        _buildCard(
          isDark: isDark, cardColor: cardColor,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(children: [
                Icon(Icons.fact_check, color: accentColor, size: 20),
                const SizedBox(width: 8),
                Text('Product Specifications', style: TextStyle(fontWeight: FontWeight.bold, color: isDark ? Colors.white : Colors.black87)),
              ]),
              const SizedBox(height: 8),
              Text('Quick add from presets or enter custom values', style: TextStyle(color: Colors.grey, fontSize: 12)),
              const SizedBox(height: 16),
              
              // Preset Quick Add
              Wrap(
                spacing: 8, runSpacing: 8,
                children: presetSpecs.keys.map((key) => ActionChip(
                  avatar: Icon(Icons.add, size: 16, color: _specifications.containsKey(key) ? Colors.grey : accentColor),
                  label: Text(key),
                  backgroundColor: _specifications.containsKey(key) ? Colors.grey.withValues(alpha: 0.2) : accentColor.withValues(alpha: 0.1),
                  onPressed: _specifications.containsKey(key) ? null : () => _showSpecValuePicker(key, presetSpecs[key]!, isDark),
                )).toList(),
              ),
              const SizedBox(height: 16),
              
              // Custom Input Row
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: isDark ? Colors.black26 : Colors.grey[100],
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Custom Specification', style: TextStyle(fontWeight: FontWeight.w500, fontSize: 12, color: Colors.grey)),
                    const SizedBox(height: 8),
                    Row(children: [
                      Expanded(child: TextField(
                        controller: _specKeyController,
                        decoration: InputDecoration(
                          hintText: 'Name',
                          filled: true,
                          fillColor: isDark ? Colors.black26 : Colors.white,
                          border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: BorderSide.none),
                          contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                        ),
                        style: TextStyle(color: isDark ? Colors.white : Colors.black87),
                      )),
                      const SizedBox(width: 8),
                      Expanded(child: TextField(
                        controller: _specValueController,
                        decoration: InputDecoration(
                          hintText: 'Value',
                          filled: true,
                          fillColor: isDark ? Colors.black26 : Colors.white,
                          border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: BorderSide.none),
                          contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                        ),
                        style: TextStyle(color: isDark ? Colors.white : Colors.black87),
                      )),
                      const SizedBox(width: 8),
                      FilledButton(onPressed: _addSpecification, child: const Text('Add')),
                    ]),
                  ],
                ),
              ),
              
              // Added Specifications Table
              if (_specifications.isNotEmpty) ...[
                const SizedBox(height: 16),
                Container(
                  decoration: BoxDecoration(
                    border: Border.all(color: isDark ? Colors.grey[700]! : Colors.grey[300]!),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Column(
                    children: _specifications.entries.toList().asMap().entries.map((entry) {
                      final i = entry.key;
                      final e = entry.value;
                      return Container(
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                        decoration: BoxDecoration(
                          color: i.isEven ? (isDark ? Colors.black12 : Colors.grey[50]) : Colors.transparent,
                          borderRadius: i == 0 ? const BorderRadius.vertical(top: Radius.circular(11)) : 
                              (i == _specifications.length - 1 ? const BorderRadius.vertical(bottom: Radius.circular(11)) : null),
                        ),
                        child: Row(
                          children: [
                            Expanded(flex: 2, child: Text(e.key, style: TextStyle(fontWeight: FontWeight.w500, color: isDark ? Colors.white70 : Colors.black54))),
                            Expanded(flex: 3, child: Text(e.value, style: TextStyle(fontWeight: FontWeight.bold, color: isDark ? Colors.white : Colors.black87))),
                            IconButton(icon: Icon(Icons.delete_outline, size: 18, color: Colors.red), onPressed: () => setState(() => _specifications.remove(e.key))),
                          ],
                        ),
                      );
                    }).toList(),
                  ),
                ),
              ],
            ],
          ),
        ),
        const SizedBox(height: 16),
        
        // Variant Options
        _buildCard(
          isDark: isDark, cardColor: cardColor,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(children: [
                Icon(Icons.style, color: Colors.purple, size: 20),
                const SizedBox(width: 8),
                Text('Product Variants', style: TextStyle(fontWeight: FontWeight.bold, color: isDark ? Colors.white : Colors.black87)),
              ]),
              const SizedBox(height: 8),
              Text('Add options like Size, Color to create product variants', style: TextStyle(color: Colors.grey, fontSize: 12)),
              const SizedBox(height: 16),
              
              // Preset Variant Types
              Text('Quick Add Variant Type', style: TextStyle(fontWeight: FontWeight.w500, fontSize: 12, color: Colors.grey)),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8, runSpacing: 8,
                children: presetVariants.keys.map((type) {
                  final exists = _variantOptions.any((o) => o.name == type);
                  return ActionChip(
                    avatar: Icon(_getVariantIcon(type), size: 16, color: exists ? Colors.grey : Colors.purple),
                    label: Text(type),
                    backgroundColor: exists ? Colors.grey.withValues(alpha: 0.2) : Colors.purple.withValues(alpha: 0.1),
                    onPressed: exists ? null : () => _showVariantValuePicker(type, presetVariants[type]!, isDark),
                  );
                }).toList(),
              ),
              const SizedBox(height: 16),
              
              // Custom Variant Button
              OutlinedButton.icon(
                onPressed: _showCustomVariantDialog,
                icon: const Icon(Icons.add),
                label: const Text('Add Custom Variant'),
                style: OutlinedButton.styleFrom(minimumSize: const Size(double.infinity, 44)),
              ),
              
              // Added Variants
              if (_variantOptions.isNotEmpty) ...[
                const SizedBox(height: 16),
                ...(_variantOptions.map((opt) => Container(
                  margin: const EdgeInsets.only(bottom: 12),
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: isDark ? Colors.black26 : Colors.grey[50],
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: _getVariantColor(opt.name).withValues(alpha: 0.3)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(children: [
                        Container(
                          padding: const EdgeInsets.all(8),
                          decoration: BoxDecoration(color: _getVariantColor(opt.name).withValues(alpha: 0.1), borderRadius: BorderRadius.circular(8)),
                          child: Icon(_getVariantIcon(opt.name), color: _getVariantColor(opt.name), size: 18),
                        ),
                        const SizedBox(width: 12),
                        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Text(opt.name, style: TextStyle(fontWeight: FontWeight.bold, color: isDark ? Colors.white : Colors.black87)),
                          Text('${opt.values.length} options', style: TextStyle(fontSize: 12, color: Colors.grey)),
                        ])),
                        IconButton(icon: Icon(Icons.add_circle_outline, color: _getVariantColor(opt.name)), onPressed: () => _showAddValueToVariant(opt, isDark)),
                        IconButton(icon: const Icon(Icons.delete_outline, color: Colors.red), onPressed: () => setState(() => _variantOptions.remove(opt))),
                      ]),
                      const SizedBox(height: 12),
                      Wrap(
                        spacing: 8, runSpacing: 8,
                        children: opt.values.map((v) => Chip(
                          label: Text(v, style: TextStyle(color: _getVariantColor(opt.name), fontWeight: FontWeight.w500)),
                          backgroundColor: _getVariantColor(opt.name).withValues(alpha: 0.1),
                          deleteIcon: Icon(Icons.close, size: 16, color: _getVariantColor(opt.name)),
                          onDeleted: () {
                            final newValues = opt.values.where((x) => x != v).toList();
                            setState(() {
                              _variantOptions.removeWhere((o) => o.name == opt.name);
                              if (newValues.isNotEmpty) _variantOptions.add(VariantOption(name: opt.name, values: newValues));
                            });
                          },
                        )).toList(),
                      ),
                    ],
                  ),
                ))),
              ] else
                Container(
                  padding: const EdgeInsets.all(24),
                  decoration: BoxDecoration(color: isDark ? Colors.black12 : Colors.grey[100], borderRadius: BorderRadius.circular(12)),
                  child: Column(children: [
                    Icon(Icons.layers_outlined, size: 40, color: Colors.grey[400]),
                    const SizedBox(height: 8),
                    Text('No variants added', style: TextStyle(color: Colors.grey)),
                    Text('Skip if product has no variations', style: TextStyle(color: Colors.grey[400], fontSize: 12)),
                  ]),
                ),
            ],
          ),
        ),
      ],
    ).animate().fadeIn(duration: 300.ms);
  }

  IconData _getVariantIcon(String type) {
    switch (type.toLowerCase()) {
      case 'size': return Icons.straighten;
      case 'color': return Icons.palette;
      case 'style': return Icons.style;
      case 'capacity': return Icons.local_drink;
      case 'pack size': return Icons.inventory;
      default: return Icons.layers;
    }
  }

  Color _getVariantColor(String type) {
    switch (type.toLowerCase()) {
      case 'size': return Colors.blue;
      case 'color': return Colors.purple;
      case 'style': return Colors.orange;
      case 'capacity': return Colors.teal;
      case 'pack size': return Colors.green;
      default: return Colors.indigo;
    }
  }

  void _showSpecValuePicker(String key, List<String> presets, bool isDark) {
    final customController = TextEditingController();
    final accentColor = AppColors.primary;
    
    showGeneralDialog(
      context: context,
      barrierDismissible: true,
      barrierLabel: 'Spec Picker',
      transitionDuration: const Duration(milliseconds: 200),
      pageBuilder: (ctx, anim1, anim2) => Container(),
      transitionBuilder: (ctx, anim1, anim2, child) {
        return ScaleTransition(
          scale: CurvedAnimation(parent: anim1, curve: Curves.easeOutBack),
          child: Dialog(
            backgroundColor: isDark ? const Color(0xFF1E1E1E) : Colors.white,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
            child: Container(
              width: 450,
              constraints: const BoxConstraints(maxHeight: 500),
              padding: const EdgeInsets.all(24),
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                  // Header
                  Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      gradient: LinearGradient(colors: [accentColor.withValues(alpha: 0.2), Colors.green.withValues(alpha: 0.1)]),
                      shape: BoxShape.circle,
                    ),
                    child: Icon(Icons.fact_check, color: accentColor, size: 28),
                  ),
                  const SizedBox(height: 16),
                  Text('Set $key', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 20, color: isDark ? Colors.white : Colors.black87)),
                  const SizedBox(height: 8),
                  Text('Select from options or enter custom value', style: TextStyle(color: Colors.grey, fontSize: 13)),
                  
                  if (presets.isNotEmpty) ...[
                    const SizedBox(height: 20),
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: isDark ? Colors.black26 : Colors.grey[50],
                        borderRadius: BorderRadius.circular(16),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(children: [
                            Icon(Icons.flash_on, color: Colors.amber, size: 16),
                            const SizedBox(width: 6),
                            Text('Quick Select', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 12, color: Colors.grey)),
                          ]),
                          const SizedBox(height: 12),
                          Wrap(
                            spacing: 8, runSpacing: 8,
                            children: presets.map((v) => InkWell(
                              onTap: () {
                                setState(() => _specifications[key] = v);
                                Navigator.pop(ctx);
                              },
                              borderRadius: BorderRadius.circular(10),
                              child: Container(
                                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                                decoration: BoxDecoration(
                                  color: accentColor.withValues(alpha: 0.1),
                                  borderRadius: BorderRadius.circular(10),
                                  border: Border.all(color: accentColor.withValues(alpha: 0.3)),
                                ),
                                child: Text(v, style: TextStyle(color: accentColor, fontWeight: FontWeight.w600)),
                              ),
                            )).toList(),
                          ),
                        ],
                      ),
                    ),
                  ],
                  
                  const SizedBox(height: 16),
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: isDark ? Colors.black26 : Colors.grey[50],
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(children: [
                          Icon(Icons.edit, color: Colors.blue, size: 16),
                          const SizedBox(width: 6),
                          Text('Custom Value', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 12, color: Colors.grey)),
                        ]),
                        const SizedBox(height: 12),
                        TextField(
                          controller: customController,
                          style: TextStyle(color: isDark ? Colors.white : Colors.black87),
                          decoration: InputDecoration(
                            hintText: 'Enter custom $key',
                            filled: true,
                            fillColor: isDark ? Colors.black26 : Colors.white,
                            border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                            focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: accentColor, width: 2)),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 20),
                  
                  Row(children: [
                    Expanded(child: OutlinedButton(
                      onPressed: () => Navigator.pop(ctx),
                      style: OutlinedButton.styleFrom(padding: const EdgeInsets.symmetric(vertical: 14), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))),
                      child: const Text('Cancel'),
                    )),
                    const SizedBox(width: 12),
                    Expanded(child: FilledButton(
                      onPressed: () {
                        if (customController.text.trim().isNotEmpty) {
                          setState(() => _specifications[key] = customController.text.trim());
                          Navigator.pop(ctx);
                        }
                      },
                      style: FilledButton.styleFrom(padding: const EdgeInsets.symmetric(vertical: 14), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))),
                      child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                        const Icon(Icons.check, size: 18),
                        const SizedBox(width: 6),
                        const Text('Add Value'),
                      ]),
                    )),
                  ]),
                  ],
                ),
              ),
            ),
          ),
        );
      },
    );
  }

  void _showVariantValuePicker(String type, List<String> presets, bool isDark) {
    final selected = <String>{};
    final variantColor = _getVariantColor(type);
    
    showGeneralDialog(
      context: context,
      barrierDismissible: true,
      barrierLabel: 'Variant Picker',
      transitionDuration: const Duration(milliseconds: 200),
      pageBuilder: (ctx, anim1, anim2) => Container(),
      transitionBuilder: (ctx, anim1, anim2, child) {
        return ScaleTransition(
          scale: CurvedAnimation(parent: anim1, curve: Curves.easeOutBack),
          child: StatefulBuilder(
            builder: (ctx, setModalState) => Dialog(
              backgroundColor: isDark ? const Color(0xFF1E1E1E) : Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
              child: Container(
                width: 450,
                constraints: const BoxConstraints(maxHeight: 550),
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    // Header
                    Container(
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        gradient: LinearGradient(colors: [variantColor.withValues(alpha: 0.2), variantColor.withValues(alpha: 0.05)]),
                        shape: BoxShape.circle,
                      ),
                      child: Icon(_getVariantIcon(type), color: variantColor, size: 28),
                    ),
                    const SizedBox(height: 16),
                    Text('Select $type Options', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 20, color: isDark ? Colors.white : Colors.black87)),
                    const SizedBox(height: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                      decoration: BoxDecoration(color: variantColor.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(20)),
                      child: Text('${selected.length} selected', style: TextStyle(color: variantColor, fontWeight: FontWeight.bold, fontSize: 12)),
                    ),
                    const SizedBox(height: 20),
                    
                    Flexible(
                      child: SingleChildScrollView(
                        child: Wrap(
                          spacing: 10, runSpacing: 10,
                          children: presets.map((v) {
                            final isSelected = selected.contains(v);
                            return InkWell(
                              onTap: () => setModalState(() => isSelected ? selected.remove(v) : selected.add(v)),
                              borderRadius: BorderRadius.circular(12),
                              child: AnimatedContainer(
                                duration: const Duration(milliseconds: 150),
                                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                                decoration: BoxDecoration(
                                  color: isSelected ? variantColor.withValues(alpha: 0.15) : (isDark ? Colors.black26 : Colors.grey[100]),
                                  borderRadius: BorderRadius.circular(12),
                                  border: Border.all(color: isSelected ? variantColor : Colors.transparent, width: 2),
                                ),
                                child: Row(mainAxisSize: MainAxisSize.min, children: [
                                  AnimatedContainer(
                                    duration: const Duration(milliseconds: 150),
                                    width: 20, height: 20,
                                    decoration: BoxDecoration(
                                      color: isSelected ? variantColor : Colors.transparent,
                                      borderRadius: BorderRadius.circular(6),
                                      border: Border.all(color: isSelected ? variantColor : Colors.grey, width: 2),
                                    ),
                                    child: isSelected ? const Icon(Icons.check, size: 14, color: Colors.white) : null,
                                  ),
                                  const SizedBox(width: 10),
                                  Text(v, style: TextStyle(fontWeight: FontWeight.w600, color: isSelected ? variantColor : (isDark ? Colors.white70 : Colors.black87))),
                                ]),
                              ),
                            );
                          }).toList(),
                        ),
                      ),
                    ),
                    const SizedBox(height: 20),
                    
                    Row(children: [
                      Expanded(child: OutlinedButton(
                        onPressed: () => Navigator.pop(ctx),
                        style: OutlinedButton.styleFrom(padding: const EdgeInsets.symmetric(vertical: 14), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))),
                        child: const Text('Cancel'),
                      )),
                      const SizedBox(width: 12),
                      Expanded(child: FilledButton(
                        onPressed: selected.isEmpty ? null : () {
                          setState(() => _variantOptions.add(VariantOption(name: type, values: selected.toList())));
                          Navigator.pop(ctx);
                        },
                        style: FilledButton.styleFrom(
                          padding: const EdgeInsets.symmetric(vertical: 14), 
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          backgroundColor: variantColor,
                        ),
                        child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                          const Icon(Icons.add, size: 18),
                          const SizedBox(width: 6),
                          Text('Add ${selected.length} Options'),
                        ]),
                      )),
                    ]),
                  ],
                ),
              ),
            ),
          ),
        );
      },
    );
  }

  void _showCustomVariantDialog() {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final nameController = TextEditingController();
    final valuesController = TextEditingController();
    
    showGeneralDialog(
      context: context,
      barrierDismissible: true,
      barrierLabel: 'Custom Variant',
      transitionDuration: const Duration(milliseconds: 200),
      pageBuilder: (ctx, anim1, anim2) => Container(),
      transitionBuilder: (ctx, anim1, anim2, child) {
        return ScaleTransition(
          scale: CurvedAnimation(parent: anim1, curve: Curves.easeOutBack),
          child: Dialog(
            backgroundColor: isDark ? const Color(0xFF1E1E1E) : Colors.white,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
            child: Container(
              width: 450,
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  // Header
                  Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      gradient: LinearGradient(colors: [Colors.purple.withValues(alpha: 0.2), Colors.indigo.withValues(alpha: 0.1)]),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(Icons.add_box, color: Colors.purple, size: 28),
                  ),
                  const SizedBox(height: 16),
                  Text('Create Custom Variant', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 20, color: isDark ? Colors.white : Colors.black87)),
                  const SizedBox(height: 8),
                  Text('Add a new variant type with values', style: TextStyle(color: Colors.grey, fontSize: 13)),
                  const SizedBox(height: 24),
                  
                  // Variant Name
                  Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text('Variant Name', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 12, color: Colors.grey)),
                    const SizedBox(height: 8),
                    TextField(
                      controller: nameController,
                      style: TextStyle(color: isDark ? Colors.white : Colors.black87),
                      decoration: InputDecoration(
                        hintText: 'e.g., Material, Fabric, Finish',
                        prefixIcon: const Icon(Icons.label_outline, color: Colors.purple),
                        filled: true,
                        fillColor: isDark ? Colors.black26 : Colors.grey[100],
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                        focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Colors.purple, width: 2)),
                      ),
                    ),
                  ]),
                  const SizedBox(height: 16),
                  
                  // Values
                  Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text('Values', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 12, color: Colors.grey)),
                    const SizedBox(height: 8),
                    TextField(
                      controller: valuesController,
                      maxLines: 2,
                      style: TextStyle(color: isDark ? Colors.white : Colors.black87),
                      decoration: InputDecoration(
                        hintText: 'Cotton, Polyester, Silk (comma separated)',
                        prefixIcon: const Padding(padding: EdgeInsets.only(bottom: 24), child: Icon(Icons.list, color: Colors.purple)),
                        filled: true,
                        fillColor: isDark ? Colors.black26 : Colors.grey[100],
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                        focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Colors.purple, width: 2)),
                      ),
                    ),
                  ]),
                  const SizedBox(height: 24),
                  
                  Row(children: [
                    Expanded(child: OutlinedButton(
                      onPressed: () => Navigator.pop(ctx),
                      style: OutlinedButton.styleFrom(padding: const EdgeInsets.symmetric(vertical: 14), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))),
                      child: const Text('Cancel'),
                    )),
                    const SizedBox(width: 12),
                    Expanded(child: FilledButton(
                      onPressed: () {
                        if (nameController.text.isNotEmpty && valuesController.text.isNotEmpty) {
                          final values = valuesController.text.split(',').map((e) => e.trim()).where((e) => e.isNotEmpty).toList();
                          if (values.isNotEmpty) {
                            setState(() => _variantOptions.add(VariantOption(name: nameController.text.trim(), values: values)));
                            Navigator.pop(ctx);
                          }
                        }
                      },
                      style: FilledButton.styleFrom(padding: const EdgeInsets.symmetric(vertical: 14), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)), backgroundColor: Colors.purple),
                      child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                        const Icon(Icons.add, size: 18),
                        const SizedBox(width: 6),
                        const Text('Create Variant'),
                      ]),
                    )),
                  ]),
                ],
              ),
            ),
          ),
        );
      },
    );
  }

  void _showAddValueToVariant(VariantOption opt, bool isDark) {
    final controller = TextEditingController();
    final variantColor = _getVariantColor(opt.name);
    
    showGeneralDialog(
      context: context,
      barrierDismissible: true,
      barrierLabel: 'Add Value',
      transitionDuration: const Duration(milliseconds: 200),
      pageBuilder: (ctx, anim1, anim2) => Container(),
      transitionBuilder: (ctx, anim1, anim2, child) {
        return ScaleTransition(
          scale: CurvedAnimation(parent: anim1, curve: Curves.easeOutBack),
          child: Dialog(
            backgroundColor: isDark ? const Color(0xFF1E1E1E) : Colors.white,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
            child: Container(
              width: 400,
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  // Header
                  Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      gradient: LinearGradient(colors: [variantColor.withValues(alpha: 0.2), variantColor.withValues(alpha: 0.05)]),
                      shape: BoxShape.circle,
                    ),
                    child: Icon(_getVariantIcon(opt.name), color: variantColor, size: 28),
                  ),
                  const SizedBox(height: 16),
                  Text('Add ${opt.name} Value', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 20, color: isDark ? Colors.white : Colors.black87)),
                  const SizedBox(height: 8),
                  Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                    Text('Current: ', style: TextStyle(color: Colors.grey, fontSize: 13)),
                    Text('${opt.values.length} values', style: TextStyle(color: variantColor, fontWeight: FontWeight.bold, fontSize: 13)),
                  ]),
                  const SizedBox(height: 24),
                  
                  TextField(
                    controller: controller,
                    autofocus: true,
                    style: TextStyle(color: isDark ? Colors.white : Colors.black87),
                    decoration: InputDecoration(
                      hintText: 'Enter new value',
                      prefixIcon: Icon(Icons.add, color: variantColor),
                      filled: true,
                      fillColor: isDark ? Colors.black26 : Colors.grey[100],
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                      focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: variantColor, width: 2)),
                    ),
                  ),
                  const SizedBox(height: 24),
                  
                  Row(children: [
                    Expanded(child: OutlinedButton(
                      onPressed: () => Navigator.pop(ctx),
                      style: OutlinedButton.styleFrom(padding: const EdgeInsets.symmetric(vertical: 14), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))),
                      child: const Text('Cancel'),
                    )),
                    const SizedBox(width: 12),
                    Expanded(child: FilledButton(
                      onPressed: () {
                        if (controller.text.trim().isNotEmpty) {
                          setState(() {
                            _variantOptions.removeWhere((o) => o.name == opt.name);
                            _variantOptions.add(VariantOption(name: opt.name, values: [...opt.values, controller.text.trim()]));
                          });
                          Navigator.pop(ctx);
                        }
                      },
                      style: FilledButton.styleFrom(padding: const EdgeInsets.symmetric(vertical: 14), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)), backgroundColor: variantColor),
                      child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                        const Icon(Icons.add, size: 18),
                        const SizedBox(width: 6),
                        const Text('Add Value'),
                      ]),
                    )),
                  ]),
                ],
              ),
            ),
          ),
        );
      },
    );
  }

  void _addSpecification() {
    if (_specKeyController.text.isNotEmpty && _specValueController.text.isNotEmpty) {
      setState(() {
        _specifications[_specKeyController.text.trim()] = _specValueController.text.trim();
        _specKeyController.clear();
        _specValueController.clear();
      });
    }
  }

  void _showAddVariantDialog() {
    final nameController = TextEditingController();
    final valuesController = TextEditingController();
    
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Add Variant Option'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(controller: nameController, decoration: const InputDecoration(labelText: 'Option Name (e.g., Size)')),
            const SizedBox(height: 12),
            TextField(controller: valuesController, decoration: const InputDecoration(labelText: 'Values (comma separated)', hintText: 'S, M, L, XL')),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          FilledButton(
            onPressed: () {
              if (nameController.text.isNotEmpty && valuesController.text.isNotEmpty) {
                final values = valuesController.text.split(',').map((e) => e.trim()).where((e) => e.isNotEmpty).toList();
                setState(() => _variantOptions.add(VariantOption(name: nameController.text.trim(), values: values)));
                Navigator.pop(ctx);
              }
            },
            child: const Text('Add'),
          ),
        ],
      ),
    );
  }

  // ==================== STEP 5: Shipping ====================
  Widget _buildShippingStep(bool isDark, Color accentColor, Color cardColor) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _buildStepHeader('Shipping & Delivery', 'Configure delivery and return policies', Icons.local_shipping_outlined, isDark),
        const SizedBox(height: 24),
        
        // 📦 Enhanced Shipping Details Card with dimensions
        ProductShippingDetailsWidget(
          weightController: _weightController,
          lengthController: _lengthController,
          widthController: _widthController,
          heightController: _heightController,
          isDark: isDark,
          accentColor: accentColor,
          cardColor: cardColor,
        ),
        const SizedBox(height: 16),
        
        // Estimated Delivery Days (kept separate for clarity)
        _buildCard(
          isDark: isDark, cardColor: cardColor,
          child: _buildTextField(
            controller: _shippingDaysController,
            label: 'Estimated Delivery Days',
            hint: '3-5',
            icon: Icons.schedule,
            isDark: isDark,
          ),
        ),
        const SizedBox(height: 16),

        
        // Delivery Options Card
        _buildCard(
          isDark: isDark, cardColor: cardColor,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(children: [
                Icon(Icons.local_shipping, color: Colors.green, size: 20),
                const SizedBox(width: 8),
                Text('Delivery Options', style: TextStyle(fontWeight: FontWeight.bold, color: isDark ? Colors.white : Colors.black87)),
              ]),
              const SizedBox(height: 16),
              
              // Free Delivery Toggle with Logic
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: _isFreeDelivery ? Colors.green.withValues(alpha: 0.1) : (isDark ? Colors.black26 : Colors.grey[100]),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: _isFreeDelivery ? Colors.green.withValues(alpha: 0.5) : Colors.transparent),
                ),
                child: Column(
                  children: [
                    Row(children: [
                      Icon(Icons.local_shipping, color: _isFreeDelivery ? Colors.green : Colors.grey),
                      const SizedBox(width: 12),
                      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text('Free Delivery', style: TextStyle(fontWeight: FontWeight.bold, color: isDark ? Colors.white : Colors.black87)),
                        Text('No shipping charges for customer', style: TextStyle(fontSize: 12, color: Colors.grey)),
                      ])),
                      Switch(value: _isFreeDelivery, onChanged: (v) => setState(() => _isFreeDelivery = v), activeThumbColor: Colors.green),
                    ]),
                    if (!_isFreeDelivery) ...[
                      const SizedBox(height: 12),
                      _buildTextField(controller: _shippingPriceController, label: 'Shipping Cost (₹)', hint: '49', icon: Icons.currency_rupee, isDark: isDark, keyboardType: TextInputType.number),
                    ],
                  ],
                ),
              ),
              const SizedBox(height: 12),
              
              // Express Delivery with Price
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: _expressDelivery ? Colors.orange.withValues(alpha: 0.1) : (isDark ? Colors.black26 : Colors.grey[100]),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: _expressDelivery ? Colors.orange.withValues(alpha: 0.5) : Colors.transparent),
                ),
                child: Column(
                  children: [
                    Row(children: [
                      Icon(Icons.flash_on, color: _expressDelivery ? Colors.orange : Colors.grey),
                      const SizedBox(width: 12),
                      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text('Express Delivery', style: TextStyle(fontWeight: FontWeight.bold, color: isDark ? Colors.white : Colors.black87)),
                        Text('1-2 day fast delivery option', style: TextStyle(fontSize: 12, color: Colors.grey)),
                      ])),
                      Switch(value: _expressDelivery, onChanged: (v) => setState(() => _expressDelivery = v), activeThumbColor: Colors.orange),
                    ]),
                    if (_expressDelivery) ...[
                      const SizedBox(height: 12),
                      Row(children: [
                        Expanded(child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                          decoration: BoxDecoration(color: isDark ? Colors.black26 : Colors.white, borderRadius: BorderRadius.circular(8)),
                          child: Row(children: [
                            Text('Express Price: ', style: TextStyle(color: Colors.grey)),
                            Text('₹${_expressDeliveryPrice.toInt()}', style: TextStyle(fontWeight: FontWeight.bold, color: Colors.orange)),
                          ]),
                        )),
                        const SizedBox(width: 8),
                        IconButton(icon: const Icon(Icons.remove_circle_outline), onPressed: () => setState(() => _expressDeliveryPrice = (_expressDeliveryPrice - 10).clamp(0, 999))),
                        IconButton(icon: const Icon(Icons.add_circle_outline), onPressed: () => setState(() => _expressDeliveryPrice = (_expressDeliveryPrice + 10).clamp(0, 999))),
                      ]),
                    ],
                  ],
                ),
              ),
              const SizedBox(height: 12),
              
              // COD
              _buildToggle('Cash on Delivery', 'Allow payment on delivery', _codAvailable, (v) => setState(() => _codAvailable = v!), Icons.payments, Colors.purple, isDark),
            ],
          ),
        ),
        const SizedBox(height: 16),
        
        // Return & Exchange Policy Card
        _buildCard(
          isDark: isDark, cardColor: cardColor,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(children: [
                Icon(Icons.assignment_return, color: Colors.blue, size: 20),
                const SizedBox(width: 8),
                Text('Return & Exchange Policy', style: TextStyle(fontWeight: FontWeight.bold, color: isDark ? Colors.white : Colors.black87)),
              ]),
              const SizedBox(height: 16),
              
              // Policy Type Selector
              Row(children: [
                _buildPolicyChip('Return Only', 'return', Icons.assignment_return, Colors.blue, isDark),
                const SizedBox(width: 8),
                _buildPolicyChip('Exchange Only', 'exchange', Icons.swap_horiz, Colors.green, isDark),
                const SizedBox(width: 8),
                _buildPolicyChip('Both', 'both', Icons.check_circle, Colors.purple, isDark),
              ]),
              const SizedBox(height: 16),
              
              if (_returnPolicy != 'none')
                _buildTextField(controller: _returnDaysController, label: 'Return/Exchange Window (days)', hint: '7', icon: Icons.calendar_today, isDark: isDark, keyboardType: TextInputType.number),
              
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.blue.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(children: [
                  Icon(Icons.info_outline, color: Colors.blue, size: 18),
                  const SizedBox(width: 8),
                  Expanded(child: Text(
                    _returnPolicy == 'return' ? 'Customers can return the product within ${_returnDaysController.text} days' :
                    _returnPolicy == 'exchange' ? 'Customers can exchange the product within ${_returnDaysController.text} days' :
                    'Customers can return or exchange within ${_returnDaysController.text} days',
                    style: TextStyle(fontSize: 12, color: Colors.blue),
                  )),
                ]),
              ),
            ],
          ),
        ),
        const SizedBox(height: 24),
        
        // Quality Checks Widget
        QualityChecksWidget(
          productName: _nameController.text,
          images: _images,
          sellingPrice: double.tryParse(_priceController.text) ?? 0,
          originalPrice: double.tryParse(_originalPriceController.text) ?? 0,
          stock: int.tryParse(_stockController.text) ?? 0,
          hsnCode: _hsnCodeController.text,
          gstInfo: _gstInfo,
          sellerGstStatus: SellerGstStatus.registered, // TODO: Get from SellerProvider
          manufacturer: _manufacturerController.text,
          countryOfOrigin: _countryOfOriginController.text,
          isDark: isDark,
        ),
        const SizedBox(height: 16),
        
        // Compliance Fields
        _buildCard(
          isDark: isDark, cardColor: cardColor,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(children: [
                Icon(Icons.verified_user, color: Colors.green, size: 20),
                const SizedBox(width: 8),
                Text('Compliance Details', style: TextStyle(fontWeight: FontWeight.bold, color: isDark ? Colors.white : Colors.black87)),
              ]),
              const SizedBox(height: 16),
              _buildTextField(controller: _manufacturerController, label: 'Manufacturer Name *', hint: 'ABC Electronics Pvt Ltd', icon: Icons.factory, isDark: isDark),
              const SizedBox(height: 12),
              _buildTextField(controller: _countryOfOriginController, label: 'Country of Origin *', hint: 'India', icon: Icons.flag, isDark: isDark),
            ],
          ),
        ),
        const SizedBox(height: 16),
        
        // Summary
        _buildCard(
          isDark: isDark, cardColor: cardColor,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(Icons.check_circle, color: Colors.green),
                  const SizedBox(width: 8),
                  Text('Summary', style: TextStyle(fontWeight: FontWeight.bold, color: isDark ? Colors.white : Colors.black87)),
                ],
              ),
              const SizedBox(height: 12),
              _buildSummaryRow('Product', _nameController.text.isEmpty ? 'Not set' : _nameController.text, isDark),
              _buildSummaryRow('Price', '₹${_priceController.text.isEmpty ? '0' : _priceController.text}', isDark),
              _buildSummaryRow('GST', '${_gstRate.toInt()}%', isDark),
              _buildSummaryRow('Stock', '${_stockController.text} units', isDark),
              _buildSummaryRow('Images', '${_images.length} uploaded', isDark),
              _buildSummaryRow('Specifications', '${_specifications.length} added', isDark),
              _buildSummaryRow('Variants', '${_variantOptions.length} options', isDark),
            ],
          ),
        ),
        const SizedBox(height: 16),
        
        // Save as Draft Button
        OutlinedButton.icon(
          onPressed: _saveDraft,
          icon: Icon(Icons.save_outlined, color: accentColor),
          label: Text('Save as Draft', style: TextStyle(color: accentColor)),
          style: OutlinedButton.styleFrom(
            side: BorderSide(color: accentColor),
            padding: const EdgeInsets.symmetric(vertical: 14),
            minimumSize: const Size(double.infinity, 50),
          ),
        ),
      ],
    ).animate().fadeIn(duration: 300.ms);
  }
  
  Future<void> _saveDraft() async {
    if (_sellerId == null) return;
    
    try {
      _draftId = await ProductDraftService.saveDraft(
        sellerId: _sellerId!,
        currentStep: _currentStep,
        formData: ProductDraftService.formToMap(
          name: _nameController.text,
          description: _descController.text,
          price: double.tryParse(_priceController.text) ?? 0,
          originalPrice: double.tryParse(_originalPriceController.text) ?? 0,
          stock: int.tryParse(_stockController.text) ?? 0,
          categoryId: _selectedCategory,
          subCategoryId: _selectedSubCategory,
          images: _images,
          specifications: _specifications,
          keywords: _keywords,
          hsnCode: _hsnCodeController.text,
          gstRate: _gstRate,
          shippingDays: _shippingDaysController.text,
          shippingPrice: double.tryParse(_shippingPriceController.text) ?? 0,
          weight: double.tryParse(_weightController.text) ?? 0,
          manufacturer: _manufacturerController.text,
          countryOfOrigin: _countryOfOriginController.text,
          variants: _variants.map((v) => v.toMap()).toList(),
          keyFeatures: [],
          inTheBox: [],
        ),
        existingDraftId: _draftId,
      );
      
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Row(children: [
              Icon(Icons.check_circle, color: Colors.white, size: 18),
              const SizedBox(width: 8),
              Text('Draft saved! Continue anytime.'),
            ]),
            backgroundColor: Colors.green,
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to save draft: $e'), backgroundColor: Colors.red),
        );
      }
    }
  }

  Widget _buildSummaryRow(String label, String value, bool isDark) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: TextStyle(color: Colors.grey)),
          Text(value, style: TextStyle(fontWeight: FontWeight.w600, color: isDark ? Colors.white : Colors.black87)),
        ],
      ),
    );
  }

  // ==================== Helpers ====================
  Widget _buildStepHeader(String title, String subtitle, IconData icon, bool isDark) {
    return Row(
      children: [
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(color: AppColors.primary.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(12)),
          child: Icon(icon, color: AppColors.primary, size: 24),
        ),
        const SizedBox(width: 16),
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: isDark ? Colors.white : Colors.black87)),
            Text(subtitle, style: TextStyle(color: isDark ? Colors.white54 : Colors.black45)),
          ],
        ),
      ],
    );
  }

  Widget _buildCard({required bool isDark, required Color cardColor, required Widget child}) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: cardColor,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.05), blurRadius: 10, offset: const Offset(0, 4))],
      ),
      child: child,
    );
  }

  Widget _buildTextField({
    required TextEditingController controller,
    required String label,
    required String hint,
    required IconData icon,
    required bool isDark,
    int maxLines = 1,
    TextInputType? keyboardType,
    String? Function(String?)? validator,
    void Function(String)? onChanged,
  }) {
    return TextFormField(
      controller: controller,
      maxLines: maxLines,
      keyboardType: keyboardType,
      validator: validator,
      onChanged: onChanged,
      decoration: _inputDecoration(hint, icon, isDark).copyWith(labelText: label),
      style: TextStyle(color: isDark ? Colors.white : Colors.black87),
    );
  }

  Widget _buildToggle(String title, String sub, bool value, Function(bool?) onChanged, IconData icon, Color color, bool isDark) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        children: [
          Icon(icon, color: value ? color : Colors.grey, size: 20),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: TextStyle(fontWeight: FontWeight.w600, color: isDark ? Colors.white : Colors.black87)),
                Text(sub, style: TextStyle(fontSize: 12, color: Colors.grey)),
              ],
            ),
          ),
          Switch(value: value, onChanged: onChanged, activeThumbColor: color),
        ],
      ),
    );
  }

  Widget _buildPolicyChip(String label, String value, IconData icon, Color color, bool isDark) {
    final isSelected = _returnPolicy == value;
    return Expanded(
      child: InkWell(
        onTap: () => setState(() => _returnPolicy = value),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 8),
          decoration: BoxDecoration(
            color: isSelected ? color.withValues(alpha: 0.1) : (isDark ? Colors.black26 : Colors.grey[100]),
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: isSelected ? color : Colors.transparent, width: 2),
          ),
          child: Column(
            children: [
              Icon(icon, color: isSelected ? color : Colors.grey, size: 20),
              const SizedBox(height: 4),
              Text(label, style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: isSelected ? color : Colors.grey)),
            ],
          ),
        ),
      ),
    );
  }

  InputDecoration _inputDecoration(String hint, IconData icon, bool isDark) {
    return InputDecoration(
      hintText: hint,
      prefixIcon: Icon(icon, color: isDark ? Colors.grey : Colors.grey[600]),
      filled: true,
      fillColor: isDark ? Colors.white.withValues(alpha: 0.05) : Colors.grey[100],
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
      focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: AppColors.primary, width: 2)),
    );
  }

  void _nextStep() {
    if (_currentStep == 0 && !_formKey.currentState!.validate()) return;
    if (_currentStep == 1 && _images.isEmpty) {
      SnackbarHelper.showError(context, 'Add at least one image');
      return;
    }
    setState(() => _currentStep++);
  }

  Future<void> _submitProduct() async {
    if (_sellerId == null) { SnackbarHelper.showError(context, 'Seller ID not found. Please restart.'); return; }
    if (_images.isEmpty) { SnackbarHelper.showError(context, 'Add at least one image'); return; }
    
    setState(() => _isLoading = true);
    HapticFeedback.mediumImpact();
    
    try {
      final now = DateTime.now();
      final productId = _isEditMode ? widget.product!.id : '';
      
      final product = ProductModel(
        id: productId,
        sellerId: _sellerId!, // Auto-detected from SellerProvider
        name: _nameController.text.trim(),
        description: _descController.text.trim(),
        salePrice: double.parse(_priceController.text.trim()),
        originalPrice: _originalPriceController.text.isNotEmpty ? double.parse(_originalPriceController.text.trim()) : null,
        categoryId: _selectedCategory!,
        subCategoryId: _selectedSubCategory,
        images: _images,
        stock: int.parse(_stockController.text.trim()),
        rating: _isEditMode ? widget.product!.rating : 0,
        reviewCount: _isEditMode ? widget.product!.reviewCount : 0,
        // Badges controlled by Admin only - preserve existing values on edit
        isFeatured: _isEditMode ? widget.product!.isFeatured : false,
        isActive: _isEditMode ? widget.product!.isActive : true,
        isVerified: _isEditMode ? widget.product!.isVerified : false,
        isTrending: _isEditMode ? widget.product!.isTrending : false,
        isNew: _isEditMode ? (widget.product!.isNew ?? false) : true,
        createdAt: _isEditMode ? widget.product!.createdAt : now,
        updatedAt: now,
        shippingDays: _shippingDaysController.text,
        shippingPrice: double.tryParse(_shippingPriceController.text) ?? 0,
        isFreeDelivery: _isFreeDelivery,
        expressDelivery: _expressDelivery,
        specifications: _specifications,
        variants: _variants,
        variantOptions: _variantOptions,
        keywords: _keywords, // ✅ NEW: Search keywords for autocomplete
        // ✅ NEW: Dynamic Category Attributes
        attributes: _productAttributes,
        pendingAttributes: _pendingProductAttributes,
        // Seller products need admin approval
        approvalStatus: ProductApprovalStatus.pending,
        addedBy: 'seller',
        submittedForApprovalAt: now,
        // Leave approval fields null/unchanged for pending products
        approvedAt: _isEditMode ? widget.product!.approvedAt : null,
        approvedBy: _isEditMode ? widget.product!.approvedBy : null,
      );
      
      if (_isEditMode) {
        // Update existing product
        await _firestore.collection('products').doc(productId).update(product.toMap());
        if (mounted) {
          SnackbarHelper.showSuccess(context, 'Product updated! Pending admin review.');
          Navigator.pop(context, true); // Return true to indicate update
        }
      } else {
        // Add new product
        await _firestore.collection('products').add(product.toMap());
        if (mounted) {
          SnackbarHelper.showSuccess(context, 'Product submitted for approval!');
          Navigator.pop(context);
        }
      }
    } catch (e) {
      if (mounted) SnackbarHelper.showError(context, 'Failed: $e');
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }
}