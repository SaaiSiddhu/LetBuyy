import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../app/store_context.dart';
import '../../models/store_model.dart';
import '../../services/metafield_service.dart';
import '../../theme/app_theme_colors.dart';
import '../../theme/letbuyy_color_tokens.dart';

class CustomDataScreen extends StatefulWidget {
  const CustomDataScreen({super.key});

  @override
  State<CustomDataScreen> createState() => _CustomDataScreenState();
}

class _CustomDataScreenState extends State<CustomDataScreen> {
  StoreModel? _store;
  StoreMetafieldsSummary? _summary;
  bool _isLoading = true;
  bool _isBusy = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadCustomData();
  }

  Future<void> _loadCustomData() async {
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
          _summary = null;
        });
        return;
      }

      final summary = await context.read<MetafieldService>().fetchValues(
        store.id,
      );
      if (!mounted) return;
      setState(() {
        _store = store;
        _summary = summary;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _error = 'Custom data could not load.');
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _runAction(Future<void> Function() action) async {
    if (_isBusy) return;
    setState(() => _isBusy = true);
    try {
      await action();
    } catch (_) {
      if (mounted) _showMessage('Custom data could not be saved.');
    } finally {
      if (mounted) setState(() => _isBusy = false);
    }
  }

  Future<void> _editDefinition(StoreMetafieldDefinition? definition) async {
    final store = _store;
    if (store == null) return;
    final result = await _showDefinitionDialog(definition);
    if (result == null) return;

    await _runAction(() async {
      final service = context.read<MetafieldService>();
      if (definition == null) {
        await service.createDefinition(store.id, result);
        _showMessage('Custom field created.', isSuccess: true);
      } else {
        await service.updateDefinition(store.id, definition.id, result);
        _showMessage('Custom field updated.', isSuccess: true);
      }
      await _loadCustomData();
    });
  }

  Future<void> _deleteDefinition(StoreMetafieldDefinition definition) async {
    final store = _store;
    if (store == null) return;
    final confirmed = await _confirm(
      title: 'Delete custom field?',
      message: 'Delete "${definition.name}" and its saved values.',
      action: 'Delete',
    );
    if (confirmed != true) return;

    await _runAction(() async {
      await context.read<MetafieldService>().deleteDefinition(
        store.id,
        definition.id,
      );
      _showMessage('Custom field deleted.', isSuccess: true);
      await _loadCustomData();
    });
  }

  Future<void> _editValue(StoreMetafieldDefinition definition) async {
    final store = _store;
    if (store == null) return;
    final existing = _valueFor(definition.id);
    final value = await _showValueDialog(definition, existing);
    if (value == null) return;

    await _runAction(() async {
      await context.read<MetafieldService>().upsertValue(
        storeId: store.id,
        definitionId: definition.id,
        value: value,
      );
      _showMessage('Custom value saved.', isSuccess: true);
      await _loadCustomData();
    });
  }

  StoreMetafieldValue? _valueFor(String definitionId) {
    final values = _summary?.values ?? const <StoreMetafieldValue>[];
    for (final value in values) {
      if (value.definitionId == definitionId) return value;
    }
    return null;
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);

    return Scaffold(
      backgroundColor: colors.card,
      appBar: AppBar(
        title: const Text('Custom Data'),
        backgroundColor: colors.card,
        foregroundColor: colors.textPrimary,
        elevation: 0,
        actions: [
          IconButton(
            tooltip: 'Refresh',
            onPressed: _isBusy ? null : _loadCustomData,
            icon: const Icon(Icons.refresh_rounded),
          ),
        ],
      ),
      body: _buildBody(colors),
      floatingActionButton: _summary == null
          ? null
          : FloatingActionButton.extended(
              onPressed: _isBusy ? null : () => _editDefinition(null),
              icon: const Icon(Icons.add_rounded),
              label: const Text('Field'),
            ),
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

    if (_error != null) {
      return _EmptyState(
        icon: Icons.data_object_outlined,
        title: 'Custom data unavailable',
        message: _error!,
        actionLabel: 'Retry',
        onAction: _loadCustomData,
      );
    }

    final summary = _summary;
    if (summary == null) {
      return const _EmptyState(
        icon: Icons.storefront_outlined,
        title: 'Select a store',
        message: 'Choose a store before managing custom data.',
      );
    }

    if (!summary.schemaReady) {
      return const _EmptyState(
        icon: Icons.storage_outlined,
        title: 'Custom data unavailable',
        message: 'Custom data is not ready for this store yet.',
      );
    }

    if (summary.definitions.isEmpty) {
      return _EmptyState(
        icon: Icons.data_object_outlined,
        title: 'No custom fields',
        message:
            'Create store-level fields for storefront, catalog, and workflow data.',
        actionLabel: 'Create field',
        onAction: _isBusy ? null : () => _editDefinition(null),
      );
    }

    return RefreshIndicator(
      onRefresh: _loadCustomData,
      child: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Text(
            'Store fields',
            style: Theme.of(context).textTheme.titleLarge?.copyWith(
              fontWeight: FontWeight.w700,
              color: colors.textPrimary,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'Define reusable custom fields and save values for the active store.',
            style: TextStyle(color: colors.textSecondary),
          ),
          const SizedBox(height: 20),
          for (final definition in summary.definitions)
            _DefinitionTile(
              definition: definition,
              value: _valueFor(definition.id),
              onEditDefinition: _isBusy
                  ? null
                  : () => _editDefinition(definition),
              onEditValue: _isBusy ? null : () => _editValue(definition),
              onDelete: _isBusy ? null : () => _deleteDefinition(definition),
            ),
        ],
      ),
    );
  }

  Future<Map<String, dynamic>?> _showDefinitionDialog(
    StoreMetafieldDefinition? definition,
  ) async {
    final nameController = TextEditingController(text: definition?.name ?? '');
    final namespaceController = TextEditingController(
      text: definition?.namespace ?? 'custom',
    );
    final keyController = TextEditingController(text: definition?.key ?? '');
    final descriptionController = TextEditingController(
      text: definition?.description ?? '',
    );
    var valueType = definition?.valueType ?? 'single_line_text';
    var isPublic = definition?.isPublic ?? false;

    final result = await showDialog<Map<String, dynamic>>(
      context: context,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            return AlertDialog(
              title: Text(definition == null ? 'Create field' : 'Edit field'),
              content: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    TextField(
                      controller: nameController,
                      decoration: const InputDecoration(labelText: 'Name'),
                      textInputAction: TextInputAction.next,
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: namespaceController,
                      decoration: const InputDecoration(labelText: 'Namespace'),
                      textInputAction: TextInputAction.next,
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: keyController,
                      decoration: const InputDecoration(labelText: 'Key'),
                      textInputAction: TextInputAction.next,
                    ),
                    const SizedBox(height: 12),
                    DropdownButtonFormField<String>(
                      value: valueType,
                      decoration: const InputDecoration(
                        labelText: 'Value type',
                      ),
                      items: const [
                        DropdownMenuItem(
                          value: 'single_line_text',
                          child: Text('Single line text'),
                        ),
                        DropdownMenuItem(
                          value: 'multi_line_text',
                          child: Text('Multi-line text'),
                        ),
                        DropdownMenuItem(
                          value: 'number_integer',
                          child: Text('Whole number'),
                        ),
                        DropdownMenuItem(
                          value: 'number_decimal',
                          child: Text('Decimal number'),
                        ),
                        DropdownMenuItem(
                          value: 'boolean',
                          child: Text('True / false'),
                        ),
                        DropdownMenuItem(value: 'date', child: Text('Date')),
                        DropdownMenuItem(value: 'url', child: Text('URL')),
                        DropdownMenuItem(value: 'json', child: Text('JSON')),
                      ],
                      onChanged: (value) {
                        if (value != null)
                          setDialogState(() => valueType = value);
                      },
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: descriptionController,
                      decoration: const InputDecoration(
                        labelText: 'Description',
                      ),
                      maxLines: 2,
                    ),
                    SwitchListTile(
                      contentPadding: EdgeInsets.zero,
                      title: const Text('Visible to storefront'),
                      value: isPublic,
                      onChanged: (value) =>
                          setDialogState(() => isPublic = value),
                    ),
                  ],
                ),
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(context),
                  child: const Text('Cancel'),
                ),
                FilledButton(
                  onPressed: () {
                    final name = nameController.text.trim();
                    final key = keyController.text.trim();
                    if (name.isEmpty || key.isEmpty) return;
                    Navigator.pop(context, {
                      'owner_type': 'store',
                      'namespace': namespaceController.text.trim().isEmpty
                          ? 'custom'
                          : namespaceController.text.trim(),
                      'key': key,
                      'name': name,
                      'description': descriptionController.text.trim().isEmpty
                          ? null
                          : descriptionController.text.trim(),
                      'value_type': valueType,
                      'is_public': isPublic,
                    });
                  },
                  child: const Text('Save'),
                ),
              ],
            );
          },
        );
      },
    );

    nameController.dispose();
    namespaceController.dispose();
    keyController.dispose();
    descriptionController.dispose();
    return result;
  }

  Future<Object?> _showValueDialog(
    StoreMetafieldDefinition definition,
    StoreMetafieldValue? existing,
  ) async {
    final controller = TextEditingController(
      text: _valueToEditableText(existing?.value, definition.valueType),
    );
    var booleanValue = existing?.value == true;

    final result = await showDialog<Object?>(
      context: context,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            final isBoolean = definition.valueType == 'boolean';
            return AlertDialog(
              title: Text('Set ${definition.name}'),
              content: isBoolean
                  ? SwitchListTile(
                      contentPadding: EdgeInsets.zero,
                      title: const Text('Enabled'),
                      value: booleanValue,
                      onChanged: (value) =>
                          setDialogState(() => booleanValue = value),
                    )
                  : TextField(
                      controller: controller,
                      decoration: InputDecoration(
                        labelText: _labelForValueType(definition.valueType),
                      ),
                      keyboardType: _keyboardForValueType(definition.valueType),
                      maxLines:
                          definition.valueType == 'multi_line_text' ||
                              definition.valueType == 'json'
                          ? 4
                          : 1,
                    ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(context),
                  child: const Text('Cancel'),
                ),
                FilledButton(
                  onPressed: () {
                    final parsed = isBoolean
                        ? booleanValue
                        : _parseValue(
                            controller.text.trim(),
                            definition.valueType,
                          );
                    Navigator.pop(context, parsed);
                  },
                  child: const Text('Save'),
                ),
              ],
            );
          },
        );
      },
    );

    controller.dispose();
    return result;
  }

  Future<bool?> _confirm({
    required String title,
    required String message,
    required String action,
  }) {
    return showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(title),
        content: Text(message),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          FilledButton.tonal(
            onPressed: () => Navigator.pop(context, true),
            child: Text(action),
          ),
        ],
      ),
    );
  }

  void _showMessage(String message, {bool isSuccess = false}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: isSuccess ? LetbuyyColorTokens.success : null,
      ),
    );
  }
}

class _DefinitionTile extends StatelessWidget {
  const _DefinitionTile({
    required this.definition,
    required this.value,
    required this.onEditDefinition,
    required this.onEditValue,
    required this.onDelete,
  });

  final StoreMetafieldDefinition definition;
  final StoreMetafieldValue? value;
  final VoidCallback? onEditDefinition;
  final VoidCallback? onEditValue;
  final VoidCallback? onDelete;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      elevation: 0,
      color: colors.surface,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(8),
        side: BorderSide(color: colors.border),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        definition.name,
                        style: Theme.of(context).textTheme.titleMedium
                            ?.copyWith(
                              fontWeight: FontWeight.w700,
                              color: colors.textPrimary,
                            ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        '${definition.namespace}.${definition.key}',
                        style: TextStyle(color: colors.textSecondary),
                      ),
                    ],
                  ),
                ),
                PopupMenuButton<String>(
                  tooltip: 'Field actions',
                  onSelected: (value) {
                    if (value == 'edit') onEditDefinition?.call();
                    if (value == 'delete') onDelete?.call();
                  },
                  itemBuilder: (context) => const [
                    PopupMenuItem(value: 'edit', child: Text('Edit field')),
                    PopupMenuItem(value: 'delete', child: Text('Delete')),
                  ],
                ),
              ],
            ),
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                _Pill(label: _labelForValueType(definition.valueType)),
                if (definition.isPublic) const _Pill(label: 'Storefront'),
                if (definition.isRequired) const _Pill(label: 'Required'),
              ],
            ),
            if (definition.description?.isNotEmpty == true) ...[
              const SizedBox(height: 12),
              Text(
                definition.description!,
                style: TextStyle(color: colors.textSecondary),
              ),
            ],
            const SizedBox(height: 16),
            ListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('Store value'),
              subtitle: Text(_formatValue(value?.value)),
              trailing: FilledButton.tonalIcon(
                onPressed: onEditValue,
                icon: const Icon(Icons.edit_outlined, size: 18),
                label: Text(value == null ? 'Set' : 'Edit'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Pill extends StatelessWidget {
  const _Pill({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: LetbuyyColorTokens.brandPrimary.withValues(alpha: 0.10),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        child: Text(
          label,
          style: const TextStyle(
            color: LetbuyyColorTokens.brandPrimary,
            fontWeight: FontWeight.w600,
            fontSize: 12,
          ),
        ),
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState({
    required this.icon,
    required this.title,
    required this.message,
    this.actionLabel,
    this.onAction,
  });

  final IconData icon;
  final String title;
  final String message;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 48, color: colors.textSecondary),
            const SizedBox(height: 16),
            Text(
              title,
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.w700,
                color: colors.textPrimary,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              message,
              textAlign: TextAlign.center,
              style: TextStyle(color: colors.textSecondary),
            ),
            if (actionLabel != null && onAction != null) ...[
              const SizedBox(height: 18),
              FilledButton(onPressed: onAction, child: Text(actionLabel!)),
            ],
          ],
        ),
      ),
    );
  }
}

String _labelForValueType(String valueType) {
  switch (valueType) {
    case 'multi_line_text':
      return 'Multi-line text';
    case 'number_integer':
      return 'Whole number';
    case 'number_decimal':
      return 'Decimal number';
    case 'boolean':
      return 'True / false';
    case 'date':
      return 'Date';
    case 'url':
      return 'URL';
    case 'json':
      return 'JSON';
    default:
      return 'Single line text';
  }
}

TextInputType _keyboardForValueType(String valueType) {
  switch (valueType) {
    case 'number_integer':
    case 'number_decimal':
      return const TextInputType.numberWithOptions(decimal: true);
    case 'url':
      return TextInputType.url;
    case 'date':
      return TextInputType.datetime;
    default:
      return TextInputType.text;
  }
}

Object? _parseValue(String text, String valueType) {
  switch (valueType) {
    case 'number_integer':
      return int.tryParse(text) ?? 0;
    case 'number_decimal':
      return double.tryParse(text) ?? 0;
    case 'json':
      return text;
    default:
      return text;
  }
}

String _valueToEditableText(Object? value, String valueType) {
  if (value == null) return '';
  if (valueType == 'boolean') return value == true ? 'true' : 'false';
  return value.toString();
}

String _formatValue(Object? value) {
  if (value == null || value.toString().trim().isEmpty) return 'No value set';
  if (value is bool) return value ? 'True' : 'False';
  return value.toString();
}
