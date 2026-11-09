import 'package:flutter/material.dart';
import 'package:letbuyy_models/letbuyy_models.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:provider/provider.dart';

import '../../app/store_context.dart';
import '../../services/api_client.dart' show ApiException;
import '../../services/coupon_service.dart';
import '../../widgets/shared/merchant_store_view.dart';

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
  final _startsAtController = TextEditingController();
  final _expiresAtController = TextEditingController();
  String _type = 'percentage';
  bool _isActive = true, _isSaving = false, _uncertain = false, _saved = false;
  bool _denied = false;
  String? _error;
  late final MerchantStoreView _view;
  late final Object? _apiContext;
  late final String? _originalId;
  late final List<String> _initial;
  late final String _initialType;
  late final bool _initialActive;
  List<TextEditingController> get _controllers => [
    _codeController,
    _descriptionController,
    _valueController,
    _minimumController,
    _maximumController,
    _usageLimitController,
    _perCustomerLimitController,
    _startsAtController,
    _expiresAtController,
  ];
  bool get _ownerCurrent =>
      mounted &&
      widget.storeId == _view.storeId &&
      widget.coupon?.id == _originalId &&
      merchantStoreViewCurrent(context, _view) &&
      context.read<CouponService>().requestContext == _apiContext;
  bool get _current => _ownerCurrent && isLetbuyySurfaceCurrent(context);
  bool get _changed =>
      _type != _initialType ||
      _isActive != _initialActive ||
      List.generate(
        _controllers.length,
        (i) => i,
      ).any((i) => _controllers[i].text != _initial[i]);
  bool get _editable => !_isSaving && !_uncertain && !_saved && !_denied;

  @override
  void initState() {
    super.initState();
    final stores = context.read<StoreContext>();
    _view = (key: stores.requestContextKey, storeId: widget.storeId);
    _apiContext = context.read<CouponService>().requestContext;
    _originalId = widget.coupon?.id;
    final coupon = widget.coupon;
    if (coupon != null) {
      _codeController.text = coupon.code;
      _descriptionController.text = coupon['description']?.toString() ?? '';
      _valueController.text = coupon.value.toString();
      _minimumController.text =
          coupon['minimum_order_amount']?.toString() ?? '';
      _maximumController.text = coupon['maximum_discount']?.toString() ?? '';
      _usageLimitController.text = coupon['usage_limit']?.toString() ?? '';
      _perCustomerLimitController.text =
          coupon['per_customer_limit']?.toString() ?? '';
      _startsAtController.text = coupon['starts_at']?.toString() ?? '';
      _expiresAtController.text = coupon['expires_at']?.toString() ?? '';
      _type = coupon.type.isEmpty ? 'percentage' : coupon.type;
      _isActive = coupon.isActive;
    }
    _initial = _controllers.map((c) => c.text).toList(growable: false);
    _initialType = _type;
    _initialActive = _isActive;
  }

  @override
  void dispose() {
    for (final controller in _controllers) {
      controller.dispose();
    }
    super.dispose();
  }

  // Existing parsers, default values, validators and omission/null semantics.
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

  String? _codeError(String? value) =>
      value == null || value.trim().isEmpty ? 'Code is required' : null;
  String? _valueError(String? value) {
    final parsed = double.tryParse(value ?? '');
    if (parsed == null || parsed < 0) {
      return 'Enter a valid discount value';
    }
    if (_type == 'percentage' && parsed > 100) {
      return 'Percentage cannot exceed 100';
    }
    return null;
  }

  Future<void> _save() async {
    if (!_current || !_editable || !_formKey.currentState!.validate()) return;
    setState(() {
      _isSaving = true;
      _error = null;
    });
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
        'per_customer_limit': _intOrNull(_perCustomerLimitController.text) ?? 1,
        'starts_at': _textOrNull(_startsAtController.text),
        'expires_at': _textOrNull(_expiresAtController.text),
        'is_active': _isActive,
      };
      // Optional create fields must be omitted; null is a patch-only clear.
      if (widget.coupon == null)
        payload.removeWhere((_, value) => value == null);
      final service = context.read<CouponService>();
      final CouponContract result;
      if (widget.coupon == null) {
        result = await service.createCoupon(payload);
      } else {
        result = await service.updateCoupon(widget.coupon!.id, payload);
      }
      if (!_ownerCurrent) return;
      if (result.id.isEmpty ||
          result['store_id'] != _view.storeId ||
          result.code != _codeController.text.trim().toUpperCase()) {
        throw const FormatException('Coupon acknowledgement mismatch.');
      }
      setState(() => _saved = true);
      if (_current) completeLetbuyySurface(context, true);
    } catch (error) {
      if (!_ownerCurrent) return;
      final rejected =
          error is ApiException &&
          error.statusCode == 400 &&
          error.code == 'VALIDATION_ERROR';
      setState(() {
        _denied =
            error is ApiException && [401, 403].contains(error.statusCode);
        _uncertain = !rejected;
        _error = rejected
            ? 'The input was rejected before saving. Review the fields and submit the corrected coupon.'
            : 'The save outcome is unconfirmed. Close and review the coupon list before starting another change. This form will not retry. Closing does not cancel a request already received by the server.';
      });
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  void _edited(String _) {
    if (_current && _editable) setState(() => _error = null);
  }

  Widget _field({
    required TextEditingController controller,
    required String label,
    TextInputType? keyboardType,
    TextCapitalization textCapitalization = TextCapitalization.none,
    int maxLines = 1,
    String? Function(String?)? validator,
    String? helperText,
  }) => Padding(
    padding: const EdgeInsets.only(bottom: 16),
    child: CustomTextField(
      controller: controller,
      label: label,
      keyboardType: keyboardType,
      textCapitalization: textCapitalization,
      maxLines: maxLines,
      validator: validator,
      helperText: helperText,
      enabled: _editable,
      onChanged: _edited,
    ),
  );

  @override
  Widget build(BuildContext context) {
    context.watch<StoreContext>();
    final available = _ownerCurrent;
    return guardMerchantStoreView(
      available ? _view : null,
      LetbuyyEditorScaffold(
        title: widget.coupon == null ? 'New coupon' : 'Edit coupon',
        hasChanges: _changed && !_saved,
        currentHasChanges: () => _changed && !_saved,
        isBusy: _isSaving,
        currentIsBusy: () => _isSaving,
        progressLabel: _isSaving ? 'Saving coupon…' : null,
        confirmationGuard: (_, confirmation) =>
            guardMerchantStoreView(_ownerCurrent ? _view : null, confirmation),
        onClose: _uncertain || _saved
            ? () async {
                if (_current) completeLetbuyySurface(context, true);
              }
            : null,
        actions: OverflowBar(
          spacing: 12,
          overflowSpacing: 12,
          alignment: MainAxisAlignment.end,
          children: [
            TextButton(
              onPressed: _isSaving
                  ? null
                  : () {
                      if (!_current) return;
                      if (_uncertain || _saved) {
                        completeLetbuyySurface(context, true);
                      } else {
                        dismissLetbuyySurface(context);
                      }
                    },
              child: Text(
                _saved
                    ? 'Done'
                    : _uncertain
                    ? 'Close and review'
                    : 'Cancel',
              ),
            ),
            if (!_uncertain && !_saved)
              FilledButton.icon(
                onPressed: _editable ? _save : null,
                icon: const Icon(Icons.save_outlined),
                label: Text(
                  widget.coupon == null ? 'Create coupon' : 'Save coupon',
                ),
              ),
          ],
        ),
        body: Form(
          key: _formKey,
          child: ListView(
            keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
            padding: const EdgeInsets.all(16),
            children: [
              const Text(
                'Checkout applies the saved coupon rules and calculates the final discount.',
              ),
              const SizedBox(height: 16),
              if (_error != null) ...[
                LetbuyyInlineFeedback(
                  title: _uncertain ? 'Save unconfirmed' : 'Input rejected',
                  message: _error!,
                ),
                const SizedBox(height: 16),
              ],
              if (_saved)
                const LetbuyyInlineFeedback(
                  title: 'Coupon saved',
                  message: 'Close to refresh the coupon list.',
                  kind: LetbuyyFeedbackKind.success,
                ),
              _field(
                controller: _codeController,
                label: 'Code',
                textCapitalization: TextCapitalization.characters,
                validator: _codeError,
              ),
              _field(
                controller: _descriptionController,
                label: 'Description',
                maxLines: 2,
              ),
              LetbuyyChoiceField<String>(
                label: 'Discount type',
                value: _type,
                choices: const [
                  LetbuyyChoice(value: 'percentage', label: 'Percentage'),
                  LetbuyyChoice(value: 'fixed', label: 'Fixed amount'),
                  LetbuyyChoice(value: 'free_shipping', label: 'Free shipping'),
                ],
                onChanged: !_editable
                    ? null
                    : (value) {
                        if (_current && _editable)
                          setState(() => _type = value);
                      },
              ),
              const SizedBox(height: 16),
              _field(
                controller: _valueController,
                label: _type == 'percentage'
                    ? 'Discount percentage'
                    : 'Discount amount',
                keyboardType: const TextInputType.numberWithOptions(
                  decimal: true,
                ),
                validator: _valueError,
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
              _field(
                controller: _usageLimitController,
                label: 'Usage limit',
                keyboardType: TextInputType.number,
              ),
              _field(
                controller: _perCustomerLimitController,
                label: 'Per customer',
                keyboardType: TextInputType.number,
              ),
              _field(
                controller: _startsAtController,
                label: 'Starts at (ISO optional)',
                helperText:
                    'Keep the saved ISO timestamp and its timezone, or enter an explicit ISO timestamp.',
              ),
              _field(
                controller: _expiresAtController,
                label: 'Expires at (ISO optional)',
              ),
              SwitchListTile.adaptive(
                contentPadding: EdgeInsets.zero,
                value: _isActive,
                onChanged: !_editable
                    ? null
                    : (value) {
                        if (_current && _editable)
                          setState(() => _isActive = value);
                      },
                title: const Text('Active'),
                subtitle: const Text('Inactive coupons cannot be redeemed'),
              ),
            ],
          ),
        ),
      ),
      fullPage: true,
    );
  }
}
