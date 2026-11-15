import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:letbuyy_models/letbuyy_models.dart' hide JsonMap;
import '../../app/store_context.dart';
import '../../services/api_client.dart';
import '../../services/product_service.dart';
import '../../services/security_command_store.dart';
import '../../theme/app_theme_colors.dart';
import '../../widgets/shared/merchant_store_view.dart';
import '../../widgets/shared/merchant_option_picker.dart';

class CategoriesScreen extends StatelessWidget {
  const CategoriesScreen({super.key});
  @override
  Widget build(BuildContext context) {
    final stores = context.watch<StoreContext>(), id = stores.selectedStoreId;
    if (id == null)
      return Scaffold(
        appBar: AppBar(title: const Text('Categories')),
        body: const Center(
          child: Text(
            'Choose a store from the dashboard to manage categories.',
          ),
        ),
      );
    return _CategoryWorkspace(
      key: ValueKey(stores.requestContextKey),
      storeId: id,
    );
  }
}

class _CategoryWorkspace extends StatefulWidget {
  const _CategoryWorkspace({super.key, required this.storeId});
  final String storeId;
  @override
  State<_CategoryWorkspace> createState() => _CategoryWorkspaceState();
}

class _CategoryWorkspaceState extends State<_CategoryWorkspace> {
  late final MerchantStoreView _view;
  final _search = TextEditingController();
  ProductCategoryPage? _page;
  PendingSecurityCommand? _pending;
  int _pageNumber = 1;
  String _query = '';
  bool _busy = true, _denied = false;
  String? _error, _notice;
  ProductService get _service => context.read<ProductService>();
  bool get _current => mounted && merchantStoreViewCurrent(context, _view);
  @override
  void initState() {
    super.initState();
    _view = (
      key: context.read<StoreContext>().requestContextKey,
      storeId: widget.storeId,
    );
    _refresh();
  }

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    final result = await _service.readCategoryPage(
      widget.storeId,
      page: _pageNumber,
      search: _query,
    );
    if (!_current) return;
    setState(() => _page = result);
  }

  Future<void> _work(Future<void> Function() action) async {
    if (!_current || _busy || _denied) return;
    setState(() {
      _busy = true;
      _error = null;
      _notice = null;
    });
    try {
      await action();
    } catch (error) {
      if (!_current) return;
      if (error is ApiException &&
          (error.statusCode == 401 ||
              error.statusCode == 403 ||
              error.code == 'SESSION_CONTEXT_CHANGED')) {
        setState(() {
          _denied = true;
          _page = null;
          _pending = null;
          _error =
              'Store access changed. Reopen categories from the selected store.';
        });
      } else {
        try {
          final pending = await _service.pendingCategoryCommand(widget.storeId);
          if (_current) setState(() => _pending = pending);
        } catch (_) {
          /* Keep a previously observed request until its storage can be read. */
        }
        if (_current)
          setState(
            () => _error = error is ApiException
                ? error.message
                : error is FormatException
                ? error.message
                : 'The category outcome could not be confirmed. Retry the original request.',
          );
      }
    } finally {
      if (_current) setState(() => _busy = false);
    }
  }

  Future<void> _refresh() async {
    if (!_current) return;
    setState(() {
      _busy = false;
      _page = null;
    });
    await _work(() async {
      final pending = await _service.pendingCategoryCommand(widget.storeId);
      if (!_current) return;
      setState(() => _pending = pending);
      await _load();
    });
  }

  Future<void> _editor(ProductCategoryContract? row) async {
    ProductCategoryContract? parent;
    if (row?.parentId != null)
      parent = await _service.readCategory(widget.storeId, row!.parentId!);
    if (!_current) return;
    final fields = await Navigator.of(context).push<JsonMap>(
      MaterialPageRoute<JsonMap>(
        settings: RouteSettings(
          name: row == null ? '/categories/new' : '/categories/${row.id}/edit',
        ),
        builder: (_) => guardMerchantStoreView(
          _view,
          _CategoryForm(view: _view, row: row, parent: parent),
          fullPage: true,
        ),
      ),
    );
    if (!_current || fields == null) return;
    final result = await _service.saveCategory(
      widget.storeId,
      row == null ? 'create' : 'update',
      {...fields, if (row != null) 'version': row.version},
      id: row?.id,
    );
    if (!_current) return;
    setState(() {
      _pending = null;
      _notice =
          'Category saved. ${result.affectedProducts} assigned products updated.';
    });
    await _load();
  }

  Future<void> _edit(ProductCategoryContract? row) => _work(() async {
    if (_pending != null)
      throw const FormatException('Recover the saved category request first.');
    final current = row == null
        ? null
        : await _service.readCategory(widget.storeId, row.id);
    if (_current) await _editor(current);
  });
  Future<void> _delete(ProductCategoryContract row) => _work(() async {
    if (_pending != null)
      throw const FormatException('Recover the saved category request first.');
    final approved = await showLetbuyyConfirmation(
      context: context,
      title: 'Delete empty category?',
      message:
          'Delete ${row.name}? Move its products and child categories first.',
      cancelLabel: 'Keep category',
      confirmLabel: 'Delete category',
      destructive: true,
      guard: (_, confirmation) => guardMerchantStoreView(_view, confirmation),
    );
    if (approved != true || !_current) return;
    await _service.saveCategory(widget.storeId, 'delete', {
      'version': row.version,
    }, id: row.id);
    if (!_current) return;
    setState(() {
      _notice = 'Category deleted.';
      _pending = null;
    });
    await _load();
  });
  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context),
        editable = !_busy && !_denied && _pending == null && _page != null;
    return Scaffold(
      backgroundColor: colors.bgStart,
      appBar: AppBar(
        title: const Text('Categories'),
        backgroundColor: colors.bgStart,
        actions: [
          IconButton(
            tooltip: 'Refresh categories',
            onPressed: _busy || _denied ? null : _refresh,
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: editable ? null : colors.card,
        foregroundColor: editable ? null : colors.textSecondary,
        onPressed: editable ? () => _edit(null) : null,
        icon: const Icon(Icons.add),
        label: const Text('New category'),
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 100),
        children: [
          Text(
            'Organize the labels assigned to your products.',
            style: TextStyle(color: colors.textSecondary),
          ),
          if (_busy) const LinearProgressIndicator(),
          if (_error != null)
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Text(
                  _error!,
                  style: TextStyle(color: colors.textPrimary),
                ),
              ),
            ),
          if (_notice != null)
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Text(_notice!),
              ),
            ),
          if (_pending != null)
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Saved category request needs recovery'),
                    Text(
                      'Recover the original ${_pending!.intent['operation']} before making another change.',
                    ),
                    TextButton(
                      onPressed: _busy || _denied
                          ? null
                          : () => _work(() async {
                              final result = await _service.retryCategory(
                                widget.storeId,
                              );
                              if (!_current) return;
                              setState(() {
                                _pending = null;
                                _notice =
                                    'Original category ${result.operation} confirmed.';
                              });
                              await _load();
                            }),
                      child: const Text('Retry original category request'),
                    ),
                    if (_pending!.intent['outcome'] == 'rejected')
                      TextButton(
                        onPressed: _busy || _denied
                            ? null
                            : () => _work(() async {
                                final row = await _service
                                    .reviewRejectedCategory(widget.storeId);
                                if (!_current) return;
                                setState(() => _pending = null);
                                await _editor(row);
                              }),
                        child: const Text(
                          'Review current category after rejection',
                        ),
                      ),
                  ],
                ),
              ),
            ),
          TextField(
            controller: _search,
            enabled: !_busy && !_denied,
            maxLength: 200,
            decoration: InputDecoration(
              labelText: 'Search categories',
              suffixIcon: IconButton(
                tooltip: 'Search categories',
                onPressed: _busy || _denied
                    ? null
                    : () {
                        _pageNumber = 1;
                        _query = _search.text.trim();
                        _refresh();
                      },
                icon: const Icon(Icons.search),
              ),
            ),
            onSubmitted: (_) {
              if (!_busy && !_denied) {
                _pageNumber = 1;
                _query = _search.text.trim();
                _refresh();
              }
            },
          ),
          Text(
            _page == null
                ? 'Category counts are unavailable.'
                : '${_page!.total} categories · Page $_pageNumber',
          ),
          if (_page != null && _page!.rows.isEmpty)
            const Padding(
              padding: EdgeInsets.all(16),
              child: Text('No categories match this page.'),
            ),
          if (_page != null)
            ..._page!.rows.map(
              (row) => Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        row.name,
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w600,
                          color: colors.textPrimary,
                        ),
                      ),
                      Text(row.path),
                      Text(
                        '${row.productsCount} products · ${row.childrenCount} children',
                      ),
                      Text(
                        row.isVisible
                            ? 'Category metadata visible'
                            : 'Category metadata hidden',
                      ),
                      Wrap(
                        children: [
                          TextButton(
                            onPressed: editable ? () => _edit(row) : null,
                            child: Text('Edit ${row.name}'),
                          ),
                          TextButton(
                            onPressed: editable ? () => _delete(row) : null,
                            child: Text('Delete ${row.name}'),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              TextButton(
                onPressed: _busy || _denied || _pageNumber == 1
                    ? null
                    : () {
                        _pageNumber--;
                        _refresh();
                      },
                child: const Text('Previous categories'),
              ),
              TextButton(
                onPressed: _busy || _denied || _page?.hasNext != true
                    ? null
                    : () {
                        _pageNumber++;
                        _refresh();
                      },
                child: const Text('Next categories'),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _CategoryForm extends StatefulWidget {
  const _CategoryForm({required this.view, this.row, this.parent});
  final MerchantStoreView view;
  final ProductCategoryContract? row, parent;
  @override
  State<_CategoryForm> createState() => _CategoryFormState();
}

class _CategoryFormState extends State<_CategoryForm> {
  late final TextEditingController _name, _slug, _description, _image, _order;
  ProductCategoryContract? _parent;
  late bool _visible;
  bool _dirty = false, _allowLeave = false;
  @override
  void initState() {
    super.initState();
    final row = widget.row;
    _name = TextEditingController(text: row?.name ?? '');
    _slug = TextEditingController(text: row?.slug ?? '');
    _description = TextEditingController(text: row?.description ?? '');
    _image = TextEditingController(text: row?.imageUrl ?? '');
    _order = TextEditingController(text: '${row?.displayOrder ?? 0}');
    _parent = widget.parent;
    _visible = row?.isVisible ?? true;
  }

  @override
  void dispose() {
    for (final c in [_name, _slug, _description, _image, _order]) {
      c.dispose();
    }
    super.dispose();
  }

  void _submit() {
    if (!merchantStoreViewCurrent(context, widget.view)) return;
    final fields = <String, dynamic>{
      'name': _name.text.trim(),
      if (_slug.text.trim().isNotEmpty) 'slug': _slug.text.trim(),
      'description': _description.text.trim().isEmpty
          ? null
          : _description.text.trim(),
      'image_url': _image.text.trim().isEmpty ? null : _image.text.trim(),
      'parent_id': _parent?.id,
      'display_order': int.tryParse(_order.text),
      'is_visible': _visible,
    };
    try {
      validateProductCategoryCommand(widget.row == null ? 'create' : 'update', {
        ...fields,
        'store_id': widget.view.storeId,
        'idempotency_key': '00000000-0000-4000-8000-000000000000',
        if (widget.row != null) 'version': widget.row!.version,
      });
    } catch (_) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Review the category name, slug, image URL and display order.',
          ),
        ),
      );
      return;
    }
    setState(() => _allowLeave = true);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted && merchantStoreViewCurrent(context, widget.view))
        Navigator.pop(context, fields);
    });
  }

  @override
  Widget build(BuildContext context) => LetbuyyEditorScaffold(
    title: widget.row == null ? 'New category' : 'Edit category',
    hasChanges: _dirty && !_allowLeave,
    discardTitle: 'Discard unsaved category fields?',
    discardLabel: 'Discard',
    keepEditingLabel: 'Keep editing',
    confirmationGuard: (_, confirmation) =>
        guardMerchantStoreView(widget.view, confirmation),
    body: ListView(
      padding: const EdgeInsets.all(LetbuyySpacingTokens.space20),
      children: [
        const Text(
          'Renaming updates assigned product labels together. Deleting requires moving products and children first.',
        ),
        const SizedBox(height: LetbuyySpacingTokens.space16),
        for (final field in [
          (label: 'Name', controller: _name, max: 100),
          (label: 'Slug', controller: _slug, max: 100),
          (label: 'Description', controller: _description, max: 500),
          (label: 'Image URL', controller: _image, max: 2048),
          (label: 'Display order', controller: _order, max: 10),
        ])
          Padding(
            padding: const EdgeInsets.only(
              bottom: LetbuyySpacingTokens.space16,
            ),
            child: CustomTextField(
              controller: field.controller,
              maxLength: field.max,
              label: field.label,
              onChanged: (_) => setState(() => _dirty = true),
            ),
          ),
        SwitchListTile(
          title: const Text('Visible category metadata'),
          value: _visible,
          onChanged: (v) => setState(() {
            _visible = v;
            _dirty = true;
          }),
        ),
        Text('Parent: ${_parent?.name ?? 'Root category'}'),
        Wrap(
          children: [
            TextButton(
              onPressed: () => setState(() {
                _parent = null;
                _dirty = true;
              }),
              child: const Text('Use root category'),
            ),
            TextButton(
              onPressed: () async {
                final service = context.read<ProductService>();
                final selected =
                    await chooseMerchantOption<ProductCategoryContract>(
                      context,
                      widget.view,
                      'Parent category',
                      (page, search) async {
                        final result = await service.readCategoryPage(
                          widget.view.storeId,
                          page: page,
                          search: search,
                        );
                        return PaginatedResponse(
                          data: result.rows,
                          page: result.page,
                          limit: result.limit,
                          total: result.total,
                          hasMore: result.hasNext,
                          meta: {'total_is_exact': true},
                        );
                      },
                      (row) => row.name,
                    );
                if (mounted &&
                    merchantStoreViewCurrent(context, widget.view) &&
                    selected != null)
                  setState(() {
                    _parent = selected;
                    _dirty = true;
                  });
              },
              child: const Text('Choose parent category'),
            ),
          ],
        ),
      ],
    ),
    actions: OverflowBar(
      alignment: MainAxisAlignment.end,
      spacing: LetbuyySpacingTokens.space12,
      children: [
        TextButton(
          onPressed: () => Navigator.maybePop(context),
          child: const Text('Close category form'),
        ),
        FilledButton(
          onPressed: _submit,
          child: Text(
            widget.row == null ? 'Create category' : 'Update category',
          ),
        ),
      ],
    ),
  );
}
