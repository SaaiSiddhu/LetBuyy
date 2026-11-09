// Canonical screen UI through existing ProductService/shared SDK. The fixture
// cannot qualify SQL, hosted access or persisted web/mobile synchronization.
import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:letbuyy_store/app/store_context.dart';
import 'package:letbuyy_store/models/store_model.dart';
import 'package:letbuyy_store/screens/products/collections_screen.dart';
import 'package:letbuyy_store/screens/products/collection_membership_screen.dart';
import 'package:letbuyy_store/services/api_client.dart';
import 'package:letbuyy_store/services/product_service.dart';
import 'package:letbuyy_store/services/security_command_store.dart';
import 'package:letbuyy_store/services/store_service.dart';
import 'package:letbuyy_store/theme/store_theme.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'collection_membership_recovery_test.dart' as membership;
import 'support/loyalty_fixture.dart' show MemoryStorage;

class CollectionTransport extends membership.Transport {
  final fixture =
      jsonDecode(
            File(
              '../../../tests/fixtures/collection-metadata-contracts.json',
            ).readAsStringSync(),
          )
          as JsonMap;
  Completer<JsonMap>? heldMembership;
  JsonMap get manual => {
    ...asJsonMap(fixture['row']),
    'id': membership.collection,
    'store_id': membership.site,
    'collection_type': 'manual',
    'title': 'Synthetic collection',
    'version': 3,
    'is_active': true,
    'conditions': [],
  };
  final queries = <({String path, JsonMap query})>[];
  final reads = <({String path, ApiRequestOptions? options})>[];
  final metadataWrites = <ApiRequestOptions>[];
  Completer<PaginatedResponse<JsonMap>>? heldPage;
  Completer<JsonMap>? heldPreview;
  JsonMap get smart => {
    ...asJsonMap(fixture['smart']),
    'id': membership.collection,
    'store_id': membership.site,
    'version': 8,
  };
  PaginatedResponse<JsonMap> smartPage() => PaginatedResponse(
    data: [smart],
    page: 1,
    limit: 20,
    total: 1,
    hasMore: false,
    meta: {
      ...asJsonMap(asJsonMap(fixture['page'])['meta']),
      'store_id': membership.site,
    },
  );
  @override
  Future<PaginatedResponse<JsonMap>> requestPaginatedJson(
    String path, {
    ApiRequestOptions? options,
  }) async {
    if (path == '/products/collections' || path == '/smart-collections')
      queries.add((
        path: path,
        query: Map<String, dynamic>.from(options?.query ?? {}),
      ));
    if (path == '/smart-collections')
      return heldPage != null ? heldPage!.future : smartPage();
    return super.requestPaginatedJson(path, options: options);
  }

  @override
  Future<JsonMap> requestJson(String path, {ApiRequestOptions? options}) async {
    if (options?.method != null &&
        options?.method != HttpMethod.get &&
        path.startsWith('/smart-collections')) {
      metadataWrites.add(options!);
      throw const ApiException(
        message: 'Synthetic unconfirmed metadata reply',
        statusCode: 503,
        code: 'SYNTHETIC_UNCONFIRMED',
      );
    }
    reads.add((path: path, options: options));
    if (path == '/products/collections/${membership.collection}') return manual;
    if (path == '/smart-collections/${membership.collection}') return smart;
    if (path == '/smart-collections/${membership.collection}/preview') {
      if (heldPreview != null) return heldPreview!.future;
      return {
        ...asJsonMap(fixture['preview']),
        'store_id': membership.site,
        'collection_id': membership.collection,
        'collection_version': 8,
      };
    }
    if (path == '/products/collections/${membership.collection}/products' &&
        heldMembership != null)
      return heldMembership!.future;
    return super.requestJson(path, options: options);
  }
}

class Selection extends StoreContext {
  Selection(ApiClient api) : super(storeService: StoreService(api: api));
  int epoch = 0;
  @override
  Object get requestContextKey => epoch;
  @override
  String get selectedStoreId => membership.site;
  @override
  Future<StoreModel?> ensureSelectedStore({bool force = false}) async => null;
  void retire() {
    epoch++;
    notifyListeners();
  }
}

class TrackingCommands extends SecurityCommandStore {
  TrackingCommands() : super(storage: MemoryStorage());
  final reads = <String>[];
  @override
  Future<PendingSecurityCommand?> read(
    MerchantSecurityContext context,
    String command, {
    required void Function() check,
  }) {
    reads.add(command);
    return super.read(context, command, check: check);
  }
}

Future<
  ({
    Selection scope,
    ProductService products,
    CollectionTransport api,
    TrackingCommands commands,
  })
>
mountCollections(
  WidgetTester tester, {
  bool dark = false,
  double scale = 1,
  bool member = false,
  CollectionTransport? transport,
}) async {
  SharedPreferences.setMockInitialValues({});
  final api = transport ?? CollectionTransport(), scope = Selection(api);
  final commands = TrackingCommands();
  final products = ProductService(
    api: api,
    actorIdProvider: () => membership.actor,
    storeIdProvider: () => membership.site,
    commands: commands,
  );
  addTearDown(api.close);
  addTearDown(scope.dispose);
  addTearDown(products.dispose);
  await tester.pumpWidget(
    MultiProvider(
      providers: [
        ChangeNotifierProvider<StoreContext>.value(value: scope),
        ChangeNotifierProvider<ProductService>.value(value: products),
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
        home: member
            ? const CollectionMembershipScreen(
                storeId: membership.site,
                collectionId: membership.collection,
              )
            : const CollectionsScreen(),
      ),
    ),
  );
  await tester.pumpAndSettle();
  return (scope: scope, products: products, api: api, commands: commands);
}

Future<void> chooseCollectionValue(
  WidgetTester tester,
  String label,
  String value,
) async {
  final field = find.widgetWithText(OutlinedButton, label);
  await revealCollectionControl(tester, field);
  await tester.tap(field);
  await tester.pumpAndSettle();
  final option = find.widgetWithText(RadioListTile<String>, value);
  await tester.ensureVisible(option);
  await tester.pumpAndSettle();
  await tester.tap(option);
  await tester.pumpAndSettle();
  await tester.tap(find.widgetWithText(FilledButton, 'Apply selection'));
  await tester.pumpAndSettle();
}

Future<void> revealCollectionControl(WidgetTester tester, Finder target) async {
  if (target.evaluate().isEmpty) {
    final scroll = find
        .descendant(
          of: find.byType(ListView).last,
          matching: find.byType(Scrollable),
        )
        .first;
    tester.state<ScrollableState>(scroll).position.jumpTo(0);
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(
      target,
      160,
      scrollable: scroll,
      maxScrolls: 60,
    );
  }
  await tester.ensureVisible(target);
  await tester.pumpAndSettle();
}

Future<void> openSmartEditor(WidgetTester tester) async {
  await chooseCollectionValue(tester, 'Collection type: Manual', 'Smart');
  await tester.tap(find.text('Synthetic collection'));
  await tester.pumpAndSettle();
  expect(find.byType(LetbuyyEditorScaffold), findsOneWidget);
}

void main() {
  setUpAll(initializeLetbuyyTypography);
  testWidgets(
    'collection type and search use original server scope only after Apply',
    (tester) async {
      final h = await mountCollections(tester);
      expect(h.api.queries, hasLength(1));
      final type = find.widgetWithText(
        OutlinedButton,
        'Collection type: Manual',
      );
      await tester.tap(type);
      await tester.pumpAndSettle();
      await tester.tap(find.widgetWithText(RadioListTile<String>, 'Smart'));
      await tester.pumpAndSettle();
      expect(h.api.queries, hasLength(1));
      await tester.tap(find.text('Cancel'));
      await tester.pumpAndSettle();
      expect(h.api.queries, hasLength(1));
      await chooseCollectionValue(tester, 'Collection type: Manual', 'Smart');
      expect(h.api.queries.last.path, '/smart-collections');
      expect(h.api.queries.last.query, {
        'store_id': membership.site,
        'page': 1,
        'limit': 20,
      });
      final search = find.widgetWithText(TextFormField, 'Search collections');
      await tester.enterText(search, '  Private smart phrase  ');
      expect(h.api.queries, hasLength(2));
      await tester.tap(find.widgetWithText(TextButton, 'Search'));
      await tester.pumpAndSettle();
      expect(h.api.queries.last.query, {
        'store_id': membership.site,
        'page': 1,
        'limit': 20,
        'search': 'Private smart phrase',
      });
      expect(find.text('Results for “Private smart phrase”'), findsOneWidget);
      expect(h.api.writes, isEmpty);
      await tester.pumpWidget(const SizedBox.shrink());
    },
  );
  testWidgets(
    'captured collection refresh cannot start another query while the current read is pending',
    (tester) async {
      final h = await mountCollections(tester);
      final refresh = tester
          .widget<IconButton>(
            find.byWidgetPredicate(
              (widget) =>
                  widget is IconButton &&
                  widget.tooltip == 'Refresh collections',
            ),
          )
          .onPressed!;
      final response = h.api.smartPage();
      h.api.heldPage = Completer<PaginatedResponse<JsonMap>>();
      final type = find.widgetWithText(
        OutlinedButton,
        'Collection type: Manual',
      );
      await tester.tap(type);
      await tester.pumpAndSettle();
      await tester.tap(find.widgetWithText(RadioListTile<String>, 'Smart'));
      await tester.pumpAndSettle();
      await tester.tap(find.widgetWithText(FilledButton, 'Apply selection'));
      await tester.pump();
      await tester.pump();
      expect(h.api.queries, hasLength(2));
      refresh();
      await tester.pump();
      expect(h.api.queries, hasLength(2));
      h.api.heldPage!.complete(response);
      await tester.pumpAndSettle();
      expect(h.api.queries, hasLength(2));
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox.shrink());
    },
  );
  testWidgets(
    'same-query collection refresh retains its labelled data with visible shell progress',
    (tester) async {
      final h = await mountCollections(tester);
      await chooseCollectionValue(tester, 'Collection type: Manual', 'Smart');
      final response = h.api.smartPage();
      h.api.heldPage = Completer<PaginatedResponse<JsonMap>>();
      await tester.tap(find.byTooltip('Refresh collections'));
      await tester.pump();
      await tester.pump();
      expect(find.text('Synthetic collection'), findsOneWidget);
      expect(
        find.text(
          'Previously loaded results are shown. Refresh to check the current data.',
        ),
        findsOneWidget,
      );
      final progress = tester.getRect(find.text('Updating collections…'));
      final list = tester.getRect(find.byType(ListView));
      expect(progress.bottom, lessThanOrEqualTo(list.top));
      expect(progress.top, greaterThanOrEqualTo(0));
      h.api.heldPage!.complete(response);
      await tester.pumpAndSettle();
      expect(find.text('Updating collections…'), findsNothing);
      expect(h.api.queries, hasLength(3));
      await tester.pumpWidget(const SizedBox.shrink());
    },
  );
  testWidgets(
    'retired membership load cannot start the next private recovery read',
    (tester) async {
      final transport = CollectionTransport()
        ..heldMembership = Completer<JsonMap>();
      final h = await mountCollections(
        tester,
        member: true,
        transport: transport,
      );
      expect(find.text('Loading collection products…'), findsOneWidget);
      expect(h.commands.reads, isEmpty);
      h.scope.retire();
      await tester.pumpAndSettle();
      transport.heldMembership!.complete(membership.snapshot());
      await tester.pumpAndSettle();
      expect(h.commands.reads, isEmpty);
      expect(find.textContaining('Store access changed.'), findsOneWidget);
      expect(find.textContaining('Cotton tote'), findsNothing);
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox.shrink());
    },
  );
  testWidgets(
    'removing an earlier smart rule preserves the remaining native text draft',
    (tester) async {
      final h = await mountCollections(tester);
      await openSmartEditor(tester);
      final add = find.widgetWithText(TextButton, 'Add condition');
      await revealCollectionControl(tester, add);
      await tester.tap(add);
      await tester.pumpAndSettle();
      final second = find.widgetWithText(TextFormField, 'Rule 2 value');
      await revealCollectionControl(tester, second);
      await tester.enterText(second, 'Second private rule');
      final removeFirst = find.widgetWithText(TextButton, 'Remove rule 1');
      await revealCollectionControl(tester, removeFirst);
      await tester.tap(removeFirst);
      await tester.pumpAndSettle();
      final remaining = find.widgetWithText(TextFormField, 'Rule 1 value');
      await revealCollectionControl(tester, remaining);
      final input = tester.widget<EditableText>(
        find.descendant(of: remaining, matching: find.byType(EditableText)),
      );
      expect(input.controller.text, 'Second private rule');
      expect(find.widgetWithText(TextFormField, 'Rule 2 value'), findsNothing);
      expect(h.api.metadataWrites, isEmpty);
      expect(h.api.writes, isEmpty);
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox.shrink());
    },
  );
  testWidgets(
    'smart rule value exposes its own editable semantics geometry and label',
    (tester) async {
      final semantics = tester.ensureSemantics();
      try {
        final h = await mountCollections(tester);
        await openSmartEditor(tester);
        final field = find.widgetWithText(TextFormField, 'Rule 1 value');
        await revealCollectionControl(tester, field);
        final native = tester.getSemantics(field);
        final data = native.getSemanticsData();
        expect(data.flagsCollection.isTextField, isTrue);
        expect(data.label, contains('Rule 1 value'));
        expect(
          data.label,
          isNot(contains('Condition 1')),
          reason:
              'The condition heading and choices must not become part of an editable field target',
        );
        expect(
          native.rect.height,
          lessThanOrEqualTo(tester.getSize(field).height + .01),
          reason:
              'An editable target must not span its entire card and its two choice controls',
        );
        expect(h.api.metadataWrites, isEmpty);
        await tester.pumpWidget(const SizedBox.shrink());
      } finally {
        semantics.dispose();
      }
    },
  );
  testWidgets(
    'smart fields and operators apply original values; saved preview is explicitly capped',
    (tester) async {
      final h = await mountCollections(tester);
      await openSmartEditor(tester);
      final field = find.widgetWithText(OutlinedButton, 'Rule 1 field');
      await revealCollectionControl(tester, field);
      await tester.tap(field);
      await tester.pumpAndSettle();
      expect(
        tester
            .widgetList<RadioListTile<String>>(
              find.byType(RadioListTile<String>),
            )
            .map((tile) => tile.value),
        [
          'title',
          'product_type',
          'vendor',
          'tag',
          'price',
          'inventory_quantity',
        ],
      );
      await tester.tap(find.text('Cancel'));
      await tester.pumpAndSettle();
      await chooseCollectionValue(tester, 'Rule 1 field', 'Inventory quantity');
      final operator = find.widgetWithText(OutlinedButton, 'Rule 1 operator');
      await revealCollectionControl(tester, operator);
      await tester.tap(operator);
      await tester.pumpAndSettle();
      expect(
        tester
            .widgetList<RadioListTile<String>>(
              find.byType(RadioListTile<String>),
            )
            .map((tile) => tile.value),
        [
          'equals',
          'not_equals',
          'contains',
          'starts_with',
          'ends_with',
          'gt',
          'lt',
        ],
      );
      await tester.tap(find.text('Cancel'));
      await tester.pumpAndSettle();
      await chooseCollectionValue(tester, 'Rule 1 operator', 'is greater than');
      await chooseCollectionValue(tester, 'Match type', 'Any condition');
      final rule = find.widgetWithText(TextFormField, 'Rule 1 value');
      await revealCollectionControl(tester, rule);
      await tester.enterText(rule, '17');
      final preview = find.widgetWithText(TextButton, 'Preview saved rules');
      await revealCollectionControl(tester, preview);
      await tester.tap(preview);
      await tester.pumpAndSettle();
      expect(
        h.api.reads.where((read) => read.path.endsWith('/preview')),
        hasLength(1),
      );
      final request = h.api.reads.lastWhere(
        (read) => read.path.endsWith('/preview'),
      );
      expect(request.options!.storeId, membership.site);
      expect(request.options!.query, {'store_id': membership.site});
      expect(request.options!.body, isNull);
      expect(
        find.text(
          'At least 0 matches in the evaluated sample; total matches are unknown. Evaluated 500 of 1005 active products. Preview uses saved rules.',
        ),
        findsOneWidget,
      );
      expect(h.api.metadataWrites, isEmpty);
      // Unknown reply is an explicit test fixture. It proves preserved UI intent,
      // not a committed database effect or synchronization acceptance.
      await tester.tap(find.widgetWithText(FilledButton, 'Save collection'));
      await tester.pumpAndSettle();
      expect(h.api.metadataWrites, hasLength(1));
      final write = h.api.metadataWrites.single;
      expect(write.method, HttpMethod.patch);
      expect(write.storeId, membership.site);
      expect(write.idempotencyKey, isNotEmpty);
      expect(write.body, {
        'version': 8,
        'name': 'Synthetic collection',
        'slug': 'synthetic-collection',
        'description': 'Synthetic kept draft',
        'is_active': false,
        'conditions': [
          {'field': 'inventory_quantity', 'op': 'gt', 'value': '17'},
        ],
        'match_type': 'any',
      });
      expect(find.text('Collection saved.'), findsNothing);
      expect(
        await h.products.collectionMetadata.pending(membership.site),
        isNotNull,
      );
      await tester.pumpWidget(const SizedBox.shrink());
    },
  );
  testWidgets(
    'retiring the collection editor while a saved preview is pending suppresses its result',
    (tester) async {
      final h = await mountCollections(tester);
      await openSmartEditor(tester);
      h.api.heldPreview = Completer<JsonMap>();
      final preview = find.widgetWithText(TextButton, 'Preview saved rules');
      await revealCollectionControl(tester, preview);
      await tester.tap(preview);
      await tester.pump();
      expect(find.text('Checking saved rules…'), findsOneWidget);
      final progress = tester.getRect(find.text('Checking saved rules…'));
      final list = tester.getRect(find.byType(ListView).last);
      expect(progress.bottom, lessThanOrEqualTo(list.top));
      h.scope.retire();
      await tester.pumpAndSettle();
      expect(find.text('Store access changed'), findsOneWidget);
      expect(find.byType(TextFormField), findsNothing);
      h.api.heldPreview!.complete({
        ...asJsonMap(h.api.fixture['preview']),
        'store_id': membership.site,
        'collection_id': membership.collection,
        'collection_version': 8,
      });
      await tester.pumpAndSettle();
      expect(find.textContaining('total matches are unknown'), findsNothing);
      expect(h.api.metadataWrites, isEmpty);
      expect(h.api.writes, isEmpty);
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox.shrink());
    },
  );
  for (final dark in [false, true]) {
    testWidgets(
      'collection membership full names/actions reflow at320dp scale2.4 dark$dark',
      (tester) async {
        tester.view.physicalSize = const Size(320, 900);
        tester.view.devicePixelRatio = 1;
        addTearDown(tester.view.resetPhysicalSize);
        addTearDown(tester.view.resetDevicePixelRatio);
        await mountCollections(tester, dark: dark, scale: 2.4, member: true);
        expect(find.text('2 assigned products · revision 3'), findsOneWidget);
        final nameFinder = find.text('1. Cotton tote');
        await tester.scrollUntilVisible(
          nameFinder,
          200,
          scrollable: find
              .descendant(
                of: find.byType(ReorderableListView),
                matching: find.byType(Scrollable),
              )
              .first,
          maxScrolls: 20,
        );
        await tester.pumpAndSettle();
        final name = tester.renderObject<RenderParagraph>(nameFinder);
        expect(
          name.didExceedMaxLines,
          isFalse,
          reason:
              'The actual member name must be laid out in full rather than ellipsized beside three controls',
        );
        final rect = tester.getRect(nameFinder);
        final viewport = tester.getRect(
          find
              .descendant(
                of: find.byType(ReorderableListView),
                matching: find.byType(Scrollable),
              )
              .first,
        );
        expect(rect.top, greaterThanOrEqualTo(viewport.top));
        expect(rect.bottom, lessThanOrEqualTo(viewport.bottom));
        expect(tester.takeException(), isNull);
        await tester.pumpWidget(const SizedBox.shrink());
      },
    );
  }
  testWidgets(
    'collection metadata complex editor is a full page with guarded draft Back',
    (tester) async {
      final h = await mountCollections(tester);
      await tester.tap(find.text('Synthetic collection'));
      await tester.pumpAndSettle();
      expect(find.byType(LetbuyyEditorScaffold), findsOneWidget);
      expect(find.byType(BottomSheet), findsNothing);
      final name = find.widgetWithText(TextFormField, 'Collection name');
      await tester.enterText(name, 'Private collection draft');
      await tester.tap(find.byTooltip('Back'));
      await tester.pumpAndSettle();
      expect(find.text('Discard unsaved collection edits?'), findsOneWidget);
      await tester.tap(find.text('Keep editing'));
      await tester.pumpAndSettle();
      expect(
        tester.widget<TextFormField>(name).controller!.text,
        'Private collection draft',
      );
      expect(h.api.writes, isEmpty);
      await tester.pumpWidget(const SizedBox.shrink());
    },
  );
}
