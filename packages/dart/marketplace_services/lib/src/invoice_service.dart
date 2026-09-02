import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/foundation.dart';
import 'package:letbuyy_marketplace_models/letbuyy_marketplace_models.dart';
import 'fee_service.dart';

/// Service for generating and managing order invoices/settlements
class InvoiceService {
  final FirebaseFirestore _firestore = FirebaseFirestore.instance;
  final FeeService _feeService = FeeService();

  // ============================================
  // GENERATE INVOICE
  // ============================================
  
  /// Generate invoice for a delivered order
  Future<OrderInvoiceModel?> generateInvoice({
    required OrderModel order,
    required double deliveryFee,
    required Map<String, double> categoryCommissions, // productId -> commission%
    required double sellerTierModifier,
  }) async {
    try {
      debugPrint('📄 Generating invoice for order: ${order.id}');
      
      final config = await _feeService.getFeeConfig();
      
      // Calculate item commissions
      final itemCommissions = <ItemCommission>[];
      double totalCommission = 0.0;
      double itemsSubtotal = 0.0;
      
      for (final item in order.items) {
        final categoryPercent = categoryCommissions[item.productId] ?? 10.0;
        final finalPercent = categoryPercent + sellerTierModifier;
        final itemSubtotal = item.price * item.quantity;
        final commissionAmount = itemSubtotal * (finalPercent / 100);
        
        itemCommissions.add(ItemCommission(
          productId: item.productId,
          productName: item.productName,
          salePrice: item.price,
          quantity: item.quantity,
          categoryPercent: categoryPercent,
          tierModifier: sellerTierModifier,
          finalPercent: finalPercent,
          commissionAmount: commissionAmount,
        ));
        
        totalCommission += commissionAmount;
        itemsSubtotal += itemSubtotal;
      }
      
      // Calculate other fees
      final isCOD = order.paymentMethod.toLowerCase() == 'cod';
      final codFee = isCOD ? config.codFee : 0.0;
      
      final isOnlinePayment = !isCOD && order.paymentStatus == 'paid';
      final pgFee = isOnlinePayment 
          ? config.calculatePGFee(order.total) 
          : 0.0;
      
      // Calculate release date (hold period)
      final releaseDate = DateTime.now().add(
        Duration(days: config.settlementHoldDays),
      );
      
      final invoice = OrderInvoiceModel(
        orderId: order.id,
        sellerId: order.sellerId ?? '',
        orderTotal: order.total,
        itemsSubtotal: itemsSubtotal,
        discountAmount: order.discount,
        platformFee: config.platformFee,
        itemCommissions: itemCommissions,
        totalCommission: totalCommission,
        deliveryFee: deliveryFee,
        codFee: codFee,
        paymentGatewayFee: pgFee,
        status: InvoiceStatus.pending,
        releaseDate: releaseDate,
        createdAt: DateTime.now(),
        updatedAt: DateTime.now(),
      );
      
      // Save to Firestore
      await _firestore
          .collection('orders')
          .doc(order.id)
          .collection('invoice')
          .doc('settlement')
          .set(invoice.toMap());
      
      debugPrint('✅ Invoice generated: Net payout ₹${invoice.netPayout.toStringAsFixed(2)}');
      return invoice;
    } catch (e) {
      debugPrint('❌ Error generating invoice: $e');
      return null;
    }
  }

  // ============================================
  // GET INVOICE
  // ============================================
  
  /// Get invoice for an order
  Future<OrderInvoiceModel?> getInvoice(String orderId) async {
    try {
      final doc = await _firestore
          .collection('orders')
          .doc(orderId)
          .collection('invoice')
          .doc('settlement')
          .get();
      
      if (doc.exists && doc.data() != null) {
        return OrderInvoiceModel.fromMap(doc.data()!, orderId);
      }
      return null;
    } catch (e) {
      debugPrint('❌ Error getting invoice: $e');
      return null;
    }
  }

  /// Stream invoice for an order
  Stream<OrderInvoiceModel?> streamInvoice(String orderId) {
    return _firestore
        .collection('orders')
        .doc(orderId)
        .collection('invoice')
        .doc('settlement')
        .snapshots()
        .map((doc) {
          if (doc.exists && doc.data() != null) {
            return OrderInvoiceModel.fromMap(doc.data()!, orderId);
          }
          return null;
        });
  }

  // ============================================
  // APPLY RTO CHARGES
  // ============================================
  
  /// Apply RTO charges to an invoice
  Future<bool> applyRTOCharges({
    required String orderId,
    required double rtoFee,
    required String reason,
    bool isDefective = false,
  }) async {
    try {
      debugPrint('💸 Applying RTO charges to order: $orderId');
      
      final invoice = await getInvoice(orderId);
      if (invoice == null) {
        debugPrint('❌ Invoice not found for order: $orderId');
        return false;
      }
      
      final config = await _feeService.getFeeConfig();
      final qualityPenalty = isDefective ? config.qualityPenalty : 0.0;
      
      final updated = invoice.copyWith(
        rtoFee: rtoFee,
        qualityPenalty: qualityPenalty,
        rtoReason: reason,
        updatedAt: DateTime.now(),
      );
      
      await _firestore
          .collection('orders')
          .doc(orderId)
          .collection('invoice')
          .doc('settlement')
          .update({
            'rtoFee': updated.rtoFee,
            'qualityPenalty': updated.qualityPenalty,
            'rtoReason': updated.rtoReason,
            'netPayout': updated.netPayout,
            'totalDeductions': updated.totalDeductions,
            'updatedAt': FieldValue.serverTimestamp(),
          });
      
      debugPrint('✅ RTO charges applied: ₹${rtoFee + qualityPenalty}');
      return true;
    } catch (e) {
      debugPrint('❌ Error applying RTO charges: $e');
      return false;
    }
  }

  // ============================================
  // UPDATE INVOICE STATUS
  // ============================================
  
  /// Update invoice status
  Future<bool> updateStatus(String orderId, InvoiceStatus status) async {
    try {
      await _firestore
          .collection('orders')
          .doc(orderId)
          .collection('invoice')
          .doc('settlement')
          .update({
            'status': status.name,
            'updatedAt': FieldValue.serverTimestamp(),
          });
      
      debugPrint('✅ Invoice status updated to: ${status.name}');
      return true;
    } catch (e) {
      debugPrint('❌ Error updating invoice status: $e');
      return false;
    }
  }

  /// Mark invoice as paid
  Future<bool> markAsPaid(String orderId, String payoutReference) async {
    try {
      await _firestore
          .collection('orders')
          .doc(orderId)
          .collection('invoice')
          .doc('settlement')
          .update({
            'status': InvoiceStatus.paid.name,
            'paidAt': FieldValue.serverTimestamp(),
            'payoutReference': payoutReference,
            'updatedAt': FieldValue.serverTimestamp(),
          });
      
      debugPrint('✅ Invoice marked as paid: $payoutReference');
      return true;
    } catch (e) {
      debugPrint('❌ Error marking invoice as paid: $e');
      return false;
    }
  }

  // ============================================
  // SELLER INVOICES
  // ============================================
  
  /// Get all invoices for a seller
  Future<List<OrderInvoiceModel>> getSellerInvoices(
    String sellerId, {
    InvoiceStatus? status,
    int limit = 50,
  }) async {
    try {
      // Note: This requires querying orders first, then getting invoices
      Query query = _firestore
          .collection('orders')
          .where('sellerId', isEqualTo: sellerId)
          .orderBy('createdAt', descending: true)
          .limit(limit);
      
      final ordersSnap = await query.get();
      
      final invoices = <OrderInvoiceModel>[];
      for (final orderDoc in ordersSnap.docs) {
        final invoiceDoc = await _firestore
            .collection('orders')
            .doc(orderDoc.id)
            .collection('invoice')
            .doc('settlement')
            .get();
        
        if (invoiceDoc.exists && invoiceDoc.data() != null) {
          final invoice = OrderInvoiceModel.fromMap(
            invoiceDoc.data()!, 
            orderDoc.id,
          );
          
          if (status == null || invoice.status == status) {
            invoices.add(invoice);
          }
        }
      }
      
      return invoices;
    } catch (e) {
      debugPrint('❌ Error getting seller invoices: $e');
      return [];
    }
  }

  /// Calculate total pending payout for a seller
  Future<double> getSellerPendingPayout(String sellerId) async {
    final invoices = await getSellerInvoices(
      sellerId, 
      status: InvoiceStatus.pending,
    );
    
    return invoices.fold<double>(0.0, (total, inv) => total + inv.netPayout);
  }

  /// Get invoices ready for payout (hold period ended)
  Future<List<OrderInvoiceModel>> getInvoicesReadyForPayout({
    int limit = 100,
  }) async {
    try {
      final now = DateTime.now();
      
      // Query orders with pending invoices
      final ordersSnap = await _firestore
          .collection('orders')
          .where('orderStatus', isEqualTo: 'delivered')
          .orderBy('updatedAt', descending: false)
          .limit(limit)
          .get();
      
      final readyInvoices = <OrderInvoiceModel>[];
      
      for (final orderDoc in ordersSnap.docs) {
        final invoiceDoc = await _firestore
            .collection('orders')
            .doc(orderDoc.id)
            .collection('invoice')
            .doc('settlement')
            .get();
        
        if (invoiceDoc.exists && invoiceDoc.data() != null) {
          final invoice = OrderInvoiceModel.fromMap(
            invoiceDoc.data()!, 
            orderDoc.id,
          );
          
          if (invoice.status == InvoiceStatus.pending && 
              invoice.releaseDate != null &&
              now.isAfter(invoice.releaseDate!)) {
            readyInvoices.add(invoice);
          }
        }
      }
      
      return readyInvoices;
    } catch (e) {
      debugPrint('❌ Error getting payout-ready invoices: $e');
      return [];
    }
  }
}
