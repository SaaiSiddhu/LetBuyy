import 'dart:convert';
import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_models/letbuyy_models.dart';

Map<String, dynamic> fixture() => jsonDecode(
  File(
    '../../../tests/fixtures/collection-metadata-contracts.json',
  ).readAsStringSync(),
);
void main() {
  test(
    'canonical TS/Dart fixtures preserve unknown dates, exact pages and bounded preview',
    () {
      final f = fixture(),
          row = CollectionMetadataContract.fromJson(f['row']),
          page = SmartCollectionPage.fromParts(
            f['page']['data'],
            f['page']['meta'],
          ),
          preview = SmartCollectionPreview.fromJson(f['preview']);
      expect(row.json['created_at'], isNull);
      expect(page.total, 1);
      expect(preview.isExact, false);
      expect(preview.catalogCount, 1005);
      final receipt = CollectionMetadataReceipt.confirm(
        f['receipt'],
        actorId: f['actor'],
        operation: 'update',
        id: row.id,
        command: f['command'],
      );
      expect(receipt.collection.version, 8);
      expect(
        () => receipt.json['request']['conditions'].clear(),
        throwsUnsupportedError,
      );
    },
  );
  test('a rebound receipt cannot clear the original command', () {
    final f = fixture();
    for (final patch in [
      {'actor_id': f['command']['store_id']},
      {'store_id': f['actor']},
      {'operation': 'create'},
      {'version': 7},
      {'expected_version': 6},
      {'id': f['actor']},
      {'collection_type': 'manual'},
      {
        'request': {...f['receipt']['request'], 'conditions': []},
      },
      {
        'request': {...f['receipt']['request'], 'unexpected': true},
      },
    ]) {
      expect(
        () => CollectionMetadataReceipt.confirm(
          {...f['receipt'], ...patch},
          actorId: f['actor'],
          operation: 'update',
          id: f['row']['id'],
          command: f['command'],
        ),
        throwsFormatException,
      );
    }
  });
  test(
    'invalid population arithmetic, partial claims and unsupported rules fail closed',
    () {
      final f = fixture();
      for (final patch in [
        {'total': 0},
        {'total_is_exact': false},
        {'has_next': true},
      ]) {
        expect(
          () => SmartCollectionPage.fromParts(f['page']['data'], {
            ...f['page']['meta'],
            ...patch,
          }),
          throwsFormatException,
        );
      }
      for (final patch in [
        {'count_is_exact': true},
        {'catalog_count': 0},
        {
          'sample_product_ids': [f['actor']],
        },
      ]) {
        expect(
          () => SmartCollectionPreview.fromJson({...f['preview'], ...patch}),
          throwsFormatException,
        );
      }
      for (final conditions in [
        [
          {'field': '__proto__', 'op': 'execute', 'value': 'x'},
        ],
        [
          {'field': 'title', 'op': 'equals', 'value': 1},
        ],
      ]) {
        expect(
          () => validateCollectionMetadataCommand('update', {
            ...f['command'],
            'conditions': conditions,
          }),
          throwsFormatException,
        );
      }
    },
  );
  test('immutable type alone cannot become a metadata update', () {
    final f = fixture();
    expect(
      () => validateCollectionMetadataCommand('update', {
        'store_id': f['command']['store_id'],
        'idempotency_key': f['command']['idempotency_key'],
        'version': 7,
        'collection_type': 'smart',
      }),
      throwsFormatException,
    );
  });
}
