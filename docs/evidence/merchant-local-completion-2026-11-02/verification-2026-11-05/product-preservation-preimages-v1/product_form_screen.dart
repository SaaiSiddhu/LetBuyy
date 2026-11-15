import 'dart:io';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';
import 'package:uuid/uuid.dart';
import '../../app/store_context.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:letbuyy_models/letbuyy_models.dart';
import '../../services/product_service.dart';
import '../../services/api_client.dart';
import 'package:letbuyy_core/letbuyy_core.dart';
import '../../widgets/shared/barcode_scanner_sheet.dart';
import '../../widgets/shared/cached_merchant_image.dart';
import '../../widgets/shared/merchant_media_picker.dart';

/// Product Form Screen for Store Builder
/// Simplified product creation with essential fields
class ProductFormScreen extends StatefulWidget {
  final ProductContract? product; // null for new, populated for edit

  const ProductFormScreen({super.key, this.product});

  @override
  State<ProductFormScreen> createState() => _ProductFormScreenState();
}

enum _ProductImageAction { camera, gallery, url }

class _ProductFormScreenState extends State<ProductFormScreen> {
  static const _lastStepIndex = 4;

  final _formKey = GlobalKey<FormState>();
  int _currentStep = 0;
  bool _isLoading = false;
  bool _loadingEdit = false;
  bool _editBlocked = false;
  ProductContract? _baseProduct;
  ProductContract? _latestProduct;
  String? _editMessage;
  ({String key, int version, String signature, Map<String, dynamic> fields})?
  _pendingEdit;

  // Form Controllers
  final _nameController = TextEditingController();
  final _descriptionController = TextEditingController();
  final _salePriceController = TextEditingController();
  final _originalPriceController = TextEditingController();
  final _stockController = TextEditingController();
  final _skuController = TextEditingController();
  final _barcodeController = TextEditingController();
  final _productTypeController = TextEditingController();
  final _vendorController = TextEditingController();
  final _countryOfOriginController = TextEditingController();
  final _importerDetailsController = TextEditingController();
  final _tagsController = TextEditingController();
  final _handleController = TextEditingController();
  final _seoTitleController = TextEditingController();
  final _seoDescriptionController = TextEditingController();

  // Form Data
  List<String> _images = [];
  List<_ProductVariantDraft> _variants = [];
  String _categoryId = '';
  Map<String, String> _specifications = {};
  bool _isFeatured = false;

  String _presentationBaseline = '';
  bool _shortFormOpen = false;
  List<TextEditingController> get _draftControllers => [
    _nameController,
    _descriptionController,
    _salePriceController,
    _originalPriceController,
    _stockController,
    _skuController,
    _barcodeController,
    _productTypeController,
    _vendorController,
    _countryOfOriginController,
    _importerDetailsController,
    _tagsController,
    _handleController,
    _seoTitleController,
    _seoDescriptionController,
  ];
  void _draftChanged() {
    if (mounted) setState(() {});
  }

  bool get _hasChanges =>
      _pendingEdit != null || _presentationBaseline != _editDraftSignature();
  bool get _canOpenDraft =>
      _formCurrent &&
      !_isLoading &&
      !_loadingEdit &&
      (ModalRoute.of(context)?.isCurrent ?? true);

  Object? _boundContext;
  String? _boundStoreId;
  bool _retired = false, _editAuthorized = false;
  bool get _formCurrent =>
      mounted &&
      !_retired &&
      _boundStoreId != null &&
      context.read<StoreContext>().requestContextKey == _boundContext &&
      context.read<StoreContext>().selectedStoreId == _boundStoreId;

  Widget _retiredSurface() => Scaffold(
    appBar: AppBar(title: const Text('Store access changed')),
    body: Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text(
              'Close this form and reopen it from the selected store. The previous draft cannot be submitted here.',
            ),
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Close'),
            ),
          ],
        ),
      ),
    ),
  );

  Widget _guardFormSurface(Widget child) => Consumer<StoreContext>(
    builder: (_, stores, __) => _formCurrent ? child : _retiredSurface(),
  );

  // Specifications form
  final _specKeyController = TextEditingController();
  final _specValueController = TextEditingController();

  @override
  void initState() {
    super.initState();
    final stores = context.read<StoreContext>();
    _boundContext = stores.requestContextKey;
    _boundStoreId = widget.product?.storeId ?? stores.selectedStoreId;
    _editAuthorized = widget.product == null;
    _initData();
    for (final controller in _draftControllers) {
      controller.addListener(_draftChanged);
    }
    if (widget.product != null) {
      _loadingEdit = true;
      WidgetsBinding.instance.addPostFrameCallback(
        (_) => _checkLatestProduct(initial: true),
      );
    }
  }

  void _initData([ProductContract? product]) {
    final p = product ?? widget.product;
    if (p != null) {
      _baseProduct = p;
      _nameController.text = p.name;
      _descriptionController.text = p.description;
      _salePriceController.text = p.price.toString();
      _originalPriceController.text = p.comparePrice?.toString() ?? '';
      _stockController.text = p.stock.toString();
      _skuController.text = p.sku ?? '';
      _barcodeController.text = p.barcode ?? '';
      _productTypeController.text = '${p['product_type'] ?? ''}';
      _vendorController.text = '${p['vendor'] ?? ''}';
      _countryOfOriginController.text = p.countryOfOrigin ?? '';
      _importerDetailsController.text = p.importerDetails ?? '';
      _tagsController.text = p.tags.join(', ');
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
    }
    _presentationBaseline = _editDraftSignature();
  }

  @override
  void dispose() {
    for (final controller in _draftControllers) {
      controller.removeListener(_draftChanged);
    }
    _nameController.dispose();
    _descriptionController.dispose();
    _salePriceController.dispose();
    _originalPriceController.dispose();
    _stockController.dispose();
    _skuController.dispose();
    _barcodeController.dispose();
    _productTypeController.dispose();
    _vendorController.dispose();
    _countryOfOriginController.dispose();
    _importerDetailsController.dispose();
    _tagsController.dispose();
    _handleController.dispose();
    _seoTitleController.dispose();
    _seoDescriptionController.dispose();
    _specKeyController.dispose();
    _specValueController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final stores = context.watch<StoreContext>();
    if (stores.requestContextKey != _boundContext ||
        stores.selectedStoreId != _boundStoreId)
      _retired = true;
    if (!_formCurrent) return _retiredSurface();
    final isEdit = widget.product != null;
    if (!_editAuthorized)
      return Scaffold(
        appBar: CustomAppBar.responsive(
          context: context,
          title: 'Load product',
        ),
        body: SafeArea(
          child: _loadingEdit
              ? const Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      LoadingIndicator(),
                      SizedBox(height: 16),
                      Text('Loading the current product…'),
                    ],
                  ),
                )
              : ErrorView(
                  title: 'Product unavailable',
                  message:
                      'The current complete product could not be loaded. Check store access and retry.',
                  onRetry: () => _checkLatestProduct(initial: true),
                  retryLabel: 'Retry product',
                ),
        ),
      );
    return LetbuyyEditorScaffold(
      title: isEdit ? 'Edit Product' : 'Add Product',
      hasChanges: _hasChanges,
      currentHasChanges: () => _hasChanges,
      currentIsBusy: () => _isLoading || _loadingEdit,
      isBusy: _isLoading || _loadingEdit,
      discardTitle: _pendingEdit != null
          ? 'Leave unconfirmed save?'
          : 'Discard product draft?',
      discardMessage: _pendingEdit != null
          ? 'This save may already be committed. Its retry handle is kept only in this open editor and will be lost on closing. Check the catalog before starting another save.'
          : 'The unsaved changes in this editor will be discarded. Closing does not cancel an earlier server request or uploaded image.',
      discardLabel: _pendingEdit != null ? 'Leave editor' : 'Discard changes',
      confirmationGuard: (_, confirmation) => _guardFormSurface(confirmation),
      actions: SizedBox(
        width: double.infinity,
        child: FilledButton.icon(
          onPressed:
              _isLoading ||
                  _loadingEdit ||
                  (_editBlocked && _pendingEdit == null)
              ? null
              : _submitProduct,
          icon: Icon(_isLoading ? Icons.hourglass_top : Icons.check),
          label: Text(
            _isLoading
                ? 'Saving product…'
                : _pendingEdit != null
                ? 'Retry pending save'
                : isEdit
                ? 'Update'
                : 'Save',
          ),
        ),
      ),
      body: Form(
        key: _formKey,
        child: LetbuyyEditorSteps(
          currentStep: _currentStep,
          enabled: !_loadingEdit,
          labels: const [
            'Basic Info',
            'Images',
            'Pricing',
            'Variants',
            'Details',
          ],
          onStepChanged: (step) {
            if (step == _currentStep + 1) {
              _nextStep();
            } else if (step == _currentStep - 1) {
              _previousStep();
            } else {
              setState(() => _currentStep = step);
            }
          },
          notice: _loadingEdit || _editMessage != null
              ? Card(
                  child: Padding(
                    padding: const EdgeInsets.all(LetbuyySpacingTokens.space16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Semantics(
                          liveRegion: true,
                          child: Text(
                            _loadingEdit
                                ? 'Loading the current product…'
                                : _editMessage!,
                          ),
                        ),
                        Wrap(
                          spacing: 12,
                          runSpacing: 8,
                          children: [
                            if (!_loadingEdit &&
                                _pendingEdit == null &&
                                _editBlocked)
                              TextButton(
                                onPressed: _checkLatestProduct,
                                child: const Text('Check latest product'),
                              ),
                            if (_latestProduct != null)
                              TextButton(
                                onPressed: () => setState(() {
                                  _initData(_latestProduct);
                                  _latestProduct = null;
                                  _editBlocked = false;
                                  _editMessage = null;
                                }),
                                child: const Text(
                                  'Reload latest and discard my edits',
                                ),
                              ),
                          ],
                        ),
                      ],
                    ),
                  ),
                )
              : null,
          sections: [
            _buildBasicInfoStep(),
            _buildImagesStep(),
            _buildPricingStep(),
            _buildVariantsStep(),
            _buildDetailsStep(),
          ],
        ),
      ),
    );
  }

  Widget _buildBasicInfoStep() => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      CustomTextField(
        controller: _nameController,
        label: 'Product Name *',
        hint: 'e.g., Urban Runner X',
        validator: (value) =>
            value?.isEmpty ?? true ? 'Name is required' : null,
        textInputAction: TextInputAction.next,
      ),
      const SizedBox(height: 16),
      CustomTextField(
        controller: _descriptionController,
        label: widget.product == null ? 'Description *' : 'Description',
        hint: 'Describe your product...',
        maxLines: 4,
        validator: (value) => widget.product == null && (value?.isEmpty ?? true)
            ? 'Description is required'
            : null,
      ),
      const SizedBox(height: 16),
      LetbuyyChoiceField<String>(
        label: 'Category',
        value: _categoryId.isEmpty ? null : _categoryId,
        choices: [
          if (_categoryId.isNotEmpty &&
              !const [
                'fashion',
                'electronics',
                'home',
                'beauty',
                'sports',
                'other',
              ].contains(_categoryId))
            LetbuyyChoice(
              value: _categoryId,
              label: 'Current category: $_categoryId',
            ),
          const LetbuyyChoice(value: 'fashion', label: 'Fashion'),
          const LetbuyyChoice(value: 'electronics', label: 'Electronics'),
          const LetbuyyChoice(value: 'home', label: 'Home & Living'),
          const LetbuyyChoice(value: 'beauty', label: 'Beauty & Health'),
          const LetbuyyChoice(value: 'sports', label: 'Sports & Outdoors'),
          const LetbuyyChoice(value: 'other', label: 'Other'),
        ],
        onChanged: (value) => setState(() => _categoryId = value),
      ),
    ],
  );

  Widget _buildImagesStep() => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      const Text('Add up to 5 product images. The first image is the primary.'),
      const SizedBox(height: 16),
      for (final entry in _images.asMap().entries)
        _buildImageTile(entry.key, entry.value),
      if (_images.length < 5) _buildAddImageButton(),
    ],
  );

  Widget _buildImageTile(int index, String url) => Card(
    child: Padding(
      padding: const EdgeInsets.all(12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Semantics(
            container: true,
            image: true,
            label: 'Product image ${index + 1}${index == 0 ? ', primary' : ''}',
            child: ExcludeSemantics(
              child: SizedBox(
                height: 140,
                child: CachedMerchantImage(imageUrl: url, fit: BoxFit.contain),
              ),
            ),
          ),
          ExcludeSemantics(
            child: Text('Image ${index + 1}${index == 0 ? ' · Primary' : ''}'),
          ),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              if (index > 0)
                OutlinedButton.icon(
                  onPressed: () => setState(() {
                    final value = _images.removeAt(index);
                    _images.insert(index - 1, value);
                  }),
                  icon: const Icon(Icons.arrow_upward),
                  label: Text('Move image ${index + 1} earlier'),
                ),
              if (index < _images.length - 1)
                OutlinedButton.icon(
                  onPressed: () => setState(() {
                    final value = _images.removeAt(index);
                    _images.insert(index + 1, value);
                  }),
                  icon: const Icon(Icons.arrow_downward),
                  label: Text('Move image ${index + 1} later'),
                ),
              TextButton.icon(
                onPressed: () => setState(() => _images.removeAt(index)),
                icon: const Icon(Icons.delete_outline),
                label: Text('Remove product image ${index + 1}'),
              ),
            ],
          ),
        ],
      ),
    ),
  );

  Widget _buildAddImageButton() => OutlinedButton.icon(
    onPressed: _showAddImageDialog,
    icon: const Icon(Icons.add_photo_alternate_outlined),
    label: const Text('Add Image'),
  );

  Future<void> _showAddImageDialog() async {
    if (!_canOpenDraft || _shortFormOpen) return;
    setState(() => _shortFormOpen = true);
    _ProductImageAction? action;
    try {
      action = await showLetbuyyFormSheet<_ProductImageAction>(
        context: context,
        builder: (sheet) => _guardFormSurface(
          LetbuyyFormSheet(
            title: 'Add product image',
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(sheet),
                child: const Text('Cancel'),
              ),
            ],
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                ListTile(
                  leading: const Icon(Icons.photo_camera_outlined),
                  title: const Text('Take photo'),
                  onTap: () => Navigator.pop(sheet, _ProductImageAction.camera),
                ),
                ListTile(
                  leading: const Icon(Icons.photo_library_outlined),
                  title: const Text('Photo library'),
                  onTap: () =>
                      Navigator.pop(sheet, _ProductImageAction.gallery),
                ),
                ListTile(
                  leading: const Icon(Icons.link_outlined),
                  title: const Text('Image URL'),
                  onTap: () => Navigator.pop(sheet, _ProductImageAction.url),
                ),
              ],
            ),
          ),
        ),
      );
    } finally {
      if (mounted) setState(() => _shortFormOpen = false);
    }
    if (!_formCurrent) return;
    switch (action) {
      case _ProductImageAction.camera:
        await _pickAndUploadProductImage(ImageSource.camera);
      case _ProductImageAction.gallery:
        await _pickAndUploadProductImage(ImageSource.gallery);
      case _ProductImageAction.url:
        await _showAddImageUrlDialog();
      case null:
        return;
    }
  }

  Future<void> _pickAndUploadProductImage(ImageSource source) async {
    if (!_formCurrent || _isLoading || _images.length >= 5) return;

    setState(() => _isLoading = true);
    try {
      final image = await pickMerchantMedia(
        context,
        source: source,
        pick: () => ImagePicker().pickImage(
          source: source,
          maxWidth: 1600,
          imageQuality: 88,
        ),
      );
      if (!_formCurrent || image == null) return;
      final imageUrl = await context.read<ProductService>().uploadProductImage(
        File(image.path),
        storeId: _boundStoreId!,
      );
      if (!_formCurrent) return;
      setState(() => _images.add(imageUrl));
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Product image added.')));
    } catch (_) {
      if (!_formCurrent) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Could not upload product image.')),
      );
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _showAddImageUrlDialog() async {
    if (!_formCurrent || _shortFormOpen || _images.length >= 5) return;
    var url = '';
    setState(() => _shortFormOpen = true);
    try {
      final value = await showLetbuyyFormSheet<String>(
        context: context,
        builder: (sheet) => _guardFormSurface(
          LetbuyyFormSheet(
            title: 'Add Image',
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(sheet),
                child: const Text('Cancel'),
              ),
              FilledButton(
                onPressed: () {
                  if (url.isNotEmpty) Navigator.pop(sheet, url);
                },
                child: const Text('Add'),
              ),
            ],
            child: CustomTextField(
              onChanged: (value) => url = value,
              label: 'Image URL',
              hint: 'https://...',
              autofocus: true,
              keyboardType: TextInputType.url,
            ),
          ),
        ),
      );
      if (_formCurrent && value != null && _images.length < 5)
        setState(() => _images.add(value));
    } finally {
      if (mounted) setState(() => _shortFormOpen = false);
    }
  }

  Widget _buildPricingStep() {
    final salePrice = double.tryParse(_salePriceController.text) ?? 0;
    final originalPrice = double.tryParse(_originalPriceController.text) ?? 0;
    final discount = originalPrice > salePrice && originalPrice > 0
        ? ((originalPrice - salePrice) / originalPrice * 100).round()
        : 0;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        CustomTextField(
          controller: _salePriceController,
          label: 'Sale Price *',
          helperText: 'Rupees (INR)',
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
          inputFormatters: [_decimalInput()],
          validator: (value) => value?.isEmpty ?? true ? 'Required' : null,
        ),
        const SizedBox(height: 16),
        CustomTextField(
          controller: _originalPriceController,
          label: 'Original Price',
          helperText: discount > 0
              ? 'Rupees (INR) · $discount% OFF'
              : 'Rupees (INR)',
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
          inputFormatters: [_decimalInput()],
        ),
        const SizedBox(height: 16),
        CustomTextField(
          controller: _stockController,
          label: 'Stock Quantity *',
          helperText: 'Available for sale. Existing reservations remain held.',
          keyboardType: TextInputType.number,
          inputFormatters: [FilteringTextInputFormatter.digitsOnly],
          validator: (value) => value?.isEmpty ?? true ? 'Required' : null,
        ),
      ],
    );
  }

  Widget _buildVariantsStep() => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      Text('Variant matrix', style: Theme.of(context).textTheme.titleMedium),
      const Text(
        'Set SKU, price, and quantity per size, color, or option value.',
      ),
      const SizedBox(height: 16),
      CustomTextField(
        controller: _skuController,
        label: 'Base SKU',
        hint: 'TEE-BASE',
      ),
      const SizedBox(height: 12),
      CustomTextField(
        controller: _barcodeController,
        label: 'Barcode',
        hint: '8901234567890',
        suffixIcon: IconButton(
          tooltip: 'Scan barcode',
          icon: const Icon(Icons.qr_code_scanner_rounded),
          onPressed: _scanBaseBarcode,
        ),
      ),
      const SizedBox(height: 12),
      OutlinedButton.icon(
        onPressed: _showAddVariantSheet,
        icon: const Icon(Icons.add),
        label: const Text('Add variant'),
      ),
      if (_variants.isEmpty)
        const Padding(
          padding: EdgeInsets.symmetric(vertical: 16),
          child: Text(
            'No variants yet. The product will use the base price and stock.',
          ),
        ),
      for (final entry in _variants.asMap().entries)
        _buildVariantRow(
          entry.key,
          entry.value,
          double.tryParse(_salePriceController.text) ?? 0,
        ),
    ],
  );

  Widget _buildVariantRow(
    int index,
    _ProductVariantDraft variant,
    double basePrice,
  ) {
    final price = variant.price ?? basePrice;
    final variantLabel = variant.title.trim().isEmpty
        ? 'variant ${index + 1}'
        : variant.title.trim();
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(variant.title, style: Theme.of(context).textTheme.titleMedium),
            Text(
              [
                if (variant.sku.isNotEmpty) variant.sku,
                PriceFormatter.formatPrice(price),
                '${variant.stock} qty',
              ].join(' · '),
            ),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                TextButton.icon(
                  onPressed: () => _showEditVariantSheet(index, variant),
                  icon: const Icon(Icons.edit_outlined),
                  label: Text('Edit $variantLabel variant'),
                ),
                TextButton.icon(
                  onPressed: () => setState(() => _variants.removeAt(index)),
                  icon: const Icon(Icons.delete_outline),
                  label: Text('Delete $variantLabel variant'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _showAddVariantSheet() async {
    if (!_canOpenDraft) return;
    final draft = await Navigator.push<_ProductVariantDraft>(
      context,
      MaterialPageRoute(
        builder: (_) => _guardFormSurface(const _VariantDraftSheet()),
      ),
    );
    if (!_formCurrent || draft == null) return;
    setState(() => _variants.add(draft));
  }

  Future<void> _showEditVariantSheet(
    int index,
    _ProductVariantDraft variant,
  ) async {
    if (!_canOpenDraft) return;
    final draft = await Navigator.push<_ProductVariantDraft>(
      context,
      MaterialPageRoute(
        builder: (_) => _guardFormSurface(_VariantDraftSheet(variant: variant)),
      ),
    );
    if (!_formCurrent || draft == null) return;
    setState(() => _variants[index] = draft);
  }

  Future<void> _scanBaseBarcode() async {
    final barcode = await showBarcodeScannerSheet(
      context,
      title: 'Scan product barcode',
    );
    if (!_formCurrent || barcode == null || barcode.trim().isEmpty) return;
    setState(() => _barcodeController.text = barcode.trim());
  }

  Widget _buildDetailsStep() => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      Text('Classification', style: Theme.of(context).textTheme.titleMedium),
      const SizedBox(height: 12),
      CustomTextField(
        controller: _productTypeController,
        label: 'Product type',
        hint: 'T-shirt',
      ),
      const SizedBox(height: 12),
      CustomTextField(
        controller: _vendorController,
        label: 'Vendor',
        hint: 'LetBuyy Basics',
      ),
      const SizedBox(height: 12),
      CustomTextField(
        key: const ValueKey('country-of-origin'),
        controller: _countryOfOriginController,
        label: 'Country of origin (optional)',
        hint: 'e.g., India',
        maxLength: 100,
        textCapitalization: TextCapitalization.words,
      ),
      const SizedBox(height: 12),
      CustomTextField(
        key: const ValueKey('importer-details'),
        controller: _importerDetailsController,
        label: 'Importer details (optional)',
        hint: 'Importer name and contact details',
        helperText:
            'Shown publicly on the product page when saved. Seller-entered and not verified by LetBuyy.',
        maxLength: 1000,
        minLines: 2,
        maxLines: 4,
        textCapitalization: TextCapitalization.sentences,
      ),
      const SizedBox(height: 12),
      CustomTextField(
        controller: _tagsController,
        label: 'Tags',
        hint: 'cotton, summer, handmade',
        maxLines: 2,
      ),
      const SizedBox(height: 24),
      Text('Badges', style: Theme.of(context).textTheme.titleMedium),
      SwitchListTile(
        contentPadding: EdgeInsets.zero,
        title: const Text('Featured'),
        value: _isFeatured,
        onChanged: (value) => setState(() => _isFeatured = value),
      ),
      const Text('Trending and New Arrival cannot be saved from this editor.'),
      const SizedBox(height: 24),
      Text('Specifications', style: Theme.of(context).textTheme.titleMedium),
      Align(
        alignment: AlignmentDirectional.centerStart,
        child: TextButton.icon(
          onPressed: _showAddSpecDialog,
          icon: const Icon(Icons.add),
          label: const Text('Add specification'),
        ),
      ),
      if (_specifications.isEmpty) const Text('No specifications added'),
      for (final entry in _specifications.entries)
        Card(
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(entry.key, style: Theme.of(context).textTheme.titleSmall),
                Text(entry.value),
                Align(
                  alignment: AlignmentDirectional.centerStart,
                  child: TextButton.icon(
                    onPressed: () =>
                        setState(() => _specifications.remove(entry.key)),
                    icon: const Icon(Icons.delete_outline),
                    label: Text('Remove specification ${entry.key}'),
                  ),
                ),
              ],
            ),
          ),
        ),
      const SizedBox(height: 24),
      _buildSeoSection(),
    ],
  );

  Widget _buildSeoSection() => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      Text('Search listing', style: Theme.of(context).textTheme.titleMedium),
      const SizedBox(height: 12),
      CustomTextField(
        controller: _handleController,
        label: 'URL handle',
        hint: 'cotton-tee',
      ),
      const SizedBox(height: 12),
      CustomTextField(
        controller: _seoTitleController,
        label: 'SEO title',
        maxLength: 70,
        hint: _nameController.text.isEmpty
            ? 'Product title'
            : _nameController.text,
      ),
      const SizedBox(height: 12),
      CustomTextField(
        controller: _seoDescriptionController,
        label: 'Meta description',
        maxLength: 160,
        maxLines: 3,
        hint: _descriptionController.text.isEmpty
            ? 'Short product summary'
            : _descriptionController.text,
      ),
    ],
  );

  Future<void> _showAddSpecDialog() async {
    if (!_canOpenDraft || _shortFormOpen) return;
    _specKeyController.clear();
    _specValueController.clear();
    setState(() => _shortFormOpen = true);
    try {
      final result = await showLetbuyyFormSheet<({String name, String value})>(
        context: context,
        builder: (sheet) => _guardFormSurface(
          LetbuyyFormSheet(
            title: 'Add Specification',
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(sheet),
                child: const Text('Cancel'),
              ),
              FilledButton(
                onPressed: () {
                  if (_specKeyController.text.isNotEmpty &&
                      _specValueController.text.isNotEmpty)
                    Navigator.pop(sheet, (
                      name: _specKeyController.text,
                      value: _specValueController.text,
                    ));
                },
                child: const Text('Add'),
              ),
            ],
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                CustomTextField(
                  controller: _specKeyController,
                  label: 'Name (e.g., Material)',
                  autofocus: true,
                  textInputAction: TextInputAction.next,
                ),
                const SizedBox(height: 12),
                CustomTextField(
                  controller: _specValueController,
                  label: 'Value (e.g., Cotton)',
                ),
              ],
            ),
          ),
        ),
      );
      if (_formCurrent && result != null)
        setState(() => _specifications[result.name] = result.value);
    } finally {
      if (mounted) setState(() => _shortFormOpen = false);
    }
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
    if (!_formCurrent || _isLoading) return;
    if (_pendingEdit == null && !_formKey.currentState!.validate()) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please fill required fields')),
      );
      return;
    }

    if (widget.product == null && _pendingEdit == null && _images.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please add at least one image')),
      );
      return;
    }

    setState(() => _isLoading = true);

    try {
      final productService = context.read<ProductService>();

      final store = await context.read<StoreContext>().ensureSelectedStore();
      if (!_formCurrent || store?.id != _boundStoreId) return;
      if (store == null) return;

      if (widget.product != null) {
        // Update existing
        await _saveExistingProduct(productService, store.id);
        return;
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
          barcode: _barcodeController.text.trim().isEmpty
              ? null
              : _barcodeController.text.trim(),
          urlHandle: _nullableTrim(_handleController.text),
          seoTitle: _nullableTrim(_seoTitleController.text),
          seoDescription: _nullableTrim(_seoDescriptionController.text),
          images: _images,
          isFeatured: _isFeatured,
          productType: _nullableTrim(_productTypeController.text),
          vendor: _nullableTrim(_vendorController.text),
          countryOfOrigin: _nullableTrim(_countryOfOriginController.text),
          importerDetails: _nullableTrim(_importerDetailsController.text),
          tags: _tagValues(),
          metadata: _metadataPayload(),
          variants: _variants.isEmpty ? null : _variantPayloads(),
        );
      }

      if (_formCurrent) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              widget.product != null ? 'Product updated!' : 'Product created!',
            ),
          ),
        );
        Navigator.pop(context, true); // Return true to indicate success
      }
    } catch (_) {
      if (!_formCurrent) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'The product save could not be confirmed. Check the catalog before retrying.',
          ),
        ),
      );
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _checkLatestProduct({bool initial = false}) async {
    final original = widget.product;
    if (!_formCurrent || original == null) return;
    setState(() => _loadingEdit = true);
    try {
      final latest = await context.read<ProductService>().fetchProductForEdit(
        original.id,
        original.storeId,
      );
      if (!_formCurrent) return;
      final rawPrice = latest['price'], rawStock = latest['stock'];
      if (rawPrice is! num ||
          !rawPrice.isFinite ||
          rawStock is! num ||
          !rawStock.isFinite) {
        setState(() {
          if (initial) _editAuthorized = false;
          _editBlocked = true;
          _editMessage =
              'The complete price and stock could not be read. Retry the current product.';
        });
        return;
      }
      setState(() {
        _editAuthorized = true;
        if (initial) {
          _initData(latest);
          _editBlocked = false;
          _editMessage = null;
        } else {
          _latestProduct = latest;
          _editBlocked = true;
          _editMessage =
              'Latest: ${latest.name}, ₹${latest.price}, stock ${latest.stock}. Your draft is kept. Reload the latest product before saving again.';
        }
      });
    } catch (error) {
      if (!_formCurrent) return;
      setState(() {
        if (error is ApiException && [401, 403, 404].contains(error.statusCode))
          _retired = true;
        _editBlocked = true;
        _editMessage =
            'Your draft is kept. The latest product could not be checked. Check store access and retry.';
      });
    } finally {
      if (mounted) setState(() => _loadingEdit = false);
    }
  }

  Future<void> _saveExistingProduct(
    ProductService service,
    String selectedStore,
  ) async {
    if (!_formCurrent) return;
    final base = _baseProduct;
    if (base == null || base.version == null || selectedStore != base.storeId) {
      setState(() {
        _editBlocked = true;
        _editMessage =
            'Select this product’s store and load its current version before saving. Your draft is kept.';
      });
      return;
    }
    if (_editBlocked && _pendingEdit == null) return;
    var intent = _pendingEdit;
    if (intent == null) {
      final fields = _editFields();
      intent = (
        key: const Uuid().v4(),
        version: base.version!,
        signature: _editDraftSignature(),
        fields: jsonDecode(jsonEncode(fields)) as Map<String, dynamic>,
      );
    }
    setState(() {
      _pendingEdit = intent;
      _editMessage = null;
    });
    try {
      final result = await service.updateProduct(
        base.id,
        intent.fields,
        storeId: base.storeId,
        version: intent.version,
        idempotencyKey: intent.key,
      );
      if (!_formCurrent) return;
      final newerDraft = _editDraftSignature() != intent.signature;
      final variantsUnchanged =
          jsonEncode(_variantPayloads()) ==
          jsonEncode(intent.fields['variants']);
      final needsIdentityReview =
          !variantsUnchanged &&
          (intent.fields['variants'] as List).any(
            (row) => (row as Map)['id'] == null,
          );
      setState(() {
        _baseProduct = ProductContract.fromJson(result);
        if (variantsUnchanged) {
          _variants = _baseProduct!.variants
              .map(_ProductVariantDraft.fromContract)
              .toList();
        }
        _pendingEdit = null;
        _latestProduct = null;
        _editBlocked = needsIdentityReview;
        _editMessage = newerDraft
            ? 'The earlier save is confirmed. Your newer draft is kept; review it and save again.'
            : null;
      });
      if (needsIdentityReview) await _checkLatestProduct();
      if (!_formCurrent) return;
      if (!newerDraft) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: Text('Product updated!')));
        Navigator.pop(context, true);
      }
    } catch (error) {
      if (!_formCurrent) return;
      final terminal =
          error is ApiException &&
          error.code != 'SESSION_CONTEXT_CHANGED' &&
          [400, 401, 403, 404, 409, 422].contains(error.statusCode);
      final conflict =
          error is ApiException &&
          [
            'PRODUCT_VERSION_CONFLICT',
            'PRODUCT_EDIT_KEY_CONFLICT',
          ].contains(error.code);
      setState(() {
        if (error is ApiException && [401, 403, 404].contains(error.statusCode))
          _retired = true;
        if (terminal) _pendingEdit = null;
        _editBlocked =
            conflict ||
            (error is ApiException &&
                [401, 403, 404].contains(error.statusCode));
        _editMessage = terminal
            ? '$error Your draft is kept.'
            : 'The save result is not confirmed. Retry pending save to recover it. Your draft is kept.';
      });
      if (conflict) await _checkLatestProduct();
    }
  }

  // A newer invalid number must not prevent recovery of an already validated save.
  String _editDraftSignature() => jsonEncode({
    'text': [
      _nameController.text,
      _descriptionController.text,
      _salePriceController.text,
      _originalPriceController.text,
      _stockController.text,
      _skuController.text,
      _barcodeController.text,
      _handleController.text,
      _seoTitleController.text,
      _seoDescriptionController.text,
      _productTypeController.text,
      _vendorController.text,
      _countryOfOriginController.text,
      _importerDetailsController.text,
      _tagsController.text,
    ],
    'images': _images,
    'category': _categoryId,
    'featured': _isFeatured,
    'specifications': _specifications,
    'variants': _variantPayloads(),
  });

  Map<String, dynamic> _editFields() => {
    'name': _nameController.text,
    if (_descriptionController.text.isNotEmpty ||
        _baseProduct?['description'] != null)
      'description': _descriptionController.text,
    'price': double.parse(_salePriceController.text),
    'compare_price': _originalPriceController.text.isNotEmpty
        ? double.parse(_originalPriceController.text)
        : null,
    'stock': int.parse(_stockController.text),
    'sku': _skuController.text.trim().isEmpty
        ? null
        : _skuController.text.trim(),
    'barcode': _barcodeController.text.trim().isEmpty
        ? null
        : _barcodeController.text.trim(),
    'url_handle': _nullableTrim(_handleController.text),
    'seo_title': _nullableTrim(_seoTitleController.text),
    'seo_description': _nullableTrim(_seoDescriptionController.text),
    'category': _categoryId,
    'images': _images,
    'is_featured': _isFeatured,
    'product_type': _nullableTrim(_productTypeController.text),
    'vendor': _nullableTrim(_vendorController.text),
    'country_of_origin': _nullableTrim(_countryOfOriginController.text),
    'importer_details': _nullableTrim(_importerDetailsController.text),
    'tags': _tagValues(),
    'metadata': _metadataPayload(),
    'variants': _variantPayloads(),
    'product_options': _productOptionPayloads(),
  };

  List<Map<String, dynamic>> _productOptionPayloads() {
    final values = <String, Set<String>>{};
    for (final option in _baseProduct?.options ?? <ProductOptionContract>[]) {
      values[option.name] = option.values.toSet();
    }
    for (final variant in _variants) {
      for (final entry in variant.optionValues.entries) {
        values.putIfAbsent(entry.key, () => <String>{}).add(entry.value);
      }
    }
    return values.entries.indexed
        .map(
          (entry) => <String, dynamic>{
            'name': entry.$2.key,
            'position': entry.$1,
            'values': entry.$2.value.toList(),
          },
        )
        .toList(growable: false);
  }

  List<Map<String, dynamic>> _variantPayloads() {
    return _variants.map((variant) => variant.toJson()).toList(growable: false);
  }

  List<String> _tagValues() {
    final seen = <String>{};
    final tags = <String>[];
    for (final rawTag in _tagsController.text.split(RegExp(r'[,\n]'))) {
      final tag = rawTag.trim();
      if (tag.isEmpty) continue;
      final dedupeKey = tag.toLowerCase();
      if (!seen.add(dedupeKey)) continue;
      tags.add(tag.length > 50 ? tag.substring(0, 50) : tag);
      if (tags.length == 30) break;
    }
    return tags;
  }

  Map<String, dynamic> _metadataPayload() {
    final metadata = Map<String, dynamic>.from(
      _baseProduct?.metadata ?? widget.product?.metadata ?? const {},
    );
    if (_specifications.isEmpty) {
      metadata.remove('specifications');
    } else {
      metadata['specifications'] = Map<String, String>.from(_specifications);
    }
    return metadata;
  }

  String? _nullableTrim(String value) {
    final trimmed = value.trim();
    return trimmed.isEmpty ? null : trimmed;
  }
}

class _ProductVariantDraft {
  const _ProductVariantDraft({
    this.id,
    this.otherOptions = const {},
    required this.title,
    required this.sku,
    required this.barcode,
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
      id: contract.id.isEmpty ? null : contract.id,
      otherOptions: contract.options.map(
        (key, value) => MapEntry(key, '$value'),
      ),
      title: contract.title,
      sku: contract.sku ?? '',
      barcode: contract.barcode ?? '',
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
  final String? id;
  final Map<String, String> otherOptions;
  final String sku;
  final String barcode;
  final double? price;
  final double? comparePrice;
  final int stock;
  final String optionName;
  final String optionValue;

  Map<String, String> get optionValues => {
    ...otherOptions,
    if (optionName.isNotEmpty && optionValue.isNotEmpty)
      optionName: optionValue,
  };

  Map<String, dynamic> toJson() => {
    if (id != null) 'id': id,
    'title': title,
    'sku': sku.isEmpty ? null : sku,
    'barcode': barcode.isEmpty ? null : barcode,
    if (price != null) 'price': price,
    'compare_price': comparePrice,
    'stock': stock,
    'options': optionValues,
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
  final _barcodeController = TextEditingController();
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
    _barcodeController.text = variant?.barcode ?? '';
    _priceController.text = variant?.price?.toString() ?? '';
    _comparePriceController.text = variant?.comparePrice?.toString() ?? '';
    _stockController.text = variant?.stock.toString() ?? '0';
    _optionNameController.text = variant?.optionName ?? 'Size';
    _optionValueController.text = variant?.optionValue ?? '';
    _initialSignature = _draftSignature();
    for (final controller in _controllers) {
      controller.addListener(_changed);
    }
  }

  @override
  void dispose() {
    for (final controller in _controllers) {
      controller.removeListener(_changed);
    }
    _titleController.dispose();
    _skuController.dispose();
    _barcodeController.dispose();
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
        id: widget.variant?.id,
        otherOptions: Map<String, String>.from(
          widget.variant?.otherOptions ?? {},
        )..remove(widget.variant?.optionName),
        title: title,
        sku: _skuController.text.trim(),
        barcode: _barcodeController.text.trim(),
        price: double.tryParse(_priceController.text),
        comparePrice: double.tryParse(_comparePriceController.text),
        stock: int.tryParse(_stockController.text) ?? 0,
        optionName: _optionNameController.text.trim(),
        optionValue: _optionValueController.text.trim(),
      ),
    );
  }

  String _draftSignature() => jsonEncode([
    _titleController.text,
    _skuController.text,
    _barcodeController.text,
    _priceController.text,
    _comparePriceController.text,
    _stockController.text,
    _optionNameController.text,
    _optionValueController.text,
  ]);
  late String _initialSignature;
  List<TextEditingController> get _controllers => [
    _titleController,
    _skuController,
    _barcodeController,
    _priceController,
    _comparePriceController,
    _stockController,
    _optionNameController,
    _optionValueController,
  ];
  void _changed() {
    if (mounted) setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    final isEdit = widget.variant != null;
    return LetbuyyEditorScaffold(
      title: isEdit ? 'Edit variant' : 'Add variant',
      hasChanges: _draftSignature() != _initialSignature,
      currentHasChanges: () => _draftSignature() != _initialSignature,
      actions: SizedBox(
        width: double.infinity,
        child: FilledButton.icon(
          onPressed: _save,
          icon: const Icon(Icons.check),
          label: Text(isEdit ? 'Save variant' : 'Add variant'),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              CustomTextField(
                controller: _optionNameController,
                label: 'Option',
                validator: (value) =>
                    value?.trim().isEmpty == true ? 'Required' : null,
              ),
              const SizedBox(height: 12),
              CustomTextField(
                controller: _optionValueController,
                label: 'Value',
                validator: (value) =>
                    value?.trim().isEmpty == true ? 'Required' : null,
              ),
              const SizedBox(height: 12),
              CustomTextField(
                controller: _titleController,
                label: 'Variant title',
                hint: 'Blue / XL',
              ),
              const SizedBox(height: 12),
              CustomTextField(controller: _skuController, label: 'SKU'),
              const SizedBox(height: 12),
              CustomTextField(
                controller: _barcodeController,
                label: 'Barcode',
                suffixIcon: IconButton(
                  tooltip: 'Scan barcode',
                  icon: const Icon(Icons.qr_code_scanner_rounded),
                  onPressed: _scanVariantBarcode,
                ),
              ),
              const SizedBox(height: 12),
              CustomTextField(
                controller: _priceController,
                label: 'Price',
                helperText: 'Rupees (INR)',
                keyboardType: const TextInputType.numberWithOptions(
                  decimal: true,
                ),
                inputFormatters: [
                  FilteringTextInputFormatter.allow(RegExp(r'[0-9.]')),
                ],
                validator: (value) =>
                    value?.trim().isEmpty == true ? 'Required' : null,
              ),
              const SizedBox(height: 12),
              CustomTextField(
                controller: _stockController,
                label: 'Quantity',
                helperText: 'Available for sale',
                keyboardType: TextInputType.number,
                inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                validator: (value) =>
                    value?.trim().isEmpty == true ? 'Required' : null,
              ),
              const SizedBox(height: 12),
              CustomTextField(
                controller: _comparePriceController,
                label: 'Compare price',
                helperText: 'Rupees (INR)',
                keyboardType: const TextInputType.numberWithOptions(
                  decimal: true,
                ),
                inputFormatters: [
                  FilteringTextInputFormatter.allow(RegExp(r'[0-9.]')),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _scanVariantBarcode() async {
    final barcode = await showBarcodeScannerSheet(
      context,
      title: 'Scan variant barcode',
    );
    if (!mounted || barcode == null || barcode.trim().isEmpty) return;
    setState(() => _barcodeController.text = barcode.trim());
  }
}

// Editing grammar only; accepted numeric precision and validation remain with
// the existing parser and server contract. Native IME composition is retained.
TextInputFormatter _decimalInput() => TextInputFormatter.withFunction((
  oldValue,
  newValue,
) {
  if (!newValue.composing.isCollapsed) return newValue;
  return RegExp(r'^\d*\.?\d*$').hasMatch(newValue.text) ? newValue : oldValue;
});
