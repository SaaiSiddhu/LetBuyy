// lib/screens/orders/widgets/order_ship_flow.dart
// 🚚 PROFESSIONAL SHIPPING WORKFLOW - Amazon FBA Style
// ✨ Courier selection, tracking, dispatch confirmation

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:letbuyy_models/letbuyy_models.dart';
import 'package:letbuyy_services/letbuyy_services.dart';

class OrderShipFlow extends StatefulWidget {
  final OrderModel order;
  final VoidCallback? onComplete;

  const OrderShipFlow({
    super.key,
    required this.order,
    this.onComplete,
  });

  @override
  State<OrderShipFlow> createState() => _OrderShipFlowState();
}

class _OrderShipFlowState extends State<OrderShipFlow> {
  final FirebaseFirestore _firestore = FirebaseFirestore.instance;
  
  int _currentStep = 0; // 0: Courier, 1: Tracking, 2: Confirm, 3: Complete
  bool _isSubmitting = false;
  
  // Courier selection
  String _selectedCourier = '';
  final List<Map<String, dynamic>> _couriers = [
    {'id': 'delhivery', 'name': 'Delhivery', 'icon': '📦', 'eta': '3-5 days', 'color': const Color(0xFF3B82F6)},
    {'id': 'bluedart', 'name': 'Blue Dart', 'icon': '🔵', 'eta': '2-4 days', 'color': const Color(0xFF2563EB)},
    {'id': 'dtdc', 'name': 'DTDC', 'icon': '🟠', 'eta': '4-6 days', 'color': const Color(0xFFF59E0B)},
    {'id': 'ecom', 'name': 'Ecom Express', 'icon': '🟢', 'eta': '3-5 days', 'color': const Color(0xFF10B981)},
    {'id': 'xpressbees', 'name': 'XpressBees', 'icon': '🐝', 'eta': '3-5 days', 'color': const Color(0xFFFBBF24)},
    {'id': 'self', 'name': 'Self Delivery', 'icon': '🏃', 'eta': 'Custom', 'color': const Color(0xFF8B5CF6)},
  ];
  
  // Tracking info
  final TextEditingController _trackingController = TextEditingController();
  final TextEditingController _awbController = TextEditingController();
  DateTime? _expectedDelivery;

  @override
  void dispose() {
    _trackingController.dispose();
    _awbController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    
    return Container(
      height: MediaQuery.of(context).size.height * 0.85,
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1E293B) : Colors.white,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: Column(
        children: [
          _buildHeader(isDark),
          _buildProgressSteps(isDark),
          Expanded(child: _buildStepContent(isDark)),
          _buildFooter(isDark),
        ],
      ),
    );
  }

  Widget _buildHeader(bool isDark) {
    return Container(
      padding: const EdgeInsets.fromLTRB(20, 12, 12, 12),
      decoration: BoxDecoration(
        border: Border(
          bottom: BorderSide(color: isDark ? Colors.white.withValues(alpha: 0.1) : Colors.grey.withValues(alpha: 0.1)),
        ),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: const Color(0xFF8B5CF6).withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(12),
            ),
            child: const Icon(Icons.local_shipping_rounded, color: Color(0xFF8B5CF6), size: 22),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Ship Order #${widget.order.orderNumber}',
                  style: TextStyle(
                    color: isDark ? Colors.white : const Color(0xFF111827),
                    fontSize: 17,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                Text(
                  widget.order.deliveryAddress.city ?? 'Delivery Address',
                  style: TextStyle(color: isDark ? Colors.grey[400] : Colors.grey[600], fontSize: 13),
                ),
              ],
            ),
          ),
          IconButton(
            onPressed: () => Navigator.pop(context),
            icon: Icon(Icons.close_rounded, color: isDark ? Colors.grey[400] : Colors.grey[600]),
          ),
        ],
      ),
    );
  }

  Widget _buildProgressSteps(bool isDark) {
    final steps = ['Courier', 'Tracking', 'Confirm', 'Done'];
    
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
      child: Row(
        children: List.generate(steps.length, (index) {
          final isActive = index == _currentStep;
          final isComplete = index < _currentStep;
          
          return Expanded(
            child: Row(
              children: [
                Container(
                  width: 28,
                  height: 28,
                  decoration: BoxDecoration(
                    color: isComplete 
                        ? const Color(0xFF10B981) 
                        : isActive 
                            ? const Color(0xFF8B5CF6) 
                            : (isDark ? Colors.grey[700] : Colors.grey[300]),
                    shape: BoxShape.circle,
                  ),
                  child: Center(
                    child: isComplete
                        ? const Icon(Icons.check_rounded, color: Colors.white, size: 16)
                        : Text(
                            '${index + 1}',
                            style: TextStyle(
                              color: isActive ? Colors.white : (isDark ? Colors.grey[400] : Colors.grey[600]),
                              fontSize: 12,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                  ),
                ),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    steps[index],
                    style: TextStyle(
                      color: isActive || isComplete 
                          ? (isDark ? Colors.white : const Color(0xFF111827))
                          : (isDark ? Colors.grey[500] : Colors.grey[500]),
                      fontSize: 11,
                      fontWeight: isActive ? FontWeight.w700 : FontWeight.w500,
                    ),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                if (index < steps.length - 1)
                  Container(width: 12, height: 2, color: isComplete ? const Color(0xFF10B981) : (isDark ? Colors.grey[700] : Colors.grey[300])),
              ],
            ),
          );
        }),
      ),
    );
  }

  Widget _buildStepContent(bool isDark) {
    switch (_currentStep) {
      case 0: return _buildCourierStep(isDark);
      case 1: return _buildTrackingStep(isDark);
      case 2: return _buildConfirmStep(isDark);
      case 3: return _buildCompleteStep(isDark);
      default: return const SizedBox.shrink();
    }
  }

  // Step 1: Courier Selection
  Widget _buildCourierStep(bool isDark) {
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        Text(
          'Select Courier Partner',
          style: TextStyle(
            color: isDark ? Colors.white : const Color(0xFF111827),
            fontSize: 16,
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: 16),
        
        ...List.generate(_couriers.length, (index) {
          final courier = _couriers[index];
          final isSelected = _selectedCourier == courier['id'];
          
          return Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: GestureDetector(
              onTap: () {
                HapticFeedback.lightImpact();
                setState(() => _selectedCourier = courier['id'] as String);
              },
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: isSelected 
                      ? (courier['color'] as Color).withValues(alpha: 0.1)
                      : (isDark ? Colors.grey[800]!.withValues(alpha: 0.5) : Colors.grey[50]),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(
                    color: isSelected ? courier['color'] as Color : Colors.transparent,
                    width: 2,
                  ),
                ),
                child: Row(
                  children: [
                    Text(courier['icon'] as String, style: const TextStyle(fontSize: 24)),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            courier['name'] as String,
                            style: TextStyle(
                              color: isDark ? Colors.white : const Color(0xFF111827),
                              fontSize: 15,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          Text(
                            'ETA: ${courier['eta']}',
                            style: TextStyle(color: Colors.grey[500], fontSize: 12),
                          ),
                        ],
                      ),
                    ),
                    if (isSelected)
                      Icon(Icons.check_circle_rounded, color: courier['color'] as Color),
                  ],
                ),
              ),
            ),
          ).animate().fadeIn(delay: (index * 50).ms);
        }),
      ],
    );
  }

  // Step 2: Tracking Details
  Widget _buildTrackingStep(bool isDark) {
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        Text(
          'Enter Tracking Details',
          style: TextStyle(
            color: isDark ? Colors.white : const Color(0xFF111827),
            fontSize: 16,
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: 20),
        
        // AWB Number
        _buildInputField(
          controller: _awbController,
          label: 'AWB Number *',
          hint: 'Enter Air Waybill number',
          icon: Icons.qr_code_rounded,
          isDark: isDark,
        ),
        const SizedBox(height: 16),
        
        // Tracking URL
        _buildInputField(
          controller: _trackingController,
          label: 'Tracking URL (Optional)',
          hint: 'https://tracking.courier.com/...',
          icon: Icons.link_rounded,
          isDark: isDark,
        ),
        const SizedBox(height: 16),
        
        // Expected Delivery
        Text(
          'Expected Delivery',
          style: TextStyle(
            color: isDark ? Colors.grey[300] : Colors.grey[700],
            fontSize: 14,
            fontWeight: FontWeight.w600,
          ),
        ),
        const SizedBox(height: 8),
        GestureDetector(
          onTap: () => _selectDate(context),
          child: Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: isDark ? Colors.grey[800]!.withValues(alpha: 0.5) : Colors.grey[50],
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: isDark ? Colors.grey[700]! : Colors.grey[300]!),
            ),
            child: Row(
              children: [
                Icon(Icons.calendar_today_rounded, color: Colors.grey[500], size: 20),
                const SizedBox(width: 12),
                Text(
                  _expectedDelivery != null 
                      ? '${_expectedDelivery!.day}/${_expectedDelivery!.month}/${_expectedDelivery!.year}'
                      : 'Select date',
                  style: TextStyle(
                    color: _expectedDelivery != null 
                        ? (isDark ? Colors.white : Colors.black)
                        : Colors.grey[500],
                    fontSize: 14,
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildInputField({
    required TextEditingController controller,
    required String label,
    required String hint,
    required IconData icon,
    required bool isDark,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: TextStyle(
            color: isDark ? Colors.grey[300] : Colors.grey[700],
            fontSize: 14,
            fontWeight: FontWeight.w600,
          ),
        ),
        const SizedBox(height: 8),
        TextField(
          controller: controller,
          style: TextStyle(color: isDark ? Colors.white : Colors.black),
          decoration: InputDecoration(
            hintText: hint,
            hintStyle: TextStyle(color: Colors.grey[500]),
            prefixIcon: Icon(icon, color: Colors.grey[500]),
            filled: true,
            fillColor: isDark ? Colors.grey[800]!.withValues(alpha: 0.5) : Colors.grey[50],
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide(color: isDark ? Colors.grey[700]! : Colors.grey[300]!),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide(color: isDark ? Colors.grey[700]! : Colors.grey[300]!),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(color: Color(0xFF8B5CF6), width: 2),
            ),
          ),
        ),
      ],
    );
  }

  Future<void> _selectDate(BuildContext context) async {
    final picked = await showDatePicker(
      context: context,
      initialDate: DateTime.now().add(const Duration(days: 3)),
      firstDate: DateTime.now(),
      lastDate: DateTime.now().add(const Duration(days: 30)),
    );
    if (picked != null) {
      setState(() => _expectedDelivery = picked);
    }
  }

  // Step 3: Confirmation
  Widget _buildConfirmStep(bool isDark) {
    final selectedCourier = _couriers.firstWhere((c) => c['id'] == _selectedCourier, orElse: () => {});
    
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        Text(
          'Confirm Shipment Details',
          style: TextStyle(
            color: isDark ? Colors.white : const Color(0xFF111827),
            fontSize: 16,
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: 20),
        
        // Summary Card
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: isDark ? Colors.grey[800]!.withValues(alpha: 0.5) : Colors.grey[50],
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: isDark ? Colors.white.withValues(alpha: 0.1) : Colors.grey.withValues(alpha: 0.1)),
          ),
          child: Column(
            children: [
              _buildConfirmRow('Courier', selectedCourier['name'] ?? 'Unknown', isDark),
              const Divider(height: 20),
              _buildConfirmRow('AWB Number', _awbController.text.isNotEmpty ? _awbController.text : 'Not provided', isDark),
              const Divider(height: 20),
              _buildConfirmRow('Destination', widget.order.deliveryAddress.city ?? 'Unknown', isDark),
              if (_expectedDelivery != null) ...[
                const Divider(height: 20),
                _buildConfirmRow('Expected Delivery', '${_expectedDelivery!.day}/${_expectedDelivery!.month}/${_expectedDelivery!.year}', isDark),
              ],
            ],
          ),
        ),
        
        const SizedBox(height: 24),
        
        // Warning
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: const Color(0xFFF59E0B).withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: const Color(0xFFF59E0B).withValues(alpha: 0.3)),
          ),
          child: Row(
            children: [
              const Icon(Icons.info_outline_rounded, color: Color(0xFFF59E0B), size: 20),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  'Customer will receive tracking notification once shipped.',
                  style: TextStyle(color: isDark ? Colors.white : const Color(0xFF111827), fontSize: 13),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildConfirmRow(String label, String value, bool isDark) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label, style: TextStyle(color: Colors.grey[500], fontSize: 13)),
        Text(
          value,
          style: TextStyle(
            color: isDark ? Colors.white : const Color(0xFF111827),
            fontSize: 14,
            fontWeight: FontWeight.w600,
          ),
        ),
      ],
    );
  }

  // Step 4: Complete
  Widget _buildCompleteStep(bool isDark) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: const Color(0xFF10B981).withValues(alpha: 0.1),
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.local_shipping_rounded, color: Color(0xFF10B981), size: 60),
          ).animate().scale(),
          const SizedBox(height: 24),
          Text(
            'Order Shipped! 🎉',
            style: TextStyle(
              color: isDark ? Colors.white : const Color(0xFF111827),
              fontSize: 24,
              fontWeight: FontWeight.w800,
            ),
          ).animate().fadeIn(delay: 200.ms),
          const SizedBox(height: 8),
          if (_awbController.text.isNotEmpty)
            Text(
              'AWB: ${_awbController.text}',
              style: TextStyle(color: Colors.grey[500], fontSize: 14),
            ).animate().fadeIn(delay: 300.ms),
        ],
      ),
    );
  }

  Widget _buildFooter(bool isDark) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1E293B) : Colors.white,
        border: Border(
          top: BorderSide(color: isDark ? Colors.white.withValues(alpha: 0.1) : Colors.grey.withValues(alpha: 0.1)),
        ),
      ),
      child: Row(
        children: [
          if (_currentStep > 0 && _currentStep < 3)
            Expanded(
              child: OutlinedButton(
                onPressed: () => setState(() => _currentStep--),
                style: OutlinedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  side: BorderSide(color: isDark ? Colors.grey[600]! : Colors.grey[300]!),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                child: Text('Back', style: TextStyle(color: isDark ? Colors.white : Colors.black)),
              ),
            ),
          if (_currentStep > 0 && _currentStep < 3) const SizedBox(width: 12),
          
          Expanded(
            flex: 2,
            child: ElevatedButton(
              onPressed: _getNextAction(),
              style: ElevatedButton.styleFrom(
                backgroundColor: _currentStep == 3 ? const Color(0xFF10B981) : const Color(0xFF8B5CF6),
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 16),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                disabledBackgroundColor: Colors.grey[400],
              ),
              child: _isSubmitting
                  ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : Text(_getNextLabel(), style: const TextStyle(fontWeight: FontWeight.w700)),
            ),
          ),
        ],
      ),
    );
  }

  String _getNextLabel() {
    switch (_currentStep) {
      case 0: return _selectedCourier.isNotEmpty ? 'Continue' : 'Select Courier';
      case 1: return 'Continue';
      case 2: return 'Ship Order';
      case 3: return 'Done';
      default: return 'Next';
    }
  }

  VoidCallback? _getNextAction() {
    switch (_currentStep) {
      case 0: return _selectedCourier.isNotEmpty ? () => setState(() => _currentStep = 1) : null;
      case 1: return () => setState(() => _currentStep = 2);
      case 2: return _submitShipped;
      case 3: return () {
        widget.onComplete?.call();
        Navigator.pop(context);
      };
      default: return null;
    }
  }

  Future<void> _submitShipped() async {
    setState(() => _isSubmitting = true);
    
    try {
      final courierData = _couriers.firstWhere((c) => c['id'] == _selectedCourier, orElse: () => {});
      
      await _firestore.collection('orders').doc(widget.order.id).update({
        'orderStatus': 'shipped',
        'courier': _selectedCourier,
        'courierName': courierData['name'],
        'awbNumber': _awbController.text.trim(),
        'trackingUrl': _trackingController.text.trim(),
        'expectedDelivery': _expectedDelivery != null ? Timestamp.fromDate(_expectedDelivery!) : null,
        'shippedAt': FieldValue.serverTimestamp(),
        'updatedAt': FieldValue.serverTimestamp(),
      });
      
      await _firestore
          .collection('orders')
          .doc(widget.order.id)
          .collection('timeline')
          .add({
        'status': 'shipped',
        'title': 'Order Shipped',
        'description': 'Your order has been shipped via ${courierData['name']}.',
        'courier': _selectedCourier,
        'awbNumber': _awbController.text.trim(),
        'timestamp': FieldValue.serverTimestamp(),
      });
      
      try {
        await OrderNotificationService.sendOrderStatusNotification(
          userId: widget.order.userId,
          orderId: widget.order.id,
          orderNumber: widget.order.orderNumber,
          status: 'shipped',
          statusMessage: 'Your order has been shipped via ${courierData['name']}. Track with AWB: ${_awbController.text}',
        );
      } catch (e) {
        debugPrint('Notification error: $e');
      }
      
      setState(() => _currentStep = 3);
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error: $e'), backgroundColor: Colors.red),
      );
    } finally {
      setState(() => _isSubmitting = false);
    }
  }
}
