import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:letbuyy_models/letbuyy_models.dart';
import 'package:provider/provider.dart';

import '../../app/routes.dart';
import '../../services/customer_service.dart';
import '../../services/store_service.dart';
import '../../theme/app_theme_colors.dart';
import '../../theme/letbuyy_color_tokens.dart' as mobile_tokens;

class CustomersScreen extends StatefulWidget {
  const CustomersScreen({super.key});

  @override
  State<CustomersScreen> createState() => _CustomersScreenState();
}

class _CustomersScreenState extends State<CustomersScreen> {
  final TextEditingController _searchController = TextEditingController();

  List<CustomerContract> _customers = [];
  bool _isLoading = true;
  String? _storeId;
  String _query = '';
  String? _error;

  late AppThemeColors colors;

  @override
  void initState() {
    super.initState();
    _loadCustomers();
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _loadCustomers() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      _storeId ??= (await context.read<StoreService>().getFirstStore())?.id;
      if (_storeId == null) {
        if (mounted) {
          setState(() {
            _customers = [];
            _isLoading = false;
          });
        }
        return;
      }

      final customers = await context.read<CustomerService>().fetchCustomers(
        _storeId!,
      );
      if (mounted) {
        setState(() {
          _customers = customers;
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

  List<CustomerContract> get _filteredCustomers {
    final query = _query.trim().toLowerCase();
    final customers = query.isEmpty
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

    return Scaffold(
      backgroundColor: colors.bgStart,
      body: Container(
        decoration: colors.backgroundGradient,
        child: SafeArea(
          child: Column(
            children: [
              _buildHeader(),
              _buildSearch(),
              _buildStats(),
              Expanded(
                child: _isLoading ? _buildLoading() : _buildCustomerList(),
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
        ],
      ),
    );
  }

  Widget _buildSearch() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
      child: TextField(
        controller: _searchController,
        onChanged: (value) => setState(() => _query = value),
        style: TextStyle(color: colors.textPrimary),
        decoration: InputDecoration(
          hintText: 'Search name, email, phone, GSTIN',
          hintStyle: TextStyle(color: colors.textTertiary),
          prefixIcon: Icon(Icons.search_rounded, color: colors.textTertiary),
          suffixIcon: _query.isEmpty
              ? null
              : IconButton(
                  icon: Icon(Icons.close_rounded, color: colors.textTertiary),
                  onPressed: () {
                    _searchController.clear();
                    setState(() => _query = '');
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

  Widget _buildStats() {
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 12, 16, 8),
      child: Row(
        children: [
          Expanded(
            child: _metricCard(
              'Customers',
              _customers.length.toString(),
              Icons.people_alt_outlined,
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: _metricCard(
              'Active',
              _activeCount.toString(),
              Icons.verified_user_outlined,
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: _metricCard(
              'Spent',
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
      return _centerState(
        icon: Icons.people_outline_rounded,
        title: 'No customers yet',
        subtitle: 'Customer profiles appear after the first order or signup.',
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
    return InkWell(
      onTap: () {
        final email = customer.email;
        if (email == null || email.trim().isEmpty) return;
        Navigator.pushNamed(
          context,
          AppRoutes.customerDetail,
          arguments: {'email': email, 'customer': customer},
        ).then((_) => _loadCustomers());
      },
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
                    style: TextStyle(color: colors.textSecondary, fontSize: 12),
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
