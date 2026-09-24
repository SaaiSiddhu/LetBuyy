// lib/services/product_draft_service.dart
// Product Draft Service for Per-Step Save/Resume

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'dart:convert';

/// Product Draft Service - Save/Resume product creation
class ProductDraftService {
  static final _firestore = FirebaseFirestore.instance;
  static const _localDraftKey = 'product_draft_';

  /// Save draft to Firestore (for logged-in sellers)
  static Future<String> saveDraft({
    required String sellerId,
    required int currentStep,
    required Map<String, dynamic> formData,
    String? existingDraftId,
  }) async {
    final draftData = {
      'sellerId': sellerId,
      'currentStep': currentStep,
      'formData': formData,
      'status': 'draft',
      'updatedAt': FieldValue.serverTimestamp(),
    };

    if (existingDraftId != null) {
      await _firestore.collection('product_drafts').doc(existingDraftId).update(draftData);
      return existingDraftId;
    } else {
      final doc = await _firestore.collection('product_drafts').add({
        ...draftData,
        'createdAt': FieldValue.serverTimestamp(),
      });
      return doc.id;
    }
  }

  /// Load draft from Firestore
  static Future<Map<String, dynamic>?> loadDraft(String draftId) async {
    final doc = await _firestore.collection('product_drafts').doc(draftId).get();
    if (doc.exists) {
      return doc.data();
    }
    return null;
  }

  /// Get all drafts for a seller
  static Stream<QuerySnapshot> getSellerDrafts(String sellerId) {
    return _firestore
        .collection('product_drafts')
        .where('sellerId', isEqualTo: sellerId)
        .orderBy('updatedAt', descending: true)
        .snapshots();
  }

  /// Delete draft after successful publish
  static Future<void> deleteDraft(String draftId) async {
    await _firestore.collection('product_drafts').doc(draftId).delete();
  }

  /// Convert form controllers to saveable map
  static Map<String, dynamic> formToMap({
    required String name,
    required String description,
    required double price,
    required double originalPrice,
    required int stock,
    required String? categoryId,
    required String? subCategoryId,
    required List<String> images,
    required Map<String, String> specifications,
    required List<String> keywords,
    required String? hsnCode,
    required double gstRate,
    required String shippingDays,
    required double shippingPrice,
    required double weight,
    required String? manufacturer,
    required String? countryOfOrigin,
    required List<Map<String, dynamic>> variants,
    required List<String> keyFeatures,
    required List<String> inTheBox,
  }) {
    return {
      'name': name,
      'description': description,
      'price': price,
      'originalPrice': originalPrice,
      'stock': stock,
      'categoryId': categoryId,
      'subCategoryId': subCategoryId,
      'images': images,
      'specifications': specifications,
      'keywords': keywords,
      'hsnCode': hsnCode,
      'gstRate': gstRate,
      'shippingDays': shippingDays,
      'shippingPrice': shippingPrice,
      'weight': weight,
      'manufacturer': manufacturer,
      'countryOfOrigin': countryOfOrigin,
      'variants': variants,
      'keyFeatures': keyFeatures,
      'inTheBox': inTheBox,
    };
  }

  /// Save draft locally (fallback for offline)
  static Future<void> saveLocalDraft(String sellerId, Map<String, dynamic> formData) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('$_localDraftKey$sellerId', jsonEncode(formData));
  }

  /// Load local draft
  static Future<Map<String, dynamic>?> loadLocalDraft(String sellerId) async {
    final prefs = await SharedPreferences.getInstance();
    final json = prefs.getString('$_localDraftKey$sellerId');
    if (json != null) {
      return jsonDecode(json) as Map<String, dynamic>;
    }
    return null;
  }

  /// Clear local draft
  static Future<void> clearLocalDraft(String sellerId) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('$_localDraftKey$sellerId');
  }
}
