// lib/screens/orders/widgets/order_pack_flow.dart
// 📦 PROFESSIONAL PACKING WORKFLOW - Amazon FBA Style
// ✨ Item checklist, barcode scanning, label printing

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:letbuyy_models/letbuyy_models.dart';
import 'package:letbuyy_services/letbuyy_services.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:provider/provider.dart';
import '../../../providers/seller_provider.dart';
import 'shipping_label_generator.dart';

class OrderPackFlow extends StatefulWidget {
  final OrderModel order;
  final VoidCallback? onComplete;

  const OrderPackFlow({
    super.key,
    required this.order,
    this.onComplete,
  });

  @override
  State<OrderPackFlow> createState() => _OrderPackFlowState();
}

class _OrderPackFlowState extends State<OrderPackFlow> {
  final FirebaseFirestore _firestore = FirebaseFirestore.instance;
  
  // Track which items are packed
  late Map<String, bool> _packedItems;
  bool _isSubmitting = false;
  int _currentStep = 0; // 0: Items, 1: Packaging, 2: Label, 3: Complete
  
  // Packaging options
  String _selectedPackaging = 'box';
  final TextEditingController _notesController = TextEditingController();
  
  @override
  void initState() {
    super.initState();
    _packedItems = {};
    for (final item in widget.order.items) {
      _packedItems[item.productId] = false;
    }
  }

  @override
  void dispose() {
    _notesController.dispose();
    super.dispose();
  }

  bool get _allItemsPacked => _packedItems.values.every((v) => v);
  int get _packedCount => _packedItems.values.where((v) => v).length;
  int get _totalItems => widget.order.items.length;

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
          // Header
          _buildHeader(isDark),
          
          // Progress Steps
          _buildProgressSteps(isDark),
          
          // Content
          Expanded(
            child: _buildStepContent(isDark),
          ),
          
          // Footer Actions
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
              color: const Color(0xFF3B82F6).withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(12),
            ),
            child: const Icon(Icons.inventory_2_rounded, color: Color(0xFF3B82F6), size: 22),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Pack Order #${widget.order.orderNumber}',
                  style: TextStyle(
                    color: isDark ? Colors.white : const Color(0xFF111827),
                    fontSize: 17,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                Text(
                  '$_packedCount of $_totalItems items verified',
                  style: TextStyle(
                    color: isDark ? Colors.grey[400] : Colors.grey[600],
                    fontSize: 13,
                  ),
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
    final steps = ['Items', 'Packaging', 'Label', 'Done'];
    
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
      child: Row(
        children: List.generate(steps.length, (index) {
          final isActive = index == _currentStep;
          final isComplete = index < _currentStep;
          
          return Expanded(
            child: Row(
              children: [
                // Step Circle
                Container(
                  width: 28,
                  height: 28,
                  decoration: BoxDecoration(
                    color: isComplete 
                        ? const Color(0xFF10B981) 
                        : isActive 
                            ? const Color(0xFF3B82F6) 
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
                // Step Label
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
                // Connector line
                if (index < steps.length - 1)
                  Container(
                    width: 12,
                    height: 2,
                    color: isComplete 
                        ? const Color(0xFF10B981)
                        : (isDark ? Colors.grey[700] : Colors.grey[300]),
                  ),
              ],
            ),
          );
        }),
      ),
    );
  }

  Widget _buildStepContent(bool isDark) {
    switch (_currentStep) {
      case 0:
        return _buildItemsStep(isDark);
      case 1:
        return _buildPackagingStep(isDark);
      case 2:
        return _buildLabelStep(isDark);
      case 3:
        return _buildCompleteStep(isDark);
      default:
        return const SizedBox.shrink();
    }
  }

  // Step 1: Items Verification
  Widget _buildItemsStep(bool isDark) {
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        // Instructions
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: const Color(0xFF3B82F6).withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: const Color(0xFF3B82F6).withValues(alpha: 0.2)),
          ),
          child: Row(
            children: [
              const Icon(Icons.info_outline_rounded, color: Color(0xFF3B82F6), size: 20),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  'Verify each item before packing. Tap or scan barcode to mark as verified.',
                  style: TextStyle(color: isDark ? Colors.white : const Color(0xFF111827), fontSize: 13),
                ),
              ),
            ],
          ),
        ).animate().fadeIn(delay: 100.ms),
        const SizedBox(height: 20),
        
        // Items List
        ...widget.order.items.asMap().entries.map((entry) {
          final index = entry.key;
          final item = entry.value;
          final isPacked = _packedItems[item.productId] ?? false;
          
          return _buildItemCard(item, isPacked, isDark, index * 50);
        }),
      ],
    );
  }

  Widget _buildItemCard(CartItemModel item, bool isPacked, bool isDark, int delay) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: GestureDetector(
        onTap: () {
          HapticFeedback.lightImpact();
          setState(() => _packedItems[item.productId] = !isPacked);
        },
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: isPacked 
                ? const Color(0xFF10B981).withValues(alpha: 0.1)
                : (isDark ? Colors.grey[800]!.withValues(alpha: 0.5) : Colors.grey[50]),
            borderRadius: BorderRadius.circular(14),
            border: Border.all(
              color: isPacked 
                  ? const Color(0xFF10B981)
                  : (isDark ? Colors.white.withValues(alpha: 0.05) : Colors.grey.withValues(alpha: 0.1)),
              width: isPacked ? 2 : 1,
            ),
          ),
          child: Row(
            children: [
              // Checkbox
              Container(
                width: 28,
                height: 28,
                decoration: BoxDecoration(
                  color: isPacked ? const Color(0xFF10B981) : Colors.transparent,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(
                    color: isPacked ? const Color(0xFF10B981) : (isDark ? Colors.grey[600]! : Colors.grey[400]!),
                    width: 2,
                  ),
                ),
                child: isPacked 
                    ? const Icon(Icons.check_rounded, color: Colors.white, size: 18)
                    : null,
              ),
              const SizedBox(width: 14),
              
              // Product Image
              ClipRRect(
                borderRadius: BorderRadius.circular(10),
                child: Container(
                  width: 50,
                  height: 50,
                  color: isDark ? Colors.grey[700] : Colors.grey[200],
                  child: CachedNetworkImage(imageUrl: item.imageUrl, fit: BoxFit.cover),
                ),
              ),
              const SizedBox(width: 14),
              
              // Product Info
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      item.productName,
                      style: TextStyle(
                        color: isDark ? Colors.white : const Color(0xFF111827),
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        decoration: isPacked ? TextDecoration.lineThrough : null,
                      ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                          decoration: BoxDecoration(
                            color: isDark ? Colors.grey[700] : Colors.grey[200],
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Text(
                            'Qty: ${item.quantity}',
                            style: TextStyle(
                              color: isDark ? Colors.grey[300] : Colors.grey[700],
                              fontSize: 11,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                        if (item.variant != null && item.variant!.isNotEmpty) ...[
                          const SizedBox(width: 8),
                          Text(
                            'Variant: ${item.variant}',
                            style: TextStyle(color: isDark ? Colors.grey[400] : Colors.grey[600], fontSize: 11),
                          ),
                        ],
                      ],
                    ),
                  ],
                ),
              ),
              
              // Status Icon
              Icon(
                isPacked ? Icons.verified_rounded : Icons.radio_button_unchecked_rounded,
                color: isPacked ? const Color(0xFF10B981) : (isDark ? Colors.grey[600] : Colors.grey[400]),
                size: 24,
              ),
            ],
          ),
        ),
      ),
    ).animate().fadeIn(delay: delay.ms).slideX(begin: 0.05);
  }

  // Step 2: Packaging Selection
  Widget _buildPackagingStep(bool isDark) {
    final packagingOptions = [
      {'key': 'box', 'label': 'Box', 'icon': Icons.inventory_2_rounded, 'desc': 'Standard cardboard box'},
      {'key': 'envelope', 'label': 'Envelope', 'icon': Icons.mail_rounded, 'desc': 'Padded envelope'},
      {'key': 'pouch', 'label': 'Pouch', 'icon': Icons.shopping_bag_rounded, 'desc': 'Poly mailer pouch'},
      {'key': 'custom', 'label': 'Custom', 'icon': Icons.all_inbox_rounded, 'desc': 'Custom packaging'},
    ];
    
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        Text(
          'Select Packaging Type',
          style: TextStyle(
            color: isDark ? Colors.white : const Color(0xFF111827),
            fontSize: 16,
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: 16),
        
        ...packagingOptions.map((option) {
          final isSelected = _selectedPackaging == option['key'];
          return Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: GestureDetector(
              onTap: () => setState(() => _selectedPackaging = option['key'] as String),
              child: Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: isSelected 
                      ? const Color(0xFF3B82F6).withValues(alpha: 0.1)
                      : (isDark ? Colors.grey[800]!.withValues(alpha: 0.5) : Colors.grey[50]),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(
                    color: isSelected ? const Color(0xFF3B82F6) : Colors.transparent,
                    width: 2,
                  ),
                ),
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: (isSelected ? const Color(0xFF3B82F6) : Colors.grey).withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Icon(
                        option['icon'] as IconData, 
                        color: isSelected ? const Color(0xFF3B82F6) : Colors.grey,
                        size: 22,
                      ),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            option['label'] as String,
                            style: TextStyle(
                              color: isDark ? Colors.white : const Color(0xFF111827),
                              fontSize: 15,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          Text(
                            option['desc'] as String,
                            style: TextStyle(color: Colors.grey[500], fontSize: 12),
                          ),
                        ],
                      ),
                    ),
                    if (isSelected)
                      const Icon(Icons.check_circle_rounded, color: Color(0xFF3B82F6)),
                  ],
                ),
              ),
            ),
          );
        }),
        
        const SizedBox(height: 24),
        Text(
          'Packing Notes (Optional)',
          style: TextStyle(
            color: isDark ? Colors.white : const Color(0xFF111827),
            fontSize: 14,
            fontWeight: FontWeight.w600,
          ),
        ),
        const SizedBox(height: 10),
        TextField(
          controller: _notesController,
          maxLines: 3,
          style: TextStyle(color: isDark ? Colors.white : Colors.black),
          decoration: InputDecoration(
            hintText: 'Add any special packing instructions...',
            hintStyle: TextStyle(color: Colors.grey[500]),
            filled: true,
            fillColor: isDark ? Colors.grey[800]!.withValues(alpha: 0.5) : Colors.grey[50],
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide.none,
            ),
          ),
        ),
      ],
    );
  }

  // Step 3: Label Printing
  Widget _buildLabelStep(bool isDark) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: const Color(0xFF8B5CF6).withValues(alpha: 0.1),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.qr_code_2_rounded, color: Color(0xFF8B5CF6), size: 60),
            ),
            const SizedBox(height: 24),
            Text(
              'Generate Shipping Label',
              style: TextStyle(
                color: isDark ? Colors.white : const Color(0xFF111827),
                fontSize: 20,
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Print the shipping label and attach to package',
              style: TextStyle(color: Colors.grey[500], fontSize: 14),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 32),
            
            // Print Button
            ElevatedButton.icon(
              onPressed: _printShippingLabel,
              icon: const Icon(Icons.print_rounded),
              label: const Text('Print Label'),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF8B5CF6),
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 16),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
            ),
            const SizedBox(height: 12),
            TextButton(
              onPressed: () => setState(() => _currentStep = 3),
              child: const Text('Skip for now'),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _printShippingLabel() async {
    debugPrint('🏷️ Print Label button pressed');
    try {
      if (!mounted) return;
      
      // Get seller from provider
      final seller = Provider.of<SellerProvider>(context, listen: false).currentSeller;
      if (seller == null) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Seller details not available'), backgroundColor: Colors.red),
        );
        return;
      }
      
      debugPrint('🏷️ Generating label using ShippingLabelGenerator...');
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Generating shipping label...')),
      );

      // Use the centralized ShippingLabelGenerator
      final generator = ShippingLabelGenerator(
        order: widget.order,
        seller: seller,
      );
      
      await generator.printLabel(preview: true);
      debugPrint('🏷️ Print dialog closed');
    } catch (e, stackTrace) {
      debugPrint('❌ Print label error: $e');
      debugPrint('❌ Stack trace: $stackTrace');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to print label: $e'), backgroundColor: Colors.red),
        );
      }
    }
  }

  // Step 4: Complete
  Widget _buildCompleteStep(bool isDark) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: const Color(0xFF10B981).withValues(alpha: 0.1),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.check_circle_rounded, color: Color(0xFF10B981), size: 60),
            ).animate().scale(delay: 100.ms),
            const SizedBox(height: 24),
            Text(
              'Order Packed!',
              style: TextStyle(
                color: isDark ? Colors.white : const Color(0xFF111827),
                fontSize: 24,
                fontWeight: FontWeight.w800,
              ),
            ).animate().fadeIn(delay: 200.ms),
            const SizedBox(height: 8),
            Text(
              'Order #${widget.order.orderNumber} is ready for shipment',
              style: TextStyle(color: Colors.grey[500], fontSize: 14),
              textAlign: TextAlign.center,
            ).animate().fadeIn(delay: 300.ms),
          ],
        ),
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
          // Back Button
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
          
          // Primary Action
          Expanded(
            flex: 2,
            child: ElevatedButton(
              onPressed: _getNextAction(),
              style: ElevatedButton.styleFrom(
                backgroundColor: _currentStep == 3 ? const Color(0xFF10B981) : const Color(0xFF3B82F6),
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
      case 0: return _allItemsPacked ? 'Continue to Packaging' : 'Verify All Items First';
      case 1: return 'Continue to Label';
      case 2: return 'Mark as Packed';
      case 3: return 'Done';
      default: return 'Next';
    }
  }

  VoidCallback? _getNextAction() {
    switch (_currentStep) {
      case 0: return _allItemsPacked ? () => setState(() => _currentStep = 1) : null;
      case 1: return () => setState(() => _currentStep = 2);
      case 2: return _submitPacked;
      case 3: return () {
        widget.onComplete?.call();
        Navigator.pop(context);
      };
      default: return null;
    }
  }

  Future<void> _submitPacked() async {
    setState(() => _isSubmitting = true);
    
    try {
      // Update order status to processing/packed
      await _firestore.collection('orders').doc(widget.order.id).update({
        'orderStatus': 'processing',
        'packingType': _selectedPackaging,
        'packingNotes': _notesController.text.trim(),
        'packedAt': FieldValue.serverTimestamp(),
        'updatedAt': FieldValue.serverTimestamp(),
      });
      
      // Add timeline event
      await _firestore
          .collection('orders')
          .doc(widget.order.id)
          .collection('timeline')
          .add({
        'status': 'processing',
        'title': 'Order Packed',
        'description': 'Order has been packed and is ready for shipment.',
        'packingType': _selectedPackaging,
        'timestamp': FieldValue.serverTimestamp(),
      });
      
      // Send notification
      try {
        await OrderNotificationService.sendOrderStatusNotification(
          userId: widget.order.userId,
          orderId: widget.order.id,
          orderNumber: widget.order.orderNumber,
          status: 'processing',
          statusMessage: 'Your order has been packed and is being prepared for shipment.',
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
