import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'kyc_containment_test.dart' as f;

Map<String, dynamic> received() => {
  'overview': {
    ...f.overview('store-a', status: 'submitted'),
    'documents': [
      {
        'id': 'document-store-a',
        'site_id': 'store-a',
        'document_type': 'bank_proof',
        'has_private_upload': true,
        'file_name': 'proof.png',
        'status': 'submitted',
        'evidence_scan_status': 'pending',
      },
    ],
  },
};
Future<f.Fixture> open(WidgetTester tester) async {
  final fixture = f.Fixture();
  addTearDown(() async {
    await tester.pumpWidget(const SizedBox.shrink());
    fixture.service.dispose();
    fixture.stores.dispose();
    fixture.api.close();
  });
  await tester.pumpWidget(fixture.screen());
  await tester.pump();
  await f.replyWidget(tester, fixture, f.overview('store-a'));
  await tester.pumpAndSettle();
  await f.openReference(tester);
  return fixture;
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  testWidgets(
    'positive private upload receives acknowledgement and returns to current KYC overview',
    (tester) async {
      final fixture = await open(tester);
      await f.submitReference(tester, fixture, 'AB12');
      await f.replyUploadWidget(tester, fixture, received());
      await tester.pumpAndSettle();
      expect(find.text('Upload verification document'), findsNothing);
      expect(fixture.calls.where((r) => r.method == 'POST'), hasLength(1));
      expect(
        find.text('Private document received. No security scan result yet.'),
        findsOneWidget,
      );
    },
  );
  for (final dismissal in ['Close', 'Back', 'outside'])
    testWidgets(
      'pending upload cannot lose its owned form through $dismissal',
      (tester) async {
        final fixture = await open(tester);
        await f.submitReference(tester, fixture, 'AB12');
        await f.awaitWidgetRequest(tester, fixture);
        if (dismissal == 'Close')
          await tester.tap(find.widgetWithText(TextButton, 'Close'));
        else if (dismissal == 'Back')
          await tester.binding.handlePopRoute();
        else
          await tester.tapAt(const Offset(4, 4));
        await tester.pump();
        await tester.pump(const Duration(milliseconds: 350));
        expect(find.text('Upload verification document'), findsOneWidget);
        expect(find.byType(TextField), findsOneWidget);
        await f.replyUploadWidget(tester, fixture, received());
        await tester.pumpAndSettle();
        expect(fixture.calls.where((r) => r.method == 'POST'), hasLength(1));
      },
    );
  testWidgets(
    'covered upload completion cannot pop another route or issue a second upload',
    (tester) async {
      final fixture = await open(tester);
      await f.submitReference(tester, fixture, 'AB12');
      await f.awaitWidgetRequest(tester, fixture);
      final navigator = tester.state<NavigatorState>(find.byType(Navigator));
      navigator.push(
        MaterialPageRoute<void>(
          builder: (_) =>
              const Scaffold(body: Text('Synthetic covered destination')),
        ),
      );
      await tester.pumpAndSettle();
      await f.replyUploadWidget(tester, fixture, received());
      await tester.pumpAndSettle();
      expect(find.text('Synthetic covered destination'), findsOneWidget);
      navigator.pop();
      await tester.pumpAndSettle();
      expect(
        find.text('Document received. Close to refresh status.'),
        findsOneWidget,
      );
      expect(
        tester
            .widget<FilledButton>(
              find.widgetWithText(FilledButton, 'Upload document'),
            )
            .onPressed,
        isNull,
      );
      await tester.tap(find.widgetWithText(TextButton, 'Close'));
      await tester.pumpAndSettle();
      expect(find.text('Upload verification document'), findsNothing);
      expect(fixture.calls.where((r) => r.method == 'POST'), hasLength(1));
    },
  );
}
