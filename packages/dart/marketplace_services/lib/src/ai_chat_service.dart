// ============================================================
// FILE: lib/services/ai_chat_service.dart - COMPLETE PERSISTENT VERSION
// ============================================================

import 'dart:developer' as dev;
import 'package:flutter/foundation.dart';
import 'package:letbuyy_api_client/letbuyy_api_client.dart';
import 'package:uuid/uuid.dart';
import 'package:letbuyy_marketplace_models/letbuyy_marketplace_models.dart';
// ✅ 1. IMPORT SHARED_PREFERENCES
import 'package:shared_preferences/shared_preferences.dart';

// Only closed, fixed diagnostic codes may cross the logging boundary. Never
// attach prompts, function data, exception objects or stack traces: each can
// contain private conversation, credentials, URLs or provider response bodies.
enum _AiDiagnostic {
  messageFailed('AI_MESSAGE_FAILED'),
  profileContextFailed('AI_PROFILE_CONTEXT_FAILED'),
  historyItemDropped('AI_HISTORY_ITEM_DROPPED'),
  providerUnavailable('AI_PROVIDER_UNAVAILABLE'),
  providerRequestStarted('AI_PROVIDER_REQUEST_STARTED'),
  providerEmpty('AI_PROVIDER_EMPTY'),
  providerResponseReady('AI_PROVIDER_RESPONSE_READY'),
  providerFailed('AI_PROVIDER_FAILED'),
  toolStarted('AI_TOOL_STARTED'),
  toolCompleted('AI_TOOL_COMPLETED'),
  toolFailed('AI_TOOL_FAILED'),
  toolResponseStarted('AI_TOOL_RESPONSE_STARTED'),
  toolResponseFailed('AI_TOOL_RESPONSE_FAILED'),
  searchStarted('AI_SEARCH_STARTED'),
  searchCompleted('AI_SEARCH_COMPLETED'),
  searchFailed('AI_SEARCH_FAILED'),
  productDetailsFailed('AI_PRODUCT_DETAILS_FAILED'),
  profileFailed('AI_PROFILE_FAILED'),
  categoriesCompleted('AI_CATEGORIES_COMPLETED'),
  categoriesFailed('AI_CATEGORIES_FAILED'),
  cachePrimeFailed('AI_CACHE_PRIME_FAILED');

  const _AiDiagnostic(this.code);
  final String code;
}

void _diagnostic(_AiDiagnostic reason) =>
    dev.log(reason.code, name: 'letbuyy.ai');

/// A result for an ended actor/session must never be applied to the current chat.
class AIChatContextChanged implements Exception {
  const AIChatContextChanged();
}

class AIChatService {
  // C3 (Firebase SDK removal, 27 September 2026 review continuation, second pass): this service's
  // Firebase coupling is now fully retired. "Signed in" is the canonical buyer session
  // (BuyerSignInController, via updateAuth below), never FirebaseAuth.instance.currentUser (which
  // is never non-null once Firebase.initializeApp() is no longer called -- see this file's own
  // prior-pass fix history). Product/category tool calls are rewired onto the canonical gateway
  // (ApiClient); profile onto BuyerAccountApi; orders/coupons have no canonical successor yet and
  // are explicitly, honestly unavailable rather than silently empty (see handleGetOrders/
  // handleGetCoupons). Conversation history has no durable backend yet either -- kept in memory
  // for the running app only (see saveMessage/loadSessionHistory below), never pretending to
  // reach a server that was never actually written to successfully.
  ApiClient? _client;
  BuyerAccountApi? _accounts;
  String? _sessionToken;
  String? _buyerEmail;

  /// Wires this singleton to the canonical gateway clients. Idempotent; ai_chat_screen.dart calls
  /// this once per screen entry from its own Provider-scoped context.
  void configure({
    required ApiClient client,
    required BuyerAccountApi accounts,
  }) {
    _client = client;
    _accounts = accounts;
  }

  String? _buyerId;
  int _epoch = 0;
  int get epoch => _epoch;
  bool isCurrent(int expectedEpoch) => expectedEpoch == _epoch;

  void _requireCurrent(int expectedEpoch) {
    if (!isCurrent(expectedEpoch)) throw const AIChatContextChanged();
  }

  /// Bind the canonical buyer ID, never an email or a rotating token, as the actor.
  /// A token without its canonical principal is deliberately treated as signed out.
  void updateAuth({String? buyerId, String? sessionToken, String? email}) {
    final nextBuyer =
        buyerId != null &&
            buyerId.isNotEmpty &&
            sessionToken != null &&
            sessionToken.isNotEmpty
        ? buyerId
        : null;
    final nextToken = nextBuyer == null ? null : sessionToken;
    final actorChanged = nextBuyer != _buyerId;
    if (actorChanged || nextToken != _sessionToken) {
      _epoch++;
      userProfileCache = null;
      _profileCacheTime = null;
      if (actorChanged) {
        context.clear();
        _pendingOperation = null;
        _inFlight = null;
        _currentSessionId = null;
      }
    }
    _buyerId = nextBuyer;
    _sessionToken = nextToken;
    _buyerEmail = nextBuyer == null ? null : email;
  }

  /// Invalidate work abandoned by a screen without deleting the current conversation.
  void invalidatePending({int? expectedEpoch}) {
    if (expectedEpoch == null || isCurrent(expectedEpoch)) _epoch++;
  }

  bool get isSignedIn => _buyerId != null && _sessionToken != null;

  static final AIChatService instance = AIChatService._();
  AIChatService._({
    Future<SharedPreferences> Function()? preferencesLoader,
    Future<ChatMessage> Function(String, List<ChatMessage>?)? reply,
  }) : _preferencesLoader = preferencesLoader ?? SharedPreferences.getInstance,
       _reply = reply;

  /// Uses the same lifecycle and result guards with controlled local transports.
  @visibleForTesting
  factory AIChatService.forTesting({
    Future<SharedPreferences> Function()? preferencesLoader,
    Future<ChatMessage> Function(String, List<ChatMessage>?)? reply,
  }) => AIChatService._(preferencesLoader: preferencesLoader, reply: reply);

  final Future<SharedPreferences> Function() _preferencesLoader;
  final Future<ChatMessage> Function(String, List<ChatMessage>?)? _reply;
  // Transient logical operation only. No raw conversation is durably stored.
  ({
    String id,
    String prompt,
    List<BuyerAssistantHistoryMessage> history,
    bool submitted,
  })?
  _pendingOperation;
  ({int epoch, String id, Future<BuyerAssistantResult> future})? _inFlight;
  SharedPreferences? _prefs;
  String? _currentSessionId;

  // Only the non-secret conversation identifier is persisted. The old global key
  // is left untouched and is never restored into another buyer's namespace.
  String get _sessionKey =>
      'current_chat_session_id:${_buyerId == null ? 'guest' : 'buyer:$_buyerId'}';

  String? get initializedSessionId => _currentSessionId;

  String get currentSessionId {
    final id = _currentSessionId;
    if (id == null) throw StateError('Chat session is not initialized.');
    return id;
  }

  final List<ChatMessage> context = [];
  Map<String, dynamic>? userProfileCache;
  DateTime? _profileCacheTime;
  static const _cacheExpiry = Duration(minutes: 15);

  Future<void> initSession() async {
    if (_currentSessionId != null) return;
    final expectedEpoch = _epoch;
    final key = _sessionKey;
    final prefs = _prefs ?? await _preferencesLoader();
    if (!isCurrent(expectedEpoch)) return;
    _prefs = prefs;
    // A concurrent initializer may already have selected this actor's ID.
    if (_currentSessionId != null) return;
    final savedId = prefs.getString(key);
    final id = savedId != null && savedId.isNotEmpty
        ? savedId
        : const Uuid().v4();
    _currentSessionId = id;
    if (savedId != id) await prefs.setString(key, id);
    // Persistence is namespaced to the captured actor; never restore it after a switch.
  }

  Future<void> startNewSession() async {
    _epoch++;
    final expectedEpoch = _epoch;
    final key = _sessionKey;
    final id = const Uuid().v4();
    _currentSessionId = id;
    _pendingOperation = null;
    _inFlight = null;
    context.clear();
    userProfileCache = null;
    _profileCacheTime = null;
    final prefs = _prefs ?? await _preferencesLoader();
    if (!isCurrent(expectedEpoch)) return;
    _prefs = prefs;
    await prefs.setString(key, id);
  }

  /// C3: no durable chat-history backend exists yet (see this file's own class-level doc comment)
  /// -- kept in memory for the lifetime of the running app only. Never silently claims to have
  /// saved anything it did not.
  Future<void> saveMessage(ChatMessage message, {int? expectedEpoch}) async {
    if ((expectedEpoch != null && !isCurrent(expectedEpoch)) ||
        message.sessionId != _currentSessionId ||
        (message.text.trim().isEmpty &&
            message.messageType != MessageType.loading)) {
      return;
    }
    context.add(message);
  }

  /// There is no durable history backend. Only the current actor's initialized
  /// session may be selected; an old route result cannot replace it.
  Future<List<ChatMessage>> loadSessionHistory(String sessionId) async {
    final expectedEpoch = _epoch;
    if (sessionId != _currentSessionId) return [];
    context.clear();
    userProfileCache = null;
    _profileCacheTime = null;
    _requireCurrent(expectedEpoch);
    return [];
  }

  // ... (rest of the file is identical) ...
  // ... (processUserMessage, buildSystemPrompt, buildChatHistory, etc...)

  Future<ChatMessage> processUserMessage(
    String msg, {
    List<ChatMessage>? conversationHistory,
  }) async {
    final expectedEpoch = _epoch;
    final sessionId = currentSessionId;
    final history = List<ChatMessage>.unmodifiable(
      (conversationHistory ?? context).where((m) => m.sessionId == sessionId),
    );
    try {
      final response =
          await (_reply?.call(msg, history) ??
              handleAssistantResponse(msg, history));
      _requireCurrent(expectedEpoch);
      if (response.sessionId != sessionId) throw const AIChatContextChanged();
      return response;
    } on AIChatContextChanged {
      rethrow;
    } catch (_) {
      _requireCurrent(expectedEpoch);
      _diagnostic(_AiDiagnostic.messageFailed);
      return ChatMessage.error(
        text: 'Error processing message. Please try again.',
        sessionId: sessionId,
        errorMessage: 'Message could not be processed.',
      );
    }
  }

  // Personal profile/order/support context is never added to model requests.
  Future<String> buildSystemPrompt() async =>
      'Read-only shopping help; verify product facts in the canonical catalog.';

  Future<List<BuyerAssistantHistoryMessage>> buildChatHistory(
    List<ChatMessage>? history,
  ) async {
    final content = <BuyerAssistantHistoryMessage>[];
    for (final m in history ?? context) {
      if (m.sessionId != _currentSessionId ||
          m.text.trim().isEmpty ||
          m.messageType == MessageType.loading ||
          m.messageType == MessageType.system ||
          m.messageType == MessageType.error)
        continue;
      try {
        if (m.isUser || m.isAI) {
          var text = m.text.trim();
          if (text.length > 2000) {
            text = text.substring(0, 2000);
            final last = text.codeUnitAt(text.length - 1);
            if (last >= 0xD800 && last <= 0xDBFF)
              text = text.substring(0, text.length - 1);
          }
          content.add(
            BuyerAssistantHistoryMessage(
              role: m.isUser ? 'user' : 'assistant',
              text: text,
            ),
          );
        }
      } catch (_) {
        _diagnostic(_AiDiagnostic.historyItemDropped);
      }
    }
    return content.length > 8 ? content.sublist(content.length - 8) : content;
  }

  Future<ChatMessage> handleAssistantResponse(
    String msg,
    List<ChatMessage>? history,
  ) async {
    final expectedEpoch = _epoch;
    final sessionId = currentSessionId;
    final token = _sessionToken;
    final client = _client;
    if (!isSignedIn || token == null || client == null) {
      _diagnostic(_AiDiagnostic.providerUnavailable);
      return ChatMessage.ai(
        text: 'AI service not configured. Please sign in or try later.',
        sessionId: sessionId,
        category: 'ai_offline',
      );
    }
    if (msg.trim().isEmpty || msg.trim().length > 2000) {
      _diagnostic(_AiDiagnostic.messageFailed);
      return ChatMessage.error(
        text: 'Please keep your message within 2,000 characters.',
        sessionId: sessionId,
        errorMessage: 'AI_REQUEST_INVALID',
      );
    }
    try {
      var operation = _pendingOperation;
      if (operation == null) {
        final visible = List<ChatMessage>.of(history ?? context);
        // The current input is a separate request field, not duplicate history.
        if (visible.isNotEmpty &&
            visible.last.isUser &&
            visible.last.text.trim() == msg.trim())
          visible.removeLast();
        final chatHistory = await buildChatHistory(visible);
        _requireCurrent(expectedEpoch);
        operation =
            _pendingOperation ??
            (
              id: const Uuid().v4(),
              submitted: false,
              prompt: msg.trim(),
              history: List<BuyerAssistantHistoryMessage>.unmodifiable(
                chatHistory,
              ),
            );
        _pendingOperation = operation;
        if (operation.prompt != msg.trim()) {
          return ChatMessage.ai(
            text: 'An earlier request has an unresolved outcome.',
            sessionId: sessionId,
            category: 'ai_pending',
          );
        }
      } else if (operation.prompt != msg.trim()) {
        return ChatMessage.ai(
          text:
              'An earlier request has an unresolved outcome. Check it with the same message or start a new chat deliberately.',
          sessionId: sessionId,
          category: 'ai_pending',
        );
      }
      _diagnostic(_AiDiagnostic.providerRequestStarted);
      // Same-epoch callers share the same captured transport future. A fresh
      // token/epoch gets its own request with the same logical operation ID;
      // the server receipt remains the cross-device dispatch authority.
      final previouslySubmitted = operation.submitted;
      var flight = _inFlight;
      if (flight == null ||
          flight.epoch != expectedEpoch ||
          flight.id != operation.id) {
        operation = (
          id: operation.id,
          prompt: operation.prompt,
          history: operation.history,
          submitted: true,
        );
        _pendingOperation = operation;
        flight = (
          epoch: expectedEpoch,
          id: operation.id,
          future: BuyerAssistantApi(client).submit(
            token,
            requestId: operation.id,
            conversationId: sessionId,
            prompt: operation.prompt,
            history: operation.history,
          ),
        );
        _inFlight = flight;
      }
      late final BuyerAssistantResult result;
      try {
        result = await flight.future;
      } finally {
        if (identical(_inFlight?.future, flight.future)) _inFlight = null;
      }
      _requireCurrent(expectedEpoch);
      switch (result.status) {
        case 'completed':
          if (_pendingOperation?.id == operation.id) _pendingOperation = null;
          _diagnostic(_AiDiagnostic.providerResponseReady);
          return ChatMessage.ai(
            text: result.text!,
            sessionId: sessionId,
            category: 'ai_text',
          );
        case 'unavailable':
          if (!previouslySubmitted && _pendingOperation?.id == operation.id)
            _pendingOperation = null;
          _diagnostic(_AiDiagnostic.providerUnavailable);
          return ChatMessage.ai(
            text: previouslySubmitted
                ? 'The service is unavailable, and the earlier request outcome is unresolved. Checking again keeps the same request.'
                : 'AI service is unavailable until its server profile and limits are approved.',
            sessionId: sessionId,
            category: 'ai_offline',
          );
        case 'quota_exceeded':
          if (!previouslySubmitted && _pendingOperation?.id == operation.id)
            _pendingOperation = null;
          _diagnostic(_AiDiagnostic.providerUnavailable);
          return ChatMessage.ai(
            text: previouslySubmitted
                ? 'The allowance is unavailable, and the earlier request outcome remains unresolved. Checking again keeps the same request.'
                : 'The assistant request allowance is unavailable. Please try later.',
            sessionId: sessionId,
            category: 'ai_quota',
          );
        case 'result_unavailable':
          _diagnostic(_AiDiagnostic.providerUnavailable);
          return ChatMessage.ai(
            text:
                'This request completed, but its answer was not retained. It will not be generated again automatically.',
            sessionId: sessionId,
            category: 'ai_pending',
          );
        default:
          _diagnostic(_AiDiagnostic.providerUnavailable);
          return ChatMessage.ai(
            text:
                'The request may still be processing or its outcome is unknown. Checking again will not resend it.',
            sessionId: sessionId,
            category: 'ai_pending',
          );
      }
    } on AIChatContextChanged {
      rethrow;
    } catch (_) {
      _requireCurrent(expectedEpoch);
      _diagnostic(_AiDiagnostic.providerFailed);
      return ChatMessage.error(
        text:
            'The assistant request outcome is unknown. Retry checks the same request without sending it again.',
        sessionId: sessionId,
        errorMessage: 'AI_PROVIDER_FAILED',
      );
    }
  }

  // C3 (Firebase SDK removal, 27 September 2026 review continuation, second pass): rewired onto
  // the canonical marketplaceFeed/marketplaceListing, which do server-side search/category
  // filtering themselves -- the old 4-tier keyword/word/prefix/local-filter fallback existed only
  // to work around Firestore having no real search, and is gone with it. `_client` is null only if
  // a caller reaches this before configure() -- an integration bug, not an ordinary runtime state
  // -- so that case returns the same honest failure shape as a genuine transport error.
  Future<Map<String, dynamic>> handleProductSearch(
    String query, {
    String? categoryId,
    int limit = 8,
  }) async {
    final client = _client;
    if (client == null) {
      return {
        'error': 'Product search is not ready yet',
        'products': [],
        'totalCount': 0,
        'success': false,
      };
    }

    try {
      _diagnostic(_AiDiagnostic.searchStarted);
      final trimmed = query.trim();
      final isBrowseAll = trimmed.isEmpty || trimmed.toLowerCase() == 'all';

      final page = await client.marketplaceFeed(
        category: (categoryId != null && categoryId.isNotEmpty)
            ? categoryId
            : null,
        search: isBrowseAll ? null : trimmed,
        limit: limit,
      );

      final products = page.items.map((item) {
        return {
          'id': item.listingId,
          'marketplaceListingId': item.listingId,
          'name': item.name,
          'price': (item.price ?? 0).toDouble(),
          'originalPrice': (item.comparePrice ?? item.price ?? 0).toDouble(),
          'priceKnown': item.price != null,
          'imageUrl': item.images.isNotEmpty ? item.images.first : '',
          'images': item.images,
          'description': '',
          // The canonical marketplace feed does not expose inventory. Price
          // visibility cannot be used as evidence that a listing is in stock.
          'stock': 0,
          'stockKnown': false,
          'rating': 0.0,
          'isFeatured': false,
        };
      }).toList();

      _diagnostic(_AiDiagnostic.searchCompleted);

      return {
        'products': products,
        'totalCount': products.length,
        'query': query,
        'success': true,
      };
    } catch (_) {
      _diagnostic(_AiDiagnostic.searchFailed);
      return {
        'error': 'Product search failed',
        'details': 'AI_SEARCH_FAILED',
        'products': [],
        'totalCount': 0,
        'success': false,
      };
    }
  }

  Future<Map<String, dynamic>> handleProductDetails(String productId) async {
    final client = _client;
    if (client == null)
      return {'error': 'Product details are not ready yet', 'success': false};

    try {
      if (productId.isEmpty) return {'error': 'Product ID required'};

      final detail = await client.marketplaceListing(productId);
      if (detail == null) return {'error': 'Product not found'};

      return {
        'product': {
          'id': detail.listingId,
          'name': detail.name,
          'description': detail.description ?? '',
          'price': (detail.price ?? 0).toDouble(),
          'inStock': detail.price != null,
        },
        'success': true,
      };
    } catch (_) {
      _diagnostic(_AiDiagnostic.productDetailsFailed);
      return {'error': 'Failed to get product details', 'success': false};
    }
  }

  // C3 (Firebase SDK removal, 27 September 2026 review continuation, second pass): order history
  // has no canonical successor reachable from this app yet (OrderProvider was already retired in
  // an earlier phase) -- honestly, explicitly unavailable rather than a misleading "please login"
  // (which used to fire even for a signed-in canonical buyer, since it only ever checked
  // FirebaseAuth) or a Firestore call that always threw.
  Future<Map<String, dynamic>> handleGetOrders({
    int limit = 5,
    String? status,
  }) async {
    return {
      'error': "Order tracking isn't available in this build yet.",
      'orders': [],
      'success': false,
    };
  }

  Future<Map<String, dynamic>> handleOrderDetails(String orderId) async {
    return {
      'error': "Order tracking isn't available in this build yet.",
      'success': false,
    };
  }

  Future<Map<String, dynamic>> handleUserProfile() async {
    final accounts = _accounts;
    final token = _sessionToken;
    final buyerId = _buyerId;
    final email = _buyerEmail;
    final expectedEpoch = _epoch;
    if (accounts == null || token == null || buyerId == null)
      return {'error': 'Not logged in'};
    if (userProfileCache != null &&
        _profileCacheTime != null &&
        DateTime.now().difference(_profileCacheTime!) < _cacheExpiry) {
      return userProfileCache!;
    }
    try {
      final account = await accounts.account(token);
      _requireCurrent(expectedEpoch);
      if (account.id != buyerId)
        return {'error': 'Profile identity did not match'};
      final profile = <String, dynamic>{
        'name': account.fullName ?? email ?? 'User',
        'email': account.email,
        'phone': account.phone ?? 'Not provided',
      };
      userProfileCache = profile;
      _profileCacheTime = DateTime.now();
      return profile;
    } on AIChatContextChanged {
      // No old actor data escapes, even to a direct caller awaiting this operation.
      return {'error': 'Chat identity changed'};
    } catch (_) {
      _diagnostic(_AiDiagnostic.profileFailed);
      return {'error': 'Failed to get profile'};
    }
  }

  Future<Map<String, dynamic>> handleGetCategories() async {
    final client = _client;
    if (client == null) {
      return {
        'error': 'Categories are not ready yet',
        'categories': [],
        'success': false,
      };
    }

    try {
      final categories = await client.marketplaceCategories();
      final result = categories.map((c) {
        return {'id': c.id, 'name': c.name, 'description': ''};
      }).toList();

      _diagnostic(_AiDiagnostic.categoriesCompleted);
      return {'categories': result, 'success': true};
    } catch (_) {
      _diagnostic(_AiDiagnostic.categoriesFailed);
      return {
        'error': 'Failed to get categories',
        'categories': [],
        'success': false,
      };
    }
  }

  // C3 (Firebase SDK removal, 27 September 2026 review continuation, second pass): no canonical
  // coupons backend exists yet -- CouponProvider was already fully retired in C2 as entirely
  // Firestore-backed with no canonical successor. Honestly, explicitly unavailable rather than a
  // Firestore call that always threw and returned an opaque "Failed to get coupons".
  Future<Map<String, dynamic>> handleGetCoupons() async {
    return {
      'error': "Coupons aren't available in this build yet.",
      'coupons': [],
      'success': false,
    };
  }

  List<String> suggestReplies(String functionName, Map<String, dynamic> data) {
    if (data.containsKey('error')) {
      return ['Try again', 'Help', 'Show all products'];
    }

    switch (functionName) {
      case 'searchProducts':
        final count = (data['totalCount'] as int?) ?? 0;
        if (count == 0) {
          return ['Show all products', 'Browse categories', 'View deals'];
        }
        return ['Show more', 'Filter by category', 'View deals'];
      case 'getOrders':
        return ['Track my order', 'Order history', 'New search'];
      case 'getAvailableCoupons':
        return ['Show products', 'View categories', 'Best deals'];
      case 'getCategories':
        return ['Show products', 'View deals', 'My orders'];
      default:
        return ['Show products', 'My orders', 'View coupons'];
    }
  }

  String? getString(Object? obj) => obj?.toString();

  int? getInt(Object? obj) {
    if (obj == null) return null;
    if (obj is int) return obj;
    if (obj is double) return obj.toInt();
    if (obj is String) return int.tryParse(obj);
    return null;
  }

  Future<void> primeCaches() async {
    try {
      await handleUserProfile();
    } catch (_) {
      _diagnostic(_AiDiagnostic.cachePrimeFailed);
    }
  }

  /// No durable per-session store exists yet (see saveMessage/loadSessionHistory's own doc
  /// comments) -- always [], honestly: chat_history_screen.dart (its only caller) already treats
  /// an empty result as its own empty state.
  Future<List<Map<String, dynamic>>> getAllSessions() async {
    return [];
  }

  Future<void> deleteSession(String id) async {
    if (id == _currentSessionId) {
      context.clear();
    }
  }

  Map<String, int> getSessionStats() {
    int productCount = 0;
    for (var m in context) {
      if (m.products?.isNotEmpty ?? false) {
        productCount += m.products!.length;
      }
    }

    return {
      'userMessages': context.where((m) => m.isUser).length,
      'aiMessages': context.where((m) => m.isAI).length,
      'totalMessages': context.length,
      'productViews': productCount,
    };
  }
}
