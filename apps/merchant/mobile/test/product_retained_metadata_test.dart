import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'product_edit_concurrency_test.dart' as f;
import 'support/editor_steps_fixture.dart';

void main() {
  for (final shape in [
    'category-control',
    'category-null',
    'spec-empty',
    'spec-null',
    'spec-typed',
  ])
    testWidgets('name-only edit conserves retained $shape facts', (
      tester,
    ) async {
      tester.view.physicalSize = const Size(1000, 1600);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final api = f.ProductTransport('clean');
      api.current['category'] = shape == 'category-control'
          ? 'retained-category'
          : null;
      final spec = shape == 'spec-typed'
          ? {'Size': 42, 'Enabled': true}
          : shape == 'spec-null'
          ? null
          : <String, dynamic>{};
      final metadata = {
        'unmanaged': {'value': 17},
        'specifications': spec,
      };
      api.current['metadata'] = metadata;
      final owners = await f.mount(tester, api);
      addTearDown(() async {
        await tester.pumpWidget(const SizedBox.shrink());
        owners.service.dispose();
        owners.stores.dispose();
        api.close();
      });
      await tester.enterText(f.nameField(), 'Renamed with retained facts');
      await tester.tap(find.widgetWithText(FilledButton, 'Update'));
      await tester.pumpAndSettle();
      expect(api.calls, hasLength(1));
      expect(api.current['name'], 'Renamed with retained facts');
      if (shape.startsWith('category'))
        expect(
          api.current['category'],
          shape == 'category-control' ? 'retained-category' : null,
        );
      else
        expect(api.current['metadata'], metadata);
    });
  testWidgets(
    'explicit specification removal still saves and preserves unmanaged metadata',
    (tester) async {
      tester.view.physicalSize = const Size(1000, 1600);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final api = f.ProductTransport('clean');
      api.current['metadata'] = {
        'unmanaged': 17,
        'specifications': {'Size': 42},
      };
      final owners = await f.mount(tester, api);
      addTearDown(() async {
        await tester.pumpWidget(const SizedBox.shrink());
        owners.service.dispose();
        owners.stores.dispose();
        api.close();
      });
      await selectEditorSection(tester, 'Details');
      final remove = find.widgetWithText(
        TextButton,
        'Remove specification Size',
      );
      await tester.ensureVisible(remove);
      await tester.pumpAndSettle();
      await tester.tap(remove);
      await tester.tap(find.widgetWithText(FilledButton, 'Update'));
      await tester.pumpAndSettle();
      expect(api.calls, hasLength(1));
      expect(api.current['metadata'], {'unmanaged': 17});
    },
  );
  testWidgets('adding a specification preserves the existing typed entries', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(1000, 1600);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final api = f.ProductTransport('clean');
    api.current['metadata'] = {
      'unmanaged': 17,
      'specifications': {'Size': 42},
    };
    final owners = await f.mount(tester, api);
    addTearDown(() async {
      await tester.pumpWidget(const SizedBox.shrink());
      owners.service.dispose();
      owners.stores.dispose();
      api.close();
    });
    await selectEditorSection(tester, 'Details');
    final add = find.widgetWithText(TextButton, 'Add specification');
    await tester.ensureVisible(add);
    await tester.pumpAndSettle();
    await tester.tap(add);
    await tester.pumpAndSettle();
    final sheet = find.ancestor(
      of: find.text('Add Specification'),
      matching: find.byType(LetbuyyFormSheet),
    );
    final fields = find.descendant(of: sheet, matching: find.byType(TextField));
    expect(fields, findsNWidgets(2));
    await tester.enterText(fields.at(0), 'Material');
    await tester.enterText(fields.at(1), 'Cotton');
    await tester.tap(
      find.descendant(
        of: sheet,
        matching: find.widgetWithText(FilledButton, 'Add'),
      ),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(FilledButton, 'Update'));
    await tester.pumpAndSettle();
    expect(api.calls, hasLength(1));
    expect(api.current['metadata'], {
      'unmanaged': 17,
      'specifications': {'Size': 42, 'Material': 'Cotton'},
    });
  });
}
