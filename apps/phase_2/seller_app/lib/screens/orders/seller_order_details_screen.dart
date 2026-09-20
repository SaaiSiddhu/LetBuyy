// lib/screens/seller/orders/seller_order_details_screen.dart
// Advanced Seller Order Details Screen with Professional Features

import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:shimmer/shimmer.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:timeline_tile/timeline_tile.dart';

import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:letbuyy_services/letbuyy_services.dart';
import 'package:letbuyy_models/letbuyy_models.dart';
import 'widgets/order_settlement_card.dart';
import 'widgets/order_return_exchange_section.dart';

class SellerOrderDetailsScreen extends StatefulWidget {
  final String orderId;

  const SellerOrderDetailsScreen({
    super.key,
    required this.orderId,
  });

  @override
  State<SellerOrderDetailsScreen> createState() =>
      _SellerOrderDetailsScreenState();
}

class _SellerOrderDetailsScreenState extends State<SellerOrderDetailsScreen>
    with TickerProviderStateMixin {
  final FirebaseFirestore _firestore = FirebaseFirestore.instance;
  late TabController _tabController;

  // State
  bool _isUpdatingStatus = false;
  bool _isAddingNote = false;
  final TextEditingController _noteController = TextEditingController();
  final TextEditingController _trackingController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 4, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    _noteController.dispose();
    _trackingController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Provider.of<ThemeProvider>(context).isDarkMode;
    final isMobile = MediaQuery.of(context).size.width < 768;
    final accentColor = isDark ? AppColors.primaryLight : AppColors.primary;

    return StreamBuilder<DocumentSnapshot>(
      stream: _firestore.collection('orders').doc(widget.orderId).snapshots(),
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return _buildLoadingState(isDark, accentColor);
        }

        if (snapshot.hasError) {
          return _buildErrorState(isDark, snapshot.error.toString());
        }

        if (!snapshot.hasData || !snapshot.data!.exists) {
          return _buildNotFoundState(isDark);
        }

        final orderData = snapshot.data!.data() as Map<String, dynamic>;
        final order = OrderModel.fromMap(orderData, widget.orderId);

        return Scaffold(
          backgroundColor:
              isDark ? AppColors.backgroundDark : AppColors.background,
          body: NestedScrollView(
            headerSliverBuilder: (context, innerBoxIsScrolled) => [
              _buildSliverAppBar(isDark, accentColor, order),
              _buildOrderStatusHeader(isDark, order),
              _buildTabBarSliver(isDark, accentColor),
            ],
            body: TabBarView(
              controller: _tabController,
              children: [
                _buildOverviewTab(isDark, accentColor, order, isMobile),
                _buildItemsTab(isDark, accentColor, order),
                _buildTimelineTab(isDark, accentColor, order),
                _buildNotesTab(isDark, accentColor, order),
              ],
            ),
          ),
          bottomNavigationBar:
              _buildBottomActionBar(isDark, accentColor, order),
        );
      },
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SLIVER APP BAR
  // ═══════════════════════════════════════════════════════════════════════════

  Widget _buildSliverAppBar(bool isDark, Color accentColor, OrderModel order) {
    return SliverAppBar(
      expandedHeight: 120,
      floating: true,
      pinned: true,
      backgroundColor: accentColor,
      foregroundColor: isDark ? AppColors.textPrimary : AppColors.white,
      elevation: 0,
      flexibleSpace: FlexibleSpaceBar(
        titlePadding: const EdgeInsets.only(left: 56, bottom: 16, right: 16),
        title: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Order #${order.orderNumber ?? order.id.substring(0, 8).toUpperCase()}',
              style: TextStyle(
                color: isDark ? AppColors.textPrimary : AppColors.white,
                fontWeight: FontWeight.bold,
                fontSize: 14,
              ),
            ),
            Text(
              order.deliveryAddress.name ?? 'Customer',
              style: TextStyle(
                color: (isDark ? AppColors.textPrimary : AppColors.white)
                    .withValues(alpha: 0.8),
                fontSize: 11,
                fontWeight: FontWeight.w400,
              ),
            ),
          ],
        ),
        background: Container(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                accentColor,
                accentColor.withValues(alpha: 0.8),
              ],
            ),
          ),
        ),
      ),
      actions: [
        // Copy Order ID
        IconButton(
          icon: Icon(Icons.copy_rounded,
              color: isDark ? AppColors.textPrimary : AppColors.white),
          onPressed: () {
            Clipboard.setData(
                ClipboardData(text: order.orderNumber ?? order.id));
            _showSnackBar('Order ID copied!');
          },
          tooltip: 'Copy Order ID',
        ),
        // Print Invoice
        IconButton(
          icon: Icon(Icons.print_rounded,
              color: isDark ? AppColors.textPrimary : AppColors.white),
          onPressed: () => _showPrintOptions(isDark, order),
          tooltip: 'Print',
        ),
        // More Options
        PopupMenuButton<String>(
          icon: Icon(Icons.more_vert_rounded,
              color: isDark ? AppColors.textPrimary : AppColors.white),
          onSelected: (value) => _handleMenuAction(value, order),
          itemBuilder: (context) => [
            const PopupMenuItem(
              value: 'call',
              child: ListTile(
                leading: Icon(Icons.phone_outlined),
                title: Text('Call Customer'),
                contentPadding: EdgeInsets.zero,
              ),
            ),
            const PopupMenuItem(
              value: 'message',
              child: ListTile(
                leading: Icon(Icons.message_outlined),
                title: Text('Send Message'),
                contentPadding: EdgeInsets.zero,
              ),
            ),
            const PopupMenuItem(
              value: 'refund',
              child: ListTile(
                leading: Icon(Icons.money_off_outlined),
                title: Text('Process Refund'),
                contentPadding: EdgeInsets.zero,
              ),
            ),
            const PopupMenuDivider(),
            const PopupMenuItem(
              value: 'cancel',
              child: ListTile(
                leading: Icon(Icons.cancel_outlined, color: AppColors.error),
                title: Text('Cancel Order',
                    style: TextStyle(color: AppColors.error)),
                contentPadding: EdgeInsets.zero,
              ),
            ),
          ],
        ),
      ],
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ORDER STATUS HEADER
  // ═══════════════════════════════════════════════════════════════════════════

  Widget _buildOrderStatusHeader(bool isDark, OrderModel order) {
    final statusInfo = _getStatusInfo(order.orderStatus);
    final currencyFormat = NumberFormat.currency(symbol: '₹', decimalDigits: 0);

    return SliverToBoxAdapter(
      child: Container(
        margin: const EdgeInsets.all(16),
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              statusInfo.color.withValues(alpha: 0.15),
              statusInfo.color.withValues(alpha: 0.05),
            ],
          ),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: statusInfo.color.withValues(alpha: 0.3)),
        ),
        child: Column(
          children: [
            // Status Row
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: statusInfo.color.withValues(alpha: 0.2),
                    shape: BoxShape.circle,
                  ),
                  child: Icon(
                    statusInfo.icon,
                    color: statusInfo.color,
                    size: 28,
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        statusInfo.label,
                        style: TextStyle(
                          color: statusInfo.color,
                          fontWeight: FontWeight.bold,
                          fontSize: 20,
                        ),
                      ),
                      Text(
                        statusInfo.description,
                        style: TextStyle(
                          color: isDark
                              ? AppColors.textLightSecondary
                              : AppColors.textSecondary,
                          fontSize: 13,
                        ),
                      ),
                    ],
                  ),
                ),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(
                      currencyFormat.format(order.total),
                      style: TextStyle(
                        color:
                            isDark ? AppColors.textLight : AppColors.textPrimary,
                        fontWeight: FontWeight.bold,
                        fontSize: 22,
                      ),
                    ),
                    Text(
                      '${order.items.length} items',
                      style: TextStyle(
                        color: isDark
                            ? AppColors.textLightHint
                            : AppColors.textHint,
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ],
            ),

            // Progress Indicator
            if (order.orderStatus.toLowerCase() != 'cancelled' &&
                order.orderStatus.toLowerCase() != 'delivered') ...[
              const SizedBox(height: 20),
              _buildProgressIndicator(isDark, order.orderStatus),
            ],
          ],
        ),
      ).animate().fadeIn(duration: 400.ms).slideY(begin: -0.1, end: 0),
    );
  }

  Widget _buildProgressIndicator(bool isDark, String currentStatus) {
    final steps = ['pending', 'processing', 'shipped', 'delivered'];
    final currentIndex =
        steps.indexOf(currentStatus.toLowerCase()).clamp(0, steps.length - 1);

    return Column(
      children: [
        Row(
          children: List.generate(steps.length, (index) {
            final isCompleted = index <= currentIndex;
            final isCurrent = index == currentIndex;

            return Expanded(
              child: Row(
                children: [
                  Expanded(
                    child: Container(
                      height: 4,
                      decoration: BoxDecoration(
                        color: isCompleted
                            ? AppColors.success
                            : (isDark
                                ? AppColors.surfaceDarkVariant
                                : AppColors.surfaceVariant),
                        borderRadius: index == 0
                            ? const BorderRadius.horizontal(
                                left: Radius.circular(2))
                            : index == steps.length - 1
                                ? const BorderRadius.horizontal(
                                    right: Radius.circular(2))
                                : null,
                      ),
                    ),
                  ),
                  if (index < steps.length - 1)
                    Container(
                      width: 12,
                      height: 12,
                      decoration: BoxDecoration(
                        color: isCompleted
                            ? AppColors.success
                            : (isDark
                                ? AppColors.surfaceDarkVariant
                                : AppColors.surfaceVariant),
                        shape: BoxShape.circle,
                        border: isCurrent
                            ? Border.all(color: AppColors.success, width: 2)
                            : null,
                      ),
                      child: isCompleted
                          ? const Icon(Icons.check,
                              size: 8, color: AppColors.white)
                          : null,
                    ),
                ],
              ),
            );
          }),
        ),
        const SizedBox(height: 8),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: steps
              .map((step) => Text(
                    step[0].toUpperCase() + step.substring(1),
                    style: TextStyle(
                      color: isDark
                          ? AppColors.textLightHint
                          : AppColors.textHint,
                      fontSize: 10,
                      fontWeight: FontWeight.w500,
                    ),
                  ))
              .toList(),
        ),
      ],
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TAB BAR
  // ═══════════════════════════════════════════════════════════════════════════

  Widget _buildTabBarSliver(bool isDark, Color accentColor) {
    return SliverPersistentHeader(
      pinned: true,
      delegate: _StickyTabBarDelegate(
        child: Container(
          color: isDark ? AppColors.surfaceDark : AppColors.surface,
          child: TabBar(
            controller: _tabController,
            labelColor: accentColor,
            unselectedLabelColor:
                isDark ? AppColors.textLightSecondary : AppColors.textSecondary,
            indicatorColor: accentColor,
            indicatorWeight: 3,
            labelStyle: const TextStyle(
              fontWeight: FontWeight.w700,
              fontSize: 13,
            ),
            tabs: const [
              Tab(text: 'Overview'),
              Tab(text: 'Items'),
              Tab(text: 'Timeline'),
              Tab(text: 'Notes'),
            ],
          ),
        ),
      ),
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // OVERVIEW TAB
  // ═══════════════════════════════════════════════════════════════════════════

  Widget _buildOverviewTab(
      bool isDark, Color accentColor, OrderModel order, bool isMobile) {
    final dateFormat = DateFormat('MMMM dd, yyyy • hh:mm a');
    final currencyFormat = NumberFormat.currency(symbol: '₹', decimalDigits: 2);

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // ═════════════════════════════════════════════════════════════════
          // RETURN/EXCHANGE SECTION (if applicable)
          // ═════════════════════════════════════════════════════════════════
          if (order.hasReturnRequest || order.hasExchangeRequest)
            OrderReturnExchangeSection(
              orderId: order.id,
              hasReturnRequest: order.hasReturnRequest,
              hasExchangeRequest: order.hasExchangeRequest,
              returnRequestId: order.returnRequestId,
              returnStatus: order.returnStatus,
              returnType: order.returnType,
            ),
          if (order.hasReturnRequest || order.hasExchangeRequest)
            const SizedBox(height: 16),
          
          // Customer Information Card
          _buildSectionCard(
            isDark,
            'Customer Information',
            Icons.person_outline_rounded,
            [
              _buildDetailRow(
                isDark,
                'Name',
                order.deliveryAddress.name ?? 'N/A',
              ),
              _buildDetailRow(
                isDark,
                'Phone',
                order.deliveryAddress.phone ?? 'N/A',
                trailing: IconButton(
                        icon: const Icon(Icons.phone_outlined, size: 20),
                        onPressed: () => _callCustomer(
                            order.deliveryAddress.phone),
                        color: accentColor,
                      ),
              ),
            ],
          ),
          const SizedBox(height: 16),

          // Delivery Address Card
          _buildSectionCard(
            isDark,
            'Delivery Address',
            Icons.location_on_outlined,
            [
              _buildDetailRow(
                isDark,
                'Address',
                _formatAddress(order.deliveryAddress),
                isMultiLine: true,
              ),
              if (order.deliveryAddress.landmark != null)
                _buildDetailRow(
                  isDark,
                  'Landmark',
                  order.deliveryAddress.landmark!,
                ),
            ],
          ),
          const SizedBox(height: 16),

          // Payment Details Card
          _buildSectionCard(
            isDark,
            'Payment Details',
            Icons.payment_outlined,
            [
              _buildDetailRow(
                isDark,
                'Method',
                _formatPaymentMethod(order.paymentMethod),
              ),
              _buildDetailRow(
                isDark,
                'Status',
                order.paymentStatus ?? 'N/A',
                valueColor: _getPaymentStatusColor(order.paymentStatus),
              ),
              _buildDetailRow(
                isDark,
                'Transaction ID',
                order.razorpayPaymentId ?? 'N/A',
              ),
            ],
          ),
          const SizedBox(height: 16),

          // Order Summary Card
          _buildSectionCard(
            isDark,
            'Order Summary',
            Icons.receipt_outlined,
            [
              _buildDetailRow(
                isDark,
                'Subtotal',
                currencyFormat.format(order.subtotal),
              ),
              if (order.discount > 0)
                _buildDetailRow(
                  isDark,
                  'Discount',
                  '-${currencyFormat.format(order.discount)}',
                  valueColor: AppColors.success,
                ),
              if (order.deliveryCharge > 0)
                _buildDetailRow(
                  isDark,
                  'Shipping',
                  currencyFormat.format(order.deliveryCharge),
                ),
              if (order.tax > 0)
                _buildDetailRow(
                  isDark,
                  'Tax',
                  currencyFormat.format(order.tax),
                ),
              const Divider(height: 24),
              _buildDetailRow(
                isDark,
                'Total',
                currencyFormat.format(order.total),
                valueStyle: TextStyle(
                  color: isDark ? AppColors.textLight : AppColors.textPrimary,
                  fontWeight: FontWeight.bold,
                  fontSize: 18,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),

          // 💰 Settlement Card - Shows seller earnings breakdown
          if (order.orderStatus.toLowerCase() == 'delivered' ||
              order.orderStatus.toLowerCase() == 'shipped')
            OrderSettlementCard(
              orderId: order.id,
              isDark: isDark,
            ),
          if (order.orderStatus.toLowerCase() == 'delivered' ||
              order.orderStatus.toLowerCase() == 'shipped')
            const SizedBox(height: 16),

          // Timestamps Card
          _buildSectionCard(
            isDark,
            'Timestamps',
            Icons.schedule_outlined,
            [
              _buildDetailRow(
                isDark,
                'Created',
                dateFormat.format(order.createdAt),
              ),
              if (order.updatedAt != null)
                _buildDetailRow(
                  isDark,
                  'Last Updated',
                  dateFormat.format(order.updatedAt!),
                ),
            ],
          ),

          const SizedBox(height: 100), // Bottom padding for FAB
        ],
      ),
    );
  }

  Widget _buildSectionCard(
    bool isDark,
    String title,
    IconData icon,
    List<Widget> children,
  ) {
    return Container(
      decoration: BoxDecoration(
        color: isDark ? AppColors.surfaceDark : AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isDark ? AppColors.borderDark : AppColors.border,
          width: 0.5,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: isDark
                  ? AppColors.backgroundDark.withValues(alpha: 0.5)
                  : AppColors.background.withValues(alpha: 0.5),
              borderRadius:
                  const BorderRadius.vertical(top: Radius.circular(16)),
            ),
            child: Row(
              children: [
                Icon(
                  icon,
                  size: 20,
                  color: isDark
                      ? AppColors.textLightSecondary
                      : AppColors.textSecondary,
                ),
                const SizedBox(width: 10),
                Text(
                  title,
                  style: TextStyle(
                    color: isDark ? AppColors.textLight : AppColors.textPrimary,
                    fontWeight: FontWeight.bold,
                    fontSize: 15,
                  ),
                ),
              ],
            ),
          ),
          // Content
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(children: children),
          ),
        ],
      ),
    ).animate().fadeIn(duration: 300.ms).slideY(begin: 0.05, end: 0);
  }

  Widget _buildDetailRow(
    bool isDark,
    String label,
    String value, {
    bool isMultiLine = false,
    Color? valueColor,
    TextStyle? valueStyle,
    Widget? trailing,
  }) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        crossAxisAlignment:
            isMultiLine ? CrossAxisAlignment.start : CrossAxisAlignment.center,
        children: [
          SizedBox(
            width: 100,
            child: Text(
              label,
              style: TextStyle(
                color:
                    isDark ? AppColors.textLightHint : AppColors.textHint,
                fontSize: 13,
              ),
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: valueStyle ??
                  TextStyle(
                    color: valueColor ??
                        (isDark ? AppColors.textLight : AppColors.textPrimary),
                    fontWeight: FontWeight.w500,
                    fontSize: 14,
                  ),
            ),
          ),
          if (trailing != null) trailing,
        ],
      ),
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ITEMS TAB
  // ═══════════════════════════════════════════════════════════════════════════

  Widget _buildItemsTab(bool isDark, Color accentColor, OrderModel order) {
    final currencyFormat = NumberFormat.currency(symbol: '₹', decimalDigits: 0);

    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: order.items.length,
      itemBuilder: (context, index) {
        final item = order.items[index];

        return Container(
          margin: const EdgeInsets.only(bottom: 12),
          decoration: BoxDecoration(
            color: isDark ? AppColors.surfaceDark : AppColors.surface,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: isDark ? AppColors.borderDark : AppColors.border,
              width: 0.5,
            ),
          ),
          child: Row(
            children: [
              // Product Image
              Container(
                width: 100,
                height: 100,
                decoration: BoxDecoration(
                  color: isDark
                      ? AppColors.surfaceDarkVariant
                      : AppColors.surfaceVariant,
                  borderRadius:
                      const BorderRadius.horizontal(left: Radius.circular(16)),
                  image: item.imageUrl.isNotEmpty
                      ? DecorationImage(
                          image: NetworkImage(item.imageUrl),
                          fit: BoxFit.cover,
                        )
                      : null,
                ),
                child: item.imageUrl.isEmpty
                    ? Icon(
                        Icons.image_outlined,
                        color: isDark
                            ? AppColors.textLightHint
                            : AppColors.textHint,
                        size: 32,
                      )
                    : null,
              ),

              // Product Details
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.all(12),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        item.productName,
                        style: TextStyle(
                          color: isDark
                              ? AppColors.textLight
                              : AppColors.textPrimary,
                          fontWeight: FontWeight.bold,
                          fontSize: 14,
                        ),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 4),
                      if (item.variant != null)
                        Text(
                          item.variant!,
                          style: TextStyle(
                            color: isDark
                                ? AppColors.textLightHint
                                : AppColors.textHint,
                            fontSize: 12,
                          ),
                        ),
                      const SizedBox(height: 8),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 8,
                              vertical: 4,
                            ),
                            decoration: BoxDecoration(
                              color: isDark
                                  ? AppColors.backgroundDark
                                  : AppColors.background,
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Text(
                              'Qty: ${item.quantity}',
                              style: TextStyle(
                                color: isDark
                                    ? AppColors.textLightSecondary
                                    : AppColors.textSecondary,
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ),
                          Text(
                            currencyFormat.format(item.price * item.quantity),
                            style: TextStyle(
                              color: accentColor,
                              fontWeight: FontWeight.bold,
                              fontSize: 15,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ).animate().fadeIn(
              delay: Duration(milliseconds: index * 50),
              duration: 300.ms,
            );
      },
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TIMELINE TAB
  // ═══════════════════════════════════════════════════════════════════════════

  Widget _buildTimelineTab(bool isDark, Color accentColor, OrderModel order) {
    final dateFormat = DateFormat('MMM dd, yyyy • hh:mm a');

    // Create timeline from current status since OrderModel doesn't have statusHistory
    final displayHistory = [
      {
        'status': order.orderStatus,
        'timestamp': order.updatedAt ?? order.createdAt,
        'note': 'Current status',
      },
      {
        'status': 'pending',
        'timestamp': order.createdAt,
        'note': 'Order created',
      },
    ];

    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: displayHistory.length,
      itemBuilder: (context, index) {
        final historyItem = displayHistory[index];
        final status = historyItem['status'] as String? ?? '';
        final timestamp = historyItem['timestamp'] is Timestamp
            ? (historyItem['timestamp'] as Timestamp).toDate()
            : historyItem['timestamp'] as DateTime? ?? DateTime.now();
        final note = historyItem['note'] as String?;
        final updatedBy = historyItem['updatedBy'] as String?;

        final statusInfo = _getStatusInfo(status);

        return TimelineTile(
          isFirst: index == 0,
          isLast: index == displayHistory.length - 1,
          indicatorStyle: IndicatorStyle(
            width: 32,
            height: 32,
            indicator: Container(
              decoration: BoxDecoration(
                color: statusInfo.color.withValues(alpha: 0.2),
                shape: BoxShape.circle,
                border: Border.all(color: statusInfo.color, width: 2),
              ),
              child: Icon(
                statusInfo.icon,
                size: 16,
                color: statusInfo.color,
              ),
            ),
          ),
          beforeLineStyle: LineStyle(
            color: index == 0
                ? statusInfo.color
                : (isDark
                    ? AppColors.surfaceDarkVariant
                    : AppColors.surfaceVariant),
            thickness: 2,
          ),
          afterLineStyle: LineStyle(
            color: isDark
                ? AppColors.surfaceDarkVariant
                : AppColors.surfaceVariant,
            thickness: 2,
          ),
          endChild: Container(
            margin: const EdgeInsets.only(left: 16, bottom: 24),
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: isDark ? AppColors.surfaceDark : AppColors.surface,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color: index == 0
                    ? statusInfo.color.withValues(alpha: 0.3)
                    : (isDark ? AppColors.borderDark : AppColors.border),
              ),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      statusInfo.label,
                      style: TextStyle(
                        color: statusInfo.color,
                        fontWeight: FontWeight.bold,
                        fontSize: 14,
                      ),
                    ),
                    Text(
                      dateFormat.format(timestamp),
                      style: TextStyle(
                        color: isDark
                            ? AppColors.textLightHint
                            : AppColors.textHint,
                        fontSize: 11,
                      ),
                    ),
                  ],
                ),
                if (note != null) ...[
                  const SizedBox(height: 8),
                  Text(
                    note,
                    style: TextStyle(
                      color: isDark
                          ? AppColors.textLightSecondary
                          : AppColors.textSecondary,
                      fontSize: 13,
                    ),
                  ),
                ],
                if (updatedBy != null) ...[
                  const SizedBox(height: 4),
                  Text(
                    'Updated by: $updatedBy',
                    style: TextStyle(
                      color: isDark
                          ? AppColors.textLightHint
                          : AppColors.textHint,
                      fontSize: 11,
                      fontStyle: FontStyle.italic,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ).animate().fadeIn(
              delay: Duration(milliseconds: index * 100),
              duration: 300.ms,
            );
      },
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // NOTES TAB
  // ═══════════════════════════════════════════════════════════════════════════

  Widget _buildNotesTab(bool isDark, Color accentColor, OrderModel order) {
    final dateFormat = DateFormat('MMM dd, yyyy • hh:mm a');
    final hasNote = order.notes != null && order.notes!.isNotEmpty;

    return Column(
      children: [
        // Add Note Button
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: isDark ? AppColors.surfaceDark : AppColors.surface,
            border: Border(
              bottom: BorderSide(
                color: isDark ? AppColors.borderDark : AppColors.border,
              ),
            ),
          ),
          child: Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _noteController,
                  style: TextStyle(
                    color: isDark ? AppColors.textLight : AppColors.textPrimary,
                  ),
                  decoration: InputDecoration(
                    hintText: 'Add a note...',
                    hintStyle: TextStyle(
                      color: isDark
                          ? AppColors.textLightHint
                          : AppColors.textHint,
                    ),
                    filled: true,
                    fillColor: isDark
                        ? AppColors.backgroundDark
                        : AppColors.background,
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide.none,
                    ),
                    contentPadding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 12,
                    ),
                  ),
                  maxLines: 2,
                  minLines: 1,
                ),
              ),
              const SizedBox(width: 12),
              ElevatedButton(
                onPressed: _isAddingNote ? null : () => _addNote(order.id),
                style: ElevatedButton.styleFrom(
                  backgroundColor: accentColor,
                  foregroundColor:
                      isDark ? AppColors.textPrimary : AppColors.white,
                  padding: const EdgeInsets.all(14),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                child: _isAddingNote
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          valueColor:
                              AlwaysStoppedAnimation(AppColors.white),
                        ),
                      )
                    : const Icon(Icons.send_rounded, size: 20),
              ),
            ],
          ),
        ),

        // Notes Display
        Expanded(
          child: !hasNote
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(
                        Icons.note_alt_outlined,
                        size: 64,
                        color: isDark
                            ? AppColors.textLightHint
                            : AppColors.textHint,
                      ),
                      const SizedBox(height: 16),
                      Text(
                        'No notes yet',
                        style: TextStyle(
                          color: isDark
                              ? AppColors.textLightSecondary
                              : AppColors.textSecondary,
                          fontSize: 16,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'Add notes to keep track of important information',
                        style: TextStyle(
                          color: isDark
                              ? AppColors.textLightHint
                              : AppColors.textHint,
                          fontSize: 13,
                        ),
                      ),
                    ],
                  ),
                )
              : SingleChildScrollView(
                  padding: const EdgeInsets.all(16),
                  child: Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: isDark ? AppColors.surfaceDark : AppColors.surface,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                        color: isDark
                            ? AppColors.borderDark
                            : AppColors.border,
                      ),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              'Order Note',
                              style: TextStyle(
                                color: accentColor,
                                fontWeight: FontWeight.w600,
                                fontSize: 13,
                              ),
                            ),
                            Text(
                              dateFormat.format(order.updatedAt ?? order.createdAt),
                              style: TextStyle(
                                color: isDark
                                    ? AppColors.textLightHint
                                    : AppColors.textHint,
                                fontSize: 11,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 8),
                        Text(
                          order.notes!,
                          style: TextStyle(
                            color: isDark
                                ? AppColors.textLight
                                : AppColors.textPrimary,
                            fontSize: 14,
                          ),
                        ),
                      ],
                    ),
                  ).animate().fadeIn(duration: 200.ms),
                ),
        ),
      ],
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // BOTTOM ACTION BAR
  // ═══════════════════════════════════════════════════════════════════════════

  Widget _buildBottomActionBar(
      bool isDark, Color accentColor, OrderModel order) {
    final nextStatus = _getNextStatus(order.orderStatus);

    if (order.orderStatus.toLowerCase() == 'delivered' ||
        order.orderStatus.toLowerCase() == 'cancelled') {
      return const SizedBox.shrink();
    }

    return Container(
      padding: EdgeInsets.only(
        left: 16,
        right: 16,
        top: 12,
        bottom: MediaQuery.of(context).padding.bottom + 12,
      ),
      decoration: BoxDecoration(
        color: isDark ? AppColors.surfaceDark : AppColors.surface,
        boxShadow: [
          BoxShadow(
            color: isDark ? AppColors.shadowDark : AppColors.shadowLight,
            blurRadius: 8,
            offset: const Offset(0, -2),
          ),
        ],
      ),
      child: Row(
        children: [
          // Cancel Button
          if (order.orderStatus.toLowerCase() == 'pending')
            Expanded(
              child: OutlinedButton.icon(
                onPressed: () => _showCancelConfirmation(isDark, order),
                icon: const Icon(Icons.close_rounded, size: 18),
                label: const Text('Cancel'),
                style: OutlinedButton.styleFrom(
                  foregroundColor: AppColors.error,
                  side: const BorderSide(color: AppColors.error),
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
              ),
            ),
          if (order.orderStatus.toLowerCase() == 'pending')
            const SizedBox(width: 12),

          // Next Status Button
          if (nextStatus != null)
            Expanded(
              flex: 2,
              child: ElevatedButton.icon(
                onPressed: _isUpdatingStatus
                    ? null
                    : () => _updateOrderStatus(order.id, nextStatus),
                icon: _isUpdatingStatus
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          valueColor:
                              AlwaysStoppedAnimation(AppColors.white),
                        ),
                      )
                    : Icon(_getNextStatusIcon(nextStatus), size: 18),
                label: Text(_getNextStatusLabel(nextStatus)),
                style: ElevatedButton.styleFrom(
                  backgroundColor: accentColor,
                  foregroundColor:
                      isDark ? AppColors.textPrimary : AppColors.white,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HELPER METHODS
  // ═══════════════════════════════════════════════════════════════════════════

  _StatusInfo _getStatusInfo(String status) {
    switch (status.toLowerCase()) {
      case 'pending':
        return _StatusInfo(
          label: 'Pending',
          color: AppColors.warning,
          icon: Icons.hourglass_empty_rounded,
          description: 'Awaiting confirmation and processing',
        );
      case 'processing':
        return _StatusInfo(
          label: 'Processing',
          color: AppColors.info,
          icon: Icons.inventory_2_outlined,
          description: 'Order is being prepared for shipping',
        );
      case 'shipped':
        return _StatusInfo(
          label: 'Shipped',
          color: AppColors.primaryLight,
          icon: Icons.local_shipping_outlined,
          description: 'Order is on the way to customer',
        );
      case 'delivered':
        return _StatusInfo(
          label: 'Delivered',
          color: AppColors.success,
          icon: Icons.check_circle_outline_rounded,
          description: 'Order has been delivered successfully',
        );
      case 'cancelled':
        return _StatusInfo(
          label: 'Cancelled',
          color: AppColors.error,
          icon: Icons.cancel_outlined,
          description: 'Order has been cancelled',
        );
      default:
        return _StatusInfo(
          label: status,
          color: AppColors.textHint,
          icon: Icons.help_outline_rounded,
          description: 'Unknown status',
        );
    }
  }

  String? _getNextStatus(String currentStatus) {
    switch (currentStatus.toLowerCase()) {
      case 'pending':
        return 'processing';
      case 'processing':
        return 'shipped';
      case 'shipped':
        return 'delivered';
      default:
        return null;
    }
  }

  IconData _getNextStatusIcon(String status) {
    switch (status.toLowerCase()) {
      case 'processing':
        return Icons.play_circle_outline_rounded;
      case 'shipped':
        return Icons.local_shipping_outlined;
      case 'delivered':
        return Icons.check_circle_outline_rounded;
      default:
        return Icons.arrow_forward_rounded;
    }
  }

  String _getNextStatusLabel(String status) {
    switch (status.toLowerCase()) {
      case 'processing':
        return 'Start Processing';
      case 'shipped':
        return 'Mark as Shipped';
      case 'delivered':
        return 'Mark as Delivered';
      default:
        return 'Update Status';
    }
  }

  String _formatAddress(AddressModel? address) {
    if (address == null) return 'N/A';

    final parts = [
      address.addressLine1,
      address.addressLine2,
      address.city,
      address.state,
      address.zipcode,
    ].where((p) => p.isNotEmpty).toList();

    return parts.join(', ');
  }

  String _formatPaymentMethod(String? method) {
    if (method == null || method.isEmpty) return 'N/A';
    switch (method.toLowerCase()) {
      case 'cod':
      case 'cash_on_delivery':
        return 'Cash on Delivery';
      case 'upi':
        return 'UPI';
      case 'card':
        return 'Credit/Debit Card';
      case 'netbanking':
        return 'Net Banking';
      case 'wallet':
        return 'Wallet';
      default:
        return method;
    }
  }

  Color _getPaymentStatusColor(String? status) {
    switch (status?.toLowerCase()) {
      case 'paid':
      case 'completed':
        return AppColors.success;
      case 'pending':
        return AppColors.warning;
      case 'failed':
        return AppColors.error;
      default:
        return AppColors.textHint;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ACTIONS
  // ═══════════════════════════════════════════════════════════════════════════

  Future<void> _updateOrderStatus(String orderId, String newStatus) async {
    setState(() => _isUpdatingStatus = true);

    try {
      // ✅ Use OrderService to update status - this triggers loyalty points on delivery
      final orderService = OrderService();
      await orderService.updateOrderStatusWithTimeline(
        orderId,
        newStatus,
        description: 'Status updated by seller',
      );

      _showSnackBar('Order status updated to ${newStatus.toUpperCase()}');
    } catch (e) {
      debugPrint('❌ Failed to update order status: $e');
      _showSnackBar('Failed to update status: $e', isError: true);
    } finally {
      setState(() => _isUpdatingStatus = false);
    }
  }

  Future<void> _addNote(String orderId) async {
    final noteText = _noteController.text.trim();
    if (noteText.isEmpty) return;

    setState(() => _isAddingNote = true);

    try {
      await _firestore.collection('orders').doc(orderId).update({
        'notes': noteText,
        'updatedAt': FieldValue.serverTimestamp(),
      });

      _noteController.clear();
      _showSnackBar('Note updated successfully');
    } catch (e) {
      _showSnackBar('Failed to update note: $e', isError: true);
    } finally {
      setState(() => _isAddingNote = false);
    }
  }

  void _callCustomer(String phone) {
    launchUrl(Uri.parse('tel:$phone'));
  }

  void _handleMenuAction(String action, OrderModel order) {
    switch (action) {
      case 'call':
        _callCustomer(order.deliveryAddress.phone);
              break;
      case 'message':
        // Implement messaging
        break;
      case 'refund':
        // Implement refund flow
        break;
      case 'cancel':
        final isDark = Provider.of<ThemeProvider>(context, listen: false).isDarkMode;
        _showCancelConfirmation(isDark, order);
        break;
    }
  }

  void _showPrintOptions(bool isDark, OrderModel order) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (context) => Container(
        padding: const EdgeInsets.all(24),
        decoration: BoxDecoration(
          color: isDark ? AppColors.surfaceDark : AppColors.surface,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.receipt_long_outlined),
              title: const Text('Print Invoice'),
              onTap: () {
                Navigator.pop(context);
                _showSnackBar('Generating invoice...');
              },
            ),
            ListTile(
              leading: const Icon(Icons.local_shipping_outlined),
              title: const Text('Print Shipping Label'),
              onTap: () {
                Navigator.pop(context);
                _showSnackBar('Generating shipping label...');
              },
            ),
            ListTile(
              leading: const Icon(Icons.inventory_2_outlined),
              title: const Text('Print Packing Slip'),
              onTap: () {
                Navigator.pop(context);
                _showSnackBar('Generating packing slip...');
              },
            ),
          ],
        ),
      ),
    );
  }

  void _showCancelConfirmation(bool isDark, OrderModel order) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: isDark ? AppColors.surfaceDark : AppColors.surface,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Row(
          children: [
            Icon(Icons.warning_amber_rounded, color: AppColors.error),
            SizedBox(width: 12),
            Text('Cancel Order'),
          ],
        ),
        content: const Text(
          'Are you sure you want to cancel this order? This action cannot be undone.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('No, Keep Order'),
          ),
          ElevatedButton(
            onPressed: () async {
              Navigator.pop(context);
              await _updateOrderStatus(order.id, 'cancelled');
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.error,
              foregroundColor: AppColors.white,
            ),
            child: const Text('Yes, Cancel'),
          ),
        ],
      ),
    );
  }

  void _showSnackBar(String message, {bool isError = false}) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: isError ? AppColors.error : AppColors.success,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        margin: const EdgeInsets.all(16),
      ),
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STATE WIDGETS
  // ═══════════════════════════════════════════════════════════════════════════

  Widget _buildLoadingState(bool isDark, Color accentColor) {
    return Scaffold(
      backgroundColor: isDark ? AppColors.backgroundDark : AppColors.background,
      appBar: AppBar(
        backgroundColor: accentColor,
        foregroundColor: isDark ? AppColors.textPrimary : AppColors.white,
        title: const Text('Order Details'),
      ),
      body: Shimmer.fromColors(
        baseColor:
            isDark ? AppColors.surfaceDarkVariant : AppColors.shimmerBase,
        highlightColor:
            isDark ? AppColors.surfaceDarkContainer : AppColors.shimmerHighlight,
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Column(
            children: List.generate(
              4,
              (index) => Container(
                margin: const EdgeInsets.only(bottom: 16),
                height: 150,
                decoration: BoxDecoration(
                  color: isDark ? AppColors.surfaceDark : AppColors.surface,
                  borderRadius: BorderRadius.circular(16),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildErrorState(bool isDark, String error) {
    return Scaffold(
      backgroundColor: isDark ? AppColors.backgroundDark : AppColors.background,
      appBar: AppBar(
        backgroundColor:
            isDark ? AppColors.primaryLight : AppColors.primary,
        foregroundColor: isDark ? AppColors.textPrimary : AppColors.white,
        title: const Text('Order Details'),
      ),
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.error_outline, size: 64, color: AppColors.error),
            const SizedBox(height: 16),
            Text(
              'Error loading order',
              style: TextStyle(
                color: isDark ? AppColors.textLight : AppColors.textPrimary,
                fontWeight: FontWeight.bold,
                fontSize: 18,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              error,
              style: TextStyle(
                color: isDark
                    ? AppColors.textLightSecondary
                    : AppColors.textSecondary,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 24),
            ElevatedButton.icon(
              onPressed: () => setState(() {}),
              icon: const Icon(Icons.refresh),
              label: const Text('Retry'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildNotFoundState(bool isDark) {
    return Scaffold(
      backgroundColor: isDark ? AppColors.backgroundDark : AppColors.background,
      appBar: AppBar(
        backgroundColor:
            isDark ? AppColors.primaryLight : AppColors.primary,
        foregroundColor: isDark ? AppColors.textPrimary : AppColors.white,
        title: const Text('Order Details'),
      ),
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.search_off_rounded,
              size: 64,
              color: isDark ? AppColors.textLightHint : AppColors.textHint,
            ),
            const SizedBox(height: 16),
            Text(
              'Order not found',
              style: TextStyle(
                color: isDark ? AppColors.textLight : AppColors.textPrimary,
                fontWeight: FontWeight.bold,
                fontSize: 18,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'The order you\'re looking for doesn\'t exist or has been deleted.',
              style: TextStyle(
                color: isDark
                    ? AppColors.textLightSecondary
                    : AppColors.textSecondary,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 24),
            ElevatedButton.icon(
              onPressed: () => Navigator.pop(context),
              icon: const Icon(Icons.arrow_back),
              label: const Text('Go Back'),
            ),
          ],
        ),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPER CLASSES
// ═══════════════════════════════════════════════════════════════════════════

class _StatusInfo {
  final String label;
  final Color color;
  final IconData icon;
  final String description;

  _StatusInfo({
    required this.label,
    required this.color,
    required this.icon,
    required this.description,
  });
}

class _StickyTabBarDelegate extends SliverPersistentHeaderDelegate {
  final Widget child;

  _StickyTabBarDelegate({required this.child});

  @override
  Widget build(
      BuildContext context, double shrinkOffset, bool overlapsContent) {
    return child;
  }

  @override
  double get maxExtent => 48;

  @override
  double get minExtent => 48;

  @override
  bool shouldRebuild(covariant _StickyTabBarDelegate oldDelegate) {
    return child != oldDelegate.child;
  }
}