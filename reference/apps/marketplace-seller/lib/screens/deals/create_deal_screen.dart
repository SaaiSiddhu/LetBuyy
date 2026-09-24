// Create Deal Screen - Form to create a new promotional deal
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:letbuyy_models/letbuyy_models.dart';
import 'package:letbuyy_services/letbuyy_services.dart';
import 'package:intl/intl.dart';

class CreateDealScreen extends StatefulWidget {
  final String sellerId;
  
  const CreateDealScreen({super.key, required this.sellerId});

  @override
  State<CreateDealScreen> createState() => _CreateDealScreenState();
}

class _CreateDealScreenState extends State<CreateDealScreen> {
  final _formKey = GlobalKey<FormState>();
  final DealService _dealService = DealService();
  
  // Form fields
  ProductModel? _selectedProduct;
  final _titleController = TextEditingController(text: 'Flash Sale');
  final _descriptionController = TextEditingController();
  final _discountController = TextEditingController();
  final _stockLimitController = TextEditingController();
  
  DealDiscountType _discountType = DealDiscountType.percentage;
  DateTime _startDate = DateTime.now();
  DateTime _endDate = DateTime.now().add(const Duration(days: 3));
  bool _hasStockLimit = false;
  bool _isSubmitting = false;
  
  // Seller info for denormalization
  String _sellerName = '';
  
  @override
  void initState() {
    super.initState();
    _loadSellerInfo();
  }
  
  Future<void> _loadSellerInfo() async {
    try {
      final doc = await FirebaseFirestore.instance
          .collection('sellers')
          .doc(widget.sellerId)
          .get();
      if (doc.exists) {
        setState(() {
          _sellerName = doc.data()?['storeName'] ?? doc.data()?['name'] ?? 'Seller';
        });
      }
    } catch (e) {
      debugPrint('Error loading seller info: $e');
    }
  }

  @override
  void dispose() {
    _titleController.dispose();
    _descriptionController.dispose();
    _discountController.dispose();
    _stockLimitController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Provider.of<ThemeProvider>(context).isDarkMode;

    return Scaffold(
      backgroundColor: isDark ? AppColors.backgroundDark : AppColors.background,
      appBar: AppBar(
        backgroundColor: isDark ? AppColors.surfaceDark : Colors.white,
        elevation: 0,
        leading: IconButton(
          icon: Icon(Icons.close_rounded, 
            color: isDark ? Colors.white : AppColors.textPrimary),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text(
          'Create Deal',
          style: TextStyle(
            color: isDark ? Colors.white : AppColors.textPrimary,
            fontWeight: FontWeight.w700,
          ),
        ),
        actions: [
          TextButton(
            onPressed: _isSubmitting ? null : _submitDeal,
            child: _isSubmitting
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : Text(
                    'Submit',
                    style: TextStyle(
                      color: AppColors.error,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
          ),
        ],
      ),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            // Info Banner
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.error.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.error.withValues(alpha: 0.2)),
              ),
              child: Row(
                children: [
                  Icon(Icons.info_outline_rounded, color: AppColors.error, size: 20),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      'Deals require admin approval before going live. You\'ll be notified once approved.',
                      style: TextStyle(
                        fontSize: 12,
                        color: AppColors.error,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),
            
            // Section: Select Product
            _buildSectionHeader('Select Product', Icons.shopping_bag_rounded, isDark),
            const SizedBox(height: 12),
            _buildProductSelector(isDark),
            const SizedBox(height: 24),
            
            // Section: Deal Details
            _buildSectionHeader('Deal Details', Icons.local_offer_rounded, isDark),
            const SizedBox(height: 12),
            _buildTextField(
              controller: _titleController,
              label: 'Deal Title',
              hint: 'e.g., Flash Sale, Weekend Special',
              isDark: isDark,
              validator: (v) => v?.isEmpty == true ? 'Required' : null,
            ),
            const SizedBox(height: 12),
            _buildTextField(
              controller: _descriptionController,
              label: 'Description (Optional)',
              hint: 'Brief description of the deal',
              isDark: isDark,
              maxLines: 2,
            ),
            const SizedBox(height: 24),
            
            // Section: Discount
            _buildSectionHeader('Discount', Icons.percent_rounded, isDark),
            const SizedBox(height: 12),
            _buildDiscountTypeSelector(isDark),
            const SizedBox(height: 12),
            _buildTextField(
              controller: _discountController,
              label: _discountType == DealDiscountType.percentage 
                  ? 'Discount Percentage' 
                  : 'Discount Amount (₹)',
              hint: _discountType == DealDiscountType.percentage ? 'e.g., 20' : 'e.g., 100',
              isDark: isDark,
              keyboardType: TextInputType.number,
              prefixText: _discountType == DealDiscountType.fixed ? '₹ ' : null,
              suffixText: _discountType == DealDiscountType.percentage ? '%' : null,
              validator: (v) {
                if (v?.isEmpty == true) return 'Required';
                final value = double.tryParse(v!);
                if (value == null || value <= 0) return 'Enter valid amount';
                if (_discountType == DealDiscountType.percentage && value > 90) {
                  return 'Max 90%';
                }
                return null;
              },
            ),
            
            // Preview Deal Price
            if (_selectedProduct != null && _discountController.text.isNotEmpty)
              _buildPricePreview(isDark),
            const SizedBox(height: 24),
            
            // Section: Duration
            _buildSectionHeader('Duration', Icons.schedule_rounded, isDark),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(child: _buildDatePicker('Start', _startDate, (d) => setState(() => _startDate = d), isDark)),
                const SizedBox(width: 12),
                Expanded(child: _buildDatePicker('End', _endDate, (d) => setState(() => _endDate = d), isDark)),
              ],
            ),
            const SizedBox(height: 24),
            
            // Section: Stock Limit (Optional)
            _buildSectionHeader('Stock Limit (Optional)', Icons.inventory_2_rounded, isDark),
            const SizedBox(height: 12),
            SwitchListTile(
              value: _hasStockLimit,
              onChanged: (v) => setState(() => _hasStockLimit = v),
              title: Text(
                'Limit deal stock',
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  color: isDark ? Colors.white : Colors.black87,
                ),
              ),
              subtitle: Text(
                'Deal ends when stock runs out',
                style: TextStyle(fontSize: 12, color: Colors.grey[500]),
              ),
              activeThumbColor: AppColors.error,
              contentPadding: EdgeInsets.zero,
            ),
            if (_hasStockLimit)
              _buildTextField(
                controller: _stockLimitController,
                label: 'Stock Limit',
                hint: 'e.g., 50',
                isDark: isDark,
                keyboardType: TextInputType.number,
                validator: (v) {
                  if (_hasStockLimit && (v?.isEmpty == true || int.tryParse(v!) == null)) {
                    return 'Enter valid stock limit';
                  }
                  return null;
                },
              ),
            const SizedBox(height: 32),
            
            // Submit Button
            ElevatedButton(
              onPressed: _isSubmitting ? null : _submitDeal,
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.error,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 16),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              child: _isSubmitting
                  ? const SizedBox(
                      width: 24,
                      height: 24,
                      child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                    )
                  : const Text(
                      'Submit for Approval',
                      style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
                    ),
            ),
            const SizedBox(height: 40),
          ],
        ),
      ),
    );
  }

  Widget _buildSectionHeader(String title, IconData icon, bool isDark) {
    return Row(
      children: [
        Icon(icon, size: 18, color: AppColors.error),
        const SizedBox(width: 8),
        Text(
          title,
          style: TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w700,
            color: isDark ? Colors.white : Colors.black87,
          ),
        ),
      ],
    );
  }

  Widget _buildProductSelector(bool isDark) {
    if (_selectedProduct != null) {
      return Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: isDark ? AppColors.surfaceDark : Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppColors.success.withValues(alpha: 0.5), width: 2),
        ),
        child: Row(
          children: [
            Container(
              width: 50,
              height: 50,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: Colors.grey.shade200),
              ),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(7),
                child: CachedNetworkImage(
                  imageUrl: _selectedProduct!.images.isNotEmpty ? _selectedProduct!.images.first : '',
                  fit: BoxFit.cover,
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    _selectedProduct!.name,
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: isDark ? Colors.white : Colors.black87,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  Text(
                    '₹${_selectedProduct!.salePrice.toStringAsFixed(0)}',
                    style: TextStyle(
                      fontSize: 13,
                      color: AppColors.success,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
            ),
            IconButton(
              onPressed: () => setState(() => _selectedProduct = null),
              icon: const Icon(Icons.close_rounded, size: 20),
              color: Colors.grey,
            ),
          ],
        ),
      );
    }

    return InkWell(
      onTap: _showProductPicker,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: isDark ? AppColors.surfaceDark : Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: isDark ? Colors.white10 : Colors.grey.shade300,
            style: BorderStyle.solid,
          ),
        ),
        child: Column(
          children: [
            Icon(Icons.add_circle_outline_rounded, size: 40, color: AppColors.error),
            const SizedBox(height: 8),
            Text(
              'Select a Product',
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w600,
                color: isDark ? Colors.white70 : Colors.grey[600],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildDiscountTypeSelector(bool isDark) {
    return Container(
      decoration: BoxDecoration(
        color: isDark ? AppColors.surfaceDark : Colors.grey.shade100,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          Expanded(
            child: GestureDetector(
              onTap: () => setState(() => _discountType = DealDiscountType.percentage),
              child: Container(
                padding: const EdgeInsets.symmetric(vertical: 12),
                decoration: BoxDecoration(
                  color: _discountType == DealDiscountType.percentage
                      ? AppColors.error
                      : Colors.transparent,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  'Percentage %',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: _discountType == DealDiscountType.percentage
                        ? Colors.white
                        : (isDark ? Colors.white70 : Colors.grey[600]),
                  ),
                ),
              ),
            ),
          ),
          Expanded(
            child: GestureDetector(
              onTap: () => setState(() => _discountType = DealDiscountType.fixed),
              child: Container(
                padding: const EdgeInsets.symmetric(vertical: 12),
                decoration: BoxDecoration(
                  color: _discountType == DealDiscountType.fixed
                      ? AppColors.error
                      : Colors.transparent,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  'Fixed Amount ₹',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: _discountType == DealDiscountType.fixed
                        ? Colors.white
                        : (isDark ? Colors.white70 : Colors.grey[600]),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTextField({
    required TextEditingController controller,
    required String label,
    required String hint,
    required bool isDark,
    int maxLines = 1,
    TextInputType? keyboardType,
    String? prefixText,
    String? suffixText,
    String? Function(String?)? validator,
  }) {
    return TextFormField(
      controller: controller,
      maxLines: maxLines,
      keyboardType: keyboardType,
      validator: validator,
      onChanged: (_) => setState(() {}), // Rebuild for price preview
      style: TextStyle(
        color: isDark ? Colors.white : Colors.black87,
        fontSize: 14,
      ),
      decoration: InputDecoration(
        labelText: label,
        hintText: hint,
        prefixText: prefixText,
        suffixText: suffixText,
        filled: true,
        fillColor: isDark ? AppColors.surfaceDark : Colors.white,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: Colors.grey.shade300),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: isDark ? Colors.white10 : Colors.grey.shade300),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: AppColors.error, width: 2),
        ),
      ),
    );
  }

  Widget _buildDatePicker(String label, DateTime date, Function(DateTime) onChanged, bool isDark) {
    return InkWell(
      onTap: () async {
        final picked = await showDatePicker(
          context: context,
          initialDate: date,
          firstDate: DateTime.now(),
          lastDate: DateTime.now().add(const Duration(days: 90)),
        );
        if (picked != null) {
          final time = await showTimePicker(
            context: context,
            initialTime: TimeOfDay.fromDateTime(date),
          );
          if (time != null) {
            onChanged(DateTime(picked.year, picked.month, picked.day, time.hour, time.minute));
          } else {
            onChanged(picked);
          }
        }
      },
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: isDark ? AppColors.surfaceDark : Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: isDark ? Colors.white10 : Colors.grey.shade300),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              label,
              style: TextStyle(
                fontSize: 11,
                color: isDark ? Colors.white54 : Colors.grey[600],
              ),
            ),
            const SizedBox(height: 4),
            Row(
              children: [
                Icon(Icons.calendar_today_rounded, size: 16, color: AppColors.error),
                const SizedBox(width: 8),
                Text(
                  DateFormat('MMM dd, HH:mm').format(date),
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: isDark ? Colors.white : Colors.black87,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPricePreview(bool isDark) {
    final discountValue = double.tryParse(_discountController.text) ?? 0;
    final originalPrice = _selectedProduct!.salePrice;
    double dealPrice;
    
    if (_discountType == DealDiscountType.percentage) {
      dealPrice = originalPrice * (1 - discountValue / 100);
    } else {
      dealPrice = originalPrice - discountValue;
    }
    dealPrice = dealPrice.clamp(0, originalPrice);

    return Container(
      margin: const EdgeInsets.only(top: 12),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.success.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.success.withValues(alpha: 0.3)),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceAround,
        children: [
          Column(
            children: [
              Text('Original', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              Text(
                '₹${originalPrice.toStringAsFixed(0)}',
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  color: isDark ? Colors.white54 : Colors.grey[600],
                  decoration: TextDecoration.lineThrough,
                ),
              ),
            ],
          ),
          Icon(Icons.arrow_forward_rounded, color: AppColors.success),
          Column(
            children: [
              Text('Deal Price', style: TextStyle(fontSize: 11, color: AppColors.success)),
              Text(
                '₹${dealPrice.toStringAsFixed(0)}',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w800,
                  color: AppColors.success,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  void _showProductPicker() async {
    final products = await _fetchSellerProducts();
    if (!mounted) return;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) {
        final isDark = Provider.of<ThemeProvider>(context).isDarkMode;
        return Container(
          height: MediaQuery.of(context).size.height * 0.7,
          decoration: BoxDecoration(
            color: isDark ? AppColors.surfaceDark : Colors.white,
            borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
          ),
          child: Column(
            children: [
              const SizedBox(height: 12),
              Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: Colors.grey[400],
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              Padding(
                padding: const EdgeInsets.all(16),
                child: Text(
                  'Select Product',
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w700,
                    color: isDark ? Colors.white : Colors.black87,
                  ),
                ),
              ),
              Expanded(
                child: ListView.builder(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  itemCount: products.length,
                  itemBuilder: (context, index) {
                    final product = products[index];
                    return ListTile(
                      onTap: () {
                        setState(() => _selectedProduct = product);
                        Navigator.pop(context);
                      },
                      leading: Container(
                        width: 50,
                        height: 50,
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: Colors.grey.shade200),
                        ),
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(7),
                          child: CachedNetworkImage(
                            imageUrl: product.images.isNotEmpty ? product.images.first : '',
                            fit: BoxFit.cover,
                          ),
                        ),
                      ),
                      title: Text(
                        product.name,
                        style: TextStyle(
                          fontWeight: FontWeight.w600,
                          color: isDark ? Colors.white : Colors.black87,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      subtitle: Text('₹${product.salePrice.toStringAsFixed(0)}'),
                      trailing: const Icon(Icons.chevron_right_rounded),
                    );
                  },
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Future<List<ProductModel>> _fetchSellerProducts() async {
    try {
      final snapshot = await FirebaseFirestore.instance
          .collection('products')
          .where('sellerId', isEqualTo: widget.sellerId)
          .where('isActive', isEqualTo: true)
          .orderBy('name')
          .limit(50)
          .get();
      
      return snapshot.docs.map((doc) => ProductModel.fromFirestore(doc)).toList();
    } catch (e) {
      debugPrint('Error fetching products: $e');
      return [];
    }
  }

  Future<void> _submitDeal() async {
    if (!_formKey.currentState!.validate()) return;
    if (_selectedProduct == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please select a product')),
      );
      return;
    }
    if (_endDate.isBefore(_startDate)) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('End date must be after start date')),
      );
      return;
    }

    setState(() => _isSubmitting = true);

    try {
      final discountValue = double.parse(_discountController.text);
      final originalPrice = _selectedProduct!.salePrice;
      double dealPrice;
      
      if (_discountType == DealDiscountType.percentage) {
        dealPrice = originalPrice * (1 - discountValue / 100);
      } else {
        dealPrice = originalPrice - discountValue;
      }
      dealPrice = dealPrice.clamp(0, originalPrice);

      await _dealService.createDeal(
        sellerId: widget.sellerId,
        productId: _selectedProduct!.id,
        title: _titleController.text.trim(),
        description: _descriptionController.text.trim().isEmpty 
            ? null 
            : _descriptionController.text.trim(),
        discountType: _discountType,
        discountValue: discountValue,
        originalPrice: originalPrice,
        dealPrice: dealPrice,
        startDate: _startDate,
        endDate: _endDate,
        stockLimit: _hasStockLimit ? int.parse(_stockLimitController.text) : null,
        productName: _selectedProduct!.name,
        productImage: _selectedProduct!.images.isNotEmpty ? _selectedProduct!.images.first : '',
        sellerName: _sellerName,
      );

      if (mounted) {
        HapticFeedback.mediumImpact();
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('✅ Deal submitted for approval!'),
            backgroundColor: Colors.green,
          ),
        );
        Navigator.pop(context);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }
}
