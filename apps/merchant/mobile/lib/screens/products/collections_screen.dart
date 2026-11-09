import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:letbuyy_models/letbuyy_models.dart' hide JsonMap;
import '../../app/store_context.dart';
import '../../services/api_client.dart';
import '../../services/product_service.dart';
import '../../services/security_command_store.dart';
import '../../widgets/shared/merchant_store_view.dart';
import '../../widgets/shared/cached_merchant_image.dart';
import 'collection_membership_screen.dart';

class CollectionsScreen extends StatefulWidget {
  const CollectionsScreen({super.key});
  @override
  State<CollectionsScreen> createState() => _CollectionsScreenState();
}

class _CollectionsScreenState extends State<CollectionsScreen> {
  bool _loading = true;
  String? _error;
  @override
  void initState() {
    super.initState();
    _prepare();
  }

  Future<void> _prepare() async {
    final captured = context.read<StoreContext>().requestContextKey;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await context.read<StoreContext>().ensureSelectedStore();
    } catch (_) {
      if (mounted && context.read<StoreContext>().requestContextKey == captured)
        setState(
          () => _error =
              'The selected store could not be confirmed. Retry loading collections.',
        );
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final stores = context.watch<StoreContext>(), id = stores.selectedStoreId;
    if (_loading || _error != null || id == null)
      return Scaffold(
        appBar: CustomAppBar.responsive(context: context, title: 'Collections'),
        body: Center(
          child: _loading
              ? const Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    LoadingIndicator(),
                    SizedBox(height: 16),
                    Text('Loading collections…'),
                  ],
                )
              : Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      _error ??
                          'Choose a store from the dashboard to manage collections.',
                    ),
                    if (_error != null)
                      TextButton(
                        onPressed: _prepare,
                        child: const Text('Retry'),
                      ),
                  ],
                ),
        ),
      );
    return _CollectionsWorkspace(
      key: ValueKey(stores.requestContextKey),
      storeId: id,
    );
  }
}

class _CollectionsWorkspace extends StatefulWidget {
  const _CollectionsWorkspace({super.key, required this.storeId});
  final String storeId;
  @override
  State<_CollectionsWorkspace> createState() => _CollectionsWorkspaceState();
}

class _CollectionsWorkspaceState extends State<_CollectionsWorkspace> {
  late final MerchantStoreView _view;
  final _search = TextEditingController();
  CollectionListPage? _manual;
  SmartCollectionPage? _smart;
  PendingSecurityCommand? _pending;
  PendingSecurityCommand? _savedSelection;
  String? _selectionRecoveryError;
  String _kind = 'manual', _query = '';
  int _page = 1;
  bool _busy = true, _denied = false, _started = false;
  ({String kind, String query, int page})? _loadedQuery;
  bool get _ready => _current && !_busy && !_denied && _pending == null;
  String? _error, _notice;
  ProductService get _products => context.read<ProductService>();
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
    if (!_current) return;
    final kind = _kind, query = _query, page = _page;
    final requested = (kind: kind, query: query, page: page);
    if (_loadedQuery != requested)
      setState(() {
        _manual = null;
        _smart = null;
        _loadedQuery = null;
      });
    if (kind == 'smart') {
      final value = await _products.collectionMetadata.readSmartPage(
        widget.storeId,
        page: page,
        search: query,
      );
      if (_current && _kind == kind && _query == query && _page == page)
        setState(() {
          _smart = value;
          _loadedQuery = requested;
        });
    } else {
      final value = await _products.readCollectionPage(
        widget.storeId,
        page: page,
        search: query,
      );
      if (_current && _kind == kind && _query == query && _page == page)
        setState(() {
          _manual = value;
          _loadedQuery = requested;
        });
    }
  }

  void _applyKind(String value) {
    if (!_current || _busy || _denied || value == _kind) return;
    setState(() {
      _kind = value;
      _page = 1;
      _query = '';
      _search.clear();
    });
    _refresh();
  }

  void _applySearch() {
    if (!_ready) return;
    setState(() {
      _query = _search.text.trim();
      _page = 1;
    });
    _work(_load);
  }

  void _changePage(int delta) {
    final loaded = _kind == 'manual' ? _manual != null : _smart != null,
        more = _kind == 'manual' ? _manual?.hasNext : _smart?.hasNext;
    if (!_ready ||
        !loaded ||
        (delta < 0 && _page <= 1) ||
        (delta > 0 && more != true))
      return;
    setState(() => _page += delta);
    _work(_load);
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
    } catch (e) {
      if (!_current) return;
      if (e is ApiException &&
          (e.statusCode == 401 ||
              e.statusCode == 403 ||
              e.code == 'SESSION_CONTEXT_CHANGED')) {
        setState(() {
          _denied = true;
          _manual = null;
          _smart = null;
          _pending = null;
          _savedSelection = null;
          _selectionRecoveryError = null;
          _error =
              'Store access changed. Reopen collections from the intended store.';
        });
      } else {
        try {
          final p = await _products.collectionMetadata.pending(widget.storeId);
          if (_current) setState(() => _pending = p);
        } catch (_) {}
        if (_current)
          setState(
            () => _error = e is ApiException
                ? e.message
                : e is FormatException
                ? e.message
                : 'The collection outcome could not be confirmed. Retry the original request.',
          );
      }
    } finally {
      if (_current) setState(() => _busy = false);
    }
  }

  Future<void> _refresh() async {
    if (!_current || (_busy && _started)) return;
    _started = true;
    setState(() => _busy = false);
    await _work(() async {
      final p = await _products.collectionMetadata.pending(widget.storeId);
      if (!_current) return;
      setState(() => _pending = p);
      await _load();
      if (!_current) return;
      await _loadSavedSelection();
    });
  }

  Future<void> _loadSavedSelection() async {
    if (!_current) return;
    try {
      final saved = await _products.pendingCollectionMemberships(
        widget.storeId,
      );
      if (_current)
        setState(() {
          _savedSelection = saved.isEmpty ? null : saved.first;
          _selectionRecoveryError = null;
        });
    } catch (_) {
      if (_current)
        setState(() {
          _savedSelection = null;
          _selectionRecoveryError =
              'Saved product-selection recovery is unavailable. Refresh collections to retry.';
        });
    }
  }

  Future<void> _retrySavedSelection() => _work(() async {
    final saved = _savedSelection;
    if (saved == null) return;
    try {
      await _products.retryCollectionMembership(
        widget.storeId,
        saved.intent['collection_id'] as String,
      );
      if (!_current) return;
      setState(() => _notice = 'Saved product selection confirmed.');
      await _load();
    } finally {
      if (_current) await _loadSavedSelection();
    }
  });

  Future<void> _discardMissingSelection() => _work(() async {
    final saved = _savedSelection;
    if (saved == null || saved.intent['outcome'] != 'missing') return;
    final discard = await showLetbuyyConfirmation(
      context: context,
      title: 'Discard rejected product selection?',
      message:
          'We will check the original save again before discarding the selection for the removed collection.',
      cancelLabel: 'Keep saved request',
      confirmLabel: 'Discard selection request',
      destructive: true,
      guard: (_, confirmation) => guardMerchantStoreView(_view, confirmation),
    );
    if (discard != true || !_current) return;
    try {
      final receipt = await _products.discardMissingCollectionMembership(
        widget.storeId,
        saved.intent['collection_id'] as String,
      );
      if (!_current) return;
      setState(
        () => _notice = receipt == null
            ? 'Rejected product selection request discarded.'
            : 'Saved product selection confirmed.',
      );
      await _load();
    } finally {
      if (_current) await _loadSavedSelection();
    }
  });

  Future<void> _edit(
    String? id, {
    JsonMap? kept,
    CollectionMetadataContract? manual,
    SmartCollectionContract? smart,
  }) => _work(() async {
    if (_pending != null)
      throw const FormatException(
        'Recover the original collection request first.',
      );
    if (id != null && manual == null && smart == null) {
      if (_kind == 'smart') {
        smart = await _products.collectionMetadata.readSmart(
          widget.storeId,
          id,
        );
      } else {
        manual = await _products.collectionMetadata.readManual(
          widget.storeId,
          id,
        );
      }
    }
    if (_current) await _editor(id, manual: manual, smart: smart, kept: kept);
  });
  Future<void> _editor(
    String? id, {
    CollectionMetadataContract? manual,
    SmartCollectionContract? smart,
    JsonMap? kept,
  }) async {
    final fields = await Navigator.push<JsonMap>(
      context,
      MaterialPageRoute(
        builder: (_) => guardMerchantStoreView(
          _view,
          _CollectionForm(
            view: _view,
            kind: _kind,
            manual: manual,
            smart: smart,
            kept: kept,
          ),
          fullPage: true,
        ),
      ),
    );
    if (!_current || fields == null) return;
    await _products.collectionMetadata.save(
      widget.storeId,
      id == null ? 'create' : 'update',
      {...fields, if (id != null) 'version': manual?.version ?? smart!.version},
      id: id,
    );
    if (!_current) return;
    setState(() {
      _pending = null;
      _notice = 'Collection saved.';
    });
    await _load();
  }

  Future<void> _delete(String id) => _work(() async {
    if (_pending != null)
      throw const FormatException(
        'Recover the original collection request first.',
      );
    final manual = _kind == 'manual'
        ? await _products.collectionMetadata.readManual(widget.storeId, id)
        : null;
    final smart = _kind == 'smart'
        ? await _products.collectionMetadata.readSmart(widget.storeId, id)
        : null;
    if (!_current) return;
    final confirmed = await showLetbuyyConfirmation(
      context: context,
      title: 'Delete collection?',
      message:
          'Delete ${manual?.title ?? smart!.title}? Products remain in your catalog.',
      cancelLabel: 'Keep collection',
      confirmLabel: 'Delete collection',
      destructive: true,
      guard: (_, confirmation) => guardMerchantStoreView(_view, confirmation),
    );
    if (confirmed != true || !_current) return;
    await _products.collectionMetadata.save(widget.storeId, 'delete', {
      'collection_type': _kind,
      'version': manual?.version ?? smart!.version,
    }, id: id);
    if (!_current) return;
    setState(() {
      _pending = null;
      _notice = 'Collection deleted.';
    });
    await _load();
  });
  Future<void> _review() => _work(() async {
    final pending = _pending;
    if (pending == null) return;
    final kept = asJsonMap(pending.intent['fields']),
        id = pending.intent['collection_id'] as String?;
    final current = await _products.collectionMetadata.review(widget.storeId);
    if (!_current) return;
    setState(() {
      _pending = null;
      _kind = kept['collection_type'] as String;
    });
    await _editor(id, manual: current.$1, smart: current.$2, kept: kept);
  });
  Future<void> _discardMissing() => _work(() async {
    if (_pending?.intent['outcome'] != 'missing') return;
    final discard = await showLetbuyyConfirmation(
      context: context,
      title: 'Discard rejected collection request?',
      message:
          'The collection was removed. We will check the original request again before discarding its kept edits.',
      cancelLabel: 'Keep original request',
      confirmLabel: 'Discard request',
      destructive: true,
      guard: (_, confirmation) => guardMerchantStoreView(_view, confirmation),
    );
    if (discard != true || !_current) return;
    final receipt = await _products.collectionMetadata.discardMissing(
      widget.storeId,
    );
    if (!_current) return;
    setState(() {
      _pending = null;
      _notice = receipt == null
          ? 'Rejected request discarded. The collection remains deleted.'
          : 'Original collection save confirmed.';
    });
    await _load();
  });
  Future<void> _membership(String id) => _work(() async {
    await Navigator.push<void>(
      context,
      MaterialPageRoute(
        builder: (_) => CollectionMembershipScreen(
          storeId: widget.storeId,
          collectionId: id,
        ),
      ),
    );
    if (_current) {
      await _load();
      if (!_current) return;
      await _loadSavedSelection();
    }
  });
  @override
  Widget build(BuildContext context) {
    final ready = _ready,
        loaded = _kind == 'manual' ? _manual != null : _smart != null;
    final total = _kind == 'manual' ? _manual?.total : _smart?.total,
        more = _kind == 'manual' ? _manual?.hasNext : _smart?.hasNext;
    final rows = _kind == 'manual'
        ? _manual?.rows.length ?? 0
        : _smart?.rows.length ?? 0;
    final storeName = context.watch<StoreContext>().selectedStore?.name;
    return Scaffold(
      appBar: CustomAppBar.responsive(
        context: context,
        title: _kind == 'manual' ? 'Collections' : 'Smart collections',
        actions: [
          IconButton(
            tooltip: 'Refresh collections',
            onPressed: _busy || _denied ? null : _refresh,
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      body: SafeArea(
        top: false,
        child: Column(
          children: [
            if (_busy)
              Semantics(
                liveRegion: true,
                child: Padding(
                  padding: const EdgeInsets.all(LetbuyySpacingTokens.space12),
                  child: Row(
                    children: [
                      const LoadingIndicator(),
                      const SizedBox(width: LetbuyySpacingTokens.space12),
                      Expanded(
                        child: Text(
                          loaded
                              ? 'Updating collections…'
                              : 'Loading collections…',
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.all(LetbuyySpacingTokens.space16),
                children: [
                  if (storeName != null)
                    Text(
                      storeName,
                      style: Theme.of(context).textTheme.bodyLarge,
                    ),
                  Wrap(
                    spacing: 12,
                    runSpacing: 8,
                    crossAxisAlignment: WrapCrossAlignment.center,
                    children: [
                      LetbuyyChoiceField<String>(
                        compact: true,
                        label: 'Collection type',
                        value: _kind,
                        choices: const [
                          LetbuyyChoice(value: 'manual', label: 'Manual'),
                          LetbuyyChoice(value: 'smart', label: 'Smart'),
                        ],
                        onChanged: _busy || _denied ? null : _applyKind,
                      ),
                      FilledButton.icon(
                        onPressed: ready && loaded ? () => _edit(null) : null,
                        icon: const Icon(Icons.add),
                        label: const Text('New collection'),
                      ),
                    ],
                  ),
                  if (_error != null)
                    Card(
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Text(_error!),
                      ),
                    ),
                  if (_notice != null)
                    Card(
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Text(_notice!),
                      ),
                    ),
                  if (_pending != null && !_denied)
                    Card(
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'Original collection request needs confirmation',
                            ),
                            Text(
                              'The original ${_pending!.intent['operation']} details and save key are retained securely.',
                            ),
                            TextButton(
                              onPressed: _busy
                                  ? null
                                  : () => _work(() async {
                                      await _products.collectionMetadata.retry(
                                        widget.storeId,
                                      );
                                      if (!_current) return;
                                      setState(() {
                                        _pending = null;
                                        _notice =
                                            'Original collection save confirmed.';
                                      });
                                      await _load();
                                    }),
                              child: const Text(
                                'Retry original collection save',
                              ),
                            ),
                            if (_pending!.intent['outcome'] == 'rejected')
                              TextButton(
                                onPressed: _busy ? null : _review,
                                child: const Text(
                                  'Review current version and kept edits',
                                ),
                              ),
                            if (_pending!.intent['outcome'] == 'missing')
                              TextButton(
                                onPressed: _busy ? null : _discardMissing,
                                child: const Text(
                                  'Discard rejected collection request',
                                ),
                              ),
                          ],
                        ),
                      ),
                    ),
                  if (_selectionRecoveryError != null && !_denied)
                    Card(
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Text(_selectionRecoveryError!),
                      ),
                    ),
                  if (_savedSelection != null && !_denied)
                    Card(
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'Saved product selection needs confirmation',
                            ),
                            const Text(
                              'The original selection is retained securely even if the collection is no longer listed.',
                            ),
                            TextButton(
                              onPressed: _busy ? null : _retrySavedSelection,
                              child: const Text(
                                'Retry saved product selection',
                              ),
                            ),
                            if (_savedSelection!.intent['outcome'] == 'missing')
                              TextButton(
                                onPressed: _busy
                                    ? null
                                    : _discardMissingSelection,
                                child: const Text(
                                  'Discard rejected product selection',
                                ),
                              ),
                            if (_savedSelection!.intent['outcome'] != 'missing')
                              TextButton(
                                onPressed: _busy
                                    ? null
                                    : () => _membership(
                                        _savedSelection!.intent['collection_id']
                                            as String,
                                      ),
                                child: const Text('Open saved selection'),
                              ),
                          ],
                        ),
                      ),
                    ),

                  if (!_denied) ...[
                    const SizedBox(height: 16),
                    CustomTextField(
                      controller: _search,
                      enabled: ready,
                      label: 'Search collections',
                      maxLength: 200,
                      textInputAction: TextInputAction.search,
                      onSubmitted: ready ? (_) => _applySearch() : null,
                    ),
                    Align(
                      alignment: AlignmentDirectional.centerStart,
                      child: TextButton(
                        onPressed: ready ? _applySearch : null,
                        child: const Text('Search'),
                      ),
                    ),
                    Text(
                      _query.isEmpty
                          ? 'Results: all ${_kind == 'manual' ? 'manual' : 'smart'} collections'
                          : 'Results for “$_query”',
                    ),
                    Text(
                      total == null
                          ? 'Collection count unavailable'
                          : '$total matching collections · Page $_page',
                    ),
                    if (loaded && (_busy || _error != null))
                      const Text(
                        'Previously loaded results are shown. Refresh to check the current data.',
                      ),
                    if (loaded && rows == 0)
                      const Padding(
                        padding: EdgeInsets.all(24),
                        child: Text('No matching collections on this page.'),
                      ),
                    for (var n = 0; n < rows; n++)
                      _collectionCard(
                        _kind == 'manual' ? _manual!.rows[n] : null,
                        _kind == 'smart' ? _smart!.rows[n] : null,
                        ready,
                      ),
                    Wrap(
                      spacing: 12,
                      runSpacing: 8,
                      children: [
                        TextButton(
                          onPressed: ready && loaded && _page > 1
                              ? () => _changePage(-1)
                              : null,
                          child: const Text('Previous'),
                        ),
                        TextButton(
                          onPressed: ready && loaded && more == true
                              ? () => _changePage(1)
                              : null,
                          child: const Text('Next'),
                        ),
                      ],
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _collectionCard(
    ProductCollectionContract? manual,
    SmartCollectionContract? smart,
    bool ready,
  ) {
    final id = manual?.id ?? smart!.id,
        title = manual?.title ?? smart!.title,
        published = manual?.isActive ?? smart!.published;
    final description = manual?.description ?? smart?.description;
    return Card(
      child: InkWell(
        onTap: ready ? () => _edit(id) : null,
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (manual?.imageUrl?.isNotEmpty == true) ...[
                    ClipRRect(
                      borderRadius: BorderRadius.circular(8),
                      child: CachedMerchantImage(
                        imageUrl: manual!.imageUrl!,
                        width: 48,
                        height: 48,
                      ),
                    ),
                    const SizedBox(width: 12),
                  ],
                  Expanded(
                    child: Text(
                      title,
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                  ),
                  PopupMenuButton<String>(
                    enabled: ready,
                    onSelected: (value) {
                      if (value == 'edit') _edit(id);
                      if (value == 'delete') _delete(id);
                      if (value == 'products') _membership(id);
                    },
                    itemBuilder: (_) => [
                      const PopupMenuItem(
                        value: 'edit',
                        child: Text('Edit details'),
                      ),
                      if (manual != null)
                        const PopupMenuItem(
                          value: 'products',
                          child: Text('Manage products and order'),
                        ),
                      const PopupMenuItem(
                        value: 'delete',
                        child: Text('Delete collection'),
                      ),
                    ],
                  ),
                ],
              ),
              if (description?.isNotEmpty == true) Text(description!),
              if (manual != null)
                Text(
                  manual.productCount == null
                      ? 'Assigned product count unavailable'
                      : '${manual.productCount} assigned products',
                )
              else
                Text(
                  '${smart!.rules.length} rules · ${smart.matchType == 'all' ? 'All conditions' : 'Any condition'}',
                ),
              Text(published ? 'Published' : 'Unpublished'),
              if (smart != null && smart.createdAt == null)
                const Text('Creation date unavailable'),
            ],
          ),
        ),
      ),
    );
  }
}

class _CollectionForm extends StatefulWidget {
  const _CollectionForm({
    required this.view,
    required this.kind,
    this.manual,
    this.smart,
    this.kept,
  });
  final MerchantStoreView view;
  final String kind;
  final CollectionMetadataContract? manual;
  final SmartCollectionContract? smart;
  final JsonMap? kept;
  @override
  State<_CollectionForm> createState() => _CollectionFormState();
}

class _CollectionFormState extends State<_CollectionForm> {
  final _title = TextEditingController(),
      _slug = TextEditingController(),
      _description = TextEditingController(),
      _image = TextEditingController();
  late List<JsonMap> _rules;
  late String _match;
  late bool _published;
  late String _initial;
  SmartCollectionPreview? _preview;
  final _previewKey = GlobalKey();
  bool _loadingPreview = false, _allowPop = false;
  String? _error;
  bool get _smart => widget.kind == 'smart';
  bool get _current =>
      mounted && merchantStoreViewCurrent(context, widget.view);
  JsonMap _fields() => {
    'collection_type': widget.kind,
    'title': _title.text.trim(),
    'slug': _slug.text.isEmpty ? null : _slug.text.trim(),
    'description': _description.text.isEmpty ? null : _description.text,
    'is_active': _published,
    if (!_smart) 'image_url': _image.text.isEmpty ? null : _image.text,
    if (_smart) ...{'conditions': _rules, 'match_type': _match},
  };
  @override
  void initState() {
    super.initState();
    final manual = widget.manual,
        smart = widget.smart,
        kept = widget.kept ?? {};
    _title.text =
        kept['title'] as String? ?? manual?.title ?? smart?.title ?? '';
    _slug.text = kept.containsKey('slug')
        ? kept['slug'] as String? ?? ''
        : manual?.slug ?? smart?.slug ?? '';
    _description.text = kept.containsKey('description')
        ? kept['description'] as String? ?? ''
        : manual?.description ?? smart?.description ?? '';
    _image.text = kept.containsKey('image_url')
        ? kept['image_url'] as String? ?? ''
        : manual?.imageUrl ?? '';
    _published =
        kept['is_active'] as bool? ??
        manual?.published ??
        smart?.published ??
        !_smart;
    _match = kept['match_type'] as String? ?? smart?.matchType ?? 'all';
    _rules = validateCollectionRules(
      kept['conditions'] ?? smart?.rules ?? [],
    ).map((r) => Map<String, dynamic>.from(r)).toList();
    _initial = _encoded();
    for (final controller in [_title, _slug, _description, _image]) {
      controller.addListener(_draftChanged);
    }
  }

  String _encoded() => jsonEncode(_fields());
  void _draftChanged() {
    if (_current) setState(() {});
  }

  @override
  void dispose() {
    for (final controller in [_title, _slug, _description, _image]) {
      controller.removeListener(_draftChanged);
    }
    _title.dispose();
    _slug.dispose();
    _description.dispose();
    _image.dispose();
    super.dispose();
  }

  Future<void> _close() async {
    if (!_current) return;
    if (_encoded() != _initial) {
      final discard = await showLetbuyyConfirmation(
        context: context,
        title: 'Discard unsaved collection edits?',
        message:
            'Your unsaved collection draft will be discarded. No new request is submitted by closing this editor.',
        cancelLabel: 'Keep editing',
        confirmLabel: 'Discard edits',
        destructive: true,
        guard: (_, confirmation) =>
            guardMerchantStoreView(widget.view, confirmation),
      );
      if (discard != true || !_current) return;
    }
    setState(() => _allowPop = true);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_current) Navigator.pop(context);
    });
  }

  void _save() {
    if (!_current || _loadingPreview) return;
    try {
      validateCollectionMetadataCommand(
        widget.manual == null && widget.smart == null ? 'create' : 'update',
        {
          ..._fields(),
          'store_id': widget.view.storeId,
          'idempotency_key': '00000000-0000-4000-8000-000000000000',
          if (widget.manual != null || widget.smart != null)
            'version': widget.manual?.version ?? widget.smart!.version,
        },
      );
      setState(() => _allowPop = true);
      final result = _fields();
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (_current) Navigator.pop(context, result);
      });
    } catch (_) {
      setState(
        () => _error =
            'Review the name, slug, description, media and rules before saving.',
      );
    }
  }

  Future<void> _loadPreview() async {
    final row = widget.smart;
    if (row == null || !_current || _loadingPreview) return;
    setState(() {
      _loadingPreview = true;
      _preview = null;
      _error = null;
    });
    try {
      final value = await context
          .read<ProductService>()
          .collectionMetadata
          .preview(widget.view.storeId, row.id, row.version);
      if (_current) {
        setState(() => _preview = value);
        WidgetsBinding.instance.addPostFrameCallback((_) {
          final resultContext = _previewKey.currentContext;
          if (_current && resultContext != null) {
            unawaited(
              Scrollable.ensureVisible(
                resultContext,
                alignment: .15,
                duration: MediaQuery.disableAnimationsOf(context)
                    ? Duration.zero
                    : const Duration(milliseconds: 200),
              ),
            );
          }
        });
      }
    } catch (e) {
      if (_current)
        setState(
          () => _error = e is ApiException
              ? e.message
              : e is FormatException
              ? e.message
              : 'The saved rule preview is unavailable.',
        );
    } finally {
      if (_current) setState(() => _loadingPreview = false);
    }
  }

  @override
  Widget build(BuildContext context) => LetbuyyEditorScaffold(
    title: widget.manual != null || widget.smart != null
        ? 'Edit collection'
        : 'New collection',
    hasChanges: !_allowPop && _encoded() != _initial,
    currentHasChanges: () => !_allowPop && _encoded() != _initial,
    isBusy: _loadingPreview,
    currentIsBusy: () => _loadingPreview,
    progressLabel: _loadingPreview ? 'Checking saved rules…' : null,
    discardTitle: 'Discard unsaved collection edits?',
    discardMessage:
        'Your unsaved collection draft will be discarded. No new request is submitted by closing this editor.',
    discardLabel: 'Discard edits',
    keepEditingLabel: 'Keep editing',
    confirmationGuard: (_, confirmation) =>
        guardMerchantStoreView(widget.view, confirmation),
    actions: OverflowBar(
      spacing: 12,
      overflowSpacing: 12,
      children: [
        TextButton(
          onPressed: _loadingPreview ? null : _close,
          child: const Text('Close editor'),
        ),
        FilledButton(
          onPressed: _loadingPreview ? null : _save,
          child: const Text('Save collection'),
        ),
      ],
    ),
    body: ListView(
      padding: const EdgeInsets.all(LetbuyySpacingTokens.space16),
      children: [
        if (_error != null)
          Semantics(
            liveRegion: true,
            child: Text(
              _error!,
              style: TextStyle(color: Theme.of(context).colorScheme.error),
            ),
          ),
        CustomTextField(
          controller: _title,
          label: 'Collection name',
          maxLength: _smart ? 200 : 160,
          enabled: !_loadingPreview,
        ),
        const SizedBox(height: 16),
        CustomTextField(
          controller: _slug,
          label: _smart ? 'Slug' : 'Slug (optional)',
          maxLength: 100,
          enabled: !_loadingPreview,
        ),
        const SizedBox(height: 16),
        CustomTextField(
          controller: _description,
          label: 'Description',
          maxLength: _smart ? 2000 : 1000,
          enabled: !_loadingPreview,
          minLines: 2,
          maxLines: 4,
        ),
        const SizedBox(height: 16),
        if (!_smart) ...[
          CustomTextField(
            controller: _image,
            label: 'Image URL',
            enabled: !_loadingPreview,
            keyboardType: TextInputType.url,
          ),
          const SizedBox(height: 16),
        ],
        SwitchListTile(
          contentPadding: EdgeInsets.zero,
          title: const Text('Published on storefront'),
          value: _published,
          onChanged: _loadingPreview
              ? null
              : (v) => setState(() => _published = v),
        ),
        if (_smart) ...[
          LetbuyyChoiceField<String>(
            label: 'Match type',
            value: _match,
            choices: const [
              LetbuyyChoice(value: 'all', label: 'All conditions'),
              LetbuyyChoice(value: 'any', label: 'Any condition'),
            ],
            onChanged: _loadingPreview
                ? null
                : (v) => setState(() => _match = v),
          ),
          if (_rules.isEmpty)
            const Text('No conditions: all active products are included.'),
          for (var i = 0; i < _rules.length; i++)
            Card(
              key: ObjectKey(_rules[i]),
              // Each rule has independent choices and native text input. A
              // merged card makes the entire card an editable native target.
              semanticContainer: false,
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(
                      'Condition ${i + 1}',
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                    LetbuyyChoiceField<String>(
                      key: const ValueKey('field'),
                      label: 'Rule ${i + 1} field',
                      value: _rules[i]['field'],
                      choices: [
                        for (final value in collectionRuleFields)
                          LetbuyyChoice(
                            value: value,
                            label: _fieldLabels[value]!,
                          ),
                      ],
                      onChanged: _loadingPreview
                          ? null
                          : (v) => setState(() => _rules[i]['field'] = v),
                    ),
                    LetbuyyChoiceField<String>(
                      key: const ValueKey('operator'),
                      label: 'Rule ${i + 1} operator',
                      value: _rules[i]['op'],
                      choices: [
                        for (final value in collectionRuleOperators)
                          LetbuyyChoice(value: value, label: _opLabels[value]!),
                      ],
                      onChanged: _loadingPreview
                          ? null
                          : (v) => setState(() => _rules[i]['op'] = v),
                    ),
                    CustomTextField(
                      key: const ValueKey('value'),
                      initialValue: _rules[i]['value'],
                      label: 'Rule ${i + 1} value',
                      maxLength: 2000,
                      enabled: !_loadingPreview,
                      onChanged: (v) => setState(() => _rules[i]['value'] = v),
                    ),
                    Align(
                      alignment: AlignmentDirectional.centerStart,
                      child: TextButton.icon(
                        onPressed: _loadingPreview
                            ? null
                            : () => setState(() => _rules.removeAt(i)),
                        icon: const Icon(Icons.delete_outline),
                        label: Text('Remove rule ${i + 1}'),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          Align(
            alignment: AlignmentDirectional.centerStart,
            child: TextButton.icon(
              onPressed: _loadingPreview || _rules.length >= 50
                  ? null
                  : () => setState(
                      () => _rules.add({
                        'field': 'title',
                        'op': 'contains',
                        'value': '',
                      }),
                    ),
              icon: const Icon(Icons.add),
              label: const Text('Add condition'),
            ),
          ),
          if (widget.smart != null)
            TextButton(
              onPressed: _loadingPreview ? null : _loadPreview,
              child: const Text('Preview saved rules'),
            ),
          if (_preview != null)
            Semantics(
              liveRegion: true,
              child: Text(
                key: _previewKey,
                '${_preview!.isExact ? '${_preview!.count} matching products' : 'At least ${_preview!.count} matches in the evaluated sample; total matches are unknown'}. Evaluated ${_preview!.evaluated} of ${_preview!.catalogCount} active products. Preview uses saved rules.',
              ),
            ),
        ],
      ],
    ),
  );
}

const _fieldLabels = {
  'title': 'Title',
  'product_type': 'Product type',
  'vendor': 'Vendor',
  'tag': 'Tag',
  'price': 'Price (₹)',
  'inventory_quantity': 'Inventory quantity',
};
const _opLabels = {
  'equals': 'equals',
  'not_equals': 'does not equal',
  'contains': 'contains',
  'starts_with': 'starts with',
  'ends_with': 'ends with',
  'gt': 'is greater than',
  'lt': 'is less than',
};
