import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../app/store_context.dart';

import '../../models/store_model.dart';
import '../../services/store_service.dart';
import '../../services/api_client.dart';
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
  String? _error;

  late AppThemeColors colors;

  @override
  void initState() {
    super.initState();
    _loadStore();
  }

  Future<void> _loadStore({bool forceFresh = false}) async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final storeContext = context.read<StoreContext>();
      final store = forceFresh && _store != null
          ? await storeContext.reloadSelectedStore(_store!.id)
          : await storeContext.ensureSelectedStore();
      if (mounted) {
        setState(() {
          _store = store;
          _titleController.text = store?.seoTitle ?? store?.name ?? '';
          _descriptionController.text = store?.seoDescription ?? '';
          _hasChanges = false;
          _isLoading = false;
        });
      }
    } catch (error) {
      if (mounted) {
        final accessLost =
            error is ApiException &&
            (error.statusCode == 401 ||
                error.statusCode == 403 ||
                error.statusCode == 404 ||
                error.code == 'SESSION_CONTEXT_CHANGED');
        setState(() {
          if (accessLost) {
            _store = null;
            _titleController.clear();
            _descriptionController.clear();
            _hasChanges = false;
          }
          _error = accessLost
              ? 'Store access changed. Open settings again.'
              : forceFresh
              ? null
              : error.toString();
          _isLoading = false;
        });
        if (forceFresh && !accessLost)
          _showSnack(
            'Could not reload current SEO settings. Your edits are still here.',
          );
      }
    }
  }

  Future<void> _confirmReload() async {
    if (_hasChanges) {
      final discard = await showDialog<bool>(
        context: context,
        builder: (dialogContext) => AlertDialog(
          title: const Text('Discard SEO edits?'),
          content: const Text(
            'Reload the current store SEO from the server and discard your unsaved changes.',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialogContext, false),
              child: const Text('Keep editing'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(dialogContext, true),
              child: const Text('Discard and reload'),
            ),
          ],
        ),
      );
      if (!mounted || discard != true) return;
    }
    await _loadStore(forceFresh: true);
  }

  Future<void> _save() async {
    final store = _store;
    if (store == null || _isSaving) return;

    FocusScope.of(context).unfocus();
    setState(() => _isSaving = true);
    try {
      final updated = await context.read<StoreService>().updateStore(store.id, {
        'version': store.version,
        'seo_title': _nullableTrim(_titleController.text),
        'seo_description': _nullableTrim(_descriptionController.text),
      });
      if (mounted) {
        setState(() {
          _store = updated;
          _hasChanges = false;
        });
        _showSnack('SEO settings saved.');
      }
    } on ApiException catch (error) {
      final stale =
          error.statusCode == 409 && error.code != 'SESSION_CONTEXT_CHANGED';
      _showSnack(
        stale
            ? 'Store SEO changed elsewhere. Reload to discard these edits.'
            : 'Could not save SEO settings: ${error.message}',
        action: stale
            ? SnackBarAction(
                label: 'Reload',
                onPressed: () => _loadStore(forceFresh: true),
              )
            : null,
      );
    } catch (error) {
      _showSnack('Could not save SEO settings: $error');
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
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
    return Scaffold(
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
            onPressed: _confirmReload,
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
          onPressed: !_hasChanges || _isSaving ? null : _save,
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
    final url = _store?.customDomain?.isNotEmpty == true
        ? _store!.customDomain!
        : '${_store?.subdomain ?? 'store'}.letbuyy.com';

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

  void _showSnack(String message, {SnackBarAction? action}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        action: action,
        backgroundColor: colors.snackbarBackground,
      ),
    );
  }

  String? _nullableTrim(String value) {
    final trimmed = value.trim();
    return trimmed.isEmpty ? null : trimmed;
  }
}
