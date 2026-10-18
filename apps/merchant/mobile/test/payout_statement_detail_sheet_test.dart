import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_store/screens/money/payout_statement_detail_sheet.dart';

void main() {
  testWidgets('renders recorded payout and source-ledger details', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: PayoutStatementDetailSheet(
            load: () async => {
              'statement_number': 'PYT-TEST-1',
              'status': 'processing',
              'provider_mode': 'sandbox',
              'gross_amount_minor': 10000,
              'platform_fee_minor': 0,
              'tax_minor': 0,
              'net_amount_minor': 10000,
              'utr': 'utr-test-1',
              'source_order_lineage': [
                {
                  'order_id': 'order-test-1',
                  'source_order_gross_minor': 10000,
                  'canonical_merchant_payable_delta_minor': 8500,
                  'lineage_status': 'linked',
                  'ledger_transactions': [
                    {
                      'source_type': 'payment_capture',
                      'merchant_payable_delta_minor': 10000,
                    },
                    {
                      'source_type': 'refund',
                      'merchant_payable_delta_minor': -1500,
                    },
                  ],
                },
              ],
            },
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('PYT-TEST-1'), findsOneWidget);
    expect(find.text('processing · sandbox'), findsOneWidget);
    expect(find.text('₹100.00'), findsNWidgets(4));
    expect(find.text('₹85.00'), findsOneWidget);
    expect(find.text('-₹15.00'), findsOneWidget);
    expect(find.text('refund'), findsOneWidget);
    expect(find.text('utr-test-1'), findsOneWidget);
    expect(
      find.textContaining('does not determine payout eligibility'),
      findsOneWidget,
    );
    expect(tester.takeException(), isNull);
  });

  testWidgets('reports missing source lineage without inventing transactions', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: PayoutStatementDetailSheet(
            load: () async => {
              'statement_number': 'PYT-MISSING',
              'status': 'pending',
              'source_order_lineage': [
                {
                  'order_id': 'order-missing',
                  'source_order_gross_minor': 10000,
                  'canonical_merchant_payable_delta_minor': 0,
                  'lineage_status': 'missing',
                  'ledger_transactions': [],
                },
              ],
            },
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Lineage status'), findsOneWidget);
    expect(find.text('missing'), findsOneWidget);
    expect(find.text('No source-order lineage is recorded.'), findsNothing);
    expect(find.text('payment_capture'), findsNothing);
    expect(tester.takeException(), isNull);
  });
}
