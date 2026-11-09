import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';

import '../../app/store_context.dart';
import '../../l10n/app_localizations.dart';
import '../../models/store_model.dart';
import '../shared/accessible_tap_region.dart';

/// Presentation only: StoreContext retains membership, selection and persistence.
class StoreSwitcherButton extends StatefulWidget {
  const StoreSwitcherButton({super.key, this.onChanged});
  final VoidCallback? onChanged;

  @override
  State<StoreSwitcherButton> createState() => _StoreSwitcherButtonState();
}

class _StoreSwitcherButtonState extends State<StoreSwitcherButton> {
  Object? _operation, _expectedFrame;
  StoreContext? _owner;
  bool _sheetOpen = false;
  final _focus = FocusNode();

  @override
  void dispose() {
    _focus.dispose();
    super.dispose();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final owner = context.watch<StoreContext>();
    if (_operation != null &&
        (!identical(owner, _owner) ||
            owner.requestContextKey != _expectedFrame ||
            (!_sheetOpen && !isLetbuyySurfaceCurrent(context)))) {
      _operation = null;
    }
  }

  bool _alive(Object operation, StoreContext owner) =>
      mounted &&
      identical(_operation, operation) &&
      identical(context.read<StoreContext>(), owner) &&
      owner.requestContextKey == _expectedFrame &&
      isLetbuyySurfaceCurrent(context);

  Future<void> _showSwitcher() async {
    if (!mounted || _operation != null || !isLetbuyySurfaceCurrent(context))
      return;
    final owner = context.read<StoreContext>(), operation = Object();
    final frame = owner.requestContextKey;
    _owner = owner;
    _expectedFrame = frame;
    setState(() {
      _operation = operation;
      _sheetOpen = true;
    });
    try {
      final selected = await showLetbuyyFormSheet<StoreModel>(
        context: context,
        builder: (_) => _StoreSwitcherSheet(owner: owner, openedFrame: frame),
      );
      _sheetOpen = false;
      if (selected == null ||
          !_alive(operation, owner) ||
          !owner.stores.any((store) => identical(store, selected)))
        return;
      // The canonical owner retires the old scope synchronously before its
      // serialized preference write. Its new exact frame owns this completion.
      final pending = owner.selectStore(selected);
      _expectedFrame = owner.requestContextKey;
      await pending;
      if (!_alive(operation, owner) || owner.selectedStoreId != selected.id)
        return;
      widget.onChanged?.call();
    } catch (_) {
      if (_alive(operation, owner)) {
        showLetbuyyOperationFeedback(
          context,
          message:
              'Could not save the store selection on this device. Review the selected store and retry.',
          isError: true,
        );
      }
    } finally {
      if (mounted && identical(_operation, operation)) {
        setState(() {
          _operation = null;
          _sheetOpen = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final stores = context.watch<StoreContext>();
    final l10n = AppLocalizations.of(context), store = stores.selectedStore;
    final busy = _operation != null;
    return AccessibleTapRegion(
      label:
          '${l10n.storeSwitcherLabel}: ${store?.name ?? l10n.noStoreSelected}',
      onTap: busy ? null : _showSwitcher,
      focusNode: _focus,
      excludeChildSemantics: true,
      child: ConstrainedBox(
        constraints: const BoxConstraints(
          minHeight: LetbuyySpacingTokens.space48,
          maxWidth: 220,
        ),
        child: OutlinedButton.icon(
          focusNode: _focus,
          onPressed: busy ? null : _showSwitcher,
          style: OutlinedButton.styleFrom(
            padding: const EdgeInsets.symmetric(
              horizontal: LetbuyySpacingTokens.space12,
              vertical: LetbuyySpacingTokens.space8,
            ),
            minimumSize: const Size(
              LetbuyySpacingTokens.space48,
              LetbuyySpacingTokens.space48,
            ),
          ),
          icon: busy && !_sheetOpen
              ? const SizedBox(
                  width: LetbuyySpacingTokens.space16,
                  height: LetbuyySpacingTokens.space16,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : const Icon(Icons.storefront_outlined),
          label: Text(
            busy && !_sheetOpen
                ? 'Switching store…'
                : store?.name ?? l10n.selectStore,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ),
      ),
    );
  }
}

class _StoreSwitcherSheet extends StatefulWidget {
  const _StoreSwitcherSheet({required this.owner, required this.openedFrame});
  final StoreContext owner;
  final Object openedFrame;
  @override
  State<_StoreSwitcherSheet> createState() => _StoreSwitcherSheetState();
}

class _StoreSwitcherSheetState extends State<_StoreSwitcherSheet> {
  bool _retired = false, _reading = false, _chosen = false;
  int _readGeneration = 0;
  String? _error;

  bool get _current =>
      mounted &&
      !_retired &&
      !_chosen &&
      identical(context.read<StoreContext>(), widget.owner) &&
      widget.owner.requestContextKey == widget.openedFrame &&
      isLetbuyySurfaceCurrent(context);

  @override
  void initState() {
    super.initState();
    if (widget.owner.stores.length <= 1) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (_current) _refresh();
      });
    }
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final current = context.watch<StoreContext>();
    if (!identical(current, widget.owner) ||
        current.requestContextKey != widget.openedFrame ||
        !isLetbuyySurfaceCurrent(context)) {
      _retired = true;
      _reading = false;
      _error = null;
      ++_readGeneration;
    }
  }

  Future<void> _refresh() async {
    if (!_current || _reading || widget.owner.isLoading) return;
    final generation = ++_readGeneration;
    setState(() {
      _reading = true;
      _error = null;
    });
    try {
      await widget.owner.loadStores(force: true);
    } catch (_) {
      if (_current && generation == _readGeneration) {
        setState(
          () => _error =
              'Could not load available stores. Try refreshing the list.',
        );
      }
    } finally {
      if (mounted && generation == _readGeneration)
        setState(() => _reading = false);
    }
  }

  void _choose(StoreModel store) {
    if (!_current ||
        _reading ||
        widget.owner.isLoading ||
        !widget.owner.stores.any((row) => identical(row, store)))
      return;
    _chosen = true;
    completeLetbuyySurface(context, store);
  }

  @override
  Widget build(BuildContext context) {
    final stores = context.watch<StoreContext>();
    final retired =
        _retired ||
        !identical(stores, widget.owner) ||
        stores.requestContextKey != widget.openedFrame;
    final reading = _reading || stores.isLoading;
    return LetbuyyFormSheet(
      title: AppLocalizations.of(context).switchStore,
      description: retired
          ? null
          : 'Choose from this account’s loaded store list.',
      child: retired
          ? const Text(
              'Store access changed. Close this selector and open it again.',
            )
          : Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              mainAxisSize: MainAxisSize.min,
              children: [
                Align(
                  alignment: AlignmentDirectional.centerEnd,
                  child: TextButton(
                    onPressed: reading ? null : _refresh,
                    child: Text(
                      reading ? 'Refreshing stores…' : 'Refresh stores',
                    ),
                  ),
                ),
                if (reading)
                  Semantics(
                    label: 'Loading store list',
                    child: const LinearProgressIndicator(),
                  ),
                if (_error != null)
                  LetbuyyInlineFeedback(
                    title: 'Store list unavailable',
                    message: _error!,
                    kind: LetbuyyFeedbackKind.error,
                  ),
                if (!reading && _error == null && stores.stores.isEmpty)
                  const Text('No stores are available in the loaded list.'),
                for (final store in stores.stores)
                  Semantics(
                    selected: store.id == stores.selectedStoreId,
                    child: ListTile(
                      contentPadding: EdgeInsets.zero,
                      leading: const ExcludeSemantics(
                        child: Icon(Icons.storefront_outlined),
                      ),
                      title: Text(store.name),
                      subtitle: Text(
                        store.publicUrl.replaceFirst(RegExp(r'^https?://'), ''),
                      ),
                      trailing: store.id == stores.selectedStoreId
                          ? const ExcludeSemantics(
                              child: Icon(Icons.check_circle_outline),
                            )
                          : null,
                      onTap: reading ? null : () => _choose(store),
                    ),
                  ),
              ],
            ),
    );
  }
}
