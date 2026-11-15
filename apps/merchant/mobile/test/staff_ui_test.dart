// Composed widget/transport fixtures, not hosted membership or delivery proof.
import 'dart:async';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:letbuyy_store/app/store_context.dart';
import 'package:letbuyy_store/screens/settings/staff_screen.dart';
import 'package:letbuyy_store/services/api_client.dart';
import 'package:letbuyy_store/services/staff_service.dart';
import 'package:letbuyy_store/theme/store_theme.dart';
import 'staff_scope_boundary_test.dart' as fixture;

class StaffHarness {
  StaffHarness(
    void Function(RequestOptions, RequestInterceptorHandler) handle,
  ) {
    api = ApiClient(
      baseUrl: 'https://gateway.test/v1',
      dio: dio,
      maxRetries: 0,
      contextVersionProvider: () => stores.requestContextKey,
      storeIdProvider: () => stores.selectedStoreId,
    );
    stores = StoreContext(
      storeService: fixture.FixedStores(api),
      environment: 'local',
    );
    staff = StaffService(api: api, environment: 'local');
    dio.interceptors.add(InterceptorsWrapper(onRequest: handle));
  }
  final dio = Dio();
  late final ApiClient api;
  late final StoreContext stores;
  late final StaffService staff;
  Future<void> mount(
    WidgetTester tester, {
    bool dark = false,
    double scale = 1,
  }) async {
    await stores.ensureSelectedStore();
    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ChangeNotifierProvider<StoreContext>.value(value: stores),
          ChangeNotifierProvider<StaffService>.value(value: staff),
        ],
        child: MaterialApp(
          theme: dark ? StoreTheme.dark() : StoreTheme.light(),
          builder: (context, child) => MediaQuery(
            data: MediaQuery.of(
              context,
            ).copyWith(textScaler: TextScaler.linear(scale)),
            child: child!,
          ),
          home: const StaffScreen(),
        ),
      ),
    );
    await tester.pumpAndSettle();
  }

  Future<void> close(WidgetTester tester) async {
    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pumpAndSettle();
    staff.dispose();
    stores.dispose();
    api.close();
  }
}

void reject(RequestOptions r, RequestInterceptorHandler h, int status) =>
    h.reject(
      DioException(
        requestOptions: r,
        response: Response(
          requestOptions: r,
          statusCode: status,
          data: {
            'error': {
              'code': 'SYNTHETIC_FAILURE',
              'message': 'private database diagnostic must never appear',
            },
          },
        ),
        type: DioExceptionType.badResponse,
      ),
    );

void main() {
  setUpAll(initializeLetbuyyTypography);
  setUp(() {
    FlutterSecureStorage.setMockInitialValues({});
    SharedPreferences.setMockInitialValues({});
  });
  testWidgets(
    'invitation keeps failed draft and reuses exact command before fresh roster readback',
    (tester) async {
      final commands = <RequestOptions>[];
      var invited = false;
      final harness = StaffHarness((r, h) {
        if (r.method == 'GET') {
          fixture.respond(r, h, [
            {
              ...fixture.member(fixture.siteA),
              if (invited) 'status': 'invited',
            },
          ]);
        } else {
          commands.add(r);
          if (commands.length == 1) {
            reject(r, h, 503);
            return;
          }
          invited = true;
          fixture.respond(r, h, {
            ...fixture.member(fixture.siteA),
            'status': 'invited',
            'invitation': {
              'accept_url':
                  'https://merchant.example.invalid/accept-invite?token=synthetic',
              'expires_at': '2026-11-05T00:00:00Z',
            },
          });
        }
      });
      try {
        await harness.mount(tester);
        await tester.tap(find.widgetWithText(FilledButton, 'Add staff'));
        await tester.pumpAndSettle();
        await tester.tap(find.text('Send staff invitation'));
        await tester.pumpAndSettle();
        expect(find.text('Enter an email address.'), findsOneWidget);
        expect(commands, isEmpty);
        await tester.enterText(
          find.byType(TextFormField).first,
          'invitee@example.invalid',
        );
        await tester.pumpAndSettle();
        expect(
          find.text('Enter an email address.'),
          findsNothing,
          reason:
              'A corrected valid draft must retire its stale required error',
        );
        await tester.ensureVisible(find.text('Send staff invitation'));
        await tester.tap(find.text('Send staff invitation'));
        await tester.pumpAndSettle();
        expect(find.text('Retry same request'), findsOneWidget);
        expect(
          find.textContaining('private database diagnostic'),
          findsNothing,
        );
        expect(
          tester
              .widget<TextFormField>(find.byType(TextFormField).first)
              .controller!
              .text,
          'invitee@example.invalid',
        );
        expect(
          tester
              .widget<TextFormField>(find.byType(TextFormField).first)
              .enabled,
          isFalse,
        );
        await tester.ensureVisible(find.text('Retry same request'));
        await tester.tap(find.text('Retry same request'));
        await tester.pumpAndSettle();
        expect(commands, hasLength(2));
        expect(commands[1].data, commands[0].data);
        expect(
          commands[1].headers['X-Idempotency-Key'],
          commands[0].headers['X-Idempotency-Key'],
        );
        expect(commands[0].headers['X-Idempotency-Key'], isNotEmpty);
        expect(find.text('Staff invitation created'), findsOneWidget);
        expect(
          find.textContaining('does not confirm email delivery'),
          findsOneWidget,
        );
        await tester.tap(find.text('Done'));
        await tester.pumpAndSettle();
        expect(find.text('Invited'), findsOneWidget);
        expect(find.text('1 loaded staff records'), findsOneWidget);
        expect(tester.takeException(), isNull);
      } finally {
        await harness.close(tester);
      }
    },
  );
  testWidgets(
    'open invitation draft and remove confirmation retire when store changes',
    (tester) async {
      final mutations = <RequestOptions>[];
      final harness = StaffHarness((r, h) {
        if (r.method != 'GET') mutations.add(r);
        fixture.respond(r, h, [
          fixture.member(r.queryParameters['store_id'] as String),
        ]);
      });
      try {
        await harness.mount(tester);
        await tester.tap(find.widgetWithText(FilledButton, 'Add staff'));
        await tester.pumpAndSettle();
        await tester.enterText(
          find.byType(TextFormField).first,
          'private-draft@example.invalid',
        );
        await harness.stores.selectStoreById(fixture.siteB);
        await tester.pump();
        expect(find.text('private-draft@example.invalid'), findsNothing);
        expect(find.text('Send staff invitation'), findsNothing);
        expect(find.text('Store access changed'), findsOneWidget);
        await tester.tap(find.text('Close'));
        await tester.pumpAndSettle();
        expect(find.text('Private staff B'), findsOneWidget);
        await tester.ensureVisible(find.text('Remove'));
        await tester.tap(find.text('Remove'));
        await tester.pumpAndSettle();
        expect(find.text('Remove staff'), findsOneWidget);
        await harness.stores.selectStoreById(fixture.siteA);
        await tester.pump();
        expect(find.text('Remove staff'), findsNothing);
        expect(find.text('Store access changed'), findsOneWidget);
        expect(mutations, isEmpty);
      } finally {
        await harness.close(tester);
      }
    },
  );
  testWidgets('denied roster has safe retry and disables invitations', (
    tester,
  ) async {
    final harness = StaffHarness((r, h) => reject(r, h, 403));
    try {
      await harness.mount(tester);
      expect(find.textContaining('current store permissions'), findsOneWidget);
      expect(find.textContaining('private database diagnostic'), findsNothing);
      expect(
        tester
            .widget<FilledButton>(
              find.widgetWithText(FilledButton, 'Add staff'),
            )
            .onPressed,
        isNull,
      );
      expect(find.text('Try Again'), findsOneWidget);
      expect(tester.takeException(), isNull);
    } finally {
      await harness.close(tester);
    }
  });
  testWidgets(
    'dismissal is blocked during save and late acknowledgement cannot expose prior store',
    (tester) async {
      final sent = Completer<void>();
      late RequestOptions held;
      late RequestInterceptorHandler handler;
      final harness = StaffHarness((r, h) {
        if (r.method == 'GET') {
          fixture.respond(r, h, [
            fixture.member(r.queryParameters['store_id'] as String),
          ]);
        } else {
          held = r;
          handler = h;
          sent.complete();
        }
      });
      try {
        await harness.mount(tester);
        await tester.tap(find.widgetWithText(FilledButton, 'Add staff'));
        await tester.pumpAndSettle();
        await tester.enterText(
          find.byType(TextFormField).first,
          'pending@example.invalid',
        );
        await tester.ensureVisible(find.text('Send staff invitation'));
        await tester.tap(find.text('Send staff invitation'));
        for (var step = 0; step < 20 && !sent.isCompleted; step++) {
          await tester.pump(const Duration(milliseconds: 10));
        }
        expect(
          sent.isCompleted,
          isTrue,
          reason:
              'The save must reach the held transport within a finite pump budget',
        );
        await tester.pump();
        final sheetContext = tester.element(find.byType(LetbuyyFormSheet));
        await Navigator.maybePop(sheetContext);
        await tester.pump();
        expect(find.text('Saving…'), findsOneWidget);
        await harness.stores.selectStoreById(fixture.siteB);
        await tester.pump();
        fixture.respond(held, handler, {
          ...fixture.member(fixture.siteA),
          'invitation': {
            'accept_url': 'https://merchant.example.invalid/secret',
            'expires_at': 'future',
          },
        });
        await tester.pumpAndSettle();
        expect(find.text('Staff invitation created'), findsNothing);
        expect(find.text('pending@example.invalid'), findsNothing);
        expect(find.text('Private staff A'), findsNothing);
        expect(find.text('Store access changed'), findsOneWidget);
      } finally {
        await harness.close(tester);
      }
    },
  );
  for (final dark in [false, true]) {
    for (final scale in [1.0, 2.0]) {
      testWidgets(
        'staff sheet and long private record reflow at 320px, scale $scale, dark $dark',
        (tester) async {
          tester.view.physicalSize = const Size(320, 640);
          tester.view.devicePixelRatio = 1;
          addTearDown(tester.view.resetPhysicalSize);
          addTearDown(tester.view.resetDevicePixelRatio);
          final harness = StaffHarness(
            (r, h) => fixture.respond(r, h, [
              {
                ...fixture.member(fixture.siteA),
                'full_name':
                    'A very long merchant staff member name that must remain readable',
                'email':
                    'very.long.staff.identity.without-shortening@example.invalid',
              },
            ]),
          );
          try {
            await harness.mount(tester, dark: dark, scale: scale);
            expect(tester.takeException(), isNull);
            await tester.tap(find.widgetWithText(FilledButton, 'Add staff'));
            await tester.pumpAndSettle();
            // Insets are a layout stress fixture; software keyboard proof is a separate native gate.
            tester.view.viewInsets = const FakeViewPadding(bottom: 280);
            await tester.pumpAndSettle();
            await tester.enterText(
              find.byType(TextFormField).first,
              'long.private.address@example.invalid',
            );
            await tester.pumpAndSettle();
            await tester.ensureVisible(find.text('Send staff invitation'));
            await tester.pumpAndSettle();
            expect(
              find.text('Send staff invitation').hitTestable(),
              findsOneWidget,
            );
            expect(tester.takeException(), isNull);
          } finally {
            tester.view.resetViewInsets();
            await harness.close(tester);
          }
        },
      );
    }
  }
}
