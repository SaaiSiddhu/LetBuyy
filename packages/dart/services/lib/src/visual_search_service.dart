// ============================================================
// FILE: visual_search_service.dart
// Amazon/Flipkart-style Visual Search using Gemini Vision AI
// ============================================================

import 'dart:convert';
import 'dart:developer' as dev;
import 'dart:io';
import 'dart:typed_data';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:google_generative_ai/google_generative_ai.dart';
import 'package:letbuyy_core/letbuyy_core.dart';

/// Result from visual search containing extracted attributes and matched products
class VisualSearchResult {
  final bool success;
  final String? error;
  final VisualAttributes? attributes;
  final List<Map<String, dynamic>> products;
  final int totalMatches;

  VisualSearchResult({
    required this.success,
    this.error,
    this.attributes,
    this.products = const [],
    this.totalMatches = 0,
  });

  factory VisualSearchResult.error(String message) {
    return VisualSearchResult(success: false, error: message);
  }

  factory VisualSearchResult.success({
    required VisualAttributes attributes,
    required List<Map<String, dynamic>> products,
  }) {
    return VisualSearchResult(
      success: true,
      attributes: attributes,
      products: products,
      totalMatches: products.length,
    );
  }
}

/// Attributes extracted from image by Gemini Vision
class VisualAttributes {
  final String category;
  final String productType;
  final List<String> colors;
  final String style;
  final String? brand;
  final List<String> keywords;

  VisualAttributes({
    required this.category,
    required this.productType,
    required this.colors,
    required this.style,
    this.brand,
    required this.keywords,
  });

  factory VisualAttributes.fromJson(Map<String, dynamic> json) {
    return VisualAttributes(
      category: json['category'] ?? 'unknown',
      productType: json['productType'] ?? 'product',
      colors: List<String>.from(json['colors'] ?? []),
      style: json['style'] ?? '',
      brand: json['brand'],
      keywords: List<String>.from(json['keywords'] ?? []),
    );
  }

  Map<String, dynamic> toJson() => {
    'category': category,
    'productType': productType,
    'colors': colors,
    'style': style,
    'brand': brand,
    'keywords': keywords,
  };

  @override
  String toString() => 'VisualAttributes(category: $category, type: $productType, colors: $colors, keywords: $keywords)';
}

/// Visual Search Service using Gemini Vision AI
class VisualSearchService {
  static final VisualSearchService instance = VisualSearchService._();
  VisualSearchService._();

  final FirebaseFirestore _firestore = FirebaseFirestore.instance;
  GenerativeModel? _model;

  /// Initialize the Gemini Vision model
  GenerativeModel get model {
    _model ??= GenerativeModel(
      model: 'gemini-2.0-flash-exp', // Supports vision
      apiKey: GeminiConfig.apiKey,
      generationConfig: GenerationConfig(
        temperature: 0.4, // Lower for more accurate extraction
        topK: 32,
        topP: 0.95,
        maxOutputTokens: 1024,
      ),
    );
    return _model!;
  }

  /// Main entry point: Analyze image and find similar products
  Future<VisualSearchResult> searchByImage(Uint8List imageBytes) async {
    try {
      dev.log('🔍 Starting visual search with ${imageBytes.length} bytes...');

      // Step 1: Extract attributes from image using Gemini Vision
      final attributes = await _extractImageAttributes(imageBytes);
      if (attributes == null) {
        return VisualSearchResult.error('Could not analyze image. Please try a clearer photo.');
      }

      dev.log('✅ Extracted: $attributes');

      // Step 2: Find matching products in Firestore
      final products = await _findMatchingProducts(attributes);

      dev.log('✅ Found ${products.length} matching products');

      return VisualSearchResult.success(
        attributes: attributes,
        products: products,
      );
    } on SocketException catch (e) {
      dev.log('❌ Network error: $e');
      return VisualSearchResult.error('No internet connection. Please check your network.');
    } catch (e, st) {
      dev.log('❌ Visual search error', error: e, stackTrace: st);
      
      // Check for network-related errors
      final errorStr = e.toString().toLowerCase();
      if (errorStr.contains('socket') || 
          errorStr.contains('network') || 
          errorStr.contains('host') ||
          errorStr.contains('connection')) {
        return VisualSearchResult.error('Network error. Please check your internet connection.');
      }
      
      return VisualSearchResult.error('Visual search failed. Please try again.');
    }
  }

  /// Extract product attributes from image using Gemini Vision
  Future<VisualAttributes?> _extractImageAttributes(Uint8List imageBytes) async {
    try {
      dev.log('📤 Sending image to Gemini Vision API...');
      
      final prompt = '''
Analyze this product image and extract the following information.
Be specific and accurate. If you can't determine something, use your best guess.

Return ONLY a valid JSON object (no markdown, no explanation):
{
  "category": "one of: electronics, fashion, home, beauty, groceries, toys, sports, books, jewelry, automotive",
  "productType": "specific product name like laptop, dress, headphones, chair, lipstick",
  "colors": ["primary color", "secondary color if any"],
  "style": "style description like casual, formal, modern, vintage, minimalist",
  "brand": "brand name if visible, or null",
  "keywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"]
}
''';

      final response = await model.generateContent([
        Content.multi([
          TextPart(prompt),
          DataPart('image/jpeg', imageBytes),
        ])
      ]);

      final text = response.text;
      if (text == null || text.isEmpty) {
        dev.log('❌ Empty response from Gemini');
        return null;
      }

      dev.log('📝 Gemini response: $text');

      // Parse JSON from response
      final jsonStr = _extractJson(text);
      if (jsonStr == null) {
        dev.log('❌ Could not extract JSON from response');
        return null;
      }

      final json = jsonDecode(jsonStr) as Map<String, dynamic>;
      return VisualAttributes.fromJson(json);
    } catch (e, st) {
      dev.log('❌ Attribute extraction error', error: e, stackTrace: st);
      return null;
    }
  }

  /// Extract JSON from potentially markdown-wrapped response
  String? _extractJson(String text) {
    // Try to find JSON in the response
    final patterns = [
      RegExp(r'```json\s*([\s\S]*?)\s*```'), // Markdown code block
      RegExp(r'```\s*([\s\S]*?)\s*```'),     // Generic code block
      RegExp(r'\{[\s\S]*\}'),                 // Raw JSON
    ];

    for (final pattern in patterns) {
      final match = pattern.firstMatch(text);
      if (match != null) {
        final extracted = match.group(1) ?? match.group(0);
        if (extracted != null && extracted.contains('{')) {
          // Find the actual JSON object
          final jsonStart = extracted.indexOf('{');
          final jsonEnd = extracted.lastIndexOf('}');
          if (jsonStart != -1 && jsonEnd != -1) {
            return extracted.substring(jsonStart, jsonEnd + 1);
          }
        }
      }
    }
    return null;
  }

  /// Find products matching the extracted attributes
  Future<List<Map<String, dynamic>>> _findMatchingProducts(VisualAttributes attributes) async {
    try {
      // Build query based on category
      Query query = _firestore.collection('products')
          .where('isActive', isEqualTo: true);

      // Try to match category (normalize category names)
      final categoryMapping = _mapCategoryToFirestore(attributes.category);
      if (categoryMapping != null) {
        // First try exact category match
        final categoryDocs = await _firestore.collection('categories')
            .where('name', isGreaterThanOrEqualTo: categoryMapping)
            .where('name', isLessThanOrEqualTo: '$categoryMapping\uf8ff')
            .limit(1)
            .get();

        if (categoryDocs.docs.isNotEmpty) {
          query = query.where('categoryId', isEqualTo: categoryDocs.docs.first.id);
        }
      }

      // Get products (limit to 50 for scoring)
      final docs = await query.limit(50).get();

      if (docs.docs.isEmpty) {
        // Fallback: get all products and filter locally
        final allDocs = await _firestore.collection('products')
            .where('isActive', isEqualTo: true)
            .limit(50)
            .get();
        return _scoreAndRankProducts(allDocs.docs, attributes);
      }

      return _scoreAndRankProducts(docs.docs, attributes);
    } catch (e, st) {
      dev.log('❌ Product matching error', error: e, stackTrace: st);
      return [];
    }
  }

  /// Map extracted category to Firestore category names
  String? _mapCategoryToFirestore(String category) {
    final mapping = {
      'electronics': 'Electronics',
      'fashion': 'Fashion',
      'home': 'Home',
      'beauty': 'Beauty',
      'groceries': 'Groceries',
      'toys': 'Toys',
      'sports': 'Sports',
      'books': 'Books',
      'jewelry': 'Jewelry',
      'automotive': 'Automotive',
    };
    return mapping[category.toLowerCase()];
  }

  /// Score and rank products based on attribute matching
  List<Map<String, dynamic>> _scoreAndRankProducts(
    List<QueryDocumentSnapshot> docs,
    VisualAttributes attributes,
  ) {
    final scoredProducts = <Map<String, dynamic>>[];

    for (final doc in docs) {
      final data = doc.data() as Map<String, dynamic>;
      double score = 0;

      final name = (data['name'] as String?)?.toLowerCase() ?? '';
      final desc = (data['description'] as String?)?.toLowerCase() ?? '';
      final combined = '$name $desc';

      // Score based on keyword matches
      for (final keyword in attributes.keywords) {
        if (combined.contains(keyword.toLowerCase())) {
          score += 10;
        }
      }

      // Score based on product type match
      if (combined.contains(attributes.productType.toLowerCase())) {
        score += 20;
      }

      // Score based on color matches
      for (final color in attributes.colors) {
        if (combined.contains(color.toLowerCase())) {
          score += 5;
        }
      }

      // Score based on brand match
      if (attributes.brand != null && combined.contains(attributes.brand!.toLowerCase())) {
        score += 15;
      }

      // Only include if there's some match
      if (score > 0) {
        final images = data['images'] as List?;
        scoredProducts.add({
          'id': doc.id,
          'name': data['name'] ?? 'Unnamed Product',
          'price': _parsePrice(data['salePrice'] ?? data['price']),
          'originalPrice': _parsePrice(data['originalPrice'] ?? data['mrp']),
          'imageUrl': images?.isNotEmpty == true ? images!.first : '',
          'images': images ?? [],
          'description': data['description'] ?? '',
          'inStock': ((data['stock'] as num?)?.toInt() ?? 0) > 0,
          'rating': (data['rating'] as num?)?.toDouble() ?? 0.0,
          'matchScore': score,
        });
      }
    }

    // Sort by score descending
    scoredProducts.sort((a, b) => (b['matchScore'] as double).compareTo(a['matchScore'] as double));

    // Return top 20
    return scoredProducts.take(20).toList();
  }

  double _parsePrice(dynamic value) {
    if (value == null) return 0.0;
    if (value is double) return value;
    if (value is int) return value.toDouble();
    if (value is String) return double.tryParse(value) ?? 0.0;
    return 0.0;
  }
}
