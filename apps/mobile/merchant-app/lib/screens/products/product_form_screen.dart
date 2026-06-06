import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import '../../app/store_context.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:letbuyy_models/letbuyy_models.dart';
import '../../services/product_service.dart';
import '../../theme/letbuyy_color_tokens.dart' as mobile_tokens;

/// Product Form Screen for Store Builder
/// Simplified product creation with essential fields
class ProductFormScreen extends StatefulWidget {
  final ProductContract? product; // null for new, populated for edit

  const ProductFormScreen({super.key, this.product});

  @override
  State<ProductFormScreen> createState() => _ProductFormScreenState();
}

class _ProductFormScreenState extends State<ProductFormScreen> {
  static const _lastStepIndex = 4;

  final _formKey = GlobalKey<FormState>();
  int _currentStep = 0;
  bool _isLoading = false;

  // Form Controllers
  final _nameController = TextEditingController();
  final _descriptionController = TextEditingController();
  final _salePriceController = TextEditingController();
  final _originalPriceController = TextEditingController();
  final _stockController = TextEditingController();
  final _skuController = TextEditingController();
  final _handleController = TextEditingController();
  final _seoTitleController = TextEditingController();
  final _seoDescriptionController = TextEditingController();

  // Form Data
  List<String> _images = [];
  List<_ProductVariantDraft> _variants = [];
  String _categoryId = '';
  Map<String, String> _specifications = {};
  bool _isFeatured = false;
  bool _isTrending = false;
  bool _isNew = true;

  // Specifications form
  final _specKeyController = TextEditingController();
  final _specValueController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _initData();
  }

  void _initData() {
    final p = widget.product;
    if (p != null) {
      _nameController.text = p.name;
      _descriptionController.text = p.description;
      _salePriceController.text = p.price.toString();
      _originalPriceController.text = p.comparePrice?.toString() ?? '';
      _stockController.text = p.stock.toString();
      _skuController.text = p.sku ?? '';
      _handleController.text = '${p['url_handle'] ?? p.slug}';
      _seoTitleController.text = '${p['seo_title'] ?? ''}';
      _seoDescriptionController.text = '${p['seo_description'] ?? ''}';
      _images = List.from(p.images);
      _variants = p.variants
          .map(_ProductVariantDraft.fromContract)
          .toList(growable: true);
      _categoryId = p.category ?? '';
      final specifications = p.metadata['specifications'];
      _specifications = specifications is Map
          ? specifications.map(
              (key, value) => MapEntry(key.toString(), value.toString()),
            )
          : {};
      _isFeatured = p.isFeatured;
      _isTrending = p.boolValue('is_trending');
      _isNew = p.boolValue('is_new', fallback: true);
    }
  }

  @override
  void dispose() {
    _nameController.dispose();
    _descriptionController.dispose();
    _salePriceController.dispose();
    _originalPriceController.dispose();
    _stockController.dispose();
    _skuController.dispose();
    _handleController.dispose();
    _seoTitleController.dispose();
    _seoDescriptionController.dispose();
    _specKeyController.dispose();
    _specValueController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isEdit = widget.product != null;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: Text(isEdit ? 'Edit Product' : 'Add Product'),
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.white,
        actions: [
          if (_isLoading)
            const Padding(
              padding: EdgeInsets.all(16),
              child: SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(strokeWidth: 2),
              ),
            )
          else
            TextButton(
              onPressed: _submitProduct,
              child: Text(
                isEdit ? 'Update' : 'Save',
                style: TextStyle(
                  color: AppColors.primary,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
        ],
      ),
      body: Form(
        key: _formKey,
        child: Stepper(
          currentStep: _currentStep,
          onStepContinue: _nextStep,
          onStepCancel: _previousStep,
          onStepTapped: (step) => setState(() => _currentStep = step),
          controlsBuilder: (context, details) => Padding(
            padding: const EdgeInsets.only(top: 16),
            child: Row(
              children: [
                if (_currentStep < _lastStepIndex)
                  ElevatedButton(
                    onPressed: details.onStepContinue,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.primary,
                      foregroundColor: Colors.white,
                    ),
                    child: const Text('Continue'),
                  ),
                if (_currentStep > 0) ...[
                  const SizedBox(width: 12),
                  TextButton(
                    onPressed: details.onStepCancel,
                    child: const Text('Back'),
                  ),
                ],
              ],
            ),
          ),
          steps: [
            // Step 1: Basic Info
            Step(
              title: const Text('Basic Info'),
              subtitle: _nameController.text.isNotEmpty
                  ? Text(
                      _nameController.text,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    )
                  : null,
              isActive: _currentStep >= 0,
              state: _currentStep > 0 ? StepState.complete : StepState.indexed,
              content: _buildBasicInfoStep(),
            ),

            // Step 2: Images
            Step(
              title: const Text('Images'),
              subtitle: Text('${_images.length} images'),
              isActive: _currentStep >= 1,
              state: _currentStep > 1 ? StepState.complete : StepState.indexed,
              content: _buildImagesStep(),
            ),

            // Step 3: Pricing & Stock
            Step(
              title: const Text('Pricing'),
              subtitle: _salePriceController.text.isNotEmpty
                  ? Text('₹${_salePriceController.text}')
                  : null,
              isActive: _currentStep >= 2,
              state: _currentStep > 2 ? StepState.complete : StepState.indexed,
              content: _buildPricingStep(),
            ),

            // Step 4: Details
            Step(
              title: const Text('Variants'),
              subtitle: Text('${_variants.length} rows'),
              isActive: _currentStep >= 3,
              state: _currentStep > 3 ? StepState.complete : StepState.indexed,
              content: _buildVariantsStep(),
            ),

            // Step 5: Details
            Step(
              title: const Text('Details'),
              subtitle: Text('${_specifications.length} specs'),
              isActive: _currentStep >= 4,
              state: StepState.indexed,
              content: _buildDetailsStep(),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildBasicInfoStep() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        TextFormField(
          controller: _nameController,
          decoration: InputDecoration(
            labelText: 'Product Name *',
            hintText: 'e.g., Urban Runner X',
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
          ),
          validator: (value) =>
              value?.isEmpty ?? true ? 'Name is required' : null,
          onChanged: (_) => setState(() {}),
        ),
        const SizedBox(height: 16),

        TextFormField(
          controller: _descriptionController,
          decoration: InputDecoration(
            labelText: 'Description *',
            hintText: 'Describe your product...',
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
            alignLabelWithHint: true,
          ),
          maxLines: 4,
          validator: (value) =>
              value?.isEmpty ?? true ? 'Description is required' : null,
        ),
        const SizedBox(height: 16),

        DropdownButtonFormField<String>(
          value: _categoryId.isNotEmpty ? _categoryId : null,
          decoration: InputDecoration(
            labelText: 'Category',
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
          ),
          items: const [
            DropdownMenuItem(value: 'fashion', child: Text('Fashion')),
            DropdownMenuItem(value: 'electronics', child: Text('Electronics')),
            DropdownMenuItem(value: 'home', child: Text('Home & Living')),
            DropdownMenuItem(value: 'beauty', child: Text('Beauty & Health')),
            DropdownMenuItem(value: 'sports', child: Text('Sports & Outdoors')),
            DropdownMenuItem(value: 'other', child: Text('Other')),
          ],
          onChanged: (value) => setState(() => _categoryId = value ?? ''),
        ),
      ],
    );
  }

  Widget _buildImagesStep() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Add up to 5 product images',
          style: TextStyle(color: Colors.grey),
        ),
        const SizedBox(height: 16),

        Wrap(
          spacing: 12,
          runSpacing: 12,
          children: [
            ..._images.asMap().entries.map(
              (entry) => _buildImageTile(entry.key, entry.value),
            ),
            if (_images.length < 5) _buildAddImageButton(),
          ],
        ),

        if (_images.isNotEmpty) ...[
          const SizedBox(height: 16),
          Text(
            'Drag to reorder. First image is the primary.',
            style: TextStyle(color: Colors.grey[600], fontSize: 12),
          ),
        ],
      ],
    );
  }

  Widget _buildImageTile(int index, String url) {
    return Stack(
      children: [
        Container(
          width: 100,
          height: 100,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(12),
            image: DecorationImage(image: NetworkImage(url), fit: BoxFit.cover),
            border: index == 0
                ? Border.all(color: AppColors.primary, width: 2)
                : null,
          ),
        ),
        Positioned(
          top: 4,
          right: 4,
          child: GestureDetector(
            onTap: () => setState(() => _images.removeAt(index)),
            child: Container(
              padding: const EdgeInsets.all(4),
              decoration: const BoxDecoration(
                color: Colors.red,
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.close, color: Colors.white, size: 14),
            ),
          ),
        ),
        if (index == 0)
          Positioned(
            bottom: 4,
            left: 4,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
              decoration: BoxDecoration(
                color: AppColors.primary,
                borderRadius: BorderRadius.circular(4),
              ),
              child: const Text(
                'Main',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 10,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
          ),
      ],
    );
  }

  Widget _buildAddImageButton() {
    return GestureDetector(
      onTap: _showAddImageDialog,
      child: Container(
        width: 100,
        height: 100,
        decoration: BoxDecoration(
          color: Colors.grey[100],
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: Colors.grey[300]!),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.add_photo_alternate_outlined,
              color: Colors.grey[600],
              size: 32,
            ),
            const SizedBox(height: 4),
            Text(
              'Add Image',
              style: TextStyle(color: Colors.grey[600], fontSize: 12),
            ),
          ],
        ),
      ),
    );
  }

  void _showAddImageDialog() {
    final urlController = TextEditingController();

    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Add Image'),
        content: TextField(
          controller: urlController,
          decoration: const InputDecoration(
            labelText: 'Image URL',
            hintText: 'https://...',
          ),
          autofocus: true,
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () {
              if (urlController.text.isNotEmpty) {
                setState(() => _images.add(urlController.text));
                Navigator.pop(context);
              }
            },
            child: const Text('Add'),
          ),
        ],
      ),
    );
  }

  Widget _buildPricingStep() {
    final salePrice = double.tryParse(_salePriceController.text) ?? 0;
    final originalPrice = double.tryParse(_originalPriceController.text) ?? 0;
    final discount = originalPrice > salePrice && originalPrice > 0
        ? ((originalPrice - salePrice) / originalPrice * 100).round()
        : 0;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: TextFormField(
                controller: _salePriceController,
                decoration: InputDecoration(
                  labelText: 'Sale Price *',
                  prefixText: '₹ ',
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                keyboardType: TextInputType.number,
                inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                validator: (value) =>
                    value?.isEmpty ?? true ? 'Required' : null,
                onChanged: (_) => setState(() {}),
              ),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: TextFormField(
                controller: _originalPriceController,
                decoration: InputDecoration(
                  labelText: 'Original Price',
                  prefixText: '₹ ',
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                  suffixText: discount > 0 ? '$discount% OFF' : null,
                ),
                keyboardType: TextInputType.number,
                inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                onChanged: (_) => setState(() {}),
              ),
            ),
          ],
        ),
        const SizedBox(height: 16),

        TextFormField(
          controller: _stockController,
          decoration: InputDecoration(
            labelText: 'Stock Quantity *',
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
          ),
          keyboardType: TextInputType.number,
          inputFormatters: [FilteringTextInputFormatter.digitsOnly],
          validator: (value) => value?.isEmpty ?? true ? 'Required' : null,
        ),
      ],
    );
  }

  Widget _buildVariantsStep() {
    final basePrice = double.tryParse(_salePriceController.text) ?? 0;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Variant matrix',
          style: Theme.of(context).textTheme.titleMedium?.copyWith(
            fontWeight: FontWeight.w800,
            color: mobile_tokens.LetbuyyColorTokens.slate900,
          ),
        ),
        const SizedBox(height: 6),
        Text(
          'Set SKU, price, and quantity per size, color, or option value.',
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
            color: mobile_tokens.LetbuyyColorTokens.slate600,
          ),
        ),
        const SizedBox(height: 16),
        Row(
          children: [
            Expanded(
              child: TextFormField(
                controller: _skuController,
                decoration: InputDecoration(
                  labelText: 'Base SKU',
                  hintText: 'TEE-BASE',
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
              ),
            ),
            const SizedBox(width: 12),
            ElevatedButton.icon(
              onPressed: _showAddVariantSheet,
              icon: const Icon(Icons.add_rounded),
              label: const Text('Add variant'),
              style: ElevatedButton.styleFrom(
                backgroundColor: mobile_tokens.LetbuyyColorTokens.brandPrimary,
                foregroundColor: mobile_tokens.LetbuyyColorTokens.white,
              ),
            ),
          ],
        ),
        const SizedBox(height: 16),
        if (_variants.isEmpty)
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: mobile_tokens.LetbuyyColorTokens.slate100,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color: mobile_tokens.LetbuyyColorTokens.slate200,
              ),
            ),
            child: const Text(
              'No variants yet. The product will use the base price and stock.',
              textAlign: TextAlign.center,
            ),
          )
        else
          ..._variants.asMap().entries.map((entry) {
            final index = entry.key;
            final variant = entry.value;
            return _buildVariantRow(index, variant, basePrice);
          }),
      ],
    );
  }

  Widget _buildVariantRow(
    int index,
    _ProductVariantDraft variant,
    double basePrice,
  ) {
    final price = variant.price ?? basePrice;
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: mobile_tokens.LetbuyyColorTokens.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: mobile_tokens.LetbuyyColorTokens.slate200),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  variant.title,
                  style: const TextStyle(fontWeight: FontWeight.w800),
                ),
                const SizedBox(height: 4),
                Text(
                  [
                    if (variant.sku.isNotEmpty) variant.sku,
                    '₹${price.toStringAsFixed(price.truncateToDouble() == price ? 0 : 2)}',
                    '${variant.stock} qty',
                  ].join(' · '),
                  style: TextStyle(
                    color: mobile_tokens.LetbuyyColorTokens.slate600,
                    fontSize: 12,
                  ),
                ),
              ],
            ),
          ),
          IconButton(
            tooltip: 'Edit variant',
            onPressed: () => _showEditVariantSheet(index, variant),
            icon: const Icon(Icons.edit_outlined),
          ),
          IconButton(
            tooltip: 'Delete variant',
            onPressed: () => setState(() => _variants.removeAt(index)),
            icon: const Icon(Icons.delete_outline),
            color: mobile_tokens.LetbuyyColorTokens.error,
          ),
        ],
      ),
    );
  }

  Future<void> _showAddVariantSheet() async {
    final draft = await showModalBottomSheet<_ProductVariantDraft>(
      context: context,
      isScrollControlled: true,
      builder: (_) => const _VariantDraftSheet(),
    );
    if (draft == null) return;
    setState(() => _variants.add(draft));
  }

  Future<void> _showEditVariantSheet(
    int index,
    _ProductVariantDraft variant,
  ) async {
    final draft = await showModalBottomSheet<_ProductVariantDraft>(
      context: context,
      isScrollControlled: true,
      builder: (_) => _VariantDraftSheet(variant: variant),
    );
    if (draft == null) return;
    setState(() => _variants[index] = draft);
  }

  Widget _buildDetailsStep() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Badges
        const Text(
          'Badges',
          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
        ),
        const SizedBox(height: 8),

        Wrap(
          spacing: 8,
          children: [
            FilterChip(
              label: const Text('Featured'),
              selected: _isFeatured,
              onSelected: (v) => setState(() => _isFeatured = v),
              selectedColor: Colors.amber.withValues(alpha: 0.2),
              checkmarkColor: Colors.amber,
            ),
            FilterChip(
              label: const Text('Trending'),
              selected: _isTrending,
              onSelected: (v) => setState(() => _isTrending = v),
              selectedColor: Colors.red.withValues(alpha: 0.2),
              checkmarkColor: Colors.red,
            ),
            FilterChip(
              label: const Text('New Arrival'),
              selected: _isNew,
              onSelected: (v) => setState(() => _isNew = v),
              selectedColor: Colors.green.withValues(alpha: 0.2),
              checkmarkColor: Colors.green,
            ),
          ],
        ),

        const SizedBox(height: 24),

        // Specifications
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Text(
              'Specifications',
              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
            ),
            TextButton.icon(
              onPressed: _showAddSpecDialog,
              icon: const Icon(Icons.add, size: 18),
              label: const Text('Add'),
            ),
          ],
        ),

        if (_specifications.isEmpty)
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.grey[100],
              borderRadius: BorderRadius.circular(12),
            ),
            child: const Center(
              child: Text(
                'No specifications added',
                style: TextStyle(color: Colors.grey),
              ),
            ),
          )
        else
          ...List.generate(_specifications.entries.length, (index) {
            final entry = _specifications.entries.elementAt(index);
            return ListTile(
              contentPadding: EdgeInsets.zero,
              title: Text(
                entry.key,
                style: const TextStyle(fontWeight: FontWeight.w600),
              ),
              subtitle: Text(entry.value),
              trailing: IconButton(
                icon: const Icon(Icons.delete_outline, color: Colors.red),
                onPressed: () =>
                    setState(() => _specifications.remove(entry.key)),
              ),
            );
          }),
        const SizedBox(height: 24),
        _buildSeoSection(),
      ],
    );
  }

  Widget _buildSeoSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Search listing',
          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
        ),
        const SizedBox(height: 8),
        TextFormField(
          controller: _handleController,
          decoration: InputDecoration(
            labelText: 'URL handle',
            hintText: 'cotton-tee',
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
          ),
        ),
        const SizedBox(height: 12),
        TextFormField(
          controller: _seoTitleController,
          maxLength: 70,
          decoration: InputDecoration(
            labelText: 'SEO title',
            hintText: _nameController.text.isEmpty
                ? 'Product title'
                : _nameController.text,
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
          ),
        ),
        const SizedBox(height: 12),
        TextFormField(
          controller: _seoDescriptionController,
          maxLength: 160,
          maxLines: 3,
          decoration: InputDecoration(
            labelText: 'Meta description',
            hintText: _descriptionController.text.isEmpty
                ? 'Short product summary'
                : _descriptionController.text,
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
            alignLabelWithHint: true,
          ),
        ),
      ],
    );
  }

  void _showAddSpecDialog() {
    _specKeyController.clear();
    _specValueController.clear();

    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Add Specification'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: _specKeyController,
              decoration: const InputDecoration(
                labelText: 'Name (e.g., Material)',
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _specValueController,
              decoration: const InputDecoration(
                labelText: 'Value (e.g., Cotton)',
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () {
              if (_specKeyController.text.isNotEmpty &&
                  _specValueController.text.isNotEmpty) {
                setState(
                  () => _specifications[_specKeyController.text] =
                      _specValueController.text,
                );
                Navigator.pop(context);
              }
            },
            child: const Text('Add'),
          ),
        ],
      ),
    );
  }

  void _nextStep() {
    if (_currentStep < _lastStepIndex) {
      setState(() => _currentStep++);
    }
  }

  void _previousStep() {
    if (_currentStep > 0) {
      setState(() => _currentStep--);
    }
  }

  Future<void> _submitProduct() async {
    if (!_formKey.currentState!.validate()) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please fill required fields')),
      );
      return;
    }

    if (_images.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please add at least one image')),
      );
      return;
    }

    setState(() => _isLoading = true);

    try {
      final productService = context.read<ProductService>();

      final store = await context.read<StoreContext>().ensureSelectedStore();
      if (store == null) throw Exception('No store found');

      if (widget.product != null) {
        // Update existing
        await productService.updateProduct(widget.product!.id, {
          'name': _nameController.text,
          'description': _descriptionController.text,
          'price': double.parse(_salePriceController.text),
          'compare_price': _originalPriceController.text.isNotEmpty
              ? double.parse(_originalPriceController.text)
              : null,
          'stock': int.parse(_stockController.text),
          'sku': _skuController.text.trim().isEmpty
              ? null
              : _skuController.text.trim(),
          'url_handle': _nullableTrim(_handleController.text),
          'seo_title': _nullableTrim(_seoTitleController.text),
          'seo_description': _nullableTrim(_seoDescriptionController.text),
          'category': _categoryId,
          'images': _images,
          'is_featured': _isFeatured,
          'variants': _variantPayloads(),
        });
      } else {
        // Create new
        await productService.createProduct(
          storeId: store.id,
          name: _nameController.text,
          description: _descriptionController.text,
          price: double.parse(_salePriceController.text),
          comparePrice: _originalPriceController.text.isNotEmpty
              ? double.parse(_originalPriceController.text)
              : null,
          stock: int.parse(_stockController.text),
          category: _categoryId.isNotEmpty ? _categoryId : 'other',
          sku: _skuController.text.trim().isEmpty
              ? null
              : _skuController.text.trim(),
          urlHandle: _nullableTrim(_handleController.text),
          seoTitle: _nullableTrim(_seoTitleController.text),
          seoDescription: _nullableTrim(_seoDescriptionController.text),
          images: _images,
          isFeatured: _isFeatured,
          variants: _variants.isEmpty ? null : _variantPayloads(),
        );
      }

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              widget.product != null ? 'Product updated!' : 'Product created!',
            ),
          ),
        );
        Navigator.pop(context, true); // Return true to indicate success
      }
    } catch (e) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('Error: $e')));
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  List<Map<String, dynamic>> _variantPayloads() {
    return _variants.map((variant) => variant.toJson()).toList(growable: false);
  }

  String? _nullableTrim(String value) {
    final trimmed = value.trim();
    return trimmed.isEmpty ? null : trimmed;
  }
}

class _ProductVariantDraft {
  const _ProductVariantDraft({
    required this.title,
    required this.sku,
    required this.price,
    required this.comparePrice,
    required this.stock,
    required this.optionName,
    required this.optionValue,
  });

  factory _ProductVariantDraft.fromContract(ProductVariantContract contract) {
    String optionName = 'Option';
    String optionValue = contract.title;
    if (contract.options.isNotEmpty) {
      final first = contract.options.entries.first;
      optionName = first.key;
      optionValue = '${first.value}';
    }
    final stock = contract.stock > 0
        ? contract.stock
        : contract.inventoryQuantity;
    return _ProductVariantDraft(
      title: contract.title,
      sku: contract.sku ?? '',
      price: contract.price,
      comparePrice: contract['compare_price'] is num
          ? (contract['compare_price'] as num).toDouble()
          : null,
      stock: stock,
      optionName: optionName,
      optionValue: optionValue,
    );
  }

  final String title;
  final String sku;
  final double? price;
  final double? comparePrice;
  final int stock;
  final String optionName;
  final String optionValue;

  Map<String, dynamic> toJson() => {
    'title': title,
    if (sku.isNotEmpty) 'sku': sku,
    if (price != null) 'price': price,
    if (comparePrice != null) 'compare_price': comparePrice,
    'stock': stock,
    'options': {
      if (optionName.isNotEmpty && optionValue.isNotEmpty)
        optionName: optionValue,
    },
  };
}

class _VariantDraftSheet extends StatefulWidget {
  const _VariantDraftSheet({this.variant});

  final _ProductVariantDraft? variant;

  @override
  State<_VariantDraftSheet> createState() => _VariantDraftSheetState();
}

class _VariantDraftSheetState extends State<_VariantDraftSheet> {
  final _formKey = GlobalKey<FormState>();
  final _titleController = TextEditingController();
  final _skuController = TextEditingController();
  final _priceController = TextEditingController();
  final _comparePriceController = TextEditingController();
  final _stockController = TextEditingController();
  final _optionNameController = TextEditingController();
  final _optionValueController = TextEditingController();

  @override
  void initState() {
    super.initState();
    final variant = widget.variant;
    _titleController.text = variant?.title ?? '';
    _skuController.text = variant?.sku ?? '';
    _priceController.text = variant?.price?.toString() ?? '';
    _comparePriceController.text = variant?.comparePrice?.toString() ?? '';
    _stockController.text = variant?.stock.toString() ?? '0';
    _optionNameController.text = variant?.optionName ?? 'Size';
    _optionValueController.text = variant?.optionValue ?? '';
  }

  @override
  void dispose() {
    _titleController.dispose();
    _skuController.dispose();
    _priceController.dispose();
    _comparePriceController.dispose();
    _stockController.dispose();
    _optionNameController.dispose();
    _optionValueController.dispose();
    super.dispose();
  }

  void _save() {
    if (!_formKey.currentState!.validate()) return;
    final title = _titleController.text.trim().isEmpty
        ? _optionValueController.text.trim()
        : _titleController.text.trim();
    Navigator.of(context).pop(
      _ProductVariantDraft(
        title: title,
        sku: _skuController.text.trim(),
        price: double.tryParse(_priceController.text),
        comparePrice: double.tryParse(_comparePriceController.text),
        stock: int.tryParse(_stockController.text) ?? 0,
        optionName: _optionNameController.text.trim(),
        optionValue: _optionValueController.text.trim(),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isEdit = widget.variant != null;
    return Padding(
      padding: EdgeInsets.only(
        left: 20,
        right: 20,
        top: 20,
        bottom: MediaQuery.of(context).viewInsets.bottom + 20,
      ),
      child: Form(
        key: _formKey,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              isEdit ? 'Edit variant' : 'Add variant',
              style: Theme.of(
                context,
              ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: TextFormField(
                    controller: _optionNameController,
                    decoration: const InputDecoration(labelText: 'Option'),
                    validator: (value) =>
                        value?.trim().isEmpty == true ? 'Required' : null,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: TextFormField(
                    controller: _optionValueController,
                    decoration: const InputDecoration(labelText: 'Value'),
                    validator: (value) =>
                        value?.trim().isEmpty == true ? 'Required' : null,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _titleController,
              decoration: const InputDecoration(
                labelText: 'Variant title',
                hintText: 'Blue / XL',
              ),
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _skuController,
              decoration: const InputDecoration(labelText: 'SKU'),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: TextFormField(
                    controller: _priceController,
                    decoration: const InputDecoration(
                      labelText: 'Price',
                      prefixText: '₹ ',
                    ),
                    keyboardType: TextInputType.number,
                    inputFormatters: [
                      FilteringTextInputFormatter.allow(RegExp(r'[0-9.]')),
                    ],
                    validator: (value) =>
                        value?.trim().isEmpty == true ? 'Required' : null,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: TextFormField(
                    controller: _stockController,
                    decoration: const InputDecoration(labelText: 'Quantity'),
                    keyboardType: TextInputType.number,
                    inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                    validator: (value) =>
                        value?.trim().isEmpty == true ? 'Required' : null,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _comparePriceController,
              decoration: const InputDecoration(
                labelText: 'Compare price',
                prefixText: '₹ ',
              ),
              keyboardType: TextInputType.number,
              inputFormatters: [
                FilteringTextInputFormatter.allow(RegExp(r'[0-9.]')),
              ],
            ),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: _save,
                icon: const Icon(Icons.check_rounded),
                label: Text(isEdit ? 'Save variant' : 'Add variant'),
                style: ElevatedButton.styleFrom(
                  backgroundColor:
                      mobile_tokens.LetbuyyColorTokens.brandPrimary,
                  foregroundColor: mobile_tokens.LetbuyyColorTokens.white,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
