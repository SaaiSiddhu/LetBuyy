import 'dart:async';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:letbuyy_models/letbuyy_models.dart';
import 'package:provider/provider.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart' as mobile_tokens;
import '../../app/store_context.dart';
import '../../app/routes.dart';
import '../../services/api_client.dart';
import '../../services/customer_service.dart';
import '../../widgets/shared/merchant_export_share.dart';
import '../../widgets/shared/merchant_store_view.dart';
import '../../widgets/shared/accessible_tap_region.dart';
import 'customer_segment_sheet.dart';
import 'customer_profile_create_editor.dart';

class CustomersScreen extends StatefulWidget {
  const CustomersScreen({super.key});
  @override
  State<CustomersScreen> createState() => _CustomersScreenState();
}

class _CustomersScreenState extends State<CustomersScreen> {
  final _searchController = TextEditingController();
  final _scroll = ScrollController();
  List<CustomerContract> _customers = [];
  List<CustomerSegmentContract> _segments = [];
  List<CustomerContract>? _acceptedPage;
  bool _isLoading = true, _creatingCustomer = false, _segmentsLoading = false;
  bool _hasLoaded = false, _deniedObserved = false;
  String? _storeId, _selectedSegmentId, _error, _segmentsError;
  String _query = '';
  Object? _viewContext, _apiContext;
  int _loadGeneration = 0, _page = 1;
  final Map<int, String?> _pageCursors = {1: null};
  String? _nextCursor;
  bool _hasMore = false, _offline = false;
  Timer? _searchDebounce;
  bool _exportBusy = false, _exportUnknown = false;
  Map<String, dynamic>? _exportJob;
  String? _exportMessage;
  ({Object? view, Object? api, String store})? _exportOwner;

  CustomerService get _service => context.read<CustomerService>();
  bool get _current =>
      mounted &&
      _viewContext == context.read<StoreContext>().requestContextKey &&
      _storeId == context.read<StoreContext>().selectedStoreId &&
      _apiContext == _service.requestContext;
  bool get _active => _current && ModalRoute.of(context)?.isCurrent == true;
  bool get _mayPresent =>
      _current && (_storeId == null || !_service.hasDeniedRead(_storeId!));
  bool get _ready =>
      _active &&
      _mayPresent &&
      !_isLoading &&
      _acceptedPage != null &&
      _service.hasFreshCustomerPage(_acceptedPage!);
  bool get _exportCurrent =>
      _active &&
      _mayPresent &&
      _exportOwner != null &&
      _exportOwner!.view == _viewContext &&
      _exportOwner!.api == _apiContext &&
      _exportOwner!.store == _storeId;

  @override
  void initState() {
    super.initState();
    _viewContext = context.read<StoreContext>().requestContextKey;
    _apiContext = _service.requestContext;
    Future<void>.microtask(_loadCustomers);
  }

  @override
  void dispose() {
    ++_loadGeneration;
    _searchDebounce?.cancel();
    _searchController.dispose();
    _scroll.dispose();
    super.dispose();
  }

  bool _scopeCurrent(Object? captured, String storeId) =>
      mounted &&
      context.read<StoreContext>().requestContextKey == captured &&
      context.read<StoreContext>().selectedStoreId == storeId &&
      _apiContext == _service.requestContext;

  Future<void> _loadCustomers() async {
    if (!mounted) return;
    final generation = ++_loadGeneration;
    setState(() {
      _isLoading = true;
      _error = null;
      _segmentsError = null;
    });
    try {
      final stores = context.read<StoreContext>();
      await stores.ensureSelectedStore();
      if (!mounted || generation != _loadGeneration) return;
      final captured = stores.requestContextKey,
          apiContext = _service.requestContext;
      _viewContext = captured;
      _apiContext = apiContext;
      final storeId = stores.selectedStoreId;
      _storeId = storeId;
      if (storeId == null) {
        setState(() {
          _retirePage();
          _segments = [];
          _isLoading = false;
        });
        return;
      }
      final service = _service, segmentId = _selectedSegmentId;
      _segmentsLoading = true;
      // Observe optional completion independently. It cannot hold the primary
      // list pending or settle a later query/store/actor's segment controls.
      unawaited(
        _loadSegments(
          service,
          captured,
          apiContext,
          storeId,
          segmentId,
          generation,
        ),
      );
      final customers = await (segmentId == null
          ? service.fetchCustomers(
              storeId,
              search: _query.trim().isEmpty ? null : _query,
              page: _page,
              cursor: _pageCursors[_page],
            )
          : service.fetchSegmentCustomers(
              segmentId,
              storeId: storeId,
              page: _page,
            ));
      if (!_scopeCurrent(captured, storeId) ||
          apiContext != service.requestContext ||
          generation != _loadGeneration ||
          !service.acceptsCustomerPage(customers))
        return;
      setState(() {
        _customers = customers;
        _acceptedPage = customers;
        _hasLoaded = true;
        _nextCursor = service.customersNextCursor;
        _hasMore = service.customersHasMore;
        _offline = service.customersOffline;
        _isLoading = false;
      });
    } catch (error) {
      if (!mounted || generation != _loadGeneration || !_current) return;
      setState(() {
        _error = _storeId != null && _service.hasDeniedRead(_storeId!)
            ? 'Customer access could not be confirmed. Recheck access before continuing.'
            : 'Customers could not be refreshed. Check your connection and retry.';
        _isLoading = false;
        _hasMore = false;
        _acceptedPage = null;
      });
    }
  }

  Future<void> _loadSegments(
    CustomerService service,
    Object? captured,
    Object? apiContext,
    String storeId,
    String? segmentId,
    int generation,
  ) async {
    try {
      final rows = await service.fetchSegments(storeId);
      if (!_scopeCurrent(captured, storeId) ||
          apiContext != service.requestContext ||
          generation != _loadGeneration ||
          service.hasDeniedRead(storeId))
        return;
      final removed =
          segmentId != null && !rows.any((row) => row.id == segmentId);
      setState(() {
        _segments = rows;
        _segmentsLoading = false;
        _segmentsError = null;
        if (removed) {
          _selectedSegmentId = null;
          _resetPages();
          _retirePage();
        }
      });
      if (removed) await _loadCustomers();
    } catch (_) {
      if (!_scopeCurrent(captured, storeId) ||
          apiContext != service.requestContext ||
          generation != _loadGeneration)
        return;
      setState(() {
        _segmentsLoading = false;
        _segmentsError = 'Segments could not be loaded. Refresh to retry.';
      });
    }
  }

  void _retirePage() {
    _customers = [];
    _acceptedPage = null;
    _hasLoaded = false;
    _offline = false;
    _hasMore = false;
    _nextCursor = null;
  }

  void _resetPages() {
    _page = 1;
    _pageCursors.clear();
    _pageCursors[1] = null;
    _nextCursor = null;
    _hasMore = false;
  }

  void _searchChanged(String value) {
    if (!_active || !_mayPresent) return;
    _searchDebounce?.cancel();
    setState(() {
      _query = value;
      if (_selectedSegmentId == null) {
        _resetPages();
        ++_loadGeneration;
        _retirePage();
        _isLoading = true;
      }
    });
    if (_selectedSegmentId != null)
      return; // Page-local filter; no search contract here.
    _searchDebounce = Timer(const Duration(milliseconds: 300), () {
      if (_current && _mayPresent) _loadCustomers();
    });
  }

  void _changePage(int change) {
    if (!_ready || (change < 0 && _page == 1) || (change > 0 && !_hasMore))
      return;
    setState(() {
      if (change > 0) _pageCursors[_page + 1] = _nextCursor;
      _page += change;
      _retirePage();
    });
    _loadCustomers();
  }

  void _selectSegment(String? id) {
    if (!_ready || id == _selectedSegmentId) return;
    _searchDebounce?.cancel();
    setState(() {
      _selectedSegmentId = id;
      _resetPages();
      _retirePage();
    });
    _loadCustomers();
  }

  VoidCallback? _action(
    bool enabled,
    VoidCallback action, {
    bool fresh = true,
    bool allowDenied = false,
  }) {
    if (!enabled) return null;
    final owner = (_viewContext, _apiContext, _storeId),
        generation = _loadGeneration;
    return () {
      if (!_active ||
          (!allowDenied && !_mayPresent) ||
          (_viewContext, _apiContext, _storeId) != owner ||
          generation != _loadGeneration ||
          (fresh && !_ready))
        return;
      action();
    };
  }

  Widget _segmentChoice(String label, String? id) {
    final select = _action(_ready, () => _selectSegment(id));
    return ChoiceChip(
      label: Text(label),
      selected: _selectedSegmentId == id,
      onSelected: select == null ? null : (_) => select(),
    );
  }

  void _refresh() {
    if (_active && !_isLoading) _loadCustomers();
  }

  Map<String, dynamic> _readExportJob(
    Map<String, dynamic> result, {
    String? expected,
  }) {
    final raw = result['job'] is Map ? result['job'] as Map : result;
    final job = Map<String, dynamic>.from(raw);
    if (job['id'] is! String ||
        (job['id'] as String).isEmpty ||
        (expected != null && job['id'] != expected) ||
        job['type'] != 'customers' ||
        !const [
          'queued',
          'running',
          'completed',
          'failed',
        ].contains(job['status'])) {
      throw const ApiException(
        message: 'Export acknowledgement could not be confirmed.',
        statusCode: 502,
        code: 'EXPORT_RESULT_UNCONFIRMED',
      );
    }
    return job;
  }

  Future<void> _exportCustomers() async {
    if (!_ready || _exportBusy || _exportUnknown) return;
    final storeId = _storeId!;
    if (_exportOwner != null && !_exportCurrent) return;
    _exportOwner ??= (view: _viewContext, api: _apiContext, store: storeId);
    setState(() {
      _exportBusy = true;
      _exportMessage = null;
    });
    try {
      final service = _service;
      if (_exportJob == null) {
        // A lost start response cannot safely become another fresh export.
        _exportUnknown = true;
        final result = await service.exportCustomers(storeId);
        if (!_exportCurrent) return;
        final job = _readExportJob(result);
        setState(() {
          _exportJob = job;
          _exportUnknown = false;
        });
      } else {
        final id = _exportJob!['id'] as String;
        final result = await service.fetchExportJob(id);
        if (!_exportCurrent) return;
        setState(() => _exportJob = _readExportJob(result, expected: id));
      }
      for (var attempt = 0; attempt < 5; attempt++) {
        final job = _exportJob!;
        if (job['status'] == 'completed' || job['status'] == 'failed') break;
        await Future<void>.delayed(const Duration(milliseconds: 350));
        if (!_exportCurrent) return;
        final id = job['id'] as String,
            result = await service.fetchExportJob(job['id'] as String);
        if (!_exportCurrent) return;
        setState(() => _exportJob = _readExportJob(result, expected: id));
      }
      if (!_exportCurrent) return;
      final job = _exportJob!;
      if (job['status'] == 'completed') {
        await shareMerchantExport(
          api: context.read<ApiClient>(),
          job: job,
          isCurrent: () => _exportCurrent,
        );
        if (!_exportCurrent) return;
        setState(
          () => _exportMessage =
              'The completed CSV remains available to share again.',
        );
      }
    } catch (_) {
      if (!_exportCurrent) return;
      setState(
        () => _exportMessage = _exportUnknown
            ? 'The export start was not confirmed. It may still be processing. A new export will not be started from this view.'
            : 'This export could not be checked or shared. Recheck the same job when connected.',
      );
    } finally {
      if (mounted) setState(() => _exportBusy = false);
    }
  }

  void _showCustomerSnack(String message) {
    if (!_active || !_mayPresent) return;
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message)));
  }

  void _startAnotherExport(String failedId) {
    if (!_ready ||
        !_exportCurrent ||
        _exportBusy ||
        _exportUnknown ||
        _exportJob?['status'] != 'failed' ||
        _exportJob?['id'] != failedId)
      return;
    setState(() {
      _exportJob = null;
      _exportMessage = null;
    });
    _exportCustomers();
  }

  List<CustomerContract> get _filteredCustomers {
    final query = _query.trim().toLowerCase();
    final customers = query.isEmpty || _selectedSegmentId == null
        ? List<CustomerContract>.from(_customers)
        : _customers.where((customer) {
            return [
              _customerName(customer),
              customer.email,
              customer.phone,
              customer.status,
              customer['gstin'],
            ].whereType<Object>().any(
              (value) => value.toString().toLowerCase().contains(query),
            );
          }).toList();
    customers.sort((a, b) => _customerName(a).compareTo(_customerName(b)));
    return customers;
  }

  int get _activeCount =>
      _customers.where((customer) => _status(customer) == 'active').length;

  double get _totalSpent =>
      _customers.fold(0, (sum, customer) => sum + customer.totalSpent);

  @override
  Widget build(BuildContext context) {
    final stores = context.watch<StoreContext>();
    final service = context.watch<CustomerService>();
    final ownerChanged =
        _viewContext != stores.requestContextKey ||
        (_storeId != null && _storeId != stores.selectedStoreId) ||
        _apiContext != service.requestContext;
    if (ownerChanged) {
      _viewContext = stores.requestContextKey;
      _apiContext = service.requestContext;
      ++_loadGeneration;
      _storeId = stores.selectedStoreId;
      _retirePage();
      _segments = [];
      _creatingCustomer = false;
      _selectedSegmentId = null;
      _error = _segmentsError = null;
      _query = '';
      _resetPages();
      _searchDebounce?.cancel();
      _searchController.clear();
      _deniedObserved = false;
      _isLoading = true;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _loadCustomers();
      });
    }
    final denied = _storeId != null && service.hasDeniedRead(_storeId!);
    if (denied && !_deniedObserved) {
      _deniedObserved = true;
      _retirePage();
      _segments = [];
      _selectedSegmentId = null;
      _query = '';
      _searchController.clear();
      _searchDebounce?.cancel();
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) ScaffoldMessenger.of(context).hideCurrentSnackBar();
      });
    } else if (!denied) {
      _deniedObserved = false;
    }
    final callbackOwner = (_viewContext, _apiContext, _storeId);
    final selectedSegments = _segments
        .where((row) => row.id == _selectedSegmentId)
        .toList(growable: false);
    final scheme = Theme.of(context).colorScheme;
    return Scaffold(
      appBar: mobile_tokens.CustomAppBar.responsive(
        context: context,
        title: 'Customers',
        actions: [
          IconButton(
            tooltip: 'Refresh customers',
            onPressed: _action(
              !_isLoading,
              _refresh,
              fresh: false,
              allowDenied: true,
            ),
            icon: const Icon(Icons.refresh_rounded),
          ),
        ],
      ),
      body: SafeArea(
        top: false,
        child: RefreshIndicator(
          onRefresh: () async {
            if (_active &&
                !_isLoading &&
                (_viewContext, _apiContext, _storeId) == callbackOwner)
              await _loadCustomers();
          },
          child: CustomScrollView(
            controller: _scroll,
            physics: const AlwaysScrollableScrollPhysics(),
            slivers: [
              SliverPadding(
                padding: const EdgeInsets.all(
                  mobile_tokens.LetbuyySpacingTokens.space16,
                ),
                sliver: SliverToBoxAdapter(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Text(
                        'Profiles, addresses, and order history',
                        style: Theme.of(context).textTheme.bodyLarge,
                      ),
                      const SizedBox(
                        height: mobile_tokens.LetbuyySpacingTokens.space16,
                      ),
                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: [
                          Tooltip(
                            message: 'Add customer',
                            excludeFromSemantics: true,
                            child: FilledButton.icon(
                              onPressed: _action(
                                _ready && !_creatingCustomer,
                                _showCreateCustomerSheet,
                              ),
                              icon: const Icon(Icons.person_add_alt_1_outlined),
                              label: const Text('Add customer'),
                            ),
                          ),
                          OutlinedButton.icon(
                            onPressed: _action(
                              _ready,
                              () => _showSegmentEditor(),
                            ),
                            icon: const Icon(Icons.group_work_outlined),
                            label: const Text('Create segment'),
                          ),
                          OutlinedButton.icon(
                            onPressed: _action(
                              _ready &&
                                  !_exportBusy &&
                                  !_exportUnknown &&
                                  (_exportOwner == null || _exportCurrent),
                              _exportCustomers,
                            ),
                            icon: const Icon(Icons.download_rounded),
                            label: Text(
                              _exportJob == null
                                  ? 'Export customers'
                                  : 'Recheck export',
                            ),
                          ),
                        ],
                      ),
                      if (_exportCurrent &&
                          (_exportBusy ||
                              _exportJob != null ||
                              _exportUnknown ||
                              _exportMessage != null)) ...[
                        const SizedBox(height: 16),
                        _buildExport(),
                      ],
                      if (_exportOwner != null &&
                          !_exportCurrent &&
                          !_isLoading)
                        const Padding(
                          padding: EdgeInsets.only(top: 16),
                          child: Text(
                            'An export belongs to a previous account or store view. Reopen Customers before starting another export. Existing processing was not cancelled.',
                          ),
                        ),
                      if (!denied && _storeId != null) ...[
                        const SizedBox(height: 20),
                        TextField(
                          key: const Key('customer-list-search'),
                          controller: _searchController,
                          enabled: _active && _mayPresent,
                          onChanged: (value) {
                            if ((_viewContext, _apiContext, _storeId) ==
                                callbackOwner)
                              _searchChanged(value);
                          },
                          textInputAction: TextInputAction.search,
                          decoration: InputDecoration(
                            labelText: _selectedSegmentId == null
                                ? 'Search customers'
                                : 'Filter this segment page',
                            prefixIcon: const Icon(Icons.search_rounded),
                            suffixIcon: _query.isEmpty
                                ? null
                                : IconButton(
                                    tooltip: 'Clear search',
                                    onPressed: () {
                                      if (_active &&
                                          _mayPresent &&
                                          (
                                                _viewContext,
                                                _apiContext,
                                                _storeId,
                                              ) ==
                                              callbackOwner) {
                                        _searchController.clear();
                                        _searchChanged('');
                                      }
                                    },
                                    icon: const Icon(Icons.close_rounded),
                                  ),
                          ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          _selectedSegmentId == null
                              ? 'Searches all customers on the server.'
                              : 'Filters only the loaded segment page. Browse pages to inspect the rest.',
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                        const SizedBox(height: 16),
                        Wrap(
                          spacing: 8,
                          runSpacing: 8,
                          children: [
                            _segmentChoice('All customers', null),
                            for (final segment in _segments)
                              _segmentChoice(
                                '${segment.name} (${segment.customerCount})',
                                segment.id,
                              ),
                            if (_selectedSegmentId != null &&
                                _segments.any(
                                  (row) => row.id == _selectedSegmentId,
                                ))
                              ActionChip(
                                avatar: const Icon(Icons.edit_outlined),
                                label: const Text('Edit selected segment'),
                                onPressed: _action(
                                  _ready && selectedSegments.length == 1,
                                  () => _showSegmentEditor(
                                    segment: selectedSegments.single,
                                  ),
                                ),
                              ),
                          ],
                        ),
                        if (_segmentsLoading)
                          const Padding(
                            padding: EdgeInsets.only(top: 8),
                            child: Text('Loading optional segments…'),
                          ),
                        if (_segmentsError != null)
                          Padding(
                            padding: const EdgeInsets.only(top: 8),
                            child: Text(_segmentsError!),
                          ),
                      ],
                      if (_isLoading)
                        const Padding(
                          padding: EdgeInsets.symmetric(vertical: 16),
                          child: Column(
                            children: [
                              mobile_tokens.LoadingIndicator(),
                              SizedBox(height: 8),
                              Text('Loading customers…'),
                            ],
                          ),
                        ),
                      if (denied)
                        _state(
                          icon: Icons.lock_outline_rounded,
                          title: 'Customer access unavailable',
                          message:
                              'Private customer information has been removed from this view. Recheck store access to continue.',
                          retry: !_isLoading,
                        ),
                      if (_storeId == null && !_isLoading)
                        _state(
                          icon: Icons.store_outlined,
                          title: 'Choose a store',
                          message:
                              'Select a store from the dashboard to view its customers.',
                        ),
                      if (!denied && _error != null)
                        _state(
                          icon: Icons.cloud_off_outlined,
                          title: _hasLoaded
                              ? 'Refresh unavailable'
                              : 'Could not load customers',
                          message: _error!,
                          retry: !_isLoading,
                        ),
                      if (!denied && _hasLoaded) ...[
                        const SizedBox(height: 16),
                        Text(
                          'Loaded page $_page',
                          style: Theme.of(context).textTheme.titleMedium,
                        ),
                        const SizedBox(height: 8),
                        if (_offline)
                          const Text(
                            'Saved offline snapshot. Reconnect and refresh before making changes.',
                          ),
                        if (_isLoading)
                          const Text(
                            'Refreshing the same page. Previously loaded information is shown below.',
                          ),
                        if (_customers.isEmpty || _filteredCustomers.isEmpty)
                          _state(
                            icon: Icons.search_off_rounded,
                            title:
                                _customers.isEmpty &&
                                    _query.trim().isEmpty &&
                                    _selectedSegmentId == null &&
                                    _page == 1
                                ? 'No customers yet'
                                : 'No matching customers',
                            message:
                                _query.trim().isNotEmpty ||
                                    _selectedSegmentId != null ||
                                    _page > 1
                                ? 'Try another search, segment, or page.'
                                : 'Create a customer profile or wait for the first order.',
                          ),
                      ],
                    ],
                  ),
                ),
              ),
              if (!denied && _hasLoaded)
                SliverPadding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  sliver: SliverList.builder(
                    itemCount: _filteredCustomers.length,
                    itemBuilder: (_, index) =>
                        _customerCard(_filteredCustomers[index]),
                  ),
                ),
              if (!denied && _hasLoaded)
                SliverPadding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  sliver: SliverToBoxAdapter(child: _buildStats()),
                ),
              if (!denied && _hasLoaded && (_page > 1 || _hasMore))
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Wrap(
                      alignment: WrapAlignment.center,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      spacing: 12,
                      runSpacing: 8,
                      children: [
                        TextButton(
                          onPressed: _action(
                            _ready && _page > 1,
                            () => _changePage(-1),
                          ),
                          child: const Text('Previous'),
                        ),
                        Text('Page $_page'),
                        TextButton(
                          onPressed: _action(
                            _ready && _hasMore,
                            () => _changePage(1),
                          ),
                          child: const Text('Next'),
                        ),
                      ],
                    ),
                  ),
                ),
              SliverToBoxAdapter(
                child: SizedBox(
                  height: MediaQuery.paddingOf(context).bottom + 24,
                ),
              ),
            ],
          ),
        ),
      ),
      backgroundColor: scheme.surface,
    );
  }

  Widget _buildExport() {
    final status = _exportJob?['status'] as String?,
        jobId = _exportJob?['id'] as String?;
    return Card(
      margin: EdgeInsets.zero,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              'Whole-store customer CSV',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 8),
            const Text(
              'Exports all supported customers in this store. Search, segment, and page controls do not limit the CSV.',
            ),
            if (_exportBusy)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 8),
                child: mobile_tokens.LoadingIndicator(),
              ),
            if (status != null) Text('Export status: $status'),
            if (_exportMessage != null) Text(_exportMessage!),
            if (_exportJob != null && !_exportBusy)
              TextButton.icon(
                onPressed: _action(_ready, _exportCustomers),
                icon: Icon(
                  status == 'completed'
                      ? Icons.ios_share_outlined
                      : Icons.refresh_rounded,
                ),
                label: Text(
                  status == 'completed' ? 'Share CSV' : 'Recheck same export',
                ),
              ),
            if (status == 'failed' && !_exportBusy)
              TextButton(
                onPressed: _action(_ready, () => _startAnotherExport(jobId!)),
                child: const Text('Start another export'),
              ),
          ],
        ),
      ),
    );
  }

  Widget _state({
    required IconData icon,
    required String title,
    required String message,
    bool retry = false,
  }) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 20),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Align(
          alignment: AlignmentDirectional.centerStart,
          child: ExcludeSemantics(child: Icon(icon)),
        ),
        const SizedBox(height: 8),
        Text(title, style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: 8),
        Text(message),
        if (retry)
          Align(
            alignment: AlignmentDirectional.centerStart,
            child: TextButton(
              onPressed: _action(
                !_isLoading,
                _refresh,
                fresh: false,
                allowDenied: true,
              ),
              child: const Text('Retry'),
            ),
          ),
      ],
    ),
  );

  num? _presentNumber(Object? value) {
    final number = value is num
        ? value
        : value is String
        ? num.tryParse(value)
        : null;
    return number != null && number.isFinite ? number : null;
  }

  bool _hasCount(CustomerContract row) {
    final value = _presentNumber(row['order_count']);
    return value != null && value >= 0 && value == value.roundToDouble();
  }

  bool _hasSpend(CustomerContract row) =>
      _presentNumber(row['total_spent']) != null;
  bool _hasStatus(CustomerContract row) =>
      row['status'] is String && (row['status'] as String).trim().isNotEmpty;
  Widget _buildStats() => Padding(
    padding: const EdgeInsets.symmetric(vertical: 16),
    child: mobile_tokens.StatGrid(
      children: [
        mobile_tokens.StatTile(
          icon: Icons.people_alt_outlined,
          label: 'On page',
          value: _customers.length.toString(),
        ),
        mobile_tokens.StatTile(
          icon: Icons.verified_user_outlined,
          label: 'Active on page',
          value: _customers.every(_hasStatus)
              ? _activeCount.toString()
              : 'Unavailable',
        ),
        mobile_tokens.StatTile(
          icon: Icons.payments_outlined,
          label: 'Page spend',
          value: _customers.every(_hasSpend)
              ? _money(_totalSpent)
              : 'Unavailable',
        ),
      ],
    ),
  );

  Widget _customerCard(CustomerContract customer) {
    final email = customer.email,
        captured = _viewContext,
        api = _apiContext,
        generation = _loadGeneration;
    final status = _hasStatus(customer)
        ? _titleCase(_status(customer))
        : 'Status unavailable';
    final orders = _hasCount(customer)
        ? '${customer.orderCount} orders'
        : 'Order count unavailable';
    final spend = _hasSpend(customer)
        ? _money(customer.totalSpent)
        : 'Spend unavailable';
    final canOpen = _ready && email != null && email.trim().isNotEmpty;
    Future<void> open() async {
      if (!canOpen ||
          !_ready ||
          _viewContext != captured ||
          _apiContext != api ||
          _loadGeneration != generation)
        return;
      await Navigator.pushNamed(
        context,
        AppRoutes.customerDetail,
        arguments: {'email': email, 'customer': customer},
      );
      if (_active &&
          _mayPresent &&
          _viewContext == captured &&
          _apiContext == api)
        await _loadCustomers();
    }

    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: AccessibleTapRegion(
        label: '${_customerName(customer)}, $status, $orders, $spend',
        hint: canOpen
            ? 'Open customer details'
            : 'Customer details are unavailable until access is refreshed',
        onTap: canOpen ? open : null,
        child: Card(
          margin: EdgeInsets.zero,
          clipBehavior: Clip.antiAlias,
          child: InkWell(
            excludeFromSemantics: true,
            onTap: canOpen ? open : null,
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      ExcludeSemantics(
                        child: CircleAvatar(child: Text(_initials(customer))),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          _customerName(customer),
                          style: theme.textTheme.titleMedium,
                        ),
                      ),
                      if (canOpen)
                        const ExcludeSemantics(
                          child: Icon(Icons.chevron_right_rounded),
                        ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  if (_nonEmpty(email) != null)
                    Text(email!, style: theme.textTheme.bodyMedium),
                  if (_nonEmpty(customer.phone) != null)
                    Text(customer.phone!, style: theme.textTheme.bodyMedium),
                  if (_nonEmpty(email) == null &&
                      _nonEmpty(customer.phone) == null)
                    const Text('No contact'),
                  const SizedBox(height: 12),
                  Align(
                    alignment: AlignmentDirectional.centerStart,
                    child: mobile_tokens.LetbuyyStatusBadge(
                      label: status,
                      tone: !_hasStatus(customer)
                          ? mobile_tokens.LetbuyyStatusTone.neutral
                          : _status(customer) == 'active'
                          ? mobile_tokens.LetbuyyStatusTone.success
                          : mobile_tokens.LetbuyyStatusTone.warning,
                    ),
                  ),
                  const SizedBox(height: 12),
                  Text(orders),
                  Text(spend),
                  if (_nonEmpty(customer['last_order_at']) != null)
                    Text(
                      'Last order ${_shortDate(customer['last_order_at'].toString())}',
                    ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Future<void> _showSegmentEditor({CustomerSegmentContract? segment}) async {
    final stores = context.read<StoreContext>();
    final storeId = stores.selectedStoreId;
    final captured = stores.requestContextKey;
    if (storeId == null || !_ready) return;
    final saved = await Navigator.of(context).push<CustomerSegmentContract>(
      MaterialPageRoute<CustomerSegmentContract>(
        settings: RouteSettings(
          name: segment == null
              ? '/customers/segments/new'
              : '/customers/segments/${segment.id}/edit',
        ),
        builder: (_) =>
            CustomerSegmentSheet(storeId: storeId, segment: segment),
      ),
    );
    if (saved == null ||
        !_active ||
        !_mayPresent ||
        !_scopeCurrent(captured, storeId))
      return;
    setState(() {
      _selectedSegmentId = saved.id;
      _query = '';
      _searchController.clear();
      _resetPages();
      _retirePage();
    });
    await _loadCustomers();
  }

  Future<void> _showCreateCustomerSheet() async {
    if (!_ready ||
        _creatingCustomer ||
        ModalRoute.of(context)?.isCurrent != true)
      return;
    final stores = context.read<StoreContext>();
    final storeId = stores.selectedStoreId;
    final captured = stores.requestContextKey;
    if (storeId == null) return;
    final MerchantStoreView view = (key: captured, storeId: storeId);
    var needsReview = false;
    setState(() => _creatingCustomer = true);
    try {
      ScaffoldMessenger.of(context).hideCurrentSnackBar();
      final saved = await Navigator.of(context).push<CustomerContract>(
        MaterialPageRoute<CustomerContract>(
          settings: const RouteSettings(name: '/customers/new'),
          builder: (_) => guardMerchantStoreView(
            view,
            CustomerProfileCreateEditor(
              view: view,
              onUnconfirmed: () => needsReview = true,
            ),
            fullPage: true,
          ),
        ),
      );
      if (!_scopeCurrent(captured, storeId)) return;
      if (!_mayPresent) return;
      if (saved == null) {
        // An unsent cancel preserves the existing query/list/scroll. A lost
        // reply rechecks current data without claiming save completion.
        if (needsReview) await _loadCustomers();
        return;
      }
      setState(() {
        _selectedSegmentId = null;
        _query = '';
        _searchController.clear();
        _resetPages();
      });
      await _loadCustomers();
      if (_active && _mayPresent && _scopeCurrent(captured, storeId))
        _showCustomerSnack('Customer added.');
    } finally {
      if (_scopeCurrent(captured, storeId))
        setState(() => _creatingCustomer = false);
    }
  }

  String _customerName(CustomerContract customer) {
    return _nonEmpty(customer.displayName) ??
        [
          _nonEmpty(customer['first_name']),
          _nonEmpty(customer['last_name']),
        ].whereType<String>().join(' ').trim().ifEmpty ??
        _nonEmpty(customer.email) ??
        _nonEmpty(customer.phone) ??
        'Customer';
  }

  String _initials(CustomerContract customer) {
    final name = _customerName(customer);
    final parts = name.split(RegExp(r'\s+')).where((part) => part.isNotEmpty);
    final initials = parts.take(2).map((part) => part[0].toUpperCase()).join();
    return initials.isEmpty ? 'C' : initials;
  }

  String _status(CustomerContract customer) {
    final status = customer.status.trim().toLowerCase();
    return status.isEmpty ? 'active' : status;
  }

  String _money(double amount) {
    return 'INR ${NumberFormat.decimalPattern('en_IN').format(amount)}';
  }

  String _shortDate(String raw) {
    final date = DateTime.tryParse(raw);
    return date == null ? raw : DateFormat('MMM d').format(date.toLocal());
  }

  String _titleCase(String value) {
    return value
        .split(RegExp(r'[\s_]+'))
        .where((part) => part.isNotEmpty)
        .map((part) => '${part[0].toUpperCase()}${part.substring(1)}')
        .join(' ');
  }

  String? _nonEmpty(Object? value) {
    final text = value?.toString().trim();
    return text == null || text.isEmpty ? null : text;
  }
}

extension on String {
  String? get ifEmpty => isEmpty ? null : this;
}
