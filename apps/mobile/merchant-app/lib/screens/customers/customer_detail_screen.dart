import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:letbuyy_models/letbuyy_models.dart';
import 'package:provider/provider.dart';

import '../../app/routes.dart';
import '../../services/customer_service.dart';
import '../../services/order_service.dart';
import '../../theme/app_theme_colors.dart';
import '../../theme/letbuyy_color_tokens.dart' as mobile_tokens;

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
  bool _isLoading = true;
  bool _isMutating = false;
  String? _error;

  late AppThemeColors colors;

  @override
  void initState() {
    super.initState();
    _customer = widget.initialCustomer;
    _loadCustomer();
  }

  Future<void> _loadCustomer() async {
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
      final customer = await service.fetchCustomerByEmail(widget.email);
      final addresses = await service.fetchAddresses(widget.email);
      final orders = await _loadRecentOrders(customer);
      if (mounted) {
        setState(() {
          _customer = customer;
          _addresses = addresses;
          _orders = orders;
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
      return payloadOrders;
    }
  }

  Future<void> _saveAddress(CustomerAddressContract? existing) async {
    final request = await _showAddressDialog(existing);
    if (request == null) return;

    setState(() => _isMutating = true);
    try {
      final service = context.read<CustomerService>();
      if (existing == null) {
        await service.createAddress(widget.email, request);
      } else {
        await service.updateAddress(widget.email, existing.id, request);
      }
      await _loadCustomer();
      if (mounted) {
        _showSnackBar(existing == null ? 'Address added' : 'Address updated');
      }
    } catch (error) {
      if (mounted) _showSnackBar(error.toString(), isError: true);
    } finally {
      if (mounted) setState(() => _isMutating = false);
    }
  }

  Future<void> _deleteAddress(CustomerAddressContract address) async {
    final confirmed = await showDialog<bool>(
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

    if (confirmed != true) return;

    setState(() => _isMutating = true);
    try {
      await context.read<CustomerService>().deleteAddress(
        widget.email,
        address.id,
      );
      await _loadCustomer();
      if (mounted) _showSnackBar('Address deleted');
    } catch (error) {
      if (mounted) _showSnackBar(error.toString(), isError: true);
    } finally {
      if (mounted) setState(() => _isMutating = false);
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
                  widget.email,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(color: colors.textSecondary, fontSize: 12),
                ),
              ],
            ),
          ),
          IconButton(
            icon: Icon(Icons.refresh_rounded, color: colors.textSecondary),
            tooltip: 'Refresh',
            onPressed: _loadCustomer,
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
    return InkWell(
      onTap: () => Navigator.pushNamed(
        context,
        AppRoutes.orderDetail,
        arguments: {'orderId': order.id, 'order': order},
      ),
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
                    style: TextStyle(color: colors.textSecondary, fontSize: 12),
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

    return showDialog<Map<String, dynamic>>(
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

  Widget _dialogField(TextEditingController controller, String label) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: TextField(
        controller: controller,
        style: TextStyle(color: colors.textPrimary),
        decoration: InputDecoration(
          labelText: label,
          labelStyle: TextStyle(color: colors.textSecondary),
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
}

extension on String {
  String? get ifEmpty => isEmpty ? null : this;
}
