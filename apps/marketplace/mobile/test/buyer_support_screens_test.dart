// Controlled SDK/Identity transports test mounted UI and session races. These
// are widget proofs, not device, real login/provider or database acceptance.
import 'dart:async';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_api_client/letbuyy_api_client.dart';
import 'package:letbuyy_marketplace/app/routes.dart';
import 'package:letbuyy_marketplace/auth/buyer_sign_in_controller.dart';
import 'package:letbuyy_marketplace/data/buyer_support_commands.dart';
import 'package:letbuyy_marketplace/screens/profile/profile_screen.dart';
import 'package:letbuyy_marketplace/screens/support/support_chat_screen.dart';
import 'package:letbuyy_marketplace/screens/support/support_conversations_screen.dart';
import 'package:letbuyy_marketplace_services/letbuyy_marketplace_services.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'support/buyer_session_fixture.dart';

const ticketId = '11111111-1111-4111-8111-111111111111';
const otherId = '22222222-2222-4222-8222-222222222222';
JsonMap ticket(String name) => {
  'id': ticketId,
  'subject': name,
  'ticket_ref': 'SYN-1',
  'status': 'open',
};
JsonMap message(String body) => {
  'id': otherId,
  'body': body,
  'author_type': 'agent',
  'created_at': '2026-10-16T10:00:00Z',
};

class _Support extends BuyerSupportApi {
  _Support() : super(ApiClient(baseUrl: 'https://gateway.example.invalid'));
  Future<List<JsonMap>> Function(String) tickets = (token) async => [
    ticket('Ticket $token'),
  ];
  Future<List<JsonMap>> Function(String, String) messages = (token, _) async =>
      [message('Public reply $token')];
  final reads = <String>[];
  Future<BuyerSupportPage> Function(String, String?)? ticketPages;
  Future<BuyerSupportPage> Function(String, String, String?)? messagePages;
  @override
  Future<BuyerSupportPage> listTicketPage(
    String token, {
    int limit = 50,
    String? cursor,
  }) async => ticketPages != null
      ? ticketPages!(token, cursor)
      : BuyerSupportPage(
          items: await listTickets(token, limit: limit),
          hasMore: false,
        );
  @override
  Future<BuyerSupportPage> listPublicMessagePage(
    String token,
    String id, {
    int limit = 200,
    String? cursor,
  }) async => messagePages != null
      ? messagePages!(token, id, cursor)
      : BuyerSupportPage(
          items: await listPublicMessages(token, id),
          hasMore: false,
        );
  @override
  Future<List<JsonMap>> listTickets(String token, {int limit = 50}) {
    reads.add('list:$token:$limit');
    return tickets(token);
  }

  @override
  Future<List<JsonMap>> listPublicMessages(String token, String id) {
    reads.add('thread:$token:$id');
    return messages(token, id);
  }
}

class _CommandStore implements BuyerSupportCommandStore {
  final values = <String, String>{};
  @override
  Future<String?> read(String key) async => values[key];
  @override
  Future<void> write(String key, String value) async {
    values[key] = value;
  }

  @override
  Future<void> delete(String key) async {
    values.remove(key);
  }
}

class _Addresses extends BuyerAddressApi {
  _Addresses() : super(ApiClient(baseUrl: 'https://gateway.example.invalid'));
  @override
  Future<List<BuyerAddress>> list(String token) async => [];
}

Widget wrap(
  BuyerSignInController auth,
  BuyerSupportApi api,
  Widget screen, {
  bool profile = false,
}) => MultiProvider(
  providers: [
    ChangeNotifierProvider<BuyerSignInController>.value(value: auth),
    Provider<BuyerSupportApi>.value(value: api),
    Provider<BuyerSupportCommands>(
      create: (_) => BuyerSupportCommands(store: _CommandStore()),
    ),
    if (profile) ...[
      Provider<BuyerAddressApi>(create: (_) => _Addresses()),
      ChangeNotifierProvider<ThemeProvider>(create: (_) => ThemeProvider()),
      ChangeNotifierProvider<WishlistProvider>(
        create: (_) => WishlistProvider(),
      ),
    ],
  ],
  child: MaterialApp(home: screen, onGenerateRoute: AppRoutes.onGenerateRoute),
);

Future<BuyerSignInController> authFor(WidgetTester tester) async {
  final auth = (await tester.runAsync(
    () => createSyntheticBuyerSession(canonicalIds: true),
  ))!;
  addTearDown(auth.dispose);
  return auth;
}

Future<void> switchToB(WidgetTester tester, BuyerSignInController auth) async {
  await tester.runAsync(auth.signOut);
  await tester.runAsync(auth.signIn);
}

void main() {
  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    await SharedPreferencesService.init();
  });

  testWidgets(
    'ticket pagination keeps the visible page and reaches older tickets through the returned cursor',
    (tester) async {
      final auth = await authFor(tester), api = _Support();
      final cursors = <String?>[];
      api.ticketPages = (token, cursor) async {
        cursors.add(cursor);
        return cursor == null
            ? BuyerSupportPage(
                items: [ticket('Recent ticket')],
                hasMore: true,
                nextCursor: 'older-ticket-cursor',
              )
            : BuyerSupportPage(
                items: [
                  {...ticket('Older ticket'), 'id': otherId},
                ],
                hasMore: false,
              );
      };
      await tester.pumpWidget(
        wrap(auth, api, const SupportConversationsScreen()),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.widgetWithText(TextButton, 'Load older tickets'));
      await tester.pumpAndSettle();
      expect(find.text('Recent ticket'), findsOneWidget);
      expect(find.text('Older ticket'), findsOneWidget);
      expect(cursors, [null, 'older-ticket-cursor']);
      expect(
        find.widgetWithText(TextButton, 'Load older tickets'),
        findsNothing,
      );
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets(
    'thread pagination keeps earlier public messages and reaches the later history',
    (tester) async {
      final auth = await authFor(tester), api = _Support();
      final cursors = <String?>[];
      api.messagePages = (token, id, cursor) async {
        cursors.add(cursor);
        return cursor == null
            ? BuyerSupportPage(
                items: [message('Earlier public message')],
                hasMore: true,
                nextCursor: 'later-message-cursor',
              )
            : BuyerSupportPage(
                items: [
                  {...message('Later public message'), 'id': ticketId},
                ],
                hasMore: false,
              );
      };
      await tester.pumpWidget(
        wrap(auth, api, const SupportChatScreen(conversationId: ticketId)),
      );
      await tester.pumpAndSettle();
      await tester.ensureVisible(
        find.widgetWithText(TextButton, 'Load later messages'),
      );
      await tester.tap(find.widgetWithText(TextButton, 'Load later messages'));
      await tester.pumpAndSettle();
      expect(find.text('Earlier public message'), findsOneWidget);
      expect(find.text('Later public message'), findsOneWidget);
      expect(cursors, [null, 'later-message-cursor']);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets(
    'a held older-ticket page cannot refill history after switching buyers',
    (tester) async {
      final auth = await authFor(tester), api = _Support();
      final late = Completer<BuyerSupportPage>();
      api.ticketPages = (token, cursor) async => token == 'B'
          ? BuyerSupportPage(items: [ticket('B history')], hasMore: false)
          : cursor == null
          ? BuyerSupportPage(
              items: [ticket('A history')],
              hasMore: true,
              nextCursor: 'held-older-page',
            )
          : late.future;
      await tester.pumpWidget(
        wrap(auth, api, const SupportConversationsScreen()),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.widgetWithText(TextButton, 'Load older tickets'));
      await tester.pump();
      await switchToB(tester, auth);
      await tester.pumpAndSettle();
      late.complete(
        BuyerSupportPage(
          items: [
            {...ticket('Private older A ticket'), 'id': otherId},
          ],
          hasMore: false,
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('B history'), findsOneWidget);
      expect(find.text('A history'), findsNothing);
      expect(find.text('Private older A ticket'), findsNothing);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets(
    'normal Profile Help Center route opens canonical ticket list then public thread with truthful windows',
    (tester) async {
      final auth = await authFor(tester), api = _Support();
      await tester.pumpWidget(
        wrap(auth, api, const ProfileScreen(), profile: true),
      );
      await tester.pumpAndSettle();
      await tester.ensureVisible(find.text('Help Center'));
      await tester.tap(find.text('Help Center'));
      await tester.pumpAndSettle();
      expect(find.textContaining('Load older tickets'), findsOneWidget);
      expect(find.text('Ticket A'), findsOneWidget);
      await tester.tap(find.byKey(const ValueKey('support-ticket-$ticketId')));
      await tester.pumpAndSettle();
      expect(find.text('Public reply A'), findsOneWidget);
      expect(
        find.textContaining(
          'Continue to load later messages through the full history',
        ),
        findsOneWidget,
      );
      expect(find.text('Attachments are not available yet.'), findsOneWidget);
      expect(api.reads, ['list:A:50', 'thread:A:$ticketId']);
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox());
    },
  );

  testWidgets(
    'A list completion cannot replace B after switching while loading',
    (tester) async {
      final auth = await authFor(tester), api = _Support();
      final lateA = Completer<List<JsonMap>>();
      api.tickets = (token) =>
          token == 'A' ? lateA.future : Future.value([ticket('B ticket')]);
      await tester.pumpWidget(
        wrap(auth, api, const SupportConversationsScreen()),
      );
      await tester.pump();
      expect(find.byType(CircularProgressIndicator), findsOneWidget);
      await switchToB(tester, auth);
      await tester.pumpAndSettle();
      lateA.complete([ticket('Private A ticket')]);
      await tester.pumpAndSettle();
      expect(find.text('B ticket'), findsOneWidget);
      expect(find.text('Private A ticket'), findsNothing);
    },
  );

  testWidgets(
    'visible A records clear at logout and a stale tile cannot navigate for B',
    (tester) async {
      final auth = await authFor(tester), api = _Support();
      await tester.pumpWidget(
        wrap(auth, api, const SupportConversationsScreen()),
      );
      await tester.pumpAndSettle();
      final oldTap = tester
          .widget<ListTile>(
            find.byKey(const ValueKey('support-ticket-$ticketId')),
          )
          .onTap!;
      await tester.runAsync(auth.signOut);
      await tester.pumpAndSettle();
      expect(find.text('Ticket A'), findsNothing);
      expect(find.text('Sign in to view your support tickets'), findsOneWidget);
      await tester.runAsync(auth.signIn);
      await tester.pumpAndSettle();
      oldTap();
      await tester.pumpAndSettle();
      expect(find.byType(SupportChatScreen), findsNothing);
      expect(find.text('Ticket B'), findsOneWidget);
    },
  );

  testWidgets('thread discards late A data when B receives ownership denial', (
    tester,
  ) async {
    final auth = await authFor(tester), api = _Support();
    final lateA = Completer<List<JsonMap>>();
    api.messages = (token, _) => token == 'A'
        ? lateA.future
        : Future.error(
            const ApiException(
              message: 'Private diagnostic',
              statusCode: 404,
              code: 'NOT_FOUND',
            ),
          );
    await tester.pumpWidget(
      wrap(auth, api, const SupportChatScreen(conversationId: ticketId)),
    );
    await tester.pump();
    await switchToB(tester, auth);
    await tester.pumpAndSettle();
    lateA.complete([message('Private A message')]);
    await tester.pumpAndSettle();
    expect(find.text('We couldn’t find this support ticket.'), findsOneWidget);
    expect(find.text('Private A message'), findsNothing);
    expect(find.text('Private diagnostic'), findsNothing);
  });

  testWidgets(
    'same token restored after logout cannot revive a prior request generation',
    (tester) async {
      final auth = await authFor(tester), api = _Support();
      await switchToB(tester, auth);
      final oldB = Completer<List<JsonMap>>();
      var calls = 0;
      api.messages = (_, _) => ++calls == 1
          ? oldB.future
          : Future.value([message('Current B reply')]);
      await tester.pumpWidget(
        wrap(auth, api, const SupportChatScreen(conversationId: ticketId)),
      );
      await tester.pump();
      // Deliberately no frame between logout and restoring this fixture's same B token.
      await switchToB(tester, auth);
      await tester.pumpAndSettle();
      oldB.complete([message('Previous session reply')]);
      await tester.pumpAndSettle();
      expect(calls, 2);
      expect(find.text('Current B reply'), findsOneWidget);
      expect(find.text('Previous session reply'), findsNothing);
    },
  );

  testWidgets(
    'new ticket target clears old thread and ignores its late completion',
    (tester) async {
      final auth = await authFor(tester), api = _Support();
      final old = Completer<List<JsonMap>>();
      api.messages = (_, id) => id == ticketId
          ? old.future
          : Future.value([message('New ticket reply')]);
      await tester.pumpWidget(
        wrap(auth, api, const SupportChatScreen(conversationId: ticketId)),
      );
      await tester.pump();
      await tester.pumpWidget(
        wrap(auth, api, const SupportChatScreen(conversationId: otherId)),
      );
      await tester.pumpAndSettle();
      old.complete([message('Old target reply')]);
      await tester.pumpAndSettle();
      expect(find.text('New ticket reply'), findsOneWidget);
      expect(find.text('Old target reply'), findsNothing);
    },
  );

  testWidgets(
    'revocation clears visible public messages and retry remains explicit',
    (tester) async {
      final auth = await authFor(tester), api = _Support();
      await tester.pumpWidget(
        wrap(auth, api, const SupportChatScreen(conversationId: ticketId)),
      );
      await tester.pumpAndSettle();
      expect(find.text('Public reply A'), findsOneWidget);
      api.messages = (_, _) => Future.error(
        const ApiException(
          message: 'secret detail',
          statusCode: 401,
          code: 'UNAUTHORIZED',
        ),
      );
      await tester
          .widget<RefreshIndicator>(find.byType(RefreshIndicator))
          .onRefresh();
      await tester.pumpAndSettle();
      expect(find.text('Public reply A'), findsNothing);
      expect(
        find.text(
          'Your LetBuyy sign-in has ended. Sign in again from Profile.',
        ),
        findsOneWidget,
      );
      expect(find.text('secret detail'), findsNothing);
      expect(find.text('Try Again'), findsOneWidget);
    },
  );

  testWidgets(
    'offline failure retries successfully without inventing an empty window',
    (tester) async {
      final auth = await authFor(tester), api = _Support();
      api.tickets = (_) => Future.error(
        const ApiException(
          message: 'raw',
          statusCode: 0,
          code: 'NETWORK_ERROR',
        ),
      );
      await tester.pumpWidget(
        wrap(auth, api, const SupportConversationsScreen()),
      );
      await tester.pumpAndSettle();
      expect(find.textContaining('You seem to be offline'), findsOneWidget);
      expect(find.text('No support tickets yet'), findsNothing);
      api.tickets = (_) async => [];
      await tester.tap(find.text('Try Again'));
      await tester.pumpAndSettle();
      expect(find.text('No support tickets yet'), findsOneWidget);
      expect(find.textContaining('Load older tickets'), findsOneWidget);
    },
  );

  testWidgets(
    'an explicitly internal message fails SDK projection and is never rendered',
    (tester) async {
      final auth = await authFor(tester);
      final dio = Dio()
        ..interceptors.add(
          InterceptorsWrapper(
            onRequest: (request, handler) {
              handler.resolve(
                Response(
                  requestOptions: request,
                  statusCode: 200,
                  data: {
                    'success': true,
                    'data': {
                      'items': [
                        {
                          ...message('Private internal body'),
                          'visibility': 'internal',
                        },
                      ],
                      'has_more': false,
                      'next_cursor': null,
                    },
                  },
                ),
              );
            },
          ),
        );
      final api = BuyerSupportApi(
        ApiClient(
          baseUrl: 'https://gateway.example.invalid',
          dio: dio,
          maxRetries: 0,
        ),
      );
      await tester.pumpWidget(
        wrap(auth, api, const SupportChatScreen(conversationId: ticketId)),
      );
      await tester.pumpAndSettle();
      expect(find.text('Private internal body'), findsNothing);
      expect(
        find.text('We couldn’t load this support thread. Please try again.'),
        findsOneWidget,
      );
    },
  );

  testWidgets(
    'legacy prefill is retained without a write or fabricated recorded thread',
    (tester) async {
      final auth = await authFor(tester), api = _Support();
      const screen = SupportChatScreen(
        subject: 'Private prefill',
        initialMessage: 'Unsent intent',
        metadata: {'orderId': 'unverified'},
      );
      await tester.pumpWidget(wrap(auth, api, screen));
      await tester.pumpAndSettle();
      expect(
        find.textContaining('Prefilled text is an unsent draft'),
        findsOneWidget,
      );
      expect(find.text('Support request recorded'), findsNothing);
      expect(find.text('Private prefill'), findsOneWidget);
      expect(find.text('Unsent intent'), findsOneWidget);
      expect(find.text('Send request'), findsOneWidget);
      expect(api.reads, isEmpty);
    },
  );

  testWidgets('disposed thread ignores a delayed response', (tester) async {
    final auth = await authFor(tester), api = _Support();
    final late = Completer<List<JsonMap>>();
    api.messages = (_, _) => late.future;
    await tester.pumpWidget(
      wrap(auth, api, const SupportChatScreen(conversationId: ticketId)),
    );
    await tester.pump();
    await tester.pumpWidget(const SizedBox());
    late.complete([message('Disposed reply')]);
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
    expect(find.text('Disposed reply'), findsNothing);
  });
}
