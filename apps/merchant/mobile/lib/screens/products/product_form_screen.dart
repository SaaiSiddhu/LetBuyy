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
import '../../widgets/shared/merchant_option_picker.dart';
import '../../widgets/shared/merchant_store_view.dart';
import '../content/media_library_screen.dart';

part 'product_options_editor.dart';

/// Product Form Screen for Store Builder
/// Simplified product creation with essential fields
class ProductFormScreen extends StatefulWidget {
  final ProductContract? product; // null for new, populated for edit

  const ProductFormScreen({super.key, this.product});

  @override
  State<ProductFormScreen> createState() => _ProductFormScreenState();
}

enum _ProductImageAction { camera, gallery, library, url }

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
  ({String key, String signature, Map<String, dynamic> fields})? _pendingCreate;
  ProductService? _boundProductService;
  bool get _isEditing => _baseProduct != null || widget.product != null;
  bool get _pendingSave => _pendingEdit != null || _pendingCreate != null;

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
  final _categoryController = TextEditingController();

  // Form Data
  List<String> _images = [];
  List<_ProductVariantDraft> _variants = [];
  List<ProductOptionContract> _productOptions = [];
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
    _categoryController,
  ];
  void _draftChanged() {
    if (mounted) setState(() {});
  }

  bool get _hasChanges =>
      _pendingSave || _presentationBaseline != _editDraftSignature();
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
      identical(context.read<ProductService?>(), _boundProductService) &&
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

  Widget _guardFormSurface(Widget child) =>
      Consumer2<StoreContext, ProductService?>(
        builder: (_, stores, service, __) =>
            _formCurrent ? child : _retiredSurface(),
      );

  // Specifications form
  final _specKeyController = TextEditingController();
  final _specValueController = TextEditingController();

  @override
  void initState() {
    super.initState();
    final stores = context.read<StoreContext>();
    _boundProductService = context.read<ProductService?>();
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
      _productOptions = List.of(p.options);
      _variants = p.variants
          .map(_ProductVariantDraft.fromContract)
          .toList(growable: true);
      _categoryController.text = p.category ?? '';
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
    _categoryController.dispose();
    _specKeyController.dispose();
    _specValueController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final stores = context.watch<StoreContext>();
    final service = context.watch<ProductService?>();
    if (!identical(service, _boundProductService) ||
        stores.requestContextKey != _boundContext ||
        stores.selectedStoreId != _boundStoreId)
      _retired = true;
    if (!_formCurrent) return _retiredSurface();
    final isEdit = _isEditing;
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
      discardTitle: _pendingSave
          ? 'Leave unconfirmed save?'
          : 'Discard product draft?',
      discardMessage: _pendingSave
          ? 'This save may already be committed. Its retry handle is kept only in this open editor and will be lost on closing. Check the catalog before starting another save.'
          : 'The unsaved changes in this editor will be discarded. Closing does not cancel an earlier server request or uploaded image.',
      discardLabel: _pendingSave ? 'Leave editor' : 'Discard changes',
      confirmationGuard: (_, confirmation) => _guardFormSurface(confirmation),
      actions: SizedBox(
        width: double.infinity,
        child: FilledButton.icon(
          onPressed:
              _isLoading || _loadingEdit || (_editBlocked && !_pendingSave)
              ? null
              : _submitProduct,
          icon: Icon(_isLoading ? Icons.hourglass_top : Icons.check),
          label: Text(
            _isLoading
                ? 'Saving product…'
                : _pendingSave
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
        label: 'Description',
        hint: 'Describe your product...',
        maxLines: 4,
        validator: (value) => (value?.length ?? 0) > 10000
            ? 'Use at most 10000 characters.'
            : null,
      ),
      const SizedBox(height: 16),
      CustomTextField(
        controller: _categoryController,
        label: 'Category',
        helperText: 'Enter a category or choose one from your store.',
        maxLength: 100,
        validator: (value) =>
            (value?.length ?? 0) > 100 ? 'Use at most 100 characters.' : null,
        textInputAction: TextInputAction.done,
        suffixIcon: IconButton(
          tooltip: 'Choose existing category',
          onPressed: _canOpenDraft && !_shortFormOpen ? _chooseCategory : null,
          icon: const Icon(Icons.category_outlined),
        ),
      ),
    ],
  );

  Future<void> _chooseCategory() async {
    if (!_canOpenDraft || _shortFormOpen) return;
    final service = context.read<ProductService>();
    final MerchantStoreView view = (
      key: _boundContext,
      storeId: _boundStoreId!,
    );
    bool current() =>
        _formCurrent && identical(service, context.read<ProductService>());
    setState(() => _shortFormOpen = true);
    try {
      final selected = await chooseMerchantOption<ProductCategoryContract>(
        context,
        view,
        'Categories',
        (page, search) async {
          if (!current()) throw StateError('Category context changed.');
          final result = await service.readCategoryPage(
            view.storeId,
            page: page,
            search: search,
          );
          if (!current()) throw StateError('Category context changed.');
          return PaginatedResponse<ProductCategoryContract>(
            data: result.rows,
            total: result.total,
            page: result.page,
            limit: result.limit,
            hasMore: result.hasNext,
            meta: const {'total_is_exact': true},
          );
        },
        (row) => row.name,
      );
      if (current() &&
          selected != null &&
          selected.storeId == view.storeId &&
          !selected.isDeleted) {
        // Product category is name metadata, as on web; category UUIDs stay
        // with the canonical category-management commands.
        _categoryController.text = selected.name;
      }
    } finally {
      if (mounted) setState(() => _shortFormOpen = false);
    }
  }

  Widget _buildImagesStep() => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      const Text(
        'Add up to ${ProductContract.maxImages} product images. The first image is the primary.',
      ),
      const SizedBox(height: 16),
      for (final entry in _images.asMap().entries)
        _buildImageTile(entry.key, entry.value),
      if (_images.length < ProductContract.maxImages) _buildAddImageButton(),
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
                  leading: const Icon(Icons.collections_outlined),
                  title: const Text('Media library'),
                  onTap: () =>
                      Navigator.pop(sheet, _ProductImageAction.library),
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
        await _chooseProductImage(source: ImageSource.camera);
      case _ProductImageAction.gallery:
        await _chooseProductImage(source: ImageSource.gallery);
      case _ProductImageAction.library:
        await _chooseProductImage();
      case _ProductImageAction.url:
        await _showAddImageUrlDialog();
      case null:
        return;
    }
  }

  Future<void> _chooseProductImage({ImageSource? source}) async {
    if (!_formCurrent ||
        _isLoading ||
        _images.length >= ProductContract.maxImages)
      return;

    setState(() => _isLoading = true);
    try {
      final image = await Navigator.push<MediaAssetContract>(
        context,
        MaterialPageRoute(
          builder: (_) => MediaLibraryScreen(
            selectProductImage: true,
            initialImageSource: source,
          ),
        ),
      );
      if (!_formCurrent || image == null) return;
      if (image.storeId != _boundStoreId ||
          !image.isImage ||
          _images.length >= ProductContract.maxImages)
        return;
      if (_images.contains(image.url)) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('This image is already attached.')),
        );
        return;
      }
      setState(() => _images.add(image.url));
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Product image added.')));
    } catch (_) {
      if (!_formCurrent) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Could not choose product image. Try again.'),
        ),
      );
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _showAddImageUrlDialog() async {
    if (!_formCurrent ||
        _shortFormOpen ||
        _images.length >= ProductContract.maxImages)
      return;
    var url = '';
    final urlForm = GlobalKey<FormState>();
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
                  if (_formCurrent && urlForm.currentState?.validate() == true)
                    Navigator.pop(sheet, url);
                },
                child: const Text('Add'),
              ),
            ],
            child: Form(
              key: urlForm,
              child: CustomTextField(
                onChanged: (value) => url = value,
                label: 'Image URL',
                hint: 'https://...',
                autofocus: true,
                keyboardType: TextInputType.url,
                maxLength: 2000,
                validator: (value) {
                  final uri = Uri.tryParse(value ?? '');
                  if (value == null ||
                      value.isEmpty ||
                      value.length > 2000 ||
                      uri == null ||
                      !const ['http', 'https'].contains(uri.scheme) ||
                      uri.host.isEmpty ||
                      uri.userInfo.isNotEmpty) {
                    return 'Enter a valid HTTP or HTTPS image URL.';
                  }
                  if (_images.contains(value))
                    return 'This image is already attached.';
                  return null;
                },
              ),
            ),
          ),
        ),
      );
      if (_formCurrent &&
          value != null &&
          !_images.contains(value) &&
          _images.length < ProductContract.maxImages)
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
        onPressed: _showProductOptions,
        icon: const Icon(Icons.tune),
        label: const Text('Manage product options'),
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
                  onPressed: () => _removeVariant(index, variant),
                  icon: const Icon(Icons.delete_outline),
                  label: Text(
                    '${variant.id == null ? 'Delete' : 'Retire'} $variantLabel variant',
                  ),
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
        builder: (_) => _guardFormSurface(
          _VariantDraftSheet(
            combinationAvailable: _combinationAvailable,
            optionNames: _productOptionPayloads()
                .map((option) => option['name'] as String)
                .toList(),
          ),
        ),
      ),
    );
    if (!_formCurrent || draft == null) return;
    setState(() => _variants.add(draft));
  }

  Future<void> _showProductOptions() async {
    if (!_canOpenDraft) return;
    final result = await Navigator.of(context).push<_ProductOptionsDraft>(
      MaterialPageRoute(
        builder: (_) => _guardFormSurface(
          _ProductOptionsEditor(
            initial: _ProductOptionsDraft(
              _productOptionPayloads()
                  .map(ProductOptionContract.fromJson)
                  .toList(),
              List.of(_variants),
            ),
            isCurrent: () => _formCurrent,
            guard: _guardFormSurface,
          ),
        ),
      ),
    );
    if (!_formCurrent || result == null) return;
    setState(() {
      _productOptions = result.options;
      _variants = result.rows;
    });
  }

  Future<void> _removeVariant(int index, _ProductVariantDraft variant) async {
    if (!_canOpenDraft) return;
    final confirmed = await showLetbuyyConfirmation(
      context: context,
      title:
          '${variant.id == null ? 'Remove' : 'Retire'} ${variant.title} variant?',
      message: variant.id == null
          ? 'This removes an unsaved row from your draft. Save the product to apply your changes.'
          : 'Save the product to retire this variant. All stock and open work must be zero. Its order, price and inventory history will be preserved.',
      confirmLabel: variant.id == null ? 'Remove variant' : 'Retire variant',
      destructive: true,
      guard: (_, child) => _guardFormSurface(child),
    );
    if (!_formCurrent ||
        !confirmed ||
        index >= _variants.length ||
        !identical(_variants[index], variant))
      return;
    setState(() {
      _variants.removeAt(index);
      if (_variants.isEmpty) _productOptions = [];
    });
  }

  Future<void> _showEditVariantSheet(
    int index,
    _ProductVariantDraft variant,
  ) async {
    if (!_canOpenDraft) return;
    final draft = await Navigator.push<_ProductVariantDraft>(
      context,
      MaterialPageRoute(
        builder: (_) => _guardFormSurface(
          _VariantDraftSheet(
            variant: variant,
            combinationAvailable: (options) =>
                _combinationAvailable(options, except: index),
            optionNames: _productOptionPayloads()
                .map((option) => option['name'] as String)
                .toList(),
          ),
        ),
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

  bool _combinationAvailable(Map<String, String> values, {int? except}) =>
      !_variants.indexed.any(
        (entry) =>
            entry.$1 != except &&
            entry.$2.optionValues.length == values.length &&
            values.entries.every(
              (value) => entry.$2.optionValues[value.key] == value.value,
            ),
      );

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
    if (!_pendingSave && !_formKey.currentState!.validate()) {
      // The field validators retain their specific, accessible errors. A
      // floating duplicate notice can cover the input with large text/IME.
      return;
    }

    if (!_isEditing && !_pendingSave) {
      try {
        _ProductOptionsDraft(
          _productOptionPayloads().map(ProductOptionContract.fromJson).toList(),
          _variants,
        ).validate();
      } on _OptionProblem catch (error) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(error.message)));
        return;
      }
    }
    setState(() => _isLoading = true);

    try {
      final productService = context.read<ProductService>();

      final store = await context.read<StoreContext>().ensureSelectedStore();
      if (!_formCurrent || store?.id != _boundStoreId) return;
      if (store == null) return;

      if (_isEditing) {
        await _saveExistingProduct(productService, store.id);
      } else {
        await _createProduct(productService, store.id);
      }
    } catch (error) {
      if (!_formCurrent) return;
      setState(() {
        if (error is ApiException && [401, 403, 404].contains(error.statusCode))
          _retired = true;
        _editMessage =
            'The product form could not be prepared. Check the current store and fields, then retry. Your draft is kept.';
      });
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _createProduct(ProductService service, String storeId) async {
    final intent =
        _pendingCreate ??
        (
          key: const Uuid().v4(),
          signature: _editDraftSignature(),
          fields:
              jsonDecode(
                    jsonEncode({
                      'store_id': storeId,
                      ..._editFields(),
                      'is_active': true,
                    }),
                  )
                  as Map<String, dynamic>,
        );
    setState(() {
      _pendingCreate = intent;
      _editMessage = null;
    });
    try {
      final result = await service.createProductCommand(
        storeId: storeId,
        input: intent.fields,
        idempotencyKey: intent.key,
        maxRetries: 0,
      );
      if (!_formCurrent) return;
      final newer = _editDraftSignature() != intent.signature;
      final sameRows =
          jsonEncode(_variantPayloads()) ==
          jsonEncode(intent.fields['variants']);
      final sameOptions =
          jsonEncode(_productOptionPayloads()) ==
          jsonEncode(intent.fields['product_options']);
      final created = ProductContract.fromJson(result);
      setState(() {
        _baseProduct = created;
        if (sameRows)
          _variants = created.variants
              .map(_ProductVariantDraft.fromContract)
              .toList();
        if (sameOptions) _productOptions = List.of(created.options);
        _pendingCreate = null;
        _presentationBaseline = newer
            ? intent.signature
            : _editDraftSignature();
        _editBlocked = !sameRows;
        _latestProduct = !sameRows ? created : null;
        _editMessage = newer
            ? 'The original product creation is confirmed. Your newer draft is kept. Review and save changes to this product.'
            : null;
      });
      if (!newer) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: Text('Product created!')));
        Navigator.pop(context, true);
      }
    } catch (error) {
      if (!_formCurrent) return;
      final quota =
          error is ApiException && error.code == 'PRODUCT_LIMIT_REACHED';
      final denied =
          error is ApiException &&
          !quota &&
          [401, 403, 404].contains(error.statusCode);
      final rejected =
          quota ||
          (error is ApiException && [400, 422].contains(error.statusCode));
      setState(() {
        if (denied) _retired = true;
        if (rejected) _pendingCreate = null;
        _editMessage = rejected
            ? '$error Your draft is kept.'
            : 'The creation result is not confirmed. Retry pending save to recover the original request. Your draft is kept.';
      });
    }
  }

  Future<void> _checkLatestProduct({bool initial = false}) async {
    final original = _baseProduct ?? widget.product;
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
    if (_editBlocked && !_pendingSave) return;
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
      final optionsUnchanged =
          jsonEncode(_productOptionPayloads()) ==
          jsonEncode(intent.fields['product_options']);
      final needsIdentityReview =
          !variantsUnchanged &&
          (intent.fields['variants'] as List).any(
            (row) => (row as Map)['id'] == null,
          );
      setState(() {
        _baseProduct = ProductContract.fromJson(result);
        if (optionsUnchanged) _productOptions = List.of(_baseProduct!.options);
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
    'category': _categoryController.text,
    'featured': _isFeatured,
    'specifications': _specifications,
    'variants': _variantPayloads(),
    'product_options': _productOptionPayloads(),
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
    if (_categoryController.text.isNotEmpty ||
        _baseProduct?['category'] != null)
      'category': _categoryController.text.isEmpty
          ? null
          : _categoryController.text,
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
    for (final option in _productOptions) {
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
    // The editor presents specifications as text, but an unrelated edit must
    // preserve the original JSON values, including null and an empty map.
    // Compare to the latest acknowledged product, also after a pending retry.
    final original = metadata['specifications'];
    final shown = original is Map
        ? original.map(
            (key, value) => MapEntry(key.toString(), value.toString()),
          )
        : const <String, String>{};
    if (shown.length == _specifications.length &&
        _specifications.entries.every(
          (entry) => shown[entry.key] == entry.value,
        )) {
      return metadata;
    }
    if (_specifications.isEmpty) {
      metadata.remove('specifications');
    } else {
      metadata['specifications'] = {
        for (final entry in _specifications.entries)
          entry.key:
              original is Map &&
                  original.containsKey(entry.key) &&
                  original[entry.key].toString() == entry.value
              ? original[entry.key]
              : entry.value,
      };
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
    this.writePrice = true,
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
    String optionName = '';
    String optionValue = '';
    if (contract.options.isNotEmpty) {
      final first = contract.options.entries.first;
      optionName = first.key;
      optionValue = '${first.value}';
    }
    final stock = contract['stock'] == null
        ? contract.inventoryQuantity
        : contract.stock;
    return _ProductVariantDraft(
      id: contract.id.isEmpty ? null : contract.id,
      otherOptions: contract.options.map(
        (key, value) => MapEntry(key, '$value'),
      ),
      title: contract.title,
      sku: contract.sku ?? '',
      barcode: contract.barcode ?? '',
      price: contract.price,
      writePrice: contract.price != null,
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
  final bool writePrice;
  final double? comparePrice;
  final int stock;
  final String optionName;
  final String optionValue;

  _ProductVariantDraft withOptions(
    Map<String, String> options, {
    String? title,
  }) => _ProductVariantDraft(
    id: id,
    title: title ?? this.title,
    sku: sku,
    barcode: barcode,
    price: price,
    writePrice: writePrice,
    comparePrice: comparePrice,
    stock: stock,
    otherOptions: Map.of(options),
    optionName: options.keys.firstOrNull ?? '',
    optionValue: options.values.firstOrNull ?? '',
  );

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
    if (writePrice) 'price': price,
    'compare_price': comparePrice,
    'stock': stock,
    'options': optionValues,
  };
}

class _VariantDraftSheet extends StatefulWidget {
  const _VariantDraftSheet({
    this.variant,
    this.optionNames = const [],
    this.combinationAvailable,
  });

  final _ProductVariantDraft? variant;
  final List<String> optionNames;
  final bool Function(Map<String, String>)? combinationAvailable;

  @override
  State<_VariantDraftSheet> createState() => _VariantDraftSheetState();
}

class _VariantDraftSheetState extends State<_VariantDraftSheet> {
  String? _combinationError;
  final _formKey = GlobalKey<FormState>();
  final _titleController = TextEditingController();
  final _skuController = TextEditingController();
  final _barcodeController = TextEditingController();
  final _priceController = TextEditingController();
  final _comparePriceController = TextEditingController();
  final _stockController = TextEditingController();
  final _optionNameController = TextEditingController();
  final _optionValueController = TextEditingController();
  final _additionalOptions =
      <
        ({
          TextEditingController name,
          TextEditingController value,
          bool existing,
        })
      >[];
  final _retiredOptionControllers = <TextEditingController>[];

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
    _optionNameController.text =
        variant?.optionName ?? widget.optionNames.firstOrNull ?? 'Size';
    _optionValueController.text = variant?.optionValue ?? '';
    for (final entry
        in variant?.otherOptions.entries ?? <MapEntry<String, String>>[]) {
      if (entry.key == variant?.optionName) continue;
      _additionalOptions.add((
        name: TextEditingController(text: entry.key),
        value: TextEditingController(text: entry.value),
        existing: true,
      ));
    }
    if (variant == null) {
      for (final name in widget.optionNames.skip(1)) {
        _additionalOptions.add((
          name: TextEditingController(text: name),
          value: TextEditingController(),
          existing: true,
        ));
      }
    }
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
    for (final option in _additionalOptions) {
      option.name.dispose();
      option.value.dispose();
    }
    for (final controller in _retiredOptionControllers) {
      controller.dispose();
    }
    super.dispose();
  }

  void _save() {
    if (!_formKey.currentState!.validate()) return;
    final values = {
      if (_optionNameController.text.trim().isNotEmpty &&
          _optionValueController.text.trim().isNotEmpty)
        _optionNameController.text.trim(): _optionValueController.text.trim(),
      for (final option in _additionalOptions)
        option.name.text.trim(): option.value.text.trim(),
    };
    if (widget.combinationAvailable?.call(values) == false) {
      setState(
        () => _combinationError =
            'A variant with these option values already exists.',
      );
      return;
    }
    final title = _titleController.text.trim().isEmpty
        ? [
            _optionValueController.text.trim(),
            for (final option in _additionalOptions) option.value.text.trim(),
          ].where((value) => value.isNotEmpty).join(' / ')
        : _titleController.text.trim();
    Navigator.of(context).pop(
      _ProductVariantDraft(
        id: widget.variant?.id,
        otherOptions: values,
        title: title,
        sku: _skuController.text.trim(),
        barcode: _barcodeController.text.trim(),
        price: double.tryParse(_priceController.text),
        writePrice:
            widget.variant == null ||
            widget.variant!.writePrice ||
            _priceController.text.trim().isNotEmpty,
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
    for (final option in _additionalOptions)
      [option.name.text, option.value.text],
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
    for (final option in _additionalOptions) ...[option.name, option.value],
  ];
  void _changed() {
    if (mounted) setState(() {});
  }

  String? _optionNameError(String? value) {
    final name = value?.trim() ?? '';
    if (name.isEmpty)
      return _optionValueController.text.trim().isEmpty &&
              _additionalOptions.isEmpty
          ? null
          : 'Required';
    if (name.length > 100) return 'Use at most 100 characters';
    if (!widget.optionNames.contains(name)) {
      if (widget.optionNames.any(
        (saved) => saved.toLowerCase() == name.toLowerCase(),
      ))
        return 'Use the saved option name';
      if ({
            ...widget.optionNames,
            _optionNameController.text.trim(),
            for (final option in _additionalOptions) option.name.text.trim(),
          }.where((value) => value.isNotEmpty).length >
          3)
        return 'A product supports up to 3 option dimensions';
    }
    final names = [
      _optionNameController.text,
      for (final option in _additionalOptions) option.name.text,
    ];
    if (names
            .where(
              (candidate) =>
                  candidate.trim().toLowerCase() == name.toLowerCase(),
            )
            .length >
        1)
      return 'Use a unique option name';
    return null;
  }

  String? _moneyError(String? value) {
    if (value == null || value.trim().isEmpty) return null;
    final number = double.tryParse(value);
    return number == null ||
            !number.isFinite ||
            number < 0 ||
            number > 99999999.99
        ? 'Enter a valid non-negative price'
        : null;
  }

  void _addOption() {
    if (_additionalOptions.length >= 2) return;
    final name = TextEditingController(), value = TextEditingController();
    name.addListener(_changed);
    value.addListener(_changed);
    setState(
      () => _additionalOptions.add((name: name, value: value, existing: false)),
    );
  }

  void _removeOption(int index) {
    final option = _additionalOptions[index];
    option.name.removeListener(_changed);
    option.value.removeListener(_changed);
    _retiredOptionControllers.addAll([option.name, option.value]);
    setState(() => _additionalOptions.removeAt(index));
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
              if (_combinationError != null)
                Semantics(liveRegion: true, child: Text(_combinationError!)),
              CustomTextField(
                controller: _optionNameController,
                label: 'Option',
                readOnly:
                    widget.variant?.optionName.isNotEmpty == true ||
                    widget.optionNames.contains(_optionNameController.text),
                helperText: widget.variant == null
                    ? null
                    : 'Saved option names belong to the whole product.',
                validator: _optionNameError,
              ),
              const SizedBox(height: 12),
              CustomTextField(
                controller: _optionValueController,
                label: 'Value',
                maxLength: 100,
                validator: (value) =>
                    value?.trim().isEmpty != false &&
                        (_optionNameController.text.trim().isNotEmpty ||
                            _additionalOptions.isNotEmpty)
                    ? 'Required'
                    : null,
              ),
              for (final (index, option) in _additionalOptions.indexed) ...[
                const SizedBox(height: 12),
                CustomTextField(
                  key: ObjectKey(option.name),
                  controller: option.name,
                  label: 'Option ${index + 2} name',
                  readOnly: option.existing,
                  validator: _optionNameError,
                ),
                const SizedBox(height: 12),
                CustomTextField(
                  key: ObjectKey(option.value),
                  controller: option.value,
                  label: 'Option ${index + 2} value',
                  maxLength: 100,
                  validator: (value) =>
                      value?.trim().isEmpty != false ? 'Required' : null,
                ),
                if (!option.existing)
                  TextButton(
                    onPressed: () => _removeOption(index),
                    child: Text('Remove option ${index + 2}'),
                  ),
              ],
              if (_additionalOptions.length < 2)
                TextButton.icon(
                  onPressed: _addOption,
                  icon: const Icon(Icons.add),
                  label: const Text('Add option'),
                ),
              const SizedBox(height: 12),
              CustomTextField(
                controller: _titleController,
                label: 'Variant title',
                validator: (value) =>
                    value?.trim().isEmpty != false &&
                        _optionValueController.text.trim().isEmpty
                    ? 'Enter a variant title or option value'
                    : null,
                maxLength: 200,
                hint: 'Blue / XL',
              ),
              const SizedBox(height: 12),
              CustomTextField(
                controller: _skuController,
                label: 'SKU',
                maxLength: 100,
              ),
              const SizedBox(height: 12),
              CustomTextField(
                controller: _barcodeController,
                label: 'Barcode',
                maxLength: 100,
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
                helperText:
                    'Rupees (INR). Leave blank to use the product price.',
                keyboardType: const TextInputType.numberWithOptions(
                  decimal: true,
                ),
                inputFormatters: [
                  FilteringTextInputFormatter.allow(RegExp(r'[0-9.-]')),
                ],
                validator: _moneyError,
              ),
              const SizedBox(height: 12),
              CustomTextField(
                controller: _stockController,
                label: 'Quantity',
                helperText: 'Available for sale',
                keyboardType: TextInputType.number,
                inputFormatters: [
                  FilteringTextInputFormatter.allow(RegExp(r'[0-9-]')),
                ],
                validator: (value) {
                  final quantity = int.tryParse(value ?? '');
                  return quantity == null || quantity < 0
                      ? 'Enter a valid non-negative quantity'
                      : null;
                },
              ),
              const SizedBox(height: 12),
              CustomTextField(
                controller: _comparePriceController,
                label: 'Compare price',
                validator: _moneyError,
                helperText: 'Rupees (INR)',
                keyboardType: const TextInputType.numberWithOptions(
                  decimal: true,
                ),
                inputFormatters: [
                  FilteringTextInputFormatter.allow(RegExp(r'[0-9.-]')),
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
