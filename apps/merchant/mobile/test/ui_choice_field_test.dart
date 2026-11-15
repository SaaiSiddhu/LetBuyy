import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:letbuyy_store/theme/store_theme.dart';

void main() {
  setUpAll(initializeLetbuyyTypography);
  for (final dark in [false, true]) {
    testWidgets(
      'choice preserves required validation, draft and focus in ${dark ? 'dark' : 'light'}',
      (tester) async {
        tester.view.physicalSize = const Size(320, 600);
        tester.view.devicePixelRatio = 1;
        addTearDown(tester.view.resetPhysicalSize);
        addTearDown(tester.view.resetDevicePixelRatio);
        final form = GlobalKey<FormState>();
        String? value;
        var changes = 0;
        late StateSetter update;
        await tester.pumpWidget(
          MaterialApp(
            theme: dark ? StoreTheme.dark() : StoreTheme.light(),
            builder: (_, child) => MediaQuery(
              data: const MediaQueryData(
                size: Size(320, 600),
                textScaler: TextScaler.linear(2.4),
                disableAnimations: true,
              ),
              child: child!,
            ),
            home: Scaffold(
              body: SingleChildScrollView(
                child: Form(
                  key: form,
                  child: StatefulBuilder(
                    builder: (_, set) {
                      update = set;
                      return LetbuyyChoiceField<String>(
                        label: 'Role',
                        value: value,
                        choices: const [
                          LetbuyyChoice(value: 'viewer', label: 'Viewer'),
                          LetbuyyChoice(value: 'manager', label: 'Manager'),
                        ],
                        validator: (value) =>
                            value == null ? 'Choose a supported role.' : null,
                        onChanged: (next) => set(() {
                          value = next;
                          changes++;
                        }),
                      );
                    },
                  ),
                ),
              ),
            ),
          ),
        );
        expect(form.currentState!.validate(), isFalse);
        await tester.pumpAndSettle();
        expect(find.text('Choose a supported role.'), findsOneWidget);
        await tester.tap(find.byType(OutlinedButton));
        await tester.pumpAndSettle();
        expect(
          tester
              .widget<FilledButton>(
                find.widgetWithText(FilledButton, 'Apply selection'),
              )
              .onPressed,
          isNull,
        );
        await tester.tap(find.text('Viewer'));
        await tester.ensureVisible(find.text('Cancel'));
        await tester.tap(find.text('Cancel'));
        await tester.pumpAndSettle();
        expect(value, isNull);
        expect(changes, 0);
        await tester.tap(find.byType(OutlinedButton));
        await tester.pumpAndSettle();
        await tester.tap(find.text('Manager'));
        await tester.pump();
        await tester.ensureVisible(find.text('Apply selection'));
        await tester.tap(find.text('Apply selection'));
        await tester.pumpAndSettle();
        expect(value, 'manager');
        expect(changes, 1);
        expect(find.text('Choose a supported role.'), findsNothing);
        expect(form.currentState!.validate(), isTrue);
        await tester.pumpAndSettle();
        expect(find.text('Choose a supported role.'), findsNothing);
        final button = tester.widget<OutlinedButton>(
          find.byType(OutlinedButton),
        );
        expect(button.focusNode!.hasFocus, isTrue);
        update(() => value = 'viewer');
        await tester.pumpAndSettle();
        expect(find.text('Viewer'), findsOneWidget);
        expect(find.text('Manager'), findsNothing);
        expect(changes, 1);
        expect(tester.takeException(), isNull);
      },
    );
  }
}
