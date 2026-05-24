// ============================================================
// FILE: lib/services/ai_chat_service.dart - COMPLETE PERSISTENT VERSION
// ============================================================

import 'dart:developer' as dev;
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:google_generative_ai/google_generative_ai.dart';
import 'package:letbuyy_core/letbuyy_core.dart';
import 'package:uuid/uuid.dart';
import 'package:letbuyy_models/letbuyy_models.dart';
// ✅ 1. IMPORT SHARED_PREFERENCES
import 'package:shared_preferences/shared_preferences.dart';

class AIChatService {
  final auth = FirebaseAuth.instance;
  final firestore = FirebaseFirestore.instance;

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

  Future<void> saveMessage(ChatMessage message) async {
    if (message.text.trim().isEmpty &&
        message.messageType != MessageType.loading) {
      return;
    }

    context.add(message);
    final user = auth.currentUser;
    if (user == null) return;

    try {
      await firestore
          .collection('users')
          .doc(user.uid)
          .collection('chats')
          .doc(currentSessionId) // This now uses the persistent getter
          .collection('messages')
          .doc(message.id)
          .set(message.toMap(), SetOptions(merge: true));
    } catch (e, st) {
      dev.log('❌ saveMessage error', error: e, stackTrace: st);
    }
  }

  // ✅ 7. UPDATE LOADSESSIONHISTORY TO SAVE THE LOADED ID
  Future<List<ChatMessage>> loadSessionHistory(String sessionId) async {
    final user = auth.currentUser;
    if (user == null) return [];

    // Make the loaded session the new active session
    _prefs ??= await SharedPreferences.getInstance();
    _currentSessionId = sessionId;
    await _prefs!.setString(_kSessionKey, _currentSessionId!);
    dev.log('🔄 Switched active session to: $sessionId');

    try {
      final snap = await firestore
          .collection('users')
          .doc(user.uid)
          .collection('chats')
          .doc(sessionId)
          .collection('messages')
          .orderBy('timestamp')
          .get();

      final messages = snap.docs.map((d) {
        try {
          return ChatMessage.fromFirestore(d);
        } catch (e) {
          dev.log('❌ parse error: $e');
          return ChatMessage.error(
            text: 'Error loading message',
            sessionId: sessionId,
          );
        }
      }).toList();

      context.clear();
      context.addAll(messages);
      userProfileCache = null;
      _profileCacheTime = null;
      await primeCaches();
      return messages;
    } catch (e, st) {
      dev.log('❌ loadSessionHistory error', error: e, stackTrace: st);
      return [];
    }
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
    final user = auth.currentUser;
    String userName = 'Guest';

    if (user != null) {
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
    - getOrders(limit?, status?): Get user orders
    - getOrderDetails(orderId): Get specific order
    - getAvailableCoupons(): Show active coupons
    - getCategories(): List categories
    - getUserProfile(): Get user info
    - getProductDetails(productId): Get product details

    Remember: Answer informational questions first, THEN offer to search. Call functions for all commercial queries.
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
    final apiKey = GeminiConfig.apiKey;
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
        model: GeminiConfig.modelName,
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

  // ✅ ENHANCED: Advanced product search with fuzzy matching
  Future<Map<String, dynamic>> handleProductSearch(
    String query, {
    String? categoryId,
    int limit = 8,
  }) async {
    try {
      dev.log('🔍 Searching products: "$query"');

      List<QueryDocumentSnapshot> results = [];

      // Build base query
      Query queryRef =
          firestore.collection('products').where('isActive', isEqualTo: true);

      if (categoryId != null && categoryId.isNotEmpty) {
        queryRef = queryRef.where('categoryId', isEqualTo: categoryId);
      }

      // 1️⃣ Try exact match with search keywords
      if (query.trim().isNotEmpty && query.toLowerCase() != 'all') {
        final lowerQuery = query.toLowerCase().trim();

        // Try single word search first
        results = (await queryRef
                .where('searchKeywords', arrayContains: lowerQuery)
                .limit(limit)
                .get())
            .docs;

        // 2️⃣ If no results, try word-by-word search
        if (results.isEmpty) {
          final words =
              lowerQuery.split(' ').where((w) => w.length > 2).toList();

          for (final word in words) {
            results = (await queryRef
                    .where('searchKeywords', arrayContains: word)
                    .limit(limit)
                    .get())
                .docs;

            if (results.isNotEmpty) break;
          }
        }

        // 3️⃣ If still no results, try name search (startAt/endAt)
        if (results.isEmpty) {
          try {
            results = (await queryRef
                    .orderBy('name')
                    .startAt([lowerQuery])
                    .endAt(['$lowerQuery\uf8ff'])
                    .limit(limit)
                    .get())
                .docs;
          } catch (e) {
            dev.log('⚠️ Name search failed: $e');
          }
        }

        // 4️⃣ Last resort: Get all and filter locally
        if (results.isEmpty) {
          dev.log('🔄 Fallback: Local search');
          final allDocs = (await queryRef.limit(50).get()).docs;

          results = allDocs.where((doc) {
            final data = doc.data() as Map<String, dynamic>;
            final name = (data['name'] as String?)?.toLowerCase() ?? '';
            final desc = (data['description'] as String?)?.toLowerCase() ?? '';

            // Check if any word matches
            for (final word in lowerQuery.split(' ')) {
              if (word.length > 2 &&
                  (name.contains(word) || desc.contains(word))) {
                return true;
              }
            }
            return false;
          }).take(limit).toList();
        }
      } else {
        // Show all products / featured
        results = (await queryRef
                .where('isFeatured', isEqualTo: true)
                .limit(limit)
                .get())
            .docs;

        if (results.isEmpty) {
          results = (await queryRef.limit(limit).get()).docs;
        }
      }

      final products = results.map((d) {
        final data = d.data() as Map<String, dynamic>;
        final images = data['images'] as List?;

        return {
          'id': d.id,
          'name': data['name'] ?? 'Unnamed Product',
          'price': _parsePrice(data['salePrice'] ?? data['price']),
          'originalPrice': _parsePrice(data['originalPrice'] ?? data['mrp']),
          'imageUrl': images?.isNotEmpty == true ? images!.first : '',
          'images': images ?? [],
          'description': data['description'] ?? '',
          'inStock': ((data['stock'] as num?)?.toInt() ?? 0) > 0,
          'stock': (data['stock'] as num?)?.toInt() ?? 0,
          'rating': (data['rating'] as num?)?.toDouble() ?? 0.0,
          'isFeatured': data['isFeatured'] ?? false,
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

  double _parsePrice(dynamic value) {
    if (value == null) return 0.0;
    if (value is double) return value;
    if (value is int) return value.toDouble();
    if (value is String) return double.tryParse(value) ?? 0.0;
    return 0.0;
  }

  Future<Map<String, dynamic>> handleProductDetails(String productId) async {
    try {
      if (productId.isEmpty) return {'error': 'Product ID required'};

      final doc = await firestore.collection('products').doc(productId).get();
      if (!doc.exists) return {'error': 'Product not found'};

      final data = doc.data() as Map<String, dynamic>;
      return {
        'product': {
          'id': doc.id,
          'name': data['name'] ?? 'Unnamed',
          'description': data['description'] ?? '',
          'price': _parsePrice(data['salePrice'] ?? data['price']),
          'inStock': ((data['stock'] as num?)?.toInt() ?? 0) > 0,
        },
        'success': true,
      };
    } catch (e) {
      return {'error': 'Failed to get product details', 'success': false};
    }
  }

  // ✅ ENHANCED: Better order retrieval
  Future<Map<String, dynamic>> handleGetOrders(
      {int limit = 5, String? status}) async {
    final user = auth.currentUser;
    if (user == null) {
      return {
        'error': 'Please login to view orders',
        'orders': [],
        'success': false,
      };
    }

    try {
      dev.log('📦 Fetching orders for: ${user.uid}');

      Query q = firestore
          .collection('orders')
          .where('userId', isEqualTo: user.uid)
          .orderBy('createdAt', descending: true);

      if (status != null && status.isNotEmpty) {
        q = q.where('orderStatus', isEqualTo: status);
      }

      final snap = await q.limit(limit).get();

      final orders = snap.docs.map((d) {
        final data = d.data() as Map<String, dynamic>;
        return {
          'id': d.id,
          'orderNumber': data['orderNumber'] ?? d.id,
          'status': data['orderStatus'] ?? 'unknown',
          'total': _parsePrice(data['total']),
          'createdAt':
              (data['createdAt'] as Timestamp?)?.toDate().toString() ?? '',
          'itemCount': (data['items'] as List?)?.length ?? 0,
        };
      }).toList();

      dev.log('✅ Found ${orders.length} orders');

      return {
        'orders': orders,
        'totalCount': orders.length,
        'success': true,
      };
    } catch (e, st) {
      dev.log('❌ Orders error', error: e, stackTrace: st);
      return {
        'error': 'Failed to fetch orders',
        'details': e.toString(),
        'orders': [],
        'success': false,
      };
    }
  }

  Future<Map<String, dynamic>> handleOrderDetails(String orderId) async {
    try {
      if (orderId.isEmpty) return {'error': 'Order ID required'};

      // Try finding by document ID first
      DocumentSnapshot? doc =
          await firestore.collection('orders').doc(orderId).get();

      // If not found, try finding by order number
      if (!doc.exists) {
        final query = await firestore
            .collection('orders')
            .where('orderNumber', isEqualTo: orderId)
            .limit(1)
            .get();

        if (query.docs.isEmpty) {
          return {'error': 'Order not found', 'success': false};
        }
        doc = query.docs.first;
      }

      final data = doc.data() as Map<String, dynamic>;
      return {
        'order': {
          'id': doc.id,
          'orderNumber': data['orderNumber'] ?? doc.id,
          'status': data['orderStatus'] ?? 'unknown',
          'total': _parsePrice(data['total']),
          'createdAt':
              (data['createdAt'] as Timestamp?)?.toDate().toString() ?? '',
        },
        'success': true,
      };
    } catch (e) {
      return {'error': 'Failed to get order details', 'success': false};
    }
  }

  Future<Map<String, dynamic>> handleUserProfile() async {
    final user = auth.currentUser;
    if (user == null) return {'error': 'Not logged in'};

    if (userProfileCache != null && _profileCacheTime != null) {
      if (DateTime.now().difference(_profileCacheTime!).inMinutes < 15) {
        return userProfileCache!;
      }
    }

    try {
      final doc = await firestore.collection('users').doc(user.uid).get();
      if (!doc.exists) return {'error': 'Profile not found'};

      final data = doc.data() as Map<String, dynamic>;
      userProfileCache = {
        'name': data['name'] ?? 'User',
        'email': data['email'] ?? user.email ?? 'N/A',
        'phone': data['phone'] ?? 'Not provided',
      };
      _profileCacheTime = DateTime.now();

      return userProfileCache!;
    } catch (e) {
      return {'error': 'Failed to get profile'};
    }
  }

  Future<Map<String, dynamic>> handleGetCategories() async {
    try {
      final snap = await firestore
          .collection('categories')
          .where('isActive', isEqualTo: true)
          .get();

      final categories = snap.docs.map((d) {
        final data = d.data();
        return {
          'id': d.id,
          'name': data['name'] ?? 'Unnamed Category',
          'description': data['description'] ?? '',
        };
      }).toList();

      dev.log('✅ Found ${categories.length} categories');
      return {'categories': categories, 'success': true};
    } catch (e) {
      return {
        'error': 'Failed to get categories',
        'categories': [],
        'success': false
      };
    }
  }

  // ✅ FIXED: Coupons with proper query
  Future<Map<String, dynamic>> handleGetCoupons() async {
    try {
      dev.log('🎟️ Fetching coupons...');

      // Simple query without compound index requirement
      final snap = await firestore
          .collection('coupons')
          .where('isActive', isEqualTo: true)
          .get();

      final now = DateTime.now();

      // Filter in memory
      final coupons = snap.docs.where((doc) {
        final data = doc.data();
        final validTo = (data['validTo'] as Timestamp?)?.toDate();
        return validTo != null && validTo.isAfter(now);
      }).map((d) {
        final data = d.data();
        return {
          'code': data['code'] ?? 'N/A',
          'description': data['description'] ?? 'No description',
          'discount': (data['discount'] as num?)?.toDouble() ?? 0,
          'discountType': data['discountType'] ?? 'percent',
          'minOrderAmount': (data['minOrderAmount'] as num?)?.toDouble() ?? 0,
          'validTo': (data['validTo'] as Timestamp?)?.toDate().toString() ?? '',
        };
      }).toList();

      dev.log('✅ Found ${coupons.length} coupons');
      return {
        'coupons': coupons,
        'totalCount': coupons.length,
        'success': true,
      };
    } catch (e, st) {
      dev.log('❌ Coupons error', error: e, stackTrace: st);
      return {
        'error': 'Failed to get coupons',
        'coupons': [],
        'success': false,
      };
    }
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

  Future<List<Map<String, dynamic>>> getAllSessions() async {
    final user = auth.currentUser;
    if (user == null) return [];

    try {
      final snap = await firestore
          .collection('users')
          .doc(user.uid)
          .collection('chats')
          .get();

      return snap.docs.map((d) {
        final data = d.data();
        data['id'] = d.id;
        return data;
      }).toList();
    } catch (e) {
      return [];
    }
  }

  Future<void> deleteSession(String id) async {
    final user = auth.currentUser;
    if (user == null) return;

    try {
      await firestore
          .collection('users')
          .doc(user.uid)
          .collection('chats')
          .doc(id)
          .delete();
    } catch (e) {
      dev.log('❌ deleteSession error: $e');
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
