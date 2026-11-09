import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:letbuyy_store/theme/store_theme.dart';

const items = [
  CustomBottomNavItem(
    icon: Icons.home_outlined,
    activeIcon: Icons.home,
    label: 'Home',
  ),
  CustomBottomNavItem(
    icon: Icons.shopping_bag_outlined,
    activeIcon: Icons.shopping_bag,
    label: 'Orders',
  ),
  CustomBottomNavItem(
    icon: Icons.sell_outlined,
    activeIcon: Icons.sell,
    label: 'Products',
  ),
  CustomBottomNavItem(
    icon: Icons.people_outline,
    activeIcon: Icons.people,
    label: 'Customers',
  ),
  CustomBottomNavItem(icon: Icons.menu, activeIcon: Icons.menu, label: 'More'),
];

void main() {
  setUpAll(initializeLetbuyyTypography);
  for (final dark in [false, true]) {
    testWidgets(
      'native navigation keeps labels, selection and minimum targets at scale2.4 in ${dark ? 'dark' : 'light'}',
      (tester) async {
        tester.view.physicalSize = const Size(320, 600);
        tester.view.devicePixelRatio = 1;
        addTearDown(tester.view.resetPhysicalSize);
        addTearDown(tester.view.resetDevicePixelRatio);
        var index = 0;
        late StateSetter update;
        await tester.pumpWidget(
          MaterialApp(
            theme: dark ? StoreTheme.dark() : StoreTheme.light(),
            builder: (context, child) => MediaQuery(
              data: MediaQuery.of(context).copyWith(
                textScaler: TextScaler.linear(2.4),
                disableAnimations: true,
              ),
              child: child!,
            ),
            home: StatefulBuilder(
              builder: (_, set) {
                update = set;
                return Scaffold(
                  body: const Text('Current destination'),
                  bottomNavigationBar: CustomBottomNav(
                    currentIndex: index,
                    onTap: (i) => set(() => index = i),
                    items: items,
                  ),
                );
              },
            ),
          ),
        );
        await tester.pumpAndSettle();
        expect(find.byType(BackdropFilter), findsNothing);
        for (final item in items) expect(find.text(item.label), findsOneWidget);
        for (final button in find.byType(TextButton).evaluate()) {
          final box = tester.getRect(find.byWidget(button.widget));
          expect(box.width, greaterThanOrEqualTo(48));
          expect(box.height, greaterThanOrEqualTo(48));
        }
        update(() => index = 4);
        await tester.pumpAndSettle();
        final last = find.widgetWithText(TextButton, 'More');
        expect(tester.getRect(last).left, greaterThanOrEqualTo(0));
        expect(tester.getRect(last).right, lessThanOrEqualTo(320));
        await tester.tap(last);
        await tester.pumpAndSettle();
        expect(index, 4);
        final label = tester.widget<Semantics>(
          find.byWidgetPredicate(
            (w) => w is Semantics && w.properties.label == 'More tab',
          ),
        );
        expect(label.properties.selected, isTrue);
        expect(tester.takeException(), isNull);
      },
    );
  }

  for (final dark in [false, true]) {
    testWidgets(
      'all five normal-size labels and targets fit360dp in ${dark ? 'dark' : 'light'}',
      (tester) async {
        tester.view.physicalSize = const Size(360, 800);
        tester.view.devicePixelRatio = 1;
        addTearDown(tester.view.resetPhysicalSize);
        addTearDown(tester.view.resetDevicePixelRatio);
        var index = 0;
        late StateSetter update;
        await tester.pumpWidget(
          MaterialApp(
            theme: dark ? StoreTheme.dark() : StoreTheme.light(),
            home: StatefulBuilder(
              builder: (_, set) {
                update = set;
                return Scaffold(
                  bottomNavigationBar: CustomBottomNav(
                    currentIndex: index,
                    onTap: (i) => set(() => index = i),
                    items: items,
                  ),
                );
              },
            ),
          ),
        );
        for (final selected in [0, 4]) {
          update(() => index = selected);
          await tester.pumpAndSettle();
          for (final item in items) {
            final box = tester.getRect(
              find.widgetWithText(TextButton, item.label),
            );
            expect(
              box.left,
              greaterThanOrEqualTo(0),
              reason: '${item.label} must not be clipped',
            );
            expect(
              box.right,
              lessThanOrEqualTo(360),
              reason: '${item.label} must not require normal-width scrolling',
            );
          }
        }
        expect(tester.takeException(), isNull);
      },
    );
  }

  testWidgets('native destination buttons support keyboard activation once', (
    tester,
  ) async {
    final selections = <int>[];
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          bottomNavigationBar: CustomBottomNav(
            currentIndex: 0,
            onTap: selections.add,
            items: items,
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    await tester.sendKeyEvent(LogicalKeyboardKey.tab);
    await tester.sendKeyEvent(LogicalKeyboardKey.enter);
    await tester.pumpAndSettle();
    expect(selections, [0]);
  });

  testWidgets(
    'blocking progress retires underlying action input focus and semantics, then restores it',
    (tester) async {
      final semantics = tester.ensureSemantics(), focus = FocusNode();
      var loading = false, taps = 0;
      late StateSetter update;
      try {
        await tester.pumpWidget(
          MaterialApp(
            theme: StoreTheme.dark(),
            builder: (context, child) => MediaQuery(
              data: MediaQuery.of(context).copyWith(disableAnimations: true),
              child: child!,
            ),
            home: StatefulBuilder(
              builder: (_, set) {
                update = set;
                return LoadingOverlay(
                  isLoading: loading,
                  loadingText: 'Loading product records',
                  child: Scaffold(
                    body: TextButton(
                      focusNode: focus,
                      onPressed: () => taps++,
                      child: const Text('Private prior action'),
                    ),
                  ),
                );
              },
            ),
          ),
        );
        await tester.pumpAndSettle();
        focus.requestFocus();
        await tester.pump();
        expect(focus.hasFocus, isTrue);
        expect(find.semantics.byLabel('Private prior action'), findsOneWidget);
        update(() => loading = true);
        await tester.pumpAndSettle();
        expect(focus.hasFocus, isFalse);
        expect(find.semantics.byLabel('Private prior action'), findsNothing);
        expect(
          find.semantics.byLabel('Loading product records'),
          findsOneWidget,
        );
        expect(find.byType(CircularProgressIndicator), findsNothing);
        await tester.tap(
          find.text('Private prior action'),
          warnIfMissed: false,
        );
        expect(taps, 0);
        update(() => loading = false);
        await tester.pumpAndSettle();
        await tester.tap(find.text('Private prior action'));
        expect(taps, 1);
        expect(find.semantics.byLabel('Private prior action'), findsOneWidget);
        expect(tester.takeException(), isNull);
      } finally {
        await tester.pumpWidget(const SizedBox.shrink());
        focus.dispose();
        semantics.dispose();
      }
    },
  );
  testWidgets(
    'focused canonical search field exposes its persistent label with hint and clear action',
    (tester) async {
      final semantics = tester.ensureSemantics();
      try {
        await tester.pumpWidget(
          MaterialApp(
            theme: StoreTheme.dark(),
            home: Builder(
              builder: (context) => Scaffold(
                body: TextButton(
                  onPressed: () => showLetbuyyFormSheet<void>(
                    context: context,
                    builder: (_) => LetbuyyFormSheet(
                      title: 'Search store',
                      child: CustomTextField(
                        label: 'Search orders and products',
                        maxLength: 200,
                        hint: 'Type at least 2 characters',
                        autofocus: true,
                        prefixIcon: Icons.search,
                        suffixIcon: IconButton(
                          tooltip: 'Clear search',
                          onPressed: () {},
                          icon: const Icon(Icons.clear),
                        ),
                      ),
                    ),
                  ),
                  child: const Text('Open search'),
                ),
              ),
            ),
          ),
        );
        await tester.tap(find.text('Open search'));
        await tester.pumpAndSettle();
        final data = tester
            .getSemantics(find.byType(EditableText))
            .getSemanticsData();
        expect(
          '${data.label} ${data.hint}',
          contains('Search orders and products'),
        );
        final clear = tester
            .getSemantics(find.widgetWithIcon(IconButton, Icons.clear))
            .getSemanticsData();
        expect(clear.tooltip, 'Clear search');
        expect(tester.takeException(), isNull);
      } finally {
        await tester.pumpWidget(const SizedBox.shrink());
        semantics.dispose();
      }
    },
  );
}
