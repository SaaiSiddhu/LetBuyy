// apps/seller/lib/screens/returns/return_detail_screen.dart
// 📦 SELLER RETURN DETAIL SCREEN
// View return details, schedule pickup, perform QC, process refund

import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';
import 'package:letbuyy_models/letbuyy_models.dart';
import 'package:letbuyy_services/letbuyy_services.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';

class ReturnDetailScreen extends StatefulWidget {
  final String returnId;

  const ReturnDetailScreen({super.key, required this.returnId});

  @override
  State<ReturnDetailScreen> createState() => _ReturnDetailScreenState();
}

class _ReturnDetailScreenState extends State<ReturnDetailScreen> {
  final ReturnService _returnService = ReturnService();
  final _currencyFormat = NumberFormat('#,##,###', 'en_IN');

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      backgroundColor: isDark ? const Color(0xFF0A0E14) : const Color(0xFFF5F7FA),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        title: Text(
          'Return Details',
          style: TextStyle(
            color: isDark ? Colors.white : Colors.black,
            fontWeight: FontWeight.bold,
          ),
        ),
        leading: IconButton(
          icon: Icon(Icons.arrow_back, color: isDark ? Colors.white : Colors.black),
          onPressed: () => Navigator.pop(context),
        ),
        actions: [
          IconButton(
            icon: Icon(Icons.refresh, color: isDark ? Colors.white : Colors.black),
            onPressed: () => setState(() {}),
            tooltip: 'Refresh',
          ),
        ],
      ),
      body: StreamBuilder<ReturnRequestModel?>(
        stream: _returnService.streamReturnRequest(widget.returnId),
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }

          if (!snapshot.hasData) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(
                    Icons.error_outline,
                    size: 64,
                    color: isDark ? Colors.white38 : Colors.grey,
                  ),
                  const SizedBox(height: 16),
                  Text(
                    'Return request not found',
                    style: TextStyle(
                      color: isDark ? Colors.white54 : Colors.grey[600],
                      fontSize: 16,
                    ),
                  ),
                ],
              ),
            );
          }

          final request = snapshot.data!;
          return Column(
            children: [
              Expanded(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Status Card
                      _buildStatusCard(request, isDark)
                          .animate().fadeIn(duration: 300.ms).slideY(begin: 0.1),
                      const SizedBox(height: 16),

                      // Product Card
                      _buildProductCard(request, isDark)
                          .animate().fadeIn(delay: 100.ms).slideY(begin: 0.1),
                      const SizedBox(height: 16),

                      // Customer Info
                      _buildCustomerCard(request, isDark)
                          .animate().fadeIn(delay: 150.ms).slideY(begin: 0.1),
                      const SizedBox(height: 16),

                      // Reason & Notes
                      _buildReasonCard(request, isDark)
                          .animate().fadeIn(delay: 200.ms).slideY(begin: 0.1),
                      const SizedBox(height: 16),

                      // Customer Evidence (always show)
                      _buildEvidenceCard(request, isDark)
                          .animate().fadeIn(delay: 250.ms).slideY(begin: 0.1),
                      const SizedBox(height: 16),

                      // Pickup Info (if applicable)
                      if (_shouldShowPickupSection(request.status))
                        _buildPickupCard(request, isDark)
                            .animate().fadeIn(delay: 300.ms).slideY(begin: 0.1),

                      // QC Section (if applicable)
                      if (request.status == ReturnStatus.pickupScheduled ||
                          request.status == ReturnStatus.pickupInProgress)
                        _buildQCSection(request, isDark)
                            .animate().fadeIn(delay: 350.ms).slideY(begin: 0.1),

                      // Refund Section
                      if (request.type == ReturnType.refund &&
                          request.status == ReturnStatus.pickupCompleted)
                        _buildRefundSection(request, isDark)
                            .animate().fadeIn(delay: 400.ms).slideY(begin: 0.1),

                      const SizedBox(height: 100), // Space for bottom bar
                    ],
                  ),
                ),
              ),
              
              // Sticky Bottom Action Bar
              if (request.status == ReturnStatus.requested ||
                  request.status == ReturnStatus.approved)
                _buildStickyActionBar(request, isDark),
            ],
          );
        },
      ),
    );
  }

  Widget _buildStickyActionBar(ReturnRequestModel request, bool isDark) {
    return Container(
      padding: EdgeInsets.fromLTRB(
        16,
        16,
        16,
        16 + MediaQuery.of(context).padding.bottom,
      ),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF0F1318) : Colors.white,
        border: Border(
          top: BorderSide(
            color: isDark ? Colors.white10 : Colors.grey.shade200,
          ),
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.1),
            blurRadius: 10,
            offset: const Offset(0, -5),
          ),
        ],
      ),
      child: _buildActions(request, isDark),
    ).animate().slideY(begin: 1, duration: 400.ms, curve: Curves.easeOut);
  }

  Widget _buildStatusCard(ReturnRequestModel request, bool isDark) {
    final config = _getStatusConfig(request.status);

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            config['color'].withValues(alpha: 0.2),
            config['color'].withValues(alpha: 0.05),
          ],
        ),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: config['color'].withValues(alpha: 0.3)),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: config['color'].withValues(alpha: 0.2),
              shape: BoxShape.circle,
            ),
            child: Icon(config['icon'], color: config['color'], size: 24),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  request.status.displayName,
                  style: TextStyle(
                    color: isDark ? Colors.white : Colors.black,
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                Text(
                  request.status.description,
                  style: TextStyle(
                    color: isDark ? Colors.white60 : Colors.grey[600],
                    fontSize: 12,
                  ),
                ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            decoration: BoxDecoration(
              color: request.type == ReturnType.refund
                  ? Colors.blue.withValues(alpha: 0.2)
                  : Colors.purple.withValues(alpha: 0.2),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Text(
              request.type.displayName,
              style: TextStyle(
                color: request.type == ReturnType.refund
                    ? Colors.blue
                    : Colors.purple,
                fontWeight: FontWeight.bold,
                fontSize: 12,
              ),
            ),
          ),
        ],
      ),
    ).animate().fadeIn();
  }

  Widget _buildProductCard(ReturnRequestModel request, bool isDark) {
    return _buildCard(
      isDark: isDark,
      title: 'Product',
      child: Row(
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(10),
            child: Image.network(
              request.productImage ?? '',
              width: 70,
              height: 70,
              fit: BoxFit.cover,
              errorBuilder: (_, __, ___) => Container(
                width: 70,
                height: 70,
                color: Colors.grey[300],
                child: const Icon(Icons.image),
              ),
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  request.productName,
                  style: TextStyle(
                    color: isDark ? Colors.white : Colors.black,
                    fontWeight: FontWeight.w600,
                    fontSize: 15,
                  ),
                ),
                if (request.variantInfo != null) ...[
                  const SizedBox(height: 4),
                  Text(
                    request.variantInfo!,
                    style: TextStyle(
                      color: isDark ? Colors.white54 : Colors.grey[600],
                      fontSize: 12,
                    ),
                  ),
                ],
                const SizedBox(height: 4),
                Row(
                  children: [
                    Text(
                      'Qty: ${request.quantity}',
                      style: TextStyle(
                        color: isDark ? Colors.white70 : Colors.black87,
                      ),
                    ),
                    const SizedBox(width: 16),
                    Text(
                      '₹${_currencyFormat.format(request.refundAmount)}',
                      style: TextStyle(
                        color: AppColors.primary,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCustomerCard(ReturnRequestModel request, bool isDark) {
    return _buildCard(
      isDark: isDark,
      title: 'Customer',
      child: Column(
        children: [
          _buildInfoRow('Name', request.userName, isDark),
          _buildInfoRow('Phone', request.userPhone ?? 'N/A', isDark),
          _buildInfoRow('Order', '#${request.orderNumber}', isDark),
          _buildInfoRow(
            'Requested',
            DateFormat('dd MMM yyyy, hh:mm a').format(request.createdAt),
            isDark,
          ),
        ],
      ),
    );
  }

  Widget _buildReasonCard(ReturnRequestModel request, bool isDark) {
    return _buildCard(
      isDark: isDark,
      title: 'Return Reason',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              color: Colors.orange.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Text(
              request.reasonTitle,
              style: TextStyle(
                color: Colors.orange[700],
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          if (request.customerNotes != null) ...[
            const SizedBox(height: 12),
            Text(
              'Customer Notes:',
              style: TextStyle(
                color: isDark ? Colors.white54 : Colors.grey[600],
                fontSize: 12,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              request.customerNotes!,
              style: TextStyle(
                color: isDark ? Colors.white : Colors.black,
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildEvidenceCard(ReturnRequestModel request, bool isDark) {
    final images = request.customerImages;
    
    return _buildCard(
      isDark: isDark,
      title: 'Customer Evidence',
      titleAction: Text(
        '${images.length} photo${images.length > 1 ? 's' : ''}',
        style: TextStyle(
          color: AppColors.primary,
          fontWeight: FontWeight.bold,
          fontSize: 12,
        ),
      ),
      child: images.isEmpty
          ? Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: isDark ? Colors.white.withValues(alpha: 0.03) : Colors.grey[50],
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: isDark ? Colors.white10 : Colors.grey.shade200,
                  style: BorderStyle.solid,
                ),
              ),
              child: Center(
                child: Column(
                  children: [
                    Icon(
                      Icons.photo_library_outlined,
                      size: 48,
                      color: isDark ? Colors.white24 : Colors.grey[400],
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'No photos uploaded by customer',
                      style: TextStyle(
                        color: isDark ? Colors.white38 : Colors.grey,
                        fontSize: 13,
                      ),
                    ),
                  ],
                ),
              ),
            )
          : Column(
              children: [
                // Main large image preview
                GestureDetector(
                  onTap: () => _showImageViewer(images, 0),
                  child: Container(
                    height: 200,
                    width: double.infinity,
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                        color: isDark ? Colors.white10 : Colors.grey.shade200,
                      ),
                    ),
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(12),
                      child: Stack(
                        fit: StackFit.expand,
                        children: [
                          Image.network(
                            images.first,
                            fit: BoxFit.cover,
                            loadingBuilder: (context, child, loadingProgress) {
                              if (loadingProgress == null) return child;
                              return Container(
                                color: isDark ? Colors.white10 : Colors.grey[200],
                                child: Center(
                                  child: CircularProgressIndicator(
                                    value: loadingProgress.expectedTotalBytes != null
                                        ? loadingProgress.cumulativeBytesLoaded /
                                            loadingProgress.expectedTotalBytes!
                                        : null,
                                    strokeWidth: 2,
                                  ),
                                ),
                              );
                            },
                            errorBuilder: (_, __, ___) => Container(
                              color: isDark ? Colors.white10 : Colors.grey[200],
                              child: Column(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Icon(
                                    Icons.broken_image_rounded,
                                    color: isDark ? Colors.white38 : Colors.grey,
                                    size: 40,
                                  ),
                                  const SizedBox(height: 8),
                                  Text(
                                    'Failed to load image',
                                    style: TextStyle(
                                      color: isDark ? Colors.white38 : Colors.grey,
                                      fontSize: 12,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                          // Tap to view overlay
                          Positioned(
                            bottom: 8,
                            right: 8,
                            child: Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 10,
                                vertical: 6,
                              ),
                              decoration: BoxDecoration(
                                color: Colors.black54,
                                borderRadius: BorderRadius.circular(20),
                              ),
                              child: const Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(Icons.zoom_in, color: Colors.white, size: 16),
                                  SizedBox(width: 4),
                                  Text(
                                    'Tap to view',
                                    style: TextStyle(color: Colors.white, fontSize: 11),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
                
                // Thumbnail row for additional images
                if (images.length > 1) ...[
                  const SizedBox(height: 12),
                  SizedBox(
                    height: 70,
                    child: ListView.builder(
                      scrollDirection: Axis.horizontal,
                      itemCount: images.length,
                      itemBuilder: (context, index) {
                        return GestureDetector(
                          onTap: () => _showImageViewer(images, index),
                          child: Container(
                            width: 70,
                            margin: const EdgeInsets.only(right: 8),
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(8),
                              border: Border.all(
                                color: index == 0
                                    ? AppColors.primary
                                    : (isDark ? Colors.white10 : Colors.grey.shade200),
                                width: index == 0 ? 2 : 1,
                              ),
                            ),
                            child: ClipRRect(
                              borderRadius: BorderRadius.circular(7),
                              child: Image.network(
                                images[index],
                                fit: BoxFit.cover,
                                loadingBuilder: (context, child, loadingProgress) {
                                  if (loadingProgress == null) return child;
                                  return Container(
                                    color: isDark ? Colors.white10 : Colors.grey[200],
                                    child: const Center(
                                      child: SizedBox(
                                        width: 16,
                                        height: 16,
                                        child: CircularProgressIndicator(strokeWidth: 2),
                                      ),
                                    ),
                                  );
                                },
                                errorBuilder: (_, __, ___) => Container(
                                  color: isDark ? Colors.white10 : Colors.grey[200],
                                  child: Icon(
                                    Icons.broken_image,
                                    color: isDark ? Colors.white24 : Colors.grey,
                                    size: 20,
                                  ),
                                ),
                              ),
                            ),
                          ),
                        );
                      },
                    ),
                  ),
                ],
              ],
            ),
    );
  }

  Widget _buildPickupCard(ReturnRequestModel request, bool isDark) {
    return _buildCard(
      isDark: isDark,
      title: 'Pickup Information',
      titleAction: request.status == ReturnStatus.approved
          ? TextButton(
              onPressed: () => _showSchedulePickupSheet(request),
              child: const Text('Schedule'),
            )
          : null,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildInfoRow('Address', request.pickupAddress ?? 'Not set', isDark),
          if (request.pickupScheduledAt != null)
            _buildInfoRow(
              'Date',
              DateFormat('dd MMM yyyy').format(request.pickupScheduledAt!),
              isDark,
            ),
          if (request.pickupSlot != null)
            _buildInfoRow('Slot', request.pickupSlot!, isDark),
          if (request.pickupAgentName != null)
            _buildInfoRow('Agent', request.pickupAgentName!, isDark),
          if (request.pickupAgentPhone != null)
            _buildInfoRow('Agent Phone', request.pickupAgentPhone!, isDark),
        ],
      ),
    );
  }

  Widget _buildQCSection(ReturnRequestModel request, bool isDark) {
    return _buildCard(
      isDark: isDark,
      title: 'Quality Check',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Perform QC at doorstep pickup',
            style: TextStyle(
              color: isDark ? Colors.white54 : Colors.grey[600],
              fontSize: 13,
            ),
          ),
          const SizedBox(height: 16),
          ElevatedButton.icon(
            onPressed: () => _showQCForm(request),
            icon: const Icon(Icons.fact_check),
            label: const Text('Perform QC'),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.primary,
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(10),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildRefundSection(ReturnRequestModel request, bool isDark) {
    return _buildCard(
      isDark: isDark,
      title: 'Process Refund',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text('Amount'),
              Text(
                '₹${_currencyFormat.format(request.refundAmount)}',
                style: TextStyle(
                  color: Colors.green[700],
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          ElevatedButton.icon(
            onPressed: () => _initiateRefund(request),
            icon: const Icon(Icons.payment),
            label: const Text('Initiate Refund'),
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.green,
              foregroundColor: Colors.white,
              minimumSize: const Size.fromHeight(48),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(10),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildActions(ReturnRequestModel request, bool isDark) {
    if (request.status == ReturnStatus.requested) {
      return Row(
        children: [
          Expanded(
            child: OutlinedButton.icon(
              onPressed: () => _showRejectDialog(request),
              icon: const Icon(Icons.close),
              label: const Text('Reject'),
              style: OutlinedButton.styleFrom(
                foregroundColor: Colors.red,
                side: const BorderSide(color: Colors.red),
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: ElevatedButton.icon(
              onPressed: () => _approveReturn(request),
              icon: const Icon(Icons.check),
              label: const Text('Approve'),
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.green,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
            ),
          ),
        ],
      );
    }

    if (request.status == ReturnStatus.approved) {
      return ElevatedButton.icon(
        onPressed: () => _showSchedulePickupSheet(request),
        icon: const Icon(Icons.schedule),
        label: const Text('Schedule Pickup'),
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.primary,
          foregroundColor: Colors.white,
          minimumSize: const Size.fromHeight(52),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
        ),
      );
    }

    return const SizedBox.shrink();
  }

  Widget _buildCard({
    required bool isDark,
    required String title,
    Widget? titleAction,
    required Widget child,
  }) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isDark ? Colors.white.withValues(alpha: 0.05) : Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isDark ? Colors.white10 : Colors.grey.shade200,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                title,
                style: TextStyle(
                  color: isDark ? Colors.white70 : Colors.grey[800],
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                ),
              ),
              if (titleAction != null) titleAction,
            ],
          ),
          const SizedBox(height: 12),
          child,
        ],
      ),
    );
  }

  Widget _buildInfoRow(String label, String value, bool isDark) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 80,
            child: Text(
              label,
              style: TextStyle(
                color: isDark ? Colors.white38 : Colors.grey,
                fontSize: 12,
              ),
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: TextStyle(
                color: isDark ? Colors.white : Colors.black,
              ),
            ),
          ),
        ],
      ),
    );
  }

  bool _shouldShowPickupSection(ReturnStatus status) {
    return [
      ReturnStatus.approved,
      ReturnStatus.pickupScheduled,
      ReturnStatus.pickupInProgress,
      ReturnStatus.pickupCompleted,
    ].contains(status);
  }

  void _showImageViewer(List<String> images, int index) {
    showDialog(
      context: context,
      builder: (context) => Dialog(
        backgroundColor: Colors.black,
        child: Stack(
          children: [
            PageView.builder(
              controller: PageController(initialPage: index),
              itemCount: images.length,
              itemBuilder: (context, i) => InteractiveViewer(
                child: Image.network(images[i], fit: BoxFit.contain),
              ),
            ),
            Positioned(
              top: 16,
              right: 16,
              child: IconButton(
                icon: const Icon(Icons.close, color: Colors.white),
                onPressed: () => Navigator.pop(context),
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _showSchedulePickupSheet(ReturnRequestModel request) {
    DateTime selectedDate = DateTime.now().add(const Duration(days: 1));
    String selectedSlot = '10 AM - 12 PM';
    final agentNameController = TextEditingController();
    final agentPhoneController = TextEditingController();

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) => StatefulBuilder(
        builder: (context, setSheetState) => Padding(
          padding: EdgeInsets.only(
            left: 20,
            right: 20,
            top: 20,
            bottom: MediaQuery.viewInsetsOf(context).bottom + 20,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Schedule Pickup',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 20),

              // Date Picker
              ListTile(
                leading: const Icon(Icons.calendar_today),
                title: const Text('Pickup Date'),
                subtitle: Text(DateFormat('EEE, dd MMM yyyy').format(selectedDate)),
                onTap: () async {
                  final picked = await showDatePicker(
                    context: context,
                    initialDate: selectedDate,
                    firstDate: DateTime.now(),
                    lastDate: DateTime.now().add(const Duration(days: 14)),
                  );
                  if (picked != null) {
                    setSheetState(() => selectedDate = picked);
                  }
                },
              ),

              // Slot Selection
              ListTile(
                leading: const Icon(Icons.access_time),
                title: const Text('Time Slot'),
                subtitle: Text(selectedSlot),
                onTap: () {
                  showDialog(
                    context: context,
                    builder: (context) => SimpleDialog(
                      title: const Text('Select Time Slot'),
                      children: [
                        '9 AM - 11 AM',
                        '11 AM - 1 PM',
                        '2 PM - 4 PM',
                        '4 PM - 6 PM',
                      ].map((slot) => SimpleDialogOption(
                        onPressed: () {
                          setSheetState(() => selectedSlot = slot);
                          Navigator.pop(context);
                        },
                        child: Text(slot),
                      )).toList(),
                    ),
                  );
                },
              ),
              const SizedBox(height: 12),

              // Agent Name
              TextField(
                controller: agentNameController,
                decoration: InputDecoration(
                  labelText: 'Pickup Agent Name (Optional)',
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                  ),
                ),
              ),
              const SizedBox(height: 12),

              // Agent Phone
              TextField(
                controller: agentPhoneController,
                keyboardType: TextInputType.phone,
                decoration: InputDecoration(
                  labelText: 'Agent Phone (Optional)',
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                  ),
                ),
              ),
              const SizedBox(height: 20),

              ElevatedButton(
                onPressed: () async {
                  Navigator.pop(context);
                  await _returnService.schedulePickup(
                    returnId: request.id,
                    pickupDate: selectedDate,
                    pickupSlot: selectedSlot,
                    pickupAgentName: agentNameController.text.isNotEmpty
                        ? agentNameController.text
                        : null,
                    pickupAgentPhone: agentPhoneController.text.isNotEmpty
                        ? agentPhoneController.text
                        : null,
                  );
                  if (mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                        content: Text('Pickup scheduled!'),
                        backgroundColor: Colors.green,
                      ),
                    );
                  }
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  foregroundColor: Colors.white,
                  minimumSize: const Size.fromHeight(48),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10),
                  ),
                ),
                child: const Text('Confirm Schedule'),
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _showQCForm(ReturnRequestModel request) {
    bool productMatches = true;
    bool productIntact = true;
    bool packagingOk = true;
    bool accessoriesPresent = true;
    final remarksController = TextEditingController();
    List<File> qcPhotos = [];
    final imagePicker = ImagePicker();

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) => StatefulBuilder(
        builder: (context, setSheetState) => Padding(
          padding: EdgeInsets.only(
            left: 20,
            right: 20,
            top: 20,
            bottom: MediaQuery.viewInsetsOf(context).bottom + 20,
          ),
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Doorstep Quality Check',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 8),
                const Text(
                  'Verify the product before pickup',
                  style: TextStyle(color: Colors.grey),
                ),
                const SizedBox(height: 20),

                // Checklist
                _buildQCCheckItem(
                  'Product matches order',
                  productMatches,
                  (v) => setSheetState(() => productMatches = v ?? true),
                ),
                _buildQCCheckItem(
                  'Product is intact/undamaged',
                  productIntact,
                  (v) => setSheetState(() => productIntact = v ?? true),
                ),
                _buildQCCheckItem(
                  'Original packaging present',
                  packagingOk,
                  (v) => setSheetState(() => packagingOk = v ?? true),
                ),
                _buildQCCheckItem(
                  'All accessories included',
                  accessoriesPresent,
                  (v) => setSheetState(() => accessoriesPresent = v ?? true),
                ),
                const SizedBox(height: 16),

                // Remarks
                TextField(
                  controller: remarksController,
                  maxLines: 2,
                  decoration: InputDecoration(
                    labelText: 'Remarks (Optional)',
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(10),
                    ),
                  ),
                ),
                const SizedBox(height: 16),

                // Photos
                Row(
                  children: [
                    const Text('QC Photos: '),
                    const Spacer(),
                    TextButton.icon(
                      onPressed: () async {
                        final picked = await imagePicker.pickImage(
                          source: ImageSource.camera,
                        );
                        if (picked != null) {
                          setSheetState(() => qcPhotos.add(File(picked.path)));
                        }
                      },
                      icon: const Icon(Icons.camera_alt),
                      label: const Text('Take Photo'),
                    ),
                  ],
                ),
                if (qcPhotos.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  SizedBox(
                    height: 60,
                    child: ListView.builder(
                      scrollDirection: Axis.horizontal,
                      itemCount: qcPhotos.length,
                      itemBuilder: (context, index) => Padding(
                        padding: const EdgeInsets.only(right: 8),
                        child: Stack(
                          children: [
                            ClipRRect(
                              borderRadius: BorderRadius.circular(8),
                              child: Image.file(
                                qcPhotos[index],
                                width: 60,
                                height: 60,
                                fit: BoxFit.cover,
                              ),
                            ),
                            Positioned(
                              top: 0,
                              right: 0,
                              child: GestureDetector(
                                onTap: () => setSheetState(
                                  () => qcPhotos.removeAt(index),
                                ),
                                child: Container(
                                  padding: const EdgeInsets.all(2),
                                  decoration: const BoxDecoration(
                                    color: Colors.red,
                                    shape: BoxShape.circle,
                                  ),
                                  child: const Icon(
                                    Icons.close,
                                    size: 12,
                                    color: Colors.white,
                                  ),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ],
                const SizedBox(height: 24),

                // Actions
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton(
                        onPressed: () {
                          Navigator.pop(context);
                          _submitQC(
                            request,
                            false,
                            remarksController.text,
                            productMatches,
                            productIntact,
                            packagingOk,
                            accessoriesPresent,
                          );
                        },
                        style: OutlinedButton.styleFrom(
                          foregroundColor: Colors.red,
                          side: const BorderSide(color: Colors.red),
                          padding: const EdgeInsets.symmetric(vertical: 14),
                        ),
                        child: const Text('QC Failed'),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: ElevatedButton(
                        onPressed: () {
                          Navigator.pop(context);
                          _submitQC(
                            request,
                            true,
                            remarksController.text,
                            productMatches,
                            productIntact,
                            packagingOk,
                            accessoriesPresent,
                          );
                        },
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Colors.green,
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(vertical: 14),
                        ),
                        child: const Text('QC Passed'),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildQCCheckItem(String label, bool value, Function(bool?) onChanged) {
    return CheckboxListTile(
      value: value,
      onChanged: onChanged,
      title: Text(label),
      activeColor: Colors.green,
      contentPadding: EdgeInsets.zero,
      controlAffinity: ListTileControlAffinity.leading,
    );
  }

  Future<void> _submitQC(
    ReturnRequestModel request,
    bool passed,
    String remarks,
    bool productMatches,
    bool productIntact,
    bool packagingOk,
    bool accessoriesPresent,
  ) async {
    try {
      final qcResult = ReturnQCModel(
        id: '',
        returnRequestId: request.id,
        performedBy: 'seller', // TODO: Get actual seller ID
        performedByName: 'Seller',
        performedAt: DateTime.now(),
        result: passed ? QCResult.passed : QCResult.failed,
        remarks: remarks.isNotEmpty ? remarks : null,
        productMatches: productMatches,
        productIntact: productIntact,
        packagingOk: packagingOk,
        accessoriesPresent: accessoriesPresent,
      );

      await _returnService.completePickupWithQC(
        returnId: request.id,
        qcResult: qcResult,
      );

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(passed ? 'QC Passed - Pickup completed' : 'QC Failed'),
            backgroundColor: passed ? Colors.green : Colors.red,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: $e'), backgroundColor: Colors.red),
        );
      }
    }
  }

  Future<void> _approveReturn(ReturnRequestModel request) async {
    try {
      await _returnService.approveReturn(returnId: request.id);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Return approved'),
            backgroundColor: Colors.green,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: $e'), backgroundColor: Colors.red),
        );
      }
    }
  }

  void _showRejectDialog(ReturnRequestModel request) {
    final controller = TextEditingController();
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Reject Return'),
        content: TextField(
          controller: controller,
          maxLines: 3,
          decoration: const InputDecoration(
            hintText: 'Reason for rejection...',
            border: OutlineInputBorder(),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () async {
              if (controller.text.isEmpty) return;
              Navigator.pop(context);
              await _returnService.rejectReturn(
                returnId: request.id,
                rejectionReason: controller.text,
              );
            },
            style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
            child: const Text('Reject', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
  }

  Future<void> _initiateRefund(ReturnRequestModel request) async {
    try {
      await _returnService.initiateRefund(
        returnId: request.id,
        amount: request.refundAmount,
      );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Refund initiated'),
            backgroundColor: Colors.green,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: $e'), backgroundColor: Colors.red),
        );
      }
    }
  }

  Map<String, dynamic> _getStatusConfig(ReturnStatus status) {
    switch (status) {
      case ReturnStatus.requested:
        return {'color': Colors.orange, 'icon': Icons.hourglass_top};
      case ReturnStatus.approved:
        return {'color': Colors.green, 'icon': Icons.check_circle};
      case ReturnStatus.rejected:
        return {'color': Colors.red, 'icon': Icons.cancel};
      case ReturnStatus.pickupScheduled:
        return {'color': Colors.blue, 'icon': Icons.schedule};
      case ReturnStatus.pickupInProgress:
        return {'color': Colors.blue, 'icon': Icons.local_shipping};
      case ReturnStatus.pickupCompleted:
        return {'color': Colors.teal, 'icon': Icons.inventory};
      case ReturnStatus.qcFailed:
        return {'color': Colors.red, 'icon': Icons.error};
      case ReturnStatus.refundInitiated:
        return {'color': Colors.purple, 'icon': Icons.payment};
      case ReturnStatus.refundCompleted:
        return {'color': Colors.green, 'icon': Icons.check_circle};
      case ReturnStatus.exchangeShipped:
        return {'color': Colors.blue, 'icon': Icons.local_shipping};
      case ReturnStatus.exchangeDelivered:
        return {'color': Colors.green, 'icon': Icons.check_circle};
      case ReturnStatus.closed:
        return {'color': Colors.grey, 'icon': Icons.done_all};
      case ReturnStatus.cancelled:
        return {'color': Colors.grey, 'icon': Icons.block};
    }
  }
}
