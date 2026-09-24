import 'dart:io';

import 'package:flutter/foundation.dart';

import 'api_client.dart';

/// Storage service using the LetBuyy API (R2 backend).
///
/// Uses multipart uploads to the governed API gateway/BFF transport.
class StorageService {
  final ApiClient _api;

  StorageService({required ApiClient api}) : _api = api;

  /// Uploads an image file and returns the CDN URL.
  ///
  /// [file] is the image file to upload.
  /// [path] is the storage folder. Defaults to 'uploads'.
  Future<String> uploadImage(File file, {String path = 'uploads'}) async {
    try {
      return await _api.uploadFile(file, folder: path);
    } catch (e) {
      debugPrint('❌ Error uploading image: $e');
      rethrow;
    }
  }

  /// Deletes an image by its CDN URL.
  ///
  /// Extracts the R2 key from the URL and sends a DELETE request.
  Future<void> deleteImage(String imageUrl) async {
    try {
      // Extract the key from the CDN URL
      // e.g. https://cdn.letbuyy.com/uploads/userId/file.jpg → uploads/userId/file.jpg
      final uri = Uri.parse(imageUrl);
      final key = uri.path.startsWith('/') ? uri.path.substring(1) : uri.path;
      await _api.delete('upload/$key');
    } catch (e) {
      debugPrint('❌ Error deleting image: $e');
      // Don't rethrow – this is cleanup
    }
  }
}
