import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:fl_chart/fl_chart.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:letbuyy_store/widgets/dashboard/animated_revenue_chart.dart';
import 'package:letbuyy_store/theme/store_theme.dart';
import 'package:letbuyy_store/services/native_push_service.dart';

void main() {
  setUpAll(initializeLetbuyyTypography);
  testWidgets(
    'verified zero daily revenue renders a chart and period buttons request backend periods',
    (tester) async {
      final selected = <String>[];
      var current = '7d';
      await tester.pumpWidget(
        MaterialApp(
          theme: StoreTheme.light(),
          home: Scaffold(
            body: StatefulBuilder(
              builder: (context, update) => AnimatedRevenueChart(
                revenueData: List.filled(7, 0),
                revenueDates: List.generate(
                  7,
                  (i) => DateTime(2026, 10, 15 + i),
                ),
                period: current,
                onPeriodChanged: (value) {
                  selected.add(value);
                  update(() => current = value);
                },
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.byType(LineChart), findsOneWidget);
      expect(find.text('Revenue history unavailable'), findsNothing);
      expect(tester.takeException(), isNull);
      for (final label in ['30 days', '90 days', '12 months', '7 days']) {
        await tester.tap(find.byType(OutlinedButton));
        await tester.pumpAndSettle();
        await tester.tap(find.text(label).last);
        await tester.pumpAndSettle();
        expect(
          selected.length,
          ['30 days', '90 days', '12 months', '7 days'].indexOf(label),
        );
        await tester.tap(find.text('Apply selection'));
        await tester.pumpAndSettle();
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
