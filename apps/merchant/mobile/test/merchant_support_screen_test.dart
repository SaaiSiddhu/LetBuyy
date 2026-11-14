// Native UI/storage/transport contracts. Real Gateway/database and normal web
// authentication are verified separately by owned executable suites.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:letbuyy_store/app/store_context.dart';
import 'package:letbuyy_store/services/api_client.dart';
import 'package:letbuyy_store/services/store_service.dart';
import 'package:letbuyy_store/services/store_auth_service.dart';
import 'package:letbuyy_store/screens/settings/merchant_support_screen.dart';

import 'support/loyalty_fixture.dart' show MemoryStorage, siteA, siteB;

const ticketId = '44444444-4444-4444-8444-444444444444';

class SupportTransport extends ApiClient {
  SupportTransport()
    : super(baseUrl: 'https://synthetic.invalid/v1', maxRetries: 0);
  String site = siteA;
  bool unavailable = false, lostReply = false, refuse = false;
  int creations = 0;
  final keys = <String?>[], bodies = <JsonMap>[];
  JsonMap? result;
  @override
  Future<dynamic> request(String path, {ApiRequestOptions? options}) async {
    if (path == '/stores')
      return {
        'data': [
          {
            'id': site,
            'name': 'Synthetic merchant',
            'subdomain': 'synthetic-support',
          },
        ],
        'meta': {'page': 1, 'per_page': 25, 'total': 1},
      };
    if (options?.method == HttpMethod.post) {
      if (path.endsWith('/recovery'))
        return {
          'data': {
            'state': result == null ? 'not_recorded' : 'completed',
            'result': result,
          },
        };
      keys.add(options?.idempotencyKey);
      bodies.add(Map<String, dynamic>.from(options!.body as Map));
      if (refuse)
        throw const ApiException(
          message: 'Synthetic validation refusal',
          statusCode: 400,
          code: 'VALIDATION_ERROR',
        );
      if (result == null) {
        creations++;
        result = {
          'ticket': {
            'id': ticketId,
            'site_id': site,
            'ticket_ref': 'SUP-SYNTHETIC',
            'subject': bodies.last['subject'],
            'status': 'open',
            'topic': 'general',
          },
          'message': {
            'id': 'message-one',
            'author_type': 'requester',
            'body': bodies.last['body'],
            'created_at': '2026-10-21T10:00:00Z',
          },
        };
      }
      if (lostReply)
        throw const ApiException(
          message: 'Synthetic lost reply',
          statusCode: 503,
          code: 'SUPPORT_UNAVAILABLE',
        );
      return {'data': result};
    }
    if (unavailable)
      throw const ApiException(
        message: 'Synthetic read unavailable',
        statusCode: 503,
        code: 'SUPPORT_UNAVAILABLE',
      );
    if (path.endsWith('/tickets'))
      return {
        'data': result == null ? [] : [result!['ticket']],
        'meta': {'has_next': false},
      };
    return {
      'data': {
        'ticket': result!['ticket'],
        'messages': [result!['message']],
        'message_meta': {'has_next': false},
      },
    };
  }
}

class SupportAuth extends StoreAuthService {
  SupportAuth(ApiClient api)
    : super(api: api, identityBaseUrl: 'https://identity.invalid');
  String actor = 'synthetic-owner-a';
  @override
  MerchantSessionUser get currentUser =>
      MerchantSessionUser(id: actor, email: '$actor@example.invalid');
}

class Harness {
  final api = SupportTransport(), storage = MemoryStorage();
  late final StoreContext stores;
  late final SupportAuth auth;
  Future<void> init() async {
    stores = StoreContext(storeService: StoreService(api: api));
    auth = SupportAuth(api);
    await stores.bindActor(auth.actor);
    await stores.ensureSelectedStore();
  }

  Widget app() => MultiProvider(
    providers: [
      ChangeNotifierProvider<StoreContext>.value(value: stores),
      ChangeNotifierProvider<StoreAuthService>.value(value: auth),
      Provider<ApiClient>.value(value: api),
    ],
    child: MaterialApp(home: MerchantSupportScreen(secureStorage: storage)),
  );
  void close() {
    api.close();
    stores.dispose();
    auth.dispose();
  }
}

Future<void> settle(WidgetTester t) async {
  for (var i = 0; i < 8; i++) {
    await t.pump(const Duration(milliseconds: 60));
  }
}

Future<void> press(WidgetTester t, String label) async {
  final target = find.text(label);
  await t.ensureVisible(target);
  await t.tap(target);
  await settle(t);
}

Future<void> fill(WidgetTester t) async {
  await t.enterText(find.byType(TextField).at(0), 'Synthetic support request');
  await t.enterText(find.byType(TextField).at(1), 'Synthetic retained message');
}

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));
  Future<Harness> harness(WidgetTester t) async {
    t.view.physicalSize = const Size(440, 1100);
    t.view.devicePixelRatio = 1;
    addTearDown(t.view.resetPhysicalSize);
    addTearDown(t.view.resetDevicePixelRatio);
    final h = Harness();
    await h.init();
    addTearDown(h.close);
    return h;
  }

  testWidgets(
    'read outage is unavailable, never a false empty queue or editable new request',
    (t) async {
      final h = await harness(t);
      h.api.unavailable = true;
      await t.pumpWidget(h.app());
      await settle(t);
      expect(
        find.text('Ticket data is unavailable. Refresh to try again.'),
        findsOneWidget,
      );
      expect(find.text('No tickets for this store.'), findsNothing);
      expect(find.byType(TextField), findsNothing);
      h.api.unavailable = false;
      await press(t, 'Refresh tickets');
      expect(find.byType(TextField), findsNWidgets(2));
    },
  );
  testWidgets(
    'lost committed response retries the original key/body and creates one ticket',
    (t) async {
      final h = await harness(t);
      h.api.lostReply = true;
      await t.pumpWidget(h.app());
      await settle(t);
      await fill(t);
      await press(t, 'Create ticket');
      expect(h.api.creations, 1);
      expect(h.storage.data, hasLength(1));
      expect(h.storage.data.keys.single, contains('synthetic-owner-a.$siteA'));
      h.api.lostReply = false;
      await press(t, 'Retry same request');
      expect(h.api.keys, hasLength(2));
      expect(h.api.keys[1], h.api.keys[0]);
      expect(h.api.bodies[1], h.api.bodies[0]);
      expect(h.api.creations, 1);
      expect(h.storage.data, isEmpty);
      expect(find.text('Synthetic retained message'), findsOneWidget);
    },
  );
  testWidgets(
    'screen restart restores encrypted pending intent and recovers original result',
    (t) async {
      final h = await harness(t);
      h.api.lostReply = true;
      await t.pumpWidget(h.app());
      await settle(t);
      await fill(t);
      await press(t, 'Create ticket');
      await t.pumpWidget(const SizedBox());
      await t.pumpWidget(h.app());
      await settle(t);
      expect(
        find.text(
          'A pending request was restored. Check its saved outcome before retrying.',
        ),
        findsOneWidget,
      );
      await press(t, 'Check saved request');
      expect(h.api.creations, 1);
      expect(h.api.keys, hasLength(1));
      expect(h.storage.data, isEmpty);
      expect(find.text('Synthetic retained message'), findsOneWidget);
    },
  );
  testWidgets('known refusal retains input and permits a corrected request', (
    t,
  ) async {
    final h = await harness(t);
    h.api.refuse = true;
    await t.pumpWidget(h.app());
    await settle(t);
    await fill(t);
    await press(t, 'Create ticket');
    expect(h.api.creations, 0);
    expect(h.storage.data, isEmpty);
    expect(
      find.textContaining('Request refused. Your draft is retained.'),
      findsOneWidget,
    );
    expect(
      (t.widget<TextField>(find.byType(TextField).at(1))).controller?.text,
      'Synthetic retained message',
    );
  });
  testWidgets(
    'account/store switch cannot expose the previous pending message',
    (t) async {
      final h = await harness(t);
      h.api.lostReply = true;
      await t.pumpWidget(h.app());
      await settle(t);
      await fill(t);
      await press(t, 'Create ticket');
      h.auth.actor = 'synthetic-owner-b';
      h.api.site = siteB;
      h.api.result = null;
      await h.stores.bindActor(h.auth.actor);
      await settle(t);
      expect(find.text('Synthetic retained message'), findsNothing);
      expect(find.text('Check saved request'), findsNothing);
      expect(h.storage.data.keys.single, contains('synthetic-owner-a.$siteA'));
    },
  );
}
