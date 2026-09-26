// lib/src/category_attribute_service.dart
// Service for managing category attribute schemas and pending attribute requests

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:letbuyy_marketplace_models/letbuyy_marketplace_models.dart';

/// Service for managing category attributes (faceted search)
class CategoryAttributeService {
  FirebaseFirestore get _firestore => FirebaseFirestore.instance;

  // Collection references
  CollectionReference get _categoryAttributesRef =>
      _firestore.collection('category_attributes');
  CollectionReference get _pendingAttributesRef =>
      _firestore.collection('pending_attributes');

  // ============================================
  // CATEGORY ATTRIBUTE SCHEMAS
  // ============================================

  /// Get all category attribute schemas
  Future<List<CategoryAttributeSchema>> getAllCategorySchemas() async {
    try {
      final snapshot = await _categoryAttributesRef.get();
      return snapshot.docs
          .map((doc) => CategoryAttributeSchema.fromFirestore(doc))
          .toList();
    } catch (e) {
      print('Error getting category schemas: $e');
      return [];
    }
  }

  /// Get attribute schema for a specific category
  Future<CategoryAttributeSchema?> getCategorySchema(String categoryId) async {
    try {
      final doc = await _categoryAttributesRef.doc(categoryId).get();
      if (doc.exists) {
        return CategoryAttributeSchema.fromFirestore(doc);
      }
      return null;
    } catch (e) {
      print('Error getting category schema: $e');
      return null;
    }
  }

  /// Stream of category schema for real-time updates
  Stream<CategoryAttributeSchema?> streamCategorySchema(String categoryId) {
    return _categoryAttributesRef.doc(categoryId).snapshots().map((doc) {
      if (doc.exists) {
        return CategoryAttributeSchema.fromFirestore(doc);
      }
      return null;
    });
  }

  /// Create or update category attribute schema
  Future<bool> saveCategorySchema(CategoryAttributeSchema schema) async {
    try {
      await _categoryAttributesRef.doc(schema.categoryId).set(
        schema.toMap(),
        SetOptions(merge: true),
      );
      return true;
    } catch (e) {
      print('Error saving category schema: $e');
      return false;
    }
  }

  /// Add a new attribute to a category
  Future<bool> addAttributeToCategory({
    required String categoryId,
    required AttributeField attribute,
  }) async {
    try {
      await _categoryAttributesRef.doc(categoryId).update({
        'attributes': FieldValue.arrayUnion([attribute.toMap()]),
        'updatedAt': FieldValue.serverTimestamp(),
      });
      return true;
    } catch (e) {
      print('Error adding attribute: $e');
      return false;
    }
  }

  /// Remove an attribute from a category
  Future<bool> removeAttributeFromCategory({
    required String categoryId,
    required String attributeKey,
  }) async {
    try {
      final schema = await getCategorySchema(categoryId);
      if (schema == null) return false;

      final updatedAttributes = schema.attributes
          .where((a) => a.key != attributeKey)
          .map((a) => a.toMap())
          .toList();

      await _categoryAttributesRef.doc(categoryId).update({
        'attributes': updatedAttributes,
        'updatedAt': FieldValue.serverTimestamp(),
      });
      return true;
    } catch (e) {
      print('Error removing attribute: $e');
      return false;
    }
  }

  /// Update an existing attribute in a category
  Future<bool> updateAttributeInCategory({
    required String categoryId,
    required AttributeField updatedAttribute,
  }) async {
    try {
      final schema = await getCategorySchema(categoryId);
      if (schema == null) return false;

      final updatedAttributes = schema.attributes.map((a) {
        if (a.key == updatedAttribute.key) {
          return updatedAttribute.toMap();
        }
        return a.toMap();
      }).toList();

      await _categoryAttributesRef.doc(categoryId).update({
        'attributes': updatedAttributes,
        'updatedAt': FieldValue.serverTimestamp(),
      });
      return true;
    } catch (e) {
      print('Error updating attribute: $e');
      return false;
    }
  }

  /// Delete entire category schema
  Future<bool> deleteCategorySchema(String categoryId) async {
    try {
      await _categoryAttributesRef.doc(categoryId).delete();
      return true;
    } catch (e) {
      print('Error deleting category schema: $e');
      return false;
    }
  }

  // ============================================
  // PENDING ATTRIBUTE REQUESTS
  // ============================================

  /// Get all pending attribute requests (for admin)
  Future<List<PendingAttributeRequest>> getAllPendingRequests() async {
    try {
      final snapshot = await _pendingAttributesRef
          .where('status', isEqualTo: 'pending')
          .orderBy('createdAt', descending: true)
          .get();
      return snapshot.docs
          .map((doc) => PendingAttributeRequest.fromFirestore(doc))
          .toList();
    } catch (e) {
      print('Error getting pending requests: $e');
      return [];
    }
  }

  /// Stream of pending requests for real-time admin dashboard
  Stream<List<PendingAttributeRequest>> streamPendingRequests() {
    return _pendingAttributesRef
        .where('status', isEqualTo: 'pending')
        .orderBy('createdAt', descending: true)
        .snapshots()
        .map((snapshot) => snapshot.docs
            .map((doc) => PendingAttributeRequest.fromFirestore(doc))
            .toList());
  }

  /// Get pending requests for a specific seller
  Future<List<PendingAttributeRequest>> getSellerPendingRequests(
    String sellerId,
  ) async {
    try {
      final snapshot = await _pendingAttributesRef
          .where('sellerId', isEqualTo: sellerId)
          .orderBy('createdAt', descending: true)
          .get();
      return snapshot.docs
          .map((doc) => PendingAttributeRequest.fromFirestore(doc))
          .toList();
    } catch (e) {
      print('Error getting seller pending requests: $e');
      return [];
    }
  }

  /// Create a pending attribute request (from seller)
  Future<String?> createPendingRequest({
    required String categoryId,
    required String sellerId,
    required String attributeKey,
    required String attributeLabel,
    required AttributeType attributeType,
    required List<String> suggestedOptions,
    required String sampleValue,
    String? productId,
  }) async {
    try {
      final docRef = await _pendingAttributesRef.add({
        'categoryId': categoryId,
        'sellerId': sellerId,
        'attributeKey': attributeKey,
        'attributeLabel': attributeLabel,
        'attributeType': attributeType.name,
        'suggestedOptions': suggestedOptions,
        'sampleValue': sampleValue,
        'productId': productId,
        'status': 'pending',
        'createdAt': FieldValue.serverTimestamp(),
      });
      return docRef.id;
    } catch (e) {
      print('Error creating pending request: $e');
      return null;
    }
  }

  /// Approve a pending attribute request (admin)
  /// Also updates products to move the attribute from pendingAttributes to attributes
  Future<bool> approvePendingRequest({
    required String requestId,
    required String reviewedBy,
  }) async {
    try {
      // Get the pending request
      final doc = await _pendingAttributesRef.doc(requestId).get();
      if (!doc.exists) return false;

      final request = PendingAttributeRequest.fromFirestore(doc);

      // Create the attribute field
      final newAttribute = AttributeField(
        key: request.attributeKey,
        label: request.attributeLabel,
        type: request.attributeType,
        options: request.suggestedOptions,
        isFilterable: true,
        isRequired: false,
        status: AttributeApprovalStatus.approved,
        addedBy: request.sellerId,
      );

      // Check if category schema exists
      final existingSchema = await getCategorySchema(request.categoryId);
      
      if (existingSchema != null) {
        // Check if attribute already exists
        final existingKeys = existingSchema.attributes.map((a) => a.key).toSet();
        if (!existingKeys.contains(request.attributeKey)) {
          // Add to existing schema
          await addAttributeToCategory(
            categoryId: request.categoryId,
            attribute: newAttribute,
          );
        }
      } else {
        // Create new schema with this attribute
        await saveCategorySchema(CategoryAttributeSchema(
          categoryId: request.categoryId,
          displayName: request.categoryId, // Will need to be updated
          attributes: [newAttribute],
          createdAt: DateTime.now(),
          updatedAt: DateTime.now(),
        ));
      }

      // Update the pending request status
      await _pendingAttributesRef.doc(requestId).update({
        'status': 'approved',
        'reviewedAt': FieldValue.serverTimestamp(),
        'reviewedBy': reviewedBy,
      });

      // Also update products that have this pending attribute
      // Move from pendingAttributes to attributes
      if (request.productId != null && request.productId!.isNotEmpty) {
        await _migrateProductPendingAttribute(
          productId: request.productId!,
          attributeKey: request.attributeKey,
        );
      }

      return true;
    } catch (e) {
      print('Error approving pending request: $e');
      return false;
    }
  }

  /// Migrate a pending attribute to approved attribute in a product
  Future<void> _migrateProductPendingAttribute({
    required String productId,
    required String attributeKey,
  }) async {
    try {
      final productDoc = await _firestore.collection('products').doc(productId).get();
      if (!productDoc.exists) return;

      final data = productDoc.data()!;
      final pendingAttrs = Map<String, dynamic>.from(data['pendingAttributes'] ?? {});
      final attrs = Map<String, dynamic>.from(data['attributes'] ?? {});

      // Check if the key exists in pending
      if (pendingAttrs.containsKey(attributeKey)) {
        // Move to attributes
        attrs[attributeKey] = pendingAttrs[attributeKey];
        pendingAttrs.remove(attributeKey);

        // Update the product
        await _firestore.collection('products').doc(productId).update({
          'attributes': attrs,
          'pendingAttributes': pendingAttrs.isEmpty ? FieldValue.delete() : pendingAttrs,
          'updatedAt': FieldValue.serverTimestamp(),
        });
      }
    } catch (e) {
      print('Error migrating product pending attribute: $e');
    }
  }

  /// Reject a pending attribute request (admin)
  Future<bool> rejectPendingRequest({
    required String requestId,
    required String reviewedBy,
    required String rejectionReason,
  }) async {
    try {
      await _pendingAttributesRef.doc(requestId).update({
        'status': 'rejected',
        'rejectionReason': rejectionReason,
        'reviewedAt': FieldValue.serverTimestamp(),
        'reviewedBy': reviewedBy,
      });
      return true;
    } catch (e) {
      print('Error rejecting pending request: $e');
      return false;
    }
  }

  /// Delete a pending request
  Future<bool> deletePendingRequest(String requestId) async {
    try {
      await _pendingAttributesRef.doc(requestId).delete();
      return true;
    } catch (e) {
      print('Error deleting pending request: $e');
      return false;
    }
  }

  /// Get count of pending requests (for admin badge)
  Future<int> getPendingRequestCount() async {
    try {
      final snapshot = await _pendingAttributesRef
          .where('status', isEqualTo: 'pending')
          .count()
          .get();
      return snapshot.count ?? 0;
    } catch (e) {
      print('Error getting pending count: $e');
      return 0;
    }
  }
}
