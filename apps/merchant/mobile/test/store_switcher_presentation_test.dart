// Real StoreContext/selection queue; controlled membership reads and preference I/O.
import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:letbuyy_store/app/store_context.dart';
import 'package:letbuyy_store/models/store_model.dart';
import 'package:letbuyy_store/services/api_client.dart';
import 'package:letbuyy_store/services/store_service.dart';
import 'package:letbuyy_store/theme/store_theme.dart';
import 'package:letbuyy_store/widgets/store/store_switcher_button.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';

const a = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const b = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const alpha = 'Synthetic Alpha store';
const beta = 'Synthetic Beta store';
const longName = 'Long தமிழ்க் கடை – exact authorised store name and reference';
Map<String, dynamic> row(String id, {String? name}) => {
  'id': id,
  'name': name ?? (id == a ? alpha : beta),
  'site_type': 'store',
  'subdomain': id == a ? 'synthetic-alpha' : 'synthetic-beta',
};

class Preferences extends Fake implements SharedPreferences {
  final values = <String, String>{};
  final writes = <String>[];
  Completer<bool>? held;
  String? failure;
  @override
  String? getString(String key) => values[key];
  @override
  Future<bool> setString(String key, String value) async {
    writes.add(value);
    if (value == b) {
      if (failure == 'throw') throw StateError('Private device diagnostic');
      if (failure == 'false') return false;
      final pending = held;
      if (pending != null && !await pending.future) return false;
    }
    values[key] = value;
    return true;
  }

  @override
  Future<bool> remove(String key) async {
    values.remove(key);
    return true;
  }
}

class Memberships extends StoreService {
  Memberships(ApiClient api) : super(api: api);
  List<Map<String, dynamic>> rows = [row(a), row(b)];
  int reads = 0;
  Object? failure;
  Completer<void>? hold;
  @override
  Future<List<StoreModel>> fetchStores() async {
    reads++;
    if (failure case final Object error) throw error;
    final result = rows.map(StoreModel.fromJson).toList();
    await hold?.future;
    return result;
  }
}

class Harness {
  final prefs = Preferences(), nav = GlobalKey<NavigatorState>();
  late ApiClient api;
  late Memberships service;
  late StoreContext stores;
  int changed = 0;
  Future<void> mount(
    WidgetTester tester, {
    bool one = false,
    bool dark = false,
    Size size = const Size(390, 844),
    double scale = 1,
    bool long = false,
  }) async {
    tester.view.physicalSize = size;
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    api = ApiClient(baseUrl: 'https://gateway.test/v1', maxRetries: 0);
    service = Memberships(api)
      ..rows = [
        row(a, name: long ? longName : null),
        if (!one) row(b, name: long ? '$longName B' : null),
      ];
    stores = StoreContext(
      storeService: service,
      prefs: prefs,
      environment: 'local',
    );
    await stores.bindActor('synthetic-owner-a');
    await stores.ensureSelectedStore();
    addTearDown(() {
      if (prefs.held case final Completer<bool> held when !held.isCompleted)
        held.complete(false);
    });
    addTearDown(api.close);
    addTearDown(stores.dispose);
    addTearDown(service.dispose);
    await tester.pumpWidget(
      ChangeNotifierProvider.value(
        value: stores,
        child: MaterialApp(
          navigatorKey: nav,
          theme: dark ? StoreTheme.dark() : StoreTheme.light(),
          builder: (context, child) => MediaQuery(
            data: MediaQuery.of(
              context,
            ).copyWith(textScaler: TextScaler.linear(scale)),
            child: child!,
          ),
          home: Scaffold(
            body: Align(
              alignment: Alignment.topCenter,
              child: StoreSwitcherButton(onChanged: () => changed++),
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
  }

  Future<void> open(WidgetTester tester) async {
    await tester.tap(
      find.descendant(
        of: find.byType(StoreSwitcherButton),
        matching: find.byWidgetPredicate(
          (widget) => widget is ButtonStyleButton,
        ),
      ),
    );
    await tester.pumpAndSettle();
  }

  Future<void> cover(WidgetTester tester) async {
    nav.currentState!.push(
      MaterialPageRoute<void>(
        builder: (_) => const Scaffold(body: Text('Cover')),
      ),
    );
    await tester.pumpAndSettle();
  }
}

Finder button(String label) => find.byWidgetPredicate(
  (w) =>
      w is ButtonStyleButton &&
      find
          .descendant(of: find.byWidget(w), matching: find.text(label))
          .evaluate()
          .isNotEmpty,
);
Finder choice(String label) =>
    find.ancestor(of: find.text(label), matching: find.byType(ListTile));

void main() {
  WidgetController.hitTestWarningShouldBeFatal = true;
  setUpAll(initializeLetbuyyTypography);
  testWidgets(
    'one semantic action owns the complete store name and native input',
    (tester) async {
      final semantics = tester.ensureSemantics();
      try {
        final h = Harness();
        await h.mount(tester);
        final trigger = find.bySemanticsLabel(
          RegExp('Selected store switcher'),
        );
        expect(trigger, findsOneWidget);
        final node = tester.getSemantics(trigger);
        final data = node.getSemanticsData();
        expect('${data.label} ${data.value}', contains(alpha));
        expect(node.getSemanticsData().hasAction(SemanticsAction.tap), isTrue);
        expect(node.getSemanticsData().hasFlag(SemanticsFlag.isButton), isTrue);
        tester.binding.pipelineOwner.semanticsOwner!.performAction(
          node.id,
          SemanticsAction.tap,
        );
        await tester.pumpAndSettle();
        expect(find.byType(BottomSheet), findsOneWidget);
        h.prefs.held = Completer<bool>();
        await tester.tap(choice(beta));
        await tester.pump(const Duration(milliseconds: 400));
        final saving = tester
            .getSemantics(
              find.bySemanticsLabel(RegExp('Selected store switcher')),
            )
            .getSemanticsData();
        expect(saving.hasAction(SemanticsAction.tap), isFalse);
        expect(saving.hasFlag(SemanticsFlag.isEnabled), isFalse);
        h.prefs.held!.complete(true);
        await tester.pumpAndSettle();
        expect(h.changed, 1);
        expect(tester.takeException(), isNull);
      } finally {
        semantics.dispose();
      }
    },
  );
  testWidgets(
    'selection waits for owned persistence and restores the selected membership',
    (tester) async {
      final h = Harness();
      await h.mount(tester);
      await h.open(tester);
      expect(find.text('Switching store…'), findsNothing);
      h.prefs.held = Completer<bool>();
      await tester.tap(choice(beta));
      await tester.pump(const Duration(milliseconds: 400));
      expect(h.stores.selectedStoreId, b);
      expect(h.changed, 0);
      expect(h.prefs.values.values, [a]);
      h.prefs.held!.complete(true);
      await tester.pumpAndSettle();
      expect(h.changed, 1);
      expect(h.prefs.values.values, [b]);
      final restarted = StoreContext(
        storeService: h.service,
        prefs: h.prefs,
        environment: 'local',
      );
      addTearDown(restarted.dispose);
      await restarted.bindActor('synthetic-owner-a');
      await restarted.ensureSelectedStore();
      expect(restarted.selectedStoreId, b);
      expect(tester.takeException(), isNull);
    },
  );
  for (final disposed in [false, true]) {
    testWidgets('retired selector opening is inert disposed=$disposed', (
      tester,
    ) async {
      final h = Harness();
      await h.mount(tester);
      final old = tester
          .widget<ButtonStyleButton>(
            find.descendant(
              of: find.byType(StoreSwitcherButton),
              matching: find.byWidgetPredicate(
                (widget) => widget is ButtonStyleButton,
              ),
            ),
          )
          .onPressed!;
      if (disposed) {
        await tester.pumpWidget(const MaterialApp(home: Text('New owner')));
      } else {
        await h.cover(tester);
      }
      old();
      await tester.pumpAndSettle();
      expect(find.byType(BottomSheet), findsNothing);
      expect(h.changed, 0);
      expect(h.service.reads, 1);
      expect(tester.takeException(), isNull);
    });
  }
  testWidgets('duplicate selector callback opens only one sheet', (
    tester,
  ) async {
    final h = Harness();
    await h.mount(tester);
    final old = tester
        .widget<ButtonStyleButton>(
          find.descendant(
            of: find.byType(StoreSwitcherButton),
            matching: find.byWidgetPredicate(
              (widget) => widget is ButtonStyleButton,
            ),
          ),
        )
        .onPressed!;
    old();
    old();
    await tester.pumpAndSettle();
    expect(find.byType(BottomSheet), findsOneWidget);
  });
  for (final change in ['cover', 'dispose', 'actor', 'store', 'list']) {
    testWidgets('old selector choice is inert after $change', (tester) async {
      final h = Harness();
      await h.mount(tester);
      await h.open(tester);
      final old = tester.widget<ListTile>(choice(beta)).onTap!;
      if (change == 'cover') {
        await h.cover(tester);
      }
      if (change == 'dispose') {
        await tester.pumpWidget(const MaterialApp(home: Text('New owner')));
      }
      if (change == 'actor') {
        await h.stores.bindActor('synthetic-owner-b');
        await tester.pumpAndSettle();
      }
      if (change == 'store') {
        await h.stores.selectStoreById(b);
        await tester.pumpAndSettle();
      }
      if (change == 'list') {
        await h.stores.loadStores(force: true);
        await tester.pumpAndSettle();
      }
      final before = h.stores.requestContextKey, writes = h.prefs.writes.length;
      old();
      await tester.pumpAndSettle();
      expect(h.stores.requestContextKey, before);
      expect(h.prefs.writes.length, writes);
      expect(h.changed, 0);
      expect(tester.takeException(), isNull);
      if (change == 'cover') expect(find.text('Cover'), findsOneWidget);
      if (change == 'actor') expect(find.text(beta), findsNothing);
    });
  }
  for (final change in ['cover', 'dispose', 'actor', 'store_aba']) {
    testWidgets(
      'late preference completion cannot notify a retired consumer after $change',
      (tester) async {
        final h = Harness();
        await h.mount(tester);
        await h.open(tester);
        h.prefs.held = Completer<bool>();
        await tester.tap(choice(beta));
        await tester.pump(const Duration(milliseconds: 400));
        expect(h.stores.selectedStoreId, b);
        expect(h.changed, 0);
        Future<void>? retirement;
        if (change == 'cover') await h.cover(tester);
        if (change == 'dispose')
          await tester.pumpWidget(const MaterialApp(home: Text('New owner')));
        if (change == 'actor')
          retirement = h.stores.bindActor('synthetic-owner-b');
        if (change == 'store_aba') {
          final first = h.stores.selectStoreById(a),
              second = h.stores.selectStoreById(b);
          retirement = Future.wait([first, second]).then((_) {});
        }
        h.prefs.held!.complete(true);
        await retirement;
        await tester.pumpAndSettle();
        expect(h.changed, 0);
        expect(tester.takeException(), isNull);
      },
    );
  }
  for (final mode in ['false', 'throw']) {
    testWidgets(
      'unconfirmed preference $mode remains a visible failure and can retry',
      (tester) async {
        final h = Harness();
        await h.mount(tester);
        await h.open(tester);
        h.prefs.failure = mode;
        await tester.tap(choice(beta));
        await tester.pumpAndSettle();
        expect(h.changed, 0);
        expect(h.prefs.values.values, [a]);
        expect(find.textContaining('Could not save'), findsOneWidget);
        expect(find.textContaining('Private device diagnostic'), findsNothing);
        expect(tester.takeException(), isNull);
        h.prefs.failure = null;
        await h.open(tester);
        await tester.tap(choice(beta));
        await tester.pumpAndSettle();
        expect(h.changed, 1);
        expect(h.prefs.values.values, [b]);
      },
    );
  }
  testWidgets(
    'one-store discovery opens the refreshed choices in the same selector',
    (tester) async {
      final h = Harness();
      await h.mount(tester, one: true);
      h.service.rows = [row(a), row(b)];
      await h.open(tester);
      expect(h.service.reads, 2);
      expect(choice(beta), findsOneWidget);
      await tester.tap(choice(beta));
      await tester.pumpAndSettle();
      expect(h.stores.selectedStoreId, b);
      expect(h.changed, 1);
    },
  );
  testWidgets('discovery error has sanitized retry in its current sheet', (
    tester,
  ) async {
    final h = Harness();
    await h.mount(tester, one: true);
    h.service.failure = StateError('Private membership diagnostic');
    await h.open(tester);
    expect(find.textContaining('Could not load'), findsOneWidget);
    expect(find.textContaining('Private membership diagnostic'), findsNothing);
    expect(tester.takeException(), isNull);
    h.service.failure = null;
    h.service.rows = [row(a), row(b)];
    await tester.tap(button('Refresh stores'));
    await tester.pumpAndSettle();
    expect(choice(beta), findsOneWidget);
  });
  for (final dark in [false, true]) {
    testWidgets(
      'long store identities and Close remain readable at320dp scale2.4 dark=$dark',
      (tester) async {
        final h = Harness();
        await h.mount(
          tester,
          dark: dark,
          size: const Size(320, 620),
          scale: 2.4,
          long: true,
        );
        await h.open(tester);
        expect(find.byTooltip('Close'), findsOneWidget);
        for (final e
            in find
                .descendant(
                  of: find.byType(BottomSheet),
                  matching: find.byType(Text),
                )
                .evaluate()) {
          if (e.renderObject case final RenderParagraph p)
            expect(p.didExceedMaxLines, isFalse);
        }
        expect(tester.takeException(), isNull);
        await tester.tap(find.byTooltip('Close'));
        await tester.pumpAndSettle();
        expect(h.changed, 0);
      },
    );
  }
}
