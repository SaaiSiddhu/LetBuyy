import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:fl_chart/fl_chart.dart';
import 'package:letbuyy_store/widgets/dashboard/animated_revenue_chart.dart';
import 'package:letbuyy_store/theme/store_theme.dart';
import 'package:letbuyy_store/services/native_push_service.dart';

void main() {
  testWidgets(
    'verified zero daily revenue renders a chart and period buttons request backend periods',
    (tester) async {
      final selected = <String>[];
      await tester.pumpWidget(
        MaterialApp(
          theme: StoreTheme.light(),
          home: Scaffold(
            body: AnimatedRevenueChart(
              revenueData: List.filled(7, 0),
              revenueDates: List.generate(7, (i) => DateTime(2026, 10, 15 + i)),
              period: '7d',
              onPeriodChanged: selected.add,
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.byType(LineChart), findsOneWidget);
      expect(find.text('Revenue history unavailable'), findsNothing);
      expect(tester.takeException(), isNull);
      for (final period in ['30d', '90d', '12m', '7d']) {
        await tester.tap(find.byKey(ValueKey('revenue-period-$period')));
        await tester.pump();
      }
      expect(selected, ['30d', '90d', '12m', '7d']);
    },
  );
  test(
    'notification taps only open the current account inbox; stale and malformed payloads do nothing',
    () {
      String? actor = 'merchant-a';
      var opened = 0;
      final native = NativePushService(
        actorId: () => actor,
        openInbox: () => opened++,
      );
      native.handleNotificationTap(
        jsonEncode({'user_id': 'merchant-b', 'action_url': '/admin'}),
      );
      native.handleNotificationTap('bad json');
      native.handleNotificationTap(null);
      expect(opened, 0);
      native.handleNotificationTap(
        jsonEncode({
          'user_id': 'merchant-a',
          'action_url': 'https://untrusted.invalid',
        }),
      );
      expect(opened, 1); // Always the inbox callback; never a supplied URL.
      actor = null;
      native.handleNotificationTap(jsonEncode({'user_id': 'merchant-a'}));
      expect(opened, 1);
    },
  );
}
