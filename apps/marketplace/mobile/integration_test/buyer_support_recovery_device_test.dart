// Explicit owned Android APK entry, never a unit-test or bearer bootstrap.
// The host runs the SAME APK in five fresh app processes. Each starts the real
// app/main, normal PKCE controller and OS secure stores. Only enum events, opaque
// IDs, counts and key digests cross the loopback control channel. No screenshots.
import 'dart:convert';
import 'dart:io';

import 'package:crypto/crypto.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:letbuyy_api_client/letbuyy_api_client.dart';
import 'package:letbuyy_marketplace/auth/buyer_sign_in_controller.dart';
import 'package:letbuyy_marketplace/config/app_config.dart';
import 'package:letbuyy_marketplace/data/buyer_support_commands.dart';
import 'package:letbuyy_marketplace/main.dart' as app;
import 'package:letbuyy_marketplace/screens/main_screen.dart';
import 'package:letbuyy_marketplace/screens/profile/profile_screen.dart';
import 'package:letbuyy_marketplace/screens/support/support_chat_screen.dart';
import 'package:letbuyy_marketplace/screens/support/support_conversations_screen.dart';
import 'package:provider/provider.dart';

const _alias = String.fromEnvironment('N6_SUPPORT_RUN_ALIAS');
const _controlOrigin = String.fromEnvironment('N6_SUPPORT_CONTROL_ORIGIN');
const _subjectA = 'Synthetic Android support request';
const _bodyA = 'Synthetic Android original complaint';
const _replyA = 'Synthetic Android original public reply';
const _lateA = 'Synthetic Android delayed public reply';
const _subjectB = 'Synthetic Android buyer B request';
const _bodyB = 'Synthetic Android buyer B complaint';
const _privateNote = 'Synthetic Android internal note';
const _phases = <String>[
  'create-loss',
  'create-recover-reply-loss',
  'reply-recover-switch',
  'revoked-recover',
  'return-a-recover',
];

void main() {
  late final IntegrationTestWidgetsFlutterBinding binding;
  final control = _Control();
  String? phase;
  // Register BEFORE initializing the binding: test_api runs tearDownAll in
  // reverse order. The binding must complete its actual failure ledger first;
  // waiting from a later-registered teardown would deadlock that completion.
  tearDownAll(() async {
    final passed = await binding.allTestsPassed.future;
    if (phase != null)
      await control.post('framework-finished', {
        'phase': phase,
        'framework_passed': passed,
      });
    control.close();
  });
  binding = IntegrationTestWidgetsFlutterBinding.ensureInitialized();
  testWidgets('owned Android normal buyer support recovery phase', (
    tester,
  ) async {
    expect(Platform.isAndroid, isTrue);
    expect(_alias.isNotEmpty, isTrue);
    expect(_loopback(Uri.parse(_controlOrigin)), isTrue);
    expect(_loopback(Uri.parse(AppConfig.apiBaseUrl)), isTrue);
    expect(_loopback(Uri.parse(AppConfig.identityBaseUrl)), isTrue);
    expect(const String.fromEnvironment('GEMINI_API_KEY').isEmpty, isTrue);
    var state = await control.state();
    phase = state['phase'] as String;
    expect(_phases.contains(phase), isTrue);
    binding.reportData = {'phase': phase, 'run_alias': _alias};
    app.main();
    final journey = _Journey(tester, control);
    await journey.profile();
    await journey.wait(
      () => journey.auth.status != BuyerSignInStatus.restoring,
    );

    if (phase == 'create-loss') {
      expect(journey.auth.status == BuyerSignInStatus.signedOut, isTrue);
      await journey.signIn('a-create');
      state = await control.post('actor-ready', {
        'actor': 'a',
        'buyer_id': journey.auth.buyerId,
      });
      await journey.help();
      await journey.tapText('New support request');
      await journey.fill('Subject', _subjectA);
      await journey.fill('Message', _bodyA);
      await journey.tapText('Send request');
      await journey.waitSendFailure();
      final pending = await journey.commands.restore(journey.auth.buyerId!);
      expect(
        pending != null &&
            pending.subject == _subjectA &&
            pending.body == _bodyA,
        isTrue,
      );
      await control.post('pending-preserved', {
        'operation': 'create',
        'key_digest': _digest(pending!.key),
      });
    } else if (phase == 'create-recover-reply-loss') {
      expect(journey.auth.status == BuyerSignInStatus.signedIn, isTrue);
      expect(journey.auth.buyerId == state['buyer_a'], isTrue);
      await journey.help();
      await journey.tapText('New support request');
      await journey.wait(
        () => journey.text('Retry saved request').evaluate().isNotEmpty,
      );
      expect(
        journey.fieldValue('Subject') == _subjectA &&
            journey.fieldValue('Message') == _bodyA,
        isTrue,
      );
      final pending = await journey.commands.restore(journey.auth.buyerId!);
      expect(pending != null, isTrue);
      await control.post('pending-restored', {
        'operation': 'create',
        'key_digest': _digest(pending!.key),
      });
      await journey.tapText('Retry saved request');
      await journey.wait(
        () => journey.text('Support request recorded').evaluate().isNotEmpty,
      );
      expect(
        await journey.commands.restore(journey.auth.buyerId!) == null,
        isTrue,
      );
      state = await control.post('create-recovered');
      await journey.fill('Reply', _replyA);
      await journey.tapText('Send reply');
      await journey.waitSendFailure();
      final reply = await journey.commands.restore(
        journey.auth.buyerId!,
        ticketId: state['created_ticket'] as String,
      );
      expect(reply != null && reply.body == _replyA, isTrue);
      await control.post('pending-preserved', {
        'operation': 'reply',
        'key_digest': _digest(reply!.key),
      });
    } else if (phase == 'reply-recover-switch') {
      expect(
        journey.auth.status == BuyerSignInStatus.signedIn &&
            journey.auth.buyerId == state['buyer_a'],
        isTrue,
      );
      await journey.help();
      await journey.openTicket(state['created_ticket'] as String);
      await journey.wait(
        () => journey.text('Retry saved request').evaluate().isNotEmpty,
      );
      final pending = await journey.commands.restore(
        journey.auth.buyerId!,
        ticketId: state['created_ticket'] as String,
      );
      expect(pending != null && pending.body == _replyA, isTrue);
      await control.post('pending-restored', {
        'operation': 'reply',
        'key_digest': _digest(pending!.key),
      });
      await journey.fill('Reply', 'Synthetic different edited intent');
      await journey.tapText('Retry saved request');
      await journey.waitSendFailure();
      await control.post('changed-intent-blocked');
      await journey.tapText('Recover saved request');
      await journey.wait(() => journey.fieldValue('Reply') == _replyA);
      await journey.tapText('Retry saved request');
      await journey.wait(
        () => journey.text('Reply recorded').evaluate().isNotEmpty,
      );
      expect(
        await journey.commands.restore(
              journey.auth.buyerId!,
              ticketId: state['created_ticket'] as String,
            ) ==
            null,
        isTrue,
      );
      await control.post('reply-recovered');
      await journey.history(state);
      await journey.profile();
      await journey.help();
      await journey.openTicket(state['created_ticket'] as String);
      await control.post('arm-late-reply');
      await journey.fill('Reply', _lateA);
      await journey.tapText('Send reply');
      await journey.waitHost((s) => s['late_committed'] == true);
      // Leave the waiting route through normal navigation; sign out on Profile.
      await journey.profile();
      await journey.tapText('Sign out of LetBuyy on this device');
      await journey.wait(
        () => journey.auth.status == BuyerSignInStatus.signedOut,
      );
      await control.post('native-logout-observed');
      await control.post('release-late-reply');
      await journey.waitHost((s) => s['late_released'] == true);
      await tester.pump(const Duration(milliseconds: 500));
      expect(journey.auth.status == BuyerSignInStatus.signedOut, isTrue);
      await journey.signIn('b-create');
      state = await control.post('actor-ready', {
        'actor': 'b',
        'buyer_id': journey.auth.buyerId,
      });
      expect(journey.auth.buyerId != state['buyer_a'], isTrue);
      await tester.pump(const Duration(milliseconds: 300));
      final old = await journey.commands.restore(
        state['buyer_a'] as String,
        ticketId: state['created_ticket'] as String,
      );
      expect(old != null && old.body == _lateA, isTrue);
      expect(
        await journey.commands.restore(
              journey.auth.buyerId!,
              ticketId: state['created_ticket'] as String,
            ) ==
            null,
        isTrue,
      );
      await journey.apiDenials(state, old!);
      await journey.help();
      expect(
        journey.ticket(state['created_ticket'] as String).evaluate().isEmpty,
        isTrue,
      );
      await journey.tapText('New support request');
      expect(
        journey.fieldValue('Subject').isEmpty &&
            journey.fieldValue('Message').isEmpty,
        isTrue,
      );
      await control.post('late-ack-fenced', {'key_digest': _digest(old!.key)});
      await control.post('arm-revocation');
      await journey.fill('Subject', _subjectB);
      await journey.fill('Message', _bodyB);
      await journey.tapText('Send request');
      await journey.waitSendFailure();
      expect(journey.field('Message').evaluate().isEmpty, isTrue);
      final revoked = await journey.commands.restore(journey.auth.buyerId!);
      expect(revoked != null && revoked.body == _bodyB, isTrue);
      await control.post('revoked-pending-kept', {
        'key_digest': _digest(revoked!.key),
      });
    } else if (phase == 'revoked-recover') {
      // start() rechecks the saved token against the live epoch. No token inject.
      expect(journey.auth.status == BuyerSignInStatus.signedOut, isTrue);
      await journey.signIn('b-login');
      expect(journey.auth.buyerId == state['buyer_b'], isTrue);
      await journey.help();
      await journey.tapText('New support request');
      await journey.wait(
        () => journey.text('Retry saved request').evaluate().isNotEmpty,
      );
      expect(
        journey.fieldValue('Subject') == _subjectB &&
            journey.fieldValue('Message') == _bodyB,
        isTrue,
      );
      final command = await journey.commands.restore(journey.auth.buyerId!);
      expect(command != null, isTrue);
      await control.post('revoked-pending-restored', {
        'key_digest': _digest(command!.key),
      });
      await journey.tapText('Retry saved request');
      await journey.wait(
        () => journey.text('Support request recorded').evaluate().isNotEmpty,
      );
      expect(
        await journey.commands.restore(journey.auth.buyerId!) == null,
        isTrue,
      );
      await control.post('revoked-action-recovered');
      await journey.profile();
      await control.post('arm-read-outage');
      await journey.help(expectLoaded: false);
      await journey.wait(
        () => journey.text('Oops! Something went wrong').evaluate().isNotEmpty,
      );
      await control.post('clear-read-outage');
      await journey.tapText('Try Again');
      await journey.wait(
        () => journey.text('New support request').evaluate().isNotEmpty,
      );
      expect(
        journey.ticket(state['created_ticket'] as String).evaluate().isEmpty,
        isTrue,
      );
      await control.post('unavailable-recovered');
    } else if (phase == 'return-a-recover') {
      expect(
        journey.auth.status == BuyerSignInStatus.signedIn &&
            journey.auth.buyerId == state['buyer_b'],
        isTrue,
      );
      await journey.tapText('Sign out of LetBuyy on this device');
      await journey.wait(
        () => journey.auth.status == BuyerSignInStatus.signedOut,
      );
      await journey.signIn('a-login');
      expect(journey.auth.buyerId == state['buyer_a'], isTrue);
      await journey.help();
      await journey.openTicket(state['created_ticket'] as String);
      await journey.wait(
        () => journey.text('Retry saved request').evaluate().isNotEmpty,
      );
      final late = await journey.commands.restore(
        journey.auth.buyerId!,
        ticketId: state['created_ticket'] as String,
      );
      expect(late != null && late.body == _lateA, isTrue);
      await control.post('late-pending-restored', {
        'key_digest': _digest(late!.key),
      });
      await journey.tapText('Retry saved request');
      await journey.wait(
        () => journey.text('Reply recorded').evaluate().isNotEmpty,
      );
      expect(
        await journey.commands.restore(
              journey.auth.buyerId!,
              ticketId: state['created_ticket'] as String,
            ) ==
            null,
        isTrue,
      );
      await journey.profile();
      await journey.help();
      expect(
        journey.ticket(state['buyer_b_ticket'] as String).evaluate().isEmpty,
        isTrue,
      );
      await control.post('late-action-recovered');
    }
    expect(tester.takeException() == null, isTrue);
    await control.post('phase-assertions-finished', {'phase': phase});
  }, timeout: const Timeout(Duration(minutes: 18)));
}

String _digest(String value) => sha256.convert(utf8.encode(value)).toString();

bool _loopback(Uri uri) =>
    uri.scheme == 'http' &&
    (uri.host == '127.0.0.1' || uri.host == 'localhost') &&
    uri.hasPort &&
    uri.userInfo.isEmpty;

class _Control {
  final HttpClient _http = HttpClient()
    ..connectionTimeout = const Duration(seconds: 3);
  Future<Map<String, dynamic>> state() => _request('state');
  Future<Map<String, dynamic>> post(
    String event, [
    Map<String, Object?> fields = const {},
  ]) => _request('events', {'event': event, ...fields});
  Future<Map<String, dynamic>> _request(
    String path, [
    Map<String, Object?>? fields,
  ]) async {
    final request = await _http
        .openUrl(
          fields == null ? 'GET' : 'POST',
          Uri.parse('$_controlOrigin/$path'),
        )
        .timeout(const Duration(seconds: 8));
    request.headers.set('X-N6-Run-Alias', _alias);
    if (fields != null) {
      request.headers.contentType = ContentType.json;
      request.write(jsonEncode(fields));
    }
    final response = await request.close().timeout(const Duration(seconds: 12));
    if (response.statusCode != 200) throw StateError('N6_CONTROL_REFUSED');
    final text = await utf8.decoder.bind(response).join();
    final value = jsonDecode(text) as Map<String, dynamic>;
    if (value['run_alias'] != _alias)
      throw StateError('N6_CONTROL_CONTEXT_CHANGED');
    return value;
  }

  void close() => _http.close(force: true);
}

class _Journey {
  _Journey(this.tester, this.control);
  final WidgetTester tester;
  final _Control control;
  BuildContext? _profileContext;
  Finder text(String value) => find.text(value);
  Finder ticket(String id) => find.byKey(ValueKey('support-ticket-$id'));
  Finder field(String label) => find.byWidgetPredicate(
    (w) => w is TextField && w.decoration?.labelText == label,
  );
  String fieldValue(String label) =>
      tester.widget<TextField>(field(label)).controller!.text;
  BuildContext get context =>
      _profileContext ?? (throw StateError('N6_PROFILE_NOT_READY'));
  BuyerSignInController get auth => context.read<BuyerSignInController>();
  BuyerSupportCommands get commands => context.read<BuyerSupportCommands>();
  BuyerSupportApi get api => context.read<BuyerSupportApi>();
  Future<void> wait(
    bool Function() predicate, {
    Duration timeout = const Duration(seconds: 100),
  }) async {
    final until = DateTime.now().add(timeout);
    while (!predicate()) {
      if (DateTime.now().isAfter(until))
        throw StateError('N6_NATIVE_STAGE_DEADLINE');
      await tester.pump(const Duration(milliseconds: 100));
      await Future<void>.delayed(const Duration(milliseconds: 60));
    }
    await tester.pump(const Duration(milliseconds: 120));
  }

  Future<void> waitHost(bool Function(Map<String, dynamic>) predicate) async {
    final until = DateTime.now().add(const Duration(seconds: 45));
    while (!predicate(await control.state())) {
      if (DateTime.now().isAfter(until))
        throw StateError('N6_HOST_STAGE_DEADLINE');
      await tester.pump(const Duration(milliseconds: 150));
      await Future<void>.delayed(const Duration(milliseconds: 80));
    }
  }

  Future<void> tapText(String label) async {
    await wait(() {
      if (text(label).evaluate().isEmpty) return false;
      final buttons = find.ancestor(
        of: text(label).first,
        matching: find.byWidgetPredicate((w) => w is ButtonStyleButton),
      );
      return buttons.evaluate().isEmpty ||
          tester.widget<ButtonStyleButton>(buttons.first).onPressed != null;
    });
    await tester.ensureVisible(text(label).first);
    await tester.tap(text(label).first);
    await tester.pump(const Duration(milliseconds: 250));
  }

  Future<void> fill(String label, String value) async {
    await wait(
      () =>
          field(label).evaluate().isNotEmpty &&
          tester.widget<TextField>(field(label)).enabled != false,
    );
    await tester.ensureVisible(field(label));
    await tester.enterText(field(label), value);
    FocusManager.instance.primaryFocus?.unfocus();
    await tester.pump(const Duration(milliseconds: 200));
  }

  Future<void> profile() async {
    if (find.byType(SupportChatScreen).evaluate().isNotEmpty)
      Navigator.of(
        tester.element(find.byType(SupportChatScreen)),
      ).popUntil((route) => route.isFirst);
    else if (find.byType(SupportConversationsScreen).evaluate().isNotEmpty)
      Navigator.of(
        tester.element(find.byType(SupportConversationsScreen)),
      ).popUntil((route) => route.isFirst);
    await wait(() => find.byType(MainScreen).evaluate().isNotEmpty);
    if (find.byType(ProfileScreen).evaluate().isEmpty) {
      await tester.tap(find.byIcon(Icons.person_outline_rounded).last);
      await tester.pump(const Duration(milliseconds: 350));
    }
    await wait(() => find.byType(ProfileScreen).evaluate().isNotEmpty);
    _profileContext = tester.element(find.byType(ProfileScreen));
  }

  Future<void> signIn(String actor) async {
    await control.post('identity-needed', {'actor': actor});
    await tapText('Sign in with LetBuyy');
    await wait(
      () => auth.status == BuyerSignInStatus.signedIn,
      timeout: const Duration(minutes: 4),
    );
    expect(auth.buyerId != null && auth.token?.isNotEmpty == true, isTrue);
  }

  Future<void> help({bool expectLoaded = true}) async {
    final scroll = find
        .descendant(
          of: find.byType(ProfileScreen),
          matching: find.byType(Scrollable),
        )
        .first;
    if (text('Help Center').evaluate().isEmpty)
      await tester.scrollUntilVisible(
        text('Help Center'),
        300,
        scrollable: scroll,
        maxScrolls: 24,
      );
    await tapText('Help Center');
    if (expectLoaded)
      await wait(
        () =>
            find.byType(SupportConversationsScreen).evaluate().isNotEmpty &&
            text('New support request').evaluate().isNotEmpty,
      );
  }

  Future<void> openTicket(String id) async {
    for (
      var page = 0;
      page < 4 && text('Load older tickets').evaluate().isNotEmpty;
      page++
    ) {
      await tapText('Load older tickets');
      await wait(
        () => find
            .descendant(
              of: find.byType(SupportConversationsScreen),
              matching: find.byType(CircularProgressIndicator),
            )
            .evaluate()
            .isEmpty,
      );
    }
    final scroll = find
        .descendant(
          of: find.byType(SupportConversationsScreen),
          matching: find.byType(Scrollable),
        )
        .first;
    if (ticket(id).evaluate().isEmpty)
      await tester.scrollUntilVisible(
        ticket(id),
        350,
        scrollable: scroll,
        maxScrolls: 80,
      );
    await tester.ensureVisible(ticket(id));
    await tester.tap(ticket(id));
    await wait(() => find.byType(SupportChatScreen).evaluate().isNotEmpty);
  }

  Future<void> waitSendFailure() => wait(
    () =>
        find
            .byKey(const ValueKey('support-send-error'))
            .evaluate()
            .isNotEmpty &&
        text('Checking request…').evaluate().isEmpty,
  );
  Future<void> history(Map<String, dynamic> state) async {
    final token = auth.token!;
    final order = await context.read<BuyerOrdersApi>().get(
      token,
      state['order_a'] as String,
    );
    expect(order['id'] == state['order_a'], isTrue);
    await profile();
    await help();
    await openTicket(state['history_ticket'] as String);
    await wait(() => text('Load later messages').evaluate().isNotEmpty);
    await tapText('Load later messages');
    await wait(() => text('Load later messages').evaluate().isEmpty);
    String? cursor;
    final ids = <String>{};
    var pages = 0;
    do {
      final page = await api.listPublicMessagePage(
        token,
        state['history_ticket'] as String,
        limit: 100,
        cursor: cursor,
      );
      for (final row in page.items) {
        expect(row['body'] == _privateNote, isFalse);
        expect(ids.add(row['id'] as String), isTrue);
      }
      cursor = page.nextCursor;
      pages++;
      expect(pages <= 4, isTrue);
    } while (cursor != null);
    expect(ids.length == 205 && pages == 3, isTrue);
    await wait(
      () => find
          .byKey(ValueKey('support-message-${ids.last}'))
          .evaluate()
          .isNotEmpty,
    );
    expect(find.text(_privateNote).evaluate().isEmpty, isTrue);
    await control.post('public-history-verified', {
      'messages': ids.length,
      'pages': pages,
    });
  }

  Future<void> apiDenials(
    Map<String, dynamic> state,
    BuyerSupportCommand old,
  ) async {
    var foreignTicketDenied = false,
        foreignOrderDenied = false,
        oldCommandDenied = false;
    try {
      await api.listPublicMessages(
        auth.token!,
        state['created_ticket'] as String,
      );
    } on ApiException catch (e) {
      foreignTicketDenied = e.statusCode == 404 || e.statusCode == 403;
    }
    try {
      await context.read<BuyerOrdersApi>().get(
        auth.token!,
        state['order_a'] as String,
      );
    } on ApiException catch (e) {
      foreignOrderDenied = e.statusCode == 404 || e.statusCode == 403;
    }
    try {
      await commands.send(
        old,
        api,
        buyerId: auth.buyerId!,
        token: auth.token!,
        isCurrent: () => true,
      );
    } on ApiException catch (e) {
      oldCommandDenied = e.code == 'SUPPORT_CONTEXT_CHANGED';
    }
    expect(
      foreignTicketDenied && foreignOrderDenied && oldCommandDenied,
      isTrue,
    );
    await control.post('buyer-b-denials-verified');
  }
}
