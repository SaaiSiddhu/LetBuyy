import 'package:flutter/material.dart'; // ✅ Restored
import 'package:letbuyy_marketplace_services/letbuyy_marketplace_services.dart'; // ✅ Added
import 'package:letbuyy_marketplace_ui_kit/letbuyy_marketplace_ui_kit.dart';
import 'package:provider/provider.dart'; // ✅ Added

class TrackingMap extends StatelessWidget {
  final String address;
  final String? city;
  final String? state;
  final String? zipCode;

  const TrackingMap({
    super.key,
    required this.address,
    this.city,
    this.state,
    this.zipCode,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = context.watch<ThemeProvider>().isDarkMode;
    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: isDark ? AppColors.borderDark : AppColors.border,
          width: 1,
        ),
        boxShadow: [
          BoxShadow(
            color: isDark ? AppColors.shadowDark : AppColors.shadowLight,
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(12),
        child: Column(
          children: [
            // Map placeholder
            Container(
              height: 250,
              color: isDark ? AppColors.surfaceDarkVariant : AppColors.surfaceVariant,
              child: Stack(
                alignment: Alignment.center,
                children: [
                  Icon(
                    Icons.map_rounded,
                    size: 100,
                    color: isDark ? AppColors.textLightHint : AppColors.textHint,
                  ),
                  Positioned(
                    top: 20,
                    right: 20,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 8,
                      ),
                      decoration: BoxDecoration(
                        color: isDark ? AppColors.surfaceDark : AppColors.surface,
                        borderRadius: BorderRadius.circular(8),
                        boxShadow: [
                          BoxShadow(
                            color: isDark ? AppColors.shadowDark : AppColors.shadowLight,
                            blurRadius: 8,
                          ),
                        ],
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            Icons.my_location_rounded,
                            size: 16,
                            color: AppColors.success,
                          ),
                          const SizedBox(width: 6),
                          Text(
                            'Live Tracking',
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w800,
                              color: AppColors.success,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),

            // Address info
            Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Icon(
                        Icons.location_on_rounded,
                        size: 16,
                        color: AppColors.success,
                      ),
                      const SizedBox(width: 8),
                      Text(
                        'Delivery Address',
                        style: AppTextStyles.bodyMedium.copyWith(
                          fontWeight: FontWeight.w800,
                          fontSize: 13,
                          color: isDark ? AppColors.textLight : AppColors.textPrimary,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Text(
                    address,
                    style: TextStyle(
                      fontSize: 12,
                      color: isDark ? AppColors.textLightSecondary : AppColors.textSecondary,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  if (city != null || state != null || zipCode != null)
                    Padding(
                      padding: const EdgeInsets.only(top: 4),
                      child: Text(
                        [city, state, zipCode]
                            .where((e) => e != null)
                            .join(', '),
                        style: TextStyle(
                          fontSize: 11,
                          color: isDark ? AppColors.textLightHint : AppColors.textHint,
                          fontWeight: FontWeight.w500,
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
}
