import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_marketplace_ui_kit/letbuyy_marketplace_ui_kit.dart';

Future<void> _pump(WidgetTester tester, Widget field) {
  return tester.pumpWidget(
    MaterialApp(home: Scaffold(body: Padding(padding: EdgeInsets.zero, child: field))),
  );
}

void main() {
  group('CustomTextField', () {
    testWidgets('renders the label when showLabel is true (the default)', (
      tester,
    ) async {
      await _pump(tester, const CustomTextField(label: 'Email'));
      expect(find.text('Email'), findsOneWidget);
    });

    testWidgets('hides the label when showLabel is false', (tester) async {
      await _pump(
        tester,
        const CustomTextField(label: 'Email', showLabel: false),
      );
      expect(find.text('Email'), findsNothing);
    });

    testWidgets('typing invokes onChanged with the entered text', (
      tester,
    ) async {
      String? lastValue;
      await _pump(
        tester,
        CustomTextField(label: 'Email', onChanged: (v) => lastValue = v),
      );
      await tester.enterText(find.byType(TextFormField), 'meera@example.com');
      expect(lastValue, 'meera@example.com');
    });

    testWidgets('a controller carries the typed text back out', (tester) async {
      final controller = TextEditingController();
      await _pump(
        tester,
        CustomTextField(label: 'Email', controller: controller),
      );
      await tester.enterText(find.byType(TextFormField), 'meera@example.com');
      expect(controller.text, 'meera@example.com');
    });

    testWidgets('obscureText hides the typed characters from the raw glyph text', (
      tester,
    ) async {
      // TextFormField itself doesn't expose obscureText as a public field
      // (Flutter threads it into an internal builder) -- EditableText, the
      // leaf widget it builds, does.
      await _pump(
        tester,
        const CustomTextField(label: 'Password', obscureText: true),
      );
      final editable = tester.widget<EditableText>(find.byType(EditableText));
      expect(editable.obscureText, isTrue);

      await _pump(
        tester,
        const CustomTextField(label: 'Password'),
      );
      final visible = tester.widget<EditableText>(find.byType(EditableText));
      expect(visible.obscureText, isFalse);
    });

    testWidgets('errorText is surfaced to the rendered InputDecoration', (
      tester,
    ) async {
      await _pump(
        tester,
        const CustomTextField(label: 'Email', errorText: 'Invalid email'),
      );
      expect(find.text('Invalid email'), findsOneWidget);
    });

    testWidgets('helperText renders when there is no error', (tester) async {
      await _pump(
        tester,
        const CustomTextField(
          label: 'Password',
          helperText: 'At least 8 characters',
        ),
      );
      expect(find.text('At least 8 characters'), findsOneWidget);
    });

    testWidgets('enabled:false disables the field so it cannot receive input', (
      tester,
    ) async {
      // enabled isn't exposed as a public field on TextFormField either;
      // assert the actual behavioural effect instead -- entering text into
      // a disabled field must not change its value.
      final controller = TextEditingController();
      await _pump(
        tester,
        CustomTextField(label: 'Email', controller: controller, enabled: false),
      );
      await tester.enterText(find.byType(TextFormField), 'should not stick');
      expect(controller.text, isEmpty);
    });

    testWidgets('an initialValue seeds the field without a controller', (
      tester,
    ) async {
      await _pump(
        tester,
        const CustomTextField(label: 'Email', initialValue: 'seed@example.com'),
      );
      expect(find.text('seed@example.com'), findsOneWidget);
    });

    testWidgets('onTap fires when the field is tapped', (tester) async {
      var tapped = false;
      await _pump(
        tester,
        CustomTextField(label: 'Email', onTap: () => tapped = true),
      );
      await tester.tap(find.byType(TextFormField));
      expect(tapped, isTrue);
    });
  });
}
