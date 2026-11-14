import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_store/services/notification_settings_service.dart';
import 'package:letbuyy_store/widgets/platform_message_body.dart';

MerchantNotification message(String? link) => MerchantNotification.fromJson({
  'id': 'synthetic-message',
  'user_id': 'synthetic-user',
  'type': 'system',
  'title': 'Platform notice',
  'message': List.filled(30, 'Complete notice with readable terms.').join('\n'),
  'data': {
    'source': 'letbuyy_platform',
    'category': 'regulations',
    'expires_at': '2020-01-01T00:00:00Z',
  },
  'action_url': link,
  'is_read': false,
  'created_at': '2026-10-22T00:00:00Z',
});
void main() {
  testWidgets(
    'platform message retains the complete selectable text and explicit sender',
    (tester) async {
      final item = message(null);
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: SingleChildScrollView(
              child: PlatformMessageBody(
                notification: item,
                onOpen: (_) => fail('No link should open'),
              ),
            ),
          ),
        ),
      );
      expect(find.text(item.message!), findsOneWidget);
      expect(
        tester.widget<SelectableText>(find.byType(SelectableText)).maxLines,
        isNull,
      );
      expect(find.text('From LetBuyy · regulations'), findsOneWidget);
      expect(find.textContaining('Expired'), findsOneWidget);
      expect(find.text('View details'), findsNothing);
    },
  );
  testWidgets(
    'unsafe links are unavailable and an HTTPS action requires a tap',
    (tester) async {
      Uri? opened;
      for (final link in [
        'javascript:alert(1)',
        'https://user:password@example.invalid/offer',
      ]) {
        await tester.pumpWidget(
          MaterialApp(
            home: Scaffold(
              body: SingleChildScrollView(
                child: PlatformMessageBody(
                  notification: message(link),
                  onOpen: (value) => opened = value,
                ),
              ),
            ),
          ),
        );
        expect(find.text('View details'), findsNothing);
        expect(opened, isNull);
      }
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: SingleChildScrollView(
              child: PlatformMessageBody(
                notification: message('https://letbuyy.com/offers'),
                onOpen: (value) => opened = value,
              ),
            ),
          ),
        ),
      );
      expect(opened, isNull);
      await tester.ensureVisible(find.text('View details'));
      await tester.tap(find.text('View details'));
      expect(opened.toString(), 'https://letbuyy.com/offers');
    },
  );
}
