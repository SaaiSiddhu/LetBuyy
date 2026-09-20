// lib/screens/orders/widgets/courier_assignment_sheet.dart
// Courier Assignment Bottom Sheet for Shipping

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:letbuyy_models/letbuyy_models.dart';

/// Courier information
class CourierInfo {
  final String id;
  final String name;
  final String? logoUrl;
  final double baseRate;
  final String deliveryTime;
  final bool isAvailable;

  const CourierInfo({
    required this.id,
    required this.name,
    this.logoUrl,
    required this.baseRate,
    required this.deliveryTime,
    this.isAvailable = true,
  });
}

/// Available couriers
class AvailableCouriers {
  static const List<CourierInfo> all = [
    CourierInfo(
      id: 'shiprocket',
      name: 'Shiprocket',
      baseRate: 45,
      deliveryTime: '3-5 days',
    ),
    CourierInfo(
      id: 'delhivery',
      name: 'Delhivery',
      baseRate: 55,
      deliveryTime: '2-4 days',
    ),
    CourierInfo(
      id: 'bluedart',
      name: 'BlueDart',
      baseRate: 65,
      deliveryTime: '2-3 days',
    ),
    CourierInfo(
      id: 'dtdc',
      name: 'DTDC',
      baseRate: 50,
      deliveryTime: '3-5 days',
    ),
    CourierInfo(
      id: 'self',
      name: 'Self Delivery',
      baseRate: 0,
      deliveryTime: 'As per your schedule',
    ),
  ];
}

/// Courier Assignment Sheet
class CourierAssignmentSheet extends StatefulWidget {
  final OrderModel order;
  final String? pickupAddress;
  final Function(String courierId, String awbNumber) onAssigned;

  const CourierAssignmentSheet({
    super.key,
    required this.order,
    this.pickupAddress,
    required this.onAssigned,
  });

  static Future<void> show(
    BuildContext context, {
    required OrderModel order,
    String? pickupAddress,
    required Function(String courierId, String awbNumber) onAssigned,
  }) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => CourierAssignmentSheet(
        order: order,
        pickupAddress: pickupAddress,
        onAssigned: onAssigned,
      ),
    );
  }

  @override
  State<CourierAssignmentSheet> createState() => _CourierAssignmentSheetState();
}

class _CourierAssignmentSheetState extends State<CourierAssignmentSheet> {
  String? _selectedCourierId;
  bool _isGeneratingAWB = false;
  String? _generatedAWB;
  int _selectedPickupIndex = 0;

  // Mock pickup addresses
  final List<String> _pickupAddresses = [
    'Warehouse A - 123 Main Street, Chennai 600001',
    'Store Location - 456 Park Avenue, Chennai 600028',
  ];

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final bottomPadding = MediaQuery.viewInsetsOf(context).bottom;

    return Container(
      constraints: BoxConstraints(
        maxHeight: MediaQuery.of(context).size.height * 0.85,
      ),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1A1A2E) : Colors.white,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Handle
          Container(
            margin: const EdgeInsets.only(top: 12),
            width: 40,
            height: 4,
            decoration: BoxDecoration(
              color: Colors.grey.withValues(alpha: 0.3),
              borderRadius: BorderRadius.circular(2),
            ),
          ),

          // Header
          Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: Colors.purple.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(Icons.local_shipping_rounded, color: Colors.purple),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Ship Order',
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                          color: isDark ? Colors.white : Colors.black87,
                        ),
                      ),
                      Text(
                        '#${widget.order.orderNumber ?? widget.order.id.substring(0, 8).toUpperCase()}',
                        style: TextStyle(
                          fontSize: 13,
                          color: Colors.grey[500],
                        ),
                      ),
                    ],
                  ),
                ),
                IconButton(
                  onPressed: () => Navigator.pop(context),
                  icon: Icon(
                    Icons.close_rounded,
                    color: isDark ? Colors.grey[400] : Colors.grey[600],
                  ),
                ),
              ],
            ),
          ),

          const Divider(height: 1),

          // Content
          Flexible(
            child: SingleChildScrollView(
              padding: EdgeInsets.fromLTRB(16, 16, 16, bottomPadding + 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Delivery Address Card
                  _buildDeliveryAddressCard(isDark),

                  const SizedBox(height: 20),

                  // Package Info
                  _buildPackageInfo(isDark),

                  const SizedBox(height: 20),

                  // Pickup Address Selection
                  _buildPickupAddressSection(isDark),

                  const SizedBox(height: 20),

                  // Courier Selection
                  _buildCourierSelection(isDark),

                  const SizedBox(height: 24),

                  // AWB Section
                  if (_selectedCourierId != null) _buildAWBSection(isDark),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDeliveryAddressCard(bool isDark) {
    final address = widget.order.deliveryAddress;
    
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: isDark ? Colors.white.withValues(alpha: 0.05) : Colors.grey[50],
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: isDark ? Colors.white.withValues(alpha: 0.1) : Colors.grey.withValues(alpha: 0.2),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.location_on_rounded, size: 18, color: Colors.red[400]),
              const SizedBox(width: 8),
              Text(
                'Deliver To',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: Colors.grey[500],
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            address.name ?? 'Customer',
            style: TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w600,
              color: isDark ? Colors.white : Colors.black87,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            '${address.addressLine1 ?? ''}, ${address.city ?? ''} - ${address.zipcode ?? ''}',
            style: TextStyle(
              fontSize: 13,
              color: Colors.grey[600],
            ),
          ),
          const SizedBox(height: 6),
          Row(
            children: [
              Icon(Icons.phone_rounded, size: 14, color: Colors.grey[500]),
              const SizedBox(width: 6),
              Text(
                address.phone ?? '',
                style: TextStyle(fontSize: 13, color: Colors.grey[600]),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildPackageInfo(bool isDark) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _buildSectionHeader('Package Details', Icons.inventory_2_rounded, isDark),
        const SizedBox(height: 12),
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: isDark ? Colors.white.withValues(alpha: 0.05) : Colors.grey[50],
            borderRadius: BorderRadius.circular(12),
          ),
          child: Row(
            children: [
              _buildPackageInfoItem('Weight', '0.5 kg', Icons.scale_rounded, isDark),
              Container(width: 1, height: 40, color: Colors.grey.withValues(alpha: 0.3)),
              _buildPackageInfoItem('Items', '${widget.order.items.length}', Icons.shopping_bag_rounded, isDark),
              Container(width: 1, height: 40, color: Colors.grey.withValues(alpha: 0.3)),
              _buildPackageInfoItem('Value', '₹${widget.order.total.toInt()}', Icons.currency_rupee_rounded, isDark),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildPackageInfoItem(String label, String value, IconData icon, bool isDark) {
    return Expanded(
      child: Column(
        children: [
          Icon(icon, size: 20, color: AppColors.primary),
          const SizedBox(height: 6),
          Text(
            value,
            style: TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.bold,
              color: isDark ? Colors.white : Colors.black87,
            ),
          ),
          Text(
            label,
            style: TextStyle(
              fontSize: 11,
              color: Colors.grey[500],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPickupAddressSection(bool isDark) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _buildSectionHeader('Pickup Address', Icons.store_rounded, isDark),
        const SizedBox(height: 12),
        ...List.generate(_pickupAddresses.length, (index) {
          final isSelected = _selectedPickupIndex == index;
          return GestureDetector(
            onTap: () {
              HapticFeedback.selectionClick();
              setState(() => _selectedPickupIndex = index);
            },
            child: Container(
              margin: const EdgeInsets.only(bottom: 8),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: isSelected
                    ? AppColors.primary.withValues(alpha: 0.1)
                    : (isDark ? Colors.white.withValues(alpha: 0.03) : Colors.grey[50]),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: isSelected ? AppColors.primary : Colors.transparent,
                  width: 1.5,
                ),
              ),
              child: Row(
                children: [
                  Icon(
                    isSelected ? Icons.radio_button_checked : Icons.radio_button_off,
                    color: isSelected ? AppColors.primary : Colors.grey,
                    size: 20,
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      _pickupAddresses[index],
                      style: TextStyle(
                        fontSize: 13,
                        color: isDark ? Colors.white : Colors.black87,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          );
        }),
      ],
    );
  }

  Widget _buildCourierSelection(bool isDark) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _buildSectionHeader('Select Courier', Icons.local_shipping_rounded, isDark),
        const SizedBox(height: 12),
        ...AvailableCouriers.all.map((courier) {
          final isSelected = _selectedCourierId == courier.id;
          return GestureDetector(
            onTap: courier.isAvailable
                ? () {
                    HapticFeedback.selectionClick();
                    setState(() {
                      _selectedCourierId = courier.id;
                      _generatedAWB = null;
                    });
                  }
                : null,
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              margin: const EdgeInsets.only(bottom: 10),
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: isSelected
                    ? Colors.purple.withValues(alpha: 0.1)
                    : (isDark ? Colors.white.withValues(alpha: 0.03) : Colors.grey[50]),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(
                  color: isSelected ? Colors.purple : Colors.transparent,
                  width: 2,
                ),
              ),
              child: Row(
                children: [
                  Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      color: isDark ? Colors.white.withValues(alpha: 0.1) : Colors.grey[100],
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Icon(
                      courier.id == 'self' ? Icons.person_rounded : Icons.local_shipping_rounded,
                      color: isSelected ? Colors.purple : Colors.grey[600],
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          courier.name,
                          style: TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w600,
                            color: isDark ? Colors.white : Colors.black87,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          courier.deliveryTime,
                          style: TextStyle(
                            fontSize: 12,
                            color: Colors.grey[500],
                          ),
                        ),
                      ],
                    ),
                  ),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text(
                        courier.baseRate > 0 ? '₹${courier.baseRate.toInt()}' : 'Free',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                          color: courier.baseRate > 0 ? Colors.purple : Colors.green,
                        ),
                      ),
                      Text(
                        'est. cost',
                        style: TextStyle(
                          fontSize: 10,
                          color: Colors.grey[500],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(width: 8),
                  Icon(
                    isSelected ? Icons.check_circle_rounded : Icons.circle_outlined,
                    color: isSelected ? Colors.purple : Colors.grey,
                    size: 22,
                  ),
                ],
              ),
            ),
          );
        }),
      ],
    );
  }

  Widget _buildAWBSection(bool isDark) {
    if (_generatedAWB != null) {
      return _buildAWBSuccess(isDark);
    }

    return Column(
      children: [
        const Divider(height: 32),
        SizedBox(
          width: double.infinity,
          child: ElevatedButton(
            onPressed: _isGeneratingAWB ? null : _generateAWB,
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.purple,
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(vertical: 16),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(14),
              ),
            ),
            child: _isGeneratingAWB
                ? const SizedBox(
                    width: 24,
                    height: 24,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: Colors.white,
                    ),
                  )
                : const Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.qr_code_rounded, size: 20),
                      SizedBox(width: 10),
                      Text(
                        'Generate AWB & Ship',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ],
                  ),
          ),
        ),
      ],
    );
  }

  Widget _buildAWBSuccess(bool isDark) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.green.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Colors.green.withValues(alpha: 0.3)),
      ),
      child: Column(
        children: [
          const Icon(Icons.check_circle_rounded, color: Colors.green, size: 48),
          const SizedBox(height: 12),
          Text(
            'AWB Generated Successfully!',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.bold,
              color: isDark ? Colors.white : Colors.black87,
            ),
          ),
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            decoration: BoxDecoration(
              color: isDark ? Colors.black26 : Colors.white,
              borderRadius: BorderRadius.circular(8),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  _generatedAWB!,
                  style: const TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                    fontFamily: 'monospace',
                    letterSpacing: 1,
                  ),
                ),
                const SizedBox(width: 12),
                IconButton(
                  onPressed: () {
                    Clipboard.setData(ClipboardData(text: _generatedAWB!));
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('AWB copied to clipboard')),
                    );
                  },
                  icon: const Icon(Icons.copy_rounded, size: 20),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: () {
                widget.onAssigned(_selectedCourierId!, _generatedAWB!);
                Navigator.pop(context);
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.green,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
              child: const Text(
                'Done - Order Shipped',
                style: TextStyle(fontWeight: FontWeight.bold),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSectionHeader(String title, IconData icon, bool isDark) {
    return Row(
      children: [
        Icon(icon, size: 18, color: AppColors.primary),
        const SizedBox(width: 8),
        Text(
          title,
          style: TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w600,
            color: isDark ? Colors.white : Colors.black87,
          ),
        ),
      ],
    );
  }

  void _generateAWB() async {
    if (_selectedCourierId == null) return;

    setState(() => _isGeneratingAWB = true);

    // Simulate AWB generation
    await Future.delayed(const Duration(seconds: 2));

    // Generate mock AWB
    final courier = _selectedCourierId!.toUpperCase();
    final random = DateTime.now().millisecondsSinceEpoch.toString().substring(7);
    final awb = '$courier$random';

    if (mounted) {
      setState(() {
        _isGeneratingAWB = false;
        _generatedAWB = awb;
      });
      HapticFeedback.heavyImpact();
    }
  }
}
