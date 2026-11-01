import '../../widgets/shared/warehouse_command_recovery.dart';
import 'package:letbuyy_models/letbuyy_models.dart'
    show warehouseOptionStatuses;
import '../../widgets/shared/warehouse_list_filters.dart';
import '../../services/api_client.dart' show ApiException;
import '../../widgets/shared/merchant_store_view.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../app/store_context.dart';

import '../../services/inventory_service.dart';
import '../../theme/app_theme_colors.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart' as mobile_tokens;

class InventoryLocationsScreen extends StatefulWidget {
  const InventoryLocationsScreen({super.key});

  @override
  State<InventoryLocationsScreen> createState() =>
      _InventoryLocationsScreenState();
}

class _InventoryLocationsScreenState extends State<InventoryLocationsScreen> {
  List<InventoryLocationContract> _locations = const [];
  bool _isLoading = true;
  String? _storeId;
  String? _error;
  Object? _viewKey;
  int _readGeneration = 0;
  int _page = 1;
  String _search = '', _status = '', _sort = 'name_asc';
  bool get _filtered => _search.isNotEmpty || _status.isNotEmpty;
  int? _total;
  bool _more = false;
  bool _warehouseReady = false, _warehouseBusy = false;
  MerchantStoreView? get _view =>
      _storeId == null ? null : (key: _viewKey, storeId: _storeId!);
  bool _matches(MerchantStoreView? view) =>
      merchantStoreViewCurrent(context, view);

  late AppThemeColors colors;

  @override
  void initState() {
    super.initState();
    _viewKey = context.read<StoreContext>().requestContextKey;
    _load();
  }

  Future<void> _load() async {
    if (!mounted) return;
    final generation = ++_readGeneration;
    setState(() {
      _isLoading = true;
      _error = null;
      _total = null;
      _more = false;
      _locations = [];
    });
    final stores = context.read<StoreContext>();
    try {
      await stores.ensureSelectedStore();
      if (!mounted || generation != _readGeneration) return;
      _viewKey = stores.requestContextKey;
      _storeId = stores.selectedStoreId;
      final view = _view;
      if (view == null) {
        setState(() {
          _isLoading = false;
          _error = 'Select a store to continue.';
        });
        return;
      }
      final service = context.read<InventoryService>();
      final rows = await service.fetchLocations(
        view.storeId,
        page: _page,
        search: _search.isEmpty ? null : _search,
        status: _status.isEmpty ? 'all' : _status,
        sort: _sort,
      );
      if (!_matches(view) || generation != _readGeneration) return;
      setState(() {
        _locations = rows;
        _total = service.locationsTotal;
        _more = service.locationsHasMore;
        _isLoading = false;
      });
    } catch (error) {
      if (!mounted || generation != _readGeneration) return;
      if (_viewKey != stores.requestContextKey &&
          stores.selectedStoreId != null)
        return;
      if (_viewKey != stores.requestContextKey &&
          error is ApiException &&
          error.code == 'SESSION_CONTEXT_CHANGED')
        return;
      setState(() {
        _viewKey = stores.requestContextKey;
        _storeId = stores.selectedStoreId;
        _locations = [];
        _error =
            'Check your connection and current store permissions, then refresh.';
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    colors = AppThemeColors.of(context);
    final stores = context.watch<StoreContext>();
    if (_viewKey != stores.requestContextKey) {
      _viewKey = stores.requestContextKey;
      ++_readGeneration;
      _storeId = null;
      _page = 1;
      _warehouseReady = false;
      _warehouseBusy = false;
      _search = '';
      _status = '';
      _sort = 'name_asc';
      _total = null;
      _more = false;
      _locations = [];
      _error = null;
      _isLoading = true;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _load();
      });
    }

    return Scaffold(
      backgroundColor: colors.bgStart,
      floatingActionButton: FloatingActionButton.extended(
        onPressed:
            !_warehouseReady ||
                _warehouseBusy ||
                _storeId == null ||
                _isLoading ||
                _error != null
            ? null
            : _createLocation,
        backgroundColor: mobile_tokens.LetbuyyColorTokens.brandPrimary,
        foregroundColor: Colors.white,
        icon: const Icon(Icons.add_location_alt_outlined),
        label: const Text('New location'),
      ),
      body: Container(
        decoration: colors.backgroundGradient,
        child: SafeArea(
          child: Column(
            children: [
              _header(),
              if (_view != null)
                WarehouseCommandRecovery(
                  view: _view!,
                  onReady: (ready) {
                    if (mounted && _warehouseReady != ready)
                      setState(() => _warehouseReady = ready);
                  },
                  onResolved: _load,
                ),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: Align(
                  alignment: Alignment.centerLeft,
                  child: TextButton.icon(
                    onPressed: _storeId == null ? null : _filter,
                    icon: const Icon(Icons.filter_list),
                    label: Text(
                      _search.isEmpty && _status.isEmpty && _sort == 'name_asc'
                          ? 'Filter and sort'
                          : 'Filters applied · Edit',
                    ),
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: Row(
                  children: [
                    IconButton(
                      tooltip: 'Previous page',
                      onPressed: _isLoading || _page == 1
                          ? null
                          : () {
                              setState(() => _page--);
                              _load();
                            },
                      icon: const Icon(Icons.chevron_left),
                    ),
                    Expanded(
                      child: Text(
                        _total == null
                            ? 'Page $_page · Count unavailable'
                            : '$_total matching records · Page $_page',
                        textAlign: TextAlign.center,
                      ),
                    ),
                    IconButton(
                      tooltip: 'Next page',
                      onPressed: _isLoading || !_more
                          ? null
                          : () {
                              setState(() => _page++);
                              _load();
                            },
                      icon: const Icon(Icons.chevron_right),
                    ),
                  ],
                ),
              ),
              Expanded(child: _isLoading ? _loading() : _body()),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _filter() async {
    final view = _view;
    if (!_matches(view)) return;
    final result = await showWarehouseListFilters(
      context,
      view: view!,
      initial: (search: _search, status: _status, sort: _sort),
      statuses: warehouseOptionStatuses,
      documents: false,
    );
    if (!_matches(view) || result == null) return;
    setState(() {
      _search = result.search;
      _status = result.status;
      _sort = result.sort;
      _page = 1;
    });
    _load();
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
                  'Locations',
                  style: TextStyle(
                    color: colors.textPrimary,
                    fontSize: 22,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                Text(
                  'Warehouses, stores, and fulfillment points',
                  style: TextStyle(color: colors.textSecondary, fontSize: 12),
                ),
              ],
            ),
          ),
          IconButton(
            tooltip: 'Refresh locations',
            icon: Icon(Icons.refresh_rounded, color: colors.textSecondary),
            onPressed: _load,
          ),
        ],
      ),
    );
  }

  Widget _body() {
    if (_error != null) {
      return _centerState(
        Icons.error_outline_rounded,
        'Could not load locations',
        _error!,
      );
    }
    if (_locations.isEmpty) {
      return _centerState(
        Icons.warehouse_outlined,
        _filtered
            ? 'No matching locations'
            : (_page == 1 ? 'No locations yet' : 'No records on this page'),
        _filtered
            ? 'Clear or change the filters to find other records.'
            : 'Add a warehouse or retail location before receiving stock.',
      );
    }

    return RefreshIndicator(
      color: mobile_tokens.LetbuyyColorTokens.brandPrimary,
      onRefresh: _load,
      child: ListView.builder(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 96),
        itemCount: _locations.length,
        itemBuilder: (context, index) {
          final location = _locations[index];
          return _card(
            icon: Icons.warehouse_outlined,
            title: location.name,
            subtitle: location.locality,
            trailing: location.isDefault ? 'Default' : location.status,
          );
        },
      ),
    );
  }

  Widget _card({
    required IconData icon,
    required String title,
    required String subtitle,
    required String trailing,
  }) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: colors.card,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: colors.cardBorder),
      ),
      child: Row(
        children: [
          Icon(icon, color: mobile_tokens.LetbuyyColorTokens.brandPrimary),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: TextStyle(
                    color: colors.textPrimary,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  subtitle,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(color: colors.textSecondary, fontSize: 12),
                ),
              ],
            ),
          ),
          _statusChip(trailing),
        ],
      ),
    );
  }

  Widget _statusChip(String label) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: mobile_tokens.LetbuyyColorTokens.brandPrimary.withValues(
          alpha: 0.12,
        ),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: mobile_tokens.LetbuyyColorTokens.brandPrimary,
          fontSize: 12,
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }

  Future<void> _createLocation() async {
    final view = _view;
    if (!_matches(view) || !_warehouseReady || _warehouseBusy) return;
    final input = await showModalBottomSheet<InventoryLocationInput>(
      context: context,
      isScrollControlled: true,
      backgroundColor: colors.card,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(22)),
      ),
      builder: (_) => guardMerchantStoreView(
        view,
        _LocationForm(storeId: view!.storeId, colors: colors),
      ),
    );
    if (input == null || !_matches(view) || input.storeId != view!.storeId)
      return;

    if (!_warehouseReady || _warehouseBusy) return;
    setState(() => _warehouseBusy = true);
    try {
      await context.read<InventoryService>().createLocation(input);
      if (_matches(view)) {
        _showSnackBar('Location created');
        _load();
      }
    } catch (error) {
      if (_matches(view))
        _showSnackBar(
          'The outcome could not be confirmed. Recover the saved original warehouse request before trying again.',
          isError: true,
        );
    } finally {
      if (_matches(view)) setState(() => _warehouseBusy = false);
    }
  }

  Widget _loading() {
    return Center(
      child: CircularProgressIndicator(
        color: mobile_tokens.LetbuyyColorTokens.brandPrimary,
      ),
    );
  }

  Widget _centerState(IconData icon, String title, String subtitle) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, color: colors.textTertiary, size: 48),
            const SizedBox(height: 12),
            Text(
              title,
              style: TextStyle(
                color: colors.textPrimary,
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              subtitle,
              textAlign: TextAlign.center,
              style: TextStyle(color: colors.textSecondary),
            ),
          ],
        ),
      ),
    );
  }

  void _showSnackBar(String message, {bool isError = false}) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: isError ? colors.error : colors.success,
        behavior: SnackBarBehavior.floating,
      ),
    );
  }
}

class _LocationForm extends StatefulWidget {
  const _LocationForm({required this.storeId, required this.colors});

  final String storeId;
  final AppThemeColors colors;

  @override
  State<_LocationForm> createState() => _LocationFormState();
}

class _LocationFormState extends State<_LocationForm> {
  final _name = TextEditingController();
  final _address = TextEditingController();
  final _city = TextEditingController();
  final _state = TextEditingController();
  final _country = TextEditingController(text: 'IN');
  bool _isDefault = false;

  @override
  void dispose() {
    _name.dispose();
    _address.dispose();
    _city.dispose();
    _state.dispose();
    _country.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = widget.colors;
    return Padding(
      padding: EdgeInsets.fromLTRB(
        18,
        18,
        18,
        MediaQuery.of(context).viewInsets.bottom + 18,
      ),
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'New location',
              style: TextStyle(
                color: colors.textPrimary,
                fontSize: 18,
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: 14),
            _field(_name, 'Name'),
            _field(_address, 'Address'),
            Row(
              children: [
                Expanded(child: _field(_city, 'City')),
                const SizedBox(width: 10),
                Expanded(child: _field(_state, 'State')),
              ],
            ),
            _field(_country, 'Country code'),
            SwitchListTile.adaptive(
              value: _isDefault,
              activeColor: mobile_tokens.LetbuyyColorTokens.brandPrimary,
              contentPadding: EdgeInsets.zero,
              title: Text(
                'Default receiving location',
                style: TextStyle(color: colors.textPrimary),
              ),
              onChanged: (value) => setState(() => _isDefault = value),
            ),
            const SizedBox(height: 10),
            FilledButton.icon(
              onPressed: () {
                if (_name.text.trim().isEmpty) return;
                Navigator.pop(
                  context,
                  InventoryLocationInput(
                    storeId: widget.storeId,
                    name: _name.text,
                    address: _address.text,
                    city: _city.text,
                    state: _state.text,
                    country: _country.text,
                    isDefault: _isDefault,
                  ),
                );
              },
              icon: const Icon(Icons.save_outlined),
              label: const Text('Create location'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _field(TextEditingController controller, String label) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: TextField(
        controller: controller,
        style: TextStyle(color: widget.colors.textPrimary),
        decoration: InputDecoration(labelText: label),
      ),
    );
  }
}
