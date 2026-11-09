import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:letbuyy_store/theme/app_theme_colors.dart';
import 'package:letbuyy_store/theme/store_theme.dart';
import 'package:letbuyy_store/widgets/settings/settings_tile.dart';

double contrast(Color a, Color b) {
  final x = a.computeLuminance(), y = b.computeLuminance();
  return x > y ? (x + .05) / (y + .05) : (y + .05) / (x + .05);
}

void main() {
  setUpAll(initializeLetbuyyTypography);
  for (final dark in [false, true]) {
    testWidgets(
      'supporting copy is readable on actual settings surfaces in ${dark ? 'dark' : 'light'}',
      (tester) async {
        late AppThemeColors colors;
        await tester.pumpWidget(
          MaterialApp(
            theme: dark ? StoreTheme.dark() : StoreTheme.light(),
            home: Builder(
              builder: (context) {
                colors = AppThemeColors.of(context);
                return Scaffold(
                  backgroundColor: colors.card,
                  body: const SettingsSection(
                    title: 'Account security',
                    children: [
                      SettingsTile(
                        icon: Icons.security_outlined,
                        title: 'Authenticator',
                        subtitle:
                            'Two-factor authentication and recovery codes',
                      ),
                    ],
                  ),
                );
              },
            ),
          ),
        );
        final caption = tester.widget<Text>(
          find.text('Two-factor authentication and recovery codes'),
        );
        expect(
          contrast(caption.style!.color!, colors.card),
          greaterThanOrEqualTo(4.5),
        );
        for (final foreground in [
          colors.textSecondary,
          colors.textTertiary,
          colors.textHint,
        ]) {
          for (final background in [
            colors.card,
            colors.cardHover,
            colors.bgStart,
          ]) {
            expect(contrast(foreground, background), greaterThanOrEqualTo(4.5));
          }
        }
      },
    );
    testWidgets(
      'settings retains full supporting copy and reachable trailing action at scale2.4 in ${dark ? 'dark' : 'light'}',
      (tester) async {
        tester.view.physicalSize = const Size(320, 600);
        tester.view.devicePixelRatio = 1;
        addTearDown(tester.view.resetPhysicalSize);
        addTearDown(tester.view.resetDevicePixelRatio);
        const caption =
            'Private verification documents, review status and recovery details remain available for this store.';
        var taps = 0;
        await tester.pumpWidget(
          MaterialApp(
            theme: dark ? StoreTheme.dark() : StoreTheme.light(),
            builder: (context, child) => MediaQuery(
              data: MediaQuery.of(
                context,
              ).copyWith(textScaler: TextScaler.linear(2.4)),
              child: child!,
            ),
            home: Scaffold(
              body: SingleChildScrollView(
                child: SettingsSection(
                  title: 'Store settings',
                  children: [
                    SettingsTile(
                      icon: Icons.verified_user_outlined,
                      title: 'Business verification',
                      subtitle: caption,
                      trailingBelow: true,
                      trailing: TextButton(
                        onPressed: () => taps++,
                        child: const Text('Review documents'),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        );
        await tester.pumpAndSettle();
        expect(tester.takeException(), isNull);
        final text = tester.widget<Text>(find.text(caption));
        expect(text.maxLines, isNull);
        expect(text.overflow, isNot(TextOverflow.ellipsis));
        await tester.ensureVisible(find.text('Review documents'));
        await tester.tap(find.text('Review documents'));
        expect(taps, 1);
        expect(tester.takeException(), isNull);
      },
    );
  }
}
