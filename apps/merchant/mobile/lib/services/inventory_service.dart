import 'package:flutter/foundation.dart';
import 'package:letbuyy_models/letbuyy_models.dart' hide JsonMap;
import 'api_client.dart';
import 'security_command_store.dart';

// Compatibility import surface only; data contracts have one shared owner.
export 'package:letbuyy_models/letbuyy_models.dart'
    show
        InventoryLevel,
        InventoryHistoryEntry,
        InventoryBarcodeLookup,
        InventoryLocationContract,
        InventoryLocationInput,
        InventorySupplierContract,
        InventorySupplierInput,
        InventoryLineInput,
        PurchaseOrderLineContract,
        PurchaseOrderContract,
        PurchaseOrderInput,
        InventoryTransferLineContract,
        InventoryTransferContract,
        InventoryTransferInput;

typedef _InventoryView = ({Object? version, String site, int generation});

class InventoryService extends ChangeNotifier {
  InventoryService({
    required ApiClient api,
    String? Function()? actorIdProvider,
    String? Function()? storeIdProvider,
    SecurityCommandStore? commands,
  }) : _api = api,
       _actor = actorIdProvider ?? (() => null),
       _store = storeIdProvider ?? (() => null),
       _commands = commands ?? SecurityCommandStore();
  final ApiClient _api;
  final String? Function() _actor, _store;
  final SecurityCommandStore _commands;
  static const _adjustmentCommand = 'inventory-adjustment';
  final Map<String, _InventoryView> _views = {};
  final Set<String> _loading = {};
  int _generation = 0;
  List<InventoryLevel> _levels = [];
  List<InventoryHistoryEntry> _history = [];
  bool _historyHasMore = false;
  int? _historyTotal;
  List<InventoryHistoryEntry> get history => List.unmodifiable(
    _current('history') ? _history : <InventoryHistoryEntry>[],
  );
  bool get historyHasMore => _current('history') && _historyHasMore;
  int? get historyTotal => _current('history') ? _historyTotal : null;
  List<InventoryLocationContract> _locations = [];
  List<InventorySupplierContract> _suppliers = [];
  List<PurchaseOrderContract> _purchaseOrders = [];
  List<InventoryTransferContract> _transfers = [];
  bool _levelsHasMore = false;
  bool _current(String resource) =>
      _views[resource] != null &&
      _views[resource]!.version == _api.captureRequestContext();
  List<InventoryLevel> get levels =>
      List.unmodifiable(_current('levels') ? _levels : <InventoryLevel>[]);
  List<InventoryLocationContract> get locations => List.unmodifiable(
    _current('locations') ? _locations : <InventoryLocationContract>[],
  );
  List<InventorySupplierContract> get suppliers => List.unmodifiable(
    _current('suppliers') ? _suppliers : <InventorySupplierContract>[],
  );
  List<PurchaseOrderContract> get purchaseOrders => List.unmodifiable(
    _current('orders') ? _purchaseOrders : <PurchaseOrderContract>[],
  );
  List<InventoryTransferContract> get transfers => List.unmodifiable(
    _current('transfers') ? _transfers : <InventoryTransferContract>[],
  );
  bool get isLoading => _loading.any(_current);
  bool get levelsHasMore => _current('levels') && _levelsHasMore;

  static ApiException changed() => const ApiException(
    message: 'Inventory context changed. Reload the selected store.',
    statusCode: 409,
    code: 'SESSION_CONTEXT_CHANGED',
  );
  void _check(Object? version) {
    if (_api.captureRequestContext() != version) throw changed();
  }

  void _checkRead(String resource, _InventoryView view) {
    _check(view.version);
    if (_views[resource] != view) throw changed();
  }

  void _clear(String resource) {
    switch (resource) {
      case 'history':
        _history = [];
        _historyHasMore = false;
        _historyTotal = null;
      case 'levels':
        _levels = [];
        _levelsHasMore = false;
      case 'locations':
        _locations = [];
      case 'suppliers':
        _suppliers = [];
      case 'orders':
        _purchaseOrders = [];
      case 'transfers':
        _transfers = [];
    }
  }

  _InventoryView _begin(String resource, String site) {
    final view = (
      version: _api.captureRequestContext(),
      site: site,
      generation: ++_generation,
    );
    _views[resource] = view;
    _clear(resource);
    _loading.add(resource);
    notifyListeners();
    return view;
  }

  ApiRequestOptions _options(Object? version, String site, {String? key}) =>
      ApiRequestOptions(
        storeId: site,
        expectedContextVersion: version,
        idempotencyKey: key,
      );
  JsonMap _scoped(JsonMap row, String site) {
    void check(JsonMap value) {
      for (final key in ['store_id', 'site_id']) {
        if (value[key] != null && value[key].toString() != site) {
          throw const ApiException(
            message: 'Inventory store could not be confirmed.',
            statusCode: 502,
            code: 'INVENTORY_SCOPE_MISMATCH',
          );
        }
      }
    }

    check(row);
    final scoped = {...row, 'store_id': site};
    for (final key in [
      'product',
      'products',
      'purchase_order',
      'transfer',
      'supplier',
    ]) {
      if (row[key] is Map) {
        final nested = Map<String, dynamic>.from(row[key] as Map);
        check(nested);
        scoped[key] = {...nested, 'store_id': site};
      }
    }
    if (row['lines'] is List) {
      for (final line in row['lines'] as List) {
        if (line is Map) check(Map<String, dynamic>.from(line));
      }
    }
    // The canonical legacy levels projection does not include store_id. Preserve
    // its already-authorized explicit HTTP query scope, without inventing a grant.
    return scoped;
  }

  Future<List<T>> _read<T>(
    String resource,
    String site,
    Future<List<JsonMap>> Function(ApiRequestOptions) load,
    T Function(JsonMap) parse,
    void Function(List<T>) publish,
  ) async {
    final view = _begin(resource, site);
    try {
      final rows = await load(_options(view.version, site));
      _checkRead(resource, view);
      final data = rows
          .map((row) => parse(_scoped(row, site)))
          .toList(growable: false);
      publish(data);
      return data;
    } finally {
      if (_views[resource] == view &&
          _api.captureRequestContext() == view.version) {
        _loading.remove(resource);
        notifyListeners();
      }
    }
  }

  Future<T> _command<T>(
    String resource,
    String site,
    Future<JsonMap> Function(ApiRequestOptions) send,
    T Function(JsonMap) parse,
    void Function(T) publish, {
    String? key,
  }) async {
    final version = _api.captureRequestContext(), before = _views[resource];
    try {
      final row = await send(_options(version, site, key: key));
      _check(version);
      final value = parse(_scoped(row, site));
      // A newer read wins over an older mutation receipt. The caller reloads
      // after confirmation; a receipt never grants authority for another store.
      if (_views[resource] == before) {
        if (before == null ||
            before.version != version ||
            before.site != site) {
          _clear(resource);
          _views[resource] = (
            version: version,
            site: site,
            generation: ++_generation,
          );
        }
        publish(value);
        notifyListeners();
      }
      return value;
    } catch (error) {
      if (_api.captureRequestContext() == version &&
          _views[resource]?.site == site &&
          error is ApiException &&
          [401, 403, 404].contains(error.statusCode)) {
        _clear(resource);
        notifyListeners();
      }
      rethrow;
    }
  }

  Future<List<InventoryLevel>> fetchLevels(
    String storeId, {
    bool lowStockOnly = false,
    int page = 1,
    int limit = 50,
  }) async {
    final view = _begin('levels', storeId);
    try {
      final result = await _api.inventory.levels(
        query: {
          'store_id': storeId,
          'page': page,
          'limit': limit,
          if (lowStockOnly) 'low_stock': true,
        },
        options: _options(view.version, storeId),
      );
      _checkRead('levels', view);
      final rows = result.data
          .map((row) => InventoryLevel.fromJson(_scoped(row, storeId)))
          .toList(growable: false);
      _levels = rows;
      _levelsHasMore = result.hasMore;
      return rows;
    } finally {
      if (_views['levels'] == view &&
          _api.captureRequestContext() == view.version) {
        _loading.remove('levels');
        notifyListeners();
      }
    }
  }

  Future<List<InventoryHistoryEntry>> fetchHistory(
    String storeId, {
    int page = 1,
    int limit = 20,
    String? productId,
  }) async {
    final view = _begin('history', storeId);
    try {
      final result = await _api.inventory.history(
        query: {
          'store_id': storeId,
          'page': page,
          'limit': limit,
          if (productId != null && productId.isNotEmpty)
            'product_id': productId,
        },
        options: _options(view.version, storeId),
      );
      _checkRead('history', view);
      if (result.meta['store_id'] != storeId ||
          result.meta['total'] is! int ||
          result.total < 0 ||
          result.page != page) {
        throw const ApiException(
          message:
              'History is not available for the selected store yet. Try again later.',
          statusCode: 503,
          code: 'INVENTORY_HISTORY_SCOPE_UNSUPPORTED',
        );
      }
      final rows = result.data
          .map((json) => InventoryHistoryEntry.fromJson(_scoped(json, storeId)))
          .toList(growable: false);
      if (productId != null && rows.any((row) => row.productId != productId)) {
        throw const ApiException(
          message: 'The history product could not be confirmed.',
          statusCode: 502,
          code: 'INVENTORY_SCOPE_MISMATCH',
        );
      }
      _history = rows;
      _historyHasMore = result.hasMore;
      _historyTotal = result.total;
      return rows;
    } finally {
      if (_views['history'] == view &&
          _api.captureRequestContext() == view.version) {
        _loading.remove('history');
        notifyListeners();
      }
    }
  }

  Future<InventoryLevel> adjustStock({
    required String storeId,
    required InventoryLevel level,
    required int delta,
    required String reason,
    String? note,
    String? idempotencyKey,
  }) {
    if (level.storeId != storeId) throw changed();
    return _command(
      'levels',
      storeId,
      (options) => _api.inventory.adjust({
        'store_id': storeId,
        'product_id': level.productId,
        if (level.variantId.isNotEmpty) 'variant_id': level.variantId,
        if (level.locationId.isNotEmpty) 'location_id': level.locationId,
        'sku': level.sku,
        'adjustment': delta,
        'reason': reason,
        if (note != null && note.trim().isNotEmpty) 'notes': note.trim(),
      }, options: options),
      InventoryLevel.fromJson,
      (row) {
        _levels = [row, ..._levels.where((item) => item.id != row.id)];
      },
      key: idempotencyKey,
    );
  }

  MerchantSecurityContext _commandContext(String site) {
    final actor = _actor();
    if (actor == null || actor.isEmpty || _store() != site) throw changed();
    return (
      actorId: actor,
      storeId: site,
      version: _api.captureRequestContext(),
    );
  }

  void _checkCommand(MerchantSecurityContext c) {
    _check(c.version);
    if (_actor() != c.actorId || _store() != c.storeId) throw changed();
  }

  Future<PendingSecurityCommand?> pendingAdjustment(String site) {
    final c = _commandContext(site);
    return _commands.serialized(
      () =>
          _commands.read(c, _adjustmentCommand, check: () => _checkCommand(c)),
    );
  }

  /// A retry replays the original frozen product/location/delta, never a newly
  /// inferred quantity. Only the Gateway's durable receipt confirms the effect.
  Future<InventoryLevel> submitAdjustment({
    required String storeId,
    required String productId,
    required String locationId,
    String? variantId,
    required int delta,
    required String reason,
    String? note,
  }) {
    final c = _commandContext(storeId);
    if (productId.isEmpty || locationId.isEmpty || delta == 0) {
      throw const FormatException(
        'Choose a product, location and non-zero change.',
      );
    }
    final intent = <String, dynamic>{
      'store_id': storeId,
      'product_id': productId,
      'location_id': locationId,
      if (variantId != null && variantId.isNotEmpty) 'variant_id': variantId,
      'adjustment': delta,
      'reason': reason,
      if (note != null && note.trim().isNotEmpty) 'notes': note.trim(),
    };
    return _commands.serialized(() async {
      final command = await _commands.prepare(
        c,
        _adjustmentCommand,
        intent,
        check: () => _checkCommand(c),
      );
      return _sendPendingAdjustment(c, command);
    });
  }

  Future<InventoryLevel> retryPendingAdjustment(String site) {
    final c = _commandContext(site);
    return _commands.serialized(() async {
      final command = await _commands.read(
        c,
        _adjustmentCommand,
        check: () => _checkCommand(c),
      );
      if (command == null) {
        throw const ApiException(
          message: 'No stock change is awaiting confirmation.',
          statusCode: 409,
          code: 'NO_PENDING_COMMAND',
        );
      }
      return _sendPendingAdjustment(c, command);
    });
  }

  Future<InventoryLevel> _sendPendingAdjustment(
    MerchantSecurityContext c,
    PendingSecurityCommand command,
  ) async {
    _checkCommand(c);
    final intent = command.intent;
    if (intent['store_id'] != c.storeId ||
        intent['product_id'] is! String ||
        intent['location_id'] is! String ||
        intent['location_id'].toString().isEmpty ||
        intent['adjustment'] is! int ||
        intent['adjustment'] == 0 ||
        intent['reason'] is! String) {
      throw const FormatException('The saved stock change needs review.');
    }
    final row = await _command(
      'levels',
      c.storeId,
      (options) => _api.inventory.adjust(intent, options: options),
      (json) {
        final row = InventoryLevel.fromJson(json);
        if (row.productId != intent['product_id'] ||
            row.locationId != intent['location_id'] ||
            row.variantId != (intent['variant_id'] ?? '')) {
          throw const ApiException(
            message: 'The stock change receipt could not be confirmed.',
            statusCode: 502,
            code: 'INVENTORY_RECEIPT_MISMATCH',
          );
        }
        return row;
      },
      (_) {},
      key: command.key,
    );
    _checkCommand(c);
    await _commands.complete(c, command, check: () => _checkCommand(c));
    return row;
  }

  Future<InventoryLevel> adjustScannedStock({
    required String storeId,
    required InventoryBarcodeLookup lookup,
    required int delta,
    required String reason,
    String? locationId,
    String? note,
    String? idempotencyKey,
  }) {
    if (lookup.storeId != storeId) throw changed();
    return _command(
      'levels',
      storeId,
      (options) => _api.inventory.adjust({
        'store_id': storeId,
        'product_id': lookup.productId,
        if (lookup.variantId.isNotEmpty) 'variant_id': lookup.variantId,
        if (locationId != null && locationId.trim().isNotEmpty)
          'location_id': locationId.trim(),
        if (lookup.sku.isNotEmpty) 'sku': lookup.sku,
        'adjustment': delta,
        'reason': reason,
        if (note != null && note.trim().isNotEmpty) 'notes': note.trim(),
      }, options: options),
      InventoryLevel.fromJson,
      (row) {
        _levels = [row, ..._levels.where((item) => item.id != row.id)];
      },
      key: idempotencyKey,
    );
  }

  Future<InventoryBarcodeLookup?> lookupBarcode({
    required String storeId,
    required String barcode,
  }) async {
    final version = _api.captureRequestContext();
    if (barcode.trim().isEmpty) return null;
    try {
      final row = await _api.products.lookupBarcode(
        storeId: storeId,
        barcode: barcode.trim(),
        options: _options(version, storeId),
      );
      _check(version);
      return InventoryBarcodeLookup.fromJson(_scoped(row, storeId));
    } on ApiException catch (error) {
      _check(version);
      if (error.statusCode == 404 || error.code == 'NOT_FOUND') return null;
      rethrow;
    }
  }

  Future<List<InventoryLocationContract>> fetchLocations(String storeId) =>
      _read(
        'locations',
        storeId,
        (options) =>
            _api.inventory.locations(storeId: storeId, options: options),
        InventoryLocationContract.fromJson,
        (rows) => _locations = rows,
      );
  Future<InventoryLocationContract> createLocation(
    InventoryLocationInput input,
  ) => _command(
    'locations',
    input.storeId,
    (options) =>
        _api.inventory.createLocation(input.toJson(), options: options),
    InventoryLocationContract.fromJson,
    (row) =>
        _locations = [row, ..._locations.where((item) => item.id != row.id)],
  );
  Future<List<InventorySupplierContract>> fetchSuppliers(String storeId) =>
      _read(
        'suppliers',
        storeId,
        (options) =>
            _api.inventory.suppliers(storeId: storeId, options: options),
        InventorySupplierContract.fromJson,
        (rows) => _suppliers = rows,
      );
  Future<InventorySupplierContract> createSupplier(
    InventorySupplierInput input,
  ) => _command(
    'suppliers',
    input.storeId,
    (options) =>
        _api.inventory.createSupplier(input.toJson(), options: options),
    InventorySupplierContract.fromJson,
    (row) =>
        _suppliers = [row, ..._suppliers.where((item) => item.id != row.id)],
  );
  Future<List<PurchaseOrderContract>> fetchPurchaseOrders(String storeId) =>
      _read(
        'orders',
        storeId,
        (options) =>
            _api.inventory.purchaseOrders(storeId: storeId, options: options),
        PurchaseOrderContract.fromJson,
        (rows) => _purchaseOrders = rows,
      );
  Future<PurchaseOrderContract> createPurchaseOrder(PurchaseOrderInput input) =>
      _command(
        'orders',
        input.storeId,
        (options) => _api.inventory.createPurchaseOrder(
          input.toJson(),
          options: options,
        ),
        PurchaseOrderContract.fromJson,
        (row) => _purchaseOrders = [
          row,
          ..._purchaseOrders.where((item) => item.id != row.id),
        ],
        key: input.idempotencyKey,
      );
  Future<PurchaseOrderContract> receivePurchaseOrder(
    PurchaseOrderContract purchaseOrder, {
    required String idempotencyKey,
  }) => _command(
    'orders',
    purchaseOrder.storeId,
    (options) => _api.inventory.receivePurchaseOrder(purchaseOrder.id, {
      'idempotency_key': idempotencyKey,
    }, options: options),
    PurchaseOrderContract.fromJson,
    (row) => _purchaseOrders = _replaceById(_purchaseOrders, row),
    key: idempotencyKey,
  );
  Future<List<InventoryTransferContract>> fetchTransfers(String storeId) =>
      _read(
        'transfers',
        storeId,
        (options) =>
            _api.inventory.transfers(storeId: storeId, options: options),
        InventoryTransferContract.fromJson,
        (rows) => _transfers = rows,
      );
  Future<InventoryTransferContract> createTransfer(
    InventoryTransferInput input,
  ) => _command(
    'transfers',
    input.storeId,
    (options) =>
        _api.inventory.createTransfer(input.toJson(), options: options),
    InventoryTransferContract.fromJson,
    (row) =>
        _transfers = [row, ..._transfers.where((item) => item.id != row.id)],
    key: input.idempotencyKey,
  );
  Future<InventoryTransferContract> shipTransfer(
    InventoryTransferContract transfer, {
    required String idempotencyKey,
  }) => _command(
    'transfers',
    transfer.storeId,
    (options) => _api.inventory.shipTransfer(transfer.id, {
      'idempotency_key': idempotencyKey,
    }, options: options),
    InventoryTransferContract.fromJson,
    (row) => _transfers = _replaceById(_transfers, row),
    key: idempotencyKey,
  );
  Future<InventoryTransferContract> receiveTransfer(
    InventoryTransferContract transfer, {
    required String idempotencyKey,
  }) => _command(
    'transfers',
    transfer.storeId,
    (options) => _api.inventory.receiveTransfer(transfer.id, {
      'idempotency_key': idempotencyKey,
    }, options: options),
    InventoryTransferContract.fromJson,
    (row) => _transfers = _replaceById(_transfers, row),
    key: idempotencyKey,
  );
  String makeIdempotencyKey(String scope) =>
      'mobile-$scope-${DateTime.now().microsecondsSinceEpoch}';
  List<T> _replaceById<T>(List<T> items, T replacement) {
    final id = switch (replacement) {
      PurchaseOrderContract item => item.id,
      InventoryTransferContract item => item.id,
      _ => '',
    };
    return items
        .map(
          (item) => switch (item) {
            PurchaseOrderContract value when value.id == id => replacement,
            InventoryTransferContract value when value.id == id => replacement,
            _ => item,
          },
        )
        .toList(growable: false);
  }
}
