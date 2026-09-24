// lib/services/product_approval_service.dart
// Product Approval Service with Notifications

import 'package:cloud_firestore/cloud_firestore.dart';

/// Product Status Lifecycle
enum ProductStatus {
  draft,
  submitted,
  underReview,
  approved,
  rejected,
  live,
}

/// Rejection Reasons (Predefined)
enum RejectionReason {
  invalidGstin('Invalid or missing GSTIN'),
  wrongHsnCode('Wrong HSN code'),
  gstRequired('Product requires GST registration'),
  complianceMissing('Compliance details missing'),
  imagePolicyViolation('Image policy violation'),
  pricingViolation('Pricing violation'),
  other('Other');

  final String message;
  const RejectionReason(this.message);
}

/// Product Approval Service
class ProductApprovalService {
  static final _firestore = FirebaseFirestore.instance;

  /// Submit product for review (Seller action)
  static Future<void> submitForReview(String productId) async {
    await _firestore.collection('products').doc(productId).update({
      'status': ProductStatus.submitted.name,
      'submittedAt': FieldValue.serverTimestamp(),
      'updatedAt': FieldValue.serverTimestamp(),
    });

    // Create admin notification
    await _createAdminNotification(
      productId: productId,
      title: 'New Product Submitted',
      message: 'A product is waiting for review',
      type: 'product_submitted',
    );
  }

  /// Approve product (Admin action)
  static Future<void> approveProduct({
    required String productId,
    required String adminId,
    String? notes,
  }) async {
    final productDoc = await _firestore.collection('products').doc(productId).get();
    final sellerId = productDoc.data()?['sellerId'] as String?;
    final productName = productDoc.data()?['name'] as String? ?? 'Product';

    // Update product status
    await _firestore.collection('products').doc(productId).update({
      'status': ProductStatus.approved.name,
      'isActive': true,
      'approvedAt': FieldValue.serverTimestamp(),
      'approvedBy': adminId,
      'adminNotes': notes,
      'updatedAt': FieldValue.serverTimestamp(),
    });

    // Log audit
    await _logAudit(
      productId: productId,
      adminId: adminId,
      action: 'APPROVED',
      reason: notes ?? 'Product approved',
    );

    // Notify seller (In-app + Push)
    if (sellerId != null) {
      await _notifySeller(
        sellerId: sellerId,
        productId: productId,
        title: '✅ Product Approved!',
        message: '"$productName" is now live on the marketplace.',
        type: 'product_approved',
      );
    }
  }

  /// Reject product (Admin action)
  static Future<void> rejectProduct({
    required String productId,
    required String adminId,
    required RejectionReason reason,
    String? additionalNotes,
  }) async {
    final productDoc = await _firestore.collection('products').doc(productId).get();
    final sellerId = productDoc.data()?['sellerId'] as String?;
    final productName = productDoc.data()?['name'] as String? ?? 'Product';

    final fullReason = additionalNotes != null 
        ? '${reason.message}: $additionalNotes'
        : reason.message;

    // Update product status
    await _firestore.collection('products').doc(productId).update({
      'status': ProductStatus.rejected.name,
      'isActive': false,
      'rejectedAt': FieldValue.serverTimestamp(),
      'rejectedBy': adminId,
      'rejectionReason': reason.name,
      'rejectionMessage': fullReason,
      'updatedAt': FieldValue.serverTimestamp(),
    });

    // Log audit
    await _logAudit(
      productId: productId,
      adminId: adminId,
      action: 'REJECTED',
      reason: fullReason,
    );

    // Notify seller (In-app + Push)
    if (sellerId != null) {
      await _notifySeller(
        sellerId: sellerId,
        productId: productId,
        title: '❌ Product Rejected',
        message: '"$productName" needs changes: $fullReason',
        type: 'product_rejected',
      );
    }
  }

  /// Create in-app notification + trigger push for seller
  static Future<void> _notifySeller({
    required String sellerId,
    required String productId,
    required String title,
    required String message,
    required String type,
  }) async {
    // Create in-app notification (shows in seller bell icon)
    await _firestore
        .collection('sellers')
        .doc(sellerId)
        .collection('notifications')
        .add({
      'title': title,
      'message': message,
      'type': type,
      'productId': productId,
      'isRead': false,
      'createdAt': FieldValue.serverTimestamp(),
    });

    // Trigger push notification via Cloud Function (or FCM topic)
    await _firestore.collection('push_notifications').add({
      'sellerId': sellerId,
      'title': title,
      'body': message,
      'data': {
        'type': type,
        'productId': productId,
        'action': 'open_product',
      },
      'createdAt': FieldValue.serverTimestamp(),
      'sent': false,
    });
  }

  /// Create admin notification for new submissions
  static Future<void> _createAdminNotification({
    required String productId,
    required String title,
    required String message,
    required String type,
  }) async {
    await _firestore.collection('admin_notifications').add({
      'title': title,
      'message': message,
      'type': type,
      'productId': productId,
      'isRead': false,
      'createdAt': FieldValue.serverTimestamp(),
    });
  }

  /// Log audit trail
  static Future<void> _logAudit({
    required String productId,
    required String adminId,
    required String action,
    required String reason,
  }) async {
    await _firestore.collection('audit_logs').add({
      'productId': productId,
      'adminId': adminId,
      'action': action,
      'reason': reason,
      'timestamp': FieldValue.serverTimestamp(),
    });
  }

  /// Get pending products for admin review
  static Stream<QuerySnapshot> getPendingProducts() {
    return _firestore
        .collection('products')
        .where('status', isEqualTo: ProductStatus.submitted.name)
        .orderBy('submittedAt', descending: false)
        .snapshots();
  }

  /// Get product status display info
  static Map<String, dynamic> getStatusInfo(String status) {
    switch (status) {
      case 'draft':
        return {'label': 'Draft', 'color': 0xFF9E9E9E, 'icon': 'edit'};
      case 'submitted':
        return {'label': 'Submitted', 'color': 0xFF2196F3, 'icon': 'send'};
      case 'underReview':
        return {'label': 'Under Review', 'color': 0xFFFF9800, 'icon': 'pending'};
      case 'approved':
        return {'label': 'Approved', 'color': 0xFF4CAF50, 'icon': 'check_circle'};
      case 'rejected':
        return {'label': 'Rejected', 'color': 0xFFF44336, 'icon': 'cancel'};
      case 'live':
        return {'label': 'Live', 'color': 0xFF4CAF50, 'icon': 'public'};
      default:
        return {'label': 'Unknown', 'color': 0xFF9E9E9E, 'icon': 'help'};
    }
  }
}
