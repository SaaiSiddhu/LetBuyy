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
  List<Map<String, dynamic>> _notes = [];
  List<Map<String, dynamic>> _whatsAppTimeline = [];
  bool _whatsAppAvailable = false;
  bool _isLoading = true;
  bool _isMutating = false;
  String? _error;
  Object? _boundContext;
  String? _boundSiteId;
  int _loadGeneration = 0;

  bool get _current =>
      mounted &&
      _boundSiteId != null &&
      context.read<StoreContext>().requestContextKey == _boundContext &&
      context.read<StoreContext>().selectedStoreId == _boundSiteId;

  late AppThemeColors colors;

  @override
  void initState() {
    super.initState();
    final stores = context.read<StoreContext>();
    _boundContext = stores.requestContextKey;
    _boundSiteId = stores.selectedStoreId;
    _loadCustomer();
  }

  Future<void> _loadCustomer() async {
    if (!_current) return;
    final generation = ++_loadGeneration;
    bool currentLoad() => _current && generation == _loadGeneration;
    if (widget.initialCustomer != null &&
        widget.initialCustomer!.storeId != _boundSiteId) {
      setState(() {
        _customer = null;
        _isLoading = false;
        _error = 'Open this customer from the selected store.';
      });
      return;
    }
    if (widget.email.trim().isEmpty) {
      setState(() {
        _isLoading = false;
        _error = 'Customer email is missing.';
      });
      return;
    }

    setState(() {
      _isLoading = _customer == null;
      _error = null;
    });

    try {
      final service = context.read<CustomerService>();
      final customer = await service.fetchCustomerByEmail(
        widget.email,
        storeId: _boundSiteId,
      );
      if (!currentLoad()) return;
      final storeId = customer.storeId.trim();
      final addresses = await service.fetchAddresses(
        widget.email,
        storeId: storeId.isEmpty ? null : storeId,
      );
      if (!currentLoad()) return;
      final notes = storeId.isEmpty
          ? const <Map<String, dynamic>>[]
          : await service.fetchNotes(widget.email, storeId: storeId);
      if (!currentLoad()) return;
      final orders = await _loadRecentOrders(customer);
      if (!currentLoad()) return;
      final whatsApp = storeId.isEmpty
          ? const _WhatsAppLoadResult()
          : await _loadWhatsApp(customer, storeId);
      if (currentLoad()) {
        setState(() {
          _customer = customer;
          _addresses = addresses;
          _orders = orders;
          _notes = notes;
          _whatsAppAvailable = whatsApp.available;
          _whatsAppTimeline = whatsApp.timeline;
          _isLoading = false;
        });
      }
    } catch (error) {
      if (currentLoad()) {
        setState(() {
          _customer = null;
          _addresses = [];
          _orders = [];
          _notes = [];
          _whatsAppTimeline = [];
          _error =
              'Customer access could not be confirmed. Check your connection and retry.';
          _isLoading = false;
        });
      }
    }
  }

  Future<List<OrderContract>> _loadRecentOrders(
    CustomerContract customer,
  ) async {
    final payloadOrders = _ordersFromCustomer(customer);
    final storeId = customer.storeId.trim();
    final email = customer.email?.trim();
    if (storeId.isEmpty || email == null || email.isEmpty) {
      return payloadOrders;
    }

    try {
      return await context.read<OrderService>().fetchOrders(
        storeId,
        customerEmail: email,
        limit: 10,
      );
    } catch (_) {
      return const [];
    }
  }

  Future<_WhatsAppLoadResult> _loadWhatsApp(
    CustomerContract customer,
    String storeId,
  ) async {
    final service = Provider.of<WhatsAppService?>(context, listen: false);
    if (service == null) return const _WhatsAppLoadResult();

    try {
      final status = await service.fetchStatus(storeId);
      final available = status['available'] == true;
      if (!_current) return const _WhatsAppLoadResult();
      final timeline = await service.fetchTimeline(
        storeId,
        customerEmail: customer.email,
        customerPhone: customer.phone,
      );
      return _WhatsAppLoadResult(available: available, timeline: timeline);
    } catch (_) {
      return const _WhatsAppLoadResult();
    }
  }

  Future<void> _saveAddress(CustomerAddressContract? existing) async {
    if (!_current) return;
    final request = await _showAddressDialog(existing);
    if (!_current || request == null) return;

    setState(() => _isMutating = true);
    try {
      final service = context.read<CustomerService>();
      if (existing == null) {
        await service.createAddress(widget.email, request);
      } else {
        await service.updateAddress(widget.email, existing.id, request);
      }
      await _loadCustomer();
      if (_current) {
        _showSnackBar(existing == null ? 'Address added' : 'Address updated');
      }
    } catch (error) {
      if (_current)
        _showSnackBar(
          'Customer update could not be confirmed. Refresh before retrying.',
          isError: true,
        );
    } finally {
      if (_current) setState(() => _isMutating = false);
    }
  }

  Future<void> _deleteAddress(CustomerAddressContract address) async {
    if (!_current) return;
    final confirmed = await _showGuardedDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: colors.card,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text(
          'Delete address?',
          style: TextStyle(color: colors.textPrimary),
        ),
        content: Text(
          'This removes the saved customer address.',
          style: TextStyle(color: colors.textSecondary),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: Text(
              'Cancel',
              style: TextStyle(color: colors.textSecondary),
            ),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: Text('Delete', style: TextStyle(color: colors.error)),
          ),
        ],
      ),
    );

    if (!_current || confirmed != true) return;

    setState(() => _isMutating = true);
    try {
      await context.read<CustomerService>().deleteAddress(
        widget.email,
        address.id,
      );
      await _loadCustomer();
      if (_current) _showSnackBar('Address deleted');
    } catch (error) {
      if (_current)
        _showSnackBar(
          'Customer update could not be confirmed. Refresh before retrying.',
          isError: true,
        );
    } finally {
      if (_current) setState(() => _isMutating = false);
    }
  }

  Future<void> _editCustomer() async {
    if (!_current) return;
    final customer = _customer;
    if (customer == null) return;
    final storeId = customer.storeId.trim();

    final request = await _showCustomerDialog(customer);
    if (!_current || request == null) return;

    setState(() => _isMutating = true);
    try {
      await context.read<CustomerService>().updateCustomer(
        widget.email,
        request,
        storeId: storeId.isEmpty ? null : storeId,
      );
      await _loadCustomer();
      if (_current) {
        _showSnackBar('Customer updated');
      }
    } catch (error) {
      if (_current)
        _showSnackBar(
          'Customer update could not be confirmed. Refresh before retrying.',
          isError: true,
        );
    } finally {
      if (_current) setState(() => _isMutating = false);
    }
  }

  Future<void> _addNote() async {
    if (!_current) return;
    final customer = _customer;
    final storeId = customer?.storeId.trim() ?? '';
    if (storeId.isEmpty) {
      _showSnackBar('Customer store is unavailable.', isError: true);
      return;
    }

    final note = await _showNoteDialog();
    if (!_current || note == null || note.trim().isEmpty) return;

    setState(() => _isMutating = true);
    try {
      await context.read<CustomerService>().addNote(
        widget.email,
        storeId: storeId,
        note: note.trim(),
      );
      await _loadCustomer();
      if (_current) _showSnackBar('Note saved');
    } catch (error) {
      if (_current)
        _showSnackBar(
          'Customer update could not be confirmed. Refresh before retrying.',
          isError: true,
        );
    } finally {
      if (_current) setState(() => _isMutating = false);
    }
  }

  Future<void> _editTags() async {
    if (!_current) return;
    final customer = _customer;
    final storeId = customer?.storeId.trim() ?? '';
    if (customer == null || storeId.isEmpty) {
      _showSnackBar('Customer store is unavailable.', isError: true);
      return;
    }

    final tags = await _showTagsDialog(_customerTags(customer));
    if (!_current || tags == null) return;

    setState(() => _isMutating = true);
    try {
      await context.read<CustomerService>().updateTags(
        widget.email,
        storeId: storeId,
        tags: tags,
      );
      await _loadCustomer();
      if (_current) {
        _showSnackBar('Tags updated');
      }
    } catch (error) {
      if (_current)
        _showSnackBar(
          'Customer update could not be confirmed. Refresh before retrying.',
          isError: true,
        );
    } finally {
      if (_current) setState(() => _isMutating = false);
    }
  }

  Future<void> _emailCustomer() async {
    if (!_current) return;
    final customer = _customer;
    final storeId = customer?.storeId.trim() ?? '';
    if (storeId.isEmpty) {
      _showSnackBar('Customer store is unavailable.', isError: true);
      return;
    }

    final request = await _showEmailDialog();
    if (!_current || request == null) return;

    setState(() => _isMutating = true);
    try {
      await context.read<CustomerService>().emailCustomer(
        widget.email,
        storeId: storeId,
        subject: request['subject'] ?? '',
        message: request['message'] ?? '',
      );
      if (_current) _showSnackBar('Email sent');
    } catch (_) {
      if (_current) {
        _showSnackBar(
          'Customer email is unavailable right now.',
          isError: true,
        );
      }
    } finally {
      if (_current) setState(() => _isMutating = false);
    }
  }

  Future<void> _whatsAppCustomer() async {
    if (!_current) return;
    final customer = _customer;
    final storeId = customer?.storeId.trim() ?? '';
    final phone = customer?.phone?.trim() ?? '';
    if (customer == null || storeId.isEmpty || phone.isEmpty) {
      _showSnackBar('Customer phone is unavailable.', isError: true);
      return;
    }

    final request = await _showWhatsAppDialog(customer);
    if (!_current || request == null) return;

    setState(() => _isMutating = true);
    try {
      await context.read<WhatsAppService>().sendTemplate(
        storeId: storeId,
        customerEmail: customer.email,
        customerPhone: phone,
        template: request['template'] ?? 'custom_message',
        message: request['message'],
        variables: _whatsAppVariables(customer),
      );
      if (!_current) return;
      final timeline = await context.read<WhatsAppService>().fetchTimeline(
        storeId,
        customerEmail: customer.email,
        customerPhone: phone,
      );
      if (_current) {
        setState(() => _whatsAppTimeline = timeline);
        _showSnackBar('WhatsApp message queued');
      }
    } on WhatsAppUnavailableException {
      if (_current) {
        _showSnackBar(
          'WhatsApp messages are unavailable right now.',
          isError: true,
        );
      }
    } catch (_) {
      if (_current) {
        _showSnackBar('Could not send that WhatsApp message.', isError: true);
      }
    } finally {
      if (_current) setState(() => _isMutating = false);
    }
  }

  Future<void> _mergeCustomer() async {
    if (!_current) return;
    final customer = _customer;
    final storeId = customer?.storeId.trim() ?? '';
    if (storeId.isEmpty) {
      _showSnackBar('Customer store is unavailable.', isError: true);
      return;
    }

    final targetEmail = await _showMergeDialog();
    if (!_current || targetEmail == null || targetEmail.trim().isEmpty) return;

    setState(() => _isMutating = true);
    try {
      final merged = await context.read<CustomerService>().mergeCustomer(
        widget.email,
        storeId: storeId,
        targetEmail: targetEmail.trim(),
      );
      if (!_current) return;
      _showSnackBar('Customer merged');
      Navigator.pop(context, {'merged_into': merged.email});
    } catch (_) {
      if (_current) {
        _showSnackBar('Could not merge that customer.', isError: true);
      }
    } finally {
      if (_current) setState(() => _isMutating = false);
    }
  }

  Future<void> _deleteCustomerProfile() async {
    if (!_current) return;
    final customer = _customer;
    final storeId = customer?.storeId.trim() ?? '';
    if (storeId.isEmpty) {
      _showSnackBar('Customer store is unavailable.', isError: true);
      return;
    }

    final confirmed = await _showGuardedDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: colors.card,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text(
          'Delete customer?',
          style: TextStyle(color: colors.textPrimary),
        ),
        content: Text(
          'This redacts the customer profile and removes saved addresses.',
          style: TextStyle(color: colors.textSecondary),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: Text(
              'Cancel',
              style: TextStyle(color: colors.textSecondary),
            ),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: Text('Delete', style: TextStyle(color: colors.error)),
          ),
        ],
      ),
    );
    if (!_current || confirmed != true) return;

    setState(() => _isMutating = true);
    try {
      await context.read<CustomerService>().deleteCustomer(
        widget.email,
        storeId: storeId,
      );
      if (!_current) return;
      _showSnackBar('Customer deleted');
      Navigator.pop(context, {'deleted': true});
    } catch (_) {
      if (_current) {
        _showSnackBar('Could not delete that customer.', isError: true);
      }
    } finally {
      if (_current) setState(() => _isMutating = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    colors = AppThemeColors.of(context);
    context.watch<StoreContext>();
    if (!_current)
      return Scaffold(
        appBar: AppBar(title: const Text('Customer')),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Text(
                  'Store access changed. Reopen the customer from the selected store.',
                ),
                TextButton(
                  onPressed: () => Navigator.maybePop(context),
                  child: const Text('Back to customers'),
                ),
              ],
            ),
          ),
        ),
      );

    return Scaffold(
      backgroundColor: colors.bgStart,
      body: Container(
        decoration: colors.backgroundGradient,
        child: SafeArea(
          child: Column(
            children: [
              _buildHeader(),
              Expanded(child: _buildBody()),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildHeader() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(8, 8, 12, 8),
      child: Row(
        children: [
          IconButton(
            icon: Icon(Icons.arrow_back_rounded, color: colors.textPrimary),
            tooltip: 'Back',
            onPressed: () => Navigator.pop(context),
          ),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  _customerName(_customer),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: colors.textPrimary,
                    fontSize: 20,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                Text(
                  _customer == null ? '' : widget.email,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(color: colors.textSecondary, fontSize: 12),
                ),
              ],
            ),
          ),
          if (_customer != null)
            IconButton(
              icon: Icon(Icons.edit_outlined, color: colors.textSecondary),
              tooltip: 'Edit customer',
              onPressed: _isMutating ? null : _editCustomer,
            ),
          if (_customer != null)
            IconButton(
              icon: Icon(Icons.email_outlined, color: colors.textSecondary),
              tooltip: 'Email customer',
              onPressed: _isMutating ? null : _emailCustomer,
            ),
          if (_whatsAppAvailable &&
              (_customer?.phone?.trim().isNotEmpty ?? false))
            IconButton(
              icon: Icon(Icons.chat_outlined, color: colors.textSecondary),
              tooltip: 'WhatsApp customer',
              onPressed: _isMutating ? null : _whatsAppCustomer,
            ),
          IconButton(
            icon: Icon(Icons.refresh_rounded, color: colors.textSecondary),
            tooltip: 'Refresh',
            onPressed: _loadCustomer,
          ),
          if (_customer != null)
            PopupMenuButton<String>(
              tooltip: 'Customer actions',
              icon: Icon(Icons.more_vert_rounded, color: colors.textSecondary),
              enabled: !_isMutating,
              color: colors.card,
              onSelected: (value) {
                if (value == 'merge') _mergeCustomer();
                if (value == 'delete') _deleteCustomerProfile();
              },
              itemBuilder: (context) => [
                PopupMenuItem(
                  value: 'merge',
                  child: Row(
                    children: [
                      Icon(Icons.call_merge_rounded, color: colors.textPrimary),
                      const SizedBox(width: 10),
                      Text(
                        'Merge',
                        style: TextStyle(color: colors.textPrimary),
                      ),
                    ],
                  ),
                ),
                PopupMenuItem(
                  value: 'delete',
                  child: Row(
                    children: [
                      Icon(Icons.delete_outline_rounded, color: colors.error),
                      const SizedBox(width: 10),
                      Text('Delete', style: TextStyle(color: colors.error)),
                    ],
                  ),
                ),
              ],
            ),
        ],
      ),
    );
  }

  Widget _buildBody() {
    if (_isLoading && _customer == null) {
      return Center(
        child: CircularProgressIndicator(
          color: mobile_tokens.LetbuyyColorTokens.brandPrimary,
        ),
      );
    }

    final customer = _customer;
    if (customer == null) {
      return _centerState(
        icon: Icons.person_off_outlined,
        title: 'Customer unavailable',
        subtitle: _error ?? 'Try again from the customer list.',
        action: TextButton.icon(
          onPressed: _loadCustomer,
          icon: const Icon(Icons.refresh_rounded),
          label: const Text('Retry'),
        ),
      );
    }

    return RefreshIndicator(
      color: mobile_tokens.LetbuyyColorTokens.brandPrimary,
      onRefresh: _loadCustomer,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
        children: [
          if (_error != null) _inlineWarning(_error!),
          _summary(customer),
          const SizedBox(height: 12),
          _crmSection(customer),
          const SizedBox(height: 12),
          if (_whatsAppAvailable || _whatsAppTimeline.isNotEmpty) ...[
            _whatsAppSection(customer),
            const SizedBox(height: 12),
          ],
          _addressesSection(),
          const SizedBox(height: 12),
          _ordersSection(),
        ],
      ),
    );
  }

  Widget _summary(CustomerContract customer) {
    return _section(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              CircleAvatar(
                radius: 28,
                backgroundColor: mobile_tokens.LetbuyyColorTokens.brandPrimary
                    .withValues(alpha: 0.12),
                child: Text(
                  _initials(customer),
                  style: TextStyle(
                    color: mobile_tokens.LetbuyyColorTokens.brandPrimary,
                    fontWeight: FontWeight.w800,
                    fontSize: 18,
                  ),
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      _customerName(customer),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: colors.textPrimary,
                        fontSize: 18,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 4),
                    _statusChip(customer.status),
                  ],
                ),
              ),
            ],
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
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: _metric(
                  'Orders',
                  customer.orderCount.toString(),
                  Icons.shopping_bag_outlined,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _metric(
                  'Total spent',
                  _money(customer.totalSpent),
                  Icons.payments_outlined,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _addressesSection() {
    return _section(
      title: 'Addresses',
      trailing: TextButton.icon(
        onPressed: _isMutating ? null : () => _saveAddress(null),
        icon: const Icon(Icons.add_rounded, size: 18),
        label: const Text('Add'),
      ),
      child: _addresses.isEmpty
          ? Text(
              'No saved addresses.',
              style: TextStyle(color: colors.textSecondary),
            )
          : Column(
              children: [
                for (final address in _addresses) ...[
                  _addressCard(address),
                  if (address != _addresses.last)
                    Divider(height: 20, color: colors.divider),
                ],
              ],
            ),
    );
  }

  Widget _crmSection(CustomerContract customer) {
    final tags = _customerTags(customer);
    final latestNote = _notes.isEmpty
        ? _nonEmpty(customer['notes'])
        : _nonEmpty(_notes.first['note']);

    return _section(
      title: 'Customer CRM',
      trailing: Wrap(
        spacing: 4,
        children: [
          IconButton(
            icon: const Icon(Icons.sell_outlined, size: 20),
            tooltip: 'Edit tags',
            onPressed: _isMutating ? null : _editTags,
          ),
          IconButton(
            icon: const Icon(Icons.note_add_outlined, size: 20),
            tooltip: 'Add note',
            onPressed: _isMutating ? null : _addNote,
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (tags.isEmpty)
            Text('No tags yet.', style: TextStyle(color: colors.textSecondary))
          else
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                for (final tag in tags)
                  Chip(
                    label: Text(tag),
                    backgroundColor: colors.surfaceVariant,
                    side: BorderSide(color: colors.divider),
                    labelStyle: TextStyle(color: colors.textPrimary),
                  ),
              ],
            ),
          const SizedBox(height: 12),
          Text(
            latestNote ?? 'No notes saved for this customer.',
            maxLines: 4,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(color: colors.textSecondary, height: 1.35),
          ),
          if (_notes.length > 1) ...[
            const SizedBox(height: 8),
            Text(
              '${_notes.length} notes saved',
              style: TextStyle(color: colors.textTertiary, fontSize: 12),
            ),
          ],
        ],
      ),
    );
  }

  Widget _whatsAppSection(CustomerContract customer) {
    return _section(
      title: 'WhatsApp',
      trailing:
          _whatsAppAvailable && (customer.phone?.trim().isNotEmpty ?? false)
          ? TextButton.icon(
              onPressed: _isMutating ? null : _whatsAppCustomer,
              icon: const Icon(Icons.send_rounded, size: 18),
              label: const Text('Send'),
            )
          : null,
      child: _whatsAppTimeline.isEmpty
          ? Text(
              'No WhatsApp messages yet.',
              style: TextStyle(color: colors.textSecondary),
            )
          : Column(
              children: [
                for (final message in _whatsAppTimeline.take(5)) ...[
                  _whatsAppRow(message),
                  if (message != _whatsAppTimeline.take(5).last)
                    Divider(height: 20, color: colors.divider),
                ],
              ],
            ),
    );
  }

  Widget _whatsAppRow(Map<String, dynamic> message) {
    final outbound = message['direction'] == 'outbound';
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(
          outbound ? Icons.north_east_rounded : Icons.south_west_rounded,
          color: outbound
              ? mobile_tokens.LetbuyyColorTokens.brandPrimary
              : colors.success,
          size: 18,
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Text(
                    outbound ? 'Sent' : 'Reply',
                    style: TextStyle(
                      color: colors.textPrimary,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    _shortDate(message['created_at']?.toString() ?? ''),
                    style: TextStyle(color: colors.textTertiary, fontSize: 12),
                  ),
                ],
              ),
              const SizedBox(height: 4),
              Text(
                message['message']?.toString() ?? '',
                maxLines: 3,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(color: colors.textSecondary, height: 1.35),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _addressCard(CustomerAddressContract address) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(
          address.isDefault ? Icons.home_rounded : Icons.location_on_outlined,
          color: mobile_tokens.LetbuyyColorTokens.brandPrimary,
          size: 20,
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                [
                      _nonEmpty(address['label']),
                      if (address.isDefault) 'Default',
                    ].whereType<String>().join(' | ').ifEmpty ??
                    'Address',
                style: TextStyle(
                  color: colors.textPrimary,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                _addressText(address),
                style: TextStyle(color: colors.textSecondary, height: 1.35),
              ),
            ],
          ),
        ),
        PopupMenuButton<String>(
          icon: Icon(Icons.more_horiz_rounded, color: colors.textTertiary),
          color: colors.card,
          onSelected: (value) {
            if (value == 'edit') _saveAddress(address);
            if (value == 'delete') _deleteAddress(address);
          },
          itemBuilder: (context) => [
            const PopupMenuItem(value: 'edit', child: Text('Edit')),
            PopupMenuItem(
              value: 'delete',
              child: Text('Delete', style: TextStyle(color: colors.error)),
            ),
          ],
        ),
      ],
    );
  }

  Widget _ordersSection() {
    return _section(
      title: 'Recent orders',
      child: _orders.isEmpty
          ? Text(
              'No recent orders returned for this customer.',
              style: TextStyle(color: colors.textSecondary),
            )
          : Column(
              children: [
                for (final order in _orders.take(10)) ...[
                  _orderRow(order),
                  if (order != _orders.take(10).last)
                    Divider(height: 20, color: colors.divider),
                ],
              ],
            ),
    );
  }

  Widget _orderRow(OrderContract order) {
    final orderLabel = order.orderNumber.isEmpty ? order.id : order.orderNumber;
    void openOrder() => Navigator.pushNamed(
      context,
      AppRoutes.orderDetail,
      arguments: {'orderId': order.id, 'order': order},
    );

    return AccessibleTapRegion(
      label:
          'Order $orderLabel, ${_titleCase(order.status)}, ${_money(order.total)}',
      hint: 'Open order details',
      onTap: openOrder,
      child: InkWell(
        onTap: openOrder,
        borderRadius: BorderRadius.circular(8),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 4),
          child: Row(
            children: [
              Icon(Icons.receipt_long_outlined, color: colors.textTertiary),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      order.orderNumber.isEmpty ? order.id : order.orderNumber,
                      style: TextStyle(
                        color: colors.textPrimary,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    Text(
                      _shortDate(order['created_at']?.toString() ?? ''),
                      style: TextStyle(
                        color: colors.textSecondary,
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(
                    _money(order.total),
                    style: TextStyle(
                      color: colors.textPrimary,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  Text(
                    _titleCase(order.status),
                    style: TextStyle(color: colors.textSecondary, fontSize: 12),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _section({String? title, Widget? trailing, required Widget child}) {
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
          if (title != null) ...[
            Row(
              children: [
                Expanded(
                  child: Text(
                    title,
                    style: TextStyle(
                      color: colors.textPrimary,
                      fontSize: 15,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
                if (trailing != null) trailing,
              ],
            ),
            const SizedBox(height: 12),
          ],
          child,
        ],
      ),
    );
  }

  Widget _metric(String label, String value, IconData icon) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: colors.surfaceVariant,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: colors.divider),
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
              fontWeight: FontWeight.w800,
            ),
          ),
          Text(
            label,
            style: TextStyle(color: colors.textSecondary, fontSize: 12),
          ),
        ],
      ),
    );
  }

  Widget _statusChip(String status) {
    final normalized = status.trim().toLowerCase();
    final color = normalized == 'active' ? colors.success : colors.warning;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        _titleCase(normalized.isEmpty ? 'active' : normalized),
        style: TextStyle(
          color: color,
          fontSize: 12,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }

  Widget _infoRow(IconData icon, String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(top: 8),
      child: Row(
        children: [
          Icon(icon, color: colors.textTertiary, size: 16),
          const SizedBox(width: 8),
          SizedBox(
            width: 72,
            child: Text(
              label,
              style: TextStyle(color: colors.textSecondary, fontSize: 12),
            ),
          ),
          Expanded(
            child: Text(
              value,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                color: colors.textPrimary,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _inlineWarning(String message) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: colors.warning.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: colors.warning.withValues(alpha: 0.24)),
      ),
      child: Text(message, style: TextStyle(color: colors.textSecondary)),
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
              style: TextStyle(
                color: colors.textPrimary,
                fontSize: 16,
                fontWeight: FontWeight.w800,
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

  Future<Map<String, dynamic>?> _showAddressDialog(
    CustomerAddressContract? address,
  ) {
    final nameController = TextEditingController(text: address?.fullName);
    final phoneController = TextEditingController(text: address?.phone);
    final line1Controller = TextEditingController(text: address?.addressLine1);
    final line2Controller = TextEditingController(text: address?.addressLine2);
    final cityController = TextEditingController(text: address?.city);
    final stateController = TextEditingController(text: address?.state);
    final postalController = TextEditingController(text: address?.postalCode);
    final labelController = TextEditingController(
      text: address?['label']?.toString(),
    );
    var isDefault = address?.isDefault ?? false;

    return _showGuardedDialog<Map<String, dynamic>>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          backgroundColor: colors.card,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
          ),
          title: Text(
            address == null ? 'Add address' : 'Edit address',
            style: TextStyle(color: colors.textPrimary),
          ),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                _dialogField(nameController, 'Full name'),
                _dialogField(phoneController, 'Phone'),
                _dialogField(line1Controller, 'Address line 1'),
                _dialogField(line2Controller, 'Address line 2'),
                _dialogField(cityController, 'City'),
                _dialogField(stateController, 'State'),
                _dialogField(postalController, 'Postal code'),
                _dialogField(labelController, 'Label'),
                SwitchListTile.adaptive(
                  value: isDefault,
                  onChanged: (value) => setDialogState(() => isDefault = value),
                  title: Text(
                    'Default address',
                    style: TextStyle(color: colors.textPrimary),
                  ),
                  activeThumbColor:
                      mobile_tokens.LetbuyyColorTokens.brandPrimary,
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: Text(
                'Cancel',
                style: TextStyle(color: colors.textSecondary),
              ),
            ),
            TextButton(
              onPressed: () {
                if (line1Controller.text.trim().isEmpty ||
                    cityController.text.trim().isEmpty ||
                    stateController.text.trim().isEmpty) {
                  _showSnackBar('Address, city, and state are required');
                  return;
                }
                Navigator.pop(context, {
                  'full_name': nameController.text.trim(),
                  'phone': phoneController.text.trim(),
                  'address_line1': line1Controller.text.trim(),
                  'address_line2': line2Controller.text.trim(),
                  'city': cityController.text.trim(),
                  'state': stateController.text.trim(),
                  'postal_code': postalController.text.trim(),
                  'label': labelController.text.trim(),
                  'is_default': isDefault,
                });
              },
              child: Text(
                'Save',
                style: TextStyle(
                  color: mobile_tokens.LetbuyyColorTokens.brandPrimary,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<Map<String, dynamic>?> _showCustomerDialog(CustomerContract customer) {
    final nameParts = _splitName(_customerName(customer));
    final firstController = TextEditingController(text: nameParts.$1);
    final lastController = TextEditingController(text: nameParts.$2);
    final phoneController = TextEditingController(text: customer.phone);
    final notesController = TextEditingController(
      text: _nonEmpty(customer['notes']),
    );
    var acceptsMarketing = customer.acceptsMarketing;

    return _showGuardedDialog<Map<String, dynamic>>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          backgroundColor: colors.card,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
          ),
          title: Text(
            'Edit customer',
            style: TextStyle(color: colors.textPrimary),
          ),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                _dialogField(firstController, 'First name'),
                _dialogField(lastController, 'Last name'),
                _dialogField(phoneController, 'Phone'),
                _dialogField(notesController, 'Notes', maxLines: 3),
                SwitchListTile.adaptive(
                  value: acceptsMarketing,
                  onChanged: (value) =>
                      setDialogState(() => acceptsMarketing = value),
                  title: Text(
                    'Accepts marketing',
                    style: TextStyle(color: colors.textPrimary),
                  ),
                  activeThumbColor:
                      mobile_tokens.LetbuyyColorTokens.brandPrimary,
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: Text(
                'Cancel',
                style: TextStyle(color: colors.textSecondary),
              ),
            ),
            TextButton(
              onPressed: () {
                Navigator.pop(context, {
                  'first_name': firstController.text.trim(),
                  'last_name': lastController.text.trim(),
                  'phone': phoneController.text.trim(),
                  'notes': notesController.text.trim(),
                  'accepts_marketing': acceptsMarketing,
                });
              },
              child: Text(
                'Save',
                style: TextStyle(
                  color: mobile_tokens.LetbuyyColorTokens.brandPrimary,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<String?> _showNoteDialog() {
    final noteController = TextEditingController();

    return _showGuardedDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: colors.card,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text('Add note', style: TextStyle(color: colors.textPrimary)),
        content: _dialogField(noteController, 'Note', maxLines: 4),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text(
              'Cancel',
              style: TextStyle(color: colors.textSecondary),
            ),
          ),
          TextButton(
            onPressed: () {
              final note = noteController.text.trim();
              if (note.isEmpty) {
                _showSnackBar('Note is required');
                return;
              }
              Navigator.pop(context, note);
            },
            child: Text(
              'Save',
              style: TextStyle(
                color: mobile_tokens.LetbuyyColorTokens.brandPrimary,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Future<List<String>?> _showTagsDialog(List<String> currentTags) {
    final tagsController = TextEditingController(text: currentTags.join(', '));

    return _showGuardedDialog<List<String>>(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: colors.card,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text('Edit tags', style: TextStyle(color: colors.textPrimary)),
        content: _dialogField(tagsController, 'Tags separated by commas'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text(
              'Cancel',
              style: TextStyle(color: colors.textSecondary),
            ),
          ),
          TextButton(
            onPressed: () {
              final tags = tagsController.text
                  .split(',')
                  .map((tag) => tag.trim())
                  .where((tag) => tag.isNotEmpty)
                  .toSet()
                  .toList(growable: false);
              Navigator.pop(context, tags);
            },
            child: Text(
              'Save',
              style: TextStyle(
                color: mobile_tokens.LetbuyyColorTokens.brandPrimary,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Future<Map<String, String>?> _showEmailDialog() {
    final subjectController = TextEditingController();
    final messageController = TextEditingController();

    return _showGuardedDialog<Map<String, String>>(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: colors.card,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text(
          'Email customer',
          style: TextStyle(color: colors.textPrimary),
        ),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              _dialogField(subjectController, 'Subject'),
              _dialogField(messageController, 'Message', maxLines: 5),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text(
              'Cancel',
              style: TextStyle(color: colors.textSecondary),
            ),
          ),
          TextButton(
            onPressed: () {
              final subject = subjectController.text.trim();
              final message = messageController.text.trim();
              if (subject.isEmpty || message.isEmpty) {
                _showSnackBar('Subject and message are required');
                return;
              }
              Navigator.pop(context, {'subject': subject, 'message': message});
            },
            child: Text(
              'Send',
              style: TextStyle(
                color: mobile_tokens.LetbuyyColorTokens.brandPrimary,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Future<Map<String, String>?> _showWhatsAppDialog(CustomerContract customer) {
    final messageController = TextEditingController(
      text: 'Hi ${_customerName(customer)}, your order update is ready.',
    );
    var template = 'custom_message';

    return _showGuardedDialog<Map<String, String>>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          backgroundColor: colors.card,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
          ),
          title: Text(
            'WhatsApp customer',
            style: TextStyle(color: colors.textPrimary),
          ),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                DropdownButtonFormField<String>(
                  value: template,
                  dropdownColor: colors.card,
                  decoration: InputDecoration(
                    labelText: 'Template',
                    labelStyle: TextStyle(color: colors.textSecondary),
                  ),
                  style: TextStyle(color: colors.textPrimary),
                  items: const [
                    DropdownMenuItem(
                      value: 'custom_message',
                      child: Text('Custom message'),
                    ),
                    DropdownMenuItem(
                      value: 'order_update',
                      child: Text('Order update'),
                    ),
                    DropdownMenuItem(
                      value: 'shipping_update',
                      child: Text('Shipping update'),
                    ),
                    DropdownMenuItem(
                      value: 'abandoned_cart',
                      child: Text('Abandoned cart'),
                    ),
                  ],
                  onChanged: (value) {
                    if (value != null) {
                      setDialogState(() => template = value);
                    }
                  },
                ),
                const SizedBox(height: 10),
                if (template == 'custom_message')
                  _dialogField(messageController, 'Message', maxLines: 5)
                else
                  Text(
                    'LetBuyy will fill this template from the latest customer and order data.',
                    style: TextStyle(color: colors.textSecondary, height: 1.35),
                  ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: Text(
                'Cancel',
                style: TextStyle(color: colors.textSecondary),
              ),
            ),
            TextButton(
              onPressed: () {
                final message = messageController.text.trim();
                if (template == 'custom_message' && message.isEmpty) {
                  _showSnackBar('Message is required');
                  return;
                }
                Navigator.pop(context, {
                  'template': template,
                  if (message.isNotEmpty) 'message': message,
                });
              },
              child: Text(
                'Send',
                style: TextStyle(
                  color: mobile_tokens.LetbuyyColorTokens.brandPrimary,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<String?> _showMergeDialog() {
    final targetController = TextEditingController();

    return _showGuardedDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: colors.card,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text(
          'Merge customer',
          style: TextStyle(color: colors.textPrimary),
        ),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Orders, addresses, notes, and tags move to the target customer.',
                style: TextStyle(color: colors.textSecondary),
              ),
              const SizedBox(height: 12),
              _dialogField(targetController, 'Target email'),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text(
              'Cancel',
              style: TextStyle(color: colors.textSecondary),
            ),
          ),
          TextButton(
            onPressed: () {
              final target = targetController.text.trim();
              if (target.isEmpty ||
                  target.toLowerCase() == widget.email.toLowerCase()) {
                _showSnackBar('Choose a different target customer');
                return;
              }
              Navigator.pop(context, target);
            },
            child: Text(
              'Merge',
              style: TextStyle(
                color: mobile_tokens.LetbuyyColorTokens.brandPrimary,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _dialogField(
    TextEditingController controller,
    String label, {
    int maxLines = 1,
  }) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: TextField(
        controller: controller,
        maxLines: maxLines,
        style: TextStyle(color: colors.textPrimary),
        decoration: InputDecoration(
          labelText: label,
          labelStyle: TextStyle(color: colors.textSecondary),
        ),
      ),
    );
  }

  Future<T?> _showGuardedDialog<T>({
    required BuildContext context,
    required WidgetBuilder builder,
  }) {
    return showDialog<T>(
      context: context,
      builder: (dialogContext) => Consumer<StoreContext>(
        builder: (_, stores, __) => _current
            ? builder(dialogContext)
            : AlertDialog(
                title: const Text('Store access changed'),
                content: const Text(
                  'Close this dialog and reopen the customer from the selected store.',
                ),
                actions: [
                  TextButton(
                    onPressed: () => Navigator.pop(dialogContext),
                    child: const Text('Close'),
                  ),
                ],
              ),
      ),
    );
  }

  void _showSnackBar(String message, {bool isError = false}) {
    if (!_current) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: isError ? colors.error : colors.success,
        behavior: SnackBarBehavior.floating,
        margin: const EdgeInsets.all(16),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
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
    final latestOrder = _orders.isEmpty ? null : _orders.first;
    return {
      'customer_name': _customerName(customer),
      'order_number': latestOrder?.orderNumber ?? 'latest order',
      'status': latestOrder?.status ?? 'updated',
      'total': latestOrder == null ? '' : _money(latestOrder.total),
      'carrier': latestOrder?['carrier']?.toString() ?? 'your carrier',
      'tracking_number':
          latestOrder?['tracking_number']?.toString() ?? 'pending',
      'store_name': 'your store',
      'checkout_url': '',
    };
  }
}

class _WhatsAppLoadResult {
  const _WhatsAppLoadResult({
    this.available = false,
    this.timeline = const <Map<String, dynamic>>[],
  });

  final bool available;
  final List<Map<String, dynamic>> timeline;
}

extension on String {
  String? get ifEmpty => isEmpty ? null : this;
}
