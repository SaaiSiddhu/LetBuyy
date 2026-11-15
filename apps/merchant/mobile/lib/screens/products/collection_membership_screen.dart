import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import 'package:provider/provider.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:letbuyy_models/letbuyy_models.dart';
import '../../app/store_context.dart';
import '../../services/api_client.dart' hide JsonMap;
import '../../services/product_service.dart';
import '../../services/security_command_store.dart';
import '../../widgets/shared/merchant_store_view.dart';
import '../../widgets/shared/merchant_option_picker.dart';

class CollectionMembershipScreen extends StatefulWidget {
  const CollectionMembershipScreen({
    super.key,
    required this.storeId,
    required this.collectionId,
  });
  final String storeId, collectionId;
  @override
  State<CollectionMembershipScreen> createState() =>
      _CollectionMembershipScreenState();
}

class _CollectionMembershipScreenState
    extends State<CollectionMembershipScreen> {
  late final MerchantStoreView _view;
  CollectionMembershipSnapshot? _snapshot, _reviewed;
  PendingSecurityCommand? _pending;
  final _names = <String, String>{};
  List<String> _ids = [];
  bool _busy = true, _denied = false;
  String? _error;
  int _generation = 0;
  bool get _current => mounted && merchantStoreViewCurrent(context, _view);
  bool get _editable =>
      _current && !_busy && !_denied && _snapshot != null && _pending == null;
  bool get _dirty =>
      _pending == null &&
      _snapshot != null &&
      !listEquals(_ids, _snapshot!.productIds);
  ProductService get _service => context.read<ProductService>();
  @override
  void initState() {
    super.initState();
    _view = (
      key: context.read<StoreContext>().requestContextKey,
      storeId: widget.storeId,
    );
    _load();
  }

  void _clear() {
    _snapshot = null;
    _reviewed = null;
    _pending = null;
    _ids = [];
    _names.clear();
  }

  Future<void> _load() async {
    if (!_current) return;
    final generation = ++_generation;
    setState(() {
      _busy = true;
      _error = null;
      _clear();
    });
    try {
      final snapshot = await _service.readCollectionMembership(
        widget.storeId,
        widget.collectionId,
      );
      if (!_current || generation != _generation) return;
      final pending = await _service.pendingCollectionMembership(
        widget.storeId,
        widget.collectionId,
      );
      if (!_current || generation != _generation) return;
      if (pending != null &&
          (pending.intent['collection_id'] != widget.collectionId ||
              !const [
                'pending',
                'conflict',
                'rejected',
              ].contains(pending.intent['outcome']))) {
        throw const FormatException(
          'The saved collection request needs review.',
        );
      }
      final ids = pending == null
          ? snapshot.productIds
          : collectionProductIds(pending.intent['product_ids']);
      setState(() {
        _snapshot = snapshot;
        _pending = pending;
        _ids = List.of(ids);
        _denied = false;
        _names.addAll({for (final p in snapshot.products) p.id: p.name});
      });
    } catch (error) {
      if (_current && generation == _generation)
        setState(() {
          _clear();
          _denied =
              error is ApiException &&
              const [401, 403, 404].contains(error.statusCode);
          _error = _denied
              ? 'Collection access changed. Only the current store owner can manage its products.'
              : 'Collection products could not load. Check your connection and retry.';
        });
    } finally {
      if (_current && generation == _generation) setState(() => _busy = false);
    }
  }

  Future<void> _run(Future<void> Function() action, {bool saved = true}) async {
    if (!_current || _busy || _denied) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await action();
      if (!_current) return;
      await _load();
      if (_current && _snapshot != null && _error == null)
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              saved
                  ? 'Saved request confirmed. Current collection reloaded.'
                  : 'Rejected request dismissed. Current collection reloaded.',
            ),
          ),
        );
    } catch (error) {
      if (!_current) return;
      final denied =
          error is ApiException &&
          const [401, 403, 404].contains(error.statusCode);
      if (denied) {
        setState(() {
          _clear();
          _denied = true;
          _error =
              'Collection access changed. Reopen it with the store owner account.';
        });
      } else {
        try {
          final pending = await _service.pendingCollectionMembership(
            widget.storeId,
            widget.collectionId,
          );
          if (!_current) return;
          setState(() {
            _pending = pending;
            _error = pending?.intent['outcome'] == 'rejected'
                ? 'The server rejected this selection. Edit it and remove unavailable products before saving again.'
                : pending?.intent['outcome'] == 'conflict'
                ? 'The collection changed. Review the current membership before applying your saved selection.'
                : 'This save was not confirmed. Retry the saved request to recover its result.';
          });
        } catch (_) {
          if (_current)
            setState(
              () => _error =
                  'Saved-request recovery is unavailable. Your selection is kept.',
            );
        }
      }
    } finally {
      if (_current) setState(() => _busy = false);
    }
  }

  Future<void> _add() async {
    if (!_editable || _ids.length >= 500) return;
    final choice = await chooseMerchantOption<ProductContract>(
      context,
      _view,
      'Products',
      (page, search) => _service.readWarehouseProducts(
        widget.storeId,
        page: page,
        search: search,
      ),
      (p) => p.name,
    );
    if (!_current ||
        !_editable ||
        choice == null ||
        choice.storeId != widget.storeId)
      return;
    if (_ids.contains(choice.id)) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('This product is already assigned.')),
      );
      return;
    }
    setState(() {
      _ids.add(choice.id);
      _names[choice.id] = choice.name;
    });
  }

  Future<bool> _confirm(String title, String message, String action) async =>
      await showLetbuyyConfirmation(
        context: context,
        title: title,
        message: message,
        confirmLabel: action,
        guard: (_, confirmation) => guardMerchantStoreView(_view, confirmation),
      ) &&
      _current;

  Future<void> _save() async {
    if (!_editable) return;
    final original = _snapshot!, ids = List<String>.of(_ids);
    if (ids.any(original.unavailableIds.contains)) {
      setState(
        () => _error =
            'Remove the explicitly unavailable assignments before saving this collection.',
      );
      return;
    }
    if (ids.isEmpty &&
        !await _confirm(
          'Remove every assigned product?',
          'This deliberately saves an empty collection. Products stay in your catalog.',
          'Save empty collection',
        ))
      return;
    if (!_current) return;
    await _run(() async {
      await _service.replaceCollectionMembership(widget.storeId, original, ids);
    });
  }

  Future<void> _editRejected() async {
    if (_busy || !_current || _pending?.intent['outcome'] != 'rejected') return;
    final desired = List<String>.of(_ids);
    setState(() => _busy = true);
    try {
      final latest = await _service.readCollectionMembership(
        widget.storeId,
        widget.collectionId,
      );
      if (!_current) return;
      await _service.discardRejectedCollectionMembership(
        widget.storeId,
        widget.collectionId,
      );
      if (!_current) return;
      setState(() {
        _snapshot = latest;
        _pending = null;
        _reviewed = null;
        _ids = desired;
        _names.addAll({for (final p in latest.products) p.id: p.name});
        _error =
            'Your rejected selection is kept for editing. Review it before saving a new request.';
      });
    } catch (error) {
      if (_current)
        setState(() {
          if (error is ApiException &&
              const [401, 403, 404].contains(error.statusCode)) {
            _clear();
            _denied = true;
          }
          _error =
              'The collection could not be reopened. Its saved request is protected.';
        });
    } finally {
      if (_current) setState(() => _busy = false);
    }
  }

  Future<void> _reloadReviewed() async {
    if (!_dirty ||
        await _confirm(
          'Discard unsaved changes?',
          'Reload the current membership and discard this unsaved selection?',
          'Reload membership',
        ))
      await _load();
  }

  Future<void> _readLatest() async {
    if (_busy || !_current) return;
    setState(() => _busy = true);
    try {
      final current = await _service.readCollectionMembership(
        widget.storeId,
        widget.collectionId,
      );
      if (_current)
        setState(() {
          _reviewed = current;
          _names.addAll({for (final p in current.products) p.id: p.name});
        });
    } catch (error) {
      if (_current)
        setState(() {
          if (error is ApiException &&
              const [401, 403, 404].contains(error.statusCode)) {
            _clear();
            _denied = true;
          }
          _error =
              'Current membership could not be read. Your saved request remains protected.';
        });
    } finally {
      if (_current) setState(() => _busy = false);
    }
  }

  void _move(int index, int destination) {
    if (!_editable || destination < 0 || destination >= _ids.length) return;
    setState(() {
      final id = _ids.removeAt(index);
      _ids.insert(destination, id);
    });
  }

  String _name(String id) => _names[id] ?? 'Product ${id.substring(0, 8)}';
  Future<void> _openReviewedAssignments() async {
    final reviewed = _reviewed;
    if (!_current || reviewed == null) return;
    final ids = List<String>.of(reviewed.productIds),
        names = {for (final id in reviewed.productIds) id: _name(id)};
    await Navigator.push<void>(
      context,
      MaterialPageRoute(
        builder: (_) => guardMerchantStoreView(
          _view,
          Scaffold(
            appBar: CustomAppBar.responsive(
              context: context,
              title: 'Current ordered membership',
            ),
            body: SafeArea(
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  Text(
                    'Current revision ${reviewed.version} · ${ids.length} assigned products',
                  ),
                  for (final entry in ids.indexed)
                    ListTile(
                      title: Text('${entry.$1 + 1}. ${names[entry.$2]}'),
                    ),
                ],
              ),
            ),
          ),
          fullPage: true,
        ),
      ),
    );
  }

  Widget _recoveryHeader(bool conflict, bool rejected) => Padding(
    padding: const EdgeInsets.all(LetbuyySpacingTokens.space16),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (_snapshot != null)
          Text(
            _pending != null
                ? '${_ids.length} products in saved selection · current revision ${_snapshot!.version}'
                : _dirty
                ? 'Draft: ${_ids.length} products · based on revision ${_snapshot!.version}'
                : '${_ids.length} assigned products · revision ${_snapshot!.version}',
          ),
        const Text(
          'Choose products and arrange their order. Unavailable assignments stay explicit until you remove them.',
        ),
        if (_error != null)
          Padding(padding: const EdgeInsets.only(top: 8), child: Text(_error!)),
        if (_snapshot == null && !_busy && !_denied)
          TextButton(
            onPressed: _load,
            child: const Text('Retry collection products'),
          ),
        if (rejected)
          TextButton(
            onPressed: _busy || _denied ? null : _editRejected,
            child: const Text('Edit rejected selection'),
          ),
        if (_pending != null && !conflict && !rejected)
          TextButton(
            onPressed: _busy || _denied
                ? null
                : () => _run(() async {
                    await _service.retryCollectionMembership(
                      widget.storeId,
                      widget.collectionId,
                    );
                  }),
            child: const Text('Retry saved membership save'),
          ),
        if (conflict) ...[
          TextButton(
            onPressed: _busy || _denied ? null : _readLatest,
            child: const Text('Read latest membership'),
          ),
          if (_reviewed != null) ...[
            Text(
              'Current revision ${_reviewed!.version} · ${_reviewed!.productIds.length} assigned products',
            ),
            TextButton(
              onPressed: _openReviewedAssignments,
              child: const Text('Review every current assignment'),
            ),
            TextButton(
              onPressed: _busy
                  ? null
                  : () async {
                      final pending = _pending!, reviewed = _reviewed!;
                      if (await _confirm(
                        'Apply saved selection?',
                        'Replace the reviewed revision ${reviewed.version} with your saved ordered list of ${_ids.length} products?',
                        'Apply saved selection',
                      ))
                        await _run(() async {
                          await _service.rebaseCollectionMembership(
                            widget.storeId,
                            pending,
                            reviewed,
                          );
                        });
                    },
              child: const Text('Apply saved selection to reviewed revision'),
            ),
          ],
          TextButton(
            onPressed: _busy
                ? null
                : () async {
                    if (await _confirm(
                      'Discard rejected request?',
                      'The server rejected this save because the collection changed. Load its current membership instead?',
                      'Use current membership',
                    ))
                      await _run(() async {
                        await _service.discardRejectedCollectionMembership(
                          widget.storeId,
                          widget.collectionId,
                        );
                      }, saved: false);
                  },
            child: const Text('Use current membership instead'),
          ),
        ],
      ],
    ),
  );

  @override
  Widget build(BuildContext context) {
    final scope = context.watch<StoreContext>();
    if (scope.requestContextKey != _view.key ||
        scope.selectedStoreId != widget.storeId) {
      _generation++;
      _clear();
      return Scaffold(
        appBar: CustomAppBar.responsive(
          context: context,
          title: 'Collection products',
        ),
        body: const SafeArea(
          child: Padding(
            padding: EdgeInsets.all(24),
            child: Text(
              'Store access changed. Reopen this collection from the selected store.',
            ),
          ),
        ),
      );
    }
    final conflict = _pending?.intent['outcome'] == 'conflict',
        rejected = _pending?.intent['outcome'] == 'rejected';
    return LetbuyyEditorScaffold(
      title: 'Collection products',
      hasChanges: _dirty,
      currentHasChanges: () => _dirty,
      isBusy: _busy,
      currentIsBusy: () => _busy,
      progressLabel: !_busy
          ? null
          : _snapshot == null
          ? 'Loading collection products…'
          : 'Updating collection products…',
      discardTitle: 'Discard unsaved changes?',
      discardMessage:
          'Leave this collection and discard its unsaved selection? The original saved request remains protected.',
      discardLabel: 'Discard and leave',
      confirmationGuard: (_, confirmation) =>
          guardMerchantStoreView(_view, confirmation),
      headerActions: [
        IconButton(
          tooltip: 'Reload collection membership',
          onPressed: _busy ? null : _reloadReviewed,
          icon: const Icon(Icons.refresh),
        ),
      ],
      actions: OverflowBar(
        spacing: 12,
        overflowSpacing: 12,
        children: [
          OutlinedButton.icon(
            onPressed: _editable && _ids.length < 500 ? _add : null,
            icon: const Icon(Icons.add),
            label: const Text('Add product'),
          ),
          FilledButton(
            onPressed: _editable ? _save : null,
            child: const Text('Save membership'),
          ),
        ],
      ),
      body: ReorderableListView.builder(
        buildDefaultDragHandles: false,
        header: _recoveryHeader(conflict, rejected),
        itemCount: _ids.length,
        onReorder: (oldIndex, newIndex) {
          if (!_editable) return;
          if (newIndex > oldIndex) newIndex--;
          _move(oldIndex, newIndex);
        },
        itemBuilder: (context, index) {
          final id = _ids[index],
              name = _name(id),
              unavailable = _snapshot?.unavailableIds.contains(id) == true;
          return Card(
            key: ValueKey(id),
            margin: const EdgeInsets.fromLTRB(16, 0, 16, 12),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      ReorderableDragStartListener(
                        index: index,
                        enabled: _editable,
                        child: SizedBox(
                          width: 48,
                          height: 48,
                          child: Tooltip(
                            message: 'Reorder $name',
                            child: const Icon(Icons.drag_handle),
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          '${index + 1}. $name',
                          style: Theme.of(context).textTheme.titleMedium,
                        ),
                      ),
                    ],
                  ),
                  if (unavailable)
                    const Text('Unavailable product · assignment retained'),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      IconButton(
                        tooltip: 'Move $name up',
                        onPressed: _editable && index > 0
                            ? () => _move(index, index - 1)
                            : null,
                        icon: const Icon(Icons.arrow_upward),
                      ),
                      IconButton(
                        tooltip: 'Move $name down',
                        onPressed: _editable && index + 1 < _ids.length
                            ? () => _move(index, index + 1)
                            : null,
                        icon: const Icon(Icons.arrow_downward),
                      ),
                      IconButton(
                        tooltip: 'Remove $name from collection',
                        onPressed: _editable
                            ? () => setState(() => _ids.remove(id))
                            : null,
                        icon: const Icon(Icons.remove_circle_outline),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}
