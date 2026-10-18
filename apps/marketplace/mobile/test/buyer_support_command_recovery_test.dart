// Synthetic transport and in-memory secure-store boundary. Actual transaction,
// role, race, fault and replay behavior are proven by the separate owned DB lane.
import 'dart:async';
import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_api_client/letbuyy_api_client.dart';
import 'package:letbuyy_marketplace/auth/buyer_sign_in_controller.dart';
import 'package:letbuyy_marketplace/data/buyer_support_commands.dart';
import 'package:letbuyy_marketplace/screens/support/support_chat_screen.dart';
import 'package:provider/provider.dart';
import 'support/buyer_session_fixture.dart';

const buyerA = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa',
    buyerB = 'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb';
const ticketId = '11111111-1111-4111-8111-111111111111',
    messageId = '22222222-2222-4222-8222-222222222222';
const stamp = '2026-10-16T10:01:00Z';

class MemoryCommands implements BuyerSupportCommandStore {
  final values = <String, String>{};
  int writes = 0;
  bool failWrite = false;
  Completer<void>? readGate;
  @override
  Future<String?> read(String key) async {
    await readGate?.future;
    return values[key];
  }

  @override
  Future<void> write(String key, String value) async {
    writes++;
    if (failWrite) throw StateError('synthetic secure storage unavailable');
    values[key] = value;
  }

  @override
  Future<void> delete(String key) async {
    values.remove(key);
  }
}

class Wire {
  Wire({this.loseFirst = false}) {
    api = BuyerSupportApi(
      ApiClient(
        baseUrl: 'https://gateway.example.invalid/v1',
        dio: dio,
        maxRetries: 0,
      ),
    );
    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (request, handler) async {
          requests.add(request);
          if (request.method == 'GET') {
            final items = request.path.endsWith('/messages')
                ? messages
                : receipts.values
                      .where((row) => row.containsKey('ticket_ref'))
                      .map(
                        (row) => {
                          for (final field in [
                            'id',
                            'ticket_ref',
                            'subject',
                            'status',
                            'topic',
                            'created_at',
                            'last_agent_message_at',
                          ])
                            field: row[field],
                        },
                      )
                      .toList();
            handler.resolve(
              Response(
                requestOptions: request,
                statusCode: 200,
                data: {
                  'success': true,
                  'data': {
                    'items': items,
                    'has_more': false,
                    'next_cursor': null,
                  },
                },
              ),
            );
            return;
          }
          final key = request.headers['X-Idempotency-Key'] as String;
          final input = Map<String, dynamic>.from(request.data as Map);
          final isReply = request.path.endsWith('/messages');
          final response = receipts.putIfAbsent(key, () {
            effects++;
            final recordedMessageId = effects == 1
                ? messageId
                : '22222222-2222-4222-8222-${effects.toRadixString(16).padLeft(12, '0')}';
            final message = {
              'id': recordedMessageId,
              'author_type': 'requester',
              'body': input['body'],
              'created_at': stamp,
            };
            messages.add(message);
            return {
              if (isReply)
                ...message
              else ...{
                'id': ticketId,
                'ticket_ref': 'SYN-RECORDED',
                'subject': input['subject'],
                'status': 'open',
                'topic': 'general',
                'created_at': stamp,
                'last_agent_message_at': null,
                'complaint_copy': {
                  'subject': input['subject'],
                  'body': input['body'],
                  'recorded_at': stamp,
                },
                'receipt_confirmed_at': stamp,
              },
              'mutation_receipt': {
                'key': key,
                'operation': isReply ? 'reply' : 'create',
                'ticket_id': ticketId,
                'message_id': recordedMessageId,
                'confirmed_at': stamp,
              },
            };
          });
          reached?.complete();
          reached = null;
          await responseGate?.future;
          if (loseFirst) {
            loseFirst = false;
            handler.reject(
              DioException(
                requestOptions: request,
                type: DioExceptionType.connectionError,
              ),
            );
            return;
          }
          handler.resolve(
            Response(
              requestOptions: request,
              statusCode: 201,
              data: {'success': true, 'data': response},
            ),
          );
        },
      ),
    );
  }
  final dio = Dio();
  late final BuyerSupportApi api;
  final requests = <RequestOptions>[],
      receipts = <String, JsonMap>{},
      messages = <JsonMap>[];
  int effects = 0;
  bool loseFirst;
  Completer<void>? responseGate, reached;
}

Future<BuyerSupportCommand> prepare(
  BuyerSupportCommands commands, {
  String buyer = buyerA,
  String body = 'Synthetic complaint',
  String? ticket,
}) => commands.prepare(
  buyerId: buyer,
  ticketId: ticket,
  subject: ticket == null ? 'Synthetic subject' : null,
  body: body,
);
Future<BuyerSupportCommandResult> send(
  BuyerSupportCommands commands,
  BuyerSupportCommand command,
  Wire wire, {
  bool Function()? current,
}) => commands.send(
  command,
  wire.api,
  buyerId: command.buyerId,
  token: 'A',
  isCurrent: current ?? () => true,
);

Widget screen(
  BuyerSignInController auth,
  Wire wire,
  BuyerSupportCommands commands, {
  String? id,
  String? subject,
  String? body,
}) => MultiProvider(
  providers: [
    ChangeNotifierProvider<BuyerSignInController>.value(value: auth),
    Provider<BuyerSupportApi>.value(value: wire.api),
    Provider<BuyerSupportCommands>.value(value: commands),
  ],
  child: MaterialApp(
    home: SupportChatScreen(
      conversationId: id,
      subject: subject,
      initialMessage: body,
    ),
  ),
);

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  test(
    'concurrent preparation persists one stable action before any transport',
    () async {
      final store = MemoryCommands();
      int keys = 0;
      final commands = BuyerSupportCommands(
        store: store,
        keyFactory: () => 'saved-support-${++keys}',
      );
      final prepared = await Future.wait([
        prepare(commands),
        prepare(commands),
      ]);
      expect(prepared[0].key, prepared[1].key);
      expect(keys, 1);
      expect(store.writes, 1);
      final json = jsonDecode(store.values.values.single) as Map;
      expect(json['buyer_id'], buyerA);
      expect(json['body'], 'Synthetic complaint');
      expect(json.containsKey('token'), isFalse);
    },
  );

  test(
    'response loss and a fresh command service recover the same effect and acknowledge only its server receipt',
    () async {
      final store = MemoryCommands(), wire = Wire(loseFirst: true);
      final first = BuyerSupportCommands(
        store: store,
        keyFactory: () => 'persisted-support-key',
      );
      final command = await prepare(first);
      await expectLater(
        send(first, command, wire),
        throwsA(isA<ApiException>()),
      );
      expect(wire.effects, 1);
      expect(store.values, isNotEmpty);
      final restarted = BuyerSupportCommands(
        store: store,
        keyFactory: () => throw StateError('must not generate another key'),
      );
      final restored = (await restarted.restore(buyerA))!;
      expect(restored.key, command.key);
      final result = await send(restarted, restored, wire);
      expect(result.complaintCopy!['body'], command.body);
      expect(wire.effects, 1);
      expect(
        wire.requests
            .where((r) => r.method == 'POST')
            .map((r) => r.headers['X-Idempotency-Key'])
            .toSet(),
        {command.key},
      );
      expect(await restarted.acknowledge(restored, result.receipt), isTrue);
      expect(store.values, isEmpty);
    },
  );

  test(
    'changed intent cannot replace an unresolved request or silently generate a new key',
    () async {
      final store = MemoryCommands();
      int keys = 0;
      final commands = BuyerSupportCommands(
        store: store,
        keyFactory: () => 'saved-support-${++keys}',
      );
      final original = await prepare(commands);
      await expectLater(
        prepare(commands, body: 'Different edited intent'),
        throwsA(
          isA<ApiException>().having(
            (e) => e.code,
            'code',
            'SUPPORT_PENDING_CHANGED',
          ),
        ),
      );
      expect((await commands.restore(buyerA))!.body, original.body);
      expect(keys, 1);
      expect(store.writes, 1);
    },
  );

  test(
    'actor-specific restore cannot show or reuse another buyer command',
    () async {
      final store = MemoryCommands();
      int keys = 0;
      final commands = BuyerSupportCommands(
        store: store,
        keyFactory: () => 'saved-support-${++keys}',
      );
      final a = await prepare(commands);
      expect(await commands.restore(buyerB), isNull);
      final b = await prepare(
        commands,
        buyer: buyerB,
        body: 'Synthetic B message',
      );
      expect(a.key, isNot(b.key));
      expect((await commands.restore(buyerA))!.body, a.body);
      expect((await commands.restore(buyerB))!.body, b.body);
      final wire = Wire();
      await expectLater(
        commands.send(
          a,
          wire.api,
          buyerId: buyerB,
          token: 'B',
          isCurrent: () => true,
        ),
        throwsA(isA<ApiException>()),
      );
      expect(wire.requests, isEmpty);
    },
  );

  test(
    'secure persistence failure and corrupt actor binding block transport without erasing the saved intent',
    () async {
      final store = MemoryCommands()..failWrite = true;
      final commands = BuyerSupportCommands(
        store: store,
        keyFactory: () => 'persisted-support-key',
      );
      final wire = Wire();
      await expectLater(prepare(commands), throwsStateError);
      expect(wire.requests, isEmpty);
      expect(store.values, isEmpty);
      store.failWrite = false;
      await prepare(commands);
      final slot = store.values.keys.single;
      final wrong = jsonDecode(store.values[slot]!) as Map<String, dynamic>;
      wrong['buyer_id'] = buyerB;
      store.values[slot] = jsonEncode(wrong);
      await expectLater(
        commands.restore(buyerA),
        throwsA(
          isA<ApiException>().having(
            (e) => e.code,
            'code',
            'SUPPORT_PENDING_INVALID',
          ),
        ),
      );
      expect(store.values, isNotEmpty);
      expect(wire.requests, isEmpty);
    },
  );

  test(
    'context change during storage wait prevents a request and preserves its recovery key',
    () async {
      final store = MemoryCommands(), wire = Wire();
      final commands = BuyerSupportCommands(
        store: store,
        keyFactory: () => 'persisted-support-key',
      );
      final command = await prepare(commands);
      store.readGate = Completer<void>();
      bool current = true;
      final pending = send(commands, command, wire, current: () => current);
      await Future<void>.delayed(Duration.zero);
      current = false;
      store.readGate!.complete();
      await expectLater(
        pending,
        throwsA(
          isA<ApiException>().having(
            (e) => e.code,
            'code',
            'SUPPORT_CONTEXT_CHANGED',
          ),
        ),
      );
      expect(wire.requests, isEmpty);
      expect(store.values, isNotEmpty);
    },
  );

  test(
    'context change after the server effect discards the result and retains a recoverable command',
    () async {
      final store = MemoryCommands(),
          wire = Wire()
            ..responseGate = Completer<void>()
            ..reached = Completer<void>();
      final commands = BuyerSupportCommands(
            store: store,
            keyFactory: () => 'persisted-support-key',
          ),
          command = await prepare(commands);
      bool current = true;
      final reached = wire.reached!.future,
          pending = send(commands, command, wire, current: () => current);
      await reached;
      current = false;
      wire.responseGate!.complete();
      await expectLater(
        pending,
        throwsA(
          isA<ApiException>().having(
            (e) => e.code,
            'code',
            'SUPPORT_CONTEXT_CHANGED',
          ),
        ),
      );
      expect(wire.effects, 1);
      expect(store.values, isNotEmpty);
    },
  );

  test(
    'late acknowledgement cannot erase the next deliberate action',
    () async {
      final store = MemoryCommands(), wire = Wire();
      int keys = 0;
      final commands = BuyerSupportCommands(
        store: store,
        keyFactory: () => 'saved-support-${++keys}',
      );
      final one = await prepare(commands),
          result = await send(commands, one, wire);
      await commands.acknowledge(one, result.receipt);
      final two = await prepare(commands, body: 'Next deliberate action');
      expect(await commands.acknowledge(one, result.receipt), isFalse);
      expect((await commands.restore(buyerA))!.key, two.key);
    },
  );

  testWidgets(
    'normal native form records the canonical complaint and permits a typed public reply',
    (tester) async {
      final auth = (await tester.runAsync(
        () => createSyntheticBuyerSession(canonicalIds: true),
      ))!;
      addTearDown(auth.dispose);
      final store = MemoryCommands(), wire = Wire();
      int keys = 0;
      final commands = BuyerSupportCommands(
        store: store,
        keyFactory: () => 'widget-support-${++keys}',
      );
      await tester.pumpWidget(
        screen(
          auth,
          wire,
          commands,
          subject: 'Synthetic subject',
          body: 'Synthetic complaint',
        ),
      );
      await tester.pumpAndSettle();
      expect(wire.effects, 0);
      expect(find.textContaining('unsent draft'), findsOneWidget);
      await tester.tap(find.text('Send request'));
      await tester.pumpAndSettle();
      expect(wire.effects, 1);
      expect(find.text('Support request recorded'), findsOneWidget);
      expect(find.text('SYN-RECORDED'), findsOneWidget);
      expect(store.values, isEmpty);
      await tester.enterText(
        find.widgetWithText(TextField, 'Reply'),
        'Synthetic reply',
      );
      await tester.tap(find.text('Send reply'));
      await tester.pumpAndSettle();
      expect(wire.effects, 2);
      expect(find.text('Reply recorded'), findsOneWidget);
      expect(store.values, isEmpty);
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox());
    },
  );

  testWidgets(
    'lost response, screen restart and saved-request retry preserve the draft and do not resubmit with a new key',
    (tester) async {
      final auth = (await tester.runAsync(
        () => createSyntheticBuyerSession(canonicalIds: true),
      ))!;
      addTearDown(auth.dispose);
      final store = MemoryCommands(), wire = Wire(loseFirst: true);
      final commands = BuyerSupportCommands(
        store: store,
        keyFactory: () => 'widget-persisted-key',
      );
      await tester.pumpWidget(
        screen(
          auth,
          wire,
          commands,
          subject: 'Synthetic subject',
          body: 'Synthetic complaint',
        ),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.text('Send request'));
      await tester.pumpAndSettle();
      expect(wire.effects, 1);
      expect(
        find.textContaining('couldn’t confirm your request'),
        findsOneWidget,
      );
      expect(find.text('Synthetic complaint'), findsOneWidget);
      expect(store.values, isNotEmpty);
      await tester.pumpWidget(const SizedBox());
      final restarted = BuyerSupportCommands(
        store: store,
        keyFactory: () => throw StateError('no regenerated key'),
      );
      await tester.pumpWidget(screen(auth, wire, restarted));
      await tester.pumpAndSettle();
      expect(find.text('Synthetic complaint'), findsOneWidget);
      await tester.ensureVisible(find.text('Retry saved request'));
      await tester.tap(find.text('Retry saved request'));
      await tester.pumpAndSettle();
      expect(wire.effects, 1);
      expect(find.text('Support request recorded'), findsOneWidget);
      expect(store.values, isEmpty);
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox());
    },
  );

  testWidgets(
    'disposing a held create retains its command for same-key recovery on the next screen',
    (tester) async {
      final auth = (await tester.runAsync(
        () => createSyntheticBuyerSession(canonicalIds: true),
      ))!;
      addTearDown(auth.dispose);
      final store = MemoryCommands(),
          wire = Wire()..responseGate = Completer<void>();
      final commands = BuyerSupportCommands(
        store: store,
        keyFactory: () => 'widget-disposed-key',
      );
      await tester.pumpWidget(
        screen(
          auth,
          wire,
          commands,
          subject: 'Synthetic subject',
          body: 'Synthetic complaint',
        ),
      );
      await tester.pumpAndSettle();
      await tester.ensureVisible(find.text('Send request'));
      await tester.tap(find.text('Send request'));
      await tester.pumpAndSettle();
      expect(wire.effects, 1);
      await tester.pumpWidget(const SizedBox());
      wire.responseGate!.complete();
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
      expect(store.values, isNotEmpty);
      final restarted = BuyerSupportCommands(
        store: store,
        keyFactory: () => throw StateError('must keep saved key'),
      );
      await tester.pumpWidget(screen(auth, wire, restarted));
      await tester.pumpAndSettle();
      await tester.ensureVisible(find.text('Retry saved request'));
      await tester.tap(find.text('Retry saved request'));
      await tester.pumpAndSettle();
      expect(wire.effects, 1);
      expect(find.text('Support request recorded'), findsOneWidget);
      expect(store.values, isEmpty);
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox());
    },
    timeout: const Timeout(Duration(seconds: 30)),
  );

  testWidgets(
    'a short viewport keeps the full draft and recorded long complaint scrollable without overflow',
    (tester) async {
      tester.view.devicePixelRatio = 1;
      tester.view.physicalSize = const Size(800, 320);
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final auth = (await tester.runAsync(
        () => createSyntheticBuyerSession(canonicalIds: true),
      ))!;
      addTearDown(auth.dispose);
      final wire = Wire(),
          commands = BuyerSupportCommands(
            store: MemoryCommands(),
            keyFactory: () => 'widget-short-view-key',
          );
      await tester.pumpWidget(
        screen(
          auth,
          wire,
          commands,
          subject: 'Synthetic subject',
          body: 'Synthetic long body '.padRight(4000, 'x'),
        ),
      );
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
      await tester.ensureVisible(find.text('Send request'));
      await tester.tap(find.text('Send request'));
      await tester.pumpAndSettle();
      expect(wire.effects, 1);
      expect(find.text('Support request recorded'), findsOneWidget);
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox());
    },
  );

  testWidgets(
    'logout and A to B while a create is held clear draft and reject the late A confirmation',
    (tester) async {
      final auth = (await tester.runAsync(
        () => createSyntheticBuyerSession(canonicalIds: true),
      ))!;
      addTearDown(auth.dispose);
      final store = MemoryCommands(),
          wire = Wire()..responseGate = Completer<void>();
      final commands = BuyerSupportCommands(
        store: store,
        keyFactory: () => 'widget-held-key',
      );
      await tester.pumpWidget(
        screen(
          auth,
          wire,
          commands,
          subject: 'Private A subject',
          body: 'Private A draft',
        ),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.text('Send request'));
      await tester.pumpAndSettle();
      expect(wire.effects, 1);
      await tester.runAsync(auth.signOut);
      await tester.runAsync(auth.signIn);
      await tester.pumpAndSettle();
      expect(find.text('Private A subject'), findsNothing);
      expect(find.text('Private A draft'), findsNothing);
      wire.responseGate!.complete();
      await tester.pumpAndSettle();
      expect(find.text('Support request recorded'), findsNothing);
      expect(store.values, isNotEmpty);
      expect(await tester.runAsync(() => commands.restore(buyerB)), isNull);
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox());
    },
    timeout: const Timeout(Duration(seconds: 30)),
  );
}
