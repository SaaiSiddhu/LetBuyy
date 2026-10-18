import 'package:flutter/foundation.dart';

import 'api_client.dart';
import 'theme_service.dart';
import '../models/theme_editor_models.dart';

class AiCreditsContract {
  const AiCreditsContract({
    required this.storeId,
    required this.balance,
    required this.planCredits,
    required this.bonusCredits,
    required this.totalUsed,
    required this.totalPurchased,
    required this.purchaseAvailable,
    required this.purchaseMode,
    required this.purchaseProvider,
  });

  factory AiCreditsContract.fromJson(Map<String, dynamic> json) {
    return AiCreditsContract(
      storeId: _stringValue(json['store_id'] ?? json['site_id']),
      balance: _numValue(json['balance'] ?? json['remaining']),
      planCredits: _numValue(json['plan_credits'] ?? json['total_credits']),
      bonusCredits: _numValue(json['bonus_credits']),
      totalUsed: _numValue(json['total_used'] ?? json['used_credits']),
      totalPurchased: _numValue(json['total_purchased']),
      purchaseAvailable: json['purchase_available'] == true,
      purchaseMode: _stringValue(json['purchase_mode']),
      purchaseProvider: _stringValue(json['purchase_provider']),
    );
  }

  final String storeId;
  final num balance;
  final num planCredits;
  final num bonusCredits;
  final num totalUsed;
  final num totalPurchased;
  final bool purchaseAvailable;
  final String purchaseMode;
  final String purchaseProvider;

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

class AiCreditPurchaseContract {
  const AiCreditPurchaseContract({
    required this.id,
    required this.storeId,
    required this.status,
    required this.provider,
    required this.providerMode,
    required this.credits,
    required this.amountMinor,
    required this.currency,
    required this.providerReference,
    required this.checkoutUrl,
  });

  factory AiCreditPurchaseContract.fromJson(Map<String, dynamic> json) {
    return AiCreditPurchaseContract(
      id: _stringValue(json['id']),
      storeId: _stringValue(json['store_id'] ?? json['site_id']),
      status: _stringValue(json['status'], fallback: 'completed'),
      provider: _stringValue(json['provider']),
      providerMode: _stringValue(json['provider_mode']),
      credits: _intValue(json['credits']),
      amountMinor: _intValue(json['amount_minor']),
      currency: _stringValue(json['currency'], fallback: 'INR'),
      providerReference: _stringValue(json['provider_reference']),
      checkoutUrl: _stringValue(json['checkout_url']),
    );
  }

  final String id;
  final String storeId;
  final String status;
  final String provider;
  final String providerMode;
  final int credits;
  final int amountMinor;
  final String currency;
  final String providerReference;
  final String checkoutUrl;

  bool get completed => status == 'completed';
}

class AiOperatorToolCall {
  const AiOperatorToolCall({
    required this.id,
    required this.tool,
    required this.label,
    required this.status,
    required this.summary,
    required this.payload,
    required this.result,
  });

  factory AiOperatorToolCall.fromJson(Map<String, dynamic> json) {
    return AiOperatorToolCall(
      id: _stringValue(json['id']),
      tool: _stringValue(json['tool']),
      label: _stringValue(json['label']),
      status: _stringValue(json['status'], fallback: 'ready'),
      summary: _stringValue(json['summary']),
      payload: _mapValue(json['payload']),
      result: json['result'] is Map ? _mapValue(json['result']) : null,
    );
  }

  final String id;
  final String tool;
  final String label;
  final String status;
  final String summary;
  final Map<String, dynamic> payload;
  final Map<String, dynamic>? result;

  bool get ready => status == 'ready';

  AiOperatorToolCall copyWith({
    String? status,
    String? summary,
    Map<String, dynamic>? result,
  }) {
    return AiOperatorToolCall(
      id: id,
      tool: tool,
      label: label,
      status: status ?? this.status,
      summary: summary ?? this.summary,
      payload: payload,
      result: result ?? this.result,
    );
  }
}

class AiOperatorResult {
  const AiOperatorResult({
    required this.storeId,
    required this.conversationId,
    required this.message,
    required this.toolCalls,
    required this.createdAt,
  });

  factory AiOperatorResult.fromJson(Map<String, dynamic> json) {
    return AiOperatorResult(
      storeId: _stringValue(json['store_id'] ?? json['site_id']),
      conversationId: _stringValue(json['conversation_id']),
      message: _stringValue(json['message']),
      toolCalls: (json['tool_calls'] as List? ?? const [])
          .whereType<Map>()
          .map(
            (item) =>
                AiOperatorToolCall.fromJson(Map<String, dynamic>.from(item)),
          )
          .toList(growable: false),
      createdAt: _stringValue(json['created_at']),
    );
  }

  final String storeId;
  final String conversationId;
  final String message;
  final List<AiOperatorToolCall> toolCalls;
  final String createdAt;

  AiOperatorResult copyWith({List<AiOperatorToolCall>? toolCalls}) {
    return AiOperatorResult(
      storeId: storeId,
      conversationId: conversationId,
      message: message,
      toolCalls: toolCalls ?? this.toolCalls,
      createdAt: createdAt,
    );
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

class AiHomepageDraft {
  const AiHomepageDraft({
    required this.storeId,
    required this.themeSlug,
    required this.prompt,
    required this.title,
    required this.summary,
    required this.templateConfig,
    required this.sections,
    required this.generatedAt,
    this.usage,
  });

  factory AiHomepageDraft.fromJson(Map<String, dynamic> json) {
    return AiHomepageDraft(
      storeId: _stringValue(json['store_id'] ?? json['site_id']),
      themeSlug: _stringValue(json['theme_slug'], fallback: 'minimal_modern'),
      prompt: _stringValue(json['prompt']),
      title: _stringValue(json['title'], fallback: 'Homepage draft'),
      summary: _stringValue(json['summary']),
      templateConfig: _mapValue(json['template_config']),
      sections: (json['sections'] as List? ?? const [])
          .whereType<Map>()
          .map((item) => Map<String, dynamic>.from(item))
          .toList(growable: false),
      generatedAt: _stringValue(json['generated_at']),
      usage: json['usage'] is Map
          ? AiUsageContract.fromJson(
              Map<String, dynamic>.from(json['usage'] as Map),
            )
          : null,
    );
  }

  final String storeId;
  final String themeSlug;
  final String prompt;
  final String title;
  final String summary;
  final Map<String, dynamic> templateConfig;
  final List<Map<String, dynamic>> sections;
  final String generatedAt;
  final AiUsageContract? usage;
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

class AiFeatureUnavailableException implements Exception {
  const AiFeatureUnavailableException();

  static const message =
      'AI generation is temporarily unavailable. Please try again later.';

  @override
  String toString() => message;
}

class AiCreditPurchaseUnavailableException implements Exception {
  const AiCreditPurchaseUnavailableException();

  static const message =
      'Credit purchase is temporarily unavailable. Please try again later.';

  @override
  String toString() => message;
}

class AiOperatorUnavailableException implements Exception {
  const AiOperatorUnavailableException();

  static const message =
      'AI operator is temporarily unavailable. Please try again later.';

  @override
  String toString() => message;
}

class AiStudioService extends ChangeNotifier {
  AiStudioService({required ApiClient api})
    : _api = api,
      _themeService = ThemeService(api: api);

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
  final ThemeService _themeService;

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

  Future<AiUsageContract> generateContent({
    required String storeId,
    required String feature,
    required String prompt,
  }) async {
    final cleanedPrompt = prompt.trim();
    _lastGenerationAttempt = {
      'store_id': storeId,
      'feature': feature,
      'prompt': cleanedPrompt,
    };
    notifyListeners();
    try {
      final payload = await _api.ai.generate({
        'store_id': storeId,
        'feature': feature,
        'prompt': cleanedPrompt,
      });
      final usagePayload = payload['usage'] is Map
          ? Map<String, dynamic>.from(payload['usage'] as Map)
          : payload;
      final generated = AiUsageContract.fromJson(usagePayload);
      if (payload['credits'] is Map) {
        _credits = AiCreditsContract.fromJson(
          Map<String, dynamic>.from(payload['credits'] as Map),
        );
      }
      _usage = [generated, ..._usage.where((item) => item.id != generated.id)];
      notifyListeners();
      return generated;
    } on ApiException catch (error) {
      if (error.code == 'AI_PROVIDER_UNCONFIGURED' ||
          error.code == 'AI_PROVIDER_FAILED') {
        throw const AiFeatureUnavailableException();
      }
      rethrow;
    }
  }

  Future<AiHomepageDraft> generateHomepageDraft({
    required String storeId,
    required String themeSlug,
    required String prompt,
    required Map<String, dynamic> templateConfig,
    int sectionCount = 3,
  }) async {
    final cleanedPrompt = prompt.trim();
    _lastGenerationAttempt = {
      'store_id': storeId,
      'feature': 'homepage_generator',
      'prompt': cleanedPrompt,
    };
    notifyListeners();
    try {
      final payload = await _api.ai.homepage({
        'store_id': storeId,
        'theme_slug': themeSlug,
        'prompt': cleanedPrompt,
        'section_count': sectionCount,
        'template_config': templateConfig,
      });
      final draft = AiHomepageDraft.fromJson(payload);
      if (draft.usage != null) {
        _usage = [
          draft.usage!,
          ..._usage.where((item) => item.id != draft.usage!.id),
        ];
      }
      notifyListeners();
      return draft;
    } on ApiException catch (error) {
      if (error.code == 'AI_HOMEPAGE_GENERATOR_UNAVAILABLE' ||
          error.code == 'AI_PROVIDER_UNCONFIGURED' ||
          error.code == 'AI_PROVIDER_FAILED') {
        throw const AiFeatureUnavailableException();
      }
      rethrow;
    }
  }

  Future<AiCreditPurchaseContract> purchaseCredits({
    required String storeId,
    required int amount,
  }) async {
    try {
      final payload = await _api.ai.purchaseCredits({
        'store_id': storeId,
        'amount': amount,
        'idempotency_key': 'ai-credit-${DateTime.now().microsecondsSinceEpoch}',
      });
      final purchasePayload = payload['purchase'] is Map
          ? Map<String, dynamic>.from(payload['purchase'] as Map)
          : payload;
      final purchase = AiCreditPurchaseContract.fromJson(purchasePayload);
      if (payload['credits'] is Map) {
        _credits = AiCreditsContract.fromJson(
          Map<String, dynamic>.from(payload['credits'] as Map),
        );
      }
      notifyListeners();
      return purchase;
    } on ApiException catch (error) {
      if (error.code == 'AI_CREDIT_PURCHASE_UNAVAILABLE') {
        throw const AiCreditPurchaseUnavailableException();
      }
      rethrow;
    }
  }

  Future<AiOperatorResult> runOperatorCommand({
    required String storeId,
    required String message,
  }) async {
    final cleanedMessage = message.trim();
    if (cleanedMessage.isEmpty) {
      throw ArgumentError.value(message, 'message', 'Message is required');
    }

    final requestContext = _api.captureRequestContext();
    ThemeEditorPayload? themeBase;
    // Capture a canonical draft revision BEFORE planning. A later load must not
    // silently authorize a generated document over another session's edits.
    try {
      final catalog = await _themeService.fetchThemes(storeId);
      if (catalog.currentTheme != null) {
        themeBase = await _themeService.loadEditor(
          storeId: storeId,
          themeSlug: catalog.currentTheme!,
        );
      }
    } catch (_) {
      /* Other operator tools can still run; theme writes require this snapshot. */
    }
    if (_api.captureRequestContext() != requestContext)
      throw StateError('The active account or store changed.');
    try {
      final payload = await _api.ai.operator({
        'store_id': storeId,
        'message': cleanedMessage,
        'execute': true,
      });
      if (_api.captureRequestContext() != requestContext)
        throw StateError('The active account or store changed.');
      final planned = AiOperatorResult.fromJson(payload);
      final completedCalls = <AiOperatorToolCall>[];
      for (final call in planned.toolCalls) {
        if (!call.ready) {
          completedCalls.add(call);
          continue;
        }
        try {
          final result = await _executeOperatorTool(
            storeId,
            call,
            themeBase: themeBase,
            requestContext: requestContext,
          );
          completedCalls.add(
            call.copyWith(
              status: 'completed',
              summary: _operatorCompletionSummary(call, result),
              result: result,
            ),
          );
        } catch (_) {
          completedCalls.add(
            call.copyWith(
              status: 'unavailable',
              summary: '${call.label} could not be completed.',
              result: const {'completed': false},
            ),
          );
        }
      }
      final completed = planned.copyWith(toolCalls: completedCalls);
      notifyListeners();
      return completed;
    } on ApiException catch (error) {
      if (error.code == 'AI_OPERATOR_UNAVAILABLE' ||
          error.code == 'AI_PROVIDER_UNCONFIGURED' ||
          error.code == 'AI_PROVIDER_FAILED') {
        throw const AiOperatorUnavailableException();
      }
      rethrow;
    }
  }

  Future<Map<String, dynamic>> _executeOperatorTool(
    String storeId,
    AiOperatorToolCall call, {
    ThemeEditorPayload? themeBase,
    Object? requestContext,
  }) async {
    if (_api.captureRequestContext() != requestContext)
      throw StateError('The active account or store changed.');
    final payload = Map<String, dynamic>.from(call.payload);
    payload['store_id'] = _stringValue(payload['store_id'], fallback: storeId);
    switch (call.tool) {
      case 'answer_metrics':
        return _mapValue(call.result);
      case 'create_product':
        return _mapValue(await _api.products.create(payload));
      case 'draft_discount':
        return _mapValue(await _api.coupons.create(payload));
      case 'draft_homepage_section':
        final themeSlug = _stringValue(
          payload['theme_slug'],
          fallback: 'minimal_modern',
        );
        if (themeBase == null ||
            themeBase.store['id'] != storeId ||
            themeBase.theme['slug'] != themeSlug ||
            call.id.isEmpty ||
            call.id.length > 180 ||
            call.id.trim() != call.id ||
            RegExp(r'[\x00-\x1f\x7f]').hasMatch(call.id)) {
          throw StateError(
            'Reload the owned theme before planning this change.',
          );
        }
        if (_themeService.hasPendingSave(storeId, themeSlug)) {
          await _themeService.retryPendingSave(
            storeId: storeId,
            themeSlug: themeSlug,
          );
        }
        final saved = await _themeService.saveDraft(
          storeId: storeId,
          themeSlug: themeSlug,
          templateConfig: _mapValue(payload['template_config']),
          baseVersion: themeBase.version,
          idempotencyKey: 'ai-theme:${call.id}',
        );
        return {
          'version': saved.version,
          'saved_at': saved.savedAt?.toIso8601String(),
        };
      default:
        throw UnsupportedError('Unsupported AI operator tool');
    }
  }

  String _operatorCompletionSummary(
    AiOperatorToolCall call,
    Map<String, dynamic> result,
  ) {
    switch (call.tool) {
      case 'create_product':
        return 'Draft product ${_stringValue(result['name'], fallback: 'created')} created.';
      case 'draft_discount':
        return 'Draft discount ${_stringValue(result['code'], fallback: 'created')} created.';
      case 'draft_homepage_section':
        return 'Homepage section draft saved.';
      default:
        return call.summary;
    }
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

Map<String, dynamic> _mapValue(Object? value) {
  return value is Map ? Map<String, dynamic>.from(value) : <String, dynamic>{};
}

String _titleCase(String value) {
  return value
      .replaceAll('_', ' ')
      .split(RegExp(r'\s+'))
      .where((part) => part.isNotEmpty)
      .map((part) => part[0].toUpperCase() + part.substring(1))
      .join(' ');
}
