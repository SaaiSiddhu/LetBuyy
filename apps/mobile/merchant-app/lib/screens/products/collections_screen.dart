import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../app/store_context.dart';

import '../../models/store_model.dart';
import '../../services/product_service.dart';
import '../../theme/app_theme_colors.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import '../../widgets/shared/cached_merchant_image.dart';

class CollectionsScreen extends StatefulWidget {
  const CollectionsScreen({super.key});

  @override
  State<CollectionsScreen> createState() => _CollectionsScreenState();
}

class _CollectionsScreenState extends State<CollectionsScreen> {
  StoreModel? _store;
  List<ProductCollectionContract> _collections = [];
  String _searchQuery = '';
  bool _isLoading = true;
  bool _showActiveOnly = false;

  final _searchController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _loadCollections();
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  List<ProductCollectionContract> get _filteredCollections {
    final query = _searchQuery.trim().toLowerCase();
    return _collections
        .where((collection) {
          if (_showActiveOnly && !collection.isActive) return false;
          if (query.isEmpty) return true;
          return collection.title.toLowerCase().contains(query) ||
              (collection.description ?? '').toLowerCase().contains(query) ||
              (collection.handle ?? '').toLowerCase().contains(query);
        })
        .toList(growable: false);
  }

  Future<void> _loadCollections() async {
    setState(() => _isLoading = true);
    try {
      final store = await context.read<StoreContext>().ensureSelectedStore();
      final rows = store == null
          ? <ProductCollectionContract>[]
          : await context.read<ProductService>().fetchCollections(store.id);
      if (!mounted) return;
      setState(() {
        _store = store;
        _collections = rows;
      });
    } catch (error) {
      _showSnackBar('Could not load collections: $error');
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _openCollectionForm({
    ProductCollectionContract? collection,
  }) async {
    final store = _store;
    if (store == null) return;
    final result = await showModalBottomSheet<ProductCollectionContract>(
      context: context,
      isScrollControlled: true,
      builder: (_) =>
          _CollectionFormSheet(storeId: store.id, collection: collection),
    );
    if (result == null) return;
    if (collection == null) {
      setState(() => _collections = [result, ..._collections]);
    } else {
      final index = _collections.indexWhere((item) => item.id == result.id);
      if (index != -1) {
        setState(() => _collections[index] = result);
      }
    }
  }

  Future<void> _deleteCollection(ProductCollectionContract collection) async {
    try {
      await context.read<ProductService>().deleteCollection(collection.id);
      if (!mounted) return;
      setState(() {
        _collections = _collections
            .where((item) => item.id != collection.id)
            .toList(growable: false);
      });
    } catch (error) {
      _showSnackBar('Could not delete collection: $error');
    }
  }

  Future<void> _toggleCollection(ProductCollectionContract collection) async {
    try {
      await context.read<ProductService>().updateCollection(
        collection.id,
        ProductCollectionInput.fromContract(collection),
      );
    } catch (error) {
      _showSnackBar('Could not update collection: $error');
    }
  }

  void _showSnackBar(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message), behavior: SnackBarBehavior.floating),
    );
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    final collections = _filteredCollections;

    return Scaffold(
      backgroundColor: colors.bgStart,
      appBar: AppBar(
        title: const Text('Collections'),
        backgroundColor: colors.bgStart,
        surfaceTintColor: colors.bgStart,
        actions: [
          IconButton(
            tooltip: 'Refresh',
            onPressed: _loadCollections,
            icon: const Icon(Icons.refresh_rounded),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _store == null ? null : () => _openCollectionForm(),
        backgroundColor: LetbuyyColorTokens.brandPrimary,
        foregroundColor: LetbuyyColorTokens.white,
        icon: const Icon(Icons.add_rounded),
        label: const Text('New collection'),
      ),
      body: _isLoading
          ? Center(
              child: CircularProgressIndicator(
                color: LetbuyyColorTokens.brandPrimary,
              ),
            )
          : RefreshIndicator(
              color: LetbuyyColorTokens.brandPrimary,
              onRefresh: _loadCollections,
              child: ListView(
                padding: const EdgeInsets.all(LetbuyySpacingTokens.space20),
                children: [
                  _buildHeader(colors),
                  const SizedBox(height: LetbuyySpacingTokens.space16),
                  _buildSearch(colors),
                  const SizedBox(height: LetbuyySpacingTokens.space16),
                  _buildFilterRow(colors),
                  const SizedBox(height: LetbuyySpacingTokens.space16),
                  if (_store == null)
                    _message(
                      colors,
                      'Create a store before adding collections.',
                      Icons.store_mall_directory_rounded,
                    )
                  else if (collections.isEmpty)
                    _message(
                      colors,
                      _searchQuery.isEmpty
                          ? 'No collections yet. Create one to merchandise products.'
                          : 'No collections match your search.',
                      Icons.category_outlined,
                    )
                  else
                    ...collections.map((item) => _collectionCard(colors, item)),
                  const SizedBox(height: LetbuyySpacingTokens.space48),
                ],
              ),
            ),
    );
  }

  Widget _buildHeader(AppThemeColors colors) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Merchandise product groups',
          style: Theme.of(context).textTheme.headlineSmall?.copyWith(
            color: colors.textPrimary,
            fontWeight: FontWeight.w800,
          ),
        ),
        const SizedBox(height: LetbuyySpacingTokens.space8),
        Text(
          'Create curated product collections for storefront navigation, campaigns, and landing sections.',
          style: Theme.of(
            context,
          ).textTheme.bodyMedium?.copyWith(color: colors.textSecondary),
        ),
      ],
    );
  }

  Widget _buildSearch(AppThemeColors colors) {
    return TextField(
      controller: _searchController,
      decoration: InputDecoration(
        hintText: 'Search collections',
        prefixIcon: const Icon(Icons.search_rounded),
        filled: true,
        fillColor: colors.card,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: colors.border),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: colors.border),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: LetbuyyColorTokens.brandPrimary),
        ),
      ),
      onChanged: (value) => setState(() => _searchQuery = value),
    );
  }

  Widget _buildFilterRow(AppThemeColors colors) {
    return Row(
      children: [
        Expanded(
          child: Text(
            '${_filteredCollections.length} of ${_collections.length} collections',
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: colors.textSecondary,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
        FilterChip(
          label: const Text('Active only'),
          selected: _showActiveOnly,
          selectedColor: LetbuyyColorTokens.brandPrimary.withValues(
            alpha: 0.16,
          ),
          checkmarkColor: LetbuyyColorTokens.brandPrimary,
          onSelected: (value) => setState(() => _showActiveOnly = value),
        ),
      ],
    );
  }

  Widget _collectionCard(
    AppThemeColors colors,
    ProductCollectionContract collection,
  ) {
    return Container(
      margin: const EdgeInsets.only(bottom: LetbuyySpacingTokens.space12),
      padding: const EdgeInsets.all(LetbuyySpacingTokens.space16),
      decoration: BoxDecoration(
        color: colors.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: colors.cardBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              _collectionThumb(collection),
              const SizedBox(width: LetbuyySpacingTokens.space12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      collection.title,
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        color: colors.textPrimary,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: LetbuyySpacingTokens.space4),
                    Text(
                      collection.description?.isNotEmpty == true
                          ? collection.description!
                          : 'No description',
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: colors.textSecondary,
                      ),
                    ),
                  ],
                ),
              ),
              PopupMenuButton<String>(
                onSelected: (action) {
                  switch (action) {
                    case 'edit':
                      _openCollectionForm(collection: collection);
                    case 'toggle':
                      _toggleCollection(collection);
                    case 'delete':
                      _deleteCollection(collection);
                  }
                },
                itemBuilder: (_) => const [
                  PopupMenuItem(value: 'edit', child: Text('Edit')),
                  PopupMenuItem(value: 'toggle', child: Text('Toggle active')),
                  PopupMenuItem(value: 'delete', child: Text('Delete')),
                ],
              ),
            ],
          ),
          const SizedBox(height: LetbuyySpacingTokens.space12),
          Wrap(
            spacing: LetbuyySpacingTokens.space8,
            runSpacing: LetbuyySpacingTokens.space8,
            children: [
              _pill(
                collection.isActive ? 'Active' : 'Inactive',
                collection.isActive ? colors.success : colors.warning,
              ),
              _pill(
                '${collection.productCount} products',
                LetbuyyColorTokens.info,
              ),
              if (collection.handle?.isNotEmpty == true)
                _pill('/collections/${collection.handle}', colors.accentTeal),
            ],
          ),
        ],
      ),
    );
  }

  Widget _collectionThumb(ProductCollectionContract collection) {
    final imageUrl = collection.imageUrl;
    return Container(
      width: 52,
      height: 52,
      decoration: BoxDecoration(
        color: LetbuyyColorTokens.brandPrimary.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(14),
      ),
      clipBehavior: Clip.antiAlias,
      child: imageUrl == null || imageUrl.isEmpty
          ? Icon(Icons.category_rounded, color: LetbuyyColorTokens.brandPrimary)
          : CachedMerchantImage(imageUrl: imageUrl, fit: BoxFit.cover),
    );
  }

  Widget _pill(String label, Color accent) {
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: LetbuyySpacingTokens.space8,
        vertical: LetbuyySpacingTokens.space4,
      ),
      decoration: BoxDecoration(
        color: accent.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        style: Theme.of(context).textTheme.labelMedium?.copyWith(
          color: accent,
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }

  Widget _message(AppThemeColors colors, String message, IconData icon) {
    return Container(
      padding: const EdgeInsets.all(LetbuyySpacingTokens.space24),
      decoration: BoxDecoration(
        color: colors.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: colors.cardBorder),
      ),
      child: Column(
        children: [
          Icon(icon, color: colors.textTertiary, size: 36),
          const SizedBox(height: LetbuyySpacingTokens.space12),
          Text(
            message,
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              color: colors.textSecondary,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}

class _CollectionFormSheet extends StatefulWidget {
  const _CollectionFormSheet({required this.storeId, this.collection});

  final String storeId;
  final ProductCollectionContract? collection;

  @override
  State<_CollectionFormSheet> createState() => _CollectionFormSheetState();
}

class _CollectionFormSheetState extends State<_CollectionFormSheet> {
  final _formKey = GlobalKey<FormState>();
  final _titleController = TextEditingController();
  final _descriptionController = TextEditingController();
  final _imageController = TextEditingController();

  bool _isSaving = false;

  @override
  void initState() {
    super.initState();
    final collection = widget.collection;
    if (collection != null) {
      _titleController.text = collection.title;
      _descriptionController.text = collection.description ?? '';
      _imageController.text = collection.imageUrl ?? '';
    }
  }

  @override
  void dispose() {
    _titleController.dispose();
    _descriptionController.dispose();
    _imageController.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _isSaving = true);
    final input = ProductCollectionInput(
      storeId: widget.storeId,
      title: _titleController.text.trim(),
      description: _descriptionController.text.trim(),
      imageUrl: _imageController.text.trim(),
    );
    try {
      final service = context.read<ProductService>();
      final collection = widget.collection == null
          ? await service.createCollection(input)
          : await service.updateCollection(widget.collection!.id, input);
      if (!mounted) return;
      Navigator.of(context).pop(collection);
    } catch (error) {
      _showSnackBar('Could not save collection: $error');
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  void _showSnackBar(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message), behavior: SnackBarBehavior.floating),
    );
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    final isEdit = widget.collection != null;
    return Padding(
      padding: EdgeInsets.only(
        left: LetbuyySpacingTokens.space20,
        right: LetbuyySpacingTokens.space20,
        top: LetbuyySpacingTokens.space20,
        bottom:
            MediaQuery.of(context).viewInsets.bottom +
            LetbuyySpacingTokens.space20,
      ),
      child: Form(
        key: _formKey,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              isEdit ? 'Edit collection' : 'New collection',
              style: Theme.of(context).textTheme.titleLarge?.copyWith(
                color: colors.textPrimary,
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: LetbuyySpacingTokens.space16),
            TextFormField(
              controller: _titleController,
              decoration: _inputDecoration(colors, 'Title'),
              validator: (value) => value?.trim().isEmpty == true
                  ? 'Collection title is required'
                  : null,
            ),
            const SizedBox(height: LetbuyySpacingTokens.space12),
            TextFormField(
              controller: _descriptionController,
              decoration: _inputDecoration(colors, 'Description'),
              minLines: 3,
              maxLines: 5,
            ),
            const SizedBox(height: LetbuyySpacingTokens.space12),
            TextFormField(
              controller: _imageController,
              decoration: _inputDecoration(colors, 'Image URL'),
              keyboardType: TextInputType.url,
            ),
            const SizedBox(height: LetbuyySpacingTokens.space16),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: _isSaving ? null : _save,
                icon: const Icon(Icons.check_rounded),
                label: Text(
                  _isSaving
                      ? 'Saving...'
                      : isEdit
                      ? 'Save changes'
                      : 'Create collection',
                ),
                style: ElevatedButton.styleFrom(
                  backgroundColor: LetbuyyColorTokens.brandPrimary,
                  foregroundColor: LetbuyyColorTokens.white,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  InputDecoration _inputDecoration(AppThemeColors colors, String label) {
    return InputDecoration(
      labelText: label,
      filled: true,
      fillColor: colors.surface,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide(color: colors.border),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide(color: colors.border),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide(color: LetbuyyColorTokens.brandPrimary),
      ),
    );
  }
}
