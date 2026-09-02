// lib/screens/shop/widgets/offers_section.dart
// Amazon/Flipkart-style offers and deals section

import 'package:flutter/material.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';

class OffersSectionWidget extends StatelessWidget {
  final bool isDark;
  final double price;
  final double? originalPrice;
  final int discount;

  const OffersSectionWidget({
    super.key,
    required this.isDark,
    required this.price,
    this.originalPrice,
    required this.discount,
  });

  @override
  Widget build(BuildContext context) {
    final accentColor = isDark ? AppColors.primaryLight : AppColors.primary;
    
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1A1A1A) : Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isDark ? Colors.grey[800]! : Colors.grey[200]!,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: const Color(0xFFFF6B35).withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Icon(
                  Icons.local_offer_rounded,
                  color: Color(0xFFFF6B35),
                  size: 18,
                ),
              ),
              const SizedBox(width: 12),
              Text(
                'Available Offers',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                  color: isDark ? Colors.white : Colors.black87,
                ),
              ),
            ],
          ),
          
          const SizedBox(height: 16),
          
          // Offer Items
          _buildOfferItem(
            icon: Icons.account_balance_rounded,
            title: 'Bank Offer',
            description: '10% Instant Discount on HDFC Bank Credit Cards, up to ₹1000',
            color: const Color(0xFF1976D2),
          ),
          
          const SizedBox(height: 12),
          
          _buildOfferItem(
            icon: Icons.credit_card_rounded,
            title: 'EMI Available',
            description: 'No Cost EMI starting from ₹${(price / 3).toStringAsFixed(0)}/month',
            color: const Color(0xFF7B1FA2),
          ),
          
          if (discount >= 10) ...[
            const SizedBox(height: 12),
            _buildOfferItem(
              icon: Icons.savings_rounded,
              title: 'Special Price',
              description: 'Get extra $discount% off on this item (price inclusive)',
              color: const Color(0xFF388E3C),
            ),
          ],
          
          const SizedBox(height: 12),
          
          _buildOfferItem(
            icon: Icons.card_giftcard_rounded,
            title: 'Partner Offer',
            description: 'Buy 2 Get 5% off on this product',
            color: const Color(0xFFE64A19),
          ),
          
          const SizedBox(height: 16),
          
          // View More
          Center(
            child: TextButton(
              onPressed: () {},
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    'View all offers',
                    style: TextStyle(
                      color: accentColor,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(width: 4),
                  Icon(
                    Icons.arrow_forward_ios_rounded,
                    size: 14,
                    color: accentColor,
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildOfferItem({
    required IconData icon,
    required String title,
    required String description,
    required Color color,
  }) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(
          icon,
          color: color,
          size: 18,
        ),
        const SizedBox(width: 12),
        Expanded(
          child: RichText(
            text: TextSpan(
              children: [
                TextSpan(
                  text: '$title: ',
                  style: TextStyle(
                    fontWeight: FontWeight.w600,
                    color: isDark ? Colors.white : Colors.black87,
                    fontSize: 13,
                  ),
                ),
                TextSpan(
                  text: description,
                  style: TextStyle(
                    color: isDark ? Colors.grey[400] : Colors.grey[700],
                    fontSize: 13,
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}
