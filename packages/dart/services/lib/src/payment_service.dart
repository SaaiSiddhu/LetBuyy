import 'package:razorpay_flutter/razorpay_flutter.dart';
import 'package:letbuyy_core/letbuyy_core.dart';

class PaymentService {
  late Razorpay _razorpay;
  Function(PaymentSuccessResponse)? _onSuccess;
  Function(PaymentFailureResponse)? _onFailure;

  // Initialize Razorpay
  void initialize({
    required Function(PaymentSuccessResponse) onSuccess,
    required Function(PaymentFailureResponse) onFailure,
  }) {
    _razorpay = Razorpay();
    _onSuccess = onSuccess;
    _onFailure = onFailure;

    _razorpay.on(Razorpay.EVENT_PAYMENT_SUCCESS, _handlePaymentSuccess);
    _razorpay.on(Razorpay.EVENT_PAYMENT_ERROR, _handlePaymentFailure);
    _razorpay.on(Razorpay.EVENT_EXTERNAL_WALLET, _handleExternalWallet);
  }

  // Open Razorpay checkout
  Future<void> openCheckout({
    required String keyId,
    required double amount,
    required String orderId,
    required String name,
    required String email,
    required String phone,
    String? description,
  }) async {
    if (keyId.isEmpty || orderId.isEmpty || amount <= 0) {
      throw PaymentException(
        'Backend-created payment order data is required before opening checkout',
        code: 'PAYMENT_ORDER_REQUIRED',
      );
    }

    try {
      final options = {
        'key': keyId,
        'amount': (amount * 100).toInt(), // Amount in paise
        'name': RazorpayConfig.appName,
        'order_id': orderId,
        'description': description ?? 'Payment for order $orderId',
        'timeout': 300, // 5 minutes in seconds
        'prefill': {
          'contact': phone,
          'email': email,
          'name': name,
        },
        'theme': {
          'color': RazorpayConfig.themeColor,
        },
        'modal': {
          'ondismiss': () {
            throw PaymentCancelledException('Payment cancelled by user');
          }
        }
      };

      _razorpay.open(options);
    } catch (e) {
      throw PaymentException('Failed to open payment: ${e.toString()}');
    }
  }

  // Handle payment success
  void _handlePaymentSuccess(PaymentSuccessResponse response) {
    _onSuccess?.call(response);
  }

  // Handle payment failure
  void _handlePaymentFailure(PaymentFailureResponse response) {
    _onFailure?.call(response);
  }

  // Handle external wallet
  void _handleExternalWallet(ExternalWalletResponse response) {
    // Handle external wallet payment
  }

  // Verify payment signature
  bool verifyPaymentSignature({
    required String orderId,
    required String paymentId,
    required String signature,
    required String secret,
  }) {
    throw PaymentException(
      'Payment signatures must be verified by the backend',
      code: 'BACKEND_VERIFICATION_REQUIRED',
    );
  }

  // Process COD order
  Future<Map<String, dynamic>> processCODOrder({
    required String orderId,
    required double amount,
  }) async {
    throw PaymentException(
      'COD orders must be created through the backend checkout workflow',
      code: 'BACKEND_CHECKOUT_REQUIRED',
    );
  }

  // Create Razorpay order (backend integration required)
  Future<String> createRazorpayOrder({
    required double amount,
    required String currency,
  }) async {
    throw PaymentException(
      'Razorpay orders must be created through the backend checkout workflow',
      code: 'BACKEND_PAYMENT_ORDER_REQUIRED',
    );
  }

  // Dispose Razorpay
  void dispose() {
    _razorpay.clear();
  }
}
