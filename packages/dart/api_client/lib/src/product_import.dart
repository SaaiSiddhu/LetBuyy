import 'dart:convert';
import 'package:crypto/crypto.dart';
import 'types.dart';

JsonMap validateProductImportRequest(JsonMap input) {
  final id = RegExp(
    r'^[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}$',
  );
  if (input.length != 4 ||
      ![
        'store_id',
        'idempotency_key',
        'contract_version',
        'csv',
      ].every(input.containsKey) ||
      input['store_id'] is! String ||
      !id.hasMatch(input['store_id']) ||
      input['idempotency_key'] is! String ||
      !id.hasMatch(input['idempotency_key']) ||
      input['contract_version'] != 2 ||
      input['csv'] is! String ||
      (input['csv'] as String).trim().isEmpty)
    throw const FormatException(
      'An original import identity and CSV are required.',
    );
  if (utf8.encode(input['csv']).length > 1048576 ||
      utf8.encode(jsonEncode(input)).length > 1048576)
    throw const FormatException(
      'Split this CSV into smaller files; each formatted request must fit one MiB.',
    );
  return Map.unmodifiable(input);
}

/// Exact UTF-8 source identity; preserve whitespace and quoted record bytes.
String productImportSourceSha256(String source) =>
    sha256.convert(utf8.encode(source)).toString();
String decodeProductImportBytes(List<int> bytes) {
  if (bytes.isEmpty || bytes.length > 1048576)
    throw const FormatException('Use a nonempty CSV of at most one MiB.');
  // Preserve the BOM in the source fingerprint; the canonical parser owns it.
  final bom =
      bytes.length >= 3 &&
      bytes[0] == 239 &&
      bytes[1] == 187 &&
      bytes[2] == 191;
  return (bom ? '\uFEFF' : '') +
      utf8.decode(bom ? bytes.sublist(3) : bytes, allowMalformed: false);
}
