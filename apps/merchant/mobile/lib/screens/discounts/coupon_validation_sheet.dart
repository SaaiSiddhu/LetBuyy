import 'package:flutter/material.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:provider/provider.dart';
import '../../services/coupon_service.dart';
import '../../services/api_client.dart' show ApiException;
import '../../widgets/shared/merchant_store_view.dart';

/// Read-only code availability. Checkout remains the pricing authority.
class CouponValidationSheet extends StatefulWidget {
  const CouponValidationSheet({
    super.key,
    required this.view,
    required this.ownerCurrent,
    required this.onDenied,
  });
  final MerchantStoreView view;
  final bool Function() ownerCurrent;
  final VoidCallback onDenied;
  @override
  State<CouponValidationSheet> createState() => _CouponValidationSheetState();
}

class _CouponValidationSheetState extends State<CouponValidationSheet> {
  final _code = TextEditingController(), _subtotal = TextEditingController();
  bool _busy = false;
  String? _message, _title;
  LetbuyyFeedbackKind _kind = LetbuyyFeedbackKind.information;
  bool get _ownerCurrent =>
      mounted &&
      merchantStoreViewCurrent(context, widget.view) &&
      widget.ownerCurrent();
  bool get _current => _ownerCurrent && isLetbuyySurfaceCurrent(context);
  @override
  void dispose() {
    _code.dispose();
    _subtotal.dispose();
    super.dispose();
  }

  Future<void> _check() async {
    if (!_current || _busy || _code.text.trim().isEmpty) return;
    setState(() {
      _busy = true;
      _message = null;
    });
    try {
      final response = await context.read<CouponService>().validateCoupon(
        storeId: widget.view.storeId,
        code: _code.text.trim(),
        subtotal: double.tryParse(_subtotal.text.trim()),
      );
      if (!_ownerCurrent) return;
      setState(() {
        if (response['valid'] == true) {
          _title = 'Code is available';
          _message =
              'Checkout checks the cart and calculates the final discount.';
          _kind = LetbuyyFeedbackKind.success;
        } else if (response['valid'] == false) {
          _title = 'Code is unavailable';
          _message =
              response['reason']?.toString() ??
              'This code cannot currently be used.';
          _kind = LetbuyyFeedbackKind.information;
        } else {
          _title = 'Availability unconfirmed';
          _message =
              'The response did not confirm whether this code is available.';
          _kind = LetbuyyFeedbackKind.information;
        }
      });
    } catch (error) {
      if (!_ownerCurrent) return;
      if (error is ApiException && [401, 403].contains(error.statusCode)) {
        widget.onDenied();
        return;
      }
      setState(() {
        _title = 'Check unavailable';
        _message =
            'The code could not be checked. Check your connection and current store access.';
        _kind = LetbuyyFeedbackKind.error;
      });
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => guardMerchantStoreView(
    _ownerCurrent ? widget.view : null,
    LetbuyyFormSheet(
      title: 'Check coupon',
      description:
          'Check code availability. Final cart eligibility and amounts are decided at checkout.',
      canDismiss: !_busy,
      actions: [
        TextButton(
          onPressed: _busy ? null : () => dismissLetbuyySurface(context),
          child: const Text('Cancel'),
        ),
        FilledButton(
          onPressed: _busy ? null : _check,
          child: const Text('Validate'),
        ),
      ],
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          CustomTextField(
            controller: _code,
            label: 'Code',
            enabled: !_busy,
            textCapitalization: TextCapitalization.characters,
          ),
          const SizedBox(height: 16),
          CustomTextField(
            controller: _subtotal,
            label: 'Cart subtotal',
            enabled: !_busy,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
          ),
          if (_busy) ...[
            const SizedBox(height: 16),
            const LinearProgressIndicator(),
            const Text('Checking code availability…'),
          ],
          if (_message != null) ...[
            const SizedBox(height: 16),
            LetbuyyInlineFeedback(
              title: _title!,
              message: _message!,
              kind: _kind,
            ),
          ],
        ],
      ),
    ),
    sheet: true,
  );
}
