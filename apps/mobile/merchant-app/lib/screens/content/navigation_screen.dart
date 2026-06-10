import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../app/store_context.dart';

import '../../models/store_model.dart';
import '../../services/cms_service.dart';
import '../../theme/app_theme_colors.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';

class NavigationScreen extends StatefulWidget {
  const NavigationScreen({super.key});

  @override
  State<NavigationScreen> createState() => _NavigationScreenState();
}

class _NavigationScreenState extends State<NavigationScreen> {
  static const _locations = ['main', 'footer', 'mobile'];
  static const _targetTypes = ['url', 'page', 'collection', 'product', 'blog'];

  StoreModel? _store;
  String _location = 'main';
  String _menuName = 'Header menu';
  List<_NavigationItemDraft> _items = const [];
  bool _isLoading = true;
  bool _isBusy = false;
  String? _error;
  int _draftCounter = 0;

  @override
  void initState() {
    super.initState();
    _loadNavigation();
  }

  Future<void> _loadNavigation() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final store = await context.read<StoreContext>().ensureSelectedStore();
      if (store == null) {
        if (!mounted) return;
        setState(() {
          _store = null;
          _items = const [];
        });
        return;
      }

      final payload = await context.read<CmsService>().fetchNavigation(
        store.id,
        location: _location,
      );
      if (!mounted) return;
      setState(() {
        _store = store;
        _menuName = payload.menu?.name ?? _defaultMenuName(_location);
        _items = payload.items.map(_draftFromContract).toList(growable: false);
      });
    } catch (error) {
      if (!mounted) return;
      setState(() => _error = 'Unable to load navigation: $error');
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _changeLocation(String location) async {
    if (_location == location || _isBusy) return;
    setState(() {
      _location = location;
      _menuName = _defaultMenuName(location);
      _items = const [];
    });
    await _loadNavigation();
  }

  Future<void> _saveNavigation() async {
    final store = _store;
    if (store == null || _isBusy) return;
    setState(() => _isBusy = true);
    try {
      final payload = await context.read<CmsService>().replaceNavigation(
        storeId: store.id,
        location: _location,
        name: _menuName,
        items: _items.map((draft) => draft.input).toList(growable: false),
      );
      if (!mounted) return;
      setState(() {
        _menuName = payload.menu?.name ?? _defaultMenuName(_location);
        _items = payload.items.map(_draftFromContract).toList(growable: false);
      });
      _showMessage('Navigation saved', isSuccess: true);
    } catch (error) {
      if (mounted) _showMessage('$error', isError: true);
    } finally {
      if (mounted) setState(() => _isBusy = false);
    }
  }

  Future<void> _openItemEditor({
    _NavigationItemDraft? draft,
    int? index,
  }) async {
    final result = await _showItemEditor(draft);
    if (result == null || !mounted) return;

    setState(() {
      final next = List<_NavigationItemDraft>.from(_items);
      if (index == null) {
        next.add(_draftFromInput(result));
      } else {
        next[index] = _NavigationItemDraft(
          keyId: draft?.keyId ?? _nextDraftId(),
          input: result,
        );
      }
      _items = next;
    });
  }

  Future<NavigationItemInput?> _showItemEditor(
    _NavigationItemDraft? draft,
  ) async {
    final colors = AppThemeColors.of(context);
    final input = draft?.input;
    final labelController = TextEditingController(text: input?.label ?? '');
    final urlController = TextEditingController(text: input?.url ?? '');
    final resourceController = TextEditingController(
      text: input?.targetResourceId ?? '',
    );
    var targetType = input?.targetType ?? 'url';
    var isVisible = input?.isVisible ?? true;
    var openInNewTab = input?.openInNewTab ?? false;
    String? dialogError;

    final result = await showDialog<NavigationItemInput>(
      context: context,
      builder: (dialogContext) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          backgroundColor: colors.card,
          title: Text(
            draft == null ? 'Add menu item' : 'Edit menu item',
            style: TextStyle(color: colors.textPrimary),
          ),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(
                  controller: labelController,
                  decoration: const InputDecoration(labelText: 'Label'),
                  textInputAction: TextInputAction.next,
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: urlController,
                  decoration: const InputDecoration(
                    labelText: 'URL',
                    hintText: '/collections/new-arrivals',
                  ),
                  keyboardType: TextInputType.url,
                  textInputAction: TextInputAction.next,
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  value: _targetTypes.contains(targetType) ? targetType : 'url',
                  decoration: const InputDecoration(labelText: 'Target type'),
                  items: _targetTypes
                      .map(
                        (type) => DropdownMenuItem(
                          value: type,
                          child: Text(_sentenceCase(type)),
                        ),
                      )
                      .toList(growable: false),
                  onChanged: (value) {
                    setDialogState(() => targetType = value ?? 'url');
                  },
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: resourceController,
                  decoration: const InputDecoration(
                    labelText: 'Resource ID',
                    hintText: 'Optional page/product/collection id',
                  ),
                  textInputAction: TextInputAction.done,
                ),
                const SizedBox(height: 8),
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  value: isVisible,
                  title: Text(
                    'Visible',
                    style: TextStyle(color: colors.textPrimary),
                  ),
                  onChanged: (value) {
                    setDialogState(() => isVisible = value);
                  },
                ),
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  value: openInNewTab,
                  title: Text(
                    'Open in new tab',
                    style: TextStyle(color: colors.textPrimary),
                  ),
                  onChanged: (value) {
                    setDialogState(() => openInNewTab = value);
                  },
                ),
                if (dialogError != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 8),
                    child: Text(
                      dialogError!,
                      style: TextStyle(color: colors.error, fontSize: 12),
                    ),
                  ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialogContext),
              child: const Text('Cancel'),
            ),
            FilledButton(
              onPressed: () {
                final label = labelController.text.trim();
                if (label.isEmpty) {
                  setDialogState(() => dialogError = 'Label is required');
                  return;
                }
                Navigator.pop(
                  dialogContext,
                  NavigationItemInput(
                    label: label,
                    url: urlController.text.trim().isEmpty
                        ? '#'
                        : urlController.text.trim(),
                    targetType: targetType,
                    targetResourceId: resourceController.text,
                    isVisible: isVisible,
                    openInNewTab: openInNewTab,
                  ),
                );
              },
              child: Text(draft == null ? 'Add' : 'Save'),
            ),
          ],
        ),
      ),
    );

    labelController.dispose();
    urlController.dispose();
    resourceController.dispose();
    return result;
  }

  void _removeItem(int index) {
    setState(() {
      final next = List<_NavigationItemDraft>.from(_items)..removeAt(index);
      _items = next;
    });
  }

  void _onReorder(int oldIndex, int newIndex) {
    setState(() {
      final next = List<_NavigationItemDraft>.from(_items);
      final destination = newIndex > oldIndex ? newIndex - 1 : newIndex;
      final item = next.removeAt(oldIndex);
      next.insert(destination, item);
      _items = next;
    });
  }

  _NavigationItemDraft _draftFromContract(NavigationItemContract item) {
    return _NavigationItemDraft(
      keyId: item.id.isEmpty ? _nextDraftId() : item.id,
      input: NavigationItemInput.fromContract(item),
    );
  }

  _NavigationItemDraft _draftFromInput(NavigationItemInput input) {
    return _NavigationItemDraft(keyId: _nextDraftId(), input: input);
  }

  String _nextDraftId() {
    _draftCounter += 1;
    return 'draft_${DateTime.now().microsecondsSinceEpoch}_$_draftCounter';
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    return Scaffold(
      backgroundColor: colors.bgStart,
      floatingActionButton: _store == null
          ? null
          : FloatingActionButton.extended(
              onPressed: _isBusy ? null : () => _openItemEditor(),
              backgroundColor: LetbuyyColorTokens.brandPrimary,
              foregroundColor: LetbuyyColorTokens.white,
              icon: const Icon(Icons.add_rounded),
              label: const Text('Add item'),
            ),
      body: Container(
        decoration: colors.backgroundGradient,
        child: SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                _buildHeader(colors),
                const SizedBox(height: 14),
                _buildLocationChips(colors),
                const SizedBox(height: 12),
                _buildMenuNameField(colors),
                const SizedBox(height: 12),
                Expanded(child: _buildBody(colors)),
                const SizedBox(height: 12),
                _buildSaveBar(colors),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildHeader(AppThemeColors colors) {
    return Row(
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Navigation',
                style: TextStyle(
                  color: colors.textPrimary,
                  fontSize: 22,
                  fontWeight: FontWeight.w700,
                ),
              ),
              Text(
                _store?.name ?? 'Select a store',
                style: TextStyle(color: colors.textSecondary, fontSize: 12),
              ),
            ],
          ),
        ),
        IconButton(
          onPressed: _isLoading || _isBusy ? null : _loadNavigation,
          icon: Icon(Icons.refresh_rounded, color: colors.textPrimary),
          tooltip: 'Refresh navigation',
        ),
      ],
    );
  }

  Widget _buildLocationChips(AppThemeColors colors) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: [
          for (final location in _locations) ...[
            ChoiceChip(
              label: Text(_locationLabel(location)),
              selected: _location == location,
              onSelected: (_) => _changeLocation(location),
              selectedColor: LetbuyyColorTokens.brandPrimary.withValues(
                alpha: 0.18,
              ),
              labelStyle: TextStyle(
                color: _location == location
                    ? LetbuyyColorTokens.brandPrimary
                    : colors.textSecondary,
                fontWeight: FontWeight.w700,
              ),
              side: BorderSide(
                color: _location == location
                    ? LetbuyyColorTokens.brandPrimary
                    : colors.border,
              ),
            ),
            const SizedBox(width: 8),
          ],
        ],
      ),
    );
  }

  Widget _buildMenuNameField(AppThemeColors colors) {
    return TextFormField(
      key: ValueKey('navigation-menu-name-$_location'),
      initialValue: _menuName,
      enabled: !_isBusy && _store != null,
      decoration: InputDecoration(
        labelText: 'Menu name',
        prefixIcon: Icon(Icons.account_tree_outlined, color: colors.accent),
      ),
      onChanged: (value) => _menuName = value,
    );
  }

  Widget _buildBody(AppThemeColors colors) {
    if (_isLoading) {
      return Center(
        child: CircularProgressIndicator(
          color: LetbuyyColorTokens.brandPrimary,
        ),
      );
    }
    if (_error != null) return _buildMessage(colors, _error!, Icons.error);
    if (_store == null) {
      return _buildMessage(
        colors,
        'Create or select a store before editing menus.',
        Icons.storefront_outlined,
      );
    }
    if (_items.isEmpty) {
      return _buildMessage(
        colors,
        'Add the first menu item for this location.',
        Icons.add_link_rounded,
      );
    }

    return ReorderableListView.builder(
      onReorder: _onReorder,
      proxyDecorator: (child, _, animation) {
        return FadeTransition(
          opacity: animation.drive(Tween(begin: 0.92, end: 1)),
          child: child,
        );
      },
      itemCount: _items.length,
      itemBuilder: (context, index) {
        final draft = _items[index];
        return _buildItemCard(draft, index, colors);
      },
    );
  }

  Widget _buildItemCard(
    _NavigationItemDraft draft,
    int index,
    AppThemeColors colors,
  ) {
    final item = draft.input;
    return Container(
      key: ValueKey(draft.keyId),
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: colors.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: colors.cardBorder),
      ),
      child: ListTile(
        contentPadding: const EdgeInsets.fromLTRB(8, 8, 8, 8),
        leading: ReorderableDragStartListener(
          index: index,
          child: Semantics(
            label: 'Drag ${item.label}',
            button: true,
            child: Icon(
              Icons.drag_indicator_rounded,
              color: colors.textTertiary,
            ),
          ),
        ),
        title: Text(
          item.label,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(
            color: colors.textPrimary,
            fontWeight: FontWeight.w700,
          ),
        ),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SizedBox(height: 4),
            Text(
              item.url,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(color: colors.textSecondary, fontSize: 12),
            ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: [
                _statusPill(colors, _sentenceCase(item.targetType)),
                _statusPill(colors, item.isVisible ? 'Visible' : 'Hidden'),
                if (item.openInNewTab) _statusPill(colors, 'New tab'),
              ],
            ),
          ],
        ),
        trailing: Wrap(
          spacing: 2,
          children: [
            IconButton(
              tooltip: 'Edit item',
              icon: Icon(Icons.edit_rounded, color: colors.textSecondary),
              onPressed: _isBusy
                  ? null
                  : () => _openItemEditor(draft: draft, index: index),
            ),
            IconButton(
              tooltip: 'Remove item',
              icon: Icon(Icons.delete_outline_rounded, color: colors.error),
              onPressed: _isBusy ? null : () => _removeItem(index),
            ),
          ],
        ),
      ),
    );
  }

  Widget _statusPill(AppThemeColors colors, String label) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: colors.surfaceVariant,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: colors.borderSubtle),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: colors.textSecondary,
          fontSize: 11,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }

  Widget _buildSaveBar(AppThemeColors colors) {
    return Row(
      children: [
        Expanded(
          child: Text(
            '${_items.length} items',
            style: TextStyle(color: colors.textSecondary, fontSize: 12),
          ),
        ),
        FilledButton.icon(
          onPressed: _store == null || _isLoading || _isBusy
              ? null
              : _saveNavigation,
          icon: _isBusy
              ? const SizedBox(
                  width: 16,
                  height: 16,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : const Icon(Icons.save_rounded),
          label: const Text('Save menu'),
        ),
      ],
    );
  }

  Widget _buildMessage(AppThemeColors colors, String text, IconData icon) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, color: colors.textTertiary, size: 40),
          const SizedBox(height: 12),
          Text(
            text,
            textAlign: TextAlign.center,
            style: TextStyle(color: colors.textSecondary),
          ),
        ],
      ),
    );
  }

  void _showMessage(
    String message, {
    bool isError = false,
    bool isSuccess = false,
  }) {
    final colors = AppThemeColors.of(context);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: isError
            ? colors.error
            : isSuccess
            ? colors.success
            : colors.snackbarBackground,
      ),
    );
  }

  static String _defaultMenuName(String location) {
    return '${_locationLabel(location)} menu';
  }

  static String _locationLabel(String location) {
    switch (location) {
      case 'main':
        return 'Header';
      case 'footer':
        return 'Footer';
      case 'mobile':
        return 'Mobile';
    }
    return _sentenceCase(location);
  }

  static String _sentenceCase(String value) {
    final normalized = value.replaceAll('-', ' ').replaceAll('_', ' ').trim();
    if (normalized.isEmpty) return value;
    return '${normalized[0].toUpperCase()}${normalized.substring(1)}';
  }
}

class _NavigationItemDraft {
  const _NavigationItemDraft({required this.keyId, required this.input});

  final String keyId;
  final NavigationItemInput input;
}
