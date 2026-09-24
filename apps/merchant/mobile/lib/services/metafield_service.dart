import 'package:flutter/foundation.dart';

import 'api_client.dart';

class MetafieldService extends ChangeNotifier {
  MetafieldService({required ApiClient api}) : _api = api;

  final ApiClient _api;

  Future<List<StoreMetafieldDefinition>> fetchDefinitions(
    String storeId, {
    String ownerType = 'store',
  }) async {
    final rows = await _api.metafields.listDefinitions(
      query: {'store_id': storeId, 'owner_type': ownerType},
    );
    return rows.map(StoreMetafieldDefinition.fromJson).toList(growable: false);
  }

  Future<StoreMetafieldsSummary> fetchValues(
    String storeId, {
    String ownerType = 'store',
    String? ownerId,
  }) async {
    return StoreMetafieldsSummary.fromJson(
      await _api.metafields.listValues(
        query: {
          'store_id': storeId,
          'owner_type': ownerType,
          'owner_id': ownerId ?? storeId,
        },
      ),
    );
  }

  Future<StoreMetafieldDefinition> createDefinition(
    String storeId,
    Map<String, dynamic> input,
  ) async {
    return StoreMetafieldDefinition.fromJson(
      await _api.metafields.createDefinition({'store_id': storeId, ...input}),
    );
  }

  Future<StoreMetafieldDefinition> updateDefinition(
    String storeId,
    String definitionId,
    Map<String, dynamic> input,
  ) async {
    return StoreMetafieldDefinition.fromJson(
      await _api.metafields.updateDefinition(
        definitionId,
        input,
        query: {'store_id': storeId},
      ),
    );
  }

  Future<void> deleteDefinition(String storeId, String definitionId) async {
    await _api.metafields.deleteDefinition(
      definitionId,
      query: {'store_id': storeId},
    );
  }

  Future<StoreMetafieldValue> upsertValue({
    required String storeId,
    required String definitionId,
    String ownerType = 'store',
    String? ownerId,
    required Object? value,
  }) async {
    return StoreMetafieldValue.fromJson(
      await _api.metafields.upsertValue({
        'store_id': storeId,
        'definition_id': definitionId,
        'owner_type': ownerType,
        'owner_id': ownerId ?? storeId,
        'value': value,
      }),
    );
  }

  Future<void> deleteValue(String storeId, String valueId) async {
    await _api.metafields.deleteValue(valueId, query: {'store_id': storeId});
  }
}

class StoreMetafieldsSummary {
  const StoreMetafieldsSummary({
    required this.storeId,
    required this.ownerType,
    required this.ownerId,
    required this.definitions,
    required this.values,
    required this.schemaReady,
  });

  factory StoreMetafieldsSummary.fromJson(Map<String, dynamic> json) {
    return StoreMetafieldsSummary(
      storeId: json['store_id']?.toString() ?? '',
      ownerType: json['owner_type']?.toString() ?? 'store',
      ownerId: json['owner_id']?.toString() ?? '',
      definitions: _jsonList(
        json['definitions'],
      ).map(StoreMetafieldDefinition.fromJson).toList(growable: false),
      values: _jsonList(
        json['values'],
      ).map(StoreMetafieldValue.fromJson).toList(growable: false),
      schemaReady: json['schema_ready'] != false,
    );
  }

  final String storeId;
  final String ownerType;
  final String ownerId;
  final List<StoreMetafieldDefinition> definitions;
  final List<StoreMetafieldValue> values;
  final bool schemaReady;
}

class StoreMetafieldDefinition {
  const StoreMetafieldDefinition({
    required this.id,
    required this.ownerType,
    required this.namespace,
    required this.key,
    required this.name,
    required this.valueType,
    required this.isRequired,
    required this.isPublic,
    this.description,
  });

  factory StoreMetafieldDefinition.fromJson(Map<String, dynamic> json) {
    return StoreMetafieldDefinition(
      id: json['id']?.toString() ?? '',
      ownerType: json['owner_type']?.toString() ?? 'store',
      namespace: json['namespace']?.toString() ?? 'custom',
      key: json['key']?.toString() ?? '',
      name: json['name']?.toString() ?? 'Custom field',
      description: json['description']?.toString(),
      valueType: json['value_type']?.toString() ?? 'single_line_text',
      isRequired: json['is_required'] == true,
      isPublic: json['is_public'] == true,
    );
  }

  final String id;
  final String ownerType;
  final String namespace;
  final String key;
  final String name;
  final String? description;
  final String valueType;
  final bool isRequired;
  final bool isPublic;
}

class StoreMetafieldValue {
  const StoreMetafieldValue({
    required this.id,
    required this.definitionId,
    required this.ownerType,
    required this.ownerId,
    required this.value,
  });

  factory StoreMetafieldValue.fromJson(Map<String, dynamic> json) {
    return StoreMetafieldValue(
      id: json['id']?.toString() ?? '',
      definitionId: json['definition_id']?.toString() ?? '',
      ownerType: json['owner_type']?.toString() ?? 'store',
      ownerId: json['owner_id']?.toString() ?? '',
      value: json['value'],
    );
  }

  final String id;
  final String definitionId;
  final String ownerType;
  final String ownerId;
  final Object? value;
}

List<Map<String, dynamic>> _jsonList(Object? value) {
  if (value is! List) return const [];
  return value
      .whereType<Map>()
      .map((row) => Map<String, dynamic>.from(row))
      .toList(growable: false);
}
