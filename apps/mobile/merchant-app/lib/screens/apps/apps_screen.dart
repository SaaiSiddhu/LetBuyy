import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../app/store_context.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../services/app_marketplace_service.dart';
import '../../theme/app_theme_colors.dart';
import '../../theme/letbuyy_color_tokens.dart' as mobile_tokens;

class AppsScreen extends StatefulWidget {
  const AppsScreen({super.key});

  @override
  State<AppsScreen> createState() => _AppsScreenState();
}

class _AppsScreenState extends State<AppsScreen> {
  final _searchController = TextEditingController();

  List<MarketplaceAppContract> _apps = const [];
  List<AppCategoryContract> _categories = const [];
  List<InstalledAppContract> _installations = const [];
  String _category = 'all';
  String? _storeId;
  String? _error;
  String? _busyAppId;
  bool _isLoading = true;
  bool _installedOnly = false;

  late AppThemeColors colors;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      _storeId ??=
          (await context.read<StoreContext>().ensureSelectedStore())?.id;
      final service = context.read<AppMarketplaceService>();
      if (_storeId == null) {
        await service.fetchCategories();
        await service.fetchApps(search: _searchController.text);
      } else {
        await service.refresh(
          storeId: _storeId!,
          search: _searchController.text,
          category: _category,
        );
      }
      if (mounted) {
        setState(() {
          _categories = service.categories;
          _apps = service.apps;
          _installations = service.installations;
          _isLoading = false;
        });
      }
    } catch (error) {
      if (mounted) {
        setState(() {
          _error = error.toString();
          _isLoading = false;
        });
      }
    }
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
              _search(),
              _filters(),
              Expanded(child: _isLoading ? _loading() : _body()),
            ],
          ),
        ),
      ),
    );
  }

  Widget _header() {
    final installedCount = _installations.length;
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
                  'App Marketplace',
                  style: TextStyle(
                    color: colors.textPrimary,
                    fontSize: 22,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                Text(
                  '$installedCount installed apps',
                  style: TextStyle(color: colors.textSecondary, fontSize: 12),
                ),
              ],
            ),
          ),
          IconButton(
            tooltip: 'Refresh apps',
            icon: Icon(Icons.refresh_rounded, color: colors.textSecondary),
            onPressed: _load,
          ),
        ],
      ),
    );
  }

  Widget _search() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 6, 16, 4),
      child: TextField(
        controller: _searchController,
        textInputAction: TextInputAction.search,
        onSubmitted: (_) => _load(),
        decoration: InputDecoration(
          labelText: 'Search apps',
          prefixIcon: Icon(Icons.search_rounded, color: colors.textSecondary),
          suffixIcon: IconButton(
            tooltip: 'Search apps',
            icon: Icon(Icons.arrow_forward_rounded, color: colors.textPrimary),
            onPressed: _load,
          ),
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
      ),
    );
  }

  Widget _filters() {
    final filters = [
      _FilterOption('all', 'All'),
      _FilterOption('installed', 'Installed'),
      ..._categories.map((category) {
        final suffix = category.count > 0 ? ' ${category.count}' : '';
        return _FilterOption(category.slug, '${category.name}$suffix');
      }),
    ];

    return SizedBox(
      height: 50,
      child: ListView.separated(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
        scrollDirection: Axis.horizontal,
        itemBuilder: (context, index) {
          final filter = filters[index];
          final selected = filter.id == 'installed'
              ? _installedOnly
              : !_installedOnly && _category == filter.id;
          return ChoiceChip(
            selected: selected,
            onSelected: (_) {
              setState(() {
                _installedOnly = filter.id == 'installed';
                if (!_installedOnly) _category = filter.id;
              });
              if (!_installedOnly) _load();
            },
            label: Text(filter.label),
            backgroundColor: colors.card,
            selectedColor: mobile_tokens.LetbuyyColorTokens.brandPrimary
                .withValues(alpha: 0.16),
            side: BorderSide(
              color: selected
                  ? mobile_tokens.LetbuyyColorTokens.brandPrimary
                  : colors.cardBorder,
            ),
            labelStyle: TextStyle(
              color: selected
                  ? mobile_tokens.LetbuyyColorTokens.brandPrimary
                  : colors.textPrimary,
              fontWeight: FontWeight.w700,
            ),
          );
        },
        separatorBuilder: (_, __) => const SizedBox(width: 8),
        itemCount: filters.length,
      ),
    );
  }

  Widget _body() {
    if (_error != null) {
      return _centerState(
        Icons.error_outline_rounded,
        'Could not load apps',
        _error!,
      );
    }

    final visibleApps = _visibleApps();
    if (visibleApps.isEmpty) {
      return RefreshIndicator(
        color: mobile_tokens.LetbuyyColorTokens.brandPrimary,
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(24, 80, 24, 24),
          children: [
            _centerState(
              Icons.extension_outlined,
              _installedOnly ? 'No installed apps' : 'No apps found',
              _installedOnly
                  ? 'Install an app from the marketplace catalog.'
                  : 'Try another search or category.',
              compact: true,
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      color: mobile_tokens.LetbuyyColorTokens.brandPrimary,
      onRefresh: _load,
      child: ListView.builder(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 28),
        itemCount: visibleApps.length,
        itemBuilder: (context, index) => _appCard(visibleApps[index]),
      ),
    );
  }

  List<MarketplaceAppContract> _visibleApps() {
    if (_installedOnly) {
      return _installations.map((item) => item.app).toList(growable: false);
    }
    return _apps;
  }

  Widget _appCard(MarketplaceAppContract app) {
    final installed = context.read<AppMarketplaceService>().isInstalled(app.id);
    final installation = context.read<AppMarketplaceService>().installationFor(
      app.id,
    );
    final isBusy = _busyAppId == app.id;

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: colors.card,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: colors.cardBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _appIcon(app),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      app.name,
                      style: TextStyle(
                        color: colors.textPrimary,
                        fontSize: 16,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      app.developerName.isEmpty
                          ? app.categoryName
                          : app.developerName,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: colors.textSecondary,
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ),
              _statusPill(installed ? 'Installed' : app.pricingLabel),
            ],
          ),
          if (app.summary.isNotEmpty) ...[
            const SizedBox(height: 10),
            Text(
              app.summary,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(color: colors.textSecondary, height: 1.35),
            ),
          ],
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              _metaChip(Icons.category_outlined, app.categoryName),
              if (app.rating > 0)
                _metaChip(Icons.star_half_rounded, app.rating.toString()),
              _metaChip(
                Icons.download_outlined,
                '${app.installCount} installs',
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: FilledButton.icon(
                  onPressed: isBusy
                      ? null
                      : installed
                      ? () => _openInstalled(installation)
                      : () => _install(app),
                  icon: isBusy
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : Icon(
                          installed
                              ? Icons.open_in_new_rounded
                              : Icons.add_circle_outline_rounded,
                        ),
                  label: Text(installed ? 'Open' : 'Install'),
                  style: FilledButton.styleFrom(
                    backgroundColor:
                        mobile_tokens.LetbuyyColorTokens.brandPrimary,
                    foregroundColor: mobile_tokens.LetbuyyColorTokens.white,
                    minimumSize: const Size.fromHeight(44),
                  ),
                ),
              ),
              if (installed) ...[
                const SizedBox(width: 10),
                IconButton.filledTonal(
                  tooltip: 'Uninstall app',
                  onPressed: isBusy ? null : () => _uninstall(app),
                  icon: Icon(Icons.delete_outline_rounded, color: colors.error),
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }

  Widget _appIcon(MarketplaceAppContract app) {
    final letter = app.name.isEmpty ? 'A' : app.name.characters.first;
    return CircleAvatar(
      radius: 24,
      backgroundColor: mobile_tokens.LetbuyyColorTokens.brandPrimary.withValues(
        alpha: 0.14,
      ),
      child: Text(
        letter.toUpperCase(),
        style: TextStyle(
          color: mobile_tokens.LetbuyyColorTokens.brandPrimary,
          fontWeight: FontWeight.w900,
        ),
      ),
    );
  }

  Widget _statusPill(String label) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: colors.surfaceVariant,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: colors.cardBorder),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: colors.textPrimary,
          fontSize: 12,
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }

  Widget _metaChip(IconData icon, String label) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: colors.textSecondary),
          const SizedBox(width: 5),
          Text(
            label,
            style: TextStyle(
              color: colors.textSecondary,
              fontSize: 12,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _install(MarketplaceAppContract app) async {
    final storeId = _storeId;
    if (storeId == null) {
      _showSnack('Select a store before installing apps.');
      return;
    }

    setState(() => _busyAppId = app.id);
    try {
      final service = context.read<AppMarketplaceService>();
      await service.installApp(app: app, storeId: storeId);
      if (mounted) {
        setState(() => _installations = service.installations);
        _showSnack('${app.name} installed.');
      }
    } catch (error) {
      _showSnack('Could not install ${app.name}: $error');
    } finally {
      if (mounted) setState(() => _busyAppId = null);
    }
  }

  Future<void> _uninstall(MarketplaceAppContract app) async {
    final storeId = _storeId;
    if (storeId == null) return;

    setState(() => _busyAppId = app.id);
    try {
      final service = context.read<AppMarketplaceService>();
      await service.uninstallApp(app: app, storeId: storeId);
      if (mounted) {
        setState(() => _installations = service.installations);
        _showSnack('${app.name} uninstalled.');
      }
    } catch (error) {
      _showSnack('Could not uninstall ${app.name}: $error');
    } finally {
      if (mounted) setState(() => _busyAppId = null);
    }
  }

  Future<void> _openInstalled(InstalledAppContract? installation) async {
    if (installation == null) {
      _showSnack('Installation details are unavailable.');
      return;
    }

    setState(() => _busyAppId = installation.appId);
    try {
      final service = context.read<AppMarketplaceService>();
      final handoff = await service.createDesktopBridgeHandoff(
        installation: installation,
      );
      final url = handoff.url.isNotEmpty
          ? handoff.url
          : installation.app.appUrl;
      final uri = Uri.tryParse(url);
      if (uri == null) {
        _showSnack('App does not expose an admin URL.');
        return;
      }
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    } catch (error) {
      final appUrl = installation.app.appUrl;
      final uri = Uri.tryParse(appUrl);
      if (uri != null) {
        await launchUrl(uri, mode: LaunchMode.externalApplication);
        return;
      }
      _showSnack('Could not open ${installation.app.name}: $error');
    } finally {
      if (mounted) setState(() => _busyAppId = null);
    }
  }

  Widget _loading() {
    return Center(
      child: CircularProgressIndicator(
        color: mobile_tokens.LetbuyyColorTokens.brandPrimary,
      ),
    );
  }

  Widget _centerState(
    IconData icon,
    String title,
    String message, {
    bool compact = false,
  }) {
    return Center(
      child: Padding(
        padding: EdgeInsets.all(compact ? 8 : 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, color: colors.textTertiary, size: compact ? 36 : 44),
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
    if (!mounted) return;
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message)));
  }
}

class _FilterOption {
  const _FilterOption(this.id, this.label);

  final String id;
  final String label;
}
