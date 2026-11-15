import 'dart:async';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:letbuyy_models/letbuyy_models.dart';
import 'package:provider/provider.dart';
import '../../app/routes.dart';
import '../../app/store_context.dart';
import '../../services/customer_service.dart';
import '../../services/order_service.dart';
import '../../services/whatsapp_service.dart';
import '../../theme/app_theme_colors.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart' as mobile_tokens;
import '../../widgets/shared/accessible_tap_region.dart';
import 'customer_detail_task.dart';

enum _CustomerSectionRead { loading, ready, failed, unavailable }

class CustomerDetailScreen extends StatefulWidget {
  const CustomerDetailScreen({
    super.key,
    required this.email,
    this.initialCustomer,
  });
  final String email;
  final CustomerContract? initialCustomer;
  @override
  State<CustomerDetailScreen> createState() => _CustomerDetailScreenState();
}

class _CustomerDetailScreenState extends State<CustomerDetailScreen> {
  CustomerContract? _customer;
  List<CustomerAddressContract> _addresses = [];
  List<OrderContract> _orders = [];
  List<Map<String, dynamic>> _notes = [], _whatsAppTimeline = [];
  bool _whatsAppAvailable = false,
      _whatsAppStatusKnown = false,
      _isLoading = true,
      _reading = false,
      _isMutating = false;
  bool _deniedObserved = false, _ordersStored = false;
  String? _error;
  Object? _boundContext;
  late final Object? _boundApi;
  late final String _boundEmail;
  String? _boundSiteId;
  int _loadGeneration = 0;
  _CustomerSectionRead _addressRead = _CustomerSectionRead.loading,
      _notesRead = _CustomerSectionRead.loading,
      _ordersRead = _CustomerSectionRead.loading,
      _whatsAppRead = _CustomerSectionRead.loading;
  CustomerService get _service => context.read<CustomerService>();
  bool get _current =>
      mounted &&
      _boundSiteId != null &&
      context.read<StoreContext>().requestContextKey == _boundContext &&
      context.read<StoreContext>().selectedStoreId == _boundSiteId &&
      _boundApi == _service.requestContext &&
      widget.email.trim().toLowerCase() == _boundEmail;
  bool get _active => _current && ModalRoute.of(context)?.isCurrent == true;
  bool get _mayPresent => _current && !_service.hasDeniedRead(_boundSiteId!);
  bool get _ready =>
      _active &&
      _mayPresent &&
      !_reading &&
      !_isMutating &&
      _customer != null &&
      _service.hasFreshCustomer(_customer!);
  late AppThemeColors colors;

  @override
  void initState() {
    super.initState();
    final stores = context.read<StoreContext>();
    _boundContext = stores.requestContextKey;
    _boundSiteId = stores.selectedStoreId;
    _boundApi = _service.requestContext;
    _boundEmail = widget.email.trim().toLowerCase();
    Future<void>.microtask(_loadCustomer);
  }

  @override
  void dispose() {
    ++_loadGeneration;
    super.dispose();
  }

  bool _ownsRead(int generation, [CustomerContract? row]) =>
      _current &&
      generation == _loadGeneration &&
      (row == null || identical(_customer, row));

  Future<void> _loadCustomer() async {
    if (!_current || _reading) return;
    final generation = ++_loadGeneration;
    if (widget.initialCustomer != null &&
        (widget.initialCustomer!.storeId != _boundSiteId ||
            (widget.initialCustomer!.email != null &&
                widget.initialCustomer!.email!.trim().toLowerCase() !=
                    _boundEmail))) {
      setState(() {
        _customer = null;
        _isLoading = false;
        _error = 'Open this customer from the selected store.';
      });
      return;
    }
    if (_boundEmail.isEmpty) {
      setState(() {
        _customer = null;
        _isLoading = false;
        _error = 'Customer email is missing.';
      });
      return;
    }
    setState(() {
      _reading = true;
      _isLoading = _customer == null;
      _error = null;
    });
    try {
      final customer = await _service.fetchCustomerByEmail(
        widget.email,
        storeId: _boundSiteId,
      );
      if (!_ownsRead(generation) || !_service.acceptsCustomer(customer)) return;
      setState(() {
        _customer = customer;
        _isLoading = false;
        _reading = false;
        _addressRead = _notesRead = _ordersRead = _whatsAppRead =
            _CustomerSectionRead.loading;
        _whatsAppStatusKnown = false;
      });
      // Each optional section owns its completion. A held/failed read cannot
      // make an accepted primary profile disappear or settle a later profile.
      unawaited(_readAddresses(customer, generation));
      unawaited(_readNotes(customer, generation));
      unawaited(_readOrders(customer, generation));
      unawaited(_readWhatsApp(customer, generation));
    } catch (_) {
      if (!_ownsRead(generation)) return;
      setState(() {
        _error =
            'Customer access could not be confirmed. Check your connection and retry.';
      });
    } finally {
      if (_ownsRead(generation))
        setState(() {
          _reading = false;
          _isLoading = false;
        });
    }
  }

  Future<void> _readAddresses(CustomerContract customer, int generation) async {
    try {
      final rows = await _service.fetchAddresses(
        customer.email!.trim().toLowerCase(),
        storeId: customer.storeId,
      );
      if (!_ownsRead(generation, customer) || !_mayPresent) return;
      setState(() {
        _addresses = rows;
        _addressRead = _CustomerSectionRead.ready;
      });
    } catch (_) {
      if (_ownsRead(generation, customer) && _mayPresent)
        setState(() {
          _addresses = [];
          _addressRead = _CustomerSectionRead.failed;
        });
    }
  }

  Future<void> _readNotes(CustomerContract customer, int generation) async {
    try {
      final rows = await _service.fetchNotes(
        widget.email,
        storeId: customer.storeId,
      );
      if (!_ownsRead(generation, customer) || !_mayPresent) return;
      setState(() {
        _notes = rows;
        _notesRead = _CustomerSectionRead.ready;
      });
    } catch (_) {
      if (_ownsRead(generation, customer) && _mayPresent)
        setState(() {
          _notes = [];
          _notesRead = _CustomerSectionRead.failed;
        });
    }
  }

  Future<void> _readOrders(CustomerContract customer, int generation) async {
    try {
      final rows = await _loadRecentOrders(customer);
      if (!_ownsRead(generation, customer) || !_mayPresent) return;
      if (rows.any(
        (row) =>
            row.storeId != _boundSiteId ||
            row.customerEmail?.trim().toLowerCase() != _boundEmail,
      )) {
        throw const FormatException('Unconfirmed customer order scope.');
      }
      final stored = !context.read<OrderService>().hasFreshOrders;
      setState(() {
        _orders = rows;
        _ordersStored = stored;
        _ordersRead = _CustomerSectionRead.ready;
      });
    } catch (_) {
      if (_ownsRead(generation, customer) && _mayPresent)
        setState(() {
          _orders = [];
          _ordersRead = _CustomerSectionRead.failed;
        });
    }
  }

  Future<List<OrderContract>> _loadRecentOrders(
    CustomerContract customer,
  ) async {
    final payloadOrders = _ordersFromCustomer(customer);
    final storeId = customer.storeId.trim();
    final email = customer.email?.trim();
    if (storeId.isEmpty || email == null || email.isEmpty) return payloadOrders;
    return await context.read<OrderService>().fetchOrders(
      storeId,
      customerEmail: email,
      limit: 10,
    );
  }

  Future<void> _readWhatsApp(CustomerContract customer, int generation) async {
    try {
      final result = await _loadWhatsApp(customer, customer.storeId);
      if (!_ownsRead(generation, customer) || !_mayPresent) return;
      setState(() {
        _whatsAppAvailable = result.available;
        _whatsAppStatusKnown = result.statusKnown;
        _whatsAppTimeline = result.timeline;
        _whatsAppRead = !result.statusKnown
            ? _CustomerSectionRead.unavailable
            : result.timelineFailed
            ? _CustomerSectionRead.failed
            : _CustomerSectionRead.ready;
      });
    } catch (_) {
      if (_ownsRead(generation, customer) && _mayPresent)
        setState(() {
          _whatsAppAvailable = false;
          _whatsAppStatusKnown = false;
          _whatsAppTimeline = [];
          _whatsAppRead = _CustomerSectionRead.failed;
        });
    }
  }

  Future<_WhatsAppLoadResult> _loadWhatsApp(
    CustomerContract customer,
    String storeId,
  ) async {
    final service = Provider.of<WhatsAppService?>(context, listen: false);
    if (service == null) return const _WhatsAppLoadResult();
    final status = await service.fetchStatus(storeId);
    if (status['available'] is! bool) {
      throw const FormatException('WhatsApp status could not be confirmed.');
    }
    final available = status['available'] as bool;
    if (!_current) throw const FormatException('Customer view changed.');
    try {
      final timeline = await service.fetchTimeline(
        storeId,
        customerEmail: customer.email,
        customerPhone: customer.phone,
      );
      return _WhatsAppLoadResult(
        available: available,
        timeline: timeline,
        statusKnown: true,
      );
    } catch (_) {
      return _WhatsAppLoadResult(
        available: available,
        statusKnown: true,
        timelineFailed: true,
      );
    }
  }

  VoidCallback? _action(
    bool enabled,
    VoidCallback action, {
    bool fresh = true,
    bool allowDenied = false,
  }) {
    if (!enabled) return null;
    final generation = _loadGeneration;
    return () {
      if (!_active ||
          generation != _loadGeneration ||
          (!allowDenied && !_mayPresent) ||
          (fresh && !_ready))
        return;
      action();
    };
  }

  Future<void> _saveAddress(CustomerAddressContract? existing) =>
      _runTask(CustomerDetailTaskKind.address, address: existing);
  Future<void> _deleteAddress(CustomerAddressContract address) =>
      _runTask(CustomerDetailTaskKind.deleteAddress, address: address);
  Future<void> _editCustomer() => _runTask(CustomerDetailTaskKind.profile);
  Future<void> _addNote() => _runTask(CustomerDetailTaskKind.note);
  Future<void> _editTags() => _runTask(CustomerDetailTaskKind.tags);
  Future<void> _emailCustomer() => _runTask(CustomerDetailTaskKind.email);
  Future<void> _whatsAppCustomer() => _runTask(CustomerDetailTaskKind.whatsApp);
  Future<void> _mergeCustomer() => _runTask(CustomerDetailTaskKind.merge);
  Future<void> _deleteCustomerProfile() =>
      _runTask(CustomerDetailTaskKind.redact);

  Future<void> _runTask(
    CustomerDetailTaskKind kind, {
    CustomerAddressContract? address,
  }) async {
    if (!_ready) return;
    final customer = _customer!, generation = _loadGeneration;
    final email = customer.email?.trim().toLowerCase();
    if (email == null || email.isEmpty || email != _boundEmail) return;
    final messaging = kind == CustomerDetailTaskKind.whatsApp;
    if (messaging &&
        (!_whatsAppStatusKnown ||
            !_whatsAppAvailable ||
            (customer.phone?.trim().isEmpty ?? true)))
      return;
    if (address != null &&
        (_addressRead != _CustomerSectionRead.ready ||
            !_addresses.contains(address) ||
            address.storeId != customer.storeId ||
            address['customer_email']?.toString().trim().toLowerCase() !=
                email ||
            address.id.isEmpty))
      return;
    // The editable name comes from actual name fields, never an email/phone
    // display fallback. The original split parser is retained below.
    final fullName =
        _nonEmpty(customer['full_name']) ??
        (customer.displayName?.trim().toLowerCase() == email
            ? null
            : _nonEmpty(customer.displayName));
    final parts = _splitName(fullName ?? '');
    final hasNameFields =
        customer['first_name'] is String || customer['last_name'] is String;
    var submitted = false;
    final task = CustomerDetailTask(
      kind: kind,
      view: (key: _boundContext, storeId: customer.storeId),
      customer: customer,
      address: address,
      firstName: hasNameFields
          ? _nonEmpty(customer['first_name']) ?? ''
          : parts.$1,
      lastName: hasNameFields
          ? _nonEmpty(customer['last_name']) ?? ''
          : parts.$2,
      whatsAppVariables: Map.unmodifiable(_whatsAppVariables(customer)),
      onSubmitted: () {
        if (_current) submitted = true;
      },
      ownerCurrent: () => _current && _mayPresent,
      canStart: () =>
          _current &&
          _mayPresent &&
          !_reading &&
          generation == _loadGeneration &&
          identical(_customer, customer) &&
          _service.hasFreshCustomer(customer) &&
          (address == null ||
              (_addressRead == _CustomerSectionRead.ready &&
                  _addresses.contains(address))) &&
          (!messaging || (_whatsAppStatusKnown && _whatsAppAvailable)),
    );
    setState(() => _isMutating = true);
    CustomerDetailTaskResult? result;
    try {
      if (task.isSheet) {
        result = await mobile_tokens
            .showLetbuyyFormSheet<CustomerDetailTaskResult>(
              context: context,
              isDismissible: false,
              builder: (_) => task,
            );
      } else if (task.isConfirmation) {
        result = await showDialog<CustomerDetailTaskResult>(
          context: context,
          barrierDismissible: false,
          builder: (_) => task,
        );
      } else {
        result = await Navigator.of(context).push<CustomerDetailTaskResult>(
          MaterialPageRoute(builder: (_) => task),
        );
      }
    } finally {
      if (_current) setState(() => _isMutating = false);
    }
    if (!_active || (result == null && !submitted)) return;
    // A clean platform pop (including an iOS edge gesture) may return no
    // explicit result. A submitted task still rechecks reads on its own owner.
    final outcome = result ?? const CustomerDetailTaskResult();
    if (outcome.mergedInto != null) {
      mobile_tokens.completeLetbuyySurface(context, {
        'merged_into': outcome.mergedInto,
      });
    } else if (outcome.redacted) {
      mobile_tokens.completeLetbuyySurface(context, {'deleted': true});
    } else {
      // Only reads on return, including an unconfirmed request. A task never
      // turns a lost acknowledgement into another service command.
      await _loadCustomer();
    }
  }

  @override
  Widget build(BuildContext context) {
    colors = AppThemeColors.of(context);
    context.watch<StoreContext>();
    final service = context.watch<CustomerService>();
    final denied = _current && service.hasDeniedRead(_boundSiteId!);
    if (denied && !_deniedObserved) {
      _deniedObserved = true;
      ++_loadGeneration;
      _customer = null;
      _addresses = [];
      _orders = [];
      _notes = [];
      _whatsAppTimeline = [];
      _whatsAppAvailable = false;
      _reading = false;
      _isLoading = false;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) ScaffoldMessenger.of(context).hideCurrentSnackBar();
      });
    } else if (!denied) {
      _deniedObserved = false;
    }
    final generation = _loadGeneration, customer = _customer;
    final fresh = customer != null && service.hasFreshCustomer(customer);
    final accepted = customer != null && service.acceptsCustomer(customer);
    final mayShow = _mayPresent;
    return Scaffold(
      appBar: mobile_tokens.CustomAppBar.responsive(
        context: context,
        title: 'Customer',
        actions: [
          IconButton(
            tooltip: 'Refresh',
            onPressed: _action(
              !_reading && !_isMutating,
              _loadCustomer,
              fresh: false,
              allowDenied: true,
            ),
            icon: const Icon(Icons.refresh_rounded),
          ),
        ],
      ),
      body: SafeArea(
        top: false,
        child: !_current
            ? ListView(
                padding: const EdgeInsets.all(24),
                children: [
                  const Text(
                    'Store access changed. Reopen the customer from the selected store.',
                  ),
                  TextButton(
                    onPressed: () =>
                        mobile_tokens.completeLetbuyySurface(context),
                    child: const Text('Back to customers'),
                  ),
                ],
              )
            : RefreshIndicator(
                onRefresh: () async {
                  if (_active &&
                      !_reading &&
                      !_isMutating &&
                      generation == _loadGeneration)
                    await _loadCustomer();
                },
                child: ListView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  padding: const EdgeInsets.all(16),
                  children: [
                    if (_isLoading || _reading)
                      Padding(
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        child: Column(
                          children: [
                            const mobile_tokens.LoadingIndicator(),
                            const SizedBox(height: 8),
                            Text(
                              customer == null
                                  ? 'Loading customer…'
                                  : 'Refreshing this customer. Previously loaded data is shown below.',
                            ),
                          ],
                        ),
                      ),
                    if (_isMutating)
                      const Padding(
                        padding: EdgeInsets.symmetric(vertical: 12),
                        child: Column(
                          children: [
                            mobile_tokens.LoadingIndicator(),
                            SizedBox(height: 8),
                            Text('Updating customer…'),
                          ],
                        ),
                      ),
                    if (denied)
                      _readState(
                        'Customer unavailable',
                        'Private customer information has been removed. Recheck store access before continuing.',
                        retry: !_reading && !_isMutating,
                      ),
                    if (_error != null && !denied)
                      _readState(
                        customer == null
                            ? 'Customer unavailable'
                            : 'Refresh unavailable',
                        _error!,
                        retry: !_reading && !_isMutating,
                      ),
                    if (mayShow &&
                        customer == null &&
                        !_isLoading &&
                        !_reading &&
                        _error == null)
                      _readState(
                        'Customer unavailable',
                        'Refresh to read this customer from the selected store.',
                        retry: !_isMutating,
                      ),
                    if (mayShow && customer != null) ...[
                      if (!fresh)
                        Padding(
                          padding: const EdgeInsets.only(bottom: 16),
                          child: Text(
                            accepted
                                ? 'Saved customer snapshot. Refresh before making changes.'
                                : 'Previously loaded profile. Refresh to check current customer data.',
                          ),
                        ),
                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: [
                          Tooltip(
                            message: 'Edit customer',
                            excludeFromSemantics: true,
                            child: FilledButton.icon(
                              onPressed: _action(_ready, _editCustomer),
                              icon: const Icon(Icons.edit_outlined),
                              label: const Text('Edit customer'),
                            ),
                          ),
                          Tooltip(
                            message: 'Email customer',
                            excludeFromSemantics: true,
                            child: OutlinedButton.icon(
                              onPressed: _action(_ready, _emailCustomer),
                              icon: const Icon(Icons.email_outlined),
                              label: const Text('Email customer'),
                            ),
                          ),
                          if (_whatsAppStatusKnown &&
                              _whatsAppAvailable &&
                              (customer.phone?.trim().isNotEmpty ?? false))
                            Tooltip(
                              message: 'WhatsApp customer',
                              excludeFromSemantics: true,
                              child: OutlinedButton.icon(
                                onPressed: _action(_ready, _whatsAppCustomer),
                                icon: const Icon(Icons.chat_outlined),
                                label: const Text('WhatsApp customer'),
                              ),
                            ),
                          PopupMenuButton<String>(
                            tooltip: 'Customer actions',
                            enabled: _ready,
                            onSelected: (value) {
                              if (!_ready || generation != _loadGeneration)
                                return;
                              if (value == 'merge') _mergeCustomer();
                              if (value == 'delete') _deleteCustomerProfile();
                            },
                            itemBuilder: (_) => const [
                              PopupMenuItem(
                                value: 'merge',
                                child: Text('Merge'),
                              ),
                              PopupMenuItem(
                                value: 'delete',
                                child: Text('Delete'),
                              ),
                            ],
                          ),
                        ],
                      ),
                      const SizedBox(height: 16),
                      _summary(customer),
                      const SizedBox(height: 16),
                      _crmSection(customer),
                      const SizedBox(height: 16),
                      _addressesSection(),
                      const SizedBox(height: 16),
                      _ordersSection(),
                      const SizedBox(height: 16),
                      _whatsAppSection(customer),
                    ],
                    SizedBox(height: MediaQuery.paddingOf(context).bottom + 24),
                  ],
                ),
              ),
      ),
    );
  }

  Widget _readState(String title, String message, {bool retry = false}) =>
      Padding(
        padding: const EdgeInsets.symmetric(vertical: 16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(title, style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 8),
            Text(message),
            if (retry)
              Align(
                alignment: AlignmentDirectional.centerStart,
                child: TextButton(
                  onPressed: _action(
                    !_reading && !_isMutating,
                    _loadCustomer,
                    fresh: false,
                    allowDenied: true,
                  ),
                  child: const Text('Retry'),
                ),
              ),
          ],
        ),
      );
  Widget _section({String? title, Widget? trailing, required Widget child}) =>
      Card(
        margin: EdgeInsets.zero,
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (title != null) ...[
                Text(title, style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: 12),
              ],
              if (trailing != null) ...[
                Align(
                  alignment: AlignmentDirectional.centerStart,
                  child: trailing,
                ),
                const SizedBox(height: 12),
              ],
              child,
            ],
          ),
        ),
      );
  num? _presentNumber(Object? value) {
    final result = value is num
        ? value
        : value is String
        ? num.tryParse(value)
        : null;
    return result != null && result.isFinite ? result : null;
  }

  Widget _summary(CustomerContract customer) {
    final count = _presentNumber(customer['order_count']);
    final hasCount =
        count != null && count >= 0 && count == count.roundToDouble();
    return _section(
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
                  style: Theme.of(context).textTheme.titleLarge,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Align(
            alignment: AlignmentDirectional.centerStart,
            child: _statusChip(
              customer['status'] is String
                  ? _nonEmpty(customer['status'])
                  : null,
            ),
          ),
          const SizedBox(height: 16),
          _infoRow(
            Icons.email_outlined,
            'Email',
            _nonEmpty(customer.email) ?? 'No email',
          ),
          _infoRow(
            Icons.call_outlined,
            'Phone',
            _nonEmpty(customer.phone) ?? 'No phone',
          ),
          _infoRow(
            Icons.badge_outlined,
            'GSTIN',
            _nonEmpty(customer['gstin']) ?? 'Not provided',
          ),
          const SizedBox(height: 16),
          mobile_tokens.StatGrid(
            children: [
              mobile_tokens.StatTile(
                icon: Icons.shopping_bag_outlined,
                label: 'Orders',
                value: hasCount
                    ? customer.orderCount.toString()
                    : 'Order count unavailable',
              ),
              mobile_tokens.StatTile(
                icon: Icons.payments_outlined,
                label: 'Total spent',
                value: _presentNumber(customer['total_spent']) != null
                    ? _money(customer.totalSpent)
                    : 'Spend unavailable',
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _infoRow(IconData icon, String label, String value) => Padding(
    padding: const EdgeInsets.only(bottom: 12),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Wrap(
          spacing: 8,
          runSpacing: 4,
          crossAxisAlignment: WrapCrossAlignment.center,
          children: [
            ExcludeSemantics(child: Icon(icon)),
            Text(label, style: Theme.of(context).textTheme.labelLarge),
          ],
        ),
        const SizedBox(height: 4),
        Text(value),
      ],
    ),
  );
  Widget _statusChip(String? status) => mobile_tokens.LetbuyyStatusBadge(
    label: status == null ? 'Status unavailable' : _titleCase(status),
    tone: status == null
        ? mobile_tokens.LetbuyyStatusTone.neutral
        : status == 'active'
        ? mobile_tokens.LetbuyyStatusTone.success
        : mobile_tokens.LetbuyyStatusTone.warning,
  );

  Widget _crmSection(CustomerContract customer) {
    final tags = _customerTags(customer),
        profileNote = _nonEmpty(customer['notes']);
    return _section(
      title: 'Customer CRM',
      trailing: Wrap(
        spacing: 8,
        runSpacing: 8,
        children: [
          TextButton.icon(
            onPressed: _action(_ready, _editTags),
            icon: const Icon(Icons.sell_outlined),
            label: const Text('Edit tags'),
          ),
          TextButton.icon(
            onPressed: _action(_ready, _addNote),
            icon: const Icon(Icons.note_add_outlined),
            label: const Text('Add note'),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('Tags', style: Theme.of(context).textTheme.labelLarge),
          const SizedBox(height: 8),
          if (customer['tags'] is! List)
            const Text('Tags unavailable')
          else if (tags.isEmpty)
            const Text('No tags yet.')
          else
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [for (final tag in tags) Chip(label: Text(tag))],
            ),
          if (profileNote != null) ...[
            const SizedBox(height: 16),
            Text(
              'Profile notes',
              style: Theme.of(context).textTheme.labelLarge,
            ),
            const SizedBox(height: 8),
            Text(profileNote),
          ],
          const SizedBox(height: 16),
          Text('Customer notes', style: Theme.of(context).textTheme.labelLarge),
          const Text('Up to 100 recent notes.'),
          if (_notesRead == _CustomerSectionRead.loading)
            const Text('Loading notes…')
          else if (_notesRead == _CustomerSectionRead.failed)
            _readState(
              'Notes unavailable',
              'Refresh this customer to retry loading notes.',
              retry: !_reading && !_isMutating,
            )
          else if (_notes.isEmpty)
            const Text('No notes saved for this customer.')
          else
            for (final note in _notes)
              Padding(
                padding: const EdgeInsets.only(top: 12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(_nonEmpty(note['note']) ?? 'Note text unavailable'),
                    if (_nonEmpty(note['created_at']) != null)
                      Text(
                        _shortDate(note['created_at'].toString()),
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                  ],
                ),
              ),
        ],
      ),
    );
  }

  Widget _addressesSection() => _section(
    title: 'Addresses',
    trailing: TextButton.icon(
      onPressed: _action(_ready, () => _saveAddress(null)),
      icon: const Icon(Icons.add_rounded),
      label: const Text('Add address'),
    ),
    child: _addressRead == _CustomerSectionRead.loading
        ? const Text('Loading addresses…')
        : _addressRead == _CustomerSectionRead.failed
        ? _readState(
            'Addresses unavailable',
            'Refresh this customer to retry loading addresses.',
            retry: !_reading && !_isMutating,
          )
        : _addresses.isEmpty
        ? const Text('No saved addresses.')
        : Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [for (final address in _addresses) _addressCard(address)],
          ),
  );
  Widget _addressCard(CustomerAddressContract address) {
    final canChange =
        _ready &&
        _addressRead == _CustomerSectionRead.ready &&
        _addresses.contains(address);
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            [
                  _nonEmpty(address['label']),
                  if (address.isDefault) 'Default',
                ].whereType<String>().join(' | ').ifEmpty ??
                'Address',
            style: Theme.of(context).textTheme.titleSmall,
          ),
          const SizedBox(height: 8),
          Text(_addressText(address)),
          if (_nonEmpty(address['customer_phone']) != null &&
              _nonEmpty(address['customer_phone']) != _nonEmpty(address.phone))
            Text(address['customer_phone'].toString()),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              TextButton.icon(
                onPressed: _action(canChange, () => _saveAddress(address)),
                icon: const Icon(Icons.edit_outlined),
                label: const Text('Edit address'),
              ),
              TextButton.icon(
                onPressed: _action(canChange, () => _deleteAddress(address)),
                icon: const Icon(Icons.delete_outline_rounded),
                label: const Text('Delete address'),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _ordersSection() => _section(
    title: 'Recent orders',
    child: _ordersRead == _CustomerSectionRead.loading
        ? const Text('Loading recent orders…')
        : _ordersRead == _CustomerSectionRead.failed
        ? _readState(
            'Recent orders unavailable',
            'Refresh this customer to retry its recent order history.',
            retry: !_reading && !_isMutating,
          )
        : Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (_ordersStored)
                const Text(
                  'Saved order snapshot. Refresh to check current history.',
                ),
              const Text('Up to 10 recent orders.'),
              const SizedBox(height: 8),
              if (_orders.isEmpty)
                const Text('No recent orders returned for this customer.')
              else
                for (final order in _orders.take(10)) _orderRow(order),
            ],
          ),
  );
  Widget _orderRow(OrderContract order) {
    final orderLabel = order.orderNumber.isEmpty ? order.id : order.orderNumber;
    final generation = _loadGeneration;
    void open() {
      if (!_active ||
          !_mayPresent ||
          generation != _loadGeneration ||
          _ordersRead != _CustomerSectionRead.ready ||
          !_orders.contains(order))
        return;
      Navigator.pushNamed(
        context,
        AppRoutes.orderDetail,
        arguments: {'orderId': order.id, 'order': order},
      );
    }

    final hasTotal = _presentNumber(order['total']) != null;
    final currency = _nonEmpty(order['currency']);
    final amount = !hasTotal
        ? 'Total unavailable'
        : currency == null
        ? 'Currency unavailable'
        : currency == 'INR'
        ? _money(order.total)
        : '$currency ${NumberFormat.decimalPattern('en_IN').format(order.total)}';
    final status = _nonEmpty(order['status']);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: AccessibleTapRegion(
        label:
            'Order $orderLabel, ${status == null ? 'Status unavailable' : _titleCase(status)}, $amount',
        hint: 'Open order details',
        onTap: open,
        child: InkWell(
          excludeFromSemantics: true,
          onTap: open,
          child: Padding(
            padding: const EdgeInsets.all(8),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(orderLabel, style: Theme.of(context).textTheme.titleSmall),
                const SizedBox(height: 8),
                Text(amount),
                Text(
                  status == null ? 'Status unavailable' : _titleCase(status),
                ),
                if (_nonEmpty(order['created_at']) != null)
                  Text(_shortDate(order['created_at'].toString())),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _whatsAppSection(CustomerContract customer) => _section(
    title: 'WhatsApp',
    child: _whatsAppRead == _CustomerSectionRead.loading
        ? const Text('Loading WhatsApp status and history…')
        : _whatsAppRead == _CustomerSectionRead.unavailable
        ? const Text('WhatsApp is unavailable for this view.')
        : Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (_whatsAppStatusKnown && !_whatsAppAvailable)
                const Text('WhatsApp messaging is not available.'),
              if (_whatsAppRead == _CustomerSectionRead.failed)
                _readState(
                  _whatsAppStatusKnown
                      ? 'WhatsApp history unavailable'
                      : 'WhatsApp status unavailable',
                  'Refresh this customer to recheck status and message history.',
                  retry: !_reading && !_isMutating,
                )
              else if (_whatsAppTimeline.isEmpty)
                const Text('No WhatsApp history returned for this customer.')
              else
                for (final message in _whatsAppTimeline) _whatsAppRow(message),
            ],
          ),
  );
  Widget _whatsAppRow(Map<String, dynamic> message) {
    final direction = message['direction'],
        status = _nonEmpty(message['status']);
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            direction == 'outbound'
                ? 'Outbound'
                : direction == 'inbound'
                ? 'Inbound'
                : 'Direction unavailable',
            style: Theme.of(context).textTheme.labelLarge,
          ),
          Text(status == null ? 'Status unavailable' : _titleCase(status)),
          if (_nonEmpty(message['created_at']) != null)
            Text(_shortDate(message['created_at'].toString())),
          const SizedBox(height: 8),
          Text(_nonEmpty(message['message']) ?? 'Message text unavailable'),
        ],
      ),
    );
  }

  List<OrderContract> _ordersFromCustomer(CustomerContract customer) {
    final rows = customer['orders'];
    if (rows is! List) return const [];
    return rows
        .whereType<Map>()
        .map((row) => OrderContract.fromJson(Map<String, dynamic>.from(row)))
        .toList(growable: false);
  }

  String _customerName(CustomerContract? customer) {
    if (customer == null) return 'Customer';
    return _nonEmpty(customer.displayName) ??
        [
          _nonEmpty(customer['first_name']),
          _nonEmpty(customer['last_name']),
        ].whereType<String>().join(' ').trim().ifEmpty ??
        _nonEmpty(customer.email) ??
        _nonEmpty(customer.phone) ??
        'Customer';
  }

  (String, String) _splitName(String value) {
    final parts = value
        .trim()
        .split(RegExp(r'\s+'))
        .where((part) => part.isNotEmpty);
    if (parts.isEmpty) return ('', '');
    return (parts.first, parts.skip(1).join(' '));
  }

  List<String> _customerTags(CustomerContract customer) {
    final raw = customer['tags'];
    if (raw is! List) return const [];
    return raw
        .map((tag) => tag.toString().trim())
        .where((tag) => tag.isNotEmpty)
        .toList(growable: false);
  }

  String _initials(CustomerContract customer) {
    final parts = _customerName(
      customer,
    ).split(RegExp(r'\s+')).where((part) => part.isNotEmpty);
    final initials = parts.take(2).map((part) => part[0].toUpperCase()).join();
    return initials.isEmpty ? 'C' : initials;
  }

  String _addressText(CustomerAddressContract address) {
    return [
      address.fullName,
      address.addressLine1,
      _nonEmpty(address.addressLine2),
      [
        address.city,
        address.state,
        address.postalCode,
      ].where((part) => part.trim().isNotEmpty).join(', '),
      _nonEmpty(address.phone),
    ].whereType<String>().where((line) => line.trim().isNotEmpty).join('\n');
  }

  String _money(double amount) {
    return 'INR ${NumberFormat.decimalPattern('en_IN').format(amount)}';
  }

  String _shortDate(String raw) {
    final date = DateTime.tryParse(raw);
    return date == null
        ? raw
        : DateFormat('MMM d, yyyy').format(date.toLocal());
  }

  String _titleCase(String value) {
    final fallback = value.trim().isEmpty ? 'unknown' : value.trim();
    return fallback
        .split(RegExp(r'[\s_]+'))
        .where((part) => part.isNotEmpty)
        .map((part) => '${part[0].toUpperCase()}${part.substring(1)}')
        .join(' ');
  }

  String? _nonEmpty(Object? value) {
    final text = value?.toString().trim();
    return text == null || text.isEmpty ? null : text;
  }

  Map<String, dynamic> _whatsAppVariables(CustomerContract customer) {
    final latestOrder =
        _ordersRead == _CustomerSectionRead.ready &&
            !_ordersStored &&
            !_reading &&
            _orders.isNotEmpty
        ? _orders.first
        : null;
    final storeName = context.read<StoreContext>().selectedStore?.name;
    return {
      if (_nonEmpty(customer.displayName) case final String name)
        'customer_name': name,
      if (_nonEmpty(latestOrder?['order_number']) case final String number)
        'order_number': number,
      if (_nonEmpty(latestOrder?['status']) case final String status)
        'status': status,
      if (latestOrder?['total'] is num) 'total': _money(latestOrder!.total),
      if (_nonEmpty(latestOrder?['carrier']) case final String carrier)
        'carrier': carrier,
      if (_nonEmpty(latestOrder?['tracking_number']) case final String tracking)
        'tracking_number': tracking,
      if (_nonEmpty(storeName) case final String name) 'store_name': name,
      // This destination has no canonical cart checkout URL. Keep the existing
      // option visible with an unavailable reason instead of fabricating one.
    };
  }
}

class _WhatsAppLoadResult {
  const _WhatsAppLoadResult({
    this.available = false,
    this.statusKnown = false,
    this.timelineFailed = false,
    this.timeline = const <Map<String, dynamic>>[],
  });

  final bool available, statusKnown, timelineFailed;
  final List<Map<String, dynamic>> timeline;
}

extension on String {
  String? get ifEmpty => isEmpty ? null : this;
}
