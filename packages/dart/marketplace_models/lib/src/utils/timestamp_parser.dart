import 'package:cloud_firestore/cloud_firestore.dart';

/// Shared utility for parsing timestamps from Firestore
/// 
/// Handles:
/// - Firestore Timestamp objects
/// - ISO 8601 date strings
/// - DateTime objects (passthrough)
/// - null values
/// 
/// Usage:
/// ```dart
/// import 'package:letbuyy_marketplace_models/src/utils/timestamp_parser.dart';
/// 
/// final date = parseTimestamp(map['createdAt']);
/// ```
DateTime? parseTimestamp(dynamic value) {
  if (value == null) return null;
  if (value is Timestamp) return value.toDate();
  if (value is String) {
    try {
      return DateTime.parse(value);
    } catch (_) {
      return null;
    }
  }
  if (value is DateTime) return value;
  return null;
}

/// Parse a timestamp with a default fallback value
DateTime parseTimestampWithDefault(dynamic value, DateTime defaultValue) {
  return parseTimestamp(value) ?? defaultValue;
}
