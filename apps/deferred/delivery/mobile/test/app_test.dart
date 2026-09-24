import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:rider_app/src/app.dart';

void main() {
  testWidgets('renders rider auth entrypoint when unauthenticated',
      (tester) async {
    await tester.pumpWidget(
      const ProviderScope(
        child: QuickcommerceRiderApp(),
      ),
    );

    await tester.pump();

    expect(find.text('Rider login'), findsOneWidget);
    expect(find.text('Send OTP'), findsOneWidget);
  });
}
