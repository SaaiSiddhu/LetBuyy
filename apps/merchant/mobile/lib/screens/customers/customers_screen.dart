import 'dart:async';
import '../../services/api_client.dart';
import '../../widgets/shared/merchant_export_share.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:letbuyy_models/letbuyy_models.dart';
import 'package:provider/provider.dart';
import '../../app/store_context.dart';

import '../../app/routes.dart';
import '../../services/customer_service.dart';
import 'customer_segment_sheet.dart';
import '../../theme/app_theme_colors.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart' as mobile_tokens;
import '../../widgets/shared/accessible_tap_region.dart';

class CustomersScreen extends StatefulWidget {
  const CustomersScreen({super.key});

  @override
  State<CustomersScreen> createState() => _CustomersScreenState();
}

class _CustomersScreenState extends State<CustomersScreen> {
  final TextEditingController _searchController = TextEditingController();

  List<CustomerContract> _customers = [];
  List<CustomerSegmentContract> _segments = [];
  bool _isLoading = true;
  String? _storeId;
  String _query = '';
  String? _selectedSegmentId;
  String? _error;
  String? _segmentsError;
  Object? _viewContext;
  int _loadGeneration = 0;
  int _page = 1;
  final Map<int, String?> _pageCursors = {1: null};
  String? _nextCursor;
  bool _hasMore = false;
  bool _offline = false;
  Timer? _searchDebounce;

  late AppThemeColors colors;

  @override
  void initState() {
    super.initState();
    _viewContext = context.read<StoreContext>().requestContextKey;
    _loadCustomers();
  }

  @override
  void dispose() {
    _searchDebounce?.cancel();
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _loadCustomers() async {
    if (!mounted) return;
    final generation = ++_loadGeneration;
    setState(() {
      _isLoading = true;
      _error = null;
      _segmentsError = null;
      _hasMore = false;
    });

    try {
      final stores = context.read<StoreContext>();
      await stores.ensureSelectedStore();
      if (!mounted || generation != _loadGeneration) return;
      final captured = stores.requestContextKey;
      _viewContext = captured;
      final storeId = stores.selectedStoreId;
      _storeId = storeId;
      if (storeId == null) {
        if (mounted) {
          setState(() {
            _customers = [];
            _segments = [];
            _isLoading = false;
          });
        }
        return;
      }

      final service = context.read<CustomerService>();
      final segmentId = _selectedSegmentId;
      // Segments are optional to the primary customer list. Observe their error
      // independently so an unavailable segment endpoint cannot hide customers.
      final segmentsFuture = service
          .fetchSegments(storeId)
          .then<List<CustomerSegmentContract>?>((rows) => rows)
          .catchError((Object _) => null);
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
      final segments = await segmentsFuture;
      if (_scopeCurrent(captured, storeId) && generation == _loadGeneration) {
        setState(() {
          _customers = customers;
          _nextCursor = service.customersNextCursor;
          _hasMore = service.customersHasMore;
          _offline = service.customersOffline;
          _segments = segments ?? [];
          _segmentsError = segments == null
              ? 'Segments could not be loaded. Refresh to retry.'
              : null;
          if (segments != null &&
              segmentId != null &&
              !segments.any((segment) => segment.id == segmentId)) {
            _selectedSegmentId = null;
            _customers = [];
          }
          _isLoading = false;
        });
        if (segmentId != null && _selectedSegmentId == null)
          await _loadCustomers();
      }
    } catch (error) {
      if (mounted &&
          generation == _loadGeneration &&
          _viewContext == context.read<StoreContext>().requestContextKey) {
        setState(() {
          _customers = [];
          _error = 'Check your connection and store access, then retry.';
          _isLoading = false;
        });
      }
    }
  }

  void _resetPages() {
    _page = 1;
    _pageCursors.clear();
    _pageCursors[1] = null;
    _nextCursor = null;
    _hasMore = false;
  }

  void _searchChanged(String value) {
    _searchDebounce?.cancel();
    setState(() {
      _query = value;
      _resetPages();
      if (_selectedSegmentId == null) {
        ++_loadGeneration;
        _customers = [];
        _isLoading = true;
      }
    });
    if (_selectedSegmentId != null)
      return; // Segment API supports page browsing, not search.
    _searchDebounce = Timer(const Duration(milliseconds: 300), () {
      if (mounted) _loadCustomers();
    });
  }

  void _changePage(int change) {
    if (_isLoading || (change < 0 && _page == 1) || (change > 0 && !_hasMore))
      return;
    setState(() {
      if (change > 0) _pageCursors[_page + 1] = _nextCursor;
      _page += change;
    });
    _loadCustomers();
  }

  bool _scopeCurrent(Object? captured, String storeId) =>
      mounted &&
      context.read<StoreContext>().requestContextKey == captured &&
      context.read<StoreContext>().selectedStoreId == storeId;

  Widget _guardedSheet(
    BuildContext sheetContext,
    Object? captured,
    String storeId,
    Widget child,
  ) => Consumer<StoreContext>(
    builder: (_, stores, __) => _scopeCurrent(captured, storeId)
        ? child
        : SafeArea(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Text(
                    'Store access changed. Close this form and reload the selected store.',
                  ),
                  TextButton(
                    onPressed: () => Navigator.pop(sheetContext),
                    child: const Text('Close'),
                  ),
                ],
              ),
            ),
          ),
  );

  Future<void> _exportCustomers() async {
    final stores = context.read<StoreContext>();
    final storeId = stores.selectedStoreId;
    final captured = stores.requestContextKey;
    if (storeId == null) {
      _showCustomerSnack('Select a store before exporting customers.');
      return;
    }

    try {
      final service = context.read<CustomerService>();
      final result = await service.exportCustomers(storeId);
      if (!_scopeCurrent(captured, storeId)) return;
      final job = result['job'] is Map ? result['job'] as Map : const {};
      var latest = Map<String, dynamic>.from(job);
      for (var attempt = 0; attempt < 5; attempt += 1) {
        if (latest['status'] == 'completed' || latest['status'] == 'failed') {
          break;
        }
        await Future<void>.delayed(const Duration(milliseconds: 350));
        if (!_scopeCurrent(captured, storeId)) return;
        final jobId = latest['id']?.toString();
        if (jobId == null || jobId.isEmpty) break;
        final detail = await service.fetchExportJob(jobId);
        if (!_scopeCurrent(captured, storeId)) return;
        latest = detail['job'] is Map
            ? Map<String, dynamic>.from(detail['job'] as Map)
            : detail;
      }

      final status = latest['status']?.toString() ?? 'queued';
      final downloadUrl = latest['download_url']?.toString();
      if (status == 'completed' &&
          downloadUrl != null &&
          downloadUrl.isNotEmpty) {
        await shareMerchantExport(api: context.read<ApiClient>(), job: latest);
        if (!_scopeCurrent(captured, storeId)) return;
        _showCustomerSnack('Customer CSV export ready to share.');
      } else {
        _showCustomerSnack('Customer CSV export $status. Try again shortly.');
      }
    } catch (_) {
      if (_scopeCurrent(captured, storeId))
        _showCustomerSnack('Could not start customer export.');
    }
  }

  void _showCustomerSnack(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message)));
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
    colors = AppThemeColors.of(context);
    final stores = context.watch<StoreContext>();
    if (_viewContext != stores.requestContextKey) {
      _viewContext = stores.requestContextKey;
      ++_loadGeneration;
      _storeId = stores.selectedStoreId;
      _customers = [];
      _segments = [];
      _selectedSegmentId = null;
      _error = null;
      _segmentsError = null;
      _query = '';
      _offline = false;
      _resetPages();
      _searchDebounce?.cancel();
      _searchController.clear();
      _isLoading = true;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _loadCustomers();
      });
    }

    return Scaffold(
      backgroundColor: colors.bgStart,
      body: Container(
        decoration: colors.backgroundGradient,
        child: SafeArea(
          child: Column(
            children: [
              _buildHeader(),
              _buildSearch(),
              _buildSegments(),
              if (_segmentsError != null)
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: Text(
                    _segmentsError!,
                    style: TextStyle(color: colors.textSecondary),
                  ),
                ),
              _buildStats(),
              if (_offline)
                const Padding(
                  padding: EdgeInsets.symmetric(horizontal: 16),
                  child: Text(
                    'Offline snapshot. Reconnect and refresh for current customer data.',
                  ),
                ),
              Expanded(
                child: _isLoading ? _buildLoading() : _buildCustomerList(),
              ),
              if (_page > 1 || _hasMore)
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    TextButton(
                      onPressed: _page > 1 && !_isLoading
                          ? () => _changePage(-1)
                          : null,
                      child: const Text('Previous'),
                    ),
                    Text('Page $_page'),
                    TextButton(
                      onPressed: _hasMore && !_isLoading
                          ? () => _changePage(1)
                          : null,
                      child: const Text('Next'),
                    ),
                  ],
                ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildHeader() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 8, 8, 8),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Customers',
                  style: TextStyle(
                    color: colors.textPrimary,
                    fontSize: 22,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                Text(
                  'Profiles, addresses, and order history',
                  style: TextStyle(color: colors.textSecondary, fontSize: 12),
                ),
              ],
            ),
          ),
          IconButton(
            tooltip: 'Refresh customers',
            icon: Icon(Icons.refresh_rounded, color: colors.textSecondary),
            onPressed: _loadCustomers,
          ),
          IconButton(
            tooltip: 'Export customers',
            icon: Icon(Icons.download_rounded, color: colors.textSecondary),
            onPressed: _exportCustomers,
          ),
          IconButton(
            tooltip: 'Add customer',
            icon: Icon(
              Icons.person_add_alt_1_outlined,
              color: colors.textSecondary,
            ),
            onPressed: _showCreateCustomerSheet,
          ),
          IconButton(
            tooltip: 'Create segment',
            icon: Icon(Icons.group_work_outlined, color: colors.textSecondary),
            onPressed: _showCreateSegmentSheet,
          ),
        ],
      ),
    );
  }

  Widget _buildSearch() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
      child: TextField(
        controller: _searchController,
        onChanged: _searchChanged,
        style: TextStyle(color: colors.textPrimary),
        decoration: InputDecoration(
          hintText: _selectedSegmentId == null
              ? 'Search customers by name, email or phone'
              : 'Filter this segment page',
          hintStyle: TextStyle(color: colors.textTertiary),
          prefixIcon: Icon(Icons.search_rounded, color: colors.textTertiary),
          suffixIcon: _query.isEmpty
              ? null
              : IconButton(
                  icon: Icon(Icons.close_rounded, color: colors.textTertiary),
                  onPressed: () {
                    _searchController.clear();
                    _searchChanged('');
                  },
                ),
          filled: true,
          fillColor: colors.surfaceVariant,
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: BorderSide(color: colors.divider),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: BorderSide(color: colors.divider),
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

  Widget _buildSegments() {
    return SizedBox(
      height: 52,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 10, 16, 0),
        scrollDirection: Axis.horizontal,
        children: [
          _segmentChip(
            label: 'All customers',
            selected: _selectedSegmentId == null,
            count: null,
            onTap: () {
              if (_selectedSegmentId == null) return;
              setState(() {
                _selectedSegmentId = null;
                _resetPages();
              });
              _loadCustomers();
            },
          ),
          const SizedBox(width: 8),
          if (_selectedSegmentId != null &&
              _segments.any((row) => row.id == _selectedSegmentId))
            IconButton(
              tooltip: 'Edit selected segment',
              icon: const Icon(Icons.edit_outlined),
              onPressed: () => _showCreateSegmentSheet(
                segment: _segments.firstWhere(
                  (row) => row.id == _selectedSegmentId,
                ),
              ),
            ),
          ..._segments.map(
            (segment) => Padding(
              padding: const EdgeInsets.only(right: 8),
              child: _segmentChip(
                label: segment.name,
                selected: _selectedSegmentId == segment.id,
                count: segment.customerCount,
                onTap: () {
                  setState(() {
                    _selectedSegmentId = segment.id;
                    _resetPages();
                  });
                  _loadCustomers();
                },
              ),
            ),
          ),
          ActionChip(
            avatar: const Icon(Icons.add_rounded, size: 18),
            label: const Text('Segment'),
            onPressed: _showCreateSegmentSheet,
            backgroundColor: colors.surfaceVariant,
            side: BorderSide(color: colors.divider),
          ),
        ],
      ),
    );
  }

  Widget _segmentChip({
    required String label,
    required bool selected,
    required int? count,
    required VoidCallback onTap,
  }) {
    return ChoiceChip(
      selected: selected,
      label: Text(count == null ? label : '$label ($count)'),
      onSelected: (_) => onTap(),
      selectedColor: mobile_tokens.LetbuyyColorTokens.brandPrimary.withValues(
        alpha: 0.16,
      ),
      backgroundColor: colors.surfaceVariant,
      side: BorderSide(
        color: selected
            ? mobile_tokens.LetbuyyColorTokens.brandPrimary
            : colors.divider,
      ),
      labelStyle: TextStyle(
        color: selected
            ? mobile_tokens.LetbuyyColorTokens.brandPrimary
            : colors.textSecondary,
        fontWeight: FontWeight.w700,
      ),
    );
  }

  Widget _buildStats() {
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 12, 16, 8),
      child: Row(
        children: [
          Expanded(
            child: _metricCard(
              'On page',
              _customers.length.toString(),
              Icons.people_alt_outlined,
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: _metricCard(
              'Active on page',
              _activeCount.toString(),
              Icons.verified_user_outlined,
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: _metricCard(
              'Page spend',
              _money(_totalSpent),
              Icons.payments_outlined,
            ),
          ),
        ],
      ),
    );
  }

  Widget _metricCard(String label, String value, IconData icon) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: colors.card,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: colors.cardBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(
            icon,
            color: mobile_tokens.LetbuyyColorTokens.brandPrimary,
            size: 18,
          ),
          const SizedBox(height: 8),
          Text(
            value,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              color: colors.textPrimary,
              fontSize: 16,
              fontWeight: FontWeight.w800,
            ),
          ),
          Text(
            label,
            style: TextStyle(color: colors.textSecondary, fontSize: 11),
          ),
        ],
      ),
    );
  }

  Future<void> _showCreateSegmentSheet({
    CustomerSegmentContract? segment,
  }) async {
    final stores = context.read<StoreContext>();
    final storeId = stores.selectedStoreId;
    final captured = stores.requestContextKey;
    if (storeId == null || !mounted) return;
    final saved = await showModalBottomSheet<CustomerSegmentContract>(
      context: context,
      isScrollControlled: true,
      backgroundColor: colors.card,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => CustomerSegmentSheet(storeId: storeId, segment: segment),
    );
    if (saved == null || !_scopeCurrent(captured, storeId)) return;
    setState(() {
      _selectedSegmentId = saved.id;
      _query = '';
      _searchController.clear();
      _resetPages();
    });
    await _loadCustomers();
  }

  Future<void> _showCreateCustomerSheet() async {
    final stores = context.read<StoreContext>();
    final storeId = stores.selectedStoreId;
    final captured = stores.requestContextKey;
    if (storeId == null || !mounted) return;

    final nameController = TextEditingController();
    final emailController = TextEditingController();
    final phoneController = TextEditingController();
    final tagsController = TextEditingController();
    bool acceptsMarketing = false;
    bool isSaving = false;
    String? formError;

    List<String> splitName(String fullName) {
      final parts = fullName.trim().split(RegExp(r'\s+'));
      return [
        parts.isEmpty ? '' : parts.first,
        parts.length <= 1 ? '' : parts.skip(1).join(' '),
      ];
    }

    List<String> parseTags() => tagsController.text
        .split(',')
        .map((tag) => tag.trim())
        .where((tag) => tag.isNotEmpty)
        .toList(growable: false);

    bool canSave() =>
        nameController.text.trim().isNotEmpty &&
        emailController.text.trim().contains('@');

    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: colors.card,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (sheetContext) {
        return _guardedSheet(
          sheetContext,
          captured,
          storeId,
          StatefulBuilder(
            builder: (context, setSheetState) {
              void markChanged(String _) =>
                  setSheetState(() => formError = null);
              return Padding(
                padding: EdgeInsets.fromLTRB(
                  20,
                  16,
                  20,
                  MediaQuery.of(context).viewInsets.bottom + 20,
                ),
                child: SingleChildScrollView(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Add customer',
                        style: TextStyle(
                          color: colors.textPrimary,
                          fontSize: 18,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      const SizedBox(height: 12),
                      TextField(
                        key: const Key('customer-name-field'),
                        controller: nameController,
                        onChanged: markChanged,
                        textInputAction: TextInputAction.next,
                        style: TextStyle(color: colors.textPrimary),
                        decoration: const InputDecoration(
                          labelText: 'Full name',
                          hintText: 'Anu Buyer',
                        ),
                      ),
                      const SizedBox(height: 10),
                      TextField(
                        key: const Key('customer-email-field'),
                        controller: emailController,
                        onChanged: markChanged,
                        keyboardType: TextInputType.emailAddress,
                        textInputAction: TextInputAction.next,
                        style: TextStyle(color: colors.textPrimary),
                        decoration: const InputDecoration(
                          labelText: 'Email',
                          hintText: 'anu@example.com',
                        ),
                      ),
                      const SizedBox(height: 10),
                      TextField(
                        key: const Key('customer-phone-field'),
                        controller: phoneController,
                        onChanged: markChanged,
                        keyboardType: TextInputType.phone,
                        textInputAction: TextInputAction.next,
                        style: TextStyle(color: colors.textPrimary),
                        decoration: const InputDecoration(
                          labelText: 'Phone',
                          hintText: '+91 98765 43210',
                        ),
                      ),
                      const SizedBox(height: 10),
                      TextField(
                        key: const Key('customer-tags-field'),
                        controller: tagsController,
                        onChanged: markChanged,
                        style: TextStyle(color: colors.textPrimary),
                        decoration: const InputDecoration(
                          labelText: 'Tags',
                          hintText: 'vip, wholesale',
                        ),
                      ),
                      SwitchListTile.adaptive(
                        value: acceptsMarketing,
                        onChanged: (value) =>
                            setSheetState(() => acceptsMarketing = value),
                        title: const Text('Accepts marketing'),
                        contentPadding: EdgeInsets.zero,
                      ),
                      if (formError != null) ...[
                        Text(formError!, style: TextStyle(color: colors.error)),
                        const SizedBox(height: 10),
                      ],
                      SizedBox(
                        width: double.infinity,
                        child: FilledButton.icon(
                          onPressed: isSaving || !canSave()
                              ? null
                              : () async {
                                  if (!_scopeCurrent(captured, storeId)) return;
                                  setSheetState(() => isSaving = true);
                                  try {
                                    final nameParts = splitName(
                                      nameController.text,
                                    );
                                    await context
                                        .read<CustomerService>()
                                        .createCustomer(
                                          storeId: storeId,
                                          email: emailController.text,
                                          firstName: nameParts[0],
                                          lastName: nameParts[1],
                                          phone: phoneController.text,
                                          tags: parseTags(),
                                          acceptsMarketing: acceptsMarketing,
                                        );
                                    if (!_scopeCurrent(captured, storeId) ||
                                        !sheetContext.mounted)
                                      return;
                                    Navigator.of(sheetContext).pop();
                                    setState(() {
                                      _selectedSegmentId = null;
                                      _query = '';
                                      _searchController.clear();
                                      _resetPages();
                                    });
                                    await _loadCustomers();
                                    _showCustomerSnack('Customer added.');
                                  } catch (_) {
                                    if (!_scopeCurrent(captured, storeId) ||
                                        !sheetContext.mounted)
                                      return;
                                    setSheetState(() {
                                      isSaving = false;
                                      formError = 'Could not save customer.';
                                    });
                                  }
                                },
                          icon: isSaving
                              ? const SizedBox(
                                  width: 16,
                                  height: 16,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                  ),
                                )
                              : const Icon(Icons.person_add_alt_1_outlined),
                          label: const Text('Save customer'),
                        ),
                      ),
                    ],
                  ),
                ),
              );
            },
          ),
        );
      },
    );
  }

  Widget _buildLoading() {
    return Center(
      child: CircularProgressIndicator(
        color: mobile_tokens.LetbuyyColorTokens.brandPrimary,
      ),
    );
  }

  Widget _buildCustomerList() {
    if (_error != null) {
      return _centerState(
        icon: Icons.error_outline_rounded,
        title: 'Could not load customers',
        subtitle: _error!,
        action: TextButton.icon(
          onPressed: _loadCustomers,
          icon: const Icon(Icons.refresh_rounded),
          label: const Text('Retry'),
        ),
      );
    }

    if (_customers.isEmpty) {
      if (_query.trim().isNotEmpty || _selectedSegmentId != null || _page > 1) {
        return _centerState(
          icon: Icons.search_off_rounded,
          title: 'No matching customers',
          subtitle: _selectedSegmentId != null
              ? 'No customers match this segment on the current page.'
              : 'Try another search or return to the previous page.',
        );
      }
      return _centerState(
        icon: Icons.people_outline_rounded,
        title: 'No customers yet',
        subtitle: 'Create a customer profile or wait for the first order.',
        action: FilledButton.icon(
          onPressed: _showCreateCustomerSheet,
          icon: const Icon(Icons.person_add_alt_1_outlined),
          label: const Text('Add customer'),
        ),
      );
    }

    final customers = _filteredCustomers;
    if (customers.isEmpty) {
      return _centerState(
        icon: Icons.search_off_rounded,
        title: 'No matching customers',
        subtitle: 'Try another name, email, phone, or GSTIN.',
      );
    }

    return RefreshIndicator(
      color: mobile_tokens.LetbuyyColorTokens.brandPrimary,
      onRefresh: _loadCustomers,
      child: ListView.builder(
        padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
        itemCount: customers.length,
        itemBuilder: (context, index) => _customerCard(customers[index]),
      ),
    );
  }

  Widget _customerCard(CustomerContract customer) {
    final status = _status(customer);
    final email = customer.email;
    final canOpen = email != null && email.trim().isNotEmpty;
    void openCustomer() {
      if (!canOpen) return;
      Navigator.pushNamed(
        context,
        AppRoutes.customerDetail,
        arguments: {'email': email, 'customer': customer},
      ).then((_) => _loadCustomers());
    }

    return AccessibleTapRegion(
      label:
          '${_customerName(customer)}, $status customer, ${customer.orderCount} orders, ${_money(customer.totalSpent)} spent',
      hint: canOpen ? 'Open customer details' : 'Customer has no email address',
      onTap: canOpen ? openCustomer : null,
      child: InkWell(
        onTap: canOpen ? openCustomer : null,
        borderRadius: BorderRadius.circular(12),
        child: Container(
          margin: const EdgeInsets.only(bottom: 10),
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: colors.card,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: colors.cardBorder),
          ),
          child: Row(
            children: [
              CircleAvatar(
                radius: 22,
                backgroundColor: mobile_tokens.LetbuyyColorTokens.brandPrimary
                    .withValues(alpha: 0.12),
                child: Text(
                  _initials(customer),
                  style: TextStyle(
                    color: mobile_tokens.LetbuyyColorTokens.brandPrimary,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            _customerName(customer),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              color: colors.textPrimary,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                        ),
                        _statusChip(status),
                      ],
                    ),
                    const SizedBox(height: 5),
                    Text(
                      customer.email ?? customer.phone ?? 'No contact',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: colors.textSecondary,
                        fontSize: 12,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Wrap(
                      spacing: 10,
                      runSpacing: 6,
                      children: [
                        _miniMetric(
                          Icons.shopping_bag_outlined,
                          '${customer.orderCount} orders',
                        ),
                        _miniMetric(
                          Icons.payments_outlined,
                          _money(customer.totalSpent),
                        ),
                        if (_nonEmpty(customer['last_order_at']) != null)
                          _miniMetric(
                            Icons.history_rounded,
                            _shortDate(customer['last_order_at'].toString()),
                          ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Icon(Icons.chevron_right_rounded, color: colors.textTertiary),
            ],
          ),
        ),
      ),
    );
  }

  Widget _statusChip(String status) {
    final color = status == 'active' ? colors.success : colors.warning;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        _titleCase(status),
        style: TextStyle(
          color: color,
          fontSize: 11,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }

  Widget _miniMetric(IconData icon, String value) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, color: colors.textTertiary, size: 14),
        const SizedBox(width: 4),
        Text(
          value,
          style: TextStyle(color: colors.textSecondary, fontSize: 12),
        ),
      ],
    );
  }

  Widget _centerState({
    required IconData icon,
    required String title,
    required String subtitle,
    Widget? action,
  }) {
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
              textAlign: TextAlign.center,
              style: TextStyle(
                color: colors.textPrimary,
                fontWeight: FontWeight.w800,
                fontSize: 16,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              subtitle,
              textAlign: TextAlign.center,
              style: TextStyle(color: colors.textSecondary),
            ),
            if (action != null) ...[const SizedBox(height: 14), action],
          ],
        ),
      ),
    );
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
