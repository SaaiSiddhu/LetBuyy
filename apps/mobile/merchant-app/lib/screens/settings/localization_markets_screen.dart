import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../app/store_context.dart';
import '../../models/store_model.dart';
import '../../services/store_service.dart';
import '../../theme/app_theme_colors.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';

class LocalizationMarketsScreen extends StatefulWidget {
  const LocalizationMarketsScreen({super.key});

  @override
  State<LocalizationMarketsScreen> createState() =>
      _LocalizationMarketsScreenState();
}

class _LocalizationMarketsScreenState extends State<LocalizationMarketsScreen> {
  StoreModel? _store;
  StoreLocalizationSummary? _summary;
  bool _isLoading = true;
  bool _isBusy = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadLocalization();
  }

  Future<void> _loadLocalization() async {
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

      final summary = await context.read<StoreService>().fetchLocalization(
        store.id,
      );
      if (!mounted) return;
      setState(() {
        _store = store;
        _summary = summary;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _error = 'Localization settings could not load.');
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
      if (mounted) _showMessage('Localization settings could not be saved.');
    } finally {
      if (mounted) setState(() => _isBusy = false);
    }
  }

  Future<void> _editDefaults() async {
    final store = _store;
    final summary = _summary;
    if (store == null || summary == null) return;
    final result = await _showDefaultsDialog(summary);
    if (result == null) return;

    await _runAction(() async {
      final updated = await context.read<StoreService>().updateLocalization(
        store.id,
        result,
      );
      if (!mounted) return;
      setState(() => _summary = updated);
      _showMessage('Localization defaults saved.', isSuccess: true);
    });
  }

  Future<void> _editMarket(StoreMarket? market) async {
    final store = _store;
    if (store == null) return;
    final result = await _showMarketDialog(market);
    if (result == null) return;

    await _runAction(() async {
      final service = context.read<StoreService>();
      if (market == null) {
        await service.createMarket(store.id, result);
        _showMessage('Market created.', isSuccess: true);
      } else {
        await service.updateMarket(store.id, market.id, result);
        _showMessage('Market updated.', isSuccess: true);
      }
      await _loadLocalization();
    });
  }

  Future<void> _deleteMarket(StoreMarket market) async {
    final store = _store;
    if (store == null) return;
    final confirmed = await _confirm(
      title: 'Delete market?',
      message: 'Delete "${market.name}" from storefront markets.',
      action: 'Delete',
    );
    if (confirmed != true) return;

    await _runAction(() async {
      await context.read<StoreService>().deleteMarket(store.id, market.id);
      _showMessage('Market deleted.', isSuccess: true);
      await _loadLocalization();
    });
  }

  Future<void> _editLocale(StorefrontLocale? locale) async {
    final store = _store;
    if (store == null) return;
    final result = await _showLocaleDialog(locale);
    if (result == null) return;

    await _runAction(() async {
      final service = context.read<StoreService>();
      if (locale == null) {
        await service.createLocale(store.id, result);
        _showMessage('Language created.', isSuccess: true);
      } else {
        await service.updateLocale(store.id, locale.id, result);
        _showMessage('Language updated.', isSuccess: true);
      }
      await _loadLocalization();
    });
  }

  Future<void> _deleteLocale(StorefrontLocale locale) async {
    final store = _store;
    if (store == null || locale.isDefault) return;
    final confirmed = await _confirm(
      title: 'Delete language?',
      message: 'Delete "${locale.name}" from storefront publishing.',
      action: 'Delete',
    );
    if (confirmed != true) return;

    await _runAction(() async {
      await context.read<StoreService>().deleteLocale(store.id, locale.id);
      _showMessage('Language deleted.', isSuccess: true);
      await _loadLocalization();
    });
  }

  Future<void> _editTranslation(StorefrontTranslation? translation) async {
    final store = _store;
    if (store == null) return;
    final result = await _showTranslationDialog(translation);
    if (result == null) return;

    await _runAction(() async {
      final service = context.read<StoreService>();
      if (translation == null) {
        await service.createTranslation(store.id, result);
        _showMessage('Translation created.', isSuccess: true);
      } else {
        await service.updateTranslation(store.id, translation.id, result);
        _showMessage('Translation updated.', isSuccess: true);
      }
      await _loadLocalization();
    });
  }

  Future<void> _deleteTranslation(StorefrontTranslation translation) async {
    final store = _store;
    if (store == null) return;
    final confirmed = await _confirm(
      title: 'Delete translation?',
      message: 'Delete this storefront translation.',
      action: 'Delete',
    );
    if (confirmed != true) return;

    await _runAction(() async {
      await context.read<StoreService>().deleteTranslation(
        store.id,
        translation.id,
      );
      _showMessage('Translation deleted.', isSuccess: true);
      await _loadLocalization();
    });
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);

    return Scaffold(
      backgroundColor: colors.card,
      appBar: AppBar(
        title: const Text('Localization & Markets'),
        backgroundColor: colors.card,
        foregroundColor: colors.textPrimary,
        elevation: 0,
        actions: [
          IconButton(
            tooltip: 'Refresh',
            onPressed: _isBusy ? null : _loadLocalization,
            icon: const Icon(Icons.refresh_rounded),
          ),
        ],
      ),
      body: _buildBody(colors),
      floatingActionButton: _summary == null
          ? null
          : FloatingActionButton.extended(
              onPressed: _isBusy ? null : () => _editMarket(null),
              icon: const Icon(Icons.add_business_rounded),
              label: const Text('Market'),
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
        icon: Icons.public_off_rounded,
        title: 'Localization unavailable',
        message: _error!,
        actionLabel: 'Retry',
        onAction: _loadLocalization,
      );
    }

    final summary = _summary;
    if (summary == null) {
      return const _EmptyState(
        icon: Icons.storefront_outlined,
        title: 'Select a store',
        message: 'Choose a store before managing storefront markets.',
      );
    }

    return RefreshIndicator(
      onRefresh: _loadLocalization,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 96),
        children: [
          _SummaryCard(
            summary: summary,
            onEdit: _isBusy ? null : _editDefaults,
          ),
          const SizedBox(height: 16),
          _SectionHeader(
            title: 'Markets',
            actionLabel: 'Add',
            onAction: _isBusy ? null : () => _editMarket(null),
          ),
          if (summary.markets.isEmpty)
            const _EmptyState(
              icon: Icons.public_rounded,
              title: 'No custom markets',
              message:
                  'Your current store locale and currency are active. Add markets when selling with country-specific settings.',
              compact: true,
            )
          else
            ...summary.markets.map(_buildMarketTile),
          const SizedBox(height: 16),
          _SectionHeader(
            title: 'Storefront languages',
            actionLabel: 'Add',
            onAction: _isBusy ? null : () => _editLocale(null),
          ),
          if (summary.locales.isEmpty)
            const _EmptyState(
              icon: Icons.translate_rounded,
              title: 'No published languages',
              message:
                  'Add a storefront language to publish translations beyond the default locale.',
              compact: true,
            )
          else
            ...summary.locales.map(_buildLocaleTile),
          const SizedBox(height: 16),
          _SectionHeader(
            title: 'Translations',
            actionLabel: 'Add',
            onAction: _isBusy ? null : () => _editTranslation(null),
          ),
          if (summary.translations.isEmpty)
            const _EmptyState(
              icon: Icons.article_outlined,
              title: 'No translation rows',
              message:
                  'Create translations for products, pages, policies, navigation, or theme copy.',
              compact: true,
            )
          else
            ...summary.translations.map(_buildTranslationTile),
        ],
      ),
    );
  }

  Widget _buildMarketTile(StoreMarket market) {
    return _SettingsCard(
      leading: Icons.travel_explore_rounded,
      title: market.name,
      subtitle:
          '${market.countryCode} · ${market.currency} · ${market.locale}${market.isPrimary ? ' · Primary' : ''}',
      trailing: _StatusPill(
        label: market.isActive ? 'Active' : 'Paused',
        color: market.isActive ? Colors.green : Colors.orange,
      ),
      onEdit: _isBusy ? null : () => _editMarket(market),
      onDelete: _isBusy ? null : () => _deleteMarket(market),
    );
  }

  Widget _buildLocaleTile(StorefrontLocale locale) {
    return _SettingsCard(
      leading: Icons.language_rounded,
      title: locale.name,
      subtitle:
          '${locale.locale} · ${_label(locale.status)}${locale.isDefault ? ' · Default' : ''}',
      trailing: _StatusPill(
        label: locale.status == 'published'
            ? 'Published'
            : _label(locale.status),
        color: locale.status == 'published' ? Colors.green : Colors.orange,
      ),
      onEdit: _isBusy ? null : () => _editLocale(locale),
      onDelete: locale.isDefault || _isBusy
          ? null
          : () => _deleteLocale(locale),
    );
  }

  Widget _buildTranslationTile(StorefrontTranslation translation) {
    return _SettingsCard(
      leading: Icons.short_text_rounded,
      title: translation.translatedText,
      subtitle:
          '${translation.locale} · ${_label(translation.resourceType)} · ${translation.field}',
      trailing: _StatusPill(
        label: _label(translation.status),
        color: translation.status == 'published' ? Colors.green : Colors.orange,
      ),
      onEdit: _isBusy ? null : () => _editTranslation(translation),
      onDelete: _isBusy ? null : () => _deleteTranslation(translation),
    );
  }

  Future<Map<String, dynamic>?> _showDefaultsDialog(
    StoreLocalizationSummary summary,
  ) async {
    final localeController = TextEditingController(text: summary.defaultLocale);
    final currencyController = TextEditingController(text: summary.currency);
    final timezoneController = TextEditingController(text: summary.timezone);
    final result = await showDialog<Map<String, dynamic>>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Store defaults'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: localeController,
              decoration: const InputDecoration(labelText: 'Default locale'),
            ),
            TextField(
              controller: currencyController,
              decoration: const InputDecoration(labelText: 'Currency'),
              textCapitalization: TextCapitalization.characters,
            ),
            TextField(
              controller: timezoneController,
              decoration: const InputDecoration(labelText: 'Timezone'),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, {
              'default_locale': localeController.text.trim(),
              'currency': currencyController.text.trim().toUpperCase(),
              'timezone': timezoneController.text.trim(),
            }),
            child: const Text('Save'),
          ),
        ],
      ),
    );
    localeController.dispose();
    currencyController.dispose();
    timezoneController.dispose();
    return result;
  }

  Future<Map<String, dynamic>?> _showMarketDialog(StoreMarket? market) async {
    final nameController = TextEditingController(text: market?.name ?? '');
    final countryController = TextEditingController(
      text: market?.countryCode ?? 'IN',
    );
    final currencyController = TextEditingController(
      text: market?.currency ?? _summary?.currency ?? 'INR',
    );
    final localeController = TextEditingController(
      text: market?.locale ?? _summary?.defaultLocale ?? 'en-IN',
    );
    final adjustmentController = TextEditingController(
      text: ((market?.priceAdjustmentBps ?? 0) / 100).toStringAsFixed(0),
    );
    var isPrimary = market?.isPrimary ?? false;
    var isActive = market?.isActive ?? true;
    return _showFormDialog(
      title: market == null ? 'Add market' : 'Edit market',
      fields: (setState) => [
        TextField(
          controller: nameController,
          decoration: const InputDecoration(labelText: 'Market name'),
        ),
        TextField(
          controller: countryController,
          decoration: const InputDecoration(labelText: 'Country code'),
          textCapitalization: TextCapitalization.characters,
        ),
        TextField(
          controller: currencyController,
          decoration: const InputDecoration(labelText: 'Currency'),
          textCapitalization: TextCapitalization.characters,
        ),
        TextField(
          controller: localeController,
          decoration: const InputDecoration(labelText: 'Locale'),
        ),
        TextField(
          controller: adjustmentController,
          decoration: const InputDecoration(labelText: 'Price adjustment %'),
          keyboardType: const TextInputType.numberWithOptions(signed: true),
        ),
        SwitchListTile(
          contentPadding: EdgeInsets.zero,
          value: isPrimary,
          title: const Text('Primary market'),
          onChanged: (value) => setState(() => isPrimary = value),
        ),
        SwitchListTile(
          contentPadding: EdgeInsets.zero,
          value: isActive,
          title: const Text('Active'),
          onChanged: (value) => setState(() => isActive = value),
        ),
      ],
      onSave: () {
        final name = nameController.text.trim();
        final country = countryController.text.trim().toUpperCase();
        if (name.isEmpty || country.length != 2) return null;
        return {
          'name': name,
          'country_code': country,
          'currency': currencyController.text.trim().toUpperCase(),
          'locale': localeController.text.trim(),
          'is_primary': isPrimary,
          'is_active': isActive,
          'price_adjustment_bps':
              (int.tryParse(adjustmentController.text.trim()) ?? 0) * 100,
        };
      },
    ).whenComplete(() {
      nameController.dispose();
      countryController.dispose();
      currencyController.dispose();
      localeController.dispose();
      adjustmentController.dispose();
    });
  }

  Future<Map<String, dynamic>?> _showLocaleDialog(
    StorefrontLocale? locale,
  ) async {
    final localeController = TextEditingController(
      text: locale?.locale ?? _summary?.defaultLocale ?? 'en-IN',
    );
    final nameController = TextEditingController(text: locale?.name ?? '');
    var status = locale?.status ?? 'draft';
    var isDefault = locale?.isDefault ?? false;
    return _showFormDialog(
      title: locale == null ? 'Add language' : 'Edit language',
      fields: (setState) => [
        if (locale == null)
          TextField(
            controller: localeController,
            decoration: const InputDecoration(labelText: 'Locale'),
          ),
        TextField(
          controller: nameController,
          decoration: const InputDecoration(labelText: 'Display name'),
        ),
        DropdownButtonFormField<String>(
          value: status,
          decoration: const InputDecoration(labelText: 'Status'),
          items: const [
            DropdownMenuItem(value: 'draft', child: Text('Draft')),
            DropdownMenuItem(value: 'published', child: Text('Published')),
            DropdownMenuItem(value: 'archived', child: Text('Archived')),
          ],
          onChanged: (value) => setState(() => status = value ?? 'draft'),
        ),
        SwitchListTile(
          contentPadding: EdgeInsets.zero,
          value: isDefault,
          title: const Text('Default storefront locale'),
          onChanged: (value) => setState(() => isDefault = value),
        ),
      ],
      onSave: () {
        final name = nameController.text.trim();
        if (name.isEmpty) return null;
        return {
          if (locale == null) 'locale': localeController.text.trim(),
          'name': name,
          'status': isDefault ? 'published' : status,
          'is_default': isDefault,
        };
      },
    ).whenComplete(() {
      localeController.dispose();
      nameController.dispose();
    });
  }

  Future<Map<String, dynamic>?> _showTranslationDialog(
    StorefrontTranslation? translation,
  ) async {
    final localeController = TextEditingController(
      text: translation?.locale ?? _summary?.defaultLocale ?? 'en-IN',
    );
    final resourceIdController = TextEditingController(
      text: translation?.resourceId ?? 'storefront',
    );
    final fieldController = TextEditingController(
      text: translation?.field ?? 'title',
    );
    final sourceController = TextEditingController(
      text: translation?.sourceText ?? '',
    );
    final translatedController = TextEditingController(
      text: translation?.translatedText ?? '',
    );
    var resourceType = translation?.resourceType ?? 'store';
    var status = translation?.status ?? 'draft';
    return _showFormDialog(
      title: translation == null ? 'Add translation' : 'Edit translation',
      fields: (setState) => [
        if (translation == null)
          TextField(
            controller: localeController,
            decoration: const InputDecoration(labelText: 'Locale'),
          ),
        DropdownButtonFormField<String>(
          value: resourceType,
          decoration: const InputDecoration(labelText: 'Resource'),
          items: const [
            DropdownMenuItem(value: 'store', child: Text('Store')),
            DropdownMenuItem(value: 'product', child: Text('Product')),
            DropdownMenuItem(value: 'collection', child: Text('Collection')),
            DropdownMenuItem(value: 'page', child: Text('Page')),
            DropdownMenuItem(value: 'policy', child: Text('Policy')),
            DropdownMenuItem(value: 'theme', child: Text('Theme')),
            DropdownMenuItem(value: 'navigation', child: Text('Navigation')),
          ],
          onChanged: (value) => setState(() => resourceType = value ?? 'store'),
        ),
        if (translation == null)
          TextField(
            controller: resourceIdController,
            decoration: const InputDecoration(labelText: 'Resource ID'),
          ),
        if (translation == null)
          TextField(
            controller: fieldController,
            decoration: const InputDecoration(labelText: 'Field'),
          ),
        TextField(
          controller: sourceController,
          decoration: const InputDecoration(labelText: 'Source text'),
          maxLines: 2,
        ),
        TextField(
          controller: translatedController,
          decoration: const InputDecoration(labelText: 'Translated text'),
          maxLines: 3,
        ),
        DropdownButtonFormField<String>(
          value: status,
          decoration: const InputDecoration(labelText: 'Status'),
          items: const [
            DropdownMenuItem(value: 'draft', child: Text('Draft')),
            DropdownMenuItem(value: 'published', child: Text('Published')),
            DropdownMenuItem(
              value: 'needs_review',
              child: Text('Needs review'),
            ),
          ],
          onChanged: (value) => setState(() => status = value ?? 'draft'),
        ),
      ],
      onSave: () {
        final translated = translatedController.text.trim();
        if (translated.isEmpty) return null;
        return {
          if (translation == null) 'locale': localeController.text.trim(),
          if (translation == null) 'resource_type': resourceType,
          if (translation == null)
            'resource_id': resourceIdController.text.trim(),
          if (translation == null) 'field': fieldController.text.trim(),
          'source_text': sourceController.text.trim().isEmpty
              ? null
              : sourceController.text.trim(),
          'translated_text': translated,
          'status': status,
        };
      },
    ).whenComplete(() {
      localeController.dispose();
      resourceIdController.dispose();
      fieldController.dispose();
      sourceController.dispose();
      translatedController.dispose();
    });
  }

  Future<Map<String, dynamic>?> _showFormDialog({
    required String title,
    required List<Widget> Function(void Function(void Function()) setState)
    fields,
    required Map<String, dynamic>? Function() onSave,
  }) {
    String? error;
    return showDialog<Map<String, dynamic>>(
      context: context,
      builder: (dialogContext) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: Text(title),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                ...fields(
                  setDialogState,
                ).expand((field) => [field, const SizedBox(height: 12)]),
                if (error != null)
                  Text(error!, style: TextStyle(color: Colors.red.shade700)),
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
                final result = onSave();
                if (result == null) {
                  setDialogState(() => error = 'Complete the required fields.');
                  return;
                }
                Navigator.pop(dialogContext, result);
              },
              child: const Text('Save'),
            ),
          ],
        ),
      ),
    );
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
          FilledButton(
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
        backgroundColor: isSuccess ? Colors.green : Colors.red,
      ),
    );
  }
}

class _SummaryCard extends StatelessWidget {
  const _SummaryCard({required this.summary, this.onEdit});

  final StoreLocalizationSummary summary;
  final VoidCallback? onEdit;

  @override
  Widget build(BuildContext context) {
    return _Panel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.public_rounded),
              const SizedBox(width: 10),
              const Expanded(
                child: Text(
                  'Storefront defaults',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
                ),
              ),
              IconButton(
                tooltip: 'Edit defaults',
                onPressed: onEdit,
                icon: const Icon(Icons.edit_rounded),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              _InfoChip(label: 'Locale', value: summary.defaultLocale),
              _InfoChip(label: 'Currency', value: summary.currency),
              _InfoChip(label: 'Timezone', value: summary.timezone),
            ],
          ),
          if (!summary.schemaReady)
            const Padding(
              padding: EdgeInsets.only(top: 12),
              child: Text(
                'Some localization records are temporarily unavailable.',
                style: TextStyle(fontSize: 12),
              ),
            ),
        ],
      ),
    );
  }
}

class _SectionHeader extends StatelessWidget {
  const _SectionHeader({
    required this.title,
    required this.actionLabel,
    this.onAction,
  });

  final String title;
  final String actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        children: [
          Expanded(
            child: Text(
              title,
              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
            ),
          ),
          TextButton.icon(
            onPressed: onAction,
            icon: const Icon(Icons.add_rounded),
            label: Text(actionLabel),
          ),
        ],
      ),
    );
  }
}

class _SettingsCard extends StatelessWidget {
  const _SettingsCard({
    required this.leading,
    required this.title,
    required this.subtitle,
    required this.trailing,
    this.onEdit,
    this.onDelete,
  });

  final IconData leading;
  final String title;
  final String subtitle;
  final Widget trailing;
  final VoidCallback? onEdit;
  final VoidCallback? onDelete;

  @override
  Widget build(BuildContext context) {
    return _Panel(
      margin: const EdgeInsets.only(bottom: 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(leading, color: LetbuyyColorTokens.brandPrimary),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 4),
                Text(subtitle),
                const SizedBox(height: 8),
                trailing,
              ],
            ),
          ),
          IconButton(
            tooltip: 'Edit',
            onPressed: onEdit,
            icon: const Icon(Icons.edit_rounded),
          ),
          IconButton(
            tooltip: 'Delete',
            onPressed: onDelete,
            icon: const Icon(Icons.delete_outline_rounded),
          ),
        ],
      ),
    );
  }
}

class _Panel extends StatelessWidget {
  const _Panel({required this.child, this.margin});

  final Widget child;
  final EdgeInsetsGeometry? margin;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    return Container(
      width: double.infinity,
      margin: margin,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: colors.border),
      ),
      child: child,
    );
  }
}

class _StatusPill extends StatelessWidget {
  const _StatusPill({required this.label, required this.color});

  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
        child: Text(
          label,
          style: TextStyle(color: color, fontWeight: FontWeight.w700),
        ),
      ),
    );
  }
}

class _InfoChip extends StatelessWidget {
  const _InfoChip({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Chip(label: Text('$label: $value'));
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState({
    required this.icon,
    required this.title,
    required this.message,
    this.actionLabel,
    this.onAction,
    this.compact = false,
  });

  final IconData icon;
  final String title;
  final String message;
  final String? actionLabel;
  final VoidCallback? onAction;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    return _Panel(
      child: Padding(
        padding: EdgeInsets.symmetric(vertical: compact ? 4 : 36),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: compact ? 28 : 42),
            const SizedBox(height: 10),
            Text(title, style: const TextStyle(fontWeight: FontWeight.w700)),
            const SizedBox(height: 4),
            Text(message, textAlign: TextAlign.center),
            if (actionLabel != null && onAction != null) ...[
              const SizedBox(height: 12),
              FilledButton(onPressed: onAction, child: Text(actionLabel!)),
            ],
          ],
        ),
      ),
    );
  }
}

String _label(String value) {
  return value
      .split('_')
      .where((part) => part.isNotEmpty)
      .map((part) => '${part[0].toUpperCase()}${part.substring(1)}')
      .join(' ');
}
