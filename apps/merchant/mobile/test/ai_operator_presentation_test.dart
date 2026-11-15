// Presentation/transport doubles only; these do not certify provider effects.
import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:letbuyy_store/app/store_context.dart';
import 'package:letbuyy_store/models/store_model.dart';
import 'package:letbuyy_store/services/ai_studio_service.dart';
import 'package:letbuyy_store/services/api_client.dart';
import 'package:letbuyy_store/theme/store_theme.dart';
import 'package:letbuyy_store/widgets/shared/ai_operator_sheet.dart';
import 'staff_scope_boundary_test.dart' as fixture;

class HeldOperator extends AiStudioService {
  HeldOperator(ApiClient api) : super(api: api);
  final pending = Completer<AiOperatorResult>();
  final calls = <({String storeId, String message})>[];
  @override
  Future<AiOperatorResult> runOperatorCommand({
    required String storeId,
    required String message,
  }) {
    calls.add((storeId: storeId, message: message));
    return pending.future;
  }
}

class HeldStoreContext extends StoreContext {
  HeldStoreContext(ApiClient api)
    : super(storeService: fixture.FixedStores(api));
  bool hold = false;
  final release = Completer<void>();
  @override
  Future<StoreModel?> ensureSelectedStore({bool force = false}) async {
    if (hold) await release.future;
    return super.ensureSelectedStore(force: force);
  }
}

Future<void> mountOperator(
  WidgetTester tester,
  StoreContext stores,
  HeldOperator operator, {
  bool dark = false,
  double scale = 1,
}) async {
  await tester.pumpWidget(
    MultiProvider(
      providers: [
        ChangeNotifierProvider<StoreContext>.value(value: stores),
        ChangeNotifierProvider<AiStudioService>.value(value: operator),
      ],
      child: MaterialApp(
        theme: dark ? StoreTheme.dark() : StoreTheme.light(),
        builder: (context, child) => MediaQuery(
          data: MediaQuery.of(context).copyWith(
            textScaler: TextScaler.linear(scale),
            disableAnimations: true,
          ),
          child: child!,
        ),
        home: Scaffold(
          body: Builder(
            builder: (context) => TextButton(
              onPressed: () => showAiOperatorSheet(context),
              child: const Text('Open operator'),
            ),
          ),
        ),
      ),
    ),
  );
  await tester.tap(find.text('Open operator'));
  await tester.pumpAndSettle();
}

void main() {
  setUpAll(initializeLetbuyyTypography);
  setUp(() => SharedPreferences.setMockInitialValues({}));
  testWidgets(
    'operator suggestions edit only the draft and reveal the keyboard command action',
    (tester) async {
      tester.view.physicalSize = const Size(360, 800);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      addTearDown(tester.view.resetViewInsets);
      final api = ApiClient(baseUrl: 'https://gateway.test/v1', maxRetries: 0);
      final stores = StoreContext(storeService: fixture.FixedStores(api));
      final operator = HeldOperator(api);
      await stores.ensureSelectedStore();
      try {
        await mountOperator(tester, stores, operator);
        expect(find.byType(ActionChip), findsNothing);
        await tester.tap(find.text('Suggested commands'));
        await tester.pumpAndSettle();
        expect(find.byType(ActionChip), findsNWidgets(4));
        await tester.tap(find.widgetWithText(ActionChip, 'Sales this week'));
        await tester.pumpAndSettle();
        expect(find.byType(ActionChip), findsNothing);
        final field = tester.widget<EditableText>(find.byType(EditableText));
        expect(field.controller.text, 'Sales this week');
        expect(
          field.controller.selection,
          const TextSelection.collapsed(offset: 15),
        );
        expect(field.focusNode.hasFocus, isTrue);
        expect(operator.calls, isEmpty);
        tester.view.viewInsets = const FakeViewPadding(bottom: 300);
        await tester.pumpAndSettle();
        expect(find.text('Run command').hitTestable(), findsOneWidget);
        expect(tester.takeException(), isNull);
      } finally {
        await tester.pumpWidget(const SizedBox.shrink());
        operator.dispose();
        stores.dispose();
        api.close();
      }
    },
  );
  testWidgets('operator retires a late private result after store changes', (
    tester,
  ) async {
    final api = ApiClient(baseUrl: 'https://gateway.test/v1', maxRetries: 0);
    final stores = StoreContext(storeService: fixture.FixedStores(api));
    final operator = HeldOperator(api);
    await stores.bindActor('owner-a');
    await stores.ensureSelectedStore();
    try {
      await tester.pumpWidget(
        MultiProvider(
          providers: [
            ChangeNotifierProvider<StoreContext>.value(value: stores),
            ChangeNotifierProvider<AiStudioService>.value(value: operator),
          ],
          child: MaterialApp(
            theme: StoreTheme.light(),
            home: Scaffold(
              body: Builder(
                builder: (context) => TextButton(
                  onPressed: () => showAiOperatorSheet(context),
                  child: const Text('Open operator'),
                ),
              ),
            ),
          ),
        ),
      );
      await tester.tap(find.text('Open operator'));
      await tester.pumpAndSettle();
      await tester.enterText(find.byType(EditableText), 'Sales this week');
      await tester.testTextInput.receiveAction(TextInputAction.send);
      await tester.pump();
      expect(operator.calls, [
        (storeId: fixture.siteA, message: 'Sales this week'),
      ]);
      expect(
        tester
            .widget<FilledButton>(find.widgetWithText(FilledButton, 'Running…'))
            .onPressed,
        isNull,
      );
      tester.widget<CustomTextField>(find.byType(CustomTextField)).onSubmitted!(
        'Sales this week',
      );
      await tester.pump();
      expect(operator.calls, hasLength(1));
      await Navigator.maybePop(tester.element(find.byType(AiOperatorSheet)));
      await tester.pump();
      expect(find.byType(AiOperatorSheet), findsOneWidget);
      await stores.selectStoreById(fixture.siteB);
      await tester.pump();
      operator.pending.complete(
        const AiOperatorResult(
          storeId: fixture.siteA,
          conversationId: 'synthetic',
          message: 'Private result for previous store',
          toolCalls: [],
          createdAt: '2026-11-04T00:00:00Z',
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('Private result for previous store'), findsNothing);
      expect(find.textContaining('Store access changed'), findsOneWidget);
      expect(find.byType(EditableText), findsNothing);
      expect(operator.calls, hasLength(1));
      expect(tester.takeException(), isNull);
    } finally {
      await tester.pumpWidget(const SizedBox.shrink());
      operator.dispose();
      stores.dispose();
      api.close();
    }
  });

  testWidgets(
    'operator cannot adopt a new store while waiting to resolve the original selection',
    (tester) async {
      final api = ApiClient(baseUrl: 'https://gateway.test/v1', maxRetries: 0);
      final stores = HeldStoreContext(api);
      final operator = HeldOperator(api);
      await stores.ensureSelectedStore();
      try {
        await mountOperator(tester, stores, operator);
        stores.hold = true;
        await tester.enterText(find.byType(EditableText), 'Sales this week');
        await tester.testTextInput.receiveAction(TextInputAction.send);
        await tester.pump();
        expect(operator.calls, isEmpty);
        await stores.selectStoreById(fixture.siteB);
        stores.release.complete();
        await tester.pumpAndSettle();
        expect(operator.calls, isEmpty);
        expect(find.text('Store access changed'), findsOneWidget);
        expect(tester.takeException(), isNull);
      } finally {
        if (!stores.release.isCompleted) stores.release.complete();
        await tester.pumpWidget(const SizedBox.shrink());
        operator.dispose();
        stores.dispose();
        api.close();
      }
    },
  );

  for (final dark in [false, true]) {
    testWidgets(
      'operator retains failed draft and reflows with keyboard at scale2.4 in ${dark ? 'dark' : 'light'}',
      (tester) async {
        tester.view.physicalSize = const Size(320, 640);
        tester.view.devicePixelRatio = 1;
        addTearDown(tester.view.resetPhysicalSize);
        addTearDown(tester.view.resetDevicePixelRatio);
        addTearDown(tester.view.resetViewInsets);
        final api = ApiClient(
          baseUrl: 'https://gateway.test/v1',
          maxRetries: 0,
        );
        final stores = StoreContext(storeService: fixture.FixedStores(api));
        final operator = HeldOperator(api);
        await stores.ensureSelectedStore();
        try {
          await mountOperator(tester, stores, operator, dark: dark, scale: 2.4);
          expect(operator.calls, isEmpty);
          expect(tester.takeException(), isNull);
          final field = find.byType(EditableText);
          await tester.ensureVisible(field);
          await tester.enterText(field, '   Sales this week   ');
          tester.view.viewInsets = const FakeViewPadding(bottom: 280);
          await tester.pumpAndSettle();
          await tester.ensureVisible(find.text('Run command'));
          await tester.pumpAndSettle();
          expect(find.text('Run command').hitTestable(), findsOneWidget);
          await tester.tap(find.text('Run command'));
          await tester.pump();
          expect(operator.calls, [
            (storeId: fixture.siteA, message: 'Sales this week'),
          ]);
          operator.pending.completeError(
            const AiOperatorUnavailableException(),
          );
          await tester.pumpAndSettle();
          expect(
            tester.widget<EditableText>(field).controller.text,
            '   Sales this week   ',
          );
          expect(
            find.text(AiOperatorUnavailableException.message),
            findsOneWidget,
          );
          expect(find.text('completed'), findsNothing);
          expect(operator.calls, hasLength(1));
          expect(tester.takeException(), isNull);
        } finally {
          await tester.pumpWidget(const SizedBox.shrink());
          operator.dispose();
          stores.dispose();
          api.close();
        }
      },
    );
  }
}
