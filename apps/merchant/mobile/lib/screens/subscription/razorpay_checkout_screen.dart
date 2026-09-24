import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:letbuyy_models/letbuyy_models.dart';
import 'package:provider/provider.dart';
import 'package:webview_flutter/webview_flutter.dart';

import '../../config/app_config.dart';
import '../../services/subscription_service.dart';
import '../../theme/app_theme_colors.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';

class RazorpayCheckoutScreen extends StatefulWidget {
  const RazorpayCheckoutScreen({
    super.key,
    required this.storeId,
    required this.plan,
    required this.checkout,
  });

  final String storeId;
  final SubscriptionPlan plan;
  final Map<String, dynamic> checkout;

  @override
  State<RazorpayCheckoutScreen> createState() => _RazorpayCheckoutScreenState();
}

class _RazorpayCheckoutScreenState extends State<RazorpayCheckoutScreen> {
  late final WebViewController _controller;
  bool _isVerifying = false;
  bool _isReady = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setNavigationDelegate(
        NavigationDelegate(
          onPageFinished: (_) {
            if (mounted) setState(() => _isReady = true);
          },
          onWebResourceError: (error) {
            if (!mounted) return;
            setState(() => _error = error.description);
          },
        ),
      )
      ..addJavaScriptChannel(
        'RazorpaySuccess',
        onMessageReceived: (message) => _verifyPayload(message.message),
      )
      ..addJavaScriptChannel(
        'RazorpayError',
        onMessageReceived: (message) {
          if (!mounted) return;
          setState(() => _error = message.message);
        },
      );

    final checkoutUrl = _checkoutUrlFrom(widget.checkout);
    final inlineHtml = _inlineCheckoutHtml();
    if (inlineHtml != null) {
      _controller.loadHtmlString(inlineHtml);
    } else if (checkoutUrl != null) {
      _controller.loadRequest(Uri.parse(checkoutUrl));
    } else {
      _error =
          'Razorpay checkout requires key_id plus order/subscription id, or a gateway checkout URL.';
    }
  }

  Future<void> _verifyPayload(String rawPayload) async {
    if (_isVerifying) return;
    setState(() {
      _isVerifying = true;
      _error = null;
    });

    try {
      final payload = Map<String, dynamic>.from(jsonDecode(rawPayload) as Map);
      await context.read<SubscriptionService>().verifySubscriptionPayment(
        storeId: widget.storeId,
        plan: widget.plan,
        razorpayPaymentId: _stringValue(payload['razorpay_payment_id']),
        razorpaySignature: _stringValue(payload['razorpay_signature']),
        razorpayOrderId:
            _nullableString(payload['razorpay_order_id']) ??
            _nullableString(widget.checkout['razorpay_order_id']),
        razorpaySubscriptionId:
            _nullableString(payload['razorpay_subscription_id']) ??
            _nullableString(widget.checkout['razorpay_subscription_id']),
        billingPeriod:
            _nullableString(widget.checkout['billing_period']) ?? 'monthly',
      );
      if (!mounted) return;
      Navigator.pop(context, true);
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error.toString().replaceAll('Exception: ', '');
      });
    } finally {
      if (mounted) setState(() => _isVerifying = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    return Scaffold(
      backgroundColor: colors.bgStart,
      appBar: AppBar(
        backgroundColor: colors.bgStart,
        foregroundColor: colors.textPrimary,
        elevation: 0,
        title: const Text('Razorpay Checkout'),
      ),
      body: Container(
        decoration: colors.backgroundGradient,
        child: SafeArea(
          child: Stack(
            children: [
              Padding(
                padding: const EdgeInsets.all(LetbuyySpacingTokens.space16),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(20),
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      color: colors.card,
                      border: Border.all(color: colors.cardBorder),
                    ),
                    child: _error != null
                        ? _buildError(colors)
                        : WebViewWidget(controller: _controller),
                  ),
                ),
              ),
              if (!_isReady && _error == null)
                Center(child: CircularProgressIndicator(color: colors.accent)),
              if (_isVerifying)
                Container(
                  color: Colors.black.withValues(alpha: 0.35),
                  child: const Center(
                    child: CircularProgressIndicator(color: Colors.white),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildError(AppThemeColors colors) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(LetbuyySpacingTokens.space24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.error_outline_rounded, color: colors.error, size: 36),
            const SizedBox(height: LetbuyySpacingTokens.space16),
            Text(
              _error!,
              textAlign: TextAlign.center,
              style: TextStyle(color: colors.textPrimary, height: 1.4),
            ),
            const SizedBox(height: LetbuyySpacingTokens.space20),
            OutlinedButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Close'),
            ),
          ],
        ),
      ),
    );
  }

  String? _inlineCheckoutHtml() {
    final keyId =
        _nullableString(widget.checkout['key_id']) ??
        _nullableString(widget.checkout['razorpay_key_id']) ??
        _nullableString(AppConfig.razorpayKeyId);
    final orderId = _nullableString(widget.checkout['razorpay_order_id']);
    final subscriptionId = _nullableString(
      widget.checkout['razorpay_subscription_id'],
    );

    if (keyId == null ||
        !AppConfig.isConfiguredValue(keyId) ||
        (orderId == null && subscriptionId == null)) {
      return null;
    }

    final plan = Map<String, dynamic>.from(
      widget.checkout['plan'] as Map? ?? const {},
    );
    final options = <String, dynamic>{
      'key': keyId,
      'name': 'LetBuyy',
      'description':
          '${_nullableString(plan['name']) ?? widget.plan.name} subscription',
      'currency': _nullableString(widget.checkout['currency']) ?? 'INR',
      'amount': widget.checkout['amount'],
      if (orderId != null) 'order_id': orderId,
      if (subscriptionId != null) 'subscription_id': subscriptionId,
      'theme': {'color': '#8B5CF6'},
    };
    final optionsJson = jsonEncode(options);

    return '''
<!doctype html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
  <style>
    html, body {
      margin: 0;
      height: 100%;
      font-family: -apple-system, BlinkMacSystemFont, "Inter", sans-serif;
      background: #f8fafc;
    }
    .wrap {
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      box-sizing: border-box;
      text-align: center;
    }
    button {
      border: 0;
      border-radius: 14px;
      background: #8B5CF6;
      color: white;
      padding: 15px 20px;
      font-size: 16px;
      font-weight: 700;
      min-width: 220px;
    }
    p {
      color: #64748b;
      line-height: 1.45;
    }
  </style>
</head>
<body>
  <div class="wrap">
    <div>
      <h2>Complete payment</h2>
      <p>Razorpay checkout will open inside the app.</p>
      <button id="pay">Open checkout</button>
    </div>
  </div>
  <script>
    const options = $optionsJson;
    options.handler = function(response) {
      RazorpaySuccess.postMessage(JSON.stringify(response));
    };
    options.modal = {
      ondismiss: function() {
        RazorpayError.postMessage('Checkout was closed before payment completed.');
      }
    };
    function openCheckout() {
      try {
        const checkout = new Razorpay(options);
        checkout.open();
      } catch (error) {
        RazorpayError.postMessage(String(error && error.message ? error.message : error));
      }
    }
    document.getElementById('pay').addEventListener('click', openCheckout);
    window.setTimeout(openCheckout, 250);
  </script>
</body>
</html>
''';
  }
}

String? _checkoutUrlFrom(Map<String, dynamic> checkout) {
  for (final key in const ['short_url', 'checkout_url', 'payment_url']) {
    final value = checkout[key];
    if (value is String && value.trim().isNotEmpty) return value.trim();
  }
  return null;
}

String _stringValue(Object? value) => value is String ? value : '';

String? _nullableString(Object? value) {
  if (value is! String || value.trim().isEmpty) return null;
  return value.trim();
}
