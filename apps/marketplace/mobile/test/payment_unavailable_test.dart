// Phase 1R acceptance pass (owner-requested integration-readiness review): payment execution
// must stay verifiably unavailable without ever tapping a real Pay button on a real device or
// invoking a real payment provider. This test exercises PaymentMethodScreen entirely inside the
// Flutter widget-test harness -- an isolated VM environment with no real Razorpay SDK reachable,
// no real network, and no real backend -- so `tester.tap` here can never place a real charge,
// unlike a tap on a live device. It proves the same fact Section 10 of the mandate asked for:
// the disabled/unavailable behavior, verified with isolated fakes, never a real transaction.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:letbuyy_marketplace_services/letbuyy_marketplace_services.dart';
import 'package:letbuyy_marketplace_models/letbuyy_marketplace_models.dart';
import 'package:letbuyy_marketplace/screens/checkout/payment_method_screen.dart';

AddressModel _address() {
  return AddressModel(
    id: 'addr-1',
    userId: 'buyer-1',
    name: 'Payment Test Buyer',
    phone: '9999999999',
    addressLine1: '1 Test Street',
    addressLine2: '',
    city: 'Bengaluru',
    state: 'Karnataka',
    zipcode: '560001',
    country: 'IN',
    isDefault: true,
    createdAt: DateTime.now(),
  );
}

Widget _wrap(Widget child) {
  return MultiProvider(
    providers: [
      ChangeNotifierProvider<ThemeProvider>(create: (_) => ThemeProvider()),
      ChangeNotifierProvider<CartProvider>(create: (_) => CartProvider()),
    ],
    child: MaterialApp(home: child),
  );
}

void main() {
  testWidgets(
    'tapping the Pay button shows the honest "not available yet" dialog and nothing else -- '
    'no loading state, no success state, no navigation away',
    (tester) async {
      await tester.pumpWidget(_wrap(
        PaymentMethodScreen(selectedAddress: _address(), total: 540, shippingFee: 40),
      ));
      await tester.pump();

      expect(find.text('Checkout isn’t available yet'), findsNothing,
          reason: 'the dialog must not appear before the button is ever tapped');
      expect(find.text('Pay ₹540'), findsOneWidget,
          reason: 'confirms the real button under test, with its real label, is on screen');

      await tester.tap(find.text('Pay ₹540'));
      await tester.pump();

      // The real assertion: tapping Pay never enters a "Processing..." state (which would imply
      // a real payment attempt was dispatched) -- it goes straight to the honest dialog.
      expect(find.text('Processing...'), findsNothing,
          reason: 'no processing state may appear -- no payment attempt is ever dispatched');

      await tester.pumpAndSettle();

      expect(find.text('Checkout isn’t available yet'), findsOneWidget);
      expect(
        find.text(
          'Placing a real order isn’t supported in this build yet. Your cart and delivery address are saved for when it is.',
        ),
        findsOneWidget,
        reason: 'the dialog body must state plainly that no real order is placed',
      );

      // Dismiss and confirm the screen returns to its normal, unchanged state -- no false
      // success, no navigation to an order-confirmation screen that doesn't exist.
      await tester.tap(find.text('OK'));
      await tester.pumpAndSettle();

      expect(find.text('Checkout isn’t available yet'), findsNothing);
      expect(find.text('Pay ₹540'), findsOneWidget,
          reason: 'the same button, with the same honest total, is still there -- nothing was consumed or charged');
    },
  );

  testWidgets(
    'the same dialog appears for Cash on Delivery -- the honest boundary does not depend on '
    'which payment method is selected',
    (tester) async {
      await tester.pumpWidget(_wrap(
        PaymentMethodScreen(selectedAddress: _address(), total: 999, shippingFee: 0),
      ));
      await tester.pump();

      final codOption = find.textContaining('Cash on Delivery');
      expect(codOption, findsOneWidget, reason: 'COD must still be a selectable, real option');
      await tester.ensureVisible(codOption);
      await tester.pumpAndSettle();
      await tester.tap(codOption);
      await tester.pump();

      expect(find.text('Place Order • ₹999'), findsOneWidget,
          reason: 'selecting COD changes the button label from Pay to Place Order, honestly');

      await tester.tap(find.text('Place Order • ₹999'));
      await tester.pumpAndSettle();

      expect(find.text('Checkout isn’t available yet'), findsOneWidget,
          reason: 'COD reaches the exact same honest boundary as any other payment method');
    },
  );
}
