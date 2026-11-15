import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../app/store_context.dart';

import '../../models/store_model.dart';
import '../../services/store_service.dart';
import '../../services/api_client.dart';
import '../../widgets/shared/merchant_store_view.dart';
import '../../widgets/shared/confirm_dialog.dart';
import '../../theme/app_theme_colors.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart' as mobile_tokens;

class SEOSettingsScreen extends StatefulWidget {
  const SEOSettingsScreen({super.key});

  @override
  State<SEOSettingsScreen> createState() => _SEOSettingsScreenState();
}

class _SEOSettingsScreenState extends State<SEOSettingsScreen> {
  final _titleController = TextEditingController();
  final _descriptionController = TextEditingController();

  StoreModel? _store;
  bool _isLoading = true;
  bool _isSaving = false;
  bool _hasChanges = false;
  String? _error, _notice;
  bool _saveUnconfirmed = false, _allowPop = false;
  MerchantStoreView? _view;
  bool get _current => mounted && merchantStoreViewCurrent(context, _view);
  Widget _guard(Widget child) =>
      _view == null ? child : guardMerchantStoreView(_view, child);

  late AppThemeColors colors;

  @override
  void initState() {
    super.initState();
    _loadStore();
  }

  void _populate(StoreModel store) {
    _titleController.text = store.seoTitle ?? store.name;
    _descriptionController.text = store.seoDescription ?? '';
  }

  Future<void> _loadStore() async {
    if (!mounted || (_view != null && !_current)) return;
    setState(() {
      _isLoading = true;
      _error = null;
      _notice = null;
    });
    try {
      final stores = context.read<StoreContext>();
      final selected = await stores.ensureSelectedStore();
      if (!mounted || (_view != null && !_current)) return;
      if (selected == null) {
        setState(() => _error = 'Choose a store from the dashboard first.');
        return;
      }
      _view ??= (key: stores.requestContextKey, storeId: selected.id);
      if (!_current) return;
      final store = await stores.reloadSelectedStore(selected.id);
      if (!_current) return;
      setState(() {
        _store = store;
        _populate(store);
        _hasChanges = false;
        _saveUnconfirmed = false;
      });
    } catch (_) {
      if (!mounted || (_view != null && !_current)) return;
      setState(() {
        if (_store == null)
          _error = 'Current SEO settings are unavailable. Try refreshing.';
        else
          _notice =
              'Could not reload current SEO settings. Your edits are still here.';
      });
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _confirmReload() async {
    if (!_current || _isSaving) return;
    if (_hasChanges) {
      final discard = await ConfirmDialog.show(
        context,
        title: 'Reload SEO settings?',
        message:
            'Unsaved edits will be discarded after the current settings load.',
        confirmLabel: 'Reload',
        cancelLabel: 'Keep editing',
      );
      if (!discard || !_current) return;
    }
    await _loadStore();
  }

  Future<void> _save() async {
    final store = _store;
    if (store == null || !_current || _isSaving || _saveUnconfirmed) return;
    final service = context.read<StoreService>(),
        stores = context.read<StoreContext>();
    // The canonical schema admits empty strings to clear these fields, not null.
    final fields = <String, dynamic>{
      'version': store.version,
      'seo_title': _titleController.text.trim(),
      'seo_description': _descriptionController.text.trim(),
    };
    FocusScope.of(context).unfocus();
    setState(() => _isSaving = true);
    try {
      await service.updateStore(store.id, fields);
      if (!_current) return;
      final fresh = await stores.reloadSelectedStore(store.id);
      if (!_current) return;
      setState(() {
        _store = fresh;
        _populate(fresh);
        _hasChanges = false;
        _saveUnconfirmed = false;
      });
      _showSnack('SEO settings saved.');
    } catch (error) {
      if (!_current) return;
      if (error is ApiException &&
          const {401, 403, 404}.contains(error.statusCode)) {
        await stores.clearSelection();
        return;
      }
      setState(() => _saveUnconfirmed = true);
      _showSnack(
        'The SEO save could not be confirmed. Reload current settings before another change.',
      );
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  Future<void> _confirmBack() async {
    if (!_current || _isSaving) return;
    final discard = await ConfirmDialog.show(
      context,
      title: 'Discard SEO edits?',
      message: 'The changes in this form have not been confirmed as saved.',
      confirmLabel: 'Discard edits',
      cancelLabel: 'Keep editing',
    );
    if (!discard || !_current) return;
    setState(() => _allowPop = true);
    if (mounted) Navigator.of(context).pop();
  }

  @override
  void dispose() {
    _titleController.dispose();
    _descriptionController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    colors = AppThemeColors.of(context);
    return _guard(
      PopScope(
        canPop: _allowPop || (!_hasChanges && !_isSaving),
        onPopInvokedWithResult: (didPop, _) {
          if (!didPop) _confirmBack();
        },
        child: Scaffold(
          backgroundColor: colors.bgStart,
          body: Container(
            decoration: colors.backgroundGradient,
            child: SafeArea(
              child: Column(
                children: [
                  _header(),
                  Expanded(child: _isLoading ? _loading() : _body()),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _header() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 8, 8, 8),
      child: Row(
        children: [
          IconButton(
            tooltip: 'Back',
            icon: Icon(Icons.arrow_back_rounded, color: colors.textPrimary),
            onPressed: () => Navigator.maybePop(context),
          ),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'SEO Settings',
                  style: TextStyle(
                    color: colors.textPrimary,
                    fontSize: 22,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                Text(
                  'Storefront title and meta description',
                  style: TextStyle(color: colors.textSecondary, fontSize: 12),
                ),
              ],
            ),
          ),
          IconButton(
            tooltip: 'Refresh SEO settings',
            icon: Icon(Icons.refresh_rounded, color: colors.textSecondary),
            onPressed: _isSaving ? null : _confirmReload,
          ),
        ],
      ),
    );
  }

  Widget _body() {
    if (_error != null) {
      return _centerState(
        Icons.error_outline_rounded,
        'Could not load SEO settings',
        _error!,
      );
    }

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
      children: [
        if (_saveUnconfirmed || _notice != null) ...[
          Text(
            _saveUnconfirmed
                ? 'The SEO save is unconfirmed. Reload current settings before another change.'
                : _notice!,
          ),
          const SizedBox(height: 14),
        ],
        _previewCard(),
        const SizedBox(height: 14),
        _field(
          label: 'SEO title',
          controller: _titleController,
          maxLength: 70,
          hint: _store?.name ?? 'Store title',
        ),
        const SizedBox(height: 14),
        _field(
          label: 'Meta description',
          controller: _descriptionController,
          maxLength: 160,
          maxLines: 4,
          hint: _store?.tagline ?? 'Store description',
        ),
        const SizedBox(height: 18),
        FilledButton.icon(
          onPressed: !_hasChanges || _isSaving || _saveUnconfirmed
              ? null
              : _save,
          icon: _isSaving
              ? const SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : const Icon(Icons.save_outlined),
          label: const Text('Save SEO'),
          style: FilledButton.styleFrom(
            backgroundColor: mobile_tokens.LetbuyyColorTokens.brandPrimary,
            foregroundColor: mobile_tokens.LetbuyyColorTokens.white,
            disabledBackgroundColor: colors.surfaceVariant,
            disabledForegroundColor: colors.textTertiary,
            minimumSize: const Size.fromHeight(48),
          ),
        ),
      ],
    );
  }

  Widget _previewCard() {
    final title = _titleController.text.trim().isEmpty
        ? (_store?.name ?? 'Store')
        : _titleController.text.trim();
    final description = _descriptionController.text.trim().isEmpty
        ? (_store?.tagline ?? 'Store description')
        : _descriptionController.text.trim();
    final url = _store?.publicUrl.replaceFirst(RegExp(r'^https?://'), '') ?? '';

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: colors.card,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: colors.cardBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                Icons.search_outlined,
                color: mobile_tokens.LetbuyyColorTokens.brandPrimary,
              ),
              const SizedBox(width: 8),
              Text(
                'Search preview',
                style: TextStyle(
                  color: colors.textPrimary,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            url,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(color: colors.success, fontSize: 12),
          ),
          const SizedBox(height: 4),
          Text(
            title,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              color: mobile_tokens.LetbuyyColorTokens.info,
              fontSize: 18,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            description,
            maxLines: 3,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(color: colors.textSecondary, height: 1.35),
          ),
        ],
      ),
    );
  }

  Widget _field({
    required String label,
    required TextEditingController controller,
    required int maxLength,
    required String hint,
    int maxLines = 1,
  }) {
    return TextField(
      enabled: !_isSaving && !_saveUnconfirmed,
      controller: controller,
      maxLength: maxLength,
      maxLines: maxLines,
      decoration: InputDecoration(
        labelText: label,
        hintText: hint,
        filled: true,
        fillColor: colors.card,
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: colors.cardBorder),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(
            color: mobile_tokens.LetbuyyColorTokens.brandPrimary,
          ),
        ),
      ),
      onChanged: (_) => setState(() => _hasChanges = true),
    );
  }

  Widget _loading() {
    return Center(
      child: CircularProgressIndicator(
        color: mobile_tokens.LetbuyyColorTokens.brandPrimary,
      ),
    );
  }

  Widget _centerState(IconData icon, String title, String message) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, color: colors.textTertiary, size: 42),
            const SizedBox(height: 12),
            Text(
              title,
              textAlign: TextAlign.center,
              style: TextStyle(
                color: colors.textPrimary,
                fontSize: 18,
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              message,
              textAlign: TextAlign.center,
              style: TextStyle(color: colors.textSecondary),
            ),
          ],
        ),
      ),
    );
  }

  void _showSnack(String message) {
    if (!_current) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: colors.snackbarBackground,
      ),
    );
  }
}
