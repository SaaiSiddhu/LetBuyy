import 'dart:convert';
import 'dart:typed_data';
import 'package:share_plus/share_plus.dart';
import '../../services/api_client.dart';

/// Share CSV bytes; the download URL is private to the merchant session.
Future<ShareResult> shareMerchantExport({
  required ApiClient api,
  required Map<String, dynamic> job,
  Future<ShareResult> Function(ShareParams)? share,
  bool Function()? isCurrent,
}) async {
  final id = job['id']?.toString() ?? '';
  final uri = Uri.tryParse(job['download_url']?.toString() ?? '');
  final token = uri?.queryParameters['token'];
  if (job['status'] != 'completed' ||
      id.isEmpty ||
      token == null ||
      token.isEmpty ||
      uri?.path != '/v1/export/jobs/$id/download') {
    throw const ApiException(
      message: 'Export download is unavailable.',
      statusCode: 502,
      code: 'INVALID_EXPORT_DOWNLOAD',
    );
  }
  void requireCurrentView() {
    if (isCurrent != null && !isCurrent()) {
      throw const ApiException(
        message:
            'The export screen changed. Reopen the export from the current store.',
        statusCode: 409,
        code: 'EXPORT_VIEW_CHANGED',
      );
    }
  }

  requireCurrentView();
  // Use the configured BFF and its normal session headers, never the URL origin.
  final csv = await api.exports.download(id, token: token);
  requireCurrentView();
  final filename = (job['filename']?.toString() ?? 'export.csv').replaceAll(
    RegExp(r'[^A-Za-z0-9_.-]'),
    '_',
  );
  return (share ?? SharePlus.instance.share)(
    ShareParams(
      files: [
        XFile.fromData(
          Uint8List.fromList(utf8.encode(csv)),
          mimeType: 'text/csv',
          name: filename,
        ),
      ],
      fileNameOverrides: [filename],
      subject: filename,
    ),
  );
}
