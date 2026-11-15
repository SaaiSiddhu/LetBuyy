// Existing SDK, synthetic transport. Presentation ownership only; no hosted/RLS proof.
import 'dart:async';
import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_store/services/api_client.dart';
import 'package:letbuyy_store/services/return_service.dart';
import 'orders_read_presentation_test.dart' as read;

JsonMap returnRow({String store = read.site, String id = 'synthetic-return'}) =>
    {
      'id': id,
      'store_id': store,
      'order_id': read.recordId,
      'order_number': 'SYNTHETIC-RMA',
      'status': 'requested',
      'reason': 'Synthetic return reason',
      'refund_amount': 129.75,
      'currency': 'INR',
    };

PaginatedResponse<JsonMap> returnPage({
  JsonMap? row,
  int page = 1,
  int total = 1,
}) => PaginatedResponse(
  data: [row ?? returnRow()],
  total: total,
  page: page,
  limit: 20,
  hasMore: false,
);

class ReturnsReadTransport extends ApiClient {
  ReturnsReadTransport()
    : super(baseUrl: 'https://returns.synthetic.invalid/v1', maxRetries: 0);
  Object epoch = 0;
  final reads = <ApiRequestOptions>[];
  Future<PaginatedResponse<JsonMap>> Function(ApiRequestOptions)? reply;
  @override
  Object captureRequestContext() => epoch;
  @override
  Future<PaginatedResponse<JsonMap>> requestPaginatedJson(
    String path, {
    ApiRequestOptions? options,
  }) async {
    expect(path, '/returns');
    reads.add(options!);
    return reply == null ? returnPage() : reply!(options);
  }
}

void main() {
  test(
    'malformed population metadata cannot confirm a nonempty page or clear current denial',
    () async {
      final api = ReturnsReadTransport();
      final reader = ReturnService(api: api);
      addTearDown(api.close);
      addTearDown(reader.dispose);
      final first = await reader.fetchReturns(read.site);
      expect(first, isNotEmpty);
      api.reply = (_) async => throw read.failure(403);
      await expectLater(
        reader.fetchReturns(read.site),
        throwsA(isA<ApiException>()),
      );
      expect(reader.hasDeniedRead(read.site), isTrue);
      api.reply = (_) async => returnPage(total: 0);
      await expectLater(
        reader.fetchReturns(read.site),
        throwsA(isA<FormatException>()),
      );
      expect(reader.hasDeniedRead(read.site), isTrue);
      expect(reader.returns, isEmpty);
      expect(reader.readPage, isNull);
    },
  );
  test('positive return read retains exact store/query options', () async {
    final api = ReturnsReadTransport();
    final reader = ReturnService(api: api);
    addTearDown(api.close);
    addTearDown(reader.dispose);
    expect(
      (await reader.fetchReturns(read.site)).single.id,
      'synthetic-return',
    );
    expect(reader.returns.single.storeId, read.site);
    expect(api.reads.single.storeId, read.site);
    expect(api.reads.single.query, {
      'store_id': read.site,
      'status': 'all',
      'page': 1,
      'limit': 20,
    });
    expect(reader.readPage, (
      storeId: read.site,
      status: 'all',
      page: 1,
      limit: 20,
      total: 1,
    ));
  });
  for (final status in [401, 403, 404]) {
    test('current return$status clears populated old presentation', () async {
      final api = ReturnsReadTransport();
      final reader = ReturnService(api: api);
      addTearDown(api.close);
      addTearDown(reader.dispose);
      await reader.fetchReturns(read.site);
      expect(reader.returns, isNotEmpty);
      api.reply = (_) async => throw read.failure(status);
      await expectLater(
        reader.fetchReturns(read.site),
        throwsA(isA<ApiException>()),
      );
      expect(reader.returns, isEmpty);
      expect(reader.readPage, isNull);
    });
  }
  test(
    'superseded return query cannot replace the latest populated query',
    () async {
      final api = ReturnsReadTransport();
      final service = ReturnService(api: api),
          held = Completer<PaginatedResponse<JsonMap>>();
      addTearDown(api.close);
      addTearDown(service.dispose);
      api.reply = (_) => held.future;
      final older = service.fetchReturns(read.site, status: 'requested');
      final retired = expectLater(older, read.changed());
      api.reply = (_) async =>
          returnPage(row: {...returnRow(), 'status': 'received'});
      await service.fetchReturns(read.site, status: 'received');
      held.complete(returnPage());
      await retired;
      expect(service.returns.single.status, 'received');
      expect(service.isLoading, isFalse);
    },
  );
  test(
    'foreign return row is never admitted to the selected store presentation',
    () async {
      final api = ReturnsReadTransport()
        ..reply = (_) async =>
            returnPage(row: returnRow(store: read.otherSite));
      final service = ReturnService(api: api);
      addTearDown(api.close);
      addTearDown(service.dispose);
      await expectLater(
        service.fetchReturns(read.site),
        throwsA(isA<FormatException>()),
      );
      expect(service.returns, isEmpty);
    },
  );
  test('disposed return read cannot settle a held private result', () async {
    final api = ReturnsReadTransport(),
        held = Completer<PaginatedResponse<JsonMap>>();
    final service = ReturnService(api: api);
    addTearDown(api.close);
    api.reply = (_) => held.future;
    final result = service.fetchReturns(read.site);
    // Register the expected rejection before releasing the transport.
    final rejected = expectLater(result, read.changed());
    service.dispose();
    held.complete(returnPage());
    await rejected;
  });
}
