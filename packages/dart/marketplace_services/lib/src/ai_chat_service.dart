// ============================================================
// FILE: lib/services/ai_chat_service.dart - COMPLETE PERSISTENT VERSION
// ============================================================

import 'dart:developer' as dev;
import 'package:google_generative_ai/google_generative_ai.dart';
import 'package:letbuyy_api_client/letbuyy_api_client.dart';
import 'package:uuid/uuid.dart';
import 'package:letbuyy_marketplace_models/letbuyy_marketplace_models.dart';
// ✅ 1. IMPORT SHARED_PREFERENCES
import 'package:shared_preferences/shared_preferences.dart';

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
  void configure({required ApiClient client, required BuyerAccountApi accounts}) {
    _client = client;
    _accounts = accounts;
  }

  /// Call whenever BuyerSignInController's identity changes (sign in/out/switch).
  void updateAuth({String? sessionToken, String? email}) {
    _sessionToken = sessionToken;
    _buyerEmail = email;
  }

  bool get isSignedIn => _sessionToken != null;

  // ✅ 2. MAKE A SINGLETON
  static final AIChatService instance = AIChatService._();
  AIChatService._(); // Private constructor

  // ✅ 3. PRIVATE STATE FOR SESSION
  static const String _kSessionKey = 'current_chat_session_id';
  SharedPreferences? _prefs;
  String? _currentSessionId;

  // ✅ 4. PUBLIC GETTER FOR THE SESSION ID
  String get currentSessionId {
    if (_currentSessionId == null) {
      // This error means you forgot to call initSession() in the UI.
      throw StateError(
          'AIChatService.currentSessionId called before initSession() was completed.');
    }
    return _currentSessionId!;
  }

  final List<ChatMessage> context = [];
  Map<String, dynamic>? userProfileCache;
  DateTime? _profileCacheTime;
  static const _cacheExpiry = Duration(minutes: 15);

  // ✅ 5. NEW INIT METHOD TO LOAD THE SESSION
  /// Must be called once before using the service.
  Future<void> initSession() async {
    // Already initialized, do nothing.
    if (_currentSessionId != null) return;

    _prefs ??= await SharedPreferences.getInstance();
    final savedId = _prefs!.getString(_kSessionKey);

    if (savedId != null && savedId.isNotEmpty) {
      _currentSessionId = savedId;
      dev.log('🔄 Resumed session: $_currentSessionId');
    } else {
      _currentSessionId = const Uuid().v4();
      await _prefs!.setString(_kSessionKey, _currentSessionId!);
      dev.log('✨ Created new persistent session: $_currentSessionId');
    }
  }

  // ✅ 6. UPDATE STARTNEWSESSION TO SAVE THE NEW ID
  Future<void> startNewSession() async {
    _prefs ??= await SharedPreferences.getInstance();
    _currentSessionId = const Uuid().v4();
    await _prefs!.setString(_kSessionKey, _currentSessionId!);

    context.clear();
    userProfileCache = null;
    _profileCacheTime = null;
    dev.log('🆕 New session started & saved: $_currentSessionId');
  }

  // ... (tools definition remains exactly the same) ...
  final tools = [
    Tool(functionDeclarations: [
      FunctionDeclaration(
        'searchProducts',
        'Search for products by name, keywords, or category. Use this when user asks to "show", "find", "buy", "price of", or just names a product.',
        Schema(
          SchemaType.object,
          properties: {
            'query': Schema(
              SchemaType.string,
              description:
                  'Product name, keywords, or "all" to show all products',
              nullable: false,
            ),
            'categoryId': Schema(
              SchemaType.string,
              description: 'Optional category ID filter',
              nullable: true,
            ),
            'limit': Schema(
              SchemaType.integer,
              description: 'Max results (default: 8, max: 20)',
              nullable: true,
            ),
          },
          requiredProperties: ['query'],
        ),
      ),
      // ... all other function declarations
      FunctionDeclaration(
        'getAvailableCoupons',
        'Get active discount coupons. Use when user asks about deals, discounts, or coupons.',
        Schema(SchemaType.object, properties: {}),
      ),
    ])
  ];

  /// C3: no durable chat-history backend exists yet (see this file's own class-level doc comment)
  /// -- kept in memory for the lifetime of the running app only. Never silently claims to have
  /// saved anything it did not.
  Future<void> saveMessage(ChatMessage message) async {
    if (message.text.trim().isEmpty &&
        message.messageType != MessageType.loading) {
      return;
    }

    context.add(message);
  }

  /// No durable chat-history store exists yet (see saveMessage's doc comment) -- this always
  /// returns [], the same as it always effectively did under the old Firebase-gated code (every
  /// message write silently failed, so there was never anything real to load back). Still switches
  /// the active session id so a caller resuming a specific session id is honored going forward.
  /// initializeChat() in ai_chat_screen.dart already treats an empty result as "show the
  /// greeting", which is the correct, honest behavior here.
  Future<List<ChatMessage>> loadSessionHistory(String sessionId) async {
    _prefs ??= await SharedPreferences.getInstance();
    _currentSessionId = sessionId;
    await _prefs!.setString(_kSessionKey, _currentSessionId!);
    dev.log('🔄 Switched active session to: $sessionId');

    context.clear();
    userProfileCache = null;
    _profileCacheTime = null;
    await primeCaches();
    return [];
  }

  // ... (rest of the file is identical) ...
  // ... (processUserMessage, buildSystemPrompt, buildChatHistory, etc...)

  Future<ChatMessage> processUserMessage(
    String msg, {
    List<ChatMessage>? conversationHistory,
  }) async {
    try {
      return await handleGeminiResponse(msg, conversationHistory);
    } catch (e, st) {
      dev.log('❌ processUserMessage error', error: e, stackTrace: st);
      return ChatMessage.error(
        text: 'Error processing message. Please try again.',
        sessionId: currentSessionId, // Uses persistent getter
        errorMessage: e.toString(),
      );
    }
  }

  // ✅ FIXED: System prompt with better intent differentiation
  Future<String> buildSystemPrompt() async {
    String userName = 'Guest';

    if (isSignedIn) {
      try {
        userProfileCache ??= await handleUserProfile();
        if (userProfileCache != null &&
            !userProfileCache!.containsKey('error')) {
          userName = userProfileCache!['name'] as String? ?? 'User';
        }
      } catch (e) {
        dev.log('⚠️ Error getting user name: $e');
      }
    }

    return '''You are the LetBuyy AI Shopping Assistant. Help customers find products, track orders, and get deals.

    Current User: $userName

    🎯 YOUR PRIMARY JOB: Differentiate between INFORMATIONAL and COMMERCIAL intent.

    CRITICAL RULES:
    1.  **Informational Intent (ANSWER FIRST):**
        * If a user asks an informational question (e.g., "what is...", "what is the purpose of...", "how to use...", "benefits of..."), you MUST answer the question using your general knowledge first.
        * **DO NOT** call `searchProducts()` for this initial answer.
        * After providing the information, you can then ask, "Would you like me to find some [product] for you?"

    2.  **Commercial Intent (CALL FUNCTION):**
        * If a user shows clear intent to buy or browse (e.g., "show me...", "find...", "do you have...", "price of...", or just the product name like "moringa powder"), you MUST call the appropriate function.
        * `searchProducts()`: Call this for "show all products", "laptop", "do you have laptop stand".
        * `getOrders()`: Call this for "track my order", "my orders", "order status".
        * `getAvailableCoupons()`: Call this for "coupons", "deals", "discounts".
        * `getCategories()`: Call this for "categories".

    EXAMPLE DIALOGUE (INFORMATIONAL):
    User: "what is the purpose of moringa powder"
    AI: (Responds with general knowledge) "Moringa powder is known as an immunity booster, a natural multi-vitamin, and is good for hair & skin. It's often used as a nutritional supplement.
    
    Would you like to see our moringa powder products?"
    User: "yes"
    AI: (NOW calls the function) [FunctionCall: searchProducts(query: "moringa powder")]

    EXAMPLE QUERIES (COMMERCIAL - CALL FUNCTION):
    User: "show all products" → searchProducts(query: "all", limit: 8)
    User: "moringa powder" → searchProducts(query: "moringa powder", limit: 8)
    User: "do you have laptop stand" → searchProducts(query: "laptop stand", limit: 8)
    User: "track my order" → getOrders(limit: 5)
    User: "coupons" → getAvailableCoupons()
    User: "categories" → getCategories()

    RESPONSE RULES:
    ✅ Use markdown for better readability
    ✅ Be helpful and friendly
    ✅ If a function call finds no results, say so kindly and suggest alternatives.
    ❌ NEVER refuse to help - always try to find what they need.

    FUNCTIONS AVAILABLE:
    - searchProducts(query, categoryId?, limit?): Find products
    - getOrders(limit?, status?): Get user orders (not available in this build yet -- if the result says so, tell the user honestly rather than implying it worked)
    - getOrderDetails(orderId): Get specific order (same limitation as getOrders)
    - getAvailableCoupons(): Show active coupons (not available in this build yet -- same limitation)
    - getCategories(): List categories
    - getUserProfile(): Get user info
    - getProductDetails(productId): Get product details

    Remember: Answer informational questions first, THEN offer to search. Call functions for all commercial queries. If a function's result says a feature isn't available yet, say so plainly -- never claim success it did not report.
    ''';
  }

  Future<List<Content>> buildChatHistory(List<ChatMessage>? history) async {
    final List<Content> content = [];
    final messages = (history ?? context)
        .where((m) =>
            m.text.trim().isNotEmpty &&
            m.messageType != MessageType.loading &&
            m.messageType != MessageType.system)
        .toList();

    for (var m in messages) {
      try {
        if (m.isUser) {
          content.add(Content.text(m.text));
        } else if (m.isAI) {
          content.add(Content.model([TextPart(m.text)]));
        }
      } catch (e) {
        dev.log('⚠️ Error building chat history item: $e');
      }
    }

    return content;
  }

  Future<ChatMessage> handleGeminiResponse(
    String msg,
    List<ChatMessage>? history,
  ) async {
    const apiKey = String.fromEnvironment('GEMINI_API_KEY');
    if (apiKey.trim().isEmpty) {
      dev.log('❌ API key missing');
      return ChatMessage.ai(
        text: 'AI service not configured. Please contact support.',
        sessionId: currentSessionId,
        category: 'ai_offline',
      );
    }

    try {
      final systemPrompt = await buildSystemPrompt();

      final model = GenerativeModel(
        model: 'gemini-2.0-flash-exp', // Or your preferred model
        apiKey: apiKey,
        tools: tools,
        systemInstruction: Content.text(systemPrompt),
        generationConfig: GenerationConfig(
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 2048,
        ),
      );

      final chatHistory = await buildChatHistory(history);
      final chat = model.startChat(history: chatHistory);

      dev.log('📤 Sending to Gemini: "$msg"');
      final response = await chat.sendMessage(Content.text(msg));

      if (response.candidates.isEmpty) {
        dev.log('❌ No candidates');
        return ChatMessage.ai(
          text: 'I couldn\'t process that. Could you rephrase?',
          sessionId: currentSessionId,
          category: 'ai_empty',
        );
      }

      final candidate = response.candidates.first;
      final functionCalls =
          candidate.content.parts.whereType<FunctionCall>().toList();

      if (functionCalls.isEmpty) {
        final text = response.text ?? 'I couldn\'t generate a response.';
        dev.log('✅ Text response: ${text.length} chars');
        return ChatMessage.ai(
          text: text,
          sessionId: currentSessionId,
          category: 'ai_text',
        );
      }

      dev.log('🔧 Function call: ${functionCalls.first.name}');
      return await _executeFunctionCall(functionCalls.first, chat, msg);
    } catch (e, st) {
      dev.log('❌ Error', error: e, stackTrace: st);
      return ChatMessage.error(
        text: 'An error occurred. Please try again.',
        sessionId: currentSessionId,
        errorMessage: e.toString(),
      );
    }
  }

  Future<ChatMessage> _executeFunctionCall(
    FunctionCall call,
    ChatSession chat,
    String originalMsg,
  ) async {
    final args = call.args ?? {};
    Map<String, dynamic> resultData = {};

    try {
      dev.log('🔍 Executing: ${call.name}');

      switch (call.name) {
        case 'searchProducts':
          final query = getString(args['query']) ?? originalMsg;
          resultData = await handleProductSearch(
            query,
            categoryId: getString(args['categoryId']),
            limit: (getInt(args['limit']) ?? 8).clamp(1, 20),
          );
          break;

        case 'getProductDetails':
          resultData =
              await handleProductDetails(getString(args['productId']) ?? '');
          break;

        case 'getOrders':
          resultData = await handleGetOrders(
            limit: (getInt(args['limit']) ?? 5).clamp(1, 20),
            status: getString(args['status']),
          );
          break;

        case 'getOrderDetails':
          resultData =
              await handleOrderDetails(getString(args['orderId']) ?? '');
          break;

        case 'getUserProfile':
          resultData = await handleUserProfile();
          break;

        case 'getCategories':
          resultData = await handleGetCategories();
          break;

        case 'getAvailableCoupons':
          resultData = await handleGetCoupons();
          break;

        default:
          resultData = {'error': 'Unknown function: ${call.name}'};
      }

      dev.log('✅ Function result: ${resultData.keys.join(", ")}');
    } catch (e, st) {
      dev.log('❌ Function error', error: e, stackTrace: st);
      resultData = {'error': 'Function failed: $e'};
    }

    try {
      dev.log('📤 Sending result to Gemini...');
      final finalResponse = await chat.sendMessage(
        Content.functionResponse(call.name, resultData),
      );

      final responseText = finalResponse.text ?? 'Could not process results.';
      dev.log('✅ Final response: ${responseText.length} chars');

      return ChatMessage.ai(
        text: responseText,
        sessionId: currentSessionId,
        category: 'ai_function_response',
        products: resultData['products'] as List<Map<String, dynamic>>?,
        orders: resultData['orders'] as List<Map<String, dynamic>>?,
        quickReplies: suggestReplies(call.name, resultData),
      );
    } catch (e, st) {
      dev.log('❌ Error processing result', error: e, stackTrace: st);
      return ChatMessage.error(
        text: 'Could not complete that request.',
        sessionId: currentSessionId,
        errorMessage: e.toString(),
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
      dev.log('🔍 Searching products: "$query"');
      final trimmed = query.trim();
      final isBrowseAll = trimmed.isEmpty || trimmed.toLowerCase() == 'all';

      final page = await client.marketplaceFeed(
        category: (categoryId != null && categoryId.isNotEmpty) ? categoryId : null,
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

      dev.log('✅ Found ${products.length} products');

      return {
        'products': products,
        'totalCount': products.length,
        'query': query,
        'success': true,
      };
    } catch (e, st) {
      dev.log('❌ Search error', error: e, stackTrace: st);
      return {
        'error': 'Product search failed',
        'details': e.toString(),
        'products': [],
        'totalCount': 0,
        'success': false,
      };
    }
  }

  Future<Map<String, dynamic>> handleProductDetails(String productId) async {
    final client = _client;
    if (client == null) return {'error': 'Product details are not ready yet', 'success': false};

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
    } catch (e) {
      return {'error': 'Failed to get product details', 'success': false};
    }
  }

  // C3 (Firebase SDK removal, 27 September 2026 review continuation, second pass): order history
  // has no canonical successor reachable from this app yet (OrderProvider was already retired in
  // an earlier phase) -- honestly, explicitly unavailable rather than a misleading "please login"
  // (which used to fire even for a signed-in canonical buyer, since it only ever checked
  // FirebaseAuth) or a Firestore call that always threw.
  Future<Map<String, dynamic>> handleGetOrders({int limit = 5, String? status}) async {
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
    if (accounts == null || token == null) return {'error': 'Not logged in'};

    if (userProfileCache != null && _profileCacheTime != null) {
      if (DateTime.now().difference(_profileCacheTime!).inMinutes < 15) {
        return userProfileCache!;
      }
    }

    try {
      final account = await accounts.account(token);
      userProfileCache = {
        'name': account.fullName ?? _buyerEmail ?? 'User',
        'email': account.email,
        'phone': account.phone ?? 'Not provided',
      };
      _profileCacheTime = DateTime.now();

      return userProfileCache!;
    } catch (e) {
      return {'error': 'Failed to get profile'};
    }
  }

  Future<Map<String, dynamic>> handleGetCategories() async {
    final client = _client;
    if (client == null) {
      return {'error': 'Categories are not ready yet', 'categories': [], 'success': false};
    }

    try {
      final categories = await client.marketplaceCategories();
      final result = categories.map((c) {
        return {'id': c.id, 'name': c.name, 'description': ''};
      }).toList();

      dev.log('✅ Found ${result.length} categories');
      return {'categories': result, 'success': true};
    } catch (e) {
      return {
        'error': 'Failed to get categories',
        'categories': [],
        'success': false
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
    } catch (e) {
      dev.log('⚠️ primeCaches error: $e');
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
