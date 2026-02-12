import 'dart:convert';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:supabase_flutter/supabase_flutter.dart';

import '../config/supabase_config.dart';

/// Centralised HTTP client for the LetBuyy API.
///
/// Auto‑injects the current Supabase access‑token as a Bearer header and
/// provides typed JSON helpers for every HTTP verb used by the app.
class ApiClient extends ChangeNotifier {
  final String _baseUrl;
  final http.Client _http;

  ApiClient({String? baseUrl, http.Client? client})
      : _baseUrl = baseUrl ?? AppConfig.apiBaseUrl,
        _http = client ?? http.Client();

  // ── Helpers ──────────────────────────────────────────────

  /// Current Supabase access token, or `null` if not signed in.
  String? get _accessToken =>
      Supabase.instance.client.auth.currentSession?.accessToken;

  Map<String, String> get _headers => {
        'Content-Type': 'application/json',
        if (_accessToken != null) 'Authorization': 'Bearer $_accessToken',
      };

  Uri _uri(String path, [Map<String, dynamic>? queryParams]) {
    final cleanPath = path.startsWith('/') ? path.substring(1) : path;
    final uri = Uri.parse('$_baseUrl/$cleanPath');
    if (queryParams == null || queryParams.isEmpty) return uri;
    return uri.replace(
      queryParameters: queryParams.map((k, v) => MapEntry(k, v.toString())),
    );
  }

  /// Throws on non‑2xx responses; returns decoded JSON body.
  dynamic _handleResponse(http.Response res) {
    if (res.statusCode == 401) {
      // Token expired or invalid – sign out locally
      Supabase.instance.client.auth.signOut();
      throw ApiException('Session expired. Please sign in again.', 401);
    }
    final body = res.body.isNotEmpty ? jsonDecode(res.body) : null;
    if (res.statusCode >= 200 && res.statusCode < 300) {
      return body;
    }
    final msg = body is Map ? (body['error']?['message'] ?? 'Unknown error') : 'Request failed';
    throw ApiException(msg, res.statusCode);
  }

  // ── Public verbs ─────────────────────────────────────────

  Future<dynamic> get(String path, {Map<String, dynamic>? query}) async {
    final res = await _http.get(_uri(path, query), headers: _headers);
    return _handleResponse(res);
  }

  Future<dynamic> post(String path, {Object? body}) async {
    final res = await _http.post(
      _uri(path),
      headers: _headers,
      body: body != null ? jsonEncode(body) : null,
    );
    return _handleResponse(res);
  }

  Future<dynamic> patch(String path, {Object? body}) async {
    final res = await _http.patch(
      _uri(path),
      headers: _headers,
      body: body != null ? jsonEncode(body) : null,
    );
    return _handleResponse(res);
  }

  Future<dynamic> delete(String path) async {
    final res = await _http.delete(_uri(path), headers: _headers);
    return _handleResponse(res);
  }

  // ── Multipart upload ─────────────────────────────────────

  /// Uploads a file to [POST /upload]. Returns the CDN URL string.
  Future<String> uploadFile(File file, {String folder = 'uploads'}) async {
    final request = http.MultipartRequest('POST', _uri('upload'));
    request.headers.addAll({
      if (_accessToken != null) 'Authorization': 'Bearer $_accessToken',
    });
    request.fields['folder'] = folder;
    request.files.add(
      await http.MultipartFile.fromPath('file', file.path),
    );

    final streamed = await _http.send(request);
    final res = await http.Response.fromStream(streamed);
    final body = _handleResponse(res);
    return body['data']['url'] as String;
  }

  // ── Cleanup ──────────────────────────────────────────────

  @override
  void dispose() {
    _http.close();
    super.dispose();
  }
}

/// Typed API error with HTTP status code.
class ApiException implements Exception {
  final String message;
  final int statusCode;
  const ApiException(this.message, this.statusCode);

  @override
  String toString() => message;
}
