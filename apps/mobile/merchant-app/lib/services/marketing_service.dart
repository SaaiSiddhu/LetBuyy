import 'package:flutter/foundation.dart';

import 'api_client.dart';

class MarketingUnavailableException implements Exception {
  const MarketingUnavailableException([
    this.message = 'Email campaigns are unavailable right now.',
  ]);

  final String message;

  @override
  String toString() => message;
}

class MarketingService extends ChangeNotifier {
  MarketingService({required ApiClient api}) : _api = api;

  final ApiClient _api;

  bool _isLoading = false;
  bool get isLoading => _isLoading;

  List<Map<String, dynamic>> _campaigns = [];
  List<Map<String, dynamic>> get campaigns => List.unmodifiable(_campaigns);

  Future<List<Map<String, dynamic>>> fetchCampaigns(
    String storeId, {
    int page = 1,
    int limit = 20,
    String? status,
  }) async {
    _isLoading = true;
    notifyListeners();
    try {
      final result = await _friendlyUnavailable(
        () => _api.marketing.emailCampaigns.list(
          storeId: storeId,
          page: page,
          limit: limit,
          status: status,
        ),
      );
      _campaigns = result.data
          .map((row) => Map<String, dynamic>.from(row))
          .toList(growable: false);
      return _campaigns;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<Map<String, dynamic>> previewAudience({
    required String storeId,
    required Map<String, dynamic> audience,
  }) {
    return _friendlyUnavailable(
      () => _api.marketing.emailCampaigns.previewAudience({
        'store_id': storeId,
        'audience': audience,
      }),
    );
  }

  Future<Map<String, dynamic>> createCampaign({
    required String storeId,
    required String name,
    required String subject,
    required String bodyText,
    String? previewText,
    String? bodyHtml,
    required Map<String, dynamic> audience,
  }) async {
    final campaign = await _friendlyUnavailable(
      () => _api.marketing.emailCampaigns.create({
        'store_id': storeId,
        'name': name.trim(),
        'subject': subject.trim(),
        'body_text': bodyText.trim(),
        if (previewText != null && previewText.trim().isNotEmpty)
          'preview_text': previewText.trim(),
        if (bodyHtml != null && bodyHtml.trim().isNotEmpty)
          'body_html': bodyHtml.trim(),
        'audience': audience,
      }),
    );
    _upsertCampaign(campaign);
    return campaign;
  }

  Future<Map<String, dynamic>> sendCampaign({
    required String storeId,
    required String campaignId,
  }) async {
    final response = await _friendlyUnavailable(
      () => _api.marketing.emailCampaigns.send(campaignId, {
        'store_id': storeId,
        'idempotency_key':
            'email_campaign_${campaignId}_${DateTime.now().microsecondsSinceEpoch}',
      }),
    );
    final campaign = response['campaign'];
    if (campaign is Map) {
      _upsertCampaign(Map<String, dynamic>.from(campaign));
    }
    return response;
  }

  void _upsertCampaign(Map<String, dynamic> campaign) {
    final id = campaign['id']?.toString();
    if (id == null || id.isEmpty) return;
    final index = _campaigns.indexWhere((row) => row['id']?.toString() == id);
    if (index >= 0) {
      _campaigns = [
        ..._campaigns.take(index),
        campaign,
        ..._campaigns.skip(index + 1),
      ];
    } else {
      _campaigns = [campaign, ..._campaigns];
    }
    notifyListeners();
  }

  Future<T> _friendlyUnavailable<T>(Future<T> Function() action) async {
    try {
      return await action();
    } on ApiException catch (error) {
      if (error.code == 'EMAIL_UNAVAILABLE' ||
          error.code == 'EMAIL_FAILED' ||
          error.code == 'SERVICE_UNAVAILABLE') {
        throw const MarketingUnavailableException();
      }
      rethrow;
    }
  }
}
