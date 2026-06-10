import 'package:flutter/material.dart';
import 'package:letbuyy_models/letbuyy_models.dart';
import 'package:provider/provider.dart';

import '../../services/coupon_service.dart';
import '../../theme/app_theme_colors.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart' as mobile_tokens;

class CouponFormScreen extends StatefulWidget {
  const CouponFormScreen({super.key, required this.storeId, this.coupon});

  final String storeId;
  final CouponContract? coupon;

  @override
  State<CouponFormScreen> createState() => _CouponFormScreenState();
}

class _CouponFormScreenState extends State<CouponFormScreen> {
  final _formKey = GlobalKey<FormState>();
  final _codeController = TextEditingController();
  final _descriptionController = TextEditingController();
  final _valueController = TextEditingController();
  final _minimumController = TextEditingController();
  final _maximumController = TextEditingController();
  final _usageLimitController = TextEditingController();
  final _perCustomerLimitController = TextEditingController();
  final _expiresAtController = TextEditingController();

  String _type = 'percentage';
  bool _isActive = true;
  bool _isSaving = false;

  late AppThemeColors colors;

  @override
  void initState() {
    super.initState();
    final coupon = widget.coupon;
    if (coupon != null) {
      _codeController.text = coupon.code;
      _descriptionController.text = coupon['description']?.toString() ?? '';
      _valueController.text = coupon.value.toStringAsFixed(0);
      _minimumController.text =
          coupon['minimum_order_amount']?.toString() ?? '';
      _maximumController.text = coupon['maximum_discount']?.toString() ?? '';
      _usageLimitController.text = coupon['usage_limit']?.toString() ?? '';
      _perCustomerLimitController.text =
          coupon['per_customer_limit']?.toString() ?? '';
      _expiresAtController.text = coupon['expires_at']?.toString() ?? '';
      _type = coupon.type.isEmpty ? 'percentage' : coupon.type;
      _isActive = coupon.isActive;
    }
  }

  @override
  void dispose() {
    _codeController.dispose();
    _descriptionController.dispose();
    _valueController.dispose();
    _minimumController.dispose();
    _maximumController.dispose();
    _usageLimitController.dispose();
    _perCustomerLimitController.dispose();
    _expiresAtController.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _isSaving = true);
    try {
      final payload = {
        'store_id': widget.storeId,
        'code': _codeController.text.trim().toUpperCase(),
        'description': _descriptionController.text.trim(),
        'type': _type,
        'value': double.tryParse(_valueController.text.trim()) ?? 0,
        'currency': 'INR',
        'minimum_order_amount': _numberOrNull(_minimumController.text),
        'maximum_discount': _numberOrNull(_maximumController.text),
        'usage_limit': _intOrNull(_usageLimitController.text),
        'per_customer_limit': _intOrNull(_perCustomerLimitController.text),
        'expires_at': _textOrNull(_expiresAtController.text),
        'is_active': _isActive,
      };

      final service = context.read<CouponService>();
      if (widget.coupon == null) {
        await service.createCoupon(payload);
      } else {
        await service.updateCoupon(widget.coupon!.id, payload);
      }

      if (mounted) Navigator.pop(context, true);
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(error.toString()),
            backgroundColor: colors.error,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isSaving = false);
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
              Expanded(
                child: Form(
                  key: _formKey,
                  child: ListView(
                    padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
                    children: [
                      _field(
                        controller: _codeController,
                        label: 'Code',
                        textCapitalization: TextCapitalization.characters,
                        validator: (value) =>
                            value == null || value.trim().isEmpty
                            ? 'Code is required'
                            : null,
                      ),
                      _field(
                        controller: _descriptionController,
                        label: 'Description',
                        maxLines: 2,
                      ),
                      _typeSelector(),
                      _field(
                        controller: _valueController,
                        label: _type == 'percentage'
                            ? 'Discount percentage'
                            : 'Discount amount',
                        keyboardType: const TextInputType.numberWithOptions(
                          decimal: true,
                        ),
                        validator: (value) {
                          final parsed = double.tryParse(value ?? '');
                          if (parsed == null || parsed < 0) {
                            return 'Enter a valid discount value';
                          }
                          if (_type == 'percentage' && parsed > 100) {
                            return 'Percentage cannot exceed 100';
                          }
                          return null;
                        },
                      ),
                      _field(
                        controller: _minimumController,
                        label: 'Minimum order amount',
                        keyboardType: const TextInputType.numberWithOptions(
                          decimal: true,
                        ),
                      ),
                      _field(
                        controller: _maximumController,
                        label: 'Maximum discount',
                        keyboardType: const TextInputType.numberWithOptions(
                          decimal: true,
                        ),
                      ),
                      Row(
                        children: [
                          Expanded(
                            child: _field(
                              controller: _usageLimitController,
                              label: 'Usage limit',
                              keyboardType: TextInputType.number,
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: _field(
                              controller: _perCustomerLimitController,
                              label: 'Per customer',
                              keyboardType: TextInputType.number,
                            ),
                          ),
                        ],
                      ),
                      _field(
                        controller: _expiresAtController,
                        label: 'Expires at (ISO optional)',
                      ),
                      SwitchListTile.adaptive(
                        value: _isActive,
                        onChanged: (value) => setState(() => _isActive = value),
                        title: Text(
                          'Active',
                          style: TextStyle(color: colors.textPrimary),
                        ),
                        subtitle: Text(
                          'Inactive coupons cannot be redeemed',
                          style: TextStyle(color: colors.textSecondary),
                        ),
                        activeThumbColor:
                            mobile_tokens.LetbuyyColorTokens.brandPrimary,
                      ),
                    ],
                  ),
                ),
              ),
              _saveBar(),
            ],
          ),
        ),
      ),
    );
  }

  Widget _header() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(8, 8, 12, 8),
      child: Row(
        children: [
          IconButton(
            icon: Icon(Icons.arrow_back_rounded, color: colors.textPrimary),
            onPressed: () => Navigator.pop(context),
            tooltip: 'Back',
          ),
          Expanded(
            child: Text(
              widget.coupon == null ? 'New coupon' : 'Edit coupon',
              style: TextStyle(
                color: colors.textPrimary,
                fontSize: 20,
                fontWeight: FontWeight.w800,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _typeSelector() {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: DropdownButtonFormField<String>(
        value: _type,
        dropdownColor: colors.card,
        style: TextStyle(color: colors.textPrimary),
        decoration: _inputDecoration('Discount type'),
        items: const [
          DropdownMenuItem(value: 'percentage', child: Text('Percentage')),
          DropdownMenuItem(value: 'fixed_amount', child: Text('Fixed amount')),
          DropdownMenuItem(
            value: 'free_shipping',
            child: Text('Free shipping'),
          ),
        ],
        onChanged: (value) {
          if (value != null) setState(() => _type = value);
        },
      ),
    );
  }

  Widget _field({
    required TextEditingController controller,
    required String label,
    TextInputType? keyboardType,
    TextCapitalization textCapitalization = TextCapitalization.none,
    int maxLines = 1,
    String? Function(String?)? validator,
  }) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: TextFormField(
        controller: controller,
        keyboardType: keyboardType,
        textCapitalization: textCapitalization,
        maxLines: maxLines,
        validator: validator,
        style: TextStyle(color: colors.textPrimary),
        decoration: _inputDecoration(label),
      ),
    );
  }

  InputDecoration _inputDecoration(String label) {
    return InputDecoration(
      labelText: label,
      labelStyle: TextStyle(color: colors.textSecondary),
      filled: true,
      fillColor: colors.card,
      border: _border(colors.divider),
      enabledBorder: _border(colors.divider),
      focusedBorder: _border(mobile_tokens.LetbuyyColorTokens.brandPrimary),
    );
  }

  OutlineInputBorder _border(Color color) {
    return OutlineInputBorder(
      borderRadius: BorderRadius.circular(12),
      borderSide: BorderSide(color: color),
    );
  }

  Widget _saveBar() {
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
      decoration: BoxDecoration(
        color: colors.card,
        border: Border(top: BorderSide(color: colors.divider)),
      ),
      child: SafeArea(
        top: false,
        child: SizedBox(
          width: double.infinity,
          height: 48,
          child: ElevatedButton.icon(
            onPressed: _isSaving ? null : _save,
            icon: _isSaving
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.save_rounded),
            label: Text(
              widget.coupon == null ? 'Create coupon' : 'Save coupon',
            ),
            style: ElevatedButton.styleFrom(
              backgroundColor: mobile_tokens.LetbuyyColorTokens.brandPrimary,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
            ),
          ),
        ),
      ),
    );
  }

  double? _numberOrNull(String value) {
    final text = value.trim();
    return text.isEmpty ? null : double.tryParse(text);
  }

  int? _intOrNull(String value) {
    final text = value.trim();
    return text.isEmpty ? null : int.tryParse(text);
  }

  String? _textOrNull(String value) {
    final text = value.trim();
    return text.isEmpty ? null : text;
  }
}
