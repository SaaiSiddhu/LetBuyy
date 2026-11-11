import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:provider/provider.dart';

import '../../app/store_context.dart';

import '../../models/store_model.dart';
import '../../models/theme_editor_models.dart';
import '../../services/theme_service.dart';
import '../../theme/app_theme_colors.dart';
import '../../widgets/editor/theme_artwork.dart';
import '../editor/section_editor_screen.dart';
import '../preview/live_preview_screen.dart';
import 'theme_versions_screen.dart';
import 'theme_marketplace_screen.dart';

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
  List<ThemeLibraryItem> _library = const [];
  String? _loadError;
  String? _libraryError;
  bool _isLoading = true;
  bool _isBusy = false;
  bool _showLibrary = false;
  Object? _ownedContext;
  int _loadGeneration = 0;
  late AppThemeColors colors;

  String get _activeThemeSlug =>
      _catalog?.currentTheme ??
      _store?.templateConfig?.themeId ??
      _store?.themeId ??
      'minimal_modern';

  String get _activeThemeName {
    final installed = _library.where((item) => item.slug == _activeThemeSlug);
    if (installed.isNotEmpty) return installed.first.name;
    if (_catalog?.currentThemeRecord != null)
      return _catalog!.currentThemeRecord!.name;
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
    setState(() {
      _isLoading = true;
      _loadError = null;
    });
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

      List<ThemeLibraryItem> library = const [];
      String? libraryError;
      try {
        library = await themeService.fetchLibrary(store.id);
      } catch (_) {
        libraryError =
            'The installed theme library could not load. Retry to confirm your saved designs.';
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
        _library = library;
        _libraryError = libraryError;
      });
    } catch (error) {
      if (mounted && generation == _loadGeneration) {
        setState(
          () => _loadError =
              'Themes could not load. Retry without changing your existing designs.',
        );
      }
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

  Future<void> _openMarketplace([ThemeCatalogItem? theme]) async {
    if (_store == null ||
        _isBusy ||
        _ownedContext != context.read<ThemeService>().captureContext())
      return;
    await Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => ThemeMarketplaceScreen(
          storeId: _store!.id,
          storeName: _store!.name,
          initialTheme: theme,
        ),
      ),
    );
    if (mounted) await _loadThemes();
  }

  Future<void> _publishTheme() {
    return _runThemeAction(() async {
      final service = context.read<ThemeService>();
      final store = _store!,
          slug = _activeThemeSlug,
          captured = service.captureContext();
      late final Map<String, dynamic> confirmed;
      if (service.hasPendingPublication(store.id, slug)) {
        confirmed = await service.recoverPublication(
          storeId: store.id,
          themeSlug: slug,
        );
      } else {
        final editor = _editorPayload;
        if (editor == null ||
            !editor.hasDraft ||
            editor.store['id'] != store.id ||
            editor.theme['slug'] != slug) {
          throw StateError(
            'Load and save this owned theme draft before publishing.',
          );
        }
        confirmed = await service.publish(
          storeId: store.id,
          themeSlug: slug,
          baseVersion: editor.version,
        );
      }
      if (!mounted ||
          service.captureContext() != captured ||
          _store?.id != store.id ||
          _activeThemeSlug != slug)
        return;
      _showMessage(
        service.hasPendingPublication(store.id, slug)
            ? 'Publication confirmed. Recover this request before publishing another draft.'
            : confirmed['current_version'] == confirmed['version']
            ? 'Publication confirmed'
            : 'The earlier publication is confirmed. Review the latest theme state before publishing again.',
        isSuccess: true,
      );
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

  void _openEditor({ThemeLibraryItem? installed}) {
    if (_store == null ||
        _isBusy ||
        _ownedContext != context.read<ThemeService>().captureContext())
      return;
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => SectionEditorScreen(
          themeSlug: installed?.slug,
          expectedInstanceId: installed?.instanceId,
          expectedPackageVersionId: installed?.packageVersionId,
          expectedStoreId: _store!.id,
        ),
      ),
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
                      if (_loadError != null) _buildReadError(_loadError!),
                      if (_loadError == null && _store != null)
                        _buildActiveThemePanel(),
                      if (_libraryError != null) ...[
                        const SizedBox(height: 16),
                        _buildReadError(_libraryError!),
                      ],
                      if (_showLibrary && _library.isNotEmpty) ...[
                        const SizedBox(height: 20),
                        _buildSectionHeader(
                          'Your theme library',
                          Icons.collections_bookmark_outlined,
                        ),
                        const SizedBox(height: 12),
                        ..._library
                            .where(
                              (item) =>
                                  item.status != 'deleted' &&
                                  item.status != 'archived',
                            )
                            .map(_buildLibraryCard),
                      ],
                      const SizedBox(height: 20),
                      _buildSectionHeader(
                        'Discover themes',
                        Icons.palette_outlined,
                      ),
                      Align(
                        alignment: Alignment.centerRight,
                        child: TextButton(
                          onPressed: _isBusy ? null : () => _openMarketplace(),
                          child: const Text('Explore all themes'),
                        ),
                      ),
                      const SizedBox(height: 12),
                      ...(_catalog?.themes ?? const <ThemeCatalogItem>[])
                          .take(5)
                          .map(_buildThemeCard),
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
        if (Navigator.canPop(context)) BackButton(color: colors.textPrimary),
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
    final theme =
        _catalog?.currentThemeRecord ??
        (activeTheme.isEmpty ? null : activeTheme.first);
    final installed = _library.where(
      (item) => item.slug == _activeThemeSlug && item.available,
    );
    final captured = installed.isEmpty ? null : installed.first;
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
          if (theme != null || captured != null) ...[
            ThemeArtwork(
              slug: _activeThemeSlug,
              name: captured?.name ?? theme!.name,
              version: captured?.version,
              thumbnailUrl: captured?.thumbnailUrl ?? theme?.thumbnailUrl,
              aspectRatio: 1.8,
            ),
            const SizedBox(height: 8),
            Text(
              'Theme artwork · Preview your saved design in the editor',
              style: TextStyle(color: colors.textSecondary, fontSize: 11),
            ),
            const SizedBox(height: 16),
          ],
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      captured?.name ?? theme?.name ?? _activeThemeSlug,
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
                          : _editorPayload?.release != null
                          ? 'Published design'
                          : _editorPayload != null
                          ? 'Current design'
                          : 'Draft status unavailable',
                      style: TextStyle(
                        color: colors.textSecondary,
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ),
              _StatusPill(
                text: hasDraft ? 'Saved draft' : 'Current theme',
                color: hasDraft ? colors.warning : colors.success,
              ),
            ],
          ),
          const SizedBox(height: 14),
          if (captured?.version != null) ...[
            Text(
              'Installed version ${captured!.version}',
              style: TextStyle(color: colors.textSecondary, fontSize: 12),
            ),
            const SizedBox(height: 12),
          ],
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              _ActionChipButton(
                label: 'Edit theme',
                icon: Icons.tune_rounded,
                onTap: () => _openEditor(installed: captured),
                enabled: !_isBusy && _editorPayload != null,
              ),
              _ActionChipButton(
                label: 'Manage themes',
                icon: Icons.collections_bookmark_outlined,
                onTap: () => setState(() => _showLibrary = !_showLibrary),
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

  Future<void> _installTheme(ThemeCatalogItem theme) => _runThemeAction(
    () async {
      final store = _store!, service = context.read<ThemeService>();
      final package = await service.loadCatalogPackage(theme.slug);
      final receipt = await service.installTheme(
        storeId: store.id,
        themeSlug: theme.slug,
        expectedVersion: theme.version,
        expectedPackageId: package['theme_package_id'] as String,
        expectedPackageVersionId: package['theme_package_version_id'] as String,
      );
      _showMessage(
        receipt.alreadyInstalled
            ? 'Theme confirmed in your library'
            : '${theme.name} added to your library',
        isSuccess: true,
      );
    },
  );

  Future<void> _demoCatalogTheme(ThemeCatalogItem theme) async {
    if (_isBusy ||
        theme.version == null ||
        _ownedContext != context.read<ThemeService>().captureContext())
      return;
    try {
      final url = ThemeService.buildCatalogDemoUrl(
        slug: theme.slug,
        version: theme.version!,
      );
      await Navigator.push(
        context,
        MaterialPageRoute(
          builder: (_) => LivePreviewScreen(
            storeUrl: url,
            storeName: '${theme.name} sample store',
            notice:
                'Version ${theme.version} · Sample content. Adding the theme does not import sample products.',
          ),
        ),
      );
    } catch (_) {
      if (mounted)
        _showMessage(
          'This demo could not be opened. Reload its catalog details.',
          isError: true,
        );
    }
  }

  Widget _buildThemeCard(ThemeCatalogItem theme) {
    final matches = _library.where(
      (item) => item.slug == theme.slug && item.available,
    );
    final installed = matches.isEmpty ? null : matches.first;
    final canAdd =
        theme.catalogActive &&
        theme.version != null &&
        theme.pricingType == 'free' &&
        theme.priceInr == 0;
    return Container(
      margin: const EdgeInsets.only(bottom: 20),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: colors.card,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: colors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          InkWell(
            onTap: _isBusy ? null : () => _openMarketplace(theme),
            child: ThemeArtwork(
              slug: theme.slug,
              name: theme.name,
              version: theme.version,
              thumbnailUrl: theme.thumbnailUrl,
            ),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: Text(
                  theme.name,
                  style: TextStyle(
                    color: colors.textPrimary,
                    fontSize: 20,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              if (theme.pricingType == 'free' && theme.priceInr == 0)
                _StatusPill(text: 'Free', color: colors.accent),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            '${theme.category ?? 'Storefront'} · ${theme.version ?? 'Version unavailable'}',
            style: TextStyle(color: colors.textSecondary, fontSize: 12),
          ),
          if (installed?.version != null) ...[
            const SizedBox(height: 6),
            Text(
              'In your library · ${installed!.version}',
              style: TextStyle(color: colors.textSecondary, fontSize: 12),
            ),
          ],
          const SizedBox(height: 12),
          Wrap(
            spacing: 12,
            runSpacing: 8,
            children: [
              OutlinedButton.icon(
                onPressed: _isBusy || theme.version == null
                    ? null
                    : () => _demoCatalogTheme(theme),
                icon: const Icon(Icons.visibility_outlined, size: 18),
                label: const Text('View demo'),
              ),
              if (installed != null)
                FilledButton(
                  onPressed: _isBusy || installed.packageVersionId == null
                      ? null
                      : () => _openEditor(installed: installed),
                  child: Text(
                    installed.version == theme.version
                        ? 'Customize'
                        : 'Customize installed version',
                  ),
                )
              else
                FilledButton(
                  onPressed: _isBusy || !canAdd
                      ? null
                      : () => _installTheme(theme),
                  child: const Text('Add'),
                ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildReadError(String message) => Container(
    padding: const EdgeInsets.all(16),
    decoration: BoxDecoration(
      color: colors.card,
      borderRadius: BorderRadius.circular(16),
      border: Border.all(color: colors.border),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(message, style: TextStyle(color: colors.textPrimary)),
        const SizedBox(height: 8),
        OutlinedButton.icon(
          onPressed: _isBusy ? null : _loadThemes,
          icon: const Icon(Icons.refresh),
          label: const Text('Retry loading themes'),
        ),
      ],
    ),
  );

  Widget _buildLibraryCard(ThemeLibraryItem item) => Container(
    margin: const EdgeInsets.only(bottom: 16),
    padding: const EdgeInsets.all(14),
    decoration: BoxDecoration(
      color: colors.card,
      borderRadius: BorderRadius.circular(16),
      border: Border.all(color: colors.divider),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        ThemeArtwork(
          slug: item.slug,
          name: item.name,
          version: item.version,
          thumbnailUrl: item.thumbnailUrl,
          aspectRatio: 1.8,
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: Text(
                item.name,
                style: TextStyle(
                  color: colors.textPrimary,
                  fontSize: 18,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
            _StatusPill(
              text: item.isCurrentlyPublished
                  ? 'Current theme'
                  : item.hasDraft
                  ? 'Saved draft'
                  : 'In your library',
              color: item.isCurrentlyPublished
                  ? colors.success
                  : colors.textSecondary,
            ),
          ],
        ),
        const SizedBox(height: 6),
        Text(
          item.version == null
              ? 'Installed version unavailable'
              : 'Installed version ${item.version}',
          style: TextStyle(color: colors.textSecondary, fontSize: 12),
        ),
        const SizedBox(height: 12),
        Align(
          alignment: Alignment.centerRight,
          child: FilledButton.icon(
            onPressed:
                !_isBusy &&
                    item.available &&
                    item.instanceId.isNotEmpty &&
                    item.packageVersionId != null
                ? () => _openEditor(installed: item)
                : null,
            icon: const Icon(Icons.tune, size: 18),
            label: const Text('Customize'),
          ),
        ),
      ],
    ),
  );

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
