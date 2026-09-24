// lib/screens/orders/widgets/enhanced_order_card.dart
// Enhanced Order Card Wrapper with Swipe Actions, Priority Badges, and Quick Actions

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_slidable/flutter_slidable.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:cloud_firestore/cloud_firestore.dart';

import 'package:letbuyy_models/letbuyy_models.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'seller_order_card.dart';
import 'smart_suggestion_card.dart';
import 'courier_assignment_sheet.dart';
import 'order_notes_dialog.dart';

/// Card density modes
enum CardDensity { compact, normal, detailed }

/// Enhanced Order Card with swipe actions and new features
class EnhancedOrderCard extends StatefulWidget {
  final OrderModel order;
  final VoidCallback onTap;
  final bool isSelected;
  final bool isSelectionMode;
  final VoidCallback? onToggleSelect;
  final CardDensity density;
  final int? customerOrderCount;
  final VoidCallback? onStatusChanged;

  const EnhancedOrderCard({
    super.key,
    required this.order,
    required this.onTap,
    this.isSelected = false,
    this.isSelectionMode = false,
    this.onToggleSelect,
    this.density = CardDensity.normal,
    this.customerOrderCount,
    this.onStatusChanged,
  });

  @override
  State<EnhancedOrderCard> createState() => _EnhancedOrderCardState();
}

class _EnhancedOrderCardState extends State<EnhancedOrderCard> {
  final bool _showSettlement = false;
  bool _showSuggestion = true;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final status = widget.order.orderStatus.toLowerCase();
    final canSwipe = status != 'delivered' && status != 'cancelled';

    Widget card = _buildCardContent(isDark);

    // Wrap with Slidable for swipe actions
    if (canSwipe) {
      card = Slidable(
        key: ValueKey(widget.order.id),
        
        // Right swipe - Call customer
        startActionPane: ActionPane(
          motion: const BehindMotion(),
          extentRatio: 0.25,
          children: [
            CustomSlidableAction(
              onPressed: (_) => _callCustomer(),
              backgroundColor: Colors.green,
              foregroundColor: Colors.white,
              borderRadius: const BorderRadius.horizontal(left: Radius.circular(16)),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: const [
                  Icon(Icons.phone_rounded, size: 24),
                  SizedBox(height: 4),
                  Text('Call', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
                ],
              ),
            ),
          ],
        ),
        
        // Left swipe - Ship/Process
        endActionPane: ActionPane(
          motion: const BehindMotion(),
          extentRatio: 0.5,
          children: [
            if (status == 'pending')
              CustomSlidableAction(
                onPressed: (_) => _acceptOrder(),
                backgroundColor: Colors.blue,
                foregroundColor: Colors.white,
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: const [
                    Icon(Icons.check_circle_rounded, size: 24),
                    SizedBox(height: 4),
                    Text('Accept', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
                  ],
                ),
              ),
            if (status == 'processing')
              CustomSlidableAction(
                onPressed: (_) => _openCourierSheet(),
                backgroundColor: Colors.purple,
                foregroundColor: Colors.white,
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: const [
                    Icon(Icons.local_shipping_rounded, size: 24),
                    SizedBox(height: 4),
                    Text('Ship', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
                  ],
                ),
              ),
            if (status == 'shipped')
              CustomSlidableAction(
                onPressed: (_) => _markDelivered(),
                backgroundColor: Colors.green,
                foregroundColor: Colors.white,
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: const [
                    Icon(Icons.done_all_rounded, size: 24),
                    SizedBox(height: 4),
                    Text('Delivered', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
                  ],
                ),
              ),
            CustomSlidableAction(
              onPressed: (_) => _openNotesDialog(),
              backgroundColor: Colors.orange,
              foregroundColor: Colors.white,
              borderRadius: const BorderRadius.horizontal(right: Radius.circular(16)),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: const [
                  Icon(Icons.note_add_rounded, size: 24),
                  SizedBox(height: 4),
                  Text('Note', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
                ],
              ),
            ),
          ],
        ),
        
        child: card,
      );
    }

    // Wrap with selection overlay if in selection mode
    if (widget.isSelectionMode) {
      card = Stack(
        children: [
          card,
          Positioned(
            top: 12,
            right: 12,
            child: GestureDetector(
              onTap: widget.onToggleSelect,
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                width: 28,
                height: 28,
                decoration: BoxDecoration(
                  color: widget.isSelected ? AppColors.primary : Colors.white.withValues(alpha: 0.9),
                  shape: BoxShape.circle,
                  border: Border.all(
                    color: widget.isSelected ? AppColors.primary : Colors.grey,
                    width: 2,
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.1),
                      blurRadius: 4,
                    ),
                  ],
                ),
                child: widget.isSelected
                    ? const Icon(Icons.check, color: Colors.white, size: 18)
                    : null,
              ),
            ),
          ),
        ],
      );
    }

    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: card,
    );
  }

  Widget _buildCardContent(bool isDark) {
    return GestureDetector(
      onLongPress: () {
        HapticFeedback.mediumImpact();
        widget.onToggleSelect?.call();
      },
      child: Column(
        children: [
          // Main Order Card (now includes all actions, settlement, COD alert)
          SellerOrderCard(
            order: widget.order,
            onTap: widget.onTap,
            isCompact: widget.density == CardDensity.compact,
            showActions: widget.density != CardDensity.compact,
            onAction: (action) => _handleCardAction(action),
          ),
          
          // Smart Suggestion (keep this - it's unique contextual help)
          if (widget.density == CardDensity.detailed && _showSuggestion)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
              child: SmartSuggestionCard(
                order: widget.order,
                customerOrderCount: widget.customerOrderCount,
                onDismiss: () => setState(() => _showSuggestion = false),
              ),
            ),
        ],
      ),
    );
  }

  /// Handle actions from SellerOrderCard
  void _handleCardAction(String action) {
    switch (action) {
      case 'accept':
        _acceptOrder();
        break;
      case 'reject':
        _rejectOrder();
        break;
      case 'status_processing':
        _updateOrderStatus('processing');
        break;
      case 'status_shipped':
        _updateOrderStatus('shipped');
        break;
      case 'status_delivered':
        _markDelivered();
        break;
    }
  }


  Widget _buildQuickActionRow(bool isDark) {
    final status = widget.order.orderStatus.toLowerCase();


    return Row(
      children: [
        // Status-specific actions
        if (status == 'pending') ...[
          _buildQuickAction(
            icon: Icons.check_circle_rounded,
            label: 'Accept',
            color: Colors.green,
            onTap: _acceptOrder,
          ),
          const SizedBox(width: 8),
          _buildQuickAction(
            icon: Icons.cancel_rounded,
            label: 'Reject',
            color: Colors.red,
            onTap: _rejectOrder,
          ),
        ],
        if (status == 'processing') ...[
          _buildQuickAction(
            icon: Icons.inventory_2_rounded,
            label: 'Pack',
            color: Colors.blue,
            onTap: _markPacked,
          ),
          const SizedBox(width: 8),
          _buildQuickAction(
            icon: Icons.local_shipping_rounded,
            label: 'Ship',
            color: Colors.purple,
            onTap: _openCourierSheet,
          ),
        ],
        if (status == 'shipped')
          _buildQuickAction(
            icon: Icons.done_all_rounded,
            label: 'Delivered',
            color: Colors.green,
            onTap: _markDelivered,
          ),
        
        const Spacer(),
        
        // Common actions
        _buildIconAction(Icons.phone_rounded, Colors.green, _callCustomer),
        const SizedBox(width: 8),
        _buildIconAction(Icons.chat_rounded, Colors.blue, _openChat),
        const SizedBox(width: 8),
        _buildIconAction(Icons.note_add_rounded, Colors.orange, _openNotesDialog),
      ],
    );
  }

  Widget _buildQuickAction({
    required IconData icon,
    required String label,
    required Color color,
    required VoidCallback onTap,
  }) {
    return Material(
      color: color.withValues(alpha: 0.1),
      borderRadius: BorderRadius.circular(10),
      child: InkWell(
        onTap: () {
          HapticFeedback.lightImpact();
          onTap();
        },
        borderRadius: BorderRadius.circular(10),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: 16, color: color),
              const SizedBox(width: 6),
              Text(
                label,
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: color,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildIconAction(IconData icon, Color color, VoidCallback onTap) {
    return Material(
      color: color.withValues(alpha: 0.1),
      shape: const CircleBorder(),
      child: InkWell(
        onTap: () {
          HapticFeedback.lightImpact();
          onTap();
        },
        customBorder: const CircleBorder(),
        child: Padding(
          padding: const EdgeInsets.all(8),
          child: Icon(icon, size: 18, color: color),
        ),
      ),
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ACTIONS
  // ═══════════════════════════════════════════════════════════════════════════

  void _callCustomer() async {
    final phone = widget.order.deliveryAddress.phone;
    if (phone.isEmpty) {
      _showSnackBar('No phone number available');
      return;
    }
    
    final url = Uri.parse('tel:$phone');
    if (await canLaunchUrl(url)) {
      await launchUrl(url);
    }
  }

  void _openChat() {
    // TODO: Implement chat functionality
    _showSnackBar('Chat feature coming soon');
  }

  void _acceptOrder() async {
    await _updateOrderStatus('processing');
  }

  void _rejectOrder() async {
    // Show reason dialog first
    final reason = await showDialog<String>(
      context: context,
      builder: (context) => _RejectReasonDialog(),
    );
    
    if (reason != null) {
      await _updateOrderStatus('cancelled', reason: reason);
    }
  }

  void _markPacked() async {
    // Add packed status or move to processing with packed flag
    await _updateOrderStatus('processing', additionalData: {'isPacked': true});
    _showSnackBar('Order marked as packed');
  }

  void _openCourierSheet() {
    CourierAssignmentSheet.show(
      context,
      order: widget.order,
      onAssigned: (courierId, awb) async {
        await _updateOrderStatus('shipped', additionalData: {
          'courierAssigned': courierId,
          'awbNumber': awb,
          'shippedAt': FieldValue.serverTimestamp(),
        });
      },
    );
  }

  void _markDelivered() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Mark as Delivered?'),
        content: const Text('Confirm that this order has been delivered to the customer.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, true),
            style: ElevatedButton.styleFrom(backgroundColor: Colors.green),
            child: const Text('Confirm Delivery'),
          ),
        ],
      ),
    );
    
    if (confirmed == true) {
      await _updateOrderStatus('delivered', additionalData: {
        'deliveredAt': FieldValue.serverTimestamp(),
      });
    }
  }

  void _openNotesDialog() {
    OrderNotesDialog.show(
      context,
      orderId: widget.order.id,
      currentTags: [], // TODO: Get from order
      currentNotes: [],
      onSave: (tags, note) async {
        final updates = <String, dynamic>{
          'tags': tags,
          'updatedAt': FieldValue.serverTimestamp(),
        };
        
        if (note != null) {
          updates['internalNotes'] = FieldValue.arrayUnion([note.toMap()]);
        }
        
        await FirebaseFirestore.instance
            .collection('orders')
            .doc(widget.order.id)
            .update(updates);
        
        _showSnackBar('Notes saved');
      },
    );
  }

  Future<void> _updateOrderStatus(String newStatus, {String? reason, Map<String, dynamic>? additionalData}) async {
    try {
      final updates = <String, dynamic>{
        'orderStatus': newStatus,
        'updatedAt': FieldValue.serverTimestamp(),
        'statusHistory': FieldValue.arrayUnion([
          {
            'status': newStatus,
            'timestamp': Timestamp.now(),
            'updatedBy': 'seller',
            if (reason != null) 'reason': reason,
          }
        ]),
      };
      
      if (additionalData != null) {
        updates.addAll(additionalData);
      }
      
      if (reason != null) {
        updates['cancelReason'] = reason;
        updates['cancelledAt'] = FieldValue.serverTimestamp();
      }
      
      await FirebaseFirestore.instance
          .collection('orders')
          .doc(widget.order.id)
          .update(updates);
      
      widget.onStatusChanged?.call();
      _showSnackBar('Order updated to ${newStatus.toUpperCase()}');
    } catch (e) {
      _showSnackBar('Error: $e', isError: true);
    }
  }

  void _showSnackBar(String message, {bool isError = false}) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: isError ? Colors.red : Colors.green,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      ),
    );
  }
}

/// Reject Reason Dialog
class _RejectReasonDialog extends StatefulWidget {
  @override
  State<_RejectReasonDialog> createState() => _RejectReasonDialogState();
}

class _RejectReasonDialogState extends State<_RejectReasonDialog> {
  String? _selectedReason;
  final _customController = TextEditingController();

  final _reasons = [
    'Out of stock',
    'Unable to fulfill',
    'Customer requested cancellation',
    'Pricing error',
    'Duplicate order',
    'Other',
  ];

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Cancel Order'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Text('Select a reason for cancellation:'),
          const SizedBox(height: 16),
          ...(_reasons.map((reason) => RadioListTile<String>(
            title: Text(reason),
            value: reason,
            groupValue: _selectedReason,
            onChanged: (v) => setState(() => _selectedReason = v),
            dense: true,
          ))),
          if (_selectedReason == 'Other') ...[
            const SizedBox(height: 8),
            TextField(
              controller: _customController,
              decoration: const InputDecoration(
                hintText: 'Enter reason...',
                border: OutlineInputBorder(),
              ),
              maxLines: 2,
            ),
          ],
        ],
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Cancel'),
        ),
        ElevatedButton(
          onPressed: _selectedReason != null
              ? () {
                  final reason = _selectedReason == 'Other'
                      ? _customController.text
                      : _selectedReason;
                  Navigator.pop(context, reason);
                }
              : null,
          style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
          child: const Text('Confirm Cancel'),
        ),
      ],
    );
  }
}
