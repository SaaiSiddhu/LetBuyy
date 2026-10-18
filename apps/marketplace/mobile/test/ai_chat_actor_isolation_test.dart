import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_api_client/letbuyy_api_client.dart';
import 'package:letbuyy_marketplace/auth/buyer_session_store.dart';
import 'package:letbuyy_marketplace/auth/buyer_sign_in_browser.dart';
import 'package:letbuyy_marketplace/auth/buyer_sign_in_controller.dart';
import 'package:letbuyy_marketplace/auth/buyer_sign_in_wiring.dart';
import 'package:letbuyy_marketplace/screens/chat/ai_chat_screen.dart';
import 'package:letbuyy_marketplace_services/letbuyy_marketplace_services.dart';
import 'package:letbuyy_marketplace_models/letbuyy_marketplace_models.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

class _Store implements BuyerSessionStore {
  StoredBuyerSession? session = StoredBuyerSession(
    token: 'session-A',
    expiresAt: DateTime.utc(2100),
  );
  PendingBuyerSignIn? pending;
  @override
  Future<StoredBuyerSession?> readSession() async => session;
  @override
  Future<void> writeSession(StoredBuyerSession value) async => session = value;
  @override
  Future<void> deleteSession() async => session = null;
  @override
  Future<PendingBuyerSignIn?> readPending() async => pending;
  @override
  Future<void> writePending(PendingBuyerSignIn value) async => pending = value;
  @override
  Future<void> deletePending() async => pending = null;
}

class _Browser implements BuyerSignInBrowser {
  @override
  Future<Uri?> authorize(Uri url) async => Uri.parse(
    'com.letbuyy.letbuyy:/oauth/callback?code=${'B' * 43}&state=${url.queryParameters['state']}',
  );
  @override
  Future<Uri?> takeLaunchCallback() async => null;
  @override
  Future<void> cancelWaiting() async {}
}

class _Gateway {
  final tokens = <String>[];
  Completer<void>? holdA;
  String heldToken = 'session-A';
  String? returnedBuyerId;
  late final client = ApiClient(
    baseUrl: 'https://gateway.invalid/v1',
    maxRetries: 0,
    dio: Dio()
      ..interceptors.add(
        InterceptorsWrapper(
          onRequest: (o, h) async {
            final token = o.headers[letbuyyBuyerSessionHeader] as String;
            tokens.add(token);
            final actor = token.startsWith('session-A') ? 'A' : 'B';
            if (token == heldToken) await holdA?.future;
            h.resolve(
              Response(
                requestOptions: o,
                statusCode: 200,
                data: {
                  'data': {
                    'buyer': {
                      'id': returnedBuyerId ?? 'buyer-$actor',
                      'email': 'same@buyer.invalid',
                      'email_verified': true,
                      'full_name': 'Private $actor',
                    },
                  },
                },
              ),
            );
          },
        ),
      ),
  );
  late final accounts = BuyerAccountApi(client);
}

Future<void> _pumpUntil(WidgetTester tester, bool Function() ready) =>
    tester.runAsync(() async {
      final deadline = DateTime.now().add(const Duration(seconds: 5));
      while (!ready()) {
        if (DateTime.now().isAfter(deadline))
          throw TimeoutException('chat did not settle');
        await tester.pump(const Duration(milliseconds: 10));
      }
    });

Future<({BuyerSignInController controller, _Store store, _Gateway gateway})>
_mount(
  WidgetTester tester,
  AIChatService service, {
  bool holdProfile = false,
}) async {
  tester.view.physicalSize = const Size(900, 1600);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  final gateway = _Gateway();
  final store = _Store();
  final identity = Dio()
    ..interceptors.add(
      InterceptorsWrapper(
        onRequest: (o, h) {
          h.resolve(
            Response(
              requestOptions: o,
              statusCode: 200,
              data: {
                'access_token': 'session-B',
                'token_type': 'Bearer',
                'expires_in': 2592000,
              },
            ),
          );
        },
      ),
    );
  final controller = BuyerSignInController(
    client: BuyerSignInClient(
      identityBaseUrl: 'https://identity.invalid',
      dio: identity,
    ),
    accounts: gateway.accounts,
    browser: _Browser(),
    store: store,
    recheckAfter: Duration.zero,
  );
  bindBuyerAiChatAuth(controller, service: service);
  addTearDown(controller.dispose);
  await tester.runAsync(controller.start);
  if (holdProfile) gateway.holdA = Completer<void>();
  await tester.pumpWidget(
    MultiProvider(
      providers: [
        ChangeNotifierProvider<BuyerSignInController>.value(value: controller),
        Provider<ApiClient>.value(value: gateway.client),
        Provider<BuyerAccountApi>.value(value: gateway.accounts),
      ],
      child: MaterialApp(home: AIChatScreen(service: service)),
    ),
  );
  return (controller: controller, store: store, gateway: gateway);
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    final service = AIChatService.instance;
    service.updateAuth();
    await service.startNewSession();
  });

  test('profile read after A to B uses B even when emails match', () async {
    final gw = _Gateway();
    final service = AIChatService.instance
      ..configure(client: gw.client, accounts: gw.accounts);
    service.updateAuth(
      buyerId: 'buyer-A',
      sessionToken: 'session-A',
      email: 'same@buyer.invalid',
    );
    expect((await service.handleUserProfile())['name'], 'Private A');
    service.updateAuth(
      buyerId: 'buyer-B',
      sessionToken: 'session-B',
      email: 'same@buyer.invalid',
    );
    expect((await service.handleUserProfile())['name'], 'Private B');
    expect(gw.tokens, ['session-A', 'session-B']);
  });

  test('delayed A profile cannot refill cache after logout', () async {
    final gw = _Gateway()..holdA = Completer<void>();
    final service = AIChatService.instance
      ..configure(client: gw.client, accounts: gw.accounts);
    service.updateAuth(
      buyerId: 'buyer-A',
      sessionToken: 'session-A',
      email: 'same@buyer.invalid',
    );
    final pending = service.handleUserProfile();
    while (gw.tokens.isEmpty) {
      await Future<void>.delayed(Duration.zero);
    }
    service.updateAuth();
    gw.holdA!.complete();
    await pending;
    expect(service.userProfileCache, isNull);
  });

  testWidgets('mounted chat logout clears private messages and input', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(900, 1600);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    final gw = _Gateway();
    final controller = BuyerSignInController(
      client: BuyerSignInClient(identityBaseUrl: 'https://identity.invalid'),
      accounts: gw.accounts,
      browser: _Browser(),
      store: _Store(),
    );
    addTearDown(controller.dispose);
    await tester.runAsync(controller.start);
    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ChangeNotifierProvider<BuyerSignInController>.value(
            value: controller,
          ),
          Provider<ApiClient>.value(value: gw.client),
          Provider<BuyerAccountApi>.value(value: gw.accounts),
        ],
        child: const MaterialApp(home: AIChatScreen()),
      ),
    );
    await _pumpUntil(
      tester,
      () => find.byType(TextField).evaluate().isNotEmpty,
    );
    await tester.enterText(find.byType(TextField), 'A private question');
    await tester.testTextInput.receiveAction(TextInputAction.send);
    await tester.pump();
    await tester.enterText(find.byType(TextField), 'A private draft');
    expect(find.text('A private question'), findsOneWidget);
    await tester.pumpAndSettle();
    await tester.longPress(find.text('A private question'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Reply'));
    await tester.pumpAndSettle();
    expect(find.text('A private question'), findsNWidgets(2));
    await tester.runAsync(controller.signOut);
    await tester.pump();
    expect(find.text('A private question'), findsNothing);
    await _pumpUntil(
      tester,
      () => find.byType(TextField).evaluate().isNotEmpty,
    );
    expect(
      tester.widget<TextField>(find.byType(TextField)).controller!.text,
      isEmpty,
    );
  });

  test(
    'canonical actor reset clears conversation and separates persisted session IDs',
    () async {
      final service = AIChatService.forTesting();
      service.updateAuth(buyerId: 'buyer-A', sessionToken: 'session-A');
      await service.initSession();
      final aSession = service.currentSessionId;
      await service.saveMessage(
        ChatMessage.user(text: 'A private history', sessionId: aSession),
      );
      expect(service.context.single.text, 'A private history');
      service.updateAuth(buyerId: 'buyer-B', sessionToken: 'session-B');
      expect(service.context, isEmpty);
      expect(() => service.currentSessionId, throwsStateError);
      await service.initSession();
      expect(service.currentSessionId, isNot(aSession));
      final bSession = service.currentSessionId;
      service.updateAuth();
      await service.initSession();
      expect(service.currentSessionId, isNot(anyOf(aSession, bSession)));
      service.updateAuth(buyerId: 'buyer-A', sessionToken: 'session-A-refresh');
      await service.initSession();
      expect(service.currentSessionId, aSession);
      expect(service.context, isEmpty);
    },
  );

  test(
    'delayed session initialization cannot restore or persist the old actor',
    () async {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('current_chat_session_id', 'unscoped-old-session');
      final ready = Completer<SharedPreferences>();
      final service = AIChatService.forTesting(
        preferencesLoader: () => ready.future,
      );
      service.updateAuth(buyerId: 'buyer-A', sessionToken: 'session-A');
      final oldInit = service.initSession();
      service.updateAuth(buyerId: 'buyer-B', sessionToken: 'session-B');
      final newInit = service.initSession();
      ready.complete(prefs);
      await Future.wait([oldInit, newInit]);
      expect(prefs.getString('current_chat_session_id:buyer:buyer-A'), isNull);
      expect(
        prefs.getString('current_chat_session_id:buyer:buyer-B'),
        service.currentSessionId,
      );
      expect(service.currentSessionId, isNot('unscoped-old-session'));
      expect(
        prefs.getString('current_chat_session_id'),
        'unscoped-old-session',
      );
    },
  );

  test(
    'delayed new-session work cannot write into a different actor',
    () async {
      final prefs = await SharedPreferences.getInstance();
      final ready = Completer<SharedPreferences>();
      final service = AIChatService.forTesting(
        preferencesLoader: () => ready.future,
      );
      service.updateAuth(buyerId: 'buyer-A', sessionToken: 'session-A');
      final oldInit = service.startNewSession();
      final oldId = service.currentSessionId;
      service.updateAuth();
      final guestInit = service.initSession();
      ready.complete(prefs);
      await Future.wait([oldInit, guestInit]);
      expect(prefs.getString('current_chat_session_id:buyer:buyer-A'), isNull);
      expect(
        prefs.getString('current_chat_session_id:guest'),
        service.currentSessionId,
      );
      expect(service.currentSessionId, isNot(oldId));
    },
  );

  test(
    'same buyer refresh preserves conversation but rejects old profile and uses current token',
    () async {
      final gw = _Gateway()..holdA = Completer<void>();
      final service = AIChatService.forTesting()
        ..configure(client: gw.client, accounts: gw.accounts);
      service.updateAuth(buyerId: 'buyer-A', sessionToken: 'session-A');
      await service.initSession();
      final id = service.currentSessionId;
      await service.saveMessage(
        ChatMessage.user(text: 'same buyer history', sessionId: id),
      );
      final pending = service.handleUserProfile();
      while (gw.tokens.isEmpty) {
        await Future<void>.delayed(Duration.zero);
      }
      service.updateAuth(buyerId: 'buyer-A', sessionToken: 'session-A-refresh');
      expect(service.currentSessionId, id);
      expect(service.context.single.text, 'same buyer history');
      gw.holdA!.complete();
      expect((await pending).containsKey('error'), isTrue);
      expect(service.userProfileCache, isNull);
      expect((await service.handleUserProfile())['name'], 'Private A');
      expect(gw.tokens, ['session-A', 'session-A-refresh']);
    },
  );

  test(
    'profile must match the canonical principal even with a valid transport response',
    () async {
      final gw = _Gateway()..returnedBuyerId = 'buyer-B';
      final service = AIChatService.forTesting()
        ..configure(client: gw.client, accounts: gw.accounts);
      service.updateAuth(buyerId: 'buyer-A', sessionToken: 'session-A');
      expect((await service.handleUserProfile()).containsKey('error'), isTrue);
      expect(service.userProfileCache, isNull);
    },
  );

  test(
    'old reply and foreign history cannot cross an actor or refreshed-session boundary',
    () async {
      final reply = Completer<ChatMessage>();
      List<ChatMessage>? sentHistory;
      final service = AIChatService.forTesting(
        reply: (text, history) {
          sentHistory = history;
          return reply.future;
        },
      );
      service.updateAuth(buyerId: 'buyer-A', sessionToken: 'session-A');
      await service.initSession();
      final oldId = service.currentSessionId;
      final pending = service.processUserMessage(
        'A question',
        conversationHistory: [
          ChatMessage.user(text: 'own', sessionId: oldId),
          ChatMessage.user(text: 'foreign', sessionId: 'other-session'),
        ],
      );
      expect(sentHistory!.map((m) => m.text), ['own']);
      service.updateAuth(buyerId: 'buyer-B', sessionToken: 'session-B');
      await service.initSession();
      final check = expectLater(pending, throwsA(isA<AIChatContextChanged>()));
      reply.complete(
        ChatMessage.ai(text: 'A private answer', sessionId: oldId),
      );
      await check;
      await service.saveMessage(
        ChatMessage.ai(text: 'A old append', sessionId: oldId),
      );
      expect(service.context, isEmpty);
    },
  );

  testWidgets(
    'mounted A to B discards a held answer and clears draft/reply/history',
    (tester) async {
      tester.view.physicalSize = const Size(900, 1600);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.reset);
      final gw = _Gateway();
      final reply = Completer<ChatMessage>();
      var replyCalls = 0;
      final service = AIChatService.forTesting(
        reply: (text, history) {
          replyCalls++;
          if (text == 'A private question') return reply.future;
          return Future.value(
            ChatMessage.ai(
              text: 'B current answer',
              sessionId: history!.last.sessionId,
            ),
          );
        },
      );
      final identity = Dio()
        ..interceptors.add(
          InterceptorsWrapper(
            onRequest: (o, h) {
              h.resolve(
                Response(
                  requestOptions: o,
                  statusCode: 200,
                  data: {
                    'access_token': 'session-B',
                    'token_type': 'Bearer',
                    'expires_in': 2592000,
                  },
                ),
              );
            },
          ),
        );
      final controller = BuyerSignInController(
        client: BuyerSignInClient(
          identityBaseUrl: 'https://identity.invalid',
          dio: identity,
        ),
        accounts: gw.accounts,
        browser: _Browser(),
        store: _Store(),
      );
      addTearDown(controller.dispose);
      await tester.runAsync(controller.start);
      await tester.pumpWidget(
        MultiProvider(
          providers: [
            ChangeNotifierProvider<BuyerSignInController>.value(
              value: controller,
            ),
            Provider<ApiClient>.value(value: gw.client),
            Provider<BuyerAccountApi>.value(value: gw.accounts),
          ],
          child: MaterialApp(home: AIChatScreen(service: service)),
        ),
      );
      await _pumpUntil(
        tester,
        () => find.byType(TextField).evaluate().isNotEmpty,
      );
      await tester.enterText(find.byType(TextField), 'A private question');
      await tester.testTextInput.receiveAction(TextInputAction.send);
      await _pumpUntil(tester, () => replyCalls == 1);
      final oldSession = service.currentSessionId;
      await tester.runAsync(controller.signIn);
      await _pumpUntil(
        tester,
        () =>
            controller.buyerId == 'buyer-B' &&
            find.byType(TextField).evaluate().isNotEmpty,
      );
      expect(find.text('A private question'), findsNothing);
      expect(
        tester.widget<TextField>(find.byType(TextField)).controller!.text,
        isEmpty,
      );
      reply.complete(
        ChatMessage.ai(text: 'A private answer', sessionId: oldSession),
      );
      await tester.pumpAndSettle();
      expect(find.text('A private answer'), findsNothing);
      expect(service.userProfileCache!['name'], 'Private B');
      await tester.enterText(find.byType(TextField), 'B question');
      await tester.testTextInput.receiveAction(TextInputAction.send);
      await _pumpUntil(
        tester,
        () => find.text('B current answer').evaluate().isNotEmpty,
      );
      expect(service.context.any((m) => m.text.contains('A private')), isFalse);
      expect(tester.takeException(), isNull);
    },
  );

  test(
    'same actor token refresh rejects an old model answer and allows a new one',
    () async {
      final held = Completer<ChatMessage>();
      final service = AIChatService.forTesting(
        reply: (text, history) => text == 'held'
            ? held.future
            : Future.value(
                ChatMessage.ai(
                  text: 'current',
                  sessionId: history!.last.sessionId,
                ),
              ),
      );
      service.updateAuth(buyerId: 'buyer-A', sessionToken: 'session-A');
      await service.initSession();
      final id = service.currentSessionId;
      final old = service.processUserMessage('held');
      final check = expectLater(old, throwsA(isA<AIChatContextChanged>()));
      service.updateAuth(buyerId: 'buyer-A', sessionToken: 'session-A-refresh');
      held.complete(ChatMessage.ai(text: 'old answer', sessionId: id));
      await check;
      final answer = await service.processUserMessage(
        'new',
        conversationHistory: [
          ChatMessage.user(text: 'current question', sessionId: id),
        ],
      );
      expect(answer.text, 'current');
      expect(service.currentSessionId, id);
    },
  );

  testWidgets(
    'same actor refresh retains mounted conversation and unsent input',
    (tester) async {
      final service = AIChatService.forTesting(
        reply: (text, history) => Future.value(
          ChatMessage.ai(
            text: 'A current answer',
            sessionId: history!.last.sessionId,
          ),
        ),
      );
      final h = await _mount(tester, service);
      await _pumpUntil(
        tester,
        () => find.byType(TextField).evaluate().isNotEmpty,
      );
      await tester.enterText(find.byType(TextField), 'keep this question');
      await tester.testTextInput.receiveAction(TextInputAction.send);
      await _pumpUntil(
        tester,
        () => find.text('A current answer').evaluate().isNotEmpty,
      );
      await tester.pump();
      final input = tester.widget<TextField>(find.byType(TextField)).controller;
      await tester.enterText(find.byType(TextField), 'keep this draft');
      final id = service.currentSessionId;
      h.store.session = StoredBuyerSession(
        token: 'session-A-refresh',
        expiresAt: DateTime.utc(2100),
      );
      await tester.runAsync(h.controller.onResumed);
      await tester.pump();
      expect(h.controller.buyerId, 'buyer-A');
      expect(service.currentSessionId, id);
      expect(
        tester.widget<TextField>(find.byType(TextField)).controller,
        same(input),
      );
      expect(input!.text, 'keep this draft');
      expect(find.text('keep this question'), findsOneWidget);
      expect(find.text('A current answer'), findsOneWidget);
      await tester.pumpAndSettle();
    },
  );

  testWidgets(
    'logout while profile initialization is held discards the old profile',
    (tester) async {
      final service = AIChatService.forTesting();
      final h = await _mount(tester, service, holdProfile: true);
      await _pumpUntil(tester, () => h.gateway.tokens.length == 2);
      expect(find.byType(TextField), findsNothing);
      await tester.runAsync(h.controller.signOut);
      await _pumpUntil(
        tester,
        () => find.byType(TextField).evaluate().isNotEmpty,
      );
      h.gateway.holdA!.complete();
      await tester.pumpAndSettle();
      expect(service.userProfileCache, isNull);
      expect(service.context, isEmpty);
      expect(find.textContaining('Private A'), findsNothing);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets(
    'mounted delayed preferences initialization applies only to new buyer',
    (tester) async {
      final prefs = await SharedPreferences.getInstance();
      final ready = Completer<SharedPreferences>();
      final service = AIChatService.forTesting(
        preferencesLoader: () => ready.future,
      );
      final h = await _mount(tester, service);
      expect(find.byType(TextField), findsNothing);
      await tester.runAsync(h.controller.signIn);
      await tester.pump();
      ready.complete(prefs);
      await _pumpUntil(
        tester,
        () =>
            find.byType(TextField).evaluate().isNotEmpty &&
            service.userProfileCache?['name'] == 'Private B',
      );
      expect(prefs.getString('current_chat_session_id:buyer:buyer-A'), isNull);
      expect(
        prefs.getString('current_chat_session_id:buyer:buyer-B'),
        service.currentSessionId,
      );
      expect(
        service.context.every((m) => m.sessionId == service.currentSessionId),
        isTrue,
      );
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets(
    'disposing mounted chat discards pending reply without private append',
    (tester) async {
      final held = Completer<ChatMessage>();
      var calls = 0;
      final service = AIChatService.forTesting(
        reply: (text, history) {
          calls++;
          return held.future;
        },
      );
      await _mount(tester, service);
      await _pumpUntil(
        tester,
        () => find.byType(TextField).evaluate().isNotEmpty,
      );
      await tester.enterText(find.byType(TextField), 'A pending question');
      await tester.testTextInput.receiveAction(TextInputAction.send);
      await _pumpUntil(tester, () => calls == 1);
      final id = service.currentSessionId;
      await tester.pumpWidget(const MaterialApp(home: SizedBox()));
      held.complete(ChatMessage.ai(text: 'A late answer', sessionId: id));
      await tester.pumpAndSettle();
      expect(service.context.any((m) => m.text == 'A late answer'), isFalse);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets('an open private-message options sheet closes on logout', (
    tester,
  ) async {
    final service = AIChatService.forTesting();
    final h = await _mount(tester, service);
    await _pumpUntil(
      tester,
      () => find.byType(TextField).evaluate().isNotEmpty,
    );
    await tester.enterText(find.byType(TextField), 'A sheet message');
    await tester.testTextInput.receiveAction(TextInputAction.send);
    await tester.pumpAndSettle();
    await tester.longPress(find.text('A sheet message'));
    await tester.pumpAndSettle();
    expect(find.text('Copy'), findsOneWidget);
    await tester.runAsync(h.controller.signOut);
    await tester.pumpAndSettle();
    expect(find.text('Copy'), findsNothing);
    expect(find.text('A sheet message'), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets('unmounted chat logout clears singleton actor state', (
    tester,
  ) async {
    final service = AIChatService.forTesting();
    final h = await _mount(tester, service);
    await _pumpUntil(
      tester,
      () => find.byType(TextField).evaluate().isNotEmpty,
    );
    final oldSession = service.currentSessionId;
    await service.saveMessage(
      ChatMessage.user(text: 'closed A private history', sessionId: oldSession),
    );
    expect(service.userProfileCache!['name'], 'Private A');
    expect(service.isSignedIn, isTrue);
    await tester.pumpWidget(const MaterialApp(home: SizedBox()));
    // Closing the chat does not sign out a still-valid canonical buyer.
    expect(
      service.context.any((m) => m.text == 'closed A private history'),
      isTrue,
    );
    await tester.runAsync(h.controller.signOut);
    expect(service.isSignedIn, isFalse);
    expect(service.userProfileCache, isNull);
    expect(service.context, isEmpty);
    expect(service.initializedSessionId, isNull);
    final reads = h.gateway.tokens.length;
    expect((await service.handleUserProfile())['error'], 'Not logged in');
    expect(h.gateway.tokens.length, reads);
    await tester.pumpAndSettle();
  });

  testWidgets(
    'unmounted chat A to B follows canonical controller with same email',
    (tester) async {
      final service = AIChatService.forTesting();
      final h = await _mount(tester, service);
      await _pumpUntil(
        tester,
        () => find.byType(TextField).evaluate().isNotEmpty,
      );
      final oldSession = service.currentSessionId;
      await service.saveMessage(
        ChatMessage.user(text: 'A closed question', sessionId: oldSession),
      );
      await tester.pumpWidget(const MaterialApp(home: SizedBox()));
      await tester.runAsync(h.controller.signIn);
      expect(h.controller.buyerId, 'buyer-B');
      expect(service.context, isEmpty);
      expect(service.userProfileCache, isNull);
      expect(service.initializedSessionId, isNull);
      await service.initSession();
      expect(service.currentSessionId, isNot(oldSession));
      final profile = await tester.runAsync(service.handleUserProfile);
      expect(profile!['name'], 'Private B');
      expect(h.gateway.tokens.last, 'session-B');
      await tester.pumpAndSettle();
    },
  );

  testWidgets(
    'unmounted held profile cannot refill singleton after controller logout',
    (tester) async {
      final service = AIChatService.forTesting();
      final h = await _mount(tester, service);
      await _pumpUntil(
        tester,
        () => find.byType(TextField).evaluate().isNotEmpty,
      );
      await tester.pumpWidget(const MaterialApp(home: SizedBox()));
      // Start fresh work after disposal, while the canonical A session is still valid.
      await service.startNewSession();
      h.gateway.holdA = Completer<void>();
      final readCount = h.gateway.tokens.length;
      final pending = service.handleUserProfile();
      await _pumpUntil(tester, () => h.gateway.tokens.length > readCount);
      expect(h.gateway.tokens.last, 'session-A');
      await tester.runAsync(h.controller.signOut);
      h.gateway.holdA!.complete();
      final result = await tester.runAsync(() => pending);
      expect(result!.containsKey('error'), isTrue);
      expect(service.isSignedIn, isFalse);
      expect(service.userProfileCache, isNull);
      expect(service.context, isEmpty);
      await tester.pumpAndSettle();
    },
  );

  testWidgets(
    'unmounted same actor refresh preserves conversation and updates credentials',
    (tester) async {
      final service = AIChatService.forTesting();
      final h = await _mount(tester, service);
      await _pumpUntil(
        tester,
        () => find.byType(TextField).evaluate().isNotEmpty,
      );
      final id = service.currentSessionId;
      await service.saveMessage(
        ChatMessage.user(text: 'valid closed A conversation', sessionId: id),
      );
      await tester.pumpWidget(const MaterialApp(home: SizedBox()));
      h.store.session = StoredBuyerSession(
        token: 'session-A-refresh',
        expiresAt: DateTime.utc(2100),
      );
      await tester.runAsync(h.controller.onResumed);
      expect(h.controller.buyerId, 'buyer-A');
      expect(service.currentSessionId, id);
      expect(
        service.context.any((m) => m.text == 'valid closed A conversation'),
        isTrue,
      );
      final profile = await tester.runAsync(service.handleUserProfile);
      expect(profile!['name'], 'Private A');
      expect(h.gateway.tokens.last, 'session-A-refresh');
      // Force a second profile read through the real API rather than accepting an old cache.
      expect(
        h.gateway.tokens.where((t) => t == 'session-A-refresh'),
        hasLength(2),
      );
      await tester.pumpAndSettle();
    },
  );

  test(
    'controller factory binds initial canonical state and retains normal disposal',
    () {
      final service = AIChatService.instance;
      service.updateAuth(buyerId: 'buyer-A', sessionToken: 'session-A');
      expect(service.isSignedIn, isTrue);
      final controller = buildBuyerSignInController();
      // A new restoring controller has no authenticated principal; never inherit the old singleton.
      expect(service.isSignedIn, isFalse);
      expect(controller.status, BuyerSignInStatus.restoring);
      expect(controller.dispose, returnsNormally);
    },
  );
}
