// lib/screens/admin/orders/admin_order_details_screen.dart
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import 'package:timeline_tile/timeline_tile.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:pdf/pdf.dart';
import 'package:printing/printing.dart';
import 'package:path_provider/path_provider.dart';

import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:letbuyy_services/letbuyy_services.dart';
import 'package:letbuyy_models/letbuyy_models.dart';
import 'widgets/order_status_updater.dart';

class AdminOrderDetailsScreen extends StatefulWidget {
  final String orderId;

  const AdminOrderDetailsScreen({super.key, required this.orderId});

  @override
  State<AdminOrderDetailsScreen> createState() =>
      _AdminOrderDetailsScreenState();
}

class _AdminOrderDetailsScreenState extends State<AdminOrderDetailsScreen> {
  bool _loadingInvoice = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        Provider.of<OrderProvider>(context, listen: false)
            .loadOrderById(widget.orderId);
      }
    });
  }

  // ===================================
  // ✅ NEW: Card Section Builder
  // ===================================
  Widget _buildCardSection({
    required Widget child,
    required bool isDark,
    String? title,
    IconData? icon,
    Widget? trailing,
  }) {
    final accentColor = isDark ? AppColors.primaryLight : AppColors.primary;
    final cardColor = isDark ? AppColors.surfaceDark : AppColors.surface;

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: cardColor,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: isDark ? AppColors.borderDark : AppColors.border,
          width: 1,
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
          if (title != null)
            Container(
              padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
              decoration: BoxDecoration(
                border: Border(
                  bottom: BorderSide(
                    color: isDark ? AppColors.borderDark : AppColors.border,
                    width: 1,
                  ),
                ),
              ),
              child: Row(
                children: [
                  if (icon != null)
                    Icon(icon, color: accentColor, size: 18),
                  if (icon != null) const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      title,
                      style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w800,
                        letterSpacing: -0.2,
                        color: isDark ? AppColors.textLight : AppColors.textPrimary,
                      ),
                    ),
                  ),
                  if (trailing != null) trailing,
                ],
              ),
            ),
          Padding(
            padding: const EdgeInsets.all(16),
            child: child,
          ),
        ],
      ),
    );
  }

  // ===================================
  // ✅ NEW: Action Tile (for lists inside cards)
  // ===================================
  Widget _buildActionTile({
    required IconData icon,
    required String title,
    required String subtitle,
    required Color color,
    required bool isDark,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 10.0, horizontal: 4.0), // Added horizontal padding
        child: Row(
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(icon, color: color, size: 22),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                      color: isDark ? AppColors.textLight : AppColors.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    subtitle,
                    style: TextStyle(
                      fontSize: 12,
                      color: isDark ? AppColors.textLightSecondary : AppColors.textSecondary,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],
              ),
            ),
            // ✅✅✅ REMOVED Arrow Icon
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Provider.of<ThemeProvider>(context).isDarkMode;
    final accentColor = isDark ? AppColors.primaryLight : AppColors.primary;

    return Scaffold(
      backgroundColor: isDark ? AppColors.backgroundDark : AppColors.background, // ✅ Fixed
      appBar: AppBar(
        backgroundColor: accentColor, // ✅ Fixed
        foregroundColor: isDark ? AppColors.textPrimary : AppColors.white, // ✅ Fixed
        elevation: 0,
        title: const Text(
          'Order Details',
          style: TextStyle(fontWeight: FontWeight.w700, fontSize: 20),
        ),
        centerTitle: true,
        actions: [
          IconButton(
            onPressed: () {
              Provider.of<OrderProvider>(context, listen: false)
                  .loadOrderById(widget.orderId);
            },
            icon: const Icon(Icons.refresh_rounded),
            tooltip: 'Reload',
          ),
        ],
      ),
      body: Consumer<OrderProvider>(
        builder: (context, orderProvider, child) {
          if (orderProvider.isLoading && orderProvider.selectedOrder == null) {
            return Center(
                child: CircularProgressIndicator(color: accentColor));
          }

          final OrderModel? order = orderProvider.selectedOrder;
          if (order == null) return _emptyState(isDark);

          return SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 22),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // ✅ REMOVED: _orderHeaderCard(order),
                _buildOrderInfoCard(order, isDark, accentColor), // ✅ NEW
                const SizedBox(height: 12),
                _buildOverviewGrid(order, isDark), // ✅ REBUILT
                const SizedBox(height: 12),
                OrderStatusUpdater(order: order),
                const SizedBox(height: 12),
                _buildCustomerAndDeliveryCard(order, isDark, accentColor), // ✅ NEW
                const SizedBox(height: 12),
                _buildItemsCard(order, isDark), // ✅ REBUILT
                const SizedBox(height: 12),
                _buildPricingCard(order, isDark, accentColor), // ✅ REBUILT
                const SizedBox(height: 12),
                _buildPaymentCard(order, isDark, accentColor), // ✅ REBUILT
                const SizedBox(height: 12),
                _buildTimelineCard(orderProvider, isDark, accentColor), // ✅ REBUILT & FIXED
                const SizedBox(height: 24),
                // Bottom actions row: Invoice (preview & download)
                Row(
                  children: [
                    Expanded(
                      child: ElevatedButton.icon(
                        onPressed: _loadingInvoice
                            ? null
                            : () => _exportInvoice(order,
                                preview: true, share: false),
                        icon: _loadingInvoice
                            ? SizedBox(
                                width: 16,
                                height: 16,
                                child: CircularProgressIndicator(
                                    strokeWidth: 2, color: isDark ? AppColors.textPrimary : AppColors.white), // ✅ Fixed
                              )
                            : const Icon(Icons.remove_red_eye_rounded,
                                size: 18),
                        label: const Text('Preview Invoice'),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: accentColor, // ✅ Fixed
                          foregroundColor: isDark ? AppColors.textPrimary : AppColors.white, // ✅ Fixed
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(10)),
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                    OutlinedButton.icon(
                      onPressed: _loadingInvoice
                          ? null
                          : () => _exportInvoice(order,
                              preview: false, share: true),
                      icon: Icon(Icons.download_rounded, size: 18, color: accentColor), // ✅ Fixed
                      label: Text('Download / Share', style: TextStyle(color: accentColor)), // ✅ Fixed
                      style: OutlinedButton.styleFrom(
                        side: BorderSide(color: accentColor.withValues(alpha: 0.5)), // ✅ Fixed
                        padding: const EdgeInsets.symmetric(
                            horizontal: 14, vertical: 14),
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(10)),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 24),
              ],
            ),
          ).animate().fadeIn(duration: 400.ms);
        },
      ),
    );
  }

  // =========================
  // Empty state
  // =========================
  Widget _emptyState(bool isDark) => Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.error_outline_rounded, size: 80, color: isDark ? AppColors.textLightDisabled : AppColors.textDisabled), // ✅ Fixed
            const SizedBox(height: 12),
            Text(
              'Order not found',
              style: TextStyle(
                fontWeight: FontWeight.w700, 
                fontSize: 16,
                color: isDark ? AppColors.textLight : AppColors.textPrimary // ✅ Fixed
              )
            ),
          ],
        ),
      );

  // =========================
  // Order Info Card
  // =========================
  Widget _buildOrderInfoCard(OrderModel order, bool isDark, Color accentColor) {
    return _buildCardSection(
      isDark: isDark,
      title: 'Order Info',
      icon: FontAwesomeIcons.hashtag,
      trailing: IconButton(
        onPressed: () {
          Clipboard.setData(ClipboardData(text: order.orderNumber));
          ScaffoldMessenger.of(context).showSnackBar(SnackBar(
            content: const Text('Order ID copied'),
            backgroundColor: accentColor,
          ));
        },
        icon: Icon(Icons.copy_rounded, color: isDark ? AppColors.textLightHint : AppColors.textHint, size: 20),
        tooltip: 'Copy Order ID',
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            order.orderNumber,
            style: AppTextStyles.headlineSmall.copyWith(
              color: isDark ? AppColors.textLight : AppColors.textPrimary,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            DateFormat('EEEE, MMM d, yyyy • hh:mm a').format(order.createdAt),
            style: AppTextStyles.bodyMedium.copyWith(
              color: isDark ? AppColors.textLightSecondary : AppColors.textSecondary,
            ),
          ),
        ],
      ),
    );
  }


  // =========================
  // Stats Row
  // =========================
  Widget _buildOverviewGrid(OrderModel order, bool isDark) {
    return GridView.count(
      crossAxisCount: 3,
      crossAxisSpacing: 10,
      mainAxisSpacing: 10,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      children: [
        _statCard(
            icon: Icons.shopping_bag_rounded,
            label: 'Items',
            value: '${order.items.length}',
            color: AppColors.info,
            isDark: isDark
        ),
        _statCard(
            icon: Icons.info_rounded,
            label: 'Status',
            value: order.orderStatus.toUpperCase(),
            color: _statusColor(order.orderStatus),
            isDark: isDark
        ),
        _statCard(
            icon: Icons.payment_rounded,
            label: 'Payment',
            value: order.paymentStatus.toUpperCase(),
            color: order.paymentStatus.toLowerCase() == 'paid'
                ? AppColors.success
                : AppColors.warning,
            isDark: isDark
        ),
      ],
    ).animate().fadeIn(duration: 300.ms).moveY(begin: 6, end: 0);
  }

  Widget _statCard(
      {required IconData icon,
      required String label,
      required String value,
      required Color color,
      required bool isDark}) {
    return Container(
      decoration: BoxDecoration(
        color: isDark ? AppColors.surfaceDark : AppColors.surface, // ✅ Fixed
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: isDark ? AppColors.borderDark : AppColors.border), // ✅ Fixed
        boxShadow: [
          BoxShadow(
              color: isDark ? AppColors.shadowDark : AppColors.shadowLight, // ✅ Fixed
              blurRadius: 8,
              offset: const Offset(0, 6))
        ],
      ),
      padding: const EdgeInsets.all(12),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
                color: color.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(8)),
            child: Icon(icon, color: color, size: 18),
          ),
          const SizedBox(height: 10),
          Text(label,
              style: TextStyle(fontSize: 11, color: isDark ? AppColors.textLightSecondary : AppColors.textSecondary, fontWeight: FontWeight.w500)), // ✅ Fixed
          const SizedBox(height: 2),
          Text(value,
              style: TextStyle(fontWeight: FontWeight.w800, color: color, fontSize: 13)), // ✅ Fixed
        ],
      ),
    );
  }

  // =========================
  // Customer & Delivery Card
  // =========================
  Widget _buildCustomerAndDeliveryCard(OrderModel order, bool isDark, Color accentColor) {
    final a = order.deliveryAddress;
    final hasCoords = a.latitude != null && a.longitude != null;

    return _buildCardSection(
      isDark: isDark,
      title: "Customer & Delivery",
      icon: Icons.person_pin_circle_rounded,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            a.name,
            style: const TextStyle(
                fontWeight: FontWeight.w700, fontSize: 15)
                .copyWith(color: isDark ? AppColors.textLight : AppColors.textPrimary),
          ),
          const SizedBox(height: 8),
          Text(
            a.fullAddress,
            style: TextStyle(color: isDark ? AppColors.textLightSecondary : AppColors.textSecondary, height: 1.4),
            maxLines: 3,
            overflow: TextOverflow.ellipsis,
          ),
          Divider(color: isDark ? AppColors.borderDark : AppColors.border, height: 24),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              // Contact Buttons
              Flexible(
                child: TextButton.icon(
                  onPressed: () => _launchPhone(a.phone),
                  icon: Icon(Icons.call_outlined, size: 18, color: accentColor),
                  label: Text('Call', style: TextStyle(color: accentColor, fontWeight: FontWeight.w600)),
                  style: TextButton.styleFrom(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    backgroundColor: accentColor.withValues(alpha: 0.1),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Flexible(
                child: TextButton.icon(
                  onPressed: () => _openWhatsApp(a.phone),
                  icon: Icon(FontAwesomeIcons.whatsapp, size: 18, color: AppColors.success),
                  label: Text('WhatsApp', style: TextStyle(color: AppColors.success, fontWeight: FontWeight.w600)),
                  style: TextButton.styleFrom(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    backgroundColor: AppColors.success.withValues(alpha: 0.1),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              // Map Button
              IconButton(
                onPressed: () => _launchGoogleMaps(order),
                icon: const Icon(Icons.map_rounded),
                color: AppColors.info,
                tooltip: 'Open in Maps',
                style: IconButton.styleFrom(
                  backgroundColor: AppColors.info.withValues(alpha: 0.1),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                ),
              ),
            ],
          )
        ],
      ),
    );
  }

  // =========================
  // Items Card
  // =========================
  Widget _buildItemsCard(OrderModel order, bool isDark) {
    return _buildCardSection(
      isDark: isDark,
      title: 'Items (${order.items.length})',
      icon: Icons.shopping_bag_outlined,
      child: Column(
        children: order.items
            .map((item) => Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: Row(
                    children: [
                      ClipRRect(
                        borderRadius: BorderRadius.circular(8),
                        child: item.productImage.isNotEmpty
                            ? Image.network(item.productImage,
                                width: 60,
                                height: 60,
                                fit: BoxFit.cover, errorBuilder: (_, __, ___) {
                                return Container(
                                  width: 60,
                                  height: 60,
                                  color: isDark ? AppColors.surfaceDarkVariant : AppColors.surfaceVariant,
                                  child: Icon(Icons.shopping_bag, color: isDark ? AppColors.textLightHint : AppColors.textHint),
                                );
                              })
                            : Container(
                                width: 60,
                                height: 60,
                                color: isDark ? AppColors.surfaceDarkVariant : AppColors.surfaceVariant,
                                child: Icon(Icons.shopping_bag, color: isDark ? AppColors.textLightHint : AppColors.textHint),
                              ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(item.productName,
                                  style: TextStyle(
                                    fontWeight: FontWeight.w700,
                                    color: isDark ? AppColors.textLight : AppColors.textPrimary
                                  )),
                              const SizedBox(height: 4),
                              Row(children: [
                                _smallBadge('Qty: ${item.quantity}',
                                    color: isDark ? AppColors.primaryLight : AppColors.primary, isDark: isDark),
                                const SizedBox(width: 8),
                                Text('₹${item.price.toStringAsFixed(0)}', style: TextStyle(color: isDark ? AppColors.textLightSecondary : AppColors.textSecondary)),
                              ]),
                            ]),
                      ),
                      Text(
                          '₹${(item.price * item.quantity).toStringAsFixed(0)}',
                          style:
                              TextStyle(fontWeight: FontWeight.w700, color: isDark ? AppColors.textLight : AppColors.textPrimary)),
                    ],
                  ),
                ))
            .toList(),
      ),
    );
  }

  // =========================
  // Pricing Card
  // =========================
  Widget _buildPricingCard(OrderModel order, bool isDark, Color accentColor) {
    return _buildCardSection(
      isDark: isDark,
      title: 'Price Details',
      icon: Icons.price_check_rounded,
      child:
          Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        _priceRow('Subtotal', order.subtotal, isDark: isDark), // ✅ FIXED
        const SizedBox(height: 8),
        _priceRow('Delivery', order.deliveryCharge, isDark: isDark), // ✅ FIXED
        const SizedBox(height: 8),
        _priceRow('Tax', order.tax, isDark: isDark), // ✅ FIXED
        if ((order.discount ?? 0) > 0) ...[
          const SizedBox(height: 8),
          _priceRow('Discount', -(order.discount ?? 0), isDark: isDark, isDiscount: true), // ✅ FIXED
        ],
        Divider(height: 22, color: isDark ? AppColors.borderDark : AppColors.border),
        _priceRow('Total', order.total, isDark: isDark, isTotal: true, color: accentColor), // ✅ FIXED
      ]),
    );
  }

  Widget _priceRow(String label, double amount,
      {required bool isDark, bool isDiscount = false, bool isTotal = false, Color? color}) { // ✅ FIXED
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label,
              style: TextStyle(
                  fontSize: isTotal ? 15 : 13,
                  fontWeight: isTotal ? FontWeight.w800 : FontWeight.w600,
                  color: isDark ? AppColors.textLightSecondary : AppColors.textSecondary)), // ✅ Fixed
          Text(
            '${isDiscount ? '-' : ''}₹${amount.toStringAsFixed(2)}',
            style: TextStyle(
                fontSize: isTotal ? 16 : 13,
                fontWeight: FontWeight.w700,
                color: color ?? (isDiscount // ✅ Fixed
                    ? AppColors.success
                    : (isDark ? AppColors.textLight : AppColors.textPrimary))),
          ),
        ],
      ),
    );
  }

  // =========================
  // Payment Card (detailed)
  // =========================
  Widget _buildPaymentCard(OrderModel order, bool isDark, Color accentColor) {
    final bool isPaid = order.paymentStatus.toLowerCase() == 'paid' || (order.paymentMethod.toLowerCase() == 'cod' && order.orderStatus.toLowerCase() == 'delivered');

    return _buildCardSection(
      isDark: isDark,
      title: 'Payment Information',
      icon: Icons.payment_rounded,
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(
          children: [
            Expanded(child: Text('Method', style: TextStyle(color: isDark ? AppColors.textLightSecondary : AppColors.textSecondary))),
            Text(_friendlyPaymentMethod(order.paymentMethod),
                style: TextStyle(fontWeight: FontWeight.w700, color: isDark ? AppColors.textLight : AppColors.textPrimary)),
          ],
        ),
        const SizedBox(height: 10),
        Row(
          children: [
            Expanded(child: Text('Status', style: TextStyle(color: isDark ? AppColors.textLightSecondary : AppColors.textSecondary))),
            _smallBadge(isPaid ? 'PAID' : order.paymentStatus.toUpperCase(),
                color: isPaid
                    ? AppColors.success
                    : AppColors.warning, isDark: isDark),
          ],
        ),
        if (order.razorpayOrderId != null) ...[
          const SizedBox(height: 10),
          Row(children: [
            Expanded(child: Text('Razorpay ID', style: TextStyle(color: isDark ? AppColors.textLightSecondary : AppColors.textSecondary))),
            Flexible(child: Text(order.razorpayOrderId ?? '', overflow: TextOverflow.ellipsis, style: TextStyle(fontWeight: FontWeight.w700, color: isDark ? AppColors.textLight : AppColors.textPrimary))),
            IconButton(onPressed: () {
              Clipboard.setData(ClipboardData(text: order.razorpayOrderId ?? ''));
              _showSnack('Razorpay ID copied');
            }, icon: Icon(Icons.copy_rounded, size: 18, color: isDark ? AppColors.textLightHint : AppColors.textHint)),
          ]),
        ],
      ]),
    );
  }

  // =========================
  // Timeline Card
  // =========================
  Widget _buildTimelineCard(OrderProvider orderProvider, bool isDark, Color accentColor) { // ✅ FIXED: Renamed
    final timeline = orderProvider.selectedOrderTimeline ?? [];

    return _buildCardSection( // ✅ Fixed
      isDark: isDark,
      title: 'Order Timeline',
      icon: Icons.timeline_rounded,
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          if (timeline.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 20),
              child: Center(child: Text('No timeline events', style: TextStyle(color: isDark ? AppColors.textLightSecondary : AppColors.textSecondary))),
            )
          else
            ListView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: timeline.length,
              itemBuilder: (context, i) {
                final ev = timeline[i];
                final isFirst = i == 0;
                final isLast = i == timeline.length - 1;
                final evColor = isFirst ? accentColor : (isDark ? AppColors.textLightHint : AppColors.textHint); // ✅ Fixed
                return TimelineTile(
                  isFirst: isFirst,
                  isLast: isLast,
                  beforeLineStyle: LineStyle(color: evColor.withValues(alpha: 0.2), thickness: 3),
                  afterLineStyle: LineStyle(color: evColor.withValues(alpha: 0.2), thickness: 3),
                  indicatorStyle: IndicatorStyle(
                    width: 38,
                    height: 38,
                    indicator: Container(
                      decoration: BoxDecoration(
                        color: isFirst ? accentColor : (isDark ? AppColors.surfaceDarkVariant : AppColors.surface), // ✅ Fixed
                        shape: BoxShape.circle,
                        border: Border.all(color: isFirst ? accentColor : (isDark ? AppColors.borderDark : AppColors.border), width: 2), // ✅ Fixed
                        boxShadow: [BoxShadow(color: isFirst ? accentColor.withValues(alpha: 0.2) : Colors.transparent, blurRadius: 6)], // ✅ Fixed
                      ),
                      child: Center(child: Icon(_timelineIcon(ev.status), color: isFirst ? (isDark ? AppColors.textPrimary : AppColors.white) : evColor, size: 18)), // ✅ Fixed
                    ),
                  ),
                  endChild: Padding(
                    padding: const EdgeInsets.only(left: 16, bottom: 18),
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Row(
                        children: [
                          Expanded(child: Text(ev.title, style: TextStyle(fontWeight: FontWeight.w800, color: isFirst ? (isDark ? AppColors.textLight : AppColors.textPrimary) : (isDark ? AppColors.textLightSecondary : AppColors.textSecondary)))), // ✅ Fixed
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                            decoration: BoxDecoration(color: accentColor.withValues(alpha: 0.08), borderRadius: BorderRadius.circular(8)),
                            child: Text(ev.statusDisplayName, style: TextStyle(color: accentColor, fontWeight: FontWeight.w700, fontSize: 12)),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Text(ev.description, style: TextStyle(color: isDark ? AppColors.textLightSecondary : AppColors.textSecondary)), // ✅ Fixed
                      const SizedBox(height: 6),
                      Text(DateFormat('dd MMM yyyy • hh:mm a').format(ev.timestamp), style: TextStyle(color: isDark ? AppColors.textLightHint : AppColors.textHint, fontSize: 12)), // ✅ Fixed
                    ]),
                  ),
                );
              },
            ),
        ]),
    );
  }

  // =========================
  // Utilities
  // =========================
  Widget _smallBadge(String text, {required Color color, required bool isDark}) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12), 
        borderRadius: BorderRadius.circular(8), 
        border: Border.all(color: color.withValues(alpha: 0.2))
      ),
      child: Text(text, style: TextStyle(color: color, fontWeight: FontWeight.w800, fontSize: 12)),
    );
  }

  Color _statusColor(String s) {
    switch (s.toLowerCase()) {
      case 'pending':
        return AppColors.pending;
      case 'confirmed':
        return AppColors.confirmed;
      case 'processing':
        return AppColors.processing;
      case 'shipped':
        return AppColors.shipped;
      case 'delivered':
      case 'completed':
        return AppColors.delivered;
      case 'cancelled':
        return AppColors.cancelled;
      default:
        return AppColors.grey;
    }
  }

  IconData _timelineIcon(dynamic status) {
    final statusStr = (status ?? '').toString().toLowerCase();
    switch (statusStr) {
      case 'pending':
        return Icons.schedule_rounded;
      case 'confirmed':
        return Icons.check_circle_outline_rounded;
      case 'processing':
        return Icons.autorenew_rounded;
      case 'shipped':
        return Icons.local_shipping_outlined;
      case 'outfordelivery':
      case 'out_for_delivery':
        return Icons.delivery_dining_rounded;
      case 'delivered':
        return Icons.check_circle_rounded;
      case 'cancelled':
        return Icons.cancel_outlined;
      default:
        return Icons.info_outline_rounded;
    }
  }

  String _friendlyPaymentMethod(String method) {
    switch ((method ?? '').toString().toLowerCase()) {
      case 'cod':
        return 'Cash on Delivery';
      case 'upi':
        return 'UPI';
      case 'card':
        return 'Card';
      case 'netbanking':
        return 'Netbanking';
      default:
        return (method ?? '').toString().toUpperCase();
    }
  }

  // ✅✅✅ START: ADDED HELPER FUNCTIONS
  Future<void> _launchPhone(String phone) async {
    final uri = Uri.parse('tel:$phone');
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri);
    } else {
      _showSnack('Cannot make call');
    }
  }

  Future<void> _openWhatsApp(String phone) {
    // Add +91 country code if not present
    String formattedPhone = phone.replaceAll(RegExp(r'[\s-]'), '');
    if (!formattedPhone.startsWith('+')) {
      if (formattedPhone.length == 10) {
        formattedPhone = '+91$formattedPhone';
      } else {
        formattedPhone = '+$formattedPhone';
      }
    }
    
    final uri = Uri.parse('https://wa.me/$formattedPhone');
    return _launchUri(uri, 'Cannot open WhatsApp');
  }

  Future<void> _launchGoogleMaps(OrderModel order) async {
    final a = order.deliveryAddress;
    final hasCoords = a.latitude != null && a.longitude != null;
    final url = hasCoords
        ? 'https://www.google.com/maps/search/?api=1&query=${a.latitude},${a.longitude}'
        : 'https://www.google.com/maps/search/?api=1&query=${Uri.encodeComponent(a.fullAddress)}';
    final uri = Uri.parse(url);
    _launchUri(uri, 'Could not open Google Maps');
  }

  Future<void> _launchUri(Uri uri, String errorMessage) async {
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    } else {
      _showSnack(errorMessage);
    }
  }
  // ✅✅✅ END: ADDED HELPER FUNCTIONS


  void _copyCoords(double lat, double lng) {
    Clipboard.setData(ClipboardData(text: '$lat,$lng'));
    _showSnack('Coordinates copied');
  }

  void _showSnack(String m) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(m),
      backgroundColor: AppColors.primary,
    ));
  }

  // =========================
  // Invoice generation & export
  // =========================
  Future<void> _exportInvoice(OrderModel order, {required bool preview, required bool share}) async {
    setState(() => _loadingInvoice = true);
    try {
      final pdfBytes = await _generateInvoicePdf(order);

      // Preview
      if (preview) {
        await Printing.layoutPdf(onLayout: (format) => pdfBytes);
      }

      // Share / Download (share sheet + save a temp file)
      if (share) {
        final filename = 'invoice_${order.orderNumber}_${DateTime.now().millisecondsSinceEpoch}.pdf';
        // Attempt to save to temporary directory
        try {
          final dir = await getTemporaryDirectory();
          final file = File('${dir.path}/$filename');
          await file.writeAsBytes(pdfBytes);
          // open share sheet (this lets user save to downloads or other apps)
          await Printing.sharePdf(bytes: pdfBytes, filename: filename);
          _showSnack('Invoice ready to share/save');
        } catch (e) {
          // fallback to share without file
          await Printing.sharePdf(bytes: pdfBytes, filename: 'invoice.pdf');
        }
      }
    } catch (e) {
      _showSnack('Failed to generate invoice: $e');
    } finally {
      if (mounted) setState(() => _loadingInvoice = false);
    }
  }

  Future<Uint8List> _generateInvoicePdf(OrderModel order) async {
    final pdf = pw.Document();
    
    // ✅ Use the blue from AppColors
    final PdfColor themeColor = PdfColor.fromHex(AppColors.primary.value.toRadixString(16).padLeft(8, '0'));

    // Try to load a unicode-capable font so ₹ prints correctly.
    Uint8List? ttfBytes;
    try {
      final bd = await rootBundle.load('assets/fonts/NotoSans-Regular.ttf');
      ttfBytes = bd.buffer.asUint8List();
    } catch (_) {
      // Font not found, will fallback
    }

    pw.Font baseFont;
    if (ttfBytes != null) {
      baseFont = pw.Font.ttf(ttfBytes.buffer.asByteData());
    } else {
      baseFont = await PdfGoogleFonts.notoSansRegular();
    }
    
    // Load logo image (optional) for header
    pw.MemoryImage? logoImage;
    try {
      final logoBd = await rootBundle.load('assets/images/logo.png'); // Assuming you have a logo here
      logoImage = pw.MemoryImage(logoBd.buffer.asUint8List());
    } catch (_) {
      logoImage = null;
    }

    final customer = order.deliveryAddress;
    final items = order.items ?? [];
    String money(double val) => '₹${val.toStringAsFixed(2)}';
    String qrData = 'https://letbuyy.in/track/${order.orderNumber}'; // Example track URL

    pdf.addPage(
      pw.MultiPage(
        pageFormat: PdfPageFormat.a4,
        margin: const pw.EdgeInsets.all(32),
        header: (context) => _buildPdfHeader(context, order, baseFont, themeColor, logoImage),
        footer: (context) => _buildPdfFooter(context, baseFont),
        build: (context) {
          return [
            _buildPdfCustomerInfo(customer, order, baseFont),
            pw.SizedBox(height: 24),
            _buildPdfItemsTable(items, baseFont, themeColor, money),
            pw.SizedBox(height: 12),
            _buildPdfTotals(order, baseFont, money, themeColor),
            pw.SizedBox(height: 24),
            _buildPdfNotes(order, baseFont),
          ];
        },
      ),
    );

    return pdf.save();
  }

  // --- PDF Header ---
  pw.Widget _buildPdfHeader(pw.Context context, OrderModel order, pw.Font baseFont, PdfColor themeColor, pw.MemoryImage? logoImage) {
    return pw.Row(
      mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
      crossAxisAlignment: pw.CrossAxisAlignment.start,
      children: [
        pw.Column(
          crossAxisAlignment: pw.CrossAxisAlignment.start,
          children: [
            pw.Text(
              'INVOICE',
              style: pw.TextStyle(
                font: baseFont,
                fontSize: 24,
                fontWeight: pw.FontWeight.bold,
                color: themeColor
              ),
            ),
            pw.SizedBox(height: 4),
            pw.Text(
              'Order #${order.orderNumber}',
              style: pw.TextStyle(
                font: baseFont,
                fontSize: 12,
                color: PdfColors.grey700
              ),
            ),
            pw.SizedBox(height: 2),
            pw.Text(
              'Issued: ${DateFormat('MMM d, yyyy').format(order.createdAt)}',
              style: pw.TextStyle(
                font: baseFont,
                fontSize: 10,
                color: PdfColors.grey700
              ),
            ),
          ]
        ),
        if (logoImage != null)
          pw.SizedBox(
            width: 80,
            height: 80,
            child: pw.Image(logoImage),
          ),
      ]
    );
  }

  // --- PDF Customer Info ---
  pw.Widget _buildPdfCustomerInfo(dynamic customer, OrderModel order, pw.Font baseFont) {
    return pw.Container(
      padding: const pw.EdgeInsets.all(16),
      decoration: pw.BoxDecoration(
        color: PdfColors.grey100,
        borderRadius: pw.BorderRadius.circular(8),
      ),
      child: pw.Row(
        crossAxisAlignment: pw.CrossAxisAlignment.start,
        children: [
          pw.Expanded(
            flex: 2,
            child: pw.Column(
              crossAxisAlignment: pw.CrossAxisAlignment.start,
              children: [
                pw.Text('BILLED TO:', style: pw.TextStyle(font: baseFont, fontSize: 10, color: PdfColors.grey600, fontWeight: pw.FontWeight.bold)),
                pw.SizedBox(height: 6),
                pw.Text(customer.name ?? '', style: pw.TextStyle(font: baseFont, fontSize: 12, fontWeight: pw.FontWeight.bold)),
                pw.SizedBox(height: 4),
                pw.Text(customer.fullAddress ?? '', style: pw.TextStyle(font: baseFont, fontSize: 10)), // ✅ FIXED: Removed lineHeight
                pw.SizedBox(height: 6),
                pw.Text(customer.phone ?? '', style: pw.TextStyle(font: baseFont, fontSize: 10)),
              ],
            ),
          ),
          pw.SizedBox(width: 16),
          pw.Expanded(
            flex: 1,
            child: pw.Column(
              crossAxisAlignment: pw.CrossAxisAlignment.start,
              children: [
                pw.Text('PAYMENT:', style: pw.TextStyle(font: baseFont, fontSize: 10, color: PdfColors.grey600, fontWeight: pw.FontWeight.bold)),
                pw.SizedBox(height: 6),
                pw.Text(_friendlyPaymentMethod(order.paymentMethod), style: pw.TextStyle(font: baseFont, fontSize: 11, fontWeight: pw.FontWeight.bold)),
                pw.SizedBox(height: 4),
                pw.Text(
                  order.paymentStatus.toUpperCase(), 
                  style: pw.TextStyle(
                    font: baseFont, 
                    fontSize: 10, 
                    fontWeight: pw.FontWeight.bold,
                    color: order.paymentStatus.toLowerCase() == 'paid' ? PdfColors.green700 : PdfColors.orange700
                  )
                ),
              ],
            ),
          ),
        ]
      )
    );
  }

  // --- PDF Items Table ---
  pw.Widget _buildPdfItemsTable(List<dynamic> items, pw.Font baseFont, PdfColor themeColor, Function(double) money) {
    final tableHeaders = ['#', 'Product', 'Qty', 'Price', 'Total'];

    return pw.Table.fromTextArray(
      headers: tableHeaders,
      data: [
        for (int i = 0; i < items.length; i++)
          [
            (i + 1).toString(),
            items[i].productName ?? '',
            (items[i].quantity ?? 1).toString(),
            money(items[i].price ?? 0.0),
            money((items[i].price ?? 0.0) * (items[i].quantity ?? 1)),
          ],
      ],
      headerStyle: pw.TextStyle(font: baseFont, fontSize: 10, fontWeight: pw.FontWeight.bold, color: PdfColors.white),
      cellStyle: pw.TextStyle(font: baseFont, fontSize: 9, color: PdfColors.black),
      headerDecoration: pw.BoxDecoration(color: themeColor),
      cellAlignment: pw.Alignment.centerLeft,
      cellAlignments: {
        0: pw.Alignment.center,
        2: pw.Alignment.center,
        3: pw.Alignment.centerRight,
        4: pw.Alignment.centerRight,
      },
      columnWidths: {
        0: const pw.FlexColumnWidth(0.5),
        1: const pw.FlexColumnWidth(3.5),
        2: const pw.FlexColumnWidth(1),
        3: const pw.FlexColumnWidth(1.5),
        4: const pw.FlexColumnWidth(1.5),
      },
    );
  }

  // --- PDF Totals ---
  pw.Widget _buildPdfTotals(OrderModel order, pw.Font baseFont, Function(double) money, PdfColor themeColor) {
    return pw.Row(
      mainAxisAlignment: pw.MainAxisAlignment.end,
      children: [
        pw.Container(
          width: 220,
          child: pw.Column(
            crossAxisAlignment: pw.CrossAxisAlignment.stretch,
            children: [
              _pdfPriceRow(baseFont, 'Subtotal', money(order.subtotal)),
              pw.SizedBox(height: 4),
              _pdfPriceRow(baseFont, 'Delivery', money(order.deliveryCharge)),
              pw.SizedBox(height: 4),
              _pdfPriceRow(baseFont, 'Tax', money(order.tax)),
              if ((order.discount ?? 0) > 0) ...[
                pw.SizedBox(height: 4),
                _pdfPriceRow(baseFont, 'Discount', '-${money(order.discount ?? 0.0)}', color: PdfColors.green700),
              ],
              pw.Divider(color: PdfColors.grey400, height: 12),
              _pdfPriceRow(baseFont, 'TOTAL', money(order.total), isBold: true, color: themeColor),
            ],
          ),
        ),
      ],
    );
  }

  // --- PDF Notes ---
  pw.Widget _buildPdfNotes(OrderModel order, pw.Font baseFont) {
    if (order.notes == null || order.notes!.isEmpty) return pw.Container();
    
    return pw.Column(
      crossAxisAlignment: pw.CrossAxisAlignment.start,
      children: [
        pw.Text('Notes:', style: pw.TextStyle(font: baseFont, fontSize: 10, fontWeight: pw.FontWeight.bold)),
        pw.SizedBox(height: 4),
        pw.Text(order.notes!, style: pw.TextStyle(font: baseFont, fontSize: 10, fontStyle: pw.FontStyle.italic)),
      ]
    );
  }

  // --- PDF Footer ---
  pw.Widget _buildPdfFooter(pw.Context context, pw.Font baseFont) {
    return pw.Container(
      alignment: pw.Alignment.center,
      margin: const pw.EdgeInsets.only(top: 20),
      padding: const pw.EdgeInsets.only(top: 10),
      decoration: const pw.BoxDecoration(
        border: pw.Border(top: pw.BorderSide(color: PdfColors.grey400, width: 1))
      ),
      child: pw.Text(
        'Thank you for your business! - Page ${context.pageNumber} of ${context.pagesCount}',
        style: pw.TextStyle(font: baseFont, fontSize: 9, color: PdfColors.grey700),
      ),
    );
  }

  pw.Widget _pdfPriceRow(pw.Font baseFont, String title, String value, {bool isBold = false, PdfColor? color}) {
    return pw.Padding(
      padding: const pw.EdgeInsets.symmetric(vertical: 2),
      child: pw.Row(
        mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
        children: [
          pw.Text(title, style: pw.TextStyle(font: baseFont, fontSize: 10, fontWeight: isBold ? pw.FontWeight.bold : pw.FontWeight.normal)),
          pw.Text(value, style: pw.TextStyle(font: baseFont, fontSize: 10, fontWeight: isBold ? pw.FontWeight.bold : pw.FontWeight.normal, color: color)),
        ],
      ),
    );
  }

  // ✅✅✅ DELETED STRAY CHARACTERS FROM HERE
}