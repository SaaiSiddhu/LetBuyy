// lib/screens/products/widgets/seller_product_card.dart
// Enhanced Seller Product Card with Professional Glassmorphic Design - V2.0
// Matches the order card design pattern with stats, expandable sections

import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';

import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:letbuyy_models/letbuyy_models.dart';

// ═══════════════════════════════════════════════════════════════════════════
// SELLER PRODUCT CARD - Professional Glassmorphic Design
// ═══════════════════════════════════════════════════════════════════════════

class SellerProductCard extends StatefulWidget {
  final ProductModel product;
  final VoidCallback? onEdit;
  final VoidCallback? onDelete;
  final VoidCallback? onTap;
  final Function(bool) onToggleActive;
  final bool isSelected;
  final bool showSelectionCheckbox;
  final VoidCallback? onSelectionToggle;

  const SellerProductCard({
    super.key,
    required this.product,
    this.onEdit,
    this.onDelete,
    this.onTap,
    required this.onToggleActive,
    this.isSelected = false,
    this.showSelectionCheckbox = false,
    this.onSelectionToggle,
  });

  @override
  State<SellerProductCard> createState() => _SellerProductCardState();
}

class _SellerProductCardState extends State<SellerProductCard> {
  bool _isStatsExpanded = false;

  ProductModel get product => widget.product;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final currencyFormat = NumberFormat.currency(symbol: '₹', decimalDigits: 0);

    final statusInfo = _getStatusInfo();
    final approvalInfo = _getApprovalInfo();

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: isDark ? Colors.black.withValues(alpha: 0.3) : AppColors.shadowLight.withValues(alpha: 0.4),
            blurRadius: 16,
            offset: const Offset(0, 6),
            spreadRadius: -4,
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(20),
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 8, sigmaY: 8),
          child: Container(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: isDark
                    ? [Colors.white.withValues(alpha: 0.08), Colors.white.withValues(alpha: 0.04)]
                    : [Colors.white.withValues(alpha: 0.95), Colors.white.withValues(alpha: 0.8)],
              ),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(
                color: widget.isSelected 
                    ? AppColors.primary 
                    : (isDark ? Colors.white.withValues(alpha: 0.08) : Colors.white.withValues(alpha: 0.6)),
                width: widget.isSelected ? 2 : 1,
              ),
            ),
            child: Material(
              color: Colors.transparent,
              child: InkWell(
                onTap: widget.showSelectionCheckbox 
                    ? widget.onSelectionToggle 
                    : widget.onTap,
                onLongPress: () {
                  HapticFeedback.mediumImpact();
                  _showQuickActionsMenu(context, isDark);
                },
                borderRadius: BorderRadius.circular(20),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    // ═══════════════════════════════════════════════════════
                    // 1. HEADER: Image + Info + Status
                    // ═══════════════════════════════════════════════════════
                    _buildHeader(isDark, statusInfo, approvalInfo, currencyFormat),

                    // ═══════════════════════════════════════════════════════
                    // 2. STATS ROW (Views, Orders, Revenue)
                    // ═══════════════════════════════════════════════════════
                    _buildStatsRow(isDark, currencyFormat),

                    // ═══════════════════════════════════════════════════════
                    // 3. EXPANDABLE ANALYTICS
                    // ═══════════════════════════════════════════════════════
                    AnimatedCrossFade(
                      firstChild: const SizedBox(height: 0),
                      secondChild: Padding(
                        padding: const EdgeInsets.only(top: 10, left: 14, right: 14),
                        child: _buildExpandedStats(isDark),
                      ),
                      crossFadeState: _isStatsExpanded ? CrossFadeState.showSecond : CrossFadeState.showFirst,
                      duration: const Duration(milliseconds: 200),
                    ),

                    // ═══════════════════════════════════════════════════════
                    // 4. ALERT BANNERS
                    // ═══════════════════════════════════════════════════════
                    if (_showLowStockAlert())
                      _buildAlertBanner(isDark, 'Low stock! Only ${product.stock} units remaining', Colors.orange, Icons.inventory_rounded),
                    
                    if (product.isRejected)
                      _buildAlertBanner(isDark, 'Rejected: ${product.rejectionReason ?? "No reason"}', Colors.red, Icons.warning_rounded),

                    // ═══════════════════════════════════════════════════════
                    // 5. FOOTER ACTIONS
                    // ═══════════════════════════════════════════════════════
                    _buildFooterActions(isDark),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HEADER SECTION
  // ═══════════════════════════════════════════════════════════════════════════

  Widget _buildHeader(bool isDark, _StatusInfo statusInfo, _ApprovalInfo approvalInfo, NumberFormat currencyFormat) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: statusInfo.color.withValues(alpha: 0.06),
        borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Selection Checkbox
          if (widget.showSelectionCheckbox) ...[
            Checkbox(
              value: widget.isSelected,
              onChanged: (_) => widget.onSelectionToggle?.call(),
              activeColor: AppColors.primary,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(4)),
            ),
            const SizedBox(width: 8),
          ],
          
          // Product Image Stack
          _buildImageStack(isDark),
          const SizedBox(width: 12),
          
          // Product Details
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Name + Status
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        product.name,
                        style: TextStyle(
                          color: isDark ? Colors.white : AppColors.textPrimary,
                          fontWeight: FontWeight.w700,
                          fontSize: 15,
                        ),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    const SizedBox(width: 8),
                    _buildStatusBadge(isDark, statusInfo),
                  ],
                ),
                const SizedBox(height: 4),
                
                // Category
                Text(
                  product.categoryId,
                  style: TextStyle(
                    color: isDark ? Colors.white54 : AppColors.textSecondary,
                    fontSize: 12,
                  ),
                ),
                const SizedBox(height: 8),
                
                // Price Row
                Row(
                  children: [
                    Text(
                      currencyFormat.format(product.salePrice),
                      style: TextStyle(
                        color: AppColors.success,
                        fontWeight: FontWeight.bold,
                        fontSize: 16,
                      ),
                    ),
                    if (product.originalPrice != null && product.originalPrice! > product.salePrice) ...[
                      const SizedBox(width: 8),
                      Text(
                        currencyFormat.format(product.originalPrice),
                        style: TextStyle(
                          color: isDark ? Colors.white38 : AppColors.textHint,
                          fontSize: 12,
                          decoration: TextDecoration.lineThrough,
                        ),
                      ),
                      const SizedBox(width: 6),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: AppColors.error.withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text(
                          '-${product.discount}%',
                          style: TextStyle(
                            color: AppColors.error,
                            fontSize: 10,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
                const SizedBox(height: 6),
                
                // Stock + Approval
                Row(
                  children: [
                    Icon(
                      Icons.inventory_2_outlined,
                      size: 14,
                      color: _getStockColor(),
                    ),
                    const SizedBox(width: 4),
                    Text(
                      'Stock: ${product.stock} ${product.unit ?? 'units'}',
                      style: TextStyle(
                        color: _getStockColor(),
                        fontSize: 12,
                        fontWeight: product.stock < 10 ? FontWeight.w600 : FontWeight.normal,
                      ),
                    ),
                    const Spacer(),
                    _buildApprovalBadge(isDark, approvalInfo),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildImageStack(bool isDark) {
    return Stack(
      children: [
        Container(
          width: 80,
          height: 80,
          decoration: BoxDecoration(
            color: isDark ? AppColors.surfaceDarkVariant : AppColors.surfaceVariant,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: isDark ? AppColors.borderDark : AppColors.border),
          ),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(12),
            child: (product.images.isNotEmpty && product.images[0].isNotEmpty)
                ? Image.network(
                    product.images[0],
                    fit: BoxFit.cover,
                    errorBuilder: (_, __, ___) => Icon(
                      Icons.shopping_bag_outlined,
                      color: isDark ? AppColors.textLightHint : AppColors.textHint,
                    ),
                  )
                : Icon(
                    Icons.shopping_bag_outlined,
                    color: isDark ? AppColors.textLightHint : AppColors.textHint,
                  ),
          ),
        ),
        // Out of Stock Overlay
        if (!product.inStock)
          Positioned.fill(
            child: Container(
              decoration: BoxDecoration(
                color: Colors.black.withValues(alpha: 0.6),
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Center(
                child: Text(
                  'OUT OF\nSTOCK',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 9,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ),
          ),
        // Discount Badge
        if (product.discount > 0)
          Positioned(
            top: 4,
            left: 4,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
              decoration: BoxDecoration(
                color: AppColors.error,
                borderRadius: BorderRadius.circular(6),
              ),
              child: Text(
                '-${product.discount}%',
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 9,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
          ),
        // Featured Badge
        if (product.isFeatured)
          Positioned(
            bottom: 4,
            right: 4,
            child: Container(
              padding: const EdgeInsets.all(4),
              decoration: BoxDecoration(
                color: AppColors.favorite,
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.star, size: 10, color: Colors.white),
            ),
          ),
      ],
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STATS ROW
  // ═══════════════════════════════════════════════════════════════════════════

  Widget _buildStatsRow(bool isDark, NumberFormat currencyFormat) {
    return GestureDetector(
      onTap: () {
        HapticFeedback.selectionClick();
        setState(() => _isStatsExpanded = !_isStatsExpanded);
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        child: Row(
          children: [
            _buildStatTile(isDark, Icons.visibility_outlined, _formatCount(product.viewCount), 'Views', Colors.blue),
            const SizedBox(width: 12),
            _buildStatTile(isDark, Icons.shopping_cart_outlined, _formatCount(product.totalOrders), 'Orders', Colors.green),
            const SizedBox(width: 12),
            // ✅ Clickable Revenue Tile with Commission Breakdown
            _buildRevenueTile(isDark),
            const Spacer(),
            AnimatedRotation(
              turns: _isStatsExpanded ? 0.5 : 0,
              duration: const Duration(milliseconds: 200),
              child: Icon(
                Icons.keyboard_arrow_down_rounded,
                color: isDark ? Colors.white54 : AppColors.textSecondary,
                size: 20,
              ),
            ),
          ],
        ),
      ),
    );
  }

  /// Clickable revenue tile that shows commission breakdown
  Widget _buildRevenueTile(bool isDark) {
    const commissionRate = 0.10; // 10% commission
    final grossRevenue = product.totalRevenue / (1 - commissionRate); // Reverse calculate gross
    final commission = grossRevenue * commissionRate;
    
    return GestureDetector(
      onTap: () {
        HapticFeedback.mediumImpact();
        _showRevenueBreakdown(isDark, grossRevenue, commission, product.totalRevenue);
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          color: Colors.purple.withValues(alpha: 0.08),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: Colors.purple.withValues(alpha: 0.2)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.currency_rupee_rounded, size: 14, color: Colors.purple),
            const SizedBox(width: 6),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      _formatRevenue(product.totalRevenue),
                      style: TextStyle(
                        color: isDark ? Colors.white : AppColors.textPrimary,
                        fontWeight: FontWeight.bold,
                        fontSize: 12,
                      ),
                    ),
                    const SizedBox(width: 3),
                    Icon(Icons.info_outline_rounded, size: 10, color: Colors.purple.shade300),
                  ],
                ),
                const Text(
                  'Revenue',
                  style: TextStyle(color: Colors.purple, fontSize: 9),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  /// Shows professional revenue breakdown bottom sheet
  void _showRevenueBreakdown(bool isDark, double gross, double commission, double net) {
    showModalBottomSheet(
      context: context,
      backgroundColor: isDark ? const Color(0xFF1E1E1E) : Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (context) => Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: [Colors.purple, Colors.purple.shade700],
                    ),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(Icons.analytics_rounded, color: Colors.white, size: 22),
                ),
                const SizedBox(width: 14),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Revenue Breakdown',
                      style: TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.bold,
                        color: isDark ? Colors.white : Colors.black87,
                      ),
                    ),
                    Text(
                      product.name,
                      style: TextStyle(
                        fontSize: 12,
                        color: isDark ? Colors.grey[400] : Colors.grey[600],
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ],
            ),
            
            const SizedBox(height: 24),
            
            // Gross Revenue
            _buildBreakdownRow(
              isDark,
              'Gross Revenue',
              '₹${gross.toStringAsFixed(2)}',
              Icons.shopping_bag_rounded,
              Colors.green,
              isPositive: true,
            ),
            
            const SizedBox(height: 12),
            
            // Commission
            _buildBreakdownRow(
              isDark,
              'Platform Commission (10%)',
              '-₹${commission.toStringAsFixed(2)}',
              Icons.percent_rounded,
              const Color(0xFFF59E0B),
              isDeduction: true,
            ),
            
            const SizedBox(height: 16),
            
            // Divider
            Container(
              height: 1,
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [
                    Colors.transparent,
                    isDark ? Colors.grey[700]! : Colors.grey[300]!,
                    Colors.transparent,
                  ],
                ),
              ),
            ),
            
            const SizedBox(height: 16),
            
            // Net Earnings
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [
                    Colors.purple.withValues(alpha: 0.1),
                    Colors.purple.withValues(alpha: 0.05),
                  ],
                ),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: Colors.purple.withValues(alpha: 0.2)),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(
                          color: Colors.purple.withValues(alpha: 0.2),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: const Icon(Icons.account_balance_wallet_rounded, color: Colors.purple, size: 18),
                      ),
                      const SizedBox(width: 12),
                      Text(
                        'Your Earnings',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                          color: isDark ? Colors.white : Colors.black87,
                        ),
                      ),
                    ],
                  ),
                  Text(
                    '₹${net.toStringAsFixed(2)}',
                    style: const TextStyle(
                      fontSize: 22,
                      fontWeight: FontWeight.bold,
                      color: Colors.purple,
                    ),
                  ),
                ],
              ),
            ),
            
            const SizedBox(height: 16),
            
            // Info Note
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: isDark ? Colors.grey[900] : Colors.grey[100],
                borderRadius: BorderRadius.circular(10),
              ),
              child: Row(
                children: [
                  Icon(
                    Icons.info_outline_rounded,
                    size: 16,
                    color: isDark ? Colors.grey[400] : Colors.grey[600],
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      'Commission is calculated on completed orders only. Refunds and RTO are excluded.',
                      style: TextStyle(
                        fontSize: 11,
                        color: isDark ? Colors.grey[400] : Colors.grey[600],
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildBreakdownRow(
    bool isDark,
    String label,
    String value,
    IconData icon,
    Color color, {
    bool isPositive = false,
    bool isDeduction = false,
  }) {
    return Row(
      children: [
        Container(
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(
            color: color.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Icon(icon, color: color, size: 16),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Text(
            label,
            style: TextStyle(
              fontSize: 14,
              color: isDark ? Colors.grey[300] : Colors.grey[700],
            ),
          ),
        ),
        Text(
          value,
          style: TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.bold,
            color: isDeduction 
                ? const Color(0xFFF59E0B) 
                : (isPositive ? Colors.green : (isDark ? Colors.white : Colors.black87)),
          ),
        ),
      ],
    );
  }

  Widget _buildStatTile(bool isDark, IconData icon, String value, String label, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: color),
          const SizedBox(width: 6),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                value,
                style: TextStyle(
                  color: isDark ? Colors.white : AppColors.textPrimary,
                  fontWeight: FontWeight.bold,
                  fontSize: 12,
                ),
              ),
              Text(
                label,
                style: TextStyle(
                  color: color,
                  fontSize: 9,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildExpandedStats(bool isDark) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: isDark ? Colors.white.withValues(alpha: 0.05) : Colors.grey.withValues(alpha: 0.05),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        children: [
          _buildStatRow('Conversion Rate', '5.1%', isDark, isPositive: true),
          _buildStatRow('Avg. Rating', '4.2 ★', isDark),
          _buildStatRow('Return Rate', '2.3%', isDark, isNegative: true),
          _buildStatRow('Last Sale', '2 days ago', isDark),
        ],
      ),
    );
  }

  Widget _buildStatRow(String label, String value, bool isDark, {bool isPositive = false, bool isNegative = false}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: TextStyle(color: isDark ? Colors.white60 : AppColors.textSecondary, fontSize: 12)),
          Text(
            value,
            style: TextStyle(
              color: isPositive ? AppColors.success : (isNegative ? AppColors.error : (isDark ? Colors.white : AppColors.textPrimary)),
              fontSize: 12,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ALERT BANNER
  // ═══════════════════════════════════════════════════════════════════════════

  Widget _buildAlertBanner(bool isDark, String message, Color color, IconData icon) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(6),
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.2),
              shape: BoxShape.circle,
            ),
            child: Icon(icon, size: 16, color: color),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              message,
              style: TextStyle(color: color, fontWeight: FontWeight.w500, fontSize: 11),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
          ),
        ],
      ),
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FOOTER ACTIONS
  // ═══════════════════════════════════════════════════════════════════════════

  Widget _buildFooterActions(bool isDark) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: isDark ? AppColors.backgroundDark.withValues(alpha: 0.5) : AppColors.background.withValues(alpha: 0.5),
        borderRadius: const BorderRadius.vertical(bottom: Radius.circular(20)),
      ),
      child: Row(
        children: [
          // Active/Inactive Toggle
          Transform.scale(
            scale: 0.8,
            child: Switch(
              value: product.isActive,
              onChanged: widget.onToggleActive,
              activeThumbColor: AppColors.success,
              inactiveTrackColor: AppColors.warning.withValues(alpha: 0.5),
              materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
            ),
          ),
          Text(
            product.isActive ? 'Active' : 'Inactive',
            style: TextStyle(
              color: product.isActive ? AppColors.success : Colors.orange,
              fontSize: 11,
              fontWeight: FontWeight.w600,
            ),
          ),
          const Spacer(),
          
          // Edit Button
          _buildIconActionButton(isDark, Icons.edit_outlined, 'Edit', AppColors.info, () {
            widget.onEdit?.call();
          }),
          const SizedBox(width: 8),
          
          // Delete Button
          _buildIconActionButton(isDark, Icons.delete_outline, 'Delete', AppColors.error, () {
            widget.onDelete?.call();
          }),
          const SizedBox(width: 8),
          
          // View Details Button
          _buildActionButton(isDark, Icons.arrow_forward_rounded, 'View', 
              isDark ? AppColors.primaryLight : AppColors.primary, widget.onTap ?? () {}, isPrimary: true),
        ],
      ),
    );
  }

  Widget _buildIconActionButton(bool isDark, IconData icon, String tooltip, Color color, VoidCallback onPressed) {
    return Tooltip(
      message: tooltip,
      child: GestureDetector(
        onTap: () {
          HapticFeedback.lightImpact();
          onPressed();
        },
        child: Container(
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(
            color: color.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(10),
          ),
          child: Icon(icon, size: 18, color: color),
        ),
      ),
    );
  }

  Widget _buildActionButton(bool isDark, IconData icon, String label, Color color, VoidCallback onPressed, {bool isPrimary = false}) {
    return GestureDetector(
      onTap: () {
        HapticFeedback.lightImpact();
        onPressed();
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          color: isPrimary ? color : color.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(10),
          border: isPrimary ? null : Border.all(color: color.withValues(alpha: 0.3)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 14, color: isPrimary ? Colors.white : color),
            const SizedBox(width: 4),
            Text(label, style: TextStyle(color: isPrimary ? Colors.white : color, fontWeight: FontWeight.w600, fontSize: 12)),
          ],
        ),
      ),
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // QUICK ACTIONS MENU
  // ═══════════════════════════════════════════════════════════════════════════

  void _showQuickActionsMenu(BuildContext context, bool isDark) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (context) => Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: isDark ? AppColors.surfaceDark : AppColors.surface,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(width: 40, height: 4, decoration: BoxDecoration(color: Colors.grey.withValues(alpha: 0.3), borderRadius: BorderRadius.circular(2))),
            const SizedBox(height: 20),
            Text('Quick Actions', style: TextStyle(color: isDark ? Colors.white : AppColors.textPrimary, fontSize: 18, fontWeight: FontWeight.w700)),
            const SizedBox(height: 16),
            _buildMenuAction(isDark, Icons.edit_outlined, 'Edit Product', () {
              Navigator.pop(context);
              widget.onEdit?.call();
            }),
            _buildMenuAction(isDark, Icons.copy_rounded, 'Duplicate Product', () {
              Navigator.pop(context);
              // TODO: Implement duplicate
            }),
            _buildMenuAction(isDark, product.isActive ? Icons.visibility_off_outlined : Icons.visibility_outlined, 
                product.isActive ? 'Deactivate' : 'Activate', () {
              Navigator.pop(context);
              widget.onToggleActive(!product.isActive);
            }),
            _buildMenuAction(isDark, Icons.delete_outline, 'Delete Product', () {
              Navigator.pop(context);
              widget.onDelete?.call();
            }, color: AppColors.error),
            const SizedBox(height: 10),
          ],
        ),
      ),
    );
  }

  Widget _buildMenuAction(bool isDark, IconData icon, String label, VoidCallback onTap, {Color? color}) {
    return ListTile(
      leading: Icon(icon, color: color ?? (isDark ? Colors.white54 : AppColors.textSecondary)),
      title: Text(label, style: TextStyle(color: color ?? (isDark ? Colors.white : AppColors.textPrimary), fontWeight: FontWeight.w500)),
      onTap: () {
        HapticFeedback.lightImpact();
        onTap();
      },
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HELPER METHODS
  // ═══════════════════════════════════════════════════════════════════════════

  _StatusInfo _getStatusInfo() {
    if (product.isActive) {
      return _StatusInfo(label: 'Active', color: AppColors.success, icon: Icons.check_circle_rounded);
    } else {
      return _StatusInfo(label: 'Inactive', color: Colors.grey, icon: Icons.cancel_rounded);
    }
  }

  _ApprovalInfo _getApprovalInfo() {
    if (product.isPending) {
      return _ApprovalInfo(label: 'Pending', color: Colors.orange, icon: Icons.hourglass_empty_rounded);
    } else if (product.isApproved) {
      return _ApprovalInfo(label: 'Approved', color: AppColors.success, icon: Icons.verified_rounded);
    } else if (product.isRejected) {
      return _ApprovalInfo(label: 'Rejected', color: AppColors.error, icon: Icons.cancel_rounded);
    }
    return _ApprovalInfo(label: 'Unknown', color: Colors.grey, icon: Icons.help_outline_rounded);
  }

  Color _getStockColor() {
    if (product.stock < 5) return AppColors.error;
    if (product.stock < 10) return AppColors.warning;
    return AppColors.success;
  }

  bool _showLowStockAlert() {
    return product.stock > 0 && product.stock < 10;
  }

  Widget _buildStatusBadge(bool isDark, _StatusInfo statusInfo) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: statusInfo.color.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: statusInfo.color.withValues(alpha: 0.3)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(statusInfo.icon, size: 12, color: statusInfo.color),
          const SizedBox(width: 4),
          Text(statusInfo.label, style: TextStyle(color: statusInfo.color, fontWeight: FontWeight.w600, fontSize: 10)),
        ],
      ),
    );
  }

  Widget _buildApprovalBadge(bool isDark, _ApprovalInfo approvalInfo) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
      decoration: BoxDecoration(
        color: approvalInfo.color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(approvalInfo.icon, size: 10, color: approvalInfo.color),
          const SizedBox(width: 3),
          Text(approvalInfo.label, style: TextStyle(color: approvalInfo.color, fontWeight: FontWeight.w500, fontSize: 9)),
        ],
      ),
    );
  }

  // ============ HELPER: Format count (1000 -> 1K) ============
  String _formatCount(int count) {
    if (count >= 1000000) {
      return '${(count / 1000000).toStringAsFixed(1)}M';
    } else if (count >= 1000) {
      return '${(count / 1000).toStringAsFixed(1)}K';
    }
    return count.toString();
  }

  // ============ HELPER: Format revenue (₹15600 -> 15.6K) ============
  String _formatRevenue(double revenue) {
    if (revenue >= 10000000) {
      return '${(revenue / 10000000).toStringAsFixed(1)}Cr';
    } else if (revenue >= 100000) {
      return '${(revenue / 100000).toStringAsFixed(1)}L';
    } else if (revenue >= 1000) {
      return '${(revenue / 1000).toStringAsFixed(1)}K';
    }
    return revenue.toStringAsFixed(0);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPER CLASSES
// ═══════════════════════════════════════════════════════════════════════════

class _StatusInfo {
  final String label;
  final Color color;
  final IconData icon;

  _StatusInfo({required this.label, required this.color, required this.icon});
}

class _ApprovalInfo {
  final String label;
  final Color color;
  final IconData icon;

  _ApprovalInfo({required this.label, required this.color, required this.icon});
}