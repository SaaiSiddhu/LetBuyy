import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_admin/widgets/common/loading_overlay.dart';

void main() {
  group('LoadingOverlay (admin_app\'s own copy)', () {
    testWidgets('always renders the child, loading or not', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: LoadingOverlay(isLoading: false, child: Text('content')),
        ),
      );
      expect(find.text('content'), findsOneWidget);

      await tester.pumpWidget(
        const MaterialApp(
          home: LoadingOverlay(isLoading: true, child: Text('content')),
        ),
      );
      expect(find.text('content'), findsOneWidget);
    });

    testWidgets('shows a spinner only when isLoading is true', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: LoadingOverlay(isLoading: false, child: Text('content')),
        ),
      );
      expect(find.byType(CircularProgressIndicator), findsNothing);

      await tester.pumpWidget(
        const MaterialApp(
          home: LoadingOverlay(isLoading: true, child: Text('content')),
        ),
      );
      expect(find.byType(CircularProgressIndicator), findsOneWidget);
    });

    testWidgets('shows loadingText only while isLoading is true', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: LoadingOverlay(
            isLoading: true,
            loadingText: 'Loading dashboard...',
            child: Text('content'),
          ),
        ),
      );
      expect(find.text('Loading dashboard...'), findsOneWidget);

      await tester.pumpWidget(
        const MaterialApp(
          home: LoadingOverlay(
            isLoading: false,
            loadingText: 'Loading dashboard...',
            child: Text('content'),
          ),
        ),
      );
      expect(find.text('Loading dashboard...'), findsNothing);
    });
  });
}
