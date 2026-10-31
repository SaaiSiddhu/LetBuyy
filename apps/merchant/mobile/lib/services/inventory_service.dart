import 'package:flutter/foundation.dart';
import 'package:letbuyy_models/letbuyy_models.dart' hide JsonMap;
import 'package:uuid/uuid.dart';
import 'api_client.dart';
import 'security_command_store.dart';

// Compatibility import surface only; data contracts have one shared owner.
export 'package:letbuyy_models/letbuyy_models.dart'
    show
        InventoryLevel,
        InventoryHistoryEntry,
        InventoryReservationRecord,
        InventoryReceiptRecord,
        InventoryMetricPage,
        SupplierMetricPage,
        WarehouseMetricPage,
        TransferMetrics,
        OperationsSnapshot,
        operationsMetricKeys,
        inventoryReservationStatuses,
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

export 'package:letbuyy_models/letbuyy_models.dart'
    show WarehouseCommandIntent, WarehouseCommandAcknowledgement;

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
  static const _warehouseCommand = 'inventory-warehouse';
  final Map<
    String,
    ({
      Object? version,
      WarehouseCommandIntent intent,
      Future<WarehouseCommandAcknowledgement> result,
    })
  >
  _warehouseFlights = {};
  final Map<String, _InventoryView> _views = {};
  final Set<String> _loading = {};
  int _generation = 0;
  List<InventoryLevel> _levels = [];
  List<InventoryHistoryEntry> _history = [];
  List<InventoryReservationRecord> _reservations = [];
  List<InventoryReceiptRecord> _receipts = [];
  final Map<String, ({int total, bool more})> _recordPages = {};
  List<InventoryReservationRecord> get reservations => List.unmodifiable(
    _current('reservations') ? _reservations : <InventoryReservationRecord>[],
  );
  List<InventoryReceiptRecord> get receipts => List.unmodifiable(
    _current('receipts') ? _receipts : <InventoryReceiptRecord>[],
  );
  int? get reservationTotal =>
      _current('reservations') ? _recordPages['reservations']?.total : null;
  int? get receiptTotal =>
      _current('receipts') ? _recordPages['receipts']?.total : null;
  bool get reservationsHasMore =>
      _current('reservations') && (_recordPages['reservations']?.more ?? false);
  bool get receiptsHasMore =>
      _current('receipts') && (_recordPages['receipts']?.more ?? false);
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
  int? get purchaseOrdersTotal =>
      _current('orders') ? _recordPages['orders']?.total : null;
  int? get transfersTotal =>
      _current('transfers') ? _recordPages['transfers']?.total : null;
  bool get purchaseOrdersHasMore =>
      _current('orders') && (_recordPages['orders']?.more ?? false);
  bool get transfersHasMore =>
      _current('transfers') && (_recordPages['transfers']?.more ?? false);
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
    _recordPages.remove(resource);
    switch (resource) {
      case 'reservations':
        _reservations = [];
      case 'receipts':
        _receipts = [];
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
      'purchase_orders',
      'inventory_transfers',
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

  Future<T> _readMetric<T>(
    String resource,
    String storeId,
    Future<JsonMap> Function(ApiRequestOptions) load,
    T Function(JsonMap) parse, {
    InventoryMetricPage Function(T)? metadata,
    int page = 1,
    int limit = 20,
  }) async {
    final view = _begin(resource, storeId);
    try {
      final raw = await load(_options(view.version, storeId));
      _checkRead(resource, view);
      if (raw['store_id'] != storeId)
        throw const ApiException(
          message:
              'These operations metrics are not available for the selected store yet. Try again later.',
          statusCode: 503,
          code: 'OPERATIONS_METRICS_SCOPE_UNSUPPORTED',
        );
      final result = parse(raw), meta = metadata?.call(result);
      if (meta != null && (meta.page != page || meta.limit != limit))
        throw const FormatException(
          'The operations page could not be confirmed.',
        );
      return result;
    } finally {
      if (_views[resource] == view &&
          _api.captureRequestContext() == view.version) {
        _loading.remove(resource);
        notifyListeners();
      }
    }
  }

  Future<SupplierMetricPage> fetchSupplierMetrics(
    String storeId, {
    int page = 1,
    int limit = 20,
  }) => _readMetric(
    'supplier-metrics',
    storeId,
    (options) => _api.commerceAnalytics.supplierMetrics(
      query: {'store_id': storeId, 'page': page, 'limit': limit},
      options: options,
    ),
    SupplierMetricPage.fromJson,
    metadata: (data) => data.meta,
    page: page,
    limit: limit,
  );
  Future<WarehouseMetricPage> fetchWarehouseMetrics(
    String storeId, {
    int page = 1,
    int limit = 20,
  }) => _readMetric(
    'warehouse-metrics',
    storeId,
    (options) => _api.commerceAnalytics.warehouseMetrics(
      query: {'store_id': storeId, 'page': page, 'limit': limit},
      options: options,
    ),
    WarehouseMetricPage.fromJson,
    metadata: (data) => data.meta,
    page: page,
    limit: limit,
  );
  Future<TransferMetrics> fetchTransferMetrics(String storeId) => _readMetric(
    'transfer-metrics',
    storeId,
    (options) => _api.commerceAnalytics.transferMetrics(
      query: {'store_id': storeId},
      options: options,
    ),
    TransferMetrics.fromJson,
  );
  Future<OperationsSnapshot> fetchOperationsSummary(String storeId) =>
      _readMetric(
        'operations-summary',
        storeId,
        (options) => _api.commerceAnalytics.operationsSummary(
          query: {'store_id': storeId},
          options: options,
        ),
        OperationsSnapshot.fromJson,
      );

  Future<List<T>> _readRecords<T>(
    String resource,
    String storeId,
    int page,
    int limit,
    Future<PaginatedResponse<JsonMap>> Function(ApiRequestOptions) load,
    T Function(JsonMap) parse,
    void Function(List<T>) publish,
    bool Function(T) matches, {
    bool warehouse = false,
  }) async {
    final view = _begin(resource, storeId);
    try {
      final result = await load(_options(view.version, storeId));
      _checkRead(resource, view);
      if (result.meta['store_id'] != storeId ||
          result.meta['page'] != page ||
          result.meta['per_page'] != limit ||
          result.meta['has_next'] is! bool ||
          result.meta['total'] is! int ||
          result.total < 0 ||
          result.data.length > limit ||
          result.data.length > result.total) {
        throw ApiException(
          message:
              'These inventory records are not available for the selected store yet. Try again later.',
          statusCode: 503,
          code: 'INVENTORY_${resource.toUpperCase()}_SCOPE_UNSUPPORTED',
        );
      }
      if (warehouse &&
          (result.meta['total_is_exact'] != true ||
              result.data.length !=
                  (result.total - (page - 1) * limit).clamp(0, limit) ||
              result.hasMore != (page * limit < result.total) ||
              result.data.map((row) => row['id']).toSet().length !=
                  result.data.length)) {
        throw const ApiException(
          message:
              'These warehouse records could not be confirmed. Reload the current store.',
          statusCode: 503,
          code: 'WAREHOUSE_DOCUMENTS_UNVERIFIED',
        );
      }
      final rows = result.data
          .map((row) => parse(_scoped(row, storeId)))
          .toList(growable: false);
      if (rows.any((row) => !matches(row)))
        throw const ApiException(
          message: 'The inventory selection could not be confirmed.',
          statusCode: 502,
          code: 'INVENTORY_SCOPE_MISMATCH',
        );
      publish(rows);
      _recordPages[resource] = (total: result.total, more: result.hasMore);
      return rows;
    } finally {
      if (_views[resource] == view &&
          _api.captureRequestContext() == view.version) {
        _loading.remove(resource);
        notifyListeners();
      }
    }
  }

  Future<List<InventoryReservationRecord>> fetchReservations(
    String storeId, {
    int page = 1,
    int limit = 20,
    String? status,
    String? productId,
  }) => _readRecords(
    'reservations',
    storeId,
    page,
    limit,
    (options) => _api.inventory.reservations(
      query: {
        'store_id': storeId,
        'page': page,
        'limit': limit,
        if (status != null && status.isNotEmpty) 'status': status,
        if (productId != null && productId.isNotEmpty) 'product_id': productId,
      },
      options: options,
    ),
    InventoryReservationRecord.fromJson,
    (rows) => _reservations = rows,
    (row) =>
        (status == null || status.isEmpty || row.status == status) &&
        (productId == null || productId.isEmpty || row.productId == productId),
  );

  Future<List<InventoryReceiptRecord>> fetchReceipts(
    String storeId, {
    int page = 1,
    int limit = 20,
    String? purchaseOrderId,
    String? transferId,
  }) => _readRecords(
    'receipts',
    storeId,
    page,
    limit,
    (options) => _api.inventory.receipts(
      query: {
        'store_id': storeId,
        'page': page,
        'limit': limit,
        if (purchaseOrderId != null && purchaseOrderId.isNotEmpty)
          'po_id': purchaseOrderId,
        if (transferId != null && transferId.isNotEmpty)
          'transfer_id': transferId,
      },
      options: options,
    ),
    InventoryReceiptRecord.fromJson,
    (rows) => _receipts = rows,
    (row) =>
        (purchaseOrderId == null ||
            purchaseOrderId.isEmpty ||
            (row.receiptType == 'purchase_order' &&
                row.parentId == purchaseOrderId)) &&
        (transferId == null ||
            transferId.isEmpty ||
            (row.receiptType == 'transfer' && row.parentId == transferId)),
  );

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

  Future<void> verifyWarehouseProtocol(String site) =>
      _verifyWarehouseProtocol(_commandContext(site));
  Future<void> _verifyWarehouseProtocol(MerchantSecurityContext c) async {
    _checkCommand(c);
    try {
      final raw = await _api.inventory.commandCapabilities(
        storeId: c.storeId,
        options: _options(c.version, c.storeId),
      );
      _checkCommand(c);
      final capabilities = WarehouseCommandCapabilities.fromJson(raw);
      if (capabilities.storeId != c.storeId ||
          capabilities.actorId != c.actorId)
        throw const FormatException('Warehouse protocol scope mismatch.');
    } on FormatException {
      throw const ApiException(
        message:
            'Warehouse request support could not be confirmed. Try again later.',
        statusCode: 503,
        code: 'WAREHOUSE_PROTOCOL_UNVERIFIED',
      );
    } on ApiException catch (error) {
      _checkCommand(c);
      if (error.statusCode == 404)
        throw const ApiException(
          message:
              'Warehouse request support needs a server update. Saved requests are retained.',
          statusCode: 426,
          code: 'WAREHOUSE_SERVER_UPGRADE_REQUIRED',
        );
      rethrow;
    }
  }

  Future<PendingSecurityCommand?> pendingAdjustment(String site) {
    final c = _commandContext(site);
    return _commands.serialized(
      () =>
          _commands.read(c, _adjustmentCommand, check: () => _checkCommand(c)),
    );
  }

  /// One unresolved warehouse intent per actor/store, persisted before transport.
  Future<PendingSecurityCommand?> pendingWarehouseCommand(String site) {
    final c = _commandContext(site);
    return _commands.serialized(() async {
      final pending = await _commands.read(
        c,
        _warehouseCommand,
        check: () => _checkCommand(c),
      );
      if (pending != null) WarehouseCommandIntent.fromJson(pending.intent);
      return pending;
    });
  }

  Future<WarehouseCommandAcknowledgement> submitWarehouseCommand(
    String site,
    WarehouseCommandIntent intent, {
    String? proposedKey,
  }) {
    final c = _commandContext(site);
    final scope = '${c.actorId}:${c.storeId}';
    final flight = _warehouseFlights[scope];
    if (flight != null) {
      if (flight.version != c.version) throw changed();
      if (!flight.intent.sameAs(intent)) {
        throw const ApiException(
          message:
              'Confirm the original warehouse request before changing its details.',
          statusCode: 409,
          code: 'PENDING_SECURITY_COMMAND',
        );
      }
      return flight.result;
    }
    late Future<WarehouseCommandAcknowledgement> result;
    result = _commands
        .serialized(() async {
          await _verifyWarehouseProtocol(c);
          final pending = await _commands.prepare(
            c,
            _warehouseCommand,
            intent.toJson(),
            proposedKey: proposedKey,
            check: () => _checkCommand(c),
          );
          notifyListeners();
          try {
            return await _sendPendingWarehouse(c, pending);
          } finally {
            notifyListeners();
          }
        })
        .whenComplete(() {
          if (identical(_warehouseFlights[scope]?.result, result))
            _warehouseFlights.remove(scope);
        });
    _warehouseFlights[scope] = (
      version: c.version,
      intent: intent,
      result: result,
    );
    return result;
  }

  Future<WarehouseCommandAcknowledgement> retryWarehouseCommand(String site) =>
      _recoverWarehouse(site, stop: false);
  Future<WarehouseCommandAcknowledgement> stopWarehouseCommand(String site) =>
      _recoverWarehouse(site, stop: true);
  Future<WarehouseCommandAcknowledgement> _recoverWarehouse(
    String site, {
    required bool stop,
  }) {
    final c = _commandContext(site);
    return _commands.serialized(() async {
      final pending = await _commands.read(
        c,
        _warehouseCommand,
        check: () => _checkCommand(c),
      );
      if (pending == null) {
        throw const ApiException(
          message: 'No warehouse request is awaiting confirmation.',
          statusCode: 409,
          code: 'NO_PENDING_COMMAND',
        );
      }
      await _verifyWarehouseProtocol(c);
      return _sendPendingWarehouse(c, pending, stop: stop);
    });
  }

  Future<WarehouseCommandAcknowledgement> _sendPendingWarehouse(
    MerchantSecurityContext c,
    PendingSecurityCommand pending, {
    bool stop = false,
  }) async {
    _checkCommand(c);
    final intent = WarehouseCommandIntent.fromJson(pending.intent);
    final options = _options(c.version, c.storeId, key: pending.key).copyWith(
      headers: {
        warehouseCommandProtocolHeader: warehouseCommandProtocolVersion,
      },
    );
    final body = <String, dynamic>{
      ...intent.command,
      'idempotency_key': pending.key,
    };
    if (intent.operation.endsWith('.create')) {
      body['store_id'] = c.storeId;
      // Create endpoints normalize absent optional values to these frozen nulls.
      for (final key in ['notes', 'expected_at']) {
        if (body[key] == null) body.remove(key);
      }
    } else if (body['lines'] == null) {
      body.remove('lines');
    }
    Future<JsonMap> sendStop() => _api.inventory.stopWarehouseCommand({
      ...intent.toJson(),
      'store_id': c.storeId,
      'idempotency_key': pending.key,
    }, options: options);
    JsonMap raw;
    try {
      raw = stop
          ? await sendStop()
          : await switch (intent.operation) {
              'purchase_order.create' => _api.inventory.createPurchaseOrder(
                body,
                options: options,
              ),
              'purchase_order.receive' => _api.inventory.receivePurchaseOrder(
                intent.targetId!,
                body,
                options: options,
              ),
              'transfer.create' => _api.inventory.createTransfer(
                body,
                options: options,
              ),
              'transfer.ship' => _api.inventory.shipTransfer(
                intent.targetId!,
                body,
                options: options,
              ),
              'transfer.receive' => _api.inventory.receiveTransfer(
                intent.targetId!,
                body,
                options: options,
              ),
              _ => throw const FormatException(
                'The saved warehouse request needs review.',
              ),
            };
    } on ApiException catch (error) {
      _checkCommand(c);
      if (stop || error.code != 'WAREHOUSE_REQUEST_STOPPED') rethrow;
      raw = await sendStop();
    }
    _checkCommand(c);
    final WarehouseCommandAcknowledgement ack;
    try {
      ack = WarehouseCommandAcknowledgement.fromJson(raw);
    } on FormatException {
      throw const ApiException(
        message: 'The warehouse acknowledgement could not be confirmed.',
        statusCode: 502,
        code: 'WAREHOUSE_RECEIPT_INVALID',
      );
    }
    if (ack.actorId != c.actorId ||
        ack.storeId != c.storeId ||
        ack.key != pending.key ||
        !intent.matches(ack)) {
      throw const ApiException(
        message: 'The warehouse acknowledgement could not be confirmed.',
        statusCode: 502,
        code: 'WAREHOUSE_RECEIPT_MISMATCH',
      );
    }
    await _commands.complete(c, pending, check: () => _checkCommand(c));
    _checkCommand(c);
    // A replay is a historical acknowledgement. Reload current server reads.
    for (final resource in [
      'orders',
      'transfers',
      'levels',
      'history',
      'receipts',
    ]) {
      _views.remove(resource);
      _loading.remove(resource);
      _clear(resource);
    }
    notifyListeners();
    return ack;
  }

  T _appliedWarehouse<T>(WarehouseCommandAcknowledgement ack, T? row) {
    if (!ack.applied || row == null) {
      throw const ApiException(
        message: 'The warehouse request was stopped before it applied.',
        statusCode: 409,
        code: 'WAREHOUSE_REQUEST_STOPPED',
      );
    }
    return row;
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
  Future<T> _warehouseDetail<T>(
    String site,
    String id,
    Future<JsonMap> Function(ApiRequestOptions) read,
    T Function(JsonMap) parse,
  ) async {
    final version = _api.captureRequestContext();
    final raw = await read(_options(version, site));
    _check(version);
    try {
      if (raw['id'] != id || raw['site_id'] != site)
        throw const FormatException();
      return parse(raw);
    } on FormatException {
      throw const ApiException(
        message:
            'This warehouse record could not be confirmed. Reload the current store.',
        statusCode: 503,
        code: 'WAREHOUSE_DOCUMENTS_UNVERIFIED',
      );
    }
  }

  Future<PurchaseOrderContract> fetchPurchaseOrder(String site, String id) =>
      _warehouseDetail(
        site,
        id,
        (options) =>
            _api.inventory.purchaseOrder(id, storeId: site, options: options),
        PurchaseOrderContract.fromVerifiedJson,
      );
  Future<InventoryTransferContract> fetchTransfer(String site, String id) =>
      _warehouseDetail(
        site,
        id,
        (options) =>
            _api.inventory.transfer(id, storeId: site, options: options),
        InventoryTransferContract.fromVerifiedJson,
      );

  Future<List<PurchaseOrderContract>> fetchPurchaseOrders(
    String storeId, {
    int page = 1,
    int limit = 20,
  }) => _readRecords(
    'orders',
    storeId,
    page,
    limit,
    (options) => _api.inventory.purchaseOrders(
      storeId: storeId,
      page: page,
      limit: limit,
      options: options,
    ),
    PurchaseOrderContract.fromJson,
    (rows) => _purchaseOrders = rows,
    (row) => row.storeId == storeId,
    warehouse: true,
  );

  Future<PurchaseOrderContract> createPurchaseOrder(
    PurchaseOrderInput input,
  ) async {
    final ack = await submitWarehouseCommand(
      input.storeId,
      WarehouseCommandIntent.purchaseOrder(input),
      proposedKey: input.idempotencyKey,
    );
    return _appliedWarehouse(ack, ack.purchaseOrder);
  }

  Future<PurchaseOrderContract> receivePurchaseOrder(
    PurchaseOrderContract purchaseOrder, {
    required String idempotencyKey,
    Map<String, int>? quantities,
  }) async {
    final ack = await submitWarehouseCommand(
      purchaseOrder.storeId,
      WarehouseCommandIntent.receivePurchaseOrder(
        purchaseOrder,
        quantities: quantities,
      ),
      proposedKey: idempotencyKey,
    );
    return _appliedWarehouse(ack, ack.purchaseOrder);
  }

  Future<List<InventoryTransferContract>> fetchTransfers(
    String storeId, {
    int page = 1,
    int limit = 20,
  }) => _readRecords(
    'transfers',
    storeId,
    page,
    limit,
    (options) => _api.inventory.transfers(
      storeId: storeId,
      page: page,
      limit: limit,
      options: options,
    ),
    InventoryTransferContract.fromJson,
    (rows) => _transfers = rows,
    (row) => row.storeId == storeId,
    warehouse: true,
  );

  Future<InventoryTransferContract> createTransfer(
    InventoryTransferInput input,
  ) async {
    final ack = await submitWarehouseCommand(
      input.storeId,
      WarehouseCommandIntent.transfer(input),
      proposedKey: input.idempotencyKey,
    );
    return _appliedWarehouse(ack, ack.transfer);
  }

  Future<InventoryTransferContract> shipTransfer(
    InventoryTransferContract transfer, {
    required String idempotencyKey,
  }) async {
    final ack = await submitWarehouseCommand(
      transfer.storeId,
      WarehouseCommandIntent.ship(transfer.id),
      proposedKey: idempotencyKey,
    );
    return _appliedWarehouse(ack, ack.transfer);
  }

  Future<InventoryTransferContract> receiveTransfer(
    InventoryTransferContract transfer, {
    required String idempotencyKey,
    Map<String, int>? quantities,
  }) async {
    final ack = await submitWarehouseCommand(
      transfer.storeId,
      WarehouseCommandIntent.receiveTransfer(transfer, quantities: quantities),
      proposedKey: idempotencyKey,
    );
    return _appliedWarehouse(ack, ack.transfer);
  }

  String makeIdempotencyKey(String scope) => const Uuid().v4();
}
