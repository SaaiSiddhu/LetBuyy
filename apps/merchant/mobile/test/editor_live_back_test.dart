import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:letbuyy_store/theme/store_theme.dart';

void main() {
  setUpAll(initializeLetbuyyTypography);
  testWidgets(
    'live draft blocks immediate Back and clean editor keeps iOS gesture',
    (tester) async {
      final draft = TextEditingController();
      addTearDown(draft.dispose);
      MaterialPageRoute<void>? route;
      await tester.pumpWidget(
        MaterialApp(
          theme: StoreTheme.light().copyWith(platform: TargetPlatform.iOS),
          home: Scaffold(
            body: Builder(
              builder: (context) => TextButton(
                onPressed: () {
                  route = MaterialPageRoute<void>(
                    builder: (_) => ValueListenableBuilder(
                      valueListenable: draft,
                      builder: (_, value, _) => LetbuyyEditorScaffold(
                        title: 'Editor',
                        hasChanges: value.text.isNotEmpty,
                        currentHasChanges: () => draft.text.isNotEmpty,
                        body: CustomTextField(
                          controller: draft,
                          label: 'Draft',
                        ),
                      ),
                    ),
                  );
                  unawaited(Navigator.of(context).push<void>(route!));
                },
                child: const Text('Open editor'),
              ),
            ),
          ),
        ),
      );
      await tester.tap(find.text('Open editor'));
      await tester.pumpAndSettle();
      expect(route!.popGestureEnabled, isTrue);
      await tester.enterText(find.byType(TextField), 'Unsaved exact draft');
      expect(route!.popDisposition, RoutePopDisposition.doNotPop);
      expect(route!.popGestureEnabled, isFalse);
      await tester.binding.handlePopRoute();
      await tester.pumpAndSettle();
      expect(find.text('Discard changes?'), findsOneWidget);
      await tester.tap(find.text('Cancel'));
      await tester.pumpAndSettle();
      expect(draft.text, 'Unsaved exact draft');
      draft.clear();
      await tester.pumpAndSettle();
      expect(route!.popGestureEnabled, isTrue);
      await tester.binding.handlePopRoute();
      await tester.pumpAndSettle();
      expect(find.text('Open editor'), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );
}
