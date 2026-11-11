import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../app/store_context.dart';
import '../../models/theme_editor_models.dart';
import '../../services/theme_service.dart';
import '../../theme/app_theme_colors.dart';
import '../../widgets/editor/theme_artwork.dart';
import '../editor/section_editor_screen.dart';
import '../preview/live_preview_screen.dart';

/// Native presentation of the existing catalog, package and owned-library APIs.
/// The actual preview continues to use Commerce's canonical Liquid renderer.
class ThemeMarketplaceScreen extends StatefulWidget {
  const ThemeMarketplaceScreen({
    super.key,
    required this.storeId,
    required this.storeName,
    this.initialTheme,
  });
  final String storeId, storeName;
  final ThemeCatalogItem? initialTheme;
  @override
  State<ThemeMarketplaceScreen> createState() => _ThemeMarketplaceScreenState();
}

class _ThemeMarketplaceScreenState extends State<ThemeMarketplaceScreen> {
  final _search = TextEditingController();
  ThemeCatalogResponse? _catalog;
  ThemeCatalogItem? _selected;
  Map<String, dynamic>? _package;
  ThemeInstallReceipt? _confirmed;
  Object? _ownedContext;
  String? _error, _detailError, _installError;
  bool _loading = true, _detailLoading = false, _installing = false;
  int _generation = 0, _detailGeneration = 0, _page = 1;
  String _sort = 'portfolio', _category = '';
  List<String> _categories = const [];
  bool _categoriesUnavailable = false;
  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _generation++;
    _detailGeneration++;
    _search.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    final generation = ++_generation;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final service = context.read<ThemeService>();
      final store = await context.read<StoreContext>().ensureSelectedStore();
      if (store?.id != widget.storeId)
        throw StateError(
          'The selected store changed. Return to its theme library.',
        );
      final captured = service.captureContext();
      final catalog = await service.fetchThemes(
        widget.storeId,
        search: _search.text.trim(),
        category: _category.isEmpty ? null : _category,
        sort: _sort,
        page: _page,
        limit: 12,
      );
      List<String> categories = const [];
      var categoriesUnavailable = false;
      try {
        categories = await service.fetchCatalogCategories();
      } catch (_) {
        categoriesUnavailable = true;
      }
      if (!mounted ||
          generation != _generation ||
          service.captureContext() != captured)
        return;
      setState(() {
        _catalog = catalog;
        _categories = categories;
        _categoriesUnavailable = categoriesUnavailable;
        _ownedContext = captured;
        _loading = false;
      });
      if (widget.initialTheme != null &&
          _selected == null &&
          _detailGeneration == 0) {
        await _select(widget.initialTheme!);
      }
    } catch (_) {
      if (mounted && generation == _generation)
        setState(() {
          _error =
              'The theme catalog could not load for this store. Your existing designs are unchanged.';
          _loading = false;
        });
    }
  }

  Future<void> _select(ThemeCatalogItem theme) async {
    final service = context.read<ThemeService>(),
        captured = service.captureContext();
    if (_ownedContext != captured) return;
    final generation = ++_detailGeneration;
    setState(() {
      _selected = theme;
      _package = null;
      _confirmed = null;
      _detailError = null;
      _installError = null;
      _detailLoading = true;
    });
    try {
      final package = await service.loadCatalogPackage(theme.slug);
      if (!mounted ||
          generation != _detailGeneration ||
          service.captureContext() != captured)
        return;
      setState(() {
        _package = package;
        _detailLoading = false;
      });
    } catch (_) {
      if (mounted && generation == _detailGeneration)
        setState(() {
          _detailError =
              'The exact package version could not be confirmed. You can explore the sample store while retrying.';
          _detailLoading = false;
        });
    }
  }

  Future<void> _install() async {
    final theme = _selected,
        package = _package,
        service = context.read<ThemeService>();
    if (theme == null || package == null || _installing || !_canAdd(theme))
      return;
    final captured = service.captureContext(), generation = _detailGeneration;
    if (captured != _ownedContext) return;
    setState(() {
      _installing = true;
      _installError = null;
    });
    try {
      final receipt = await service.installTheme(
        storeId: widget.storeId,
        themeSlug: theme.slug,
        expectedVersion: theme.version,
        expectedPackageId: package['theme_package_id'] as String,
        expectedPackageVersionId: package['theme_package_version_id'] as String,
      );
      if (!mounted ||
          generation != _detailGeneration ||
          service.captureContext() != captured)
        return;
      setState(() => _confirmed = receipt);
    } catch (error) {
      if (mounted &&
          generation == _detailGeneration &&
          service.captureContext() == captured) {
        setState(() => _installError = error.toString());
      }
    } finally {
      if (mounted && generation == _detailGeneration)
        setState(() => _installing = false);
    }
  }

  bool _canAdd(ThemeCatalogItem theme) =>
      theme.catalogActive &&
      theme.version != null &&
      theme.version!.isNotEmpty &&
      theme.pricingType == 'free' &&
      theme.priceInr == 0;

  Future<void> _demo(ThemeCatalogItem theme) async {
    if (theme.version == null ||
        _ownedContext != context.read<ThemeService>().captureContext())
      return;
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
              'Version ${theme.version} · Sample content. Adding this theme does not import sample products.',
        ),
      ),
    );
  }

  Future<void> _customize() async {
    final confirmed = _confirmed;
    if (confirmed == null ||
        _ownedContext != context.read<ThemeService>().captureContext())
      return;
    await Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => SectionEditorScreen(
          themeSlug: confirmed.slug,
          expectedInstanceId: confirmed.instanceId,
          expectedPackageVersionId: confirmed.packageVersionId,
          expectedStoreId: widget.storeId,
        ),
      ),
    );
  }

  void _backToResults() {
    if (_installing) return;
    _detailGeneration++;
    setState(() {
      _selected = null;
      _package = null;
      _confirmed = null;
      _installError = null;
      _detailError = null;
    });
  }

  @override
  Widget build(BuildContext context) {
    context.watch<StoreContext>();
    final colors = AppThemeColors.of(context);
    final retired =
        _ownedContext != null &&
        _ownedContext != context.read<ThemeService>().captureContext();
    return PopScope(
      canPop: _selected == null && !_installing,
      onPopInvokedWithResult: (didPop, result) {
        if (!didPop && !_installing) _backToResults();
      },
      child: Scaffold(
        backgroundColor: colors.bgStart,
        appBar: AppBar(
          title: Text(_selected?.name ?? 'Explore themes'),
          leading: BackButton(
            onPressed: _installing
                ? null
                : () => _selected == null
                      ? Navigator.pop(context)
                      : _backToResults(),
          ),
        ),
        body: retired
            ? Center(
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Text(
                    'The active account or store changed. Return to its theme library.',
                    style: TextStyle(color: colors.textPrimary),
                  ),
                ),
              )
            : _selected != null
            ? _detail(colors, _selected!)
            : _results(colors),
      ),
    );
  }

  Widget _results(AppThemeColors colors) => RefreshIndicator(
    onRefresh: _load,
    child: ListView(
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 32),
      children: [
        Text(
          'A storefront that fits your business.',
          style: TextStyle(
            color: colors.textPrimary,
            fontSize: 26,
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: 8),
        Text(
          'Explore the same LetBuyy designs as web. Browse a sample, then make it your own.',
          style: TextStyle(color: colors.textSecondary),
        ),
        const SizedBox(height: 20),
        TextField(
          controller: _search,
          maxLength: 120,
          textInputAction: TextInputAction.search,
          decoration: const InputDecoration(
            labelText: 'Search themes',
            hintText: 'Theme name or catalog type',
            prefixIcon: Icon(Icons.search),
          ),
          onSubmitted: (_) {
            _page = 1;
            _load();
          },
        ),
        const SizedBox(height: 12),
        Wrap(
          spacing: 12,
          runSpacing: 12,
          children: [
            DropdownButton<String>(
              value: _category,
              hint: const Text('Catalog type'),
              items: [
                const DropdownMenuItem(
                  value: '',
                  child: Text('All categories'),
                ),
                for (final key in {
                  ..._categories,
                  if (_category.isNotEmpty) _category,
                }.where((value) => value.isNotEmpty))
                  DropdownMenuItem(
                    value: key,
                    child: Text(key[0].toUpperCase() + key.substring(1)),
                  ),
              ],
              onChanged: _loading
                  ? null
                  : (value) {
                      setState(() => _category = value ?? '');
                      _page = 1;
                      _load();
                    },
            ),
            DropdownButton<String>(
              value: _sort,
              items: const [
                DropdownMenuItem(
                  value: 'portfolio',
                  child: Text('Portfolio order'),
                ),
                DropdownMenuItem(value: 'name', child: Text('Name, A–Z')),
                DropdownMenuItem(value: 'new', child: Text('Newest')),
              ],
              onChanged: _loading
                  ? null
                  : (value) {
                      setState(() => _sort = value ?? 'portfolio');
                      _page = 1;
                      _load();
                    },
            ),
            OutlinedButton(
              onPressed: _loading
                  ? null
                  : () {
                      _page = 1;
                      _load();
                    },
              child: const Text('Search'),
            ),
          ],
        ),
        const SizedBox(height: 16),
        if (_categoriesUnavailable)
          _message(
            colors,
            'Catalog type filters are temporarily unavailable. Search and sort are still available.',
            retry: _load,
          ),
        if (_error != null)
          _message(colors, _error!, retry: _load)
        else if (_loading)
          const Padding(
            padding: EdgeInsets.all(32),
            child: Center(child: CircularProgressIndicator()),
          )
        else if (_catalog?.themes.isEmpty ?? true)
          _message(
            colors,
            'No themes match. Clear the filters to browse all designs.',
            retry: () {
              _search.clear();
              _category = '';
              _sort = 'portfolio';
              _page = 1;
              _load();
            },
          )
        else ...[
          Text(
            _catalog!.total == null
                ? 'Theme results'
                : '${_catalog!.total} themes',
            style: TextStyle(color: colors.textSecondary),
          ),
          const SizedBox(height: 12),
          ..._catalog!.themes.map((theme) => _catalogCard(colors, theme)),
          if (_page > 1 || _catalog!.hasMore)
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                OutlinedButton(
                  onPressed: _page > 1
                      ? () {
                          _page--;
                          _load();
                        }
                      : null,
                  child: const Text('Previous'),
                ),
                Text(
                  'Page $_page',
                  style: TextStyle(color: colors.textSecondary),
                ),
                OutlinedButton(
                  onPressed: _catalog!.hasMore
                      ? () {
                          _page++;
                          _load();
                        }
                      : null,
                  child: const Text('Next'),
                ),
              ],
            ),
        ],
      ],
    ),
  );

  Widget _catalogCard(
    AppThemeColors colors,
    ThemeCatalogItem theme,
  ) => Container(
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
          onTap: () => _select(theme),
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
                  fontWeight: FontWeight.w700,
                  fontSize: 22,
                ),
              ),
            ),
            Text(
              _price(theme),
              style: TextStyle(
                color: colors.accent,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
        const SizedBox(height: 6),
        Text(
          'LetBuyy · ${theme.category ?? 'Storefront'} · ${theme.version ?? 'Version unavailable'}',
          style: TextStyle(color: colors.textSecondary, fontSize: 12),
        ),
        if (theme.description?.isNotEmpty ?? false) ...[
          const SizedBox(height: 12),
          Text(
            theme.description!,
            style: TextStyle(color: colors.textSecondary),
          ),
        ],
        const SizedBox(height: 12),
        Wrap(
          spacing: 16,
          runSpacing: 8,
          children: [
            TextButton(
              onPressed: () => _select(theme),
              child: const Text('Explore theme'),
            ),
            TextButton.icon(
              onPressed: theme.version == null ? null : () => _demo(theme),
              icon: const Icon(Icons.visibility_outlined, size: 18),
              label: const Text('View demo'),
            ),
            if (theme.installed) const Chip(label: Text('In your library')),
          ],
        ),
      ],
    ),
  );

  Widget _detail(AppThemeColors colors, ThemeCatalogItem theme) => ListView(
    padding: const EdgeInsets.fromLTRB(20, 12, 20, 32),
    children: [
      ThemeArtwork(
        slug: theme.slug,
        name: theme.name,
        version: theme.version,
        thumbnailUrl: theme.thumbnailUrl,
      ),
      const SizedBox(height: 20),
      Text(
        'Designed by LetBuyy',
        style: TextStyle(color: colors.textSecondary),
      ),
      const SizedBox(height: 6),
      Text(
        theme.name,
        style: TextStyle(
          color: colors.textPrimary,
          fontSize: 28,
          fontWeight: FontWeight.w700,
        ),
      ),
      const SizedBox(height: 8),
      Text(
        '${_price(theme)} · Version ${theme.version ?? 'unavailable'}',
        style: TextStyle(color: colors.textSecondary),
      ),
      if (theme.description != null) ...[
        const SizedBox(height: 16),
        Text(theme.description!, style: TextStyle(color: colors.textPrimary)),
      ],
      const SizedBox(height: 20),
      Wrap(
        spacing: 12,
        runSpacing: 12,
        children: [
          OutlinedButton.icon(
            onPressed: theme.version == null ? null : () => _demo(theme),
            icon: const Icon(Icons.visibility_outlined),
            label: const Text('View demo'),
          ),
          FilledButton(
            onPressed:
                !_detailLoading &&
                    _package != null &&
                    !_installing &&
                    _canAdd(theme)
                ? _install
                : null,
            child: Text(_installing ? 'Confirming library…' : 'Add to library'),
          ),
        ],
      ),
      const SizedBox(height: 12),
      Text(
        'Add to ${widget.storeName}. Your live theme, products and existing drafts stay in place.',
        style: TextStyle(color: colors.textSecondary),
      ),
      if (_detailLoading)
        const Padding(
          padding: EdgeInsets.all(20),
          child: Center(child: CircularProgressIndicator()),
        ),
      if (_detailError != null) ...[
        const SizedBox(height: 16),
        _message(colors, _detailError!, retry: () => _select(theme)),
      ],
      if (!_canAdd(theme)) ...[
        const SizedBox(height: 12),
        Text(
          'Acquisition is unavailable for this version. No payment will be attempted.',
          style: TextStyle(color: colors.textSecondary),
        ),
      ],
      if (_installError != null) ...[
        const SizedBox(height: 16),
        _message(
          colors,
          'Add has not been confirmed. $_installError',
          retry: _installing ? null : _install,
        ),
      ],
      if (_confirmed != null) ...[
        const SizedBox(height: 20),
        _message(
          colors,
          _confirmed!.alreadyInstalled
              ? 'Theme confirmed in your library'
              : 'Theme added to your library',
        ),
        const SizedBox(height: 8),
        FilledButton.icon(
          onPressed: _customize,
          icon: const Icon(Icons.tune),
          label: const Text('Customize theme'),
        ),
      ],
      const SizedBox(height: 28),
      Text(
        'Make it your own',
        style: TextStyle(
          color: colors.textPrimary,
          fontSize: 20,
          fontWeight: FontWeight.w700,
        ),
      ),
      const SizedBox(height: 8),
      Text(
        'Use your products, photography, navigation and content. The demo contains sample merchandise; adding the theme does not import it.',
        style: TextStyle(color: colors.textSecondary),
      ),
      const SizedBox(height: 24),
      Text(
        'Theme features',
        style: TextStyle(
          color: colors.textPrimary,
          fontSize: 20,
          fontWeight: FontWeight.w700,
        ),
      ),
      const SizedBox(height: 8),
      if (theme.features.isEmpty)
        Text(
          'Detailed feature metadata has not been recorded for this version. Explore the actual demo before choosing.',
          style: TextStyle(color: colors.textSecondary),
        )
      else
        ...theme.features.map(
          (feature) => Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Text(
              '• $feature',
              style: TextStyle(color: colors.textPrimary),
            ),
          ),
        ),
    ],
  );

  String _price(ThemeCatalogItem theme) =>
      theme.pricingType == 'free' && theme.priceInr == 0
      ? 'Free'
      : theme.isPremium
      ? 'Premium'
      : 'See availability';
  Widget _message(
    AppThemeColors colors,
    String message, {
    VoidCallback? retry,
  }) => Container(
    padding: const EdgeInsets.all(16),
    decoration: BoxDecoration(
      color: colors.card,
      border: Border.all(color: colors.border),
      borderRadius: BorderRadius.circular(14),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(message, style: TextStyle(color: colors.textPrimary)),
        if (retry != null) ...[
          const SizedBox(height: 8),
          OutlinedButton(onPressed: retry, child: const Text('Retry')),
        ],
      ],
    ),
  );
}
