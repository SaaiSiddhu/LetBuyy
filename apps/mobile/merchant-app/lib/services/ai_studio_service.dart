import 'package:flutter/foundation.dart';

import 'api_client.dart';
import 'skip_needs_backend_exception.dart';

class AiCreditsContract {
  const AiCreditsContract({
    required this.storeId,
    required this.balance,
    required this.planCredits,
    required this.bonusCredits,
    required this.totalUsed,
    required this.totalPurchased,
  });

  factory AiCreditsContract.fromJson(Map<String, dynamic> json) {
    return AiCreditsContract(
      storeId: _stringValue(json['store_id'] ?? json['site_id']),
      balance: _numValue(json['balance'] ?? json['remaining']),
      planCredits: _numValue(json['plan_credits'] ?? json['total_credits']),
      bonusCredits: _numValue(json['bonus_credits']),
      totalUsed: _numValue(json['total_used'] ?? json['used_credits']),
      totalPurchased: _numValue(json['total_purchased']),
    );
  }

  final String storeId;
  final num balance;
  final num planCredits;
  final num bonusCredits;
  final num totalUsed;
  final num totalPurchased;

  num get totalCredits {
    final total = planCredits + bonusCredits + totalPurchased;
    return total > 0 ? total : balance + totalUsed;
  }

  int get percentUsed {
    final total = totalCredits;
    if (total <= 0) return 0;
    return ((totalUsed / total) * 100).round().clamp(0, 100);
  }
}

class AiUsageContract {
  const AiUsageContract({
    required this.id,
    required this.storeId,
    required this.feature,
    required this.prompt,
    required this.output,
    required this.tokensInput,
    required this.tokensOutput,
    required this.creditsUsed,
    required this.model,
    required this.provider,
    required this.status,
    required this.errorMessage,
    required this.userRating,
    required this.userFeedback,
    required this.createdAt,
  });

  factory AiUsageContract.fromJson(Map<String, dynamic> json) {
    return AiUsageContract(
      id: _stringValue(json['id']),
      storeId: _stringValue(json['store_id'] ?? json['site_id']),
      feature: _stringValue(json['feature'], fallback: 'custom'),
      prompt: _stringValue(json['prompt']),
      output: _stringValue(json['output']),
      tokensInput: _intValue(json['tokens_input'] ?? json['input_tokens']),
      tokensOutput: _intValue(json['tokens_output'] ?? json['output_tokens']),
      creditsUsed: _numValue(json['credits_used']),
      model: _stringValue(json['model']),
      provider: _stringValue(json['provider']),
      status: _stringValue(json['status'], fallback: 'completed'),
      errorMessage: _stringValue(json['error_message']),
      userRating: _intValue(json['user_rating']),
      userFeedback: _stringValue(json['user_feedback']),
      createdAt: _stringValue(json['created_at']),
    );
  }

  final String id;
  final String storeId;
  final String feature;
  final String prompt;
  final String output;
  final int tokensInput;
  final int tokensOutput;
  final num creditsUsed;
  final String model;
  final String provider;
  final String status;
  final String errorMessage;
  final int userRating;
  final String userFeedback;
  final String createdAt;

  int get totalTokens => tokensInput + tokensOutput;
  String get featureLabel => _titleCase(feature);
}

class AiToolContract {
  const AiToolContract({
    required this.feature,
    required this.label,
    required this.iconName,
  });

  final String feature;
  final String label;
  final String iconName;
}

class AiStudioSnapshot {
  const AiStudioSnapshot({required this.credits, required this.usage});

  final AiCreditsContract credits;
  final List<AiUsageContract> usage;
}

class AiStudioService extends ChangeNotifier {
  AiStudioService({required ApiClient api}) : _api = api;

  static const generationSkipId = 'MOBILE_AI_GENERATION_PROVIDER';
  static const creditPurchaseSkipId = 'MOBILE_AI_CREDIT_PURCHASE';

  static const tools = [
    AiToolContract(
      feature: 'product_description',
      label: 'Product descriptions',
      iconName: 'description',
    ),
    AiToolContract(feature: 'seo_meta', label: 'SEO metadata', iconName: 'seo'),
    AiToolContract(
      feature: 'blog_post',
      label: 'Blog drafts',
      iconName: 'blog',
    ),
    AiToolContract(
      feature: 'social_copy',
      label: 'Social posts',
      iconName: 'share',
    ),
    AiToolContract(
      feature: 'email_campaign',
      label: 'Email copy',
      iconName: 'email',
    ),
    AiToolContract(feature: 'ad_copy', label: 'Ad copy', iconName: 'campaign'),
  ];

  final ApiClient _api;

  AiCreditsContract? _credits;
  AiCreditsContract? get credits => _credits;

  List<AiUsageContract> _usage = [];
  List<AiUsageContract> get usage => List.unmodifiable(_usage);

  bool _isLoading = false;
  bool get isLoading => _isLoading;

  Map<String, dynamic>? _lastGenerationAttempt;
  Map<String, dynamic>? get lastGenerationAttempt => _lastGenerationAttempt;

  Future<AiStudioSnapshot> fetchStudio(String storeId) async {
    _isLoading = true;
    notifyListeners();
    try {
      final results = await Future.wait([
        _api.ai.credits(storeId),
        _api.ai.usage(storeId: storeId, limit: 50),
      ]);
      _credits = AiCreditsContract.fromJson(results[0] as Map<String, dynamic>);
      _usage = (results[1] as PaginatedResponse<JsonMap>).data
          .map(AiUsageContract.fromJson)
          .toList(growable: false);
      return AiStudioSnapshot(credits: _credits!, usage: _usage);
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<AiUsageContract> rateUsage(
    AiUsageContract usage, {
    required int rating,
    String? feedback,
  }) async {
    final updated = AiUsageContract.fromJson(
      await _api.ai.rateUsage(usage.id, {
        'rating': rating,
        if (feedback != null && feedback.trim().isNotEmpty)
          'feedback': feedback.trim(),
      }),
    );
    _usage = _usage
        .map((item) => item.id == updated.id ? updated : item)
        .toList(growable: false);
    notifyListeners();
    return updated;
  }

  Future<void> generateContent({
    required String storeId,
    required String feature,
    required String prompt,
  }) async {
    _lastGenerationAttempt = {
      'store_id': storeId,
      'feature': feature,
      'prompt': prompt.trim(),
    };
    notifyListeners();
    // [SKIP-NEEDS-BACKEND: MOBILE_AI_GENERATION_PROVIDER]
    throw const SkipNeedsBackendException(
      generationSkipId,
      'AI generation provider execution is not configured for the gateway environment.',
    );
  }

  Future<void> purchaseCredits({
    required String storeId,
    required int amount,
  }) async {
    // [SKIP-NEEDS-BACKEND: MOBILE_AI_CREDIT_PURCHASE]
    throw const SkipNeedsBackendException(
      creditPurchaseSkipId,
      'AI credit purchase checkout is not configured for mobile-safe gateway execution.',
    );
  }
}

String _stringValue(Object? value, {String fallback = ''}) {
  final text = value?.toString().trim();
  return text == null || text.isEmpty ? fallback : text;
}

int _intValue(Object? value) {
  if (value is int) return value;
  if (value is num) return value.toInt();
  if (value is String) return int.tryParse(value) ?? 0;
  return 0;
}

num _numValue(Object? value) {
  if (value is num) return value;
  if (value is String) return num.tryParse(value) ?? 0;
  return 0;
}

String _titleCase(String value) {
  return value
      .replaceAll('_', ' ')
      .split(RegExp(r'\s+'))
      .where((part) => part.isNotEmpty)
      .map((part) => part[0].toUpperCase() + part.substring(1))
      .join(' ');
}
