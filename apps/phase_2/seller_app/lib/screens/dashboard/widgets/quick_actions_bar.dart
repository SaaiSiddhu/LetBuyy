// lib/screens/dashboard/widgets/quick_actions_bar.dart
// ⚡ PREMIUM QUICK ACTIONS BAR
// ✨ Professional Glassmorphic Layout

import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';

enum QuickAction { addProduct, manageInventory, viewOrders, viewReturns, createDiscount, payments, analytics }

class QuickActionsBar extends StatelessWidget {
  final Function(QuickAction) onActionTap;

  const QuickActionsBar({super.key, required this.onActionTap});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return ClipRRect(
      borderRadius: BorderRadius.circular(20),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
        child: Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: (isDark ? Colors.white : Colors.black).withValues(alpha: 0.05),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: (isDark ? Colors.white : Colors.black).withValues(alpha: 0.1)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Quick Actions',
                style: TextStyle(
                  color: isDark ? Colors.white : const Color(0xFF111827),
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 16),
              
              // Horizontal Scroll
              SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                physics: const BouncingScrollPhysics(),
                child: Row(
                  children: [
                    _buildAction(QuickAction.addProduct, 'Add Product', Icons.add_box_rounded, const Color(0xFF3B82F6), isDark, 0),
                    _buildAction(QuickAction.manageInventory, 'Inventory', Icons.inventory_2_rounded, const Color(0xFF10B981), isDark, 50),
                    _buildAction(QuickAction.viewOrders, 'Orders', Icons.shopping_bag_rounded, const Color(0xFF8B5CF6), isDark, 100),
                    _buildAction(QuickAction.viewReturns, 'Returns', Icons.assignment_return_rounded, const Color(0xFFEF4444), isDark, 150),
                    _buildAction(QuickAction.createDiscount, 'Coupons', Icons.local_offer_rounded, const Color(0xFFF59E0B), isDark, 200),
                    _buildAction(QuickAction.payments, 'Wallet', Icons.wallet_rounded, const Color(0xFF06B6D4), isDark, 250),
                    _buildAction(QuickAction.analytics, 'Analytics', Icons.analytics_rounded, const Color(0xFFEC4899), isDark, 300),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildAction(QuickAction action, String label, IconData icon, Color color, bool isDark, int delay) {
    return Padding(
      padding: const EdgeInsets.only(right: 12),
      child: GestureDetector(
        onTap: () => onActionTap(action),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          decoration: BoxDecoration(
            color: color.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: color.withValues(alpha: 0.2)),
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                color.withValues(alpha: 0.15),
                color.withValues(alpha: 0.05),
              ],
            ),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, color: color, size: 18),
              const SizedBox(width: 8),
              Text(
                label,
                style: TextStyle(
                  color: isDark ? Colors.white : const Color(0xFF111827),
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
        ),
      ),
    ).animate().fadeIn(delay: delay.ms).slideX(begin: 0.1, end: 0, curve: Curves.easeOut);
  }
}
