// packages/services/lib/src/return_service.dart
// 📦 Return & Exchange Service
// Handles all return/exchange operations across apps

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:cloud_functions/cloud_functions.dart';
import 'package:firebase_storage/firebase_storage.dart';
import 'package:flutter/foundation.dart';
import 'dart:io';
import 'package:letbuyy_models/letbuyy_models.dart';

class ReturnService {
  static final ReturnService _instance = ReturnService._internal();
  factory ReturnService() => _instance;
  ReturnService._internal();

  final FirebaseFirestore _firestore = FirebaseFirestore.instance;
  final FirebaseFunctions _functions = FirebaseFunctions.instance;
  final FirebaseStorage _storage = FirebaseStorage.instance;

  // Collection references
  CollectionReference<Map<String, dynamic>> get _returnsRef =>
      _firestore.collection('return_requests');
  
  CollectionReference<Map<String, dynamic>> get _reasonsRef =>
      _firestore.collection('return_reasons');

  // ══════════════════════════════════════════════════════════════════════════
  // RETURN REASONS
  // ══════════════════════════════════════════════════════════════════════════

  // ═══════════════════════════════════════════════════════════════════════════
  // ORDER SYNC HELPER - Keeps orders and returns in sync
  // ═══════════════════════════════════════════════════════════════════════════
  
  Future<void> _syncOrderWithReturn({
    required String orderId,
    required String returnId,
    required ReturnType type,
    required ReturnStatus status,
    String? exchangeOrderId,
  }) async {
    // Map return status to order status
    String orderStatus;
    switch (status) {
      case ReturnStatus.requested:
        orderStatus = type == ReturnType.exchange ? 'exchange_requested' : 'return_requested';
        break;
      case ReturnStatus.approved:
        orderStatus = type == ReturnType.exchange ? 'exchange_approved' : 'return_approved';
        break;
      case ReturnStatus.pickupScheduled:
      case ReturnStatus.pickupInProgress:
        orderStatus = 'pickup_pending';
        break;
      case ReturnStatus.pickupCompleted:
        orderStatus = 'pickup_completed';
        break;
      case ReturnStatus.qcFailed:
        orderStatus = 'delivered'; // Revert to delivered
        break;
      case ReturnStatus.refundInitiated:
        orderStatus = 'refund_initiated';
        break;
      case ReturnStatus.refundCompleted:
        orderStatus = 'returned';
        break;
      case ReturnStatus.exchangeShipped:
        orderStatus = 'exchange_shipped';
        break;
      case ReturnStatus.exchangeDelivered:
        orderStatus = 'exchanged';
        break;
      case ReturnStatus.rejected:
        orderStatus = 'delivered'; // Revert to delivered
        break;
      case ReturnStatus.cancelled:
      case ReturnStatus.closed:
        orderStatus = 'delivered'; // Revert to delivered
        break;
    }

    await _firestore.collection('orders').doc(orderId).update({
      'hasReturnRequest': status != ReturnStatus.cancelled && status != ReturnStatus.closed,
      'hasExchangeRequest': type == ReturnType.exchange && status != ReturnStatus.cancelled,
      'returnRequestId': returnId,
      'returnStatus': status.toJson(),
      'returnType': type.toJson(),
      'orderStatus': orderStatus,
      if (exchangeOrderId != null) 'exchangeOrderId': exchangeOrderId,
      'updatedAt': FieldValue.serverTimestamp(),
    });

    debugPrint('🔄 Synced order $orderId with return status: $orderStatus');
  }

  /// Get all active return reasons
  Future<List<ReturnReasonModel>> getReturnReasons() async {
    try {
      final snapshot = await _reasonsRef
          .where('isActive', isEqualTo: true)
          .orderBy('sortOrder')
          .get();

      return snapshot.docs
          .map((doc) => ReturnReasonModel.fromMap(doc.data(), doc.id))
          .toList();
    } catch (e) {
      debugPrint('❌ getReturnReasons error: $e');
      // Return default reasons if Firestore fails
      return DefaultReturnReasons.reasons
          .map((r) => ReturnReasonModel.fromMap(r, r['code'] ?? ''))
          .toList();
    }
  }

  /// Seed default reasons (called once by admin)
  Future<void> seedDefaultReasons() async {
    final batch = _firestore.batch();
    for (final reason in DefaultReturnReasons.reasons) {
      final docRef = _reasonsRef.doc(reason['code']);
      batch.set(docRef, {
        ...reason,
        'isActive': true,
        'createdAt': FieldValue.serverTimestamp(),
      }, SetOptions(merge: true));
    }
    await batch.commit();
    debugPrint('✅ Seeded ${DefaultReturnReasons.reasons.length} return reasons');
  }

  // ══════════════════════════════════════════════════════════════════════════
  // CREATE RETURN REQUEST (Customer App)
  // ══════════════════════════════════════════════════════════════════════════

  /// Create a new return/exchange request
  Future<ReturnRequestModel> createReturnRequest({
    required String orderId,
    required String orderNumber,
    required String orderItemId,
    required String productId,
    required String productName,
    String? productImage,
    String? variantInfo,
    required int quantity,
    required double itemPrice,
    required String userId,
    required String userName,
    String? userPhone,
    required String sellerId,
    required String sellerName,
    required ReturnType type,
    required String reasonCode,
    required String reasonTitle,
    String? customerNotes,
    List<String> customerImages = const [],
    String? customerVideo,
    String? exchangeVariantId,
    String? exchangeVariantInfo,
    required String pickupAddress,
  }) async {
    try {
      final returnId = _returnsRef.doc().id;
      final returnNumber = ReturnRequestModel.generateReturnNumber();

      final request = ReturnRequestModel(
        id: returnId,
        orderId: orderId,
        orderNumber: orderNumber,
        orderItemId: orderItemId,
        productId: productId,
        productName: productName,
        productImage: productImage,
        variantInfo: variantInfo,
        quantity: quantity,
        itemPrice: itemPrice,
        userId: userId,
        userName: userName,
        userPhone: userPhone,
        sellerId: sellerId,
        sellerName: sellerName,
        type: type,
        status: ReturnStatus.requested,
        reasonCode: reasonCode,
        reasonTitle: reasonTitle,
        customerNotes: customerNotes,
        customerImages: customerImages,
        customerVideo: customerVideo,
        exchangeVariantId: exchangeVariantId,
        exchangeVariantInfo: exchangeVariantInfo,
        pickupAddress: pickupAddress,
        refundAmount: itemPrice * quantity,
      );

      await _returnsRef.doc(returnId).set(request.toMap());

      // ✅ ENHANCED: Sync order with full return/exchange tracking
      await _syncOrderWithReturn(
        orderId: orderId,
        returnId: returnId,
        type: type,
        status: ReturnStatus.requested,
      );

      debugPrint('✅ Created return request: $returnId');
      return request;
    } catch (e) {
      debugPrint('❌ createReturnRequest error: $e');
      rethrow;
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // UPLOAD EVIDENCE (Customer App)
  // ══════════════════════════════════════════════════════════════════════════

  /// Upload return evidence image
  Future<String> uploadReturnImage({
    required String returnId,
    required String filePath,
    required String userId,
  }) async {
    try {
      final file = File(filePath);
      final fileName = '${DateTime.now().millisecondsSinceEpoch}.jpg';
      final ref = _storage.ref('return_evidence/$returnId/$fileName');
      
      await ref.putFile(file);
      final url = await ref.getDownloadURL();
      
      // Add to return request
      await _returnsRef.doc(returnId).update({
        'customerImages': FieldValue.arrayUnion([url]),
        'updatedAt': FieldValue.serverTimestamp(),
      });
      
      return url;
    } catch (e) {
      debugPrint('❌ uploadReturnImage error: $e');
      rethrow;
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // GET RETURN REQUESTS
  // ══════════════════════════════════════════════════════════════════════════

  /// Get return requests for a customer
  Stream<List<ReturnRequestModel>> getCustomerReturns(String userId) {
    return _returnsRef
        .where('userId', isEqualTo: userId)
        .orderBy('createdAt', descending: true)
        .snapshots()
        .map((snapshot) => snapshot.docs
            .map((doc) => ReturnRequestModel.fromMap(doc.data(), doc.id))
            .toList());
  }

  /// Get return requests for a seller
  Stream<List<ReturnRequestModel>> getSellerReturns({
    required String sellerId,
    ReturnStatus? statusFilter,
    int limit = 50,
  }) {
    Query<Map<String, dynamic>> query = _returnsRef
        .where('sellerId', isEqualTo: sellerId)
        .orderBy('createdAt', descending: true)
        .limit(limit);

    if (statusFilter != null) {
      query = query.where('status', isEqualTo: statusFilter.toJson());
    }

    return query.snapshots().map((snapshot) => snapshot.docs
        .map((doc) => ReturnRequestModel.fromMap(doc.data(), doc.id))
        .toList());
  }

  /// Get all return requests (Admin)
  Stream<List<ReturnRequestModel>> getAllReturns({
    ReturnStatus? statusFilter,
    int limit = 100,
  }) {
    Query<Map<String, dynamic>> query = _returnsRef
        .orderBy('createdAt', descending: true)
        .limit(limit);

    if (statusFilter != null) {
      query = query.where('status', isEqualTo: statusFilter.toJson());
    }

    return query.snapshots().map((snapshot) => snapshot.docs
        .map((doc) => ReturnRequestModel.fromMap(doc.data(), doc.id))
        .toList());
  }

  /// Get a single return request
  Future<ReturnRequestModel?> getReturnRequest(String returnId) async {
    final doc = await _returnsRef.doc(returnId).get();
    if (!doc.exists) return null;
    return ReturnRequestModel.fromMap(doc.data()!, doc.id);
  }

  /// Stream a single return request
  Stream<ReturnRequestModel?> streamReturnRequest(String returnId) {
    return _returnsRef.doc(returnId).snapshots().map((doc) {
      if (!doc.exists) return null;
      return ReturnRequestModel.fromMap(doc.data()!, doc.id);
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SELLER ACTIONS
  // ══════════════════════════════════════════════════════════════════════════

  /// Seller approves return request
  Future<void> approveReturn({
    required String returnId,
    String? sellerNotes,
  }) async {
    // Get return to access orderId and type
    final doc = await _returnsRef.doc(returnId).get();
    if (!doc.exists) throw Exception('Return not found');
    final request = ReturnRequestModel.fromMap(doc.data()!, doc.id);
    
    await _returnsRef.doc(returnId).update({
      'status': ReturnStatus.approved.toJson(),
      'sellerNotes': sellerNotes,
      'sellerRespondedAt': FieldValue.serverTimestamp(),
      'updatedAt': FieldValue.serverTimestamp(),
    });
    
    // ✅ Sync order status
    await _syncOrderWithReturn(
      orderId: request.orderId,
      returnId: returnId,
      type: request.type,
      status: ReturnStatus.approved,
    );
    
    debugPrint('✅ Approved return: $returnId');
  }

  /// Seller rejects return request
  Future<void> rejectReturn({
    required String returnId,
    required String rejectionReason,
    String? sellerNotes,
  }) async {
    // Get return to access orderId and type
    final doc = await _returnsRef.doc(returnId).get();
    if (!doc.exists) throw Exception('Return not found');
    final request = ReturnRequestModel.fromMap(doc.data()!, doc.id);
    
    await _returnsRef.doc(returnId).update({
      'status': ReturnStatus.rejected.toJson(),
      'sellerRejectionReason': rejectionReason,
      'sellerNotes': sellerNotes,
      'sellerRespondedAt': FieldValue.serverTimestamp(),
      'closedAt': FieldValue.serverTimestamp(),
      'updatedAt': FieldValue.serverTimestamp(),
    });
    
    // ✅ Sync order status (reverts to delivered)
    await _syncOrderWithReturn(
      orderId: request.orderId,
      returnId: returnId,
      type: request.type,
      status: ReturnStatus.rejected,
    );
    
    debugPrint('❌ Rejected return: $returnId');
  }

  /// Schedule pickup
  Future<void> schedulePickup({
    required String returnId,
    required DateTime pickupDate,
    required String pickupSlot,
    String? pickupAgentName,
    String? pickupAgentPhone,
  }) async {
    await _returnsRef.doc(returnId).update({
      'status': ReturnStatus.pickupScheduled.toJson(),
      'pickupScheduledAt': Timestamp.fromDate(pickupDate),
      'pickupSlot': pickupSlot,
      'pickupAgentName': pickupAgentName,
      'pickupAgentPhone': pickupAgentPhone,
      'updatedAt': FieldValue.serverTimestamp(),
    });
    debugPrint('📅 Scheduled pickup for return: $returnId');
  }

  /// Complete QC and pickup
  Future<void> completePickupWithQC({
    required String returnId,
    required ReturnQCModel qcResult,
  }) async {
    final updateData = <String, dynamic>{
      'qcResult': qcResult.toMap(),
      'pickupCompletedAt': FieldValue.serverTimestamp(),
      'updatedAt': FieldValue.serverTimestamp(),
    };

    if (qcResult.result == QCResult.passed) {
      updateData['status'] = ReturnStatus.pickupCompleted.toJson();
    } else {
      updateData['status'] = ReturnStatus.qcFailed.toJson();
      updateData['closedAt'] = FieldValue.serverTimestamp();
    }

    await _returnsRef.doc(returnId).update(updateData);
    debugPrint('✅ Completed pickup with QC for: $returnId');
  }

  // ══════════════════════════════════════════════════════════════════════════
  // REFUND PROCESSING
  // ══════════════════════════════════════════════════════════════════════════

  /// Set refund method (for COD orders)
  Future<void> setRefundMethod({
    required String returnId,
    required String refundMethod, // 'bank' or 'upi'
    required String accountDetails, // Account number or UPI ID
  }) async {
    await _returnsRef.doc(returnId).update({
      'refundMethod': refundMethod,
      'refundAccountDetails': accountDetails,
      'updatedAt': FieldValue.serverTimestamp(),
    });
  }

  /// Initiate refund
  Future<void> initiateRefund({
    required String returnId,
    required double amount,
  }) async {
    await _returnsRef.doc(returnId).update({
      'status': ReturnStatus.refundInitiated.toJson(),
      'refundAmount': amount,
      'refundInitiatedAt': FieldValue.serverTimestamp(),
      'updatedAt': FieldValue.serverTimestamp(),
    });
    debugPrint('💰 Initiated refund for: $returnId');
  }

  /// Complete refund
  Future<void> completeRefund({
    required String returnId,
    required String transactionId,
  }) async {
    // Get return to access orderId and type
    final doc = await _returnsRef.doc(returnId).get();
    if (!doc.exists) throw Exception('Return not found');
    final request = ReturnRequestModel.fromMap(doc.data()!, doc.id);
    
    await _returnsRef.doc(returnId).update({
      'status': ReturnStatus.refundCompleted.toJson(),
      'refundTransactionId': transactionId,
      'refundCompletedAt': FieldValue.serverTimestamp(),
      'closedAt': FieldValue.serverTimestamp(),
      'updatedAt': FieldValue.serverTimestamp(),
    });
    
    // ✅ Sync order status to 'returned'
    await _syncOrderWithReturn(
      orderId: request.orderId,
      returnId: returnId,
      type: request.type,
      status: ReturnStatus.refundCompleted,
    );

    debugPrint('✅ Completed refund for: $returnId, txn: $transactionId');
  }

  // ══════════════════════════════════════════════════════════════════════════
  // EXCHANGE PROCESSING
  // ══════════════════════════════════════════════════════════════════════════

  /// Ship exchange item
  Future<void> shipExchangeItem({
    required String returnId,
    required String exchangeOrderId,
  }) async {
    // Get return to access orderId
    final doc = await _returnsRef.doc(returnId).get();
    if (!doc.exists) throw Exception('Return not found');
    final request = ReturnRequestModel.fromMap(doc.data()!, doc.id);
    
    await _returnsRef.doc(returnId).update({
      'status': ReturnStatus.exchangeShipped.toJson(),
      'exchangeOrderId': exchangeOrderId,
      'updatedAt': FieldValue.serverTimestamp(),
    });
    
    // ✅ Sync order status to 'exchange_shipped'
    await _syncOrderWithReturn(
      orderId: request.orderId,
      returnId: returnId,
      type: request.type,
      status: ReturnStatus.exchangeShipped,
      exchangeOrderId: exchangeOrderId,
    );
    
    debugPrint('📦 Shipped exchange for: $returnId');
  }

  /// Complete exchange
  Future<void> completeExchange({
    required String returnId,
  }) async {
    // Get return to access orderId
    final doc = await _returnsRef.doc(returnId).get();
    if (!doc.exists) throw Exception('Return not found');
    final request = ReturnRequestModel.fromMap(doc.data()!, doc.id);
    
    await _returnsRef.doc(returnId).update({
      'status': ReturnStatus.exchangeDelivered.toJson(),
      'closedAt': FieldValue.serverTimestamp(),
      'updatedAt': FieldValue.serverTimestamp(),
    });
    
    // ✅ Sync order status to 'exchanged'
    await _syncOrderWithReturn(
      orderId: request.orderId,
      returnId: returnId,
      type: request.type,
      status: ReturnStatus.exchangeDelivered,
    );
    
    debugPrint('✅ Completed exchange for: $returnId');
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ADMIN ACTIONS
  // ══════════════════════════════════════════════════════════════════════════

  /// Force approve return (admin override)
  Future<void> forceApprove({
    required String returnId,
    required String adminId,
    String? adminNotes,
  }) async {
    await _returnsRef.doc(returnId).update({
      'status': ReturnStatus.approved.toJson(),
      'isAdminOverride': true,
      'adminId': adminId,
      'adminNotes': adminNotes,
      'updatedAt': FieldValue.serverTimestamp(),
    });
    debugPrint('🔧 Admin force approved: $returnId');
  }

  /// Update return status (admin)
  Future<void> updateStatus({
    required String returnId,
    required ReturnStatus newStatus,
    String? adminNotes,
    String? adminId,
  }) async {
    final updateData = <String, dynamic>{
      'status': newStatus.toJson(),
      'updatedAt': FieldValue.serverTimestamp(),
    };

    if (adminId != null) {
      updateData['isAdminOverride'] = true;
      updateData['adminId'] = adminId;
    }
    if (adminNotes != null) {
      updateData['adminNotes'] = adminNotes;
    }
    if (newStatus.isFinal) {
      updateData['closedAt'] = FieldValue.serverTimestamp();
    }

    await _returnsRef.doc(returnId).update(updateData);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // CUSTOMER ACTIONS
  // ══════════════════════════════════════════════════════════════════════════

  /// Cancel return request
  Future<void> cancelReturn(String returnId) async {
    final doc = await _returnsRef.doc(returnId).get();
    if (!doc.exists) throw Exception('Return request not found');

    final request = ReturnRequestModel.fromMap(doc.data()!, doc.id);
    if (!request.canCancel) {
      throw Exception('Cannot cancel return in current status');
    }

    await _returnsRef.doc(returnId).update({
      'status': ReturnStatus.cancelled.toJson(),
      'closedAt': FieldValue.serverTimestamp(),
      'updatedAt': FieldValue.serverTimestamp(),
    });

    // ✅ Sync order status (reverts to delivered)
    await _syncOrderWithReturn(
      orderId: request.orderId,
      returnId: returnId,
      type: request.type,
      status: ReturnStatus.cancelled,
    );

    debugPrint('❌ Cancelled return: $returnId');
  }

  // ══════════════════════════════════════════════════════════════════════════
  // DUPLICATE PREVENTION & APPEAL SYSTEM
  // ══════════════════════════════════════════════════════════════════════════

  /// Check if a return request already exists for this order item
  Future<ReturnRequestModel?> getExistingReturnForOrderItem({
    required String orderId,
    required String orderItemId,
  }) async {
    try {
      final snapshot = await _returnsRef
          .where('orderId', isEqualTo: orderId)
          .where('orderItemId', isEqualTo: orderItemId)
          .limit(1)
          .get();

      if (snapshot.docs.isEmpty) return null;
      return ReturnRequestModel.fromMap(snapshot.docs.first.data(), snapshot.docs.first.id);
    } catch (e) {
      debugPrint('❌ getExistingReturnForOrderItem error: $e');
      return null;
    }
  }

  /// Check if user can create a new return request (one per order item)
  Future<bool> canCreateReturnRequest({
    required String orderId,
    required String orderItemId,
  }) async {
    final existing = await getExistingReturnForOrderItem(
      orderId: orderId,
      orderItemId: orderItemId,
    );
    return existing == null;
  }

  /// Mark return as appealed (links to support chat)
  Future<void> markAsAppealed({
    required String returnId,
    required String chatId, // Support chat ID for this appeal
  }) async {
    final doc = await _returnsRef.doc(returnId).get();
    if (!doc.exists) throw Exception('Return request not found');

    final request = ReturnRequestModel.fromMap(doc.data()!, doc.id);
    
    // Validate appeal eligibility
    if (request.hasAppealed) {
      throw Exception('You have already appealed this return request');
    }
    if (request.status != ReturnStatus.rejected) {
      throw Exception('Can only appeal rejected returns');
    }
    if (request.isAppealExpired) {
      throw Exception('Appeal window has expired (24 hours from rejection)');
    }

    await _returnsRef.doc(returnId).update({
      'hasAppealed': true,
      'appealedAt': FieldValue.serverTimestamp(),
      'appealChatId': chatId,
      'updatedAt': FieldValue.serverTimestamp(),
    });

    debugPrint('📢 Marked return as appealed: $returnId, chat: $chatId');
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ANALYTICS
  // ══════════════════════════════════════════════════════════════════════════

  /// Get return stats for seller
  Future<Map<String, dynamic>> getSellerReturnStats(String sellerId) async {
    final snapshot = await _returnsRef
        .where('sellerId', isEqualTo: sellerId)
        .get();

    int total = snapshot.docs.length;
    int pending = 0;
    int approved = 0;
    int refunded = 0;
    int rejected = 0;
    double totalRefundAmount = 0;

    for (final doc in snapshot.docs) {
      final status = doc.data()['status'] ?? '';
      switch (status) {
        case 'requested':
          pending++;
          break;
        case 'approved':
        case 'pickupScheduled':
        case 'pickupCompleted':
          approved++;
          break;
        case 'refundCompleted':
          refunded++;
          totalRefundAmount += (doc.data()['refundAmount'] as num?)?.toDouble() ?? 0;
          break;
        case 'rejected':
          rejected++;
          break;
      }
    }

    return {
      'total': total,
      'pending': pending,
      'approved': approved,
      'refunded': refunded,
      'rejected': rejected,
      'totalRefundAmount': totalRefundAmount,
    };
  }
}
