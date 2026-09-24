// lib/screens/seller/orders/widgets/seller_order_status_updater.dart
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:cloud_firestore/cloud_firestore.dart';

import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:letbuyy_models/letbuyy_models.dart';
import 'package:letbuyy_services/letbuyy_services.dart';

class SellerOrderStatusUpdater extends StatefulWidget {
  final OrderModel order;
  final VoidCallback? onStatusUpdated;

  const SellerOrderStatusUpdater({
    super.key,
    required this.order,
    this.onStatusUpdated,
  });

  @override
  State<SellerOrderStatusUpdater> createState() =>
      _SellerOrderStatusUpdaterState();
}

class _SellerOrderStatusUpdaterState extends State<SellerOrderStatusUpdater> {
  final FirebaseFirestore _firestore = FirebaseFirestore.instance;
  late String _selectedStatus;
  final TextEditingController _trackingController = TextEditingController();
  final TextEditingController _locationController = TextEditingController();
  bool _isUpdating = false;

  @override
  void initState() {
    super.initState();
    _selectedStatus = widget.order.orderStatus.toLowerCase();
  }

  @override
  void dispose() {
    _trackingController.dispose();
    _locationController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Provider.of<ThemeProvider>(context).isDarkMode;
    final accentColor = isDark ? AppColors.primaryLight : AppColors.primary;

    return Container(
      decoration: BoxDecoration(
        color: isDark ? AppColors.surfaceDark : AppColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: isDark ? AppColors.borderDark : AppColors.border,
        ),
        boxShadow: [
          BoxShadow(
            color: isDark ? AppColors.shadowDark : AppColors.shadowLight,
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          Container(
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
            decoration: BoxDecoration(
              border: Border(
                bottom: BorderSide(
                  color: isDark ? AppColors.borderDark : AppColors.border,
                ),
              ),
            ),
            child: Row(
              children: [
                Icon(Icons.edit_rounded, color: accentColor, size: 18),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    'Update Order Status',
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w800,
                      color:
                          isDark ? AppColors.textLight : AppColors.textPrimary,
                    ),
                  ),
                ),
              ],
            ),
          ),

          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Status selector
                _buildStatusSelector(isDark, accentColor),
                const SizedBox(height: 16),

                // Tracking number input (shown for shipped status)
                if (_selectedStatus == 'shipped') ...[
                  _buildTrackingInput(isDark, accentColor),
                  const SizedBox(height: 12),
                  _buildLocationInput(isDark, accentColor),
                  const SizedBox(height: 16),
                ],

                // Update button
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton.icon(
                    onPressed: _isUpdating ? null : () => _updateStatus(context),
                    icon: _isUpdating
                        ? SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: isDark
                                  ? AppColors.textPrimary
                                  : AppColors.white,
                            ),
                          )
                        : const Icon(Icons.check_rounded, size: 20),
                    label: Text(_isUpdating ? 'Updating...' : 'Update Status'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: accentColor,
                      foregroundColor:
                          isDark ? AppColors.textPrimary : AppColors.white,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10),
                      ),
                      disabledBackgroundColor: accentColor.withValues(alpha: 0.5),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStatusSelector(bool isDark, Color accentColor) {
    final statuses = [
      {'key': 'pending', 'label': 'Pending', 'icon': Icons.schedule_rounded},
      {'key': 'confirmed', 'label': 'Confirmed', 'icon': Icons.check_circle_outline_rounded},
      {'key': 'processing', 'label': 'Processing', 'icon': Icons.autorenew_rounded},
      {'key': 'shipped', 'label': 'Shipped', 'icon': Icons.local_shipping_rounded},
      {'key': 'delivered', 'label': 'Delivered', 'icon': Icons.check_circle_rounded},
      {'key': 'cancelled', 'label': 'Cancelled', 'icon': Icons.cancel_rounded},
    ];

    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: statuses.map((status) {
        final isSelected = _selectedStatus == status['key'];
        final statusColor = _getStatusColor(status['key'] as String);

        return GestureDetector(
          onTap: () => setState(() => _selectedStatus = status['key'] as String),
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 200),
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            decoration: BoxDecoration(
              color: isSelected
                  ? statusColor.withValues(alpha: 0.15)
                  : (isDark ? AppColors.surfaceDarkVariant : AppColors.surfaceVariant),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(
                color: isSelected
                    ? statusColor
                    : (isDark ? AppColors.borderDark : AppColors.border),
                width: isSelected ? 2 : 1,
              ),
              boxShadow: isSelected
                  ? [
                      BoxShadow(
                        color: statusColor.withValues(alpha: 0.2),
                        blurRadius: 8,
                        offset: const Offset(0, 2),
                      ),
                    ]
                  : null,
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  status['icon'] as IconData,
                  size: 16,
                  color: isSelected
                      ? statusColor
                      : (isDark
                          ? AppColors.textLightSecondary
                          : AppColors.textSecondary),
                ),
                const SizedBox(width: 6),
                Text(
                  status['label'] as String,
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    color: isSelected
                        ? statusColor
                        : (isDark
                            ? AppColors.textLightSecondary
                            : AppColors.textSecondary),
                  ),
                ),
              ],
            ),
          ),
        );
      }).toList(),
    );
  }

  Widget _buildTrackingInput(bool isDark, Color accentColor) {
    return TextFormField(
      controller: _trackingController,
      style: TextStyle(
        color: isDark ? AppColors.textLight : AppColors.textPrimary,
      ),
      decoration: InputDecoration(
        labelText: 'Tracking Number (Optional)',
        labelStyle: TextStyle(
          color: isDark ? AppColors.textLightSecondary : AppColors.textSecondary,
        ),
        hintText: 'e.g., 1234567890ABC',
        hintStyle: TextStyle(
          color: isDark ? AppColors.textLightHint : AppColors.textHint,
        ),
        filled: true,
        fillColor: isDark ? AppColors.backgroundDark : AppColors.background,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: BorderSide(
            color: isDark ? AppColors.borderDark : AppColors.border,
          ),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: BorderSide(
            color: isDark ? AppColors.borderDark : AppColors.border,
          ),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: BorderSide(color: accentColor, width: 2),
        ),
        prefixIcon: Icon(
          Icons.local_shipping_rounded,
          color: isDark ? AppColors.textLightHint : AppColors.textHint,
        ),
      ),
    );
  }

  Widget _buildLocationInput(bool isDark, Color accentColor) {
    return TextFormField(
      controller: _locationController,
      style: TextStyle(
        color: isDark ? AppColors.textLight : AppColors.textPrimary,
      ),
      decoration: InputDecoration(
        labelText: 'Current Location (Optional)',
        labelStyle: TextStyle(
          color: isDark ? AppColors.textLightSecondary : AppColors.textSecondary,
        ),
        hintText: 'e.g., Warehouse, In Transit',
        hintStyle: TextStyle(
          color: isDark ? AppColors.textLightHint : AppColors.textHint,
        ),
        filled: true,
        fillColor: isDark ? AppColors.backgroundDark : AppColors.background,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: BorderSide(
            color: isDark ? AppColors.borderDark : AppColors.border,
          ),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: BorderSide(
            color: isDark ? AppColors.borderDark : AppColors.border,
          ),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: BorderSide(color: accentColor, width: 2),
        ),
        prefixIcon: Icon(
          Icons.location_on_rounded,
          color: isDark ? AppColors.textLightHint : AppColors.textHint,
        ),
      ),
    );
  }

  Future<void> _updateStatus(BuildContext context) async {
    if (_isUpdating) return;

    setState(() => _isUpdating = true);

    try {
      final order = widget.order;
      final statusTitle = _getStatusTitle(_selectedStatus);
      final statusDescription = _getStatusDescription(_selectedStatus);

      // Update order status
      await _firestore.collection('orders').doc(order.id).update({
        'orderStatus': _selectedStatus,
        'updatedAt': FieldValue.serverTimestamp(),
      });

      // Add timeline event
      final timelineData = {
        'status': _selectedStatus,
        'title': statusTitle,
        'description': statusDescription,
        'timestamp': FieldValue.serverTimestamp(),
        if (_trackingController.text.trim().isNotEmpty)
          'trackingNumber': _trackingController.text.trim(),
        if (_locationController.text.trim().isNotEmpty)
          'location': _locationController.text.trim(),
      };

      await _firestore
          .collection('orders')
          .doc(order.id)
          .collection('timeline')
          .add(timelineData);

      // Send notification to customer
      try {
        await OrderNotificationService.sendOrderStatusNotification(
          userId: order.userId,
          orderId: order.id,
          orderNumber: order.orderNumber,
          status: _selectedStatus,
          statusMessage: statusDescription,
        );
      } catch (e) {
        debugPrint('⚠️ Failed to send notification: $e');
      }

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Row(
              children: [
                const Icon(Icons.check_circle_rounded, color: Colors.white),
                const SizedBox(width: 12),
                Text('Order status updated to ${statusTitle.toLowerCase()}'),
              ],
            ),
            backgroundColor: AppColors.success,
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(10),
            ),
          ),
        );

        // Callback to refresh parent
        widget.onStatusUpdated?.call();
      }
    } catch (e) {
      debugPrint('❌ Error updating status: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Row(
              children: [
                const Icon(Icons.error_rounded, color: Colors.white),
                const SizedBox(width: 12),
                Expanded(child: Text('Error: $e')),
              ],
            ),
            backgroundColor: AppColors.error,
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(10),
            ),
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _isUpdating = false);
      }
    }
  }

  String _getStatusTitle(String status) {
    switch (status) {
      case 'pending':
        return 'Order Pending';
      case 'confirmed':
        return 'Order Confirmed';
      case 'processing':
        return 'Processing Order';
      case 'shipped':
        return 'Order Shipped';
      case 'delivered':
        return 'Order Delivered';
      case 'cancelled':
        return 'Order Cancelled';
      default:
        return 'Order Updated';
    }
  }

  String _getStatusDescription(String status) {
    switch (status) {
      case 'pending':
        return 'Your order is awaiting confirmation.';
      case 'confirmed':
        return 'Your order has been confirmed by the seller.';
      case 'processing':
        return 'Your order is being prepared for shipment.';
      case 'shipped':
        final tracking = _trackingController.text.trim();
        final location = _locationController.text.trim();
        String desc = 'Your order has been shipped and is on the way.';
        if (tracking.isNotEmpty) {
          desc += ' Tracking: $tracking.';
        }
        if (location.isNotEmpty) {
          desc += ' Current location: $location.';
        }
        return desc;
      case 'delivered':
        return 'Your order has been delivered successfully.';
      case 'cancelled':
        return 'Your order has been cancelled.';
      default:
        return 'Your order has been updated.';
    }
  }

  Color _getStatusColor(String status) {
    switch (status) {
      case 'pending':
        return AppColors.pending;
      case 'confirmed':
        return AppColors.confirmed;
      case 'processing':
        return AppColors.processing;
      case 'shipped':
        return AppColors.shipped;
      case 'delivered':
        return AppColors.delivered;
      case 'cancelled':
        return AppColors.cancelled;
      default:
        return AppColors.grey;
    }
  }
}