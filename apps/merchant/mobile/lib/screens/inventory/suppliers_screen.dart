import '../../widgets/shared/warehouse_list_scaffold.dart';
import '../../widgets/shared/warehouse_command_recovery.dart';
import 'package:letbuyy_models/letbuyy_models.dart'
    show warehouseOptionStatuses, WarehouseCommandIntent;
import '../../widgets/shared/warehouse_list_filters.dart';
import '../../services/api_client.dart' show ApiException;
import '../../widgets/shared/merchant_store_view.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../app/store_context.dart';

import '../../services/inventory_service.dart';
import '../../theme/app_theme_colors.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart' as mobile_tokens;

class InventorySuppliersScreen extends StatefulWidget {
  const InventorySuppliersScreen({super.key});

  @override
  State<InventorySuppliersScreen> createState() =>
      _InventorySuppliersScreenState();
}

class _InventorySuppliersScreenState extends State<InventorySuppliersScreen> {
  List<InventorySupplierContract> _suppliers = const [];
  bool _isLoading = true;
  String? _storeId;
  String? _error;
  Object? _viewKey, _loadedQuery;
  Object get _query => (_viewKey, _storeId, _page, _search, _status, _sort);
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
      mounted && merchantStoreViewCurrent(context, view);

  late AppThemeColors colors;

  @override
  void initState() {
    super.initState();
    _viewKey = context.read<StoreContext>().requestContextKey;
    _load();
  }

  Future<void> _load({bool retain = false}) async {
    if (!mounted) return;
    final keep = retain && _loadedQuery == _query && _matches(_view);
    final generation = ++_readGeneration;
    setState(() {
      _isLoading = true;
      _error = null;
      if (!keep) {
        _total = null;
        _more = false;
        _suppliers = [];
        _loadedQuery = null;
      }
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
      final query = _query;
      final service = context.read<InventoryService>();
      final rows = await service.fetchSuppliers(
        view.storeId,
        page: _page,
        search: _search.isEmpty ? null : _search,
        status: _status.isEmpty ? 'all' : _status,
        sort: _sort,
      );
      if (!_matches(view) || generation != _readGeneration) return;
      setState(() {
        _suppliers = rows;
        _loadedQuery = query;
        _total = service.suppliersTotal;
        _more = service.suppliersHasMore;
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
        if (!keep ||
            error is ApiException && [401, 403].contains(error.statusCode)) {
          _suppliers = [];
          _total = null;
          _more = false;
          _loadedQuery = null;
        }
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
      _loadedQuery = null;
      _storeId = null;
      _page = 1;
      _warehouseReady = false;
      _warehouseBusy = false;
      _search = '';
      _status = '';
      _sort = 'name_asc';
      _total = null;
      _more = false;
      _suppliers = [];
      _error = null;
      _isLoading = true;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _load();
      });
    }
    final view = _view, generation = _readGeneration;
    bool current() =>
        mounted &&
        _matches(view) &&
        generation == _readGeneration &&
        mobile_tokens.isLetbuyySurfaceCurrent(context);
    final canRefresh = !_isLoading;
    final readKey = stores.requestContextKey;
    bool currentRead() =>
        mounted &&
        generation == _readGeneration &&
        context.read<StoreContext>().requestContextKey == readKey &&
        mobile_tokens.isLetbuyySurfaceCurrent(context);
    return WarehouseListScaffold(
      scrollIdentity: _query,
      title: 'Suppliers',
      description: 'Vendors used for replenishment and purchase orders',
      refreshLabel: 'Refresh suppliers',
      loading: _isLoading,
      onRefresh: canRefresh
          ? () async {
              if (currentRead() && !_isLoading) await _load(retain: true);
            }
          : null,
      action: FilledButton.icon(
        onPressed:
            !_warehouseReady ||
                _warehouseBusy ||
                _storeId == null ||
                _isLoading ||
                _error != null
            ? null
            : () {
                if (current()) _createSupplier();
              },
        icon: const Icon(Icons.person_add_alt_1_outlined),
        label: const Text('New supplier'),
      ),
      header: [
        if (view != null)
          WarehouseCommandRecovery(
            view: view,
            onReady: (ready) {
              if (_matches(view) && _warehouseReady != ready)
                setState(() => _warehouseReady = ready);
            },
            onResolved: _load,
          ),
        Align(
          alignment: AlignmentDirectional.centerStart,
          child: TextButton.icon(
            onPressed: _storeId == null || _isLoading
                ? null
                : () {
                    if (current()) _filter();
                  },
            icon: const Icon(Icons.filter_list),
            label: Text(
              _search.isEmpty && _status.isEmpty && _sort == 'name_asc'
                  ? 'Filter and sort'
                  : 'Filters applied · Edit',
            ),
          ),
        ),
        Row(
          children: [
            IconButton(
              tooltip: 'Previous page',
              onPressed: _isLoading || _page == 1
                  ? null
                  : () {
                      if (!current() || _isLoading) return;
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
                      if (!current() || _isLoading || !_more) return;
                      setState(() => _page++);
                      _load();
                    },
              icon: const Icon(Icons.chevron_right),
            ),
          ],
        ),
        if (_isLoading && _loadedQuery != null)
          const Text(
            'Refreshing the same page. Previously loaded records are shown below.',
          ),
        if (_error != null && _loadedQuery != null)
          Semantics(
            liveRegion: true,
            child: Text(
              'Refresh unavailable. Previously loaded records are shown below. $_error',
            ),
          ),
      ],
      slivers: [_isLoading && _loadedQuery == null ? _loading() : _body()],
    );
  }

  Future<void> _filter() async {
    if (!mounted || !mobile_tokens.isLetbuyySurfaceCurrent(context)) return;
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

  Widget _body() {
    if (_error != null && _loadedQuery == null) {
      return _centerState(
        Icons.error_outline_rounded,
        'Could not load suppliers',
        _error!,
      );
    }
    if (_suppliers.isEmpty) {
      return _centerState(
        Icons.handshake_outlined,
        _filtered
            ? 'No matching suppliers'
            : (_page == 1 ? 'No suppliers yet' : 'No records on this page'),
        _filtered
            ? 'Clear or change the filters to find other records.'
            : 'Add suppliers before creating purchase orders.',
      );
    }
    return SliverPadding(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
      sliver: SliverList.builder(
        itemCount: _suppliers.length,
        itemBuilder: (context, index) {
          final supplier = _suppliers[index];
          return Container(
            margin: const EdgeInsets.only(bottom: 10),
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
                  children: [
                    Icon(
                      Icons.handshake_outlined,
                      color: mobile_tokens.LetbuyyColorTokens.brandPrimary,
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        supplier.name,
                        style: TextStyle(
                          color: colors.textPrimary,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 10,
                  runSpacing: 6,
                  children: [
                    _meta(Icons.person_outline, supplier.contactName),
                    _meta(Icons.alternate_email_outlined, supplier.email),
                    _meta(Icons.phone_outlined, supplier.phone),
                  ].where((item) => item != null).cast<Widget>().toList(),
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget? _meta(IconData icon, String value) {
    if (value.trim().isEmpty) return null;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 14, color: colors.textTertiary),
        const SizedBox(width: 4),
        Flexible(
          child: Text(
            value,
            style: TextStyle(color: colors.textSecondary, fontSize: 12),
          ),
        ),
      ],
    );
  }

  Future<void> _createSupplier() async {
    if (!mounted || !mobile_tokens.isLetbuyySurfaceCurrent(context)) return;
    final view = _view;
    if (!_matches(view) || !_warehouseReady || _warehouseBusy) return;
    final input = await mobile_tokens
        .showLetbuyyFormSheet<InventorySupplierInput>(
          context: context,
          builder: (_) => guardMerchantStoreView(
            view,
            _SupplierForm(storeId: view!.storeId, colors: colors),
            sheet: true,
          ),
        );
    if (input == null || !_matches(view) || input.storeId != view!.storeId)
      return;

    if (!_warehouseReady || _warehouseBusy) return;
    setState(() => _warehouseBusy = true);
    try {
      await context.read<InventoryService>().createSupplier(input);
      if (_matches(view)) {
        _showSnackBar('Supplier created');
        _load();
      }
    } catch (error) {
      if (_matches(view))
        _showSnackBar(
          'Creation could not be confirmed. Check saved requests and current store access before trying again.',
          isError: true,
        );
    } finally {
      if (_matches(view)) setState(() => _warehouseBusy = false);
    }
  }

  Widget _loading() {
    return SliverFillRemaining(
      hasScrollBody: false,
      child: Center(
        child: CircularProgressIndicator(
          color: mobile_tokens.LetbuyyColorTokens.brandPrimary,
        ),
      ),
    );
  }

  Widget _centerState(IconData icon, String title, String subtitle) {
    return SliverFillRemaining(
      hasScrollBody: false,
      child: Center(
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
      ),
    );
  }

  void _showSnackBar(String message, {bool isError = false}) {
    mobile_tokens.showLetbuyyOperationFeedback(
      context,
      message: message,
      isError: isError,
    );
  }
}

class _SupplierForm extends StatefulWidget {
  const _SupplierForm({required this.storeId, required this.colors});

  final String storeId;
  final AppThemeColors colors;

  @override
  State<_SupplierForm> createState() => _SupplierFormState();
}

class _SupplierFormState extends State<_SupplierForm> {
  final _name = TextEditingController();
  final _contact = TextEditingController();
  final _email = TextEditingController();
  final _phone = TextEditingController();
  final _address = TextEditingController();

  String? _validation;

  @override
  void dispose() {
    _name.dispose();
    _contact.dispose();
    _email.dispose();
    _phone.dispose();
    _address.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = widget.colors;
    return mobile_tokens.LetbuyyFormSheet(
      title: 'New supplier',
      description:
          'Save contact details for replenishment and purchase orders.',
      actions: [
        FilledButton.icon(
          onPressed: () {
            final input = InventorySupplierInput(
              storeId: widget.storeId,
              name: _name.text,
              contactName: _contact.text,
              email: _email.text,
              phone: _phone.text,
              address: _address.text,
            );
            try {
              WarehouseCommandIntent.supplier(input);
            } on FormatException {
              setState(
                () => _validation =
                    'Enter a supplier name, valid email, and contact details within their limits.',
              );
              return;
            }
            mobile_tokens.completeLetbuyySurface(context, input);
          },
          icon: const Icon(Icons.save_outlined),
          label: const Text('Create supplier'),
        ),
      ],
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _field(_name, 'Supplier name'),
          _field(_contact, 'Contact name'),
          _field(_email, 'Email'),
          _field(_phone, 'Phone'),
          _field(_address, 'Address'),
          const SizedBox(height: 10),
          if (_validation != null)
            Text(_validation!, style: TextStyle(color: colors.error)),
        ],
      ),
    );
  }

  Widget _field(TextEditingController controller, String label) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: mobile_tokens.CustomTextField(
        controller: controller,
        label: label,
        keyboardType: identical(controller, _email)
            ? TextInputType.emailAddress
            : identical(controller, _phone)
            ? TextInputType.phone
            : TextInputType.text,
        textInputAction: TextInputAction.next,
      ),
    );
  }
}
