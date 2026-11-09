// Real Customer/WhatsApp services and SDK contracts through a synthetic
// transport. These cases prove presentation lifetimes, not database/provider QA.
import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart' as foundation;
import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_models/letbuyy_models.dart' hide JsonMap;
import 'package:letbuyy_store/app/store_context.dart';
import 'package:letbuyy_store/screens/customers/customer_detail_task.dart';
import 'package:letbuyy_store/services/api_client.dart';
import 'package:letbuyy_store/services/customer_service.dart';
import 'package:letbuyy_store/services/whatsapp_service.dart';
import 'package:letbuyy_store/theme/store_theme.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart' as ui;
import 'package:provider/provider.dart';
import 'customer_create_presentation_test.dart' as create;
import 'customer_detail_presentation_test.dart' as detail;

const email = 'detail@example.invalid';
JsonMap addressRow() => {
  'id': 'synthetic-address',
  'store_id': create.site,
  'customer_email': email,
  'full_name': 'Synthetic address recipient',
  'customer_phone': '9000000098',
  'address_line1': 'Synthetic main street',
  'address_line2': null,
  'city': 'Chennai',
  'state': 'Tamil Nadu',
  'postal_code': '600001',
  'country': 'IN',
  'label': 'Work',
  'landmark': null,
  'is_default': false,
};

class TaskTransport extends detail.DetailTransport {
  TaskTransport() {
    row.addAll({
      'first_name': 'Synthetic',
      'last_name': 'Customer',
      'display_name': 'Synthetic Customer',
      'accepts_marketing': true,
      'notes': 'Original profile note',
    });
  }
  final mutations = <({String path, ApiRequestOptions options})>[];
  final addresses = <JsonMap>[], notes = <JsonMap>[], messages = <JsonMap>[];
  ApiException? mutationError;
  Completer<void>? holdMutation;
  int? readbackStatus;
  bool wrongAcknowledgement = false;
  @override
  Future<JsonMap> requestJson(String path, {ApiRequestOptions? options}) async {
    if ((options?.method ?? HttpMethod.get) != HttpMethod.get) {
      calls.add(options!);
      mutations.add((path: path, options: options));
      if (holdMutation != null) await holdMutation!.future;
      if (mutationError != null) throw mutationError!;
      final body = options.body is Map
          ? Map<String, dynamic>.from(options.body as Map)
          : <String, dynamic>{};
      JsonMap result;
      if (path.endsWith('/notes')) {
        result = {'id': 'synthetic-note', 'customer_email': email, ...body};
        notes.add(result);
      } else if (path.endsWith('/tags')) {
        row.addAll({'tags': body['tags']});
        result = Map.of(row);
      } else if (path.endsWith('/email')) {
        result = {'sent': true};
      } else if (path.endsWith('/merge')) {
        result = {
          'customer': {...row, 'email': body['target_email']},
        };
      } else if (path == '/whatsapp/send') {
        final message = {
          'id': 'synthetic-message',
          'store_id': create.site,
          'customer_email': email,
          'status': 'queued',
        };
        messages.add(message);
        result = {'message': message};
      } else if (path.contains('/addresses')) {
        if (options.method == HttpMethod.delete) {
          addresses.clear();
          result = {'deleted': true};
        } else {
          result = {
            ...addressRow(),
            if (addresses.isNotEmpty) ...addresses.first,
            ...body,
            'customer_email': email,
          };
          addresses
            ..clear()
            ..add(result);
        }
      } else if (options.method == HttpMethod.delete) {
        result = {'deleted': true};
      } else {
        row.addAll(body);
        row['display_name'] = '${row['first_name']} ${row['last_name']}';
        result = Map.of(row);
      }
      if (wrongAcknowledgement) result['store_id'] = 'wrong-owner';
      return result;
    }
    if (path == '/whatsapp/status') return {'available': true};
    if (mutations.isNotEmpty && readbackStatus != null)
      throw ApiException(
        message: 'Synthetic readback failure',
        statusCode: readbackStatus!,
        code: 'SYNTHETIC_READBACK',
      );
    if (path.endsWith('/target%40example.invalid'))
      return {...row, 'email': 'target@example.invalid'};
    return super.requestJson(path, options: options);
  }

  @override
  Future<T> requestData<T>(
    String path, {
    ApiRequestOptions? options,
    required JsonDecoder<T> decoder,
  }) async {
    reads.add(path);
    expect(options?.method ?? HttpMethod.get, HttpMethod.get);
    expect(options?.query?['store_id'], create.site);
    if (mutations.isNotEmpty && readbackStatus != null)
      throw ApiException(
        message: 'Synthetic readback failure',
        statusCode: readbackStatus!,
        code: 'SYNTHETIC_READBACK',
      );
    if (path.endsWith('/addresses')) return decoder(addresses);
    if (path.endsWith('/notes')) return decoder(notes);
    if (path == '/whatsapp/timeline') return decoder(messages);
    throw StateError('Unexpected synthetic task read');
  }
}

Future<
  ({
    create.CreateScope scope,
    CustomerService service,
    GlobalKey<NavigatorState> navigator,
    ValueNotifier<CustomerDetailTaskResult?> result,
  })
>
mountTask(
  WidgetTester tester,
  TaskTransport api,
  CustomerDetailTaskKind kind, {
  bool existingAddress = false,
  bool dark = false,
  double scale = 1,
  double inset = 0,
  Map<String, dynamic> variables = const {},
}) async {
  final scope = create.CreateScope(api),
      service = CustomerService(api: api),
      whatsApp = WhatsAppService(api: api),
      navigator = GlobalKey<NavigatorState>(),
      result = ValueNotifier<CustomerDetailTaskResult?>(null);
  final profile = await service.fetchCustomerByEmail(
    email,
    storeId: create.site,
  );
  if (existingAddress) api.addresses.add(addressRow());
  final address = existingAddress
      ? CustomerAddressContract.fromJson(addressRow())
      : null;
  addTearDown(scope.dispose);
  addTearDown(service.dispose);
  addTearDown(whatsApp.dispose);
  addTearDown(api.close);
  addTearDown(result.dispose);
  await tester.pumpWidget(
    MultiProvider(
      providers: [
        Provider<ApiClient>.value(value: api),
        ChangeNotifierProvider<StoreContext>.value(value: scope),
        ChangeNotifierProvider<CustomerService>.value(value: service),
        ChangeNotifierProvider<WhatsAppService>.value(value: whatsApp),
      ],
      child: MaterialApp(
        navigatorKey: navigator,
        theme: dark ? StoreTheme.dark() : StoreTheme.light(),
        builder: (context, child) => MediaQuery(
          data: MediaQuery.of(context).copyWith(
            textScaler: TextScaler.linear(scale),
            viewInsets: EdgeInsets.only(bottom: inset),
          ),
          child: child!,
        ),
        home: Builder(
          builder: (context) => Scaffold(
            body: Center(
              child: TextButton(
                child: const Text('Open task'),
                onPressed: () async {
                  var submitted = false;
                  final task = CustomerDetailTask(
                    kind: kind,
                    view: (key: 0, storeId: create.site),
                    customer: profile,
                    address: address,
                    firstName: 'Synthetic',
                    lastName: 'Customer',
                    whatsAppVariables: variables,
                    onSubmitted: () => submitted = true,
                    ownerCurrent: () =>
                        scope.requestContextKey == 0 &&
                        api.captureRequestContext() == 0,
                    canStart: () => service.hasFreshCustomer(profile),
                  );
                  if (task.isSheet) {
                    result.value = await ui
                        .showLetbuyyFormSheet<CustomerDetailTaskResult>(
                          context: context,
                          isDismissible: false,
                          builder: (_) => task,
                        );
                  } else if (task.isConfirmation) {
                    result.value = await showDialog<CustomerDetailTaskResult>(
                      context: context,
                      barrierDismissible: false,
                      builder: (_) => task,
                    );
                  } else {
                    result.value = await Navigator.of(context)
                        .push<CustomerDetailTaskResult>(
                          MaterialPageRoute(builder: (_) => task),
                        );
                  }
                  if (result.value == null &&
                      submitted &&
                      scope.requestContextKey == 0 &&
                      api.captureRequestContext() == 0) {
                    result.value = const CustomerDetailTaskResult();
                  }
                },
              ),
            ),
          ),
        ),
      ),
    ),
  );
  await tester.tap(find.text('Open task'));
  await tester.pumpAndSettle();
  return (scope: scope, service: service, navigator: navigator, result: result);
}

Finder field(String key) => find.descendant(
  of: find.byKey(Key('customer-task-$key')),
  matching: find.byType(TextFormField),
);
Future<void> enter(WidgetTester tester, String key, String value) async {
  await tester.ensureVisible(field(key));
  await tester.enterText(field(key), value);
  await tester.pump();
}

Future<void> action(WidgetTester tester, String text) async {
  await tester.ensureVisible(find.text(text).last);
  await tester.tap(find.text(text).last);
  await tester.pump();
}

Future<void> fillTask(WidgetTester tester, CustomerDetailTaskKind kind) async {
  switch (kind) {
    case CustomerDetailTaskKind.profile:
      await enter(tester, 'phone', ' 9000000001 ');
    case CustomerDetailTaskKind.address:
      for (final entry in {
        'full_name': ' Synthetic Recipient ',
        'address_line1': ' Synthetic street ',
        'city': ' Chennai ',
        'state': ' Tamil Nadu ',
        'postal_code': '600001',
      }.entries) {
        await enter(tester, entry.key, entry.value);
      }
    case CustomerDetailTaskKind.note:
      await enter(tester, 'note', ' Synthetic note ');
    case CustomerDetailTaskKind.tags:
      await enter(tester, 'tags', ' vip, wholesale, vip, , ');
    case CustomerDetailTaskKind.email:
      await enter(tester, 'subject', ' Synthetic subject ');
      await enter(tester, 'message', ' Synthetic email body ');
    case CustomerDetailTaskKind.whatsApp:
      await enter(tester, 'message', ' Synthetic customer message ');
    case CustomerDetailTaskKind.merge:
      await enter(tester, 'target_email', ' target@example.invalid ');
    case CustomerDetailTaskKind.deleteAddress || CustomerDetailTaskKind.redact:
      break;
  }
}

String submitLabel(CustomerDetailTaskKind kind) => switch (kind) {
  CustomerDetailTaskKind.email || CustomerDetailTaskKind.whatsApp => 'Send',
  CustomerDetailTaskKind.merge => 'Merge',
  CustomerDetailTaskKind.deleteAddress ||
  CustomerDetailTaskKind.redact => 'Delete',
  _ => 'Save',
};

void main() {
  testWidgets(
    'profile uses original trimmed values and fresh readback; Android Back returns its result',
    (tester) async {
      final api = TaskTransport();
      final host = await mountTask(tester, api, CustomerDetailTaskKind.profile);
      await fillTask(tester, CustomerDetailTaskKind.profile);
      await action(tester, 'Save');
      await tester.pumpAndSettle();
      expect(api.mutations.single.options.method, HttpMethod.patch);
      expect(api.mutations.single.options.query?['store_id'], create.site);
      expect((api.mutations.single.options.body as Map)['phone'], '9000000001');
      expect(find.text('Changes confirmed'), findsOneWidget);
      await tester.binding.handlePopRoute();
      await tester.pumpAndSettle();
      expect(find.text('Open task'), findsOneWidget);
      expect(host.result.value, isNotNull);
      expect(api.mutations, hasLength(1));
    },
  );
  testWidgets(
    'new address validates existing required fields and binds store and customer_phone',
    (tester) async {
      final api = TaskTransport();
      await mountTask(tester, api, CustomerDetailTaskKind.address);
      await enter(tester, 'label', 'Warehouse');
      await action(tester, 'Save');
      await tester.pumpAndSettle();
      expect(api.mutations, isEmpty);
      await fillTask(tester, CustomerDetailTaskKind.address);
      await enter(tester, 'customer_phone', ' 9000000099 ');
      await action(tester, 'Save');
      await tester.pumpAndSettle();
      final input = api.mutations.single.options.body as Map;
      expect(input['store_id'], create.site);
      expect(input['customer_phone'], '9000000099');
      expect(input.containsKey('phone'), isFalse);
      expect(input['full_name'], 'Synthetic Recipient');
      expect(input['country'], 'IN');
      expect(find.text('Changes confirmed'), findsOneWidget);
    },
  );
  testWidgets(
    'address edit keeps unsupported phone readonly and preserves unknown optional nulls',
    (tester) async {
      final api = TaskTransport();
      await mountTask(
        tester,
        api,
        CustomerDetailTaskKind.address,
        existingAddress: true,
      );
      expect(
        tester
            .widget<EditableText>(
              find.descendant(
                of: field('customer_phone'),
                matching: find.byType(EditableText),
              ),
            )
            .readOnly,
        isTrue,
      );
      await enter(tester, 'label', ' Office ');
      await action(tester, 'Save');
      await tester.pumpAndSettle();
      final input = api.mutations.single.options.body as Map;
      expect(input['label'], 'Office');
      expect(input.containsKey('phone'), isFalse);
      expect(input.containsKey('customer_phone'), isFalse);
      expect(input.containsKey('address_line2'), isFalse);
      expect(input.containsKey('landmark'), isFalse);
      expect(find.text('Changes confirmed'), findsOneWidget);
    },
  );
  testWidgets(
    'note sheet records once and matches its exact note ID in recent readback',
    (tester) async {
      final api = TaskTransport();
      await mountTask(tester, api, CustomerDetailTaskKind.note);
      expect(find.byType(ui.LetbuyyFormSheet), findsOneWidget);
      expect(find.byType(AlertDialog), findsNothing);
      await fillTask(tester, CustomerDetailTaskKind.note);
      await action(tester, 'Save');
      await tester.pumpAndSettle();
      expect(api.mutations.single.options.body, {
        'store_id': create.site,
        'note': 'Synthetic note',
      });
      expect(find.text('Changes confirmed'), findsOneWidget);
    },
  );
  testWidgets('tag sheet preserves the original ordered deduplication', (
    tester,
  ) async {
    final api = TaskTransport();
    await mountTask(tester, api, CustomerDetailTaskKind.tags);
    await fillTask(tester, CustomerDetailTaskKind.tags);
    await action(tester, 'Save');
    await tester.pumpAndSettle();
    expect(api.mutations.single.options.body, {
      'store_id': create.site,
      'tags': ['vip', 'wholesale'],
    });
    expect(find.text('Changes confirmed'), findsOneWidget);
  });
  testWidgets(
    'email editor distinguishes accepted request from delivery and does not offer resend',
    (tester) async {
      final api = TaskTransport();
      await mountTask(tester, api, CustomerDetailTaskKind.email);
      await fillTask(tester, CustomerDetailTaskKind.email);
      await action(tester, 'Send');
      await tester.pumpAndSettle();
      expect(api.mutations.single.options.body, {
        'store_id': create.site,
        'subject': 'Synthetic subject',
        'message': 'Synthetic email body',
      });
      expect(find.text('Email request accepted'), findsOneWidget);
      expect(
        find.textContaining('Inbox delivery has not been verified'),
        findsOneWidget,
      );
      expect(find.text('Send'), findsNothing);
      expect(find.text('Check saved changes'), findsNothing);
    },
  );
  testWidgets(
    'WhatsApp preserves SDK operation identity and never implies delivery',
    (tester) async {
      final api = TaskTransport();
      await mountTask(tester, api, CustomerDetailTaskKind.whatsApp);
      expect(
        tester.widget<TextFormField>(field('message')).controller!.text,
        isEmpty,
      );
      await fillTask(tester, CustomerDetailTaskKind.whatsApp);
      await action(tester, 'Send');
      await tester.pumpAndSettle();
      final input = api.mutations.single.options.body as Map;
      expect(input['template'], 'custom_message');
      expect(input['message'], 'Synthetic customer message');
      expect(input['idempotency_key'], startsWith('wa_'));
      expect(input['variables'], isEmpty);
      expect(find.text('Changes confirmed'), findsOneWidget);
      expect(
        find.textContaining('timeline for delivery updates'),
        findsOneWidget,
      );
    },
  );
  testWidgets(
    'merge sheet preserves the exact target and returns acknowledged destination without adopting it',
    (tester) async {
      final api = TaskTransport();
      final host = await mountTask(tester, api, CustomerDetailTaskKind.merge);
      await fillTask(tester, CustomerDetailTaskKind.merge);
      await action(tester, 'Merge');
      await tester.pumpAndSettle();
      expect(api.mutations.single.options.body, {
        'store_id': create.site,
        'target_email': 'target@example.invalid',
      });
      await action(tester, 'Done');
      await tester.pumpAndSettle();
      expect(host.result.value?.mergedInto, 'target@example.invalid');
    },
  );
  testWidgets(
    'address delete stays in canonical confirmation until exact-ID readback',
    (tester) async {
      final api = TaskTransport();
      await mountTask(
        tester,
        api,
        CustomerDetailTaskKind.deleteAddress,
        existingAddress: true,
      );
      expect(find.byType(ui.LetbuyyConfirmation), findsOneWidget);
      await action(tester, 'Delete');
      await tester.pumpAndSettle();
      expect(
        api.mutations.single.path,
        '/customers/detail%40example.invalid/addresses/synthetic-address',
      );
      expect(find.text('Changes confirmed'), findsOneWidget);
    },
  );
  testWidgets(
    'redaction confirmation reports acknowledgement without claiming downstream erasure',
    (tester) async {
      final api = TaskTransport();
      final host = await mountTask(tester, api, CustomerDetailTaskKind.redact);
      await action(tester, 'Delete');
      await tester.pumpAndSettle();
      expect(find.text('Redaction request acknowledged'), findsOneWidget);
      expect(
        find.textContaining('Removal from connected services'),
        findsOneWidget,
      );
      expect(find.text('Changes confirmed'), findsNothing);
      await action(tester, 'Done');
      await tester.pumpAndSettle();
      expect(host.result.value?.redacted, isTrue);
    },
  );
  for (final kind in CustomerDetailTaskKind.values) {
    testWidgets(
      '$kind lost response preserves draft and never creates a second command',
      (tester) async {
        final api = TaskTransport()
          ..mutationError = const ApiException(
            message: 'Synthetic lost reply',
            statusCode: 503,
            code: 'SYNTHETIC_LOST',
          );
        await mountTask(
          tester,
          api,
          kind,
          existingAddress: kind == CustomerDetailTaskKind.deleteAddress,
        );
        await fillTask(tester, kind);
        await action(tester, submitLabel(kind));
        await tester.pumpAndSettle();
        expect(api.mutations, hasLength(1));
        expect(find.text('Outcome unconfirmed'), findsOneWidget);
        expect(find.text(submitLabel(kind)), findsNothing);
        await action(tester, 'Close and review');
        await tester.pumpAndSettle();
        await action(tester, 'Leave and review');
        await tester.pumpAndSettle();
        expect(find.text('Open task'), findsOneWidget);
        expect(api.mutations, hasLength(1));
      },
    );
  }
  testWidgets(
    'readback failure permits only GET recheck after accepted write',
    (tester) async {
      final api = TaskTransport()..readbackStatus = 503;
      await mountTask(tester, api, CustomerDetailTaskKind.note);
      await fillTask(tester, CustomerDetailTaskKind.note);
      await action(tester, 'Save');
      await tester.pumpAndSettle();
      expect(find.text('Request acknowledged'), findsOneWidget);
      expect(find.text('Latest details unavailable'), findsOneWidget);
      expect(api.mutations, hasLength(1));
      api.readbackStatus = null;
      await action(tester, 'Check saved changes');
      await tester.pumpAndSettle();
      expect(find.text('Changes confirmed'), findsOneWidget);
      expect(api.mutations, hasLength(1));
    },
  );
  testWidgets(
    'dirty sheet Android Back keeps draft or discards without a command',
    (tester) async {
      final api = TaskTransport();
      await mountTask(tester, api, CustomerDetailTaskKind.note);
      await enter(tester, 'note', 'Synthetic unsaved note');
      await tester.binding.handlePopRoute();
      await tester.pumpAndSettle();
      expect(find.text('Discard changes?'), findsOneWidget);
      await action(tester, 'Cancel');
      await tester.pumpAndSettle();
      expect(
        tester.widget<TextFormField>(field('note')).controller!.text,
        'Synthetic unsaved note',
      );
      await tester.binding.handlePopRoute();
      await tester.pumpAndSettle();
      await action(tester, 'Discard changes');
      await tester.pumpAndSettle();
      expect(find.text('Open task'), findsOneWidget);
      expect(api.mutations, isEmpty);
    },
  );
  testWidgets(
    'owner change hides private draft and captured Save cannot write',
    (tester) async {
      final api = TaskTransport();
      final host = await mountTask(tester, api, CustomerDetailTaskKind.note);
      await enter(tester, 'note', 'Synthetic private draft');
      final save = tester
          .widget<FilledButton>(find.widgetWithText(FilledButton, 'Save'))
          .onPressed!;
      host.scope.retire();
      save();
      await tester.pumpAndSettle();
      expect(find.text('Customer access unconfirmed'), findsOneWidget);
      expect(find.text('Synthetic private draft'), findsNothing);
      expect(api.mutations, isEmpty);
    },
  );
  testWidgets(
    'observed denial retires open draft after a later fresh primary grant',
    (tester) async {
      final api = TaskTransport();
      final host = await mountTask(tester, api, CustomerDetailTaskKind.note);
      await enter(tester, 'note', 'Synthetic private draft');
      api.profileStatus = 403;
      await expectLater(
        host.service.fetchCustomerByEmail(email, storeId: create.site),
        throwsA(isA<ApiException>()),
      );
      api.profileStatus = null;
      await host.service.fetchCustomerByEmail(email, storeId: create.site);
      await tester.pumpAndSettle();
      expect(find.text('Customer access unconfirmed'), findsOneWidget);
      expect(field('note'), findsNothing);
      expect(api.mutations, isEmpty);
    },
  );
  testWidgets(
    'pending request blocks Back and repeated captured Save; covered route cannot be popped by acknowledgement',
    (tester) async {
      final api = TaskTransport(), held = Completer<void>();
      api.holdMutation = held;
      final host = await mountTask(tester, api, CustomerDetailTaskKind.note);
      try {
        await enter(tester, 'note', 'Synthetic held note');
        final save = tester
            .widget<FilledButton>(find.widgetWithText(FilledButton, 'Save'))
            .onPressed!;
        save();
        await tester.pump();
        save();
        await tester.binding.handlePopRoute();
        await tester.pump();
        expect(find.text('Submitting request…'), findsOneWidget);
        expect(api.mutations, hasLength(1));
        unawaited(
          host.navigator.currentState!.push(
            MaterialPageRoute<void>(
              builder: (_) =>
                  const Scaffold(body: Text('Covering destination')),
            ),
          ),
        );
        await tester.pumpAndSettle();
        held.complete();
        await tester.pumpAndSettle();
        expect(find.text('Covering destination'), findsOneWidget);
        expect(host.result.value, isNull);
        expect(api.mutations, hasLength(1));
        host.navigator.currentState!.pop();
        await tester.pumpAndSettle();
        expect(find.text('Request acknowledged'), findsOneWidget);
        await action(tester, 'Check saved changes');
        await tester.pumpAndSettle();
        expect(find.text('Changes confirmed'), findsOneWidget);
      } finally {
        if (!held.isCompleted) held.complete();
        await tester.pumpAndSettle();
      }
    },
  );
  testWidgets(
    'exact pre-handler validation rejection retains editable draft and permits corrected intent',
    (tester) async {
      final api = TaskTransport()
        ..mutationError = const ApiException(
          message: 'Synthetic validation',
          statusCode: 400,
          code: 'VALIDATION_ERROR',
        );
      await mountTask(tester, api, CustomerDetailTaskKind.note);
      await fillTask(tester, CustomerDetailTaskKind.note);
      await action(tester, 'Save');
      await tester.pumpAndSettle();
      expect(find.text('Input rejected'), findsOneWidget);
      api.mutationError = null;
      await enter(tester, 'note', 'Corrected synthetic note');
      await action(tester, 'Save');
      await tester.pumpAndSettle();
      expect(api.mutations, hasLength(2));
      expect(find.text('Changes confirmed'), findsOneWidget);
    },
  );
  testWidgets(
    'actual Detail profile editor saves once, reads fresh, and reopens the same customer',
    (tester) async {
      final api = TaskTransport();
      await detail.mountDetail(tester, api);
      await tester.pumpAndSettle();
      await tester.tap(find.byTooltip('Edit customer'));
      await tester.pumpAndSettle();
      expect(find.byType(ui.LetbuyyEditorScaffold), findsOneWidget);
      await enter(tester, 'phone', '9000000001');
      await action(tester, 'Save');
      await tester.pumpAndSettle();
      expect(find.text('Changes confirmed'), findsOneWidget);
      await action(tester, 'Done');
      await tester.pumpAndSettle();
      expect(find.byType(CustomerDetailTask), findsNothing);
      expect(find.text('9000000001'), findsWidgets);
      expect(api.mutations, hasLength(1));
      expect(
        api.reads
            .where((p) => p == '/customers/detail%40example.invalid')
            .length,
        greaterThanOrEqualTo(3),
      );
    },
  );
  testWidgets(
    'actual Detail note sheet returns to fresh profile and exact note',
    (tester) async {
      final api = TaskTransport();
      await detail.mountDetail(tester, api);
      await tester.pumpAndSettle();
      await detail.revealDetail(tester, find.text('Add note'));
      await tester.tap(find.text('Add note'));
      await tester.pumpAndSettle();
      expect(find.byType(ui.LetbuyyFormSheet), findsOneWidget);
      await fillTask(tester, CustomerDetailTaskKind.note);
      await action(tester, 'Save');
      await tester.pumpAndSettle();
      await action(tester, 'Done');
      await tester.pumpAndSettle();
      await detail.revealDetail(tester, find.text('Synthetic note'));
      expect(find.text('Synthetic note'), findsOneWidget);
      expect(api.mutations, hasLength(1));
    },
  );
  testWidgets(
    'actual Detail address editor binds the resource and reopens its persisted view',
    (tester) async {
      final api = TaskTransport();
      await detail.mountDetail(tester, api);
      await tester.pumpAndSettle();
      await detail.revealDetail(tester, find.text('Add address'));
      await tester.tap(find.text('Add address'));
      await tester.pumpAndSettle();
      await fillTask(tester, CustomerDetailTaskKind.address);
      await action(tester, 'Save');
      await tester.pumpAndSettle();
      await action(tester, 'Done');
      await tester.pumpAndSettle();
      await detail.revealDetail(tester, find.text('Edit address'));
      expect(find.textContaining('Synthetic Recipient'), findsOneWidget);
      expect(api.mutations, hasLength(1));
    },
  );
  testWidgets(
    'actual Detail unconfirmed save closes to reads only without a success claim',
    (tester) async {
      final api = TaskTransport()
        ..mutationError = const ApiException(
          message: 'Synthetic lost reply',
          statusCode: 503,
          code: 'SYNTHETIC_LOST',
        );
      await detail.mountDetail(tester, api);
      await tester.pumpAndSettle();
      await tester.tap(find.byTooltip('Edit customer'));
      await tester.pumpAndSettle();
      await enter(tester, 'phone', '9000000001');
      await action(tester, 'Save');
      await tester.pumpAndSettle();
      await action(tester, 'Close and review');
      await tester.pumpAndSettle();
      await action(tester, 'Leave and review');
      await tester.pumpAndSettle();
      expect(find.byType(CustomerDetailTask), findsNothing);
      expect(api.mutations, hasLength(1));
      expect(find.text('Customer updated'), findsNothing);
      expect(find.text('9000000098'), findsWidgets);
    },
  );
  testWidgets(
    'actual Detail does not convert an email fallback into an editable name or missing marketing into false',
    (tester) async {
      final api = TaskTransport();
      api.row.addAll({
        'first_name': null,
        'last_name': null,
        'display_name': email,
        'accepts_marketing': null,
        'notes': null,
      });
      await detail.mountDetail(tester, api);
      await tester.pumpAndSettle();
      await tester.tap(find.byTooltip('Edit customer'));
      await tester.pumpAndSettle();
      expect(
        tester.widget<TextFormField>(field('first_name')).controller!.text,
        isEmpty,
      );
      await enter(tester, 'phone', '9000000001');
      await action(tester, 'Save');
      await tester.pumpAndSettle();
      final input = api.mutations.single.options.body as Map;
      for (final key in [
        'first_name',
        'last_name',
        'notes',
        'accepts_marketing',
      ]) {
        expect(input.containsKey(key), isFalse);
      }
    },
  );
  testWidgets(
    'partial raw name fields are not mixed with inferred display-name parts',
    (tester) async {
      final api = TaskTransport();
      api.row.addAll({
        'first_name': 'Synthetic multi word',
        'last_name': null,
        'display_name': 'Synthetic multi word Display',
      });
      await detail.mountDetail(tester, api);
      await tester.pumpAndSettle();
      await tester.tap(find.byTooltip('Edit customer'));
      await tester.pumpAndSettle();
      expect(
        tester.widget<TextFormField>(field('first_name')).controller!.text,
        'Synthetic multi word',
      );
      expect(
        tester.widget<TextFormField>(field('last_name')).controller!.text,
        isEmpty,
      );
      await enter(tester, 'phone', '9000000001');
      await action(tester, 'Save');
      await tester.pumpAndSettle();
      final input = api.mutations.single.options.body as Map;
      expect(input['first_name'], 'Synthetic multi word');
      expect(input.containsKey('last_name'), isFalse);
    },
  );
  testWidgets(
    'actual WhatsApp composer exposes missing cart authority and sends only real view variables',
    (tester) async {
      final api = TaskTransport();
      final service = WhatsAppService(api: api);
      addTearDown(service.dispose);
      await detail.mountDetail(tester, api, whatsApp: service);
      await tester.pumpAndSettle();
      await tester.tap(find.byTooltip('WhatsApp customer'));
      await tester.pumpAndSettle();
      await tester.tap(find.byType(DropdownButtonFormField<String>));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Abandoned cart').last);
      await tester.pumpAndSettle();
      expect(find.text('Template unavailable'), findsOneWidget);
      expect(
        tester
            .widget<FilledButton>(find.widgetWithText(FilledButton, 'Send'))
            .onPressed,
        isNull,
      );
      await tester.tap(find.byType(DropdownButtonFormField<String>));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Custom message').last);
      await tester.pumpAndSettle();
      await enter(tester, 'message', 'Synthetic message');
      await action(tester, 'Send');
      await tester.pumpAndSettle();
      final input = api.mutations.single.options.body as Map;
      expect(input['variables'], {
        'customer_name': 'Synthetic Customer',
        'store_name': 'Synthetic store',
      });
      expect(
        find.textContaining('timeline for delivery updates'),
        findsOneWidget,
      );
    },
  );
  testWidgets(
    'wrong-store acknowledgement becomes unconfirmed and cannot enable a fresh save',
    (tester) async {
      final api = TaskTransport()..wrongAcknowledgement = true;
      await mountTask(tester, api, CustomerDetailTaskKind.note);
      await fillTask(tester, CustomerDetailTaskKind.note);
      await action(tester, 'Save');
      await tester.pumpAndSettle();
      expect(find.text('Outcome unconfirmed'), findsOneWidget);
      expect(find.text('Save'), findsNothing);
      expect(api.mutations, hasLength(1));
    },
  );
  testWidgets(
    'silent API context retirement is rechecked by a captured submit action',
    (tester) async {
      final api = TaskTransport();
      await mountTask(tester, api, CustomerDetailTaskKind.note);
      await fillTask(tester, CustomerDetailTaskKind.note);
      final save = tester
          .widget<FilledButton>(find.widgetWithText(FilledButton, 'Save'))
          .onPressed!;
      api.epoch++;
      save();
      await tester.pumpAndSettle();
      expect(api.mutations, isEmpty);
      expect(find.text('Customer access unconfirmed'), findsOneWidget);
    },
  );

  for (final acknowledged in [false, true])
    testWidgets(
      'clean iOS edge pop returns correctly after acknowledged$acknowledged task',
      (tester) async {
        final api = TaskTransport();
        final host = await mountTask(
          tester,
          api,
          CustomerDetailTaskKind.profile,
        );
        if (acknowledged) {
          await fillTask(tester, CustomerDetailTaskKind.profile);
          await action(tester, 'Save');
          await tester.pumpAndSettle();
        }
        final size = tester.view.physicalSize / tester.view.devicePixelRatio;
        await tester.timedDragFrom(
          Offset(1, size.height / 2),
          Offset(size.width * .85, 0),
          const Duration(milliseconds: 500),
        );
        await tester.pumpAndSettle();
        expect(find.text('Open task'), findsOneWidget);
        expect(api.mutations.length, acknowledged ? 1 : 0);
        expect(host.result.value != null, acknowledged);
      },
      variant: TargetPlatformVariant.only(foundation.TargetPlatform.iOS),
    );

  testWidgets(
    'dirty iOS task keeps its draft when edge swipe is unavailable',
    (tester) async {
      final api = TaskTransport();
      await mountTask(tester, api, CustomerDetailTaskKind.profile);
      await fillTask(tester, CustomerDetailTaskKind.profile);
      final size = tester.view.physicalSize / tester.view.devicePixelRatio;
      await tester.timedDragFrom(
        Offset(1, size.height / 2),
        Offset(size.width * .85, 0),
        const Duration(milliseconds: 500),
      );
      await tester.pumpAndSettle();
      expect(find.byType(CustomerDetailTask), findsOneWidget);
      expect(
        tester.widget<TextFormField>(field('phone')).controller!.text,
        ' 9000000001 ',
      );
      expect(api.mutations, isEmpty);
    },
    variant: TargetPlatformVariant.only(foundation.TargetPlatform.iOS),
  );
  testWidgets(
    'actual Detail clean iOS return after save refreshes the originating customer without another command',
    (tester) async {
      final api = TaskTransport();
      await detail.mountDetail(tester, api);
      await tester.pumpAndSettle();
      await tester.tap(find.byTooltip('Edit customer'));
      await tester.pumpAndSettle();
      await enter(tester, 'phone', '9000000001');
      await action(tester, 'Save');
      await tester.pumpAndSettle();
      final size = tester.view.physicalSize / tester.view.devicePixelRatio;
      await tester.timedDragFrom(
        Offset(1, size.height / 2),
        Offset(size.width * .85, 0),
        const Duration(milliseconds: 500),
      );
      await tester.pumpAndSettle();
      expect(find.byType(CustomerDetailTask), findsNothing);
      expect(find.text('9000000001'), findsWidgets);
      expect(api.mutations, hasLength(1));
      expect(
        api.reads
            .where((p) => p == '/customers/detail%40example.invalid')
            .length,
        greaterThanOrEqualTo(3),
      );
    },
    variant: TargetPlatformVariant.only(foundation.TargetPlatform.iOS),
  );

  for (final dark in [false, true])
    testWidgets(
      'saved task feedback keeps first floating label clear in dark$dark',
      (tester) async {
        final api = TaskTransport();
        await mountTask(
          tester,
          api,
          CustomerDetailTaskKind.profile,
          dark: dark,
        );
        await fillTask(tester, CustomerDetailTaskKind.profile);
        await action(tester, 'Save');
        await tester.pumpAndSettle();
        final feedback = find.ancestor(
          of: find.text('Changes confirmed'),
          matching: find.byType(ui.LetbuyyInlineFeedback),
        );
        await tester.ensureVisible(find.text('First name'));
        await tester.pumpAndSettle();
        expect(
          tester.getRect(find.text('First name')).top,
          greaterThanOrEqualTo(tester.getRect(feedback).bottom),
        );
        expect(api.mutations, hasLength(1));
      },
    );

  for (final kind in [
    CustomerDetailTaskKind.profile,
    CustomerDetailTaskKind.address,
    CustomerDetailTaskKind.email,
    CustomerDetailTaskKind.whatsApp,
  ]) {
    for (final dark in [false, true])
      testWidgets(
        '$kind full-page last input and action remain reachable at320dp scale2.4 with keyboard inset dark$dark',
        (tester) async {
          tester.view.physicalSize = const Size(320, 700);
          tester.view.devicePixelRatio = 1;
          addTearDown(tester.view.resetPhysicalSize);
          addTearDown(tester.view.resetDevicePixelRatio);
          final api = TaskTransport();
          await mountTask(
            tester,
            api,
            kind,
            dark: dark,
            scale: 2.4,
            inset: 300,
          );
          final key = switch (kind) {
            CustomerDetailTaskKind.profile => 'notes',
            CustomerDetailTaskKind.address => 'label',
            _ => 'message',
          };
          await enter(tester, key, 'Synthetic keyboard fixture');
          expect(tester.takeException(), isNull);
          await tester.ensureVisible(
            find.widgetWithText(FilledButton, submitLabel(kind)),
          );
          final rect = tester.getRect(
            find.widgetWithText(FilledButton, submitLabel(kind)),
          );
          expect(rect.bottom, lessThanOrEqualTo(400));
          expect(rect.top, greaterThanOrEqualTo(0));
          expect(api.mutations, isEmpty);
        },
      );
  }

  for (final dark in [false, true])
    testWidgets('short task sheet wraps at320dp scale2.4 dark$dark', (
      tester,
    ) async {
      tester.view.physicalSize = const Size(320, 700);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final api = TaskTransport();
      await mountTask(
        tester,
        api,
        CustomerDetailTaskKind.note,
        dark: dark,
        scale: 2.4,
      );
      await enter(tester, 'note', 'Synthetic large-text note');
      await action(tester, 'Save');
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
      expect(api.mutations, hasLength(1));
    });
}
