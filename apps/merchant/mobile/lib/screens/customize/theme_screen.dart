import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:provider/provider.dart';

import '../../app/store_context.dart';

import '../../models/store_model.dart';
import '../../models/theme_editor_models.dart';
import '../../services/theme_service.dart';
import '../../theme/app_theme_colors.dart';
import '../../widgets/shared/cached_merchant_image.dart';
import '../editor/section_editor_screen.dart';
import '../preview/live_preview_screen.dart';
import 'theme_versions_screen.dart';

class ThemeScreen extends StatefulWidget {
  const ThemeScreen({super.key});

  @override
  State<ThemeScreen> createState() => _ThemeScreenState();
}

class _ThemeScreenState extends State<ThemeScreen> {
  StoreModel? _store;
  ThemeCatalogResponse? _catalog;
  ThemeEditorPayload? _editorPayload;
  List<Map<String, dynamic>> _releases = const [];
  bool _isLoading = true;
  bool _isBusy = false;
  Object? _ownedContext;
  int _loadGeneration = 0;
  late AppThemeColors colors;

  String get _activeThemeSlug =>
      _catalog?.currentTheme ??
      _store?.templateConfig?.themeId ??
      _store?.themeId ??
      'minimal_modern';

  String get _activeThemeName {
    final matches = (_catalog?.themes ?? const <ThemeCatalogItem>[]).where(
      (theme) => theme.slug == _activeThemeSlug || theme.active,
    );
    return matches.isEmpty ? _activeThemeSlug : matches.first.name;
  }

  @override
  void initState() {
    super.initState();
    _loadThemes();
  }

  Future<void> _loadThemes() async {
    final generation = ++_loadGeneration;
    setState(() => _isLoading = true);
    try {
      final themeService = context.read<ThemeService>();
      final store = await context.read<StoreContext>().ensureSelectedStore();
      if (store == null) {
        if (mounted) setState(() => _store = null);
        return;
      }

      final requestContext = themeService.captureContext();
      final catalog = await themeService.fetchThemes(store.id);
      ThemeEditorPayload? editor;
      List<Map<String, dynamic>> releases = const [];
      try {
        editor = await themeService.loadEditor(
          storeId: store.id,
          themeSlug:
              catalog.currentTheme ??
              store.templateConfig?.themeId ??
              store.themeId,
        );
        releases = await themeService.fetchReleases(
          storeId: store.id,
          themeSlug:
              catalog.currentTheme ??
              store.templateConfig?.themeId ??
              store.themeId,
        );
      } catch (_) {
        editor = null;
      }

      if (!mounted ||
          generation != _loadGeneration ||
          themeService.captureContext() != requestContext)
        return;
      setState(() {
        _ownedContext = requestContext;
        _store = store;
        _catalog = catalog;
        _editorPayload = editor;
        _releases = releases;
      });
    } catch (error) {
      if (mounted) _showMessage('Unable to load themes: $error', isError: true);
    } finally {
      if (mounted && generation == _loadGeneration)
        setState(() => _isLoading = false);
    }
  }

  Future<void> _runThemeAction(Future<void> Function() action) async {
    if (_store == null ||
        _isBusy ||
        _ownedContext != context.read<ThemeService>().captureContext())
      return;
    setState(() => _isBusy = true);
    try {
      await action();
      await _loadThemes();
      HapticFeedback.mediumImpact();
    } on ThemeDraftConflictException catch (error) {
      if (mounted) _showMessage(error.toString(), isError: true);
    } catch (_) {
      if (mounted)
        _showMessage(
          'Theme action was not confirmed. Retry it to recover the result.',
          isError: true,
        );
    } finally {
      if (mounted) setState(() => _isBusy = false);
    }
  }

  Future<void> _installTheme(ThemeCatalogItem theme) {
    return _runThemeAction(() async {
      await context.read<ThemeService>().installTheme(
        storeId: _store!.id,
        themeSlug: theme.slug,
      );
      _showMessage('${theme.name} installed', isSuccess: true);
    });
  }

  Future<void> _publishTheme() {
    return _runThemeAction(() async {
      final service = context.read<ThemeService>();
      if (service.hasPendingPublication(_store!.id, _activeThemeSlug)) {
        await service.recoverPublication(
          storeId: _store!.id,
          themeSlug: _activeThemeSlug,
        );
      } else {
        final editor = _editorPayload;
        if (editor == null ||
            !editor.hasDraft ||
            editor.store['id'] != _store!.id ||
            editor.theme['slug'] != _activeThemeSlug) {
          throw StateError(
            'Load and save this owned theme draft before publishing.',
          );
        }
        await service.publish(
          storeId: _store!.id,
          themeSlug: _activeThemeSlug,
          baseVersion: editor.version,
        );
      }
      _showMessage('Publication confirmed', isSuccess: true);
    });
  }

  Future<void> _discardDraft() async {
    final store = _store,
        editor = _editorPayload,
        service = context.read<ThemeService>();
    if (store == null || editor == null) return;
    final slug = _activeThemeSlug, requestContext = service.captureContext();
    final discard = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Discard saved theme draft?'),
        content: Text(
          'Discard all unpublished theme edits at version ${editor.version}? Your published storefront stays available.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Keep draft'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Discard draft'),
          ),
        ],
      ),
    );
    if (discard != true ||
        !mounted ||
        _store?.id != store.id ||
        _activeThemeSlug != slug ||
        service.captureContext() != requestContext)
      return;
    await _runThemeAction(() async {
      await service.discardDraft(
        storeId: store.id,
        themeSlug: slug,
        baseVersion: editor.version,
      );
      _showMessage('Draft discard confirmed', isSuccess: true);
    });
  }

  Future<void> _duplicateDraft() {
    return _runThemeAction(() async {
      final editor =
          _editorPayload ??
          await context.read<ThemeService>().loadEditor(
            storeId: _store!.id,
            themeSlug: _activeThemeSlug,
          );
      await context.read<ThemeService>().duplicateDraft(
        storeId: _store!.id,
        themeSlug: _activeThemeSlug,
        templateConfig: editor.templateConfig,
        baseVersion: editor.version,
      );
      _showMessage('Draft duplicated', isSuccess: true);
    });
  }

  Future<void> _previewTheme() async {
    if (_store == null) return;

    setState(() => _isBusy = true);
    String? previewToken;
    try {
      if (_editorPayload?.hasDraft == true) {
        final preview = await context.read<ThemeService>().createPreviewSession(
          storeId: _store!.id,
          themeSlug: _activeThemeSlug,
        );
        previewToken = preview['preview_token']?.toString();
      }
    } catch (_) {
      previewToken = null;
    } finally {
      if (mounted) setState(() => _isBusy = false);
    }

    final url = ThemeService.buildStorefrontPreviewUrl(
      subdomain: _store!.subdomain,
      previewToken: previewToken,
      viewport: 'phone',
      settingsData: _store!.templateConfig?.themeSettings.toMap(),
    );
    if (!mounted) return;
    await Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) =>
            LivePreviewScreen(storeUrl: url, storeName: _store!.name),
      ),
    );
  }

  Future<void> _openVersions() async {
    if (_store == null || _isBusy) return;
    final changed = await Navigator.push<bool>(
      context,
      MaterialPageRoute(
        builder: (_) => ThemeVersionsScreen(
          storeId: _store!.id,
          themeSlug: _activeThemeSlug,
          themeName: _activeThemeName,
        ),
      ),
    );
    if (changed == true) await _loadThemes();
  }

  void _openEditor() {
    if (_store == null) return;
    Navigator.push(
      context,
      MaterialPageRoute(builder: (_) => const SectionEditorScreen()),
    ).then(
      (_) => _loadThemes(),
    ); // Reload after editor closes in case draft changed
  }

  @override
  Widget build(BuildContext context) {
    context.watch<StoreContext>();
    colors = AppThemeColors.of(context);
    if (_store != null &&
        _ownedContext != context.read<ThemeService>().captureContext()) {
      return Scaffold(
        appBar: AppBar(title: const Text('Themes')),
        body: Center(
          child: FilledButton(
            onPressed: _loadThemes,
            child: const Text('Reload themes for the current account'),
          ),
        ),
      );
    }
    return Scaffold(
      backgroundColor: colors.bgStart,
      body: Container(
        decoration: colors.backgroundGradient,
        child: SafeArea(
          child: _isLoading
              ? const Center(
                  child: CircularProgressIndicator(color: Colors.white),
                )
              : RefreshIndicator(
                  onRefresh: _loadThemes,
                  child: ListView(
                    padding: const EdgeInsets.fromLTRB(20, 8, 20, 100),
                    children: [
                      _buildHeader(),
                      const SizedBox(height: 16),
                      _buildActiveThemePanel(),
                      const SizedBox(height: 20),
                      _buildSectionHeader(
                        'Theme Library',
                        Icons.palette_outlined,
                      ),
                      const SizedBox(height: 12),
                      ...(_catalog?.themes ?? const <ThemeCatalogItem>[]).map(
                        _buildThemeCard,
                      ),
                      if ((_catalog?.themes ?? const []).isEmpty)
                        _buildEmptyState(),
                    ],
                  ),
                ),
        ),
      ),
    );
  }

  Widget _buildHeader() {
    return Row(
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Themes',
                style: TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.w700,
                  color: colors.textPrimary,
                ),
              ),
              Text(
                _store?.name ?? 'Select a store',
                style: TextStyle(fontSize: 12, color: colors.textSecondary),
              ),
            ],
          ),
        ),
        IconButton(
          onPressed: _isBusy ? null : _loadThemes,
          icon: Icon(Icons.refresh_rounded, color: colors.textPrimary),
          tooltip: 'Refresh',
        ),
      ],
    );
  }

  Widget _buildActiveThemePanel() {
    final activeTheme = (_catalog?.themes ?? const <ThemeCatalogItem>[]).where(
      (theme) => theme.slug == _activeThemeSlug || theme.active,
    );
    final theme = activeTheme.isEmpty ? null : activeTheme.first;
    final hasDraft = _editorPayload?.hasDraft == true;
    final recoverPublish =
        _store != null &&
        context.read<ThemeService>().hasPendingPublication(
          _store!.id,
          _activeThemeSlug,
        );
    final releaseCount = _releases.length;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: colors.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: colors.divider),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      theme?.name ?? _activeThemeSlug,
                      style: TextStyle(
                        color: colors.textPrimary,
                        fontWeight: FontWeight.w700,
                        fontSize: 16,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      hasDraft
                          ? 'Draft v${_editorPayload?.version ?? 1} ready'
                          : 'Published theme',
                      style: TextStyle(
                        color: colors.textSecondary,
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ),
              _StatusPill(
                text: hasDraft ? 'Draft' : 'Live',
                color: hasDraft ? colors.warning : colors.success,
              ),
            ],
          ),
          const SizedBox(height: 14),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              _ActionChipButton(
                label: 'Edit',
                icon: Icons.tune_rounded,
                onTap: _openEditor,
                enabled: !_isBusy,
              ),
              _ActionChipButton(
                label: 'Preview',
                icon: Icons.visibility_outlined,
                onTap: _previewTheme,
                enabled: !_isBusy,
              ),
              _ActionChipButton(
                label: 'Versions',
                icon: Icons.history_rounded,
                onTap: _openVersions,
                enabled: !_isBusy,
              ),
              _ActionChipButton(
                label: 'Duplicate',
                icon: Icons.copy_rounded,
                onTap: _duplicateDraft,
                enabled: !_isBusy,
              ),
              _ActionChipButton(
                label: recoverPublish ? 'Recover publish' : 'Publish',
                icon: Icons.cloud_upload_outlined,
                onTap: hasDraft || recoverPublish ? _publishTheme : null,
                enabled: (hasDraft || recoverPublish) && !_isBusy,
              ),
              _ActionChipButton(
                label: 'Discard',
                icon: Icons.delete_outline_rounded,
                onTap: hasDraft ? _discardDraft : null,
                enabled: hasDraft && !_isBusy,
                destructive: true,
              ),
            ],
          ),
          if (releaseCount > 0) ...[
            const SizedBox(height: 12),
            Text(
              '$releaseCount release${releaseCount == 1 ? '' : 's'} recorded',
              style: TextStyle(color: colors.textTertiary, fontSize: 11),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildSectionHeader(String title, IconData icon) {
    return Row(
      children: [
        Icon(icon, color: AppColors.primary, size: 18),
        const SizedBox(width: 10),
        Text(
          title,
          style: TextStyle(
            color: colors.textPrimary,
            fontSize: 16,
            fontWeight: FontWeight.w700,
          ),
        ),
      ],
    );
  }

  Widget _buildThemeCard(ThemeCatalogItem theme) {
    final isActive = theme.slug == _activeThemeSlug || theme.active;
    final canInstall = !theme.installed && !isActive;

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: colors.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isActive ? AppColors.primary : colors.divider,
          width: isActive ? 1.5 : 1,
        ),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildThemeThumbnail(theme),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        theme.name,
                        style: TextStyle(
                          color: colors.textPrimary,
                          fontSize: 15,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                    if (isActive)
                      _StatusPill(text: 'Current', color: AppColors.primary)
                    else if (theme.installed)
                      _StatusPill(text: 'Installed', color: colors.success)
                    else if (theme.isPremium)
                      _StatusPill(text: 'Premium', color: colors.warning),
                  ],
                ),
                if (theme.description != null &&
                    theme.description!.isNotEmpty) ...[
                  const SizedBox(height: 6),
                  Text(
                    theme.description!,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(color: colors.textSecondary, fontSize: 12),
                  ),
                ],
                const SizedBox(height: 10),
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        theme.category ?? 'Storefront',
                        style: TextStyle(
                          color: colors.textTertiary,
                          fontSize: 11,
                        ),
                      ),
                    ),
                    TextButton.icon(
                      onPressed: canInstall && !_isBusy
                          ? () => _installTheme(theme)
                          : null,
                      icon: Icon(
                        canInstall
                            ? Icons.download_rounded
                            : Icons.check_circle_outline_rounded,
                        size: 16,
                      ),
                      label: Text(canInstall ? 'Install' : 'Ready'),
                      style: TextButton.styleFrom(
                        foregroundColor: canInstall
                            ? AppColors.primary
                            : colors.textSecondary,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildThemeThumbnail(ThemeCatalogItem theme) {
    return Container(
      width: 72,
      height: 86,
      decoration: BoxDecoration(
        color: colors.surfaceVariant,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: colors.divider),
      ),
      clipBehavior: Clip.antiAlias,
      child: theme.thumbnailUrl != null && theme.thumbnailUrl!.isNotEmpty
          ? CachedMerchantImage(
              imageUrl: theme.thumbnailUrl!,
              fit: BoxFit.cover,
            )
          : Icon(Icons.web_rounded, color: colors.textSecondary),
    );
  }

  Widget _buildEmptyState() {
    return Container(
      margin: const EdgeInsets.only(top: 16),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: colors.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: colors.divider),
      ),
      child: Column(
        children: [
          Icon(Icons.palette_outlined, color: colors.textSecondary, size: 32),
          const SizedBox(height: 8),
          Text(
            'No themes available',
            style: TextStyle(
              color: colors.textPrimary,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            'Refresh when the catalog service is available.',
            textAlign: TextAlign.center,
            style: TextStyle(color: colors.textSecondary, fontSize: 12),
          ),
        ],
      ),
    );
  }

  void _showMessage(
    String message, {
    bool isSuccess = false,
    bool isError = false,
  }) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: isError
            ? colors.error
            : (isSuccess ? colors.success : colors.card),
        behavior: SnackBarBehavior.floating,
        margin: const EdgeInsets.all(16),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
    );
  }
}

class _ActionChipButton extends StatelessWidget {
  final String label;
  final IconData icon;
  final VoidCallback? onTap;
  final bool enabled;
  final bool destructive;

  const _ActionChipButton({
    required this.label,
    required this.icon,
    this.onTap,
    this.enabled = true,
    this.destructive = false,
  });

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    final foreground = destructive ? colors.error : colors.textPrimary;
    return TextButton.icon(
      onPressed: enabled ? onTap : null,
      icon: Icon(icon, size: 16),
      label: Text(label),
      style: TextButton.styleFrom(
        backgroundColor: colors.surfaceVariant,
        foregroundColor: enabled ? foreground : colors.textTertiary,
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      ),
    );
  }
}

class _StatusPill extends StatelessWidget {
  final String text;
  final Color color;

  const _StatusPill({required this.text, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        text,
        style: TextStyle(
          color: color,
          fontSize: 10,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}
