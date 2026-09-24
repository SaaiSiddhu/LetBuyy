// lib/screens/orders/widgets/rto_section_widget.dart
// 🔄 RTO Section Widget - Expandable section for RTO/Return management inside order cards

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:letbuyy_models/letbuyy_models.dart';
import 'package:intl/intl.dart';

/// RTO/Return status enum
enum RTOStatus {
  requested('Requested', Color(0xFFFF9800), Icons.pending_actions_rounded),
  approved('Approved', Color(0xFF2196F3), Icons.check_circle_outline_rounded),
  pickupScheduled('Pickup Scheduled', Color(0xFF9C27B0), Icons.local_shipping_rounded),
  inTransit('In Transit', Color(0xFF673AB7), Icons.sync_rounded),
  received('Received', Color(0xFF00BCD4), Icons.inventory_2_rounded),
  qcPending('QC Pending', Color(0xFFFF5722), Icons.fact_check_rounded),
  qcPassed('QC Passed', Color(0xFF4CAF50), Icons.verified_rounded),
  qcFailed('QC Failed', Color(0xFFE53935), Icons.cancel_rounded),
  refundInitiated('Refund Initiated', Color(0xFF8BC34A), Icons.payments_rounded),
  refunded('Refunded', Color(0xFF4CAF50), Icons.check_circle_rounded),
  rejected('Rejected', Color(0xFFE53935), Icons.block_rounded);

  final String label;
  final Color color;
  final IconData icon;
  const RTOStatus(this.label, this.color, this.icon);

  static RTOStatus fromString(String status) {
    switch (status.toLowerCase().replaceAll('_', '')) {
      case 'requested':
        return RTOStatus.requested;
      case 'approved':
      case 'rtoapproved':
        return RTOStatus.approved;
      case 'pickupscheduled':
        return RTOStatus.pickupScheduled;
      case 'intransit':
        return RTOStatus.inTransit;
      case 'received':
      case 'rtoreceived':
        return RTOStatus.received;
      case 'qcpending':
        return RTOStatus.qcPending;
      case 'qcpassed':
        return RTOStatus.qcPassed;
      case 'qcfailed':
        return RTOStatus.qcFailed;
      case 'refundinitiated':
        return RTOStatus.refundInitiated;
      case 'refunded':
        return RTOStatus.refunded;
      case 'rejected':
        return RTOStatus.rejected;
      default:
        return RTOStatus.requested;
    }
  }
}

/// RTO Section Widget - Expandable card inside order card
class RTOSectionWidget extends StatefulWidget {
  final OrderModel order;
  final bool isDark;
  final VoidCallback? onApprove;
  final VoidCallback? onReject;
  final VoidCallback? onSchedulePickup;
  final VoidCallback? onPerformQC;
  final VoidCallback? onProcessRefund;
  final VoidCallback? onViewDetails;

  const RTOSectionWidget({
    super.key,
    required this.order,
    required this.isDark,
    this.onApprove,
    this.onReject,
    this.onSchedulePickup,
    this.onPerformQC,
    this.onProcessRefund,
    this.onViewDetails,
  });

  @override
  State<RTOSectionWidget> createState() => _RTOSectionWidgetState();
}

class _RTOSectionWidgetState extends State<RTOSectionWidget> {
  bool _isExpanded = false;

  RTOStatus get _rtoStatus {
    // Use order status to determine RTO status
    final orderStatus = widget.order.orderStatus.toLowerCase();
    if (orderStatus.contains('rto') || orderStatus.contains('return')) {
      return RTOStatus.fromString(orderStatus);
    }
    // Default fallback
    if (orderStatus == 'failed' || orderStatus == 'refused') {
      return RTOStatus.requested;
    }
    return RTOStatus.requested;
  }

  // Default return reason based on status
  String get _returnReason {
    final status = widget.order.orderStatus.toLowerCase();
    if (status.contains('refused')) {
      return 'Customer refused delivery';
    } else if (status.contains('failed')) {
      return 'Delivery attempt failed';
    } else if (status.contains('damage')) {
      return 'Product damaged during transit';
    }
    return 'Return requested by customer';
  }
  
  // No evidence images without raw data access
  List<String> get _evidenceImages => [];

  // Use order creation time as fallback
  DateTime? get _requestedAt => widget.order.createdAt;

  String? get _pickupAWB => null;
  DateTime? get _pickupDate => null;

  @override
  Widget build(BuildContext context) {
    final status = _rtoStatus;

    return Container(
      margin: const EdgeInsets.only(top: 12),
      decoration: BoxDecoration(
        color: status.color.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: status.color.withValues(alpha: 0.3),
          width: 1,
        ),
      ),
      child: Column(
        children: [
          // Header (always visible)
          _buildHeader(status),
          
          // Expandable content
          AnimatedCrossFade(
            firstChild: const SizedBox(height: 0),
            secondChild: _buildExpandedContent(status),
            crossFadeState: _isExpanded 
                ? CrossFadeState.showSecond 
                : CrossFadeState.showFirst,
            duration: const Duration(milliseconds: 250),
          ),
        ],
      ),
    ).animate().fadeIn(duration: 300.ms).slideY(begin: 0.1, end: 0);
  }

  Widget _buildHeader(RTOStatus status) {
    return InkWell(
      onTap: () {
        HapticFeedback.selectionClick();
        setState(() => _isExpanded = !_isExpanded);
      },
      borderRadius: BorderRadius.circular(12),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Row(
          children: [
            // Status icon with pulse
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: status.color.withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Icon(
                status.icon,
                size: 18,
                color: status.color,
              ),
            ).animate(onPlay: (c) => c.repeat(reverse: true))
                .scale(begin: const Offset(1, 1), end: const Offset(1.05, 1.05), duration: 1500.ms),
            const SizedBox(width: 12),
            
            // Title and status
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '🔄 Return/RTO Request',
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: widget.isDark ? Colors.white : Colors.black87,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    status.label,
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w500,
                      color: status.color,
                    ),
                  ),
                ],
              ),
            ),
            
            // Time ago
            if (_requestedAt != null)
              Text(
                _getTimeAgo(_requestedAt!),
                style: TextStyle(
                  fontSize: 11,
                  color: widget.isDark ? Colors.grey[500] : Colors.grey[600],
                ),
              ),
            const SizedBox(width: 8),
            
            // Expand icon
            AnimatedRotation(
              turns: _isExpanded ? 0.5 : 0,
              duration: const Duration(milliseconds: 200),
              child: Icon(
                Icons.keyboard_arrow_down_rounded,
                color: widget.isDark ? Colors.grey[400] : Colors.grey[600],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildExpandedContent(RTOStatus status) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Divider(height: 1),
          const SizedBox(height: 12),
          
          // Return Reason
          _buildInfoSection(
            icon: Icons.message_rounded,
            title: 'Return Reason',
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: widget.isDark 
                    ? Colors.white.withValues(alpha: 0.05) 
                    : Colors.grey.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text(
                _returnReason,
                style: TextStyle(
                  fontSize: 12,
                  color: widget.isDark ? Colors.grey[300] : Colors.grey[700],
                  fontStyle: FontStyle.italic,
                ),
              ),
            ),
          ),
          
          // Evidence Images
          if (_evidenceImages.isNotEmpty) ...[
            const SizedBox(height: 12),
            _buildInfoSection(
              icon: Icons.photo_library_rounded,
              title: 'Customer Evidence (${_evidenceImages.length})',
              child: SizedBox(
                height: 60,
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  itemCount: _evidenceImages.length,
                  separatorBuilder: (_, __) => const SizedBox(width: 8),
                  itemBuilder: (context, index) {
                    return GestureDetector(
                      onTap: () => _showImageViewer(index),
                      child: Container(
                        width: 60,
                        height: 60,
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(
                            color: widget.isDark 
                                ? Colors.white.withValues(alpha: 0.2) 
                                : Colors.grey.withValues(alpha: 0.3),
                          ),
                        ),
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(7),
                          child: Image.network(
                            _evidenceImages[index],
                            fit: BoxFit.cover,
                            errorBuilder: (_, __, ___) => Icon(
                              Icons.broken_image_rounded,
                              color: Colors.grey[400],
                            ),
                          ),
                        ),
                      ),
                    );
                  },
                ),
              ),
            ),
          ],
          
          // Pickup Info (if scheduled)
          if (_pickupAWB != null || _pickupDate != null) ...[
            const SizedBox(height: 12),
            _buildInfoSection(
              icon: Icons.local_shipping_rounded,
              title: 'Pickup Details',
              child: Row(
                children: [
                  if (_pickupDate != null)
                    _buildMiniChip(
                      '📅 ${DateFormat('MMM dd').format(_pickupDate!)}',
                      Colors.purple,
                    ),
                  if (_pickupAWB != null) ...[
                    const SizedBox(width: 8),
                    _buildMiniChip(
                      '📦 $_pickupAWB',
                      Colors.blue,
                    ),
                  ],
                ],
              ),
            ),
          ],
          
          // Action Buttons
          const SizedBox(height: 16),
          _buildActionButtons(status),
        ],
      ),
    );
  }

  Widget _buildInfoSection({
    required IconData icon,
    required String title,
    required Widget child,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Icon(icon, size: 14, color: Colors.grey[500]),
            const SizedBox(width: 6),
            Text(
              title,
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w600,
                color: widget.isDark ? Colors.grey[400] : Colors.grey[600],
              ),
            ),
          ],
        ),
        const SizedBox(height: 6),
        child,
      ],
    );
  }

  Widget _buildMiniChip(String label, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w500,
          color: color,
        ),
      ),
    );
  }

  Widget _buildActionButtons(RTOStatus status) {
    // Different actions based on status
    List<Widget> buttons = [];

    switch (status) {
      case RTOStatus.requested:
        buttons = [
          _buildActionButton(
            icon: Icons.check_circle_rounded,
            label: 'Approve',
            color: Colors.green,
            onTap: widget.onApprove,
          ),
          _buildActionButton(
            icon: Icons.cancel_rounded,
            label: 'Reject',
            color: Colors.red,
            onTap: widget.onReject,
          ),
        ];
        break;
      case RTOStatus.approved:
        buttons = [
          _buildActionButton(
            icon: Icons.calendar_month_rounded,
            label: 'Schedule Pickup',
            color: Colors.purple,
            onTap: widget.onSchedulePickup,
          ),
        ];
        break;
      case RTOStatus.pickupScheduled:
      case RTOStatus.inTransit:
        buttons = [
          _buildActionButton(
            icon: Icons.local_shipping_rounded,
            label: 'Track Pickup',
            color: Colors.blue,
            onTap: widget.onViewDetails,
          ),
        ];
        break;
      case RTOStatus.received:
      case RTOStatus.qcPending:
        buttons = [
          _buildActionButton(
            icon: Icons.fact_check_rounded,
            label: 'Perform QC',
            color: Colors.orange,
            onTap: widget.onPerformQC,
          ),
        ];
        break;
      case RTOStatus.qcPassed:
        buttons = [
          _buildActionButton(
            icon: Icons.payments_rounded,
            label: 'Process Refund',
            color: Colors.green,
            onTap: widget.onProcessRefund,
          ),
        ];
        break;
      case RTOStatus.qcFailed:
        buttons = [
          _buildActionButton(
            icon: Icons.contact_support_rounded,
            label: 'Contact Customer',
            color: Colors.blue,
            onTap: widget.onViewDetails,
          ),
          _buildActionButton(
            icon: Icons.payments_rounded,
            label: 'Partial Refund',
            color: Colors.orange,
            onTap: widget.onProcessRefund,
          ),
        ];
        break;
      case RTOStatus.refundInitiated:
      case RTOStatus.refunded:
      case RTOStatus.rejected:
        buttons = [
          _buildActionButton(
            icon: Icons.visibility_rounded,
            label: 'View Details',
            color: Colors.grey,
            onTap: widget.onViewDetails,
          ),
        ];
        break;
    }

    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: buttons,
    );
  }

  Widget _buildActionButton({
    required IconData icon,
    required String label,
    required Color color,
    VoidCallback? onTap,
  }) {
    return GestureDetector(
      onTap: () {
        HapticFeedback.lightImpact();
        onTap?.call();
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(8),
          border: Border.all(
            color: color.withValues(alpha: 0.3),
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 14, color: color),
            const SizedBox(width: 6),
            Text(
              label,
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w600,
                color: color,
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _showImageViewer(int index) {
    showDialog(
      context: context,
      builder: (context) => Dialog(
        backgroundColor: Colors.transparent,
        child: Stack(
          children: [
            PageView.builder(
              controller: PageController(initialPage: index),
              itemCount: _evidenceImages.length,
              itemBuilder: (context, i) {
                return InteractiveViewer(
                  child: Center(
                    child: Image.network(
                      _evidenceImages[i],
                      fit: BoxFit.contain,
                    ),
                  ),
                );
              },
            ),
            Positioned(
              top: 16,
              right: 16,
              child: IconButton(
                onPressed: () => Navigator.pop(context),
                icon: Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: Colors.black54,
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: const Icon(Icons.close, color: Colors.white),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  String _getTimeAgo(DateTime dateTime) {
    final now = DateTime.now();
    final difference = now.difference(dateTime);

    if (difference.inDays > 0) {
      return '${difference.inDays}d ago';
    } else if (difference.inHours > 0) {
      return '${difference.inHours}h ago';
    } else if (difference.inMinutes > 0) {
      return '${difference.inMinutes}m ago';
    } else {
      return 'Just now';
    }
  }
}

/// Compact RTO status badge for order card header
class RTOStatusBadge extends StatelessWidget {
  final String status;
  final bool compact;

  const RTOStatusBadge({
    super.key,
    required this.status,
    this.compact = false,
  });

  @override
  Widget build(BuildContext context) {
    final rtoStatus = RTOStatus.fromString(status);

    if (compact) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
        decoration: BoxDecoration(
          color: rtoStatus.color.withValues(alpha: 0.15),
          borderRadius: BorderRadius.circular(4),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.undo_rounded, size: 10, color: rtoStatus.color),
            const SizedBox(width: 3),
            Text(
              'RTO',
              style: TextStyle(
                fontSize: 9,
                fontWeight: FontWeight.bold,
                color: rtoStatus.color,
              ),
            ),
          ],
        ),
      );
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: rtoStatus.color.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(6),
        border: Border.all(
          color: rtoStatus.color.withValues(alpha: 0.3),
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(rtoStatus.icon, size: 12, color: rtoStatus.color),
          const SizedBox(width: 4),
          Text(
            rtoStatus.label,
            style: TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.w600,
              color: rtoStatus.color,
            ),
          ),
        ],
      ),
    );
  }
}
