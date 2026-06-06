import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:letbuyy_models/letbuyy_models.dart';
import 'package:provider/provider.dart';

import '../../app/routes.dart';
import '../../services/coupon_service.dart';
import '../../services/store_service.dart';
import '../../theme/app_theme_colors.dart';
import '../../theme/letbuyy_color_tokens.dart' as mobile_tokens;

class CouponsScreen extends StatefulWidget {
  const CouponsScreen({super.key});

  @override
  State<CouponsScreen> createState() => _CouponsScreenState();
}

class _CouponsScreenState extends State<CouponsScreen> {
  List<CouponContract> _coupons = [];
  bool _isLoading = true;
  bool _activeOnly = false;
  String? _storeId;
  String? _error;

  late AppThemeColors colors;

  @override
  void initState() {
    super.initState();
    _loadCoupons();
  }

  Future<void> _loadCoupons() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      _storeId ??= (await context.read<StoreService>().getFirstStore())?.id;
      if (_storeId == null) {
        if (mounted) {
          setState(() {
            _coupons = [];
            _isLoading = false;
          });
        }
        return;
      }

      final coupons = await context.read<CouponService>().fetchCoupons(
        _storeId!,
        active: _activeOnly ? true : null,
      );
      if (mounted) {
        setState(() {
          _coupons = coupons;
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

  int get _activeCount => _coupons.where((coupon) => coupon.isActive).length;

  @override
  Widget build(BuildContext context) {
    colors = AppThemeColors.of(context);

    return Scaffold(
      backgroundColor: colors.bgStart,
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _storeId == null ? null : () => _openForm(),
        backgroundColor: mobile_tokens.LetbuyyColorTokens.brandPrimary,
        foregroundColor: Colors.white,
        icon: const Icon(Icons.add_rounded),
        label: const Text('Coupon'),
      ),
      body: Container(
        decoration: colors.backgroundGradient,
        child: SafeArea(
          child: Column(
            children: [
              _header(),
              _toolbar(),
              _stats(),
              Expanded(child: _isLoading ? _loading() : _body()),
            ],
          ),
        ),
      ),
    );
  }

  Widget _header() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 8, 8, 8),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Coupons',
                  style: TextStyle(
                    color: colors.textPrimary,
                    fontSize: 22,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                Text(
                  'Discount codes and redemption limits',
                  style: TextStyle(color: colors.textSecondary, fontSize: 12),
                ),
              ],
            ),
          ),
          IconButton(
            tooltip: 'Refresh coupons',
            icon: Icon(Icons.refresh_rounded, color: colors.textSecondary),
            onPressed: _loadCoupons,
          ),
        ],
      ),
    );
  }

  Widget _toolbar() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
      child: Row(
        children: [
          FilterChip(
            selected: _activeOnly,
            label: const Text('Active only'),
            avatar: const Icon(Icons.check_circle_outline, size: 18),
            selectedColor: colors.success.withValues(alpha: 0.16),
            checkmarkColor: colors.success,
            onSelected: (selected) {
              setState(() => _activeOnly = selected);
              _loadCoupons();
            },
          ),
          const Spacer(),
          TextButton.icon(
            onPressed: _storeId == null ? null : _validateCoupon,
            icon: const Icon(Icons.verified_outlined, size: 18),
            label: const Text('Validate'),
          ),
        ],
      ),
    );
  }

  Widget _stats() {
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 12, 16, 8),
      child: Row(
        children: [
          Expanded(
            child: _metric(
              'Coupons',
              _coupons.length.toString(),
              Icons.local_offer_outlined,
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: _metric(
              'Active',
              _activeCount.toString(),
              Icons.toggle_on_outlined,
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: _metric(
              'Used',
              _coupons
                  .fold<int>(
                    0,
                    (sum, coupon) => sum + _intValue(coupon['used_count']),
                  )
                  .toString(),
              Icons.redeem_outlined,
            ),
          ),
        ],
      ),
    );
  }

  Widget _metric(String label, String value, IconData icon) {
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
            style: TextStyle(
              color: colors.textPrimary,
              fontWeight: FontWeight.w800,
              fontSize: 16,
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

  Widget _loading() {
    return Center(
      child: CircularProgressIndicator(
        color: mobile_tokens.LetbuyyColorTokens.brandPrimary,
      ),
    );
  }

  Widget _body() {
    if (_error != null) {
      return _centerState(
        icon: Icons.error_outline_rounded,
        title: 'Could not load coupons',
        subtitle: _error!,
        action: TextButton.icon(
          onPressed: _loadCoupons,
          icon: const Icon(Icons.refresh_rounded),
          label: const Text('Retry'),
        ),
      );
    }

    if (_coupons.isEmpty) {
      return _centerState(
        icon: Icons.local_offer_outlined,
        title: 'No coupons yet',
        subtitle: 'Create a discount code for campaigns or customer support.',
      );
    }

    return RefreshIndicator(
      color: mobile_tokens.LetbuyyColorTokens.brandPrimary,
      onRefresh: _loadCoupons,
      child: ListView.builder(
        padding: const EdgeInsets.fromLTRB(16, 4, 16, 96),
        itemCount: _coupons.length,
        itemBuilder: (context, index) => _couponCard(_coupons[index]),
      ),
    );
  }

  Widget _couponCard(CouponContract coupon) {
    final tone = coupon.isActive ? colors.success : colors.warning;
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
              Expanded(
                child: Text(
                  coupon.code,
                  style: TextStyle(
                    color: colors.textPrimary,
                    fontSize: 18,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ),
              _chip(coupon.isActive ? 'Active' : 'Inactive', tone),
              PopupMenuButton<String>(
                icon: Icon(
                  Icons.more_horiz_rounded,
                  color: colors.textTertiary,
                ),
                color: colors.card,
                onSelected: (value) {
                  if (value == 'edit') _openForm(coupon);
                  if (value == 'toggle') _toggle(coupon);
                  if (value == 'delete') _delete(coupon);
                },
                itemBuilder: (context) => [
                  const PopupMenuItem(value: 'edit', child: Text('Edit')),
                  PopupMenuItem(
                    value: 'toggle',
                    child: Text(coupon.isActive ? 'Deactivate' : 'Activate'),
                  ),
                  PopupMenuItem(
                    value: 'delete',
                    child: Text(
                      'Delete',
                      style: TextStyle(color: colors.error),
                    ),
                  ),
                ],
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            _description(coupon),
            style: TextStyle(color: colors.textSecondary),
          ),
          const SizedBox(height: 10),
          Wrap(
            spacing: 10,
            runSpacing: 6,
            children: [
              _miniMetric(Icons.percent_rounded, _discountLabel(coupon)),
              _miniMetric(
                Icons.shopping_cart_outlined,
                'Min ${_money(_doubleValue(coupon['minimum_order_amount']))}',
              ),
              _miniMetric(
                Icons.redeem_outlined,
                '${_intValue(coupon['used_count'])}/${_limitLabel(coupon)} used',
              ),
              if (_nonEmpty(coupon['expires_at']) != null)
                _miniMetric(
                  Icons.event_outlined,
                  _shortDate(coupon['expires_at'].toString()),
                ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _chip(String label, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: color,
          fontSize: 12,
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }

  Widget _miniMetric(IconData icon, String value) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 14, color: colors.textTertiary),
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
            Icon(icon, size: 48, color: colors.textTertiary),
            const SizedBox(height: 12),
            Text(
              title,
              textAlign: TextAlign.center,
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

  Future<void> _openForm([CouponContract? coupon]) async {
    if (_storeId == null) return;
    final changed = await Navigator.pushNamed(
      context,
      AppRoutes.couponForm,
      arguments: {'storeId': _storeId, 'coupon': coupon},
    );
    if (changed == true) _loadCoupons();
  }

  Future<void> _toggle(CouponContract coupon) async {
    try {
      await context.read<CouponService>().toggleCoupon(coupon);
      _showSnackBar(
        coupon.isActive ? 'Coupon deactivated' : 'Coupon activated',
      );
      _loadCoupons();
    } catch (error) {
      _showSnackBar(error.toString(), isError: true);
    }
  }

  Future<void> _delete(CouponContract coupon) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: colors.card,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text(
          'Delete ${coupon.code}?',
          style: TextStyle(color: colors.textPrimary),
        ),
        content: Text(
          'This coupon will no longer be available.',
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

    try {
      await context.read<CouponService>().deleteCoupon(coupon.id);
      _showSnackBar('Coupon deleted');
      _loadCoupons();
    } catch (error) {
      _showSnackBar(error.toString(), isError: true);
    }
  }

  Future<void> _validateCoupon() async {
    final codeController = TextEditingController();
    final subtotalController = TextEditingController();
    final result = await showDialog<Map<String, String>>(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: colors.card,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text(
          'Validate coupon',
          style: TextStyle(color: colors.textPrimary),
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: codeController,
              textCapitalization: TextCapitalization.characters,
              style: TextStyle(color: colors.textPrimary),
              decoration: InputDecoration(
                labelText: 'Code',
                labelStyle: TextStyle(color: colors.textSecondary),
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: subtotalController,
              keyboardType: const TextInputType.numberWithOptions(
                decimal: true,
              ),
              style: TextStyle(color: colors.textPrimary),
              decoration: InputDecoration(
                labelText: 'Cart subtotal',
                labelStyle: TextStyle(color: colors.textSecondary),
              ),
            ),
          ],
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
            onPressed: () => Navigator.pop(context, {
              'code': codeController.text.trim(),
              'subtotal': subtotalController.text.trim(),
            }),
            child: Text(
              'Validate',
              style: TextStyle(
                color: mobile_tokens.LetbuyyColorTokens.brandPrimary,
              ),
            ),
          ),
        ],
      ),
    );

    if (result == null || _storeId == null || result['code']!.isEmpty) return;

    try {
      final response = await context.read<CouponService>().validateCoupon(
        storeId: _storeId!,
        code: result['code']!,
        subtotal: double.tryParse(result['subtotal'] ?? ''),
      );
      _showSnackBar(response['message']?.toString() ?? 'Coupon is valid');
    } catch (error) {
      _showSnackBar(error.toString(), isError: true);
    }
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

  String _description(CouponContract coupon) {
    return _nonEmpty(coupon['description']) ??
        '${_discountLabel(coupon)} discount';
  }

  String _discountLabel(CouponContract coupon) {
    if (coupon.type == 'percentage')
      return '${coupon.value.toStringAsFixed(0)}%';
    if (coupon.type == 'free_shipping') return 'Free shipping';
    return _money(coupon.value);
  }

  String _limitLabel(CouponContract coupon) {
    final limit = _intValue(coupon['usage_limit']);
    return limit <= 0 ? 'unlimited' : limit.toString();
  }

  String _money(double amount) {
    return 'INR ${NumberFormat.decimalPattern('en_IN').format(amount)}';
  }

  String _shortDate(String raw) {
    final date = DateTime.tryParse(raw);
    return date == null ? raw : DateFormat('MMM d').format(date.toLocal());
  }

  int _intValue(Object? value) {
    if (value is int) return value;
    if (value is num) return value.toInt();
    return int.tryParse(value?.toString() ?? '') ?? 0;
  }

  double _doubleValue(Object? value) {
    if (value is num) return value.toDouble();
    return double.tryParse(value?.toString() ?? '') ?? 0;
  }

  String? _nonEmpty(Object? value) {
    final text = value?.toString().trim();
    return text == null || text.isEmpty ? null : text;
  }
}
