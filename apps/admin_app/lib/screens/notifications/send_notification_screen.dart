// lib/screens/admin/notifications/send_notification_screen.dart
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:cloud_functions/cloud_functions.dart';
import 'package:firebase_storage/firebase_storage.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:shimmer/shimmer.dart';
import 'package:fl_chart/fl_chart.dart';

import 'package:letbuyy_marketplace_ui_kit/letbuyy_marketplace_ui_kit.dart';
import 'package:letbuyy_marketplace_core/letbuyy_marketplace_core.dart';
import 'package:letbuyy_marketplace_models/letbuyy_marketplace_models.dart';
import '../../../providers/admin_provider.dart';
import 'package:letbuyy_marketplace_services/letbuyy_marketplace_services.dart';

class SendNotificationScreen extends StatefulWidget {
  const SendNotificationScreen({super.key});

  @override
  State<SendNotificationScreen> createState() =>
      _SendNotificationScreenState();
}

class _SendNotificationScreenState extends State<SendNotificationScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  final _formKey = GlobalKey<FormState>();
  final _titleController = TextEditingController();
  final _bodyController = TextEditingController();
  final _imageUrlController = TextEditingController();
  final _actionUrlController = TextEditingController();

  String _sendType = 'all';
  String _notificationType = 'general';
  String? _selectedUserId;
  String? _selectedOrderId;
  String? _selectedOrderStatus;

  List<Map<String, dynamic>> _users = [];
  List<OrderModel> _allOrders = [];
  List<OrderModel> _filteredOrders = [];

  bool _isLoading = false;
  bool _isUploadingImage = false;
  bool _isLoadingData = true;
  String? _uploadedImageUrl;
  File? _selectedImageFile;

  // ✅ Order status templates
  final Map<String, Map<String, String>> _orderStatusTemplates = {
    'pending': {
      'title': '📦 Order Received!',
      'body': 'Your order has been received and is awaiting confirmation. Track your order now!',
      'icon': '📦',
    },
    'confirmed': {
      'title': '✅ Order Confirmed!',
      'body': 'Your order has been confirmed. We are now preparing it for shipment.',
      'icon': '✅',
    },
    'processing': {
      'title': '⚙️ Order Processing',
      'body': 'Your order is being packed and prepared for shipment. We will update you soon!',
      'icon': '⚙️',
    },
    'shipped': {
      'title': '🚚 Order Shipped!',
      'body': 'Your order is on its way! Track your shipment in real-time.',
      'icon': '🚚',
    },
    'outfordelivery': {
      'title': '📍 Out for Delivery',
      'body': 'Your order is out for delivery today. Get ready to receive it!',
      'icon': '📍',
    },
    'delivered': {
      'title': '✨ Order Delivered!',
      'body': 'Your order has been delivered successfully! Thank you for shopping with us.',
      'icon': '✨',
    },
    'cancelled': {
      'title': '❌ Order Cancelled',
      'body': 'Your order has been cancelled. If you have any questions, contact support.',
      'icon': '❌',
    },
    'refunded': {
      'title': '💰 Refund Processed',
      'body': 'Your refund has been processed. The amount will reflect in your account within 3-5 business days.',
      'icon': '💰',
    },
  };

  // ✅ General templates
  final Map<String, Map<String, String>> _generalTemplates = {
    'promotion': {
      'title': '⚡ Special Offer Just for You!',
      'body': 'Get 20% OFF your next purchase. Limited time only! Shop now and save big.',
    },
    'welcome': {
      'title': 'Welcome to AgriMate! 🧑‍🌾',
      'body': 'Thank you for joining us. Start exploring our fresh products. Use code WELCOME20 for 20% OFF!',
    },
    'reminder': {
      'title': '🔔 Don\'t Forget!',
      'body': 'We have some amazing products waiting for you. Complete your shopping now!',
    },
    'seasonal': {
      'title': '🌾 Seasonal Harvest Available',
      'body': 'Fresh seasonal produce is now available. Grab the best quality at great prices!',
    },
    'flash_sale': {
      'title': '⚡ FLASH SALE - 2 Hours Only!',
      'body': 'Huge discounts on selected items. Hurry, stock is limited!',
    },
  };

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    _loadInitialData();
  }

  @override
  void dispose() {
    _tabController.dispose();
    _titleController.dispose();
    _bodyController.dispose();
    _imageUrlController.dispose();
    _actionUrlController.dispose();
    super.dispose();
  }

  Future<void> _loadInitialData() async {
    if (!mounted) return;
    setState(() => _isLoadingData = true);
    try {
      await Provider.of<AdminProvider>(context, listen: false)
          .loadDashboardStats();
      
      final orderProvider = Provider.of<OrderProvider>(context, listen: false);
      orderProvider.loadAllOrders(); // ✅ No await - it returns void

      // Wait a moment for data to load
      await Future.delayed(const Duration(milliseconds: 500));

      await _loadUsers();
      _allOrders = orderProvider.orders;
      _filteredOrders = _allOrders;
      
      debugPrint('✅ Loaded ${_allOrders.length} orders');
    } catch (e) {
      debugPrint('❌ Error loading data: $e');
      if (mounted) {
        SnackbarHelper.showError(context, 'Failed to load data: $e');
      }
    } finally {
      if (mounted) {
        setState(() => _isLoadingData = false);
      }
    }
  }

  Future<void> _loadUsers() async {
    try {
      final snapshot = await FirebaseFirestore.instance
          .collection('users')
          .limit(100)
          .get();
      if (mounted) {
        setState(() {
          _users = snapshot.docs
              .map((doc) => {
                    'id': doc.id,
                    'name': doc.data()['name'] ?? 'No Name',
                    'email': doc.data()['email'] ?? '',
                    'fcmTokens': doc.data()['fcmTokens'] ?? [],
                  })
              .toList();
        });
      }
    } catch (e) {
      debugPrint('❌ Error loading users: $e');
    }
  }

  // ✅ Filter orders by status
  void _filterOrdersByStatus(String status) {
    setState(() {
      _selectedOrderStatus = status;
      _filteredOrders = _allOrders
          .where((order) => order.orderStatus.toLowerCase() == status.toLowerCase())
          .toList();
      _selectedOrderId = null;
    });
  }

  // ✅ Auto-fill order details
  void _selectOrder(OrderModel order) {
    setState(() {
      _selectedOrderId = order.id;
      _selectedUserId = order.userId;
      _actionUrlController.text = '/orders/${order.id}';
    });
  }

  Future<void> _pickImage() async {
    try {
      final ImagePicker picker = ImagePicker();
      final XFile? image = await picker.pickImage(
        source: ImageSource.gallery,
        maxWidth: 1920,
        maxHeight: 1080,
        imageQuality: 85,
      );

      if (image != null) {
        setState(() {
          if (kIsWeb) {
            _uploadedImageUrl = image.path;
          } else {
            _selectedImageFile = File(image.path);
          }
        });
        await _uploadImage(image);
      }
    } catch (e) {
      debugPrint('❌ Error picking image: $e');
      if (mounted) {
        SnackbarHelper.showError(context, 'Failed to pick image');
      }
    }
  }

  Future<void> _uploadImage(XFile image) async {
    setState(() => _isUploadingImage = true);
    try {
      final String fileName =
          'notifications/${DateTime.now().millisecondsSinceEpoch}_${image.name}';
      final Reference ref = FirebaseStorage.instance.ref().child(fileName);

      if (kIsWeb) {
        await ref.putData(await image.readAsBytes());
      } else {
        await ref.putFile(File(image.path));
      }

      final String downloadUrl = await ref.getDownloadURL();
      setState(() {
        _uploadedImageUrl = downloadUrl;
        _imageUrlController.text = downloadUrl;
      });

      if (mounted) {
        SnackbarHelper.showSuccess(context, 'Image uploaded successfully!');
      }
    } catch (e) {
      debugPrint('❌ Upload error: $e');
      if (mounted) {
        SnackbarHelper.showError(context, 'Failed to upload image: $e');
      }
    } finally {
      if (mounted) setState(() => _isUploadingImage = false);
    }
  }

  void _useTemplate(String templateKey, bool isOrderStatus) {
    final templates = isOrderStatus ? _orderStatusTemplates : _generalTemplates;
    final template = templates[templateKey]!;
    setState(() {
      _titleController.text = template['title']!;
      _bodyController.text = template['body']!;
    });
  }

  Future<void> _sendNotification() async {
    if (!_formKey.currentState!.validate()) {
      SnackbarHelper.showError(context, 'Please fill in all required fields');
      return;
    }

    setState(() => _isLoading = true);

    String finalSendType = _sendType;
    String? finalUserId = _selectedUserId;
    String? finalActionUrl = _actionUrlController.text.trim().isNotEmpty
        ? _actionUrlController.text.trim()
        : null;

    try {
      // ✅ Handle order notifications
      if (_notificationType == 'order' && _selectedOrderId != null) {
        final order = _allOrders.firstWhere((o) => o.id == _selectedOrderId);
        finalActionUrl ??= '/orders/$_selectedOrderId';
        finalSendType = 'single';
        finalUserId = order.userId;

        if (mounted) {
          SnackbarHelper.showSuccess(
              context, 'Sending order update to customer.');
        }
      }

      final Map<String, dynamic> functionData = {
        'title': _titleController.text.trim(),
        'body': _bodyController.text.trim(),
        'imageUrl':
            _uploadedImageUrl?.trim() ?? _imageUrlController.text.trim(),
        'actionUrl': finalActionUrl,
        'type': _notificationType,
        'category': _notificationType,
        'orderStatus': _selectedOrderStatus,
      };

      HttpsCallableResult result;

      if (finalSendType == 'all') {
        final callable = FirebaseFunctions.instance
            .httpsCallable('sendBroadcastNotification');
        result = await callable.call(functionData);
      } else {
        if (finalUserId == null) {
          throw Exception('Please select a user to send this notification to.');
        }
        functionData['userId'] = finalUserId;
        final callable = FirebaseFunctions.instance
            .httpsCallable('sendNotificationToUser');
        result = await callable.call(functionData);
      }

      // ✅ Save notification history with analytics
      await FirebaseFirestore.instance
          .collection('notification_history')
          .add({
        ...functionData,
        'sendType': finalSendType,
        'userId': finalUserId,
        'recipientCount': finalSendType == 'all' 
            ? _users.length 
            : 1,
        'timestamp': FieldValue.serverTimestamp(),
        'status': 'sent',
      });

      if (mounted && result.data != null) {
        final successCount = result.data['successCount'] ?? 0;
        final failureCount = result.data['failureCount'] ?? 0;
        final message = result.data['message'] ?? 'Notification sent successfully!';

        _showSuccessDialog(
          'Notification Sent! ✅',
          '$message\n\nSuccess: $successCount\nFailed: $failureCount',
        );
        _clearForm();
      }
    } on FirebaseFunctionsException catch (e) {
      debugPrint('❌ Firebase Functions Error: ${e.code} ${e.message}');
      if (mounted) {
        SnackbarHelper.showError(context, 'Error: ${e.message ?? e.code}');
      }
    } catch (e) {
      debugPrint('❌ Unexpected error: $e');
      if (mounted) {
        SnackbarHelper.showError(context, 'Error: ${e.toString()}');
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  void _clearForm() {
    _titleController.clear();
    _bodyController.clear();
    _imageUrlController.clear();
    _actionUrlController.clear();
    setState(() {
      _uploadedImageUrl = null;
      _selectedImageFile = null;
      _selectedUserId = null;
      _selectedOrderId = null;
      _selectedOrderStatus = null;
      _notificationType = 'general';
      _sendType = 'all';
    });
  }

  void _showSuccessDialog(String title, String message) {
    final isDark =
        Provider.of<ThemeProvider>(context, listen: false).isDarkMode;
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor:
            isDark ? AppColors.surfaceDark : AppColors.surface,
        shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16)),
        title: Row(
          children: [
            const Icon(Icons.check_circle,
                color: AppColors.success, size: 32),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                title,
                style: TextStyle(
                  color: isDark
                      ? AppColors.textLight
                      : AppColors.textPrimary,
                ),
              ),
            ),
          ],
        ),
        content: Text(
          message,
          style: TextStyle(
            color: isDark
                ? AppColors.textLightSecondary
                : AppColors.textSecondary,
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('OK'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Provider.of<ThemeProvider>(context).isDarkMode;
    final accentColor = isDark ? AppColors.primaryLight : AppColors.primary;

    return Scaffold(
      backgroundColor:
          isDark ? AppColors.backgroundDark : AppColors.background,
      appBar: AppBar(
        title: const Text('Advanced Notifications'),
        backgroundColor: accentColor,
        foregroundColor: isDark ? AppColors.textPrimary : AppColors.white,
        bottom: TabBar(
          controller: _tabController,
          tabs: const [
            Tab(
                icon: Icon(Icons.edit_note_rounded),
                text: 'Compose'),
            Tab(
                icon: Icon(Icons.history_rounded),
                text: 'History'),
            Tab(
                icon: Icon(Icons.analytics_rounded),
                text: 'Analytics'),
          ],
          indicatorColor:
              isDark ? AppColors.textPrimary : AppColors.white,
          labelColor:
              isDark ? AppColors.textPrimary : AppColors.white,
          unselectedLabelColor:
              (isDark ? AppColors.textPrimary : AppColors.white)
                  .withValues(alpha: 0.7),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _loadInitialData,
            tooltip: 'Refresh Data',
          ),
        ],
      ),
      body: _isLoadingData
          ? _buildLoadingState(isDark)
          : TabBarView(
              controller: _tabController,
              children: [
                _buildComposeTab(isDark, accentColor),
                _buildHistoryTab(isDark, accentColor),
                _buildAnalyticsTab(isDark, accentColor),
              ],
            ),
    );
  }

  Widget _buildComposeTab(bool isDark, Color accentColor) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Form(
        key: _formKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // ✅ NOTIFICATION TYPE SELECTION
            _buildCardSection(
              isDark: isDark,
              title: 'Notification Type',
              icon: Icons.category_rounded,
              child: _buildTypeGrid(isDark, accentColor),
            ),

            // ✅ ORDER STATUS SPECIFIC UI
            if (_notificationType == 'order')
              _buildCardSection(
                isDark: isDark,
                title: 'Order Status Templates',
                icon: Icons.local_shipping_rounded,
                child: _buildOrderStatusTemplates(isDark, accentColor),
              ),

            // ✅ GENERAL TEMPLATES
            if (_notificationType != 'order')
              _buildCardSection(
                isDark: isDark,
                title: 'Quick Templates',
                icon: Icons.auto_awesome_rounded,
                child: Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: _generalTemplates.keys
                      .map(
                        (key) => ActionChip(
                          label: Text(
                            key.replaceAll('_', ' ').toUpperCase(),
                          ),
                          onPressed: () => _useTemplate(key, false),
                          backgroundColor:
                              accentColor.withValues(alpha: 0.1),
                          labelStyle: TextStyle(
                            color: accentColor,
                            fontWeight: FontWeight.w600,
                          ),
                          side: BorderSide(
                            color: accentColor.withValues(alpha: 0.3),
                          ),
                        ),
                      )
                      .toList(),
                ),
              ),

            // ✅ AUDIENCE SELECTION
            _buildCardSection(
              isDark: isDark,
              title: 'Audience',
              icon: Icons.people_rounded,
              child: Column(
                children: [
                  SegmentedButton<String>(
                    style: SegmentedButton.styleFrom(
                      selectedBackgroundColor:
                          accentColor.withValues(alpha: 0.2),
                      selectedForegroundColor: accentColor,
                      foregroundColor: isDark
                          ? AppColors.textLightSecondary
                          : AppColors.textSecondary,
                    ),
                    segments: const [
                      ButtonSegment(
                        value: 'all',
                        label: Text('All Users'),
                        icon: Icon(Icons.people),
                      ),
                      ButtonSegment(
                        value: 'single',
                        label: Text('Single User'),
                        icon: Icon(Icons.person),
                      ),
                    ],
                    selected: {_sendType},
                    onSelectionChanged: (Set<String> newSelection) {
                      setState(
                          () => _sendType = newSelection.first);
                    },
                  ),
                  if (_sendType == 'single') ...[
                    const SizedBox(height: 16),
                    _buildUserSelection(isDark),
                  ],
                ],
              ),
            ),

            // ✅ ORDER SELECTION WITH STATUS FILTER
            if (_notificationType == 'order')
              _buildCardSection(
                isDark: isDark,
                title: 'Select Order',
                icon: Icons.shopping_cart_rounded,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Status filter chips
                    Text(
                      'Filter by Status:',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: isDark
                            ? AppColors.textLightSecondary
                            : AppColors.textSecondary,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Wrap(
                      spacing: 8,
                      children: [
                        'pending', 'confirmed', 'processing',
                        'shipped', 'outfordelivery', 'delivered'
                      ]
                          .map((status) => FilterChip(
                                label: Text(status.toUpperCase()),
                                selected:
                                    _selectedOrderStatus == status,
                                onSelected: (_) =>
                                    _filterOrdersByStatus(status),
                                backgroundColor: isDark
                                    ? AppColors.surfaceDarkVariant
                                    : AppColors.surfaceVariant,
                                selectedColor:
                                    accentColor.withValues(alpha: 0.3),
                              ))
                          .toList(),
                      ),
                    const SizedBox(height: 16),

                    // Orders list
                    if (_filteredOrders.isEmpty)
                      Center(
                        child: Padding(
                          padding: const EdgeInsets.all(16),
                          child: Text(
                            'No orders found with selected status',
                            style: TextStyle(
                              color: isDark
                                  ? AppColors.textLightSecondary
                                  : AppColors.textSecondary,
                            ),
                          ),
                        ),
                      )
                    else
                      SizedBox(
                        height: 300,
                        child: ListView.builder(
                          itemCount: _filteredOrders.length,
                          itemBuilder: (context, index) {
                            final order = _filteredOrders[index];
                            final isSelected =
                                _selectedOrderId == order.id;
                            return Card(
                              color: isSelected
                                  ? accentColor.withValues(alpha: 0.1)
                                  : (isDark
                                      ? AppColors.surfaceDarkVariant
                                      : AppColors.surfaceVariant),
                              child: ListTile(
                                selected: isSelected,
                                onTap: () => _selectOrder(order),
                                leading: Icon(
                                  Icons.receipt_long_rounded,
                                  color: isSelected
                                      ? accentColor
                                      : (isDark
                                          ? AppColors
                                              .textLightSecondary
                                          : AppColors.textSecondary),
                                ),
                                title: Text(
                                  '#${order.orderNumber}',
                                  style: TextStyle(
                                    fontWeight: FontWeight.bold,
                                    color: isDark
                                        ? AppColors.textLight
                                        : AppColors.textPrimary,
                                  ),
                                ),
                                subtitle: Text(
                                  '${order.deliveryAddress.name} • ${order.orderStatus}',
                                  style: TextStyle(
                                    color: isDark
                                        ? AppColors
                                            .textLightSecondary
                                        : AppColors.textSecondary,
                                  ),
                                ),
                                trailing: Chip(
                                  label: Text(
                                      '₹${order.total.toStringAsFixed(0)}'),
                                  backgroundColor:
                                      accentColor.withValues(alpha: 0.2),
                                ),
                              ),
                            );
                          },
                        ),
                      ),
                  ],
                ),
              ),

            // ✅ MESSAGE CONTENT
            _buildCardSection(
              isDark: isDark,
              title: 'Message Content',
              icon: Icons.edit_rounded,
              child: Column(
                children: [
                  _buildTextFormField(
                    controller: _titleController,
                    label: 'Title',
                    icon: Icons.title,
                    isDark: isDark,
                    validator: (val) =>
                        (val?.isEmpty ?? true)
                            ? 'Title is required'
                            : null,
                  ),
                  const SizedBox(height: 12),
                  _buildTextFormField(
                    controller: _bodyController,
                    label: 'Body Message',
                    icon: Icons.message,
                    isDark: isDark,
                    maxLines: 4,
                    validator: (val) =>
                        (val?.isEmpty ?? true)
                            ? 'Body message is required'
                            : null,
                  ),
                ],
              ),
            ),

            // ✅ IMAGE UPLOAD
            _buildCardSection(
              isDark: isDark,
              title: 'Notification Image',
              icon: Icons.image_rounded,
              child: _buildImageUploader(isDark, accentColor),
            ),

            // ✅ ACTION URL
            _buildCardSection(
              isDark: isDark,
              title: 'Action URL',
              icon: Icons.link_rounded,
              child: Column(
                children: [
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: AppColors.info.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(
                        color: AppColors.info.withValues(alpha: 0.3),
                      ),
                    ),
                    child: Row(
                      children: [
                        Icon(
                          Icons.info_outline,
                          color: AppColors.info,
                          size: 20,
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            'Auto-filled for orders. Leave empty for broadcast.',
                            style: TextStyle(
                              fontSize: 12,
                              color: isDark
                                  ? AppColors.textLight
                                  : AppColors.textPrimary,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 12),
                  _buildTextFormField(
                    controller: _actionUrlController,
                    label: 'Deep Link URL',
                    icon: Icons.link,
                    isDark: isDark,
                  ),
                ],
              ),
            ),

            const SizedBox(height: 24),

            // ✅ SEND BUTTON
            SizedBox(
              width: double.infinity,
              height: 56,
              child: ElevatedButton.icon(
                onPressed: _isLoading ? null : _sendNotification,
                icon: _isLoading
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          valueColor:
                              AlwaysStoppedAnimation<Color>(
                                  Colors.white),
                        ),
                      )
                    : const Icon(Icons.send_rounded, size: 24),
                label: Text(
                  _isLoading
                      ? 'Sending...'
                      : 'Send Notification',
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                style: ElevatedButton.styleFrom(
                  backgroundColor: accentColor,
                  foregroundColor: isDark
                      ? AppColors.textPrimary
                      : AppColors.white,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                  elevation: 2,
                ),
              ),
            ),

            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }

  // ✅ ORDER STATUS TEMPLATES WIDGET
  Widget _buildOrderStatusTemplates(bool isDark, Color accentColor) {
    return GridView.count(
      crossAxisCount: 2,
      crossAxisSpacing: 12,
      mainAxisSpacing: 12,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      children: _orderStatusTemplates.keys
          .map((status) => _buildStatusTemplateCard(
                status,
                _orderStatusTemplates[status]!['icon'] ?? '📦',
                isDark,
                accentColor,
              ))
          .toList(),
    );
  }

  Widget _buildStatusTemplateCard(
    String status,
    String icon,
    bool isDark,
    Color accentColor,
  ) {
    final isSelected = _selectedOrderStatus == status;
    return InkWell(
      onTap: () {
        _filterOrdersByStatus(status);
        _useTemplate(status, true);
      },
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: isSelected
              ? accentColor.withValues(alpha: 0.1)
              : (isDark
                  ? AppColors.surfaceDarkVariant
                  : AppColors.surfaceVariant),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: isSelected
                ? accentColor
                : (isDark ? AppColors.borderDark : AppColors.border),
            width: isSelected ? 2 : 1,
          ),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(
              icon,
              style: const TextStyle(fontSize: 32),
            ),
            const SizedBox(height: 8),
            Text(
              status.replaceAll('_', '\n').toUpperCase(),
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.bold,
                color: isSelected
                    ? accentColor
                    : (isDark
                        ? AppColors.textLight
                        : AppColors.textPrimary),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTypeGrid(bool isDark, Color accentColor) {
    return GridView.count(
      crossAxisCount: 2,
      crossAxisSpacing: 12,
      mainAxisSpacing: 12,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      children: [
        _buildTypeCard('general', Icons.notifications_rounded,
            'General', AppColors.info, isDark, accentColor),
        _buildTypeCard('order', Icons.local_shipping_rounded,
            'Order Update', AppColors.warning, isDark, accentColor),
        _buildTypeCard('promotion', Icons.local_offer_rounded,
            'Promotion', AppColors.favorite, isDark, accentColor),
        _buildTypeCard('urgent', Icons.priority_high_rounded,
            'Urgent', AppColors.error, isDark, accentColor),
      ],
    );
  }

  Widget _buildTypeCard(String type, IconData icon, String label,
      Color color, bool isDark, Color accentColor) {
    final isSelected = _notificationType == type;
    return InkWell(
      onTap: () => setState(() => _notificationType = type),
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: isSelected
              ? accentColor.withValues(alpha: 0.1)
              : (isDark
                  ? AppColors.surfaceDarkVariant
                  : AppColors.surfaceVariant),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: isSelected
                ? accentColor
                : (isDark ? AppColors.borderDark : AppColors.border),
            width: isSelected ? 2 : 1,
          ),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              icon,
              color: isSelected
                  ? accentColor
                  : (isDark
                      ? AppColors.textLightSecondary
                      : AppColors.textSecondary),
              size: 32,
            ),
            const SizedBox(height: 8),
            Text(
              label,
              style: TextStyle(
                color: isSelected
                    ? accentColor
                    : (isDark
                        ? AppColors.textLight
                        : AppColors.textPrimary),
                fontWeight: FontWeight.bold,
                fontSize: 12,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildUserSelection(bool isDark) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (_users.isEmpty)
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppColors.warning.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                  color: AppColors.warning.withValues(alpha: 0.3)),
            ),
            child: Row(
              children: [
                Icon(Icons.info_outline, color: AppColors.warning),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    'No users found',
                    style: TextStyle(
                      color: isDark
                          ? AppColors.textLight
                          : AppColors.textPrimary,
                    ),
                  ),
                ),
              ],
            ),
          )
        else
          DropdownButtonFormField<String>(
            initialValue: _selectedUserId,
            decoration: _buildInputDecoration(
              label: 'Choose a user',
              icon: Icons.person_search,
              isDark: isDark,
            ),
            dropdownColor: isDark
                ? AppColors.surfaceDarkVariant
                : AppColors.surface,
            style: TextStyle(
              color: isDark
                  ? AppColors.textLight
                  : AppColors.textPrimary,
            ),
            items: _users
                .map(
                  (user) => DropdownMenuItem<String>(
                    value: user['id'] as String,
                    child: Text(
                      '${user['name']} (${user['email']})',
                      style: TextStyle(
                        color: isDark
                            ? AppColors.textLight
                            : AppColors.textPrimary,
                      ),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                )
                .toList(),
            onChanged: (value) =>
                setState(() => _selectedUserId = value),
            validator: (value) {
              if (_sendType == 'single' && value == null) {
                return 'Please select a user';
              }
              return null;
            },
          ),
      ],
    );
  }

  Widget _buildImageUploader(bool isDark, Color accentColor) {
    return Container(
      decoration: BoxDecoration(
        color: isDark
            ? AppColors.surfaceDarkVariant
            : AppColors.surfaceVariant.withValues(alpha: 0.5),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color:
              isDark ? AppColors.borderDark : AppColors.border,
        ),
      ),
      padding: const EdgeInsets.all(16),
      child: Column(
        children: [
          if (_uploadedImageUrl != null &&
              _uploadedImageUrl!.isNotEmpty)
            Stack(
              children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(12),
                  child: Image.network(
                    _uploadedImageUrl!,
                    height: 200,
                    width: double.infinity,
                    fit: BoxFit.cover,
                    errorBuilder: (_, __, ___) =>
                        _buildImagePlaceholder(isDark, height: 200),
                  ),
                ),
                Positioned(
                  top: 8,
                  right: 8,
                  child: IconButton(
                    icon: const Icon(Icons.close_rounded),
                    color: AppColors.white,
                    style: IconButton.styleFrom(
                      backgroundColor: Colors.black54,
                    ),
                    onPressed: () {
                      setState(() {
                        _uploadedImageUrl = null;
                        _imageUrlController.clear();
                        _selectedImageFile = null;
                      });
                    },
                  ),
                ),
              ],
            )
          else
            Column(
              children: [
                Icon(
                  Icons.cloud_upload_outlined,
                  size: 64,
                  color: isDark
                      ? AppColors.textLightHint
                      : AppColors.textHint,
                ),
                const SizedBox(height: 16),
                Text(
                  'Upload notification image',
                  style: TextStyle(
                    color: isDark
                        ? AppColors.textLightSecondary
                        : AppColors.textSecondary,
                    fontSize: 14,
                  ),
                ),
                const SizedBox(height: 12),
                ElevatedButton.icon(
                  onPressed:
                      _isUploadingImage ? null : _pickImage,
                  icon: _isUploadingImage
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                          ),
                        )
                      : const Icon(Icons.upload_file_rounded),
                  label: Text(
                    _isUploadingImage
                        ? 'Uploading...'
                        : 'Choose Image',
                  ),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: accentColor,
                    foregroundColor: isDark
                        ? AppColors.textPrimary
                        : AppColors.white,
                  ),
                ),
                const SizedBox(height: 12),
                Text(
                  'OR',
                  style: TextStyle(
                    color: isDark
                        ? AppColors.textLightSecondary
                        : AppColors.textSecondary,
                    fontSize: 12,
                  ),
                ),
                const SizedBox(height: 12),
                _buildTextFormField(
                  controller: _imageUrlController,
                  label: 'Paste Image URL',
                  icon: Icons.link,
                  isDark: isDark,
                ),
              ],
            ),
        ],
      ),
    );
  }

  Widget _buildHistoryTab(bool isDark, Color accentColor) {
    return StreamBuilder<QuerySnapshot>(
      stream: FirebaseFirestore.instance
          .collection('notification_history')
          .orderBy('timestamp', descending: true)
          .limit(100)
          .snapshots(),
      builder: (context, snapshot) {
        if (snapshot.hasError) {
          return Center(
            child: Text(
              'Error: ${snapshot.error}',
              style: const TextStyle(color: AppColors.error),
            ),
          );
        }
        if (!snapshot.hasData) {
          return _buildShimmerList(isDark);
        }
        final notifications = snapshot.data!.docs;

        if (notifications.isEmpty) {
          return _buildEmptyState(
            isDark,
            Icons.history_rounded,
            'No Notification History',
          );
        }

        return ListView.separated(
          padding: const EdgeInsets.all(16),
          itemCount: notifications.length,
          separatorBuilder: (context, index) =>
              const SizedBox(height: 12),
          itemBuilder: (context, index) {
            final notif =
                notifications[index].data() as Map<String, dynamic>;
            final timestamp = notif['timestamp'] as Timestamp?;
            final type = notif['type'] ?? 'general';
            final color = _getTypeColor(type);

            return Container(
              decoration: BoxDecoration(
                color: isDark
                    ? AppColors.surfaceDark
                    : AppColors.surface,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: isDark
                      ? AppColors.borderDark
                      : AppColors.border,
                ),
                boxShadow: [
                  BoxShadow(
                    color: isDark
                        ? AppColors.shadowDark
                        : AppColors.shadowLight,
                    blurRadius: 8,
                    offset: const Offset(0, 2),
                  ),
                ],
              ),
              child: ListTile(
                leading: Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: color.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Icon(
                    _getTypeIcon(type),
                    color: color,
                  ),
                ),
                title: Text(
                  notif['title'] ?? 'No title',
                  style: TextStyle(
                    fontWeight: FontWeight.bold,
                    color: isDark
                        ? AppColors.textLight
                        : AppColors.textPrimary,
                  ),
                ),
                subtitle: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const SizedBox(height: 4),
                    Text(
                      notif['body'] ?? 'No message',
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: isDark
                            ? AppColors.textLightSecondary
                            : AppColors.textSecondary,
                      ),
                    ),
                    if (timestamp != null) ...[
                      const SizedBox(height: 4),
                      Text(
                        _formatTimestamp(timestamp),
                        style: TextStyle(
                          fontSize: 12,
                          color: isDark
                              ? AppColors.textLightHint
                              : AppColors.textHint,
                        ),
                      ),
                    ],
                  ],
                ),
                trailing: Chip(
                  label: Text(
                    '${notif['recipientCount'] ?? 1}',
                    style: AppTextStyles.bodySmall.copyWith(
                      color: accentColor,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  backgroundColor: accentColor.withValues(alpha: 0.1),
                  side: BorderSide(
                    color: accentColor.withValues(alpha: 0.3),
                  ),
                ),
              ),
            );
          },
        );
      },
    );
  }

  // ✅ ADVANCED ANALYTICS TAB
  Widget _buildAnalyticsTab(bool isDark, Color accentColor) {
    return Consumer2<AdminProvider, OrderProvider>(
      builder: (context, adminProvider, orderProvider, child) {
        final adminStats = adminProvider.dashboardStats;
        final allOrders = orderProvider.orders;
        final orderStats = orderProvider.getOrderStatistics();
        final totalSales = orderProvider.getTotalSales();

        return SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          physics: const AlwaysScrollableScrollPhysics(),
          child: Column(
            children: [
              // ✅ KPI CARDS
              _buildOverviewGrid(
                totalSales: totalSales,
                totalOrders: orderStats['total'] ?? 0,
                totalUsers: adminStats['users'] ?? 0,
                isDark: isDark,
              ),
              const SizedBox(height: 16),

              // ✅ NOTIFICATIONS BY CATEGORY CHART
              _buildCategoryAnalyticsChart(isDark, accentColor),
              const SizedBox(height: 16),

              // ✅ ORDER STATUS DISTRIBUTION
              _buildOrderStatusChart(orderStats, isDark, accentColor),
              const SizedBox(height: 16),

              // ✅ NOTIFICATION HISTORY TABLE
              _buildNotificationStatsTable(isDark, accentColor),
            ],
          ),
        );
      },
    );
  }

  // ✅ NOTIFICATIONS BY CATEGORY
  Widget _buildCategoryAnalyticsChart(bool isDark, Color accentColor) {
    return StreamBuilder<QuerySnapshot>(
      stream: FirebaseFirestore.instance
          .collection('notification_history')
          .orderBy('timestamp', descending: true)
          .limit(500)
          .snapshots(),
      builder: (context, snapshot) {
        if (!snapshot.hasData) {
          return _buildShimmerLoading(isDark);
        }

        final notifications = snapshot.data!.docs;
        final Map<String, int> categoryCounts = {};

        for (var doc in notifications) {
          final data = doc.data() as Map<String, dynamic>;
          final category = data['category'] ?? 'general';
          categoryCounts[category] = (categoryCounts[category] ?? 0) + 1;
        }

        final chartData = _generateCategoryChartData(categoryCounts, isDark);

        return _buildCardSection(
          isDark: isDark,
          title: 'Notifications by Category',
          icon: Icons.pie_chart_rounded,
          child: SizedBox(
            height: 300,
            child: Row(
              children: [
                Expanded(
                  flex: 2,
                  child: PieChart(
                    PieChartData(
                      sections: chartData.isNotEmpty
                          ? chartData
                          : [_buildEmptyPieSection(isDark)],
                      centerSpaceRadius: 40,
                      sectionsSpace: 2,
                    ),
                  )
                      .animate()
                      .fadeIn(duration: 500.ms)
                      .scale(
                          begin: const Offset(0.8, 0.8)),
                ),
                const SizedBox(width: 16),
                Expanded(
                  flex: 1,
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: categoryCounts.entries
                        .map((e) => _buildCategoryLegendItem(
                              e.key,
                              e.value,
                              _getCategoryColor(e.key),
                              isDark,
                            ))
                        .toList(),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  List<PieChartSectionData> _generateCategoryChartData(
      Map<String, int> counts, bool isDark) {
    final colors = {
      'general': AppColors.info,
      'order': AppColors.warning,
      'promotion': AppColors.favorite,
      'urgent': AppColors.error,
    };

    return counts.entries
        .where((entry) => entry.value > 0)
        .map((entry) {
      return PieChartSectionData(
        color: colors[entry.key] ?? AppColors.info,
        value: entry.value.toDouble(),
        title: '${entry.value}',
        radius: 80,
        titleStyle: AppTextStyles.bodyMedium.copyWith(
          fontWeight: FontWeight.bold,
          color: AppColors.white,
          shadows: const [
            Shadow(blurRadius: 2, color: Colors.black38),
          ],
        ),
      );
    }).toList();
  }

  Color _getCategoryColor(String category) {
    switch (category.toLowerCase()) {
      case 'order':
        return AppColors.warning;
      case 'promotion':
        return AppColors.favorite;
      case 'urgent':
        return AppColors.error;
      default:
        return AppColors.info;
    }
  }

  Widget _buildCategoryLegendItem(
      String category, int count, Color color, bool isDark) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6.0),
      child: Row(
        children: [
          Container(
            width: 14,
            height: 14,
            decoration: BoxDecoration(
              color: color,
              shape: BoxShape.circle,
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              '${category[0].toUpperCase()}${category.substring(1)}',
              style: AppTextStyles.bodySmall.copyWith(
                color: isDark
                    ? AppColors.textLightSecondary
                    : AppColors.textSecondary,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          Text(
            '$count',
            style: AppTextStyles.bodySmall.copyWith(
              color: color,
              fontWeight: FontWeight.bold,
            ),
          ),
        ],
      ),
    );
  }

  // ✅ ORDER STATUS DISTRIBUTION
  Widget _buildOrderStatusChart(
      Map<String, int> stats, bool isDark, Color accentColor) {
    final statusData = _generateOrderStatusChartData(stats, isDark);

    return _buildCardSection(
      isDark: isDark,
      title: 'Order Status Distribution',
      icon: Icons.bar_chart_rounded,
      child: SizedBox(
        height: 250,
        child: BarChart(
          BarChartData(
            alignment: BarChartAlignment.spaceAround,
            maxY: (stats.values.isNotEmpty
                ? stats.values.reduce((a, b) => a > b ? a : b).toDouble()
                : 10.0),
            barTouchData: BarTouchData(
              touchTooltipData: BarTouchTooltipData(
                getTooltipItem: (group, groupIndex, rod, rodIndex) {
                  return BarTooltipItem(
                    '${rod.toY.toInt()}\norders',
                    TextStyle(
                      color: AppColors.white,
                      fontWeight: FontWeight.bold,
                    ),
                  );
                },
              ),
            ),
            titlesData: FlTitlesData(
              show: true,
              bottomTitles: AxisTitles(
                sideTitles: SideTitles(
                  showTitles: true,
                  getTitlesWidget: (value, meta) {
                    const statuses = [
                      'pending',
                      'processing',
                      'shipped',
                      'delivered',
                      'cancelled',
                    ];
                    final index = value.toInt();
                    if (index < 0 || index >= statuses.length) {
                      return const SizedBox.shrink();
                    }
                    return Text(
                      statuses[index].toUpperCase(),
                      style: AppTextStyles.bodySmall.copyWith(
                        color: isDark
                            ? AppColors.textLightHint
                            : AppColors.textHint,
                      ),
                    );
                  },
                ),
              ),
              leftTitles: AxisTitles(
                sideTitles: SideTitles(
                  showTitles: true,
                  getTitlesWidget: (value, meta) {
                    return Text(
                      '${value.toInt()}',
                      style: AppTextStyles.bodySmall.copyWith(
                        color: isDark
                            ? AppColors.textLightHint
                            : AppColors.textHint,
                      ),
                    );
                  },
                ),
              ),
              topTitles: const AxisTitles(
                sideTitles: SideTitles(showTitles: false),
              ),
              rightTitles: const AxisTitles(
                sideTitles: SideTitles(showTitles: false),
              ),
            ),
            borderData: FlBorderData(show: false),
            barGroups: statusData,
          ),
        ),
      ),
    );
  }

  List<BarChartGroupData> _generateOrderStatusChartData(
      Map<String, int> stats, bool isDark) {
    const statuses = [
      'pending',
      'processing',
      'shipped',
      'delivered',
      'cancelled',
    ];

    final colors = {
      'pending': AppColors.pending,
      'processing': AppColors.processing,
      'shipped': AppColors.shipped,
      'delivered': AppColors.delivered,
      'cancelled': AppColors.cancelled,
    };

    return List.generate(statuses.length, (index) {
      final status = statuses[index];
      final value = stats[status]?.toDouble() ?? 0.0;
      return BarChartGroupData(
        x: index,
        barRods: [
          BarChartRodData(
            toY: value,
            color: colors[status] ?? AppColors.info,
            width: 24,
            borderRadius: const BorderRadius.vertical(
              top: Radius.circular(8),
            ),
          ),
        ],
      );
    });
  }

  // ✅ NOTIFICATION STATS TABLE
  Widget _buildNotificationStatsTable(bool isDark, Color accentColor) {
    return StreamBuilder<QuerySnapshot>(
      stream: FirebaseFirestore.instance
          .collection('notification_history')
          .orderBy('timestamp', descending: true)
          .limit(10)
          .snapshots(),
      builder: (context, snapshot) {
        if (!snapshot.hasData) {
          return _buildShimmerLoading(isDark);
        }

        final notifications = snapshot.data!.docs;

        return _buildCardSection(
          isDark: isDark,
          title: 'Recent Notifications',
          icon: Icons.history_edu_rounded,
          child: SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: DataTable(
              headingRowColor:
                  WidgetStateProperty.all(accentColor.withValues(alpha: 0.1)),
              columns: const [
                DataColumn(label: Text('Title')),
                DataColumn(label: Text('Type')),
                DataColumn(label: Text('Recipients')),
                DataColumn(label: Text('Time')),
              ],
              rows: notifications
                  .map((doc) {
                    final data = doc.data() as Map<String, dynamic>;
                    final timestamp = data['timestamp'] as Timestamp?;
                    return DataRow(
                      cells: [
                        DataCell(
                          SizedBox(
                            width: 150,
                            child: Text(
                              data['title'] ?? 'N/A',
                              overflow: TextOverflow.ellipsis,
                              maxLines: 1,
                            ),
                          ),
                        ),
                        DataCell(
                          Chip(
                            label: Text(
                              (data['type'] ?? 'general').toString().toUpperCase(),
                              style: const TextStyle(fontSize: 10),
                            ),
                            backgroundColor: _getCategoryColor(
                              data['type'] ?? 'general',
                            ).withValues(alpha: 0.2),
                          ),
                        ),
                        DataCell(
                          Text('${data['recipientCount'] ?? 1}'),
                        ),
                        DataCell(
                          Text(
                            timestamp != null
                                ? _formatTimestamp(timestamp)
                                : 'N/A',
                            style: const TextStyle(fontSize: 12),
                          ),
                        ),
                      ],
                    );
                  })
                  .toList(),
            ),
          ),
        );
      },
    );
  }

  // ✅ HELPER WIDGETS
  Widget _buildCardSection({
    required Widget child,
    required bool isDark,
    String? title,
    IconData? icon,
  }) {
    final accentColor =
        isDark ? AppColors.primaryLight : AppColors.primary;
    final cardColor =
        isDark ? AppColors.surfaceDark : AppColors.surface;

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: cardColor,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color:
              isDark ? AppColors.borderDark : AppColors.border,
          width: 1,
        ),
        boxShadow: [
          BoxShadow(
            color: isDark
                ? AppColors.shadowDark
                : AppColors.shadowLight,
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
              padding:
                  const EdgeInsets.fromLTRB(16, 14, 16, 14),
              decoration: BoxDecoration(
                border: Border(
                  bottom: BorderSide(
                    color: isDark
                        ? AppColors.borderDark
                        : AppColors.border,
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
                        color: isDark
                            ? AppColors.textLight
                            : AppColors.textPrimary,
                      ),
                    ),
                  ),
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

  Widget _buildShimmerLoading(bool isDark) {
    return Shimmer.fromColors(
      baseColor: isDark
          ? AppColors.surfaceDarkVariant
          : AppColors.shimmerBase,
      highlightColor: isDark
          ? AppColors.surfaceDarkContainer
          : AppColors.shimmerHighlight,
      child: Container(
        height: 300,
        decoration: BoxDecoration(
          color: isDark
              ? AppColors.surfaceDark
              : AppColors.surface,
          borderRadius: BorderRadius.circular(12),
        ),
      ),
    );
  }

  Widget _buildShimmerList(bool isDark) {
    return Shimmer.fromColors(
      baseColor: isDark
          ? AppColors.surfaceDarkVariant
          : AppColors.shimmerBase,
      highlightColor: isDark
          ? AppColors.surfaceDarkContainer
          : AppColors.shimmerHighlight,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: List.generate(
          3,
          (index) => Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: Container(
              height: 100,
              decoration: BoxDecoration(
                color: isDark
                    ? AppColors.surfaceDark
                    : AppColors.surface,
                borderRadius: BorderRadius.circular(12),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildEmptyState(
      bool isDark, IconData icon, String message) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            icon,
            size: 80,
            color: isDark
                ? AppColors.textLightDisabled
                : AppColors.textDisabled,
          ),
          const SizedBox(height: 10),
          Text(
            message,
            style: TextStyle(
              color: isDark
                  ? AppColors.textLightSecondary
                  : AppColors.textSecondary,
              fontSize: 16,
            ),
          ),
        ],
      ),
    );
  }

  PieChartSectionData _buildEmptyPieSection(bool isDark) {
    return PieChartSectionData(
      color: isDark
          ? AppColors.surfaceDarkVariant
          : AppColors.surfaceVariant,
      value: 1,
      title: 'N/A',
      radius: 80,
      titleStyle: AppTextStyles.bodyMedium.copyWith(
        fontWeight: FontWeight.bold,
        color: isDark
            ? AppColors.textLightHint
            : AppColors.textHint,
      ),
    );
  }

  InputDecoration _buildInputDecoration({
    required String label,
    required IconData icon,
    required bool isDark,
  }) {
    return InputDecoration(
      labelText: label,
      labelStyle: TextStyle(
        color: isDark
            ? AppColors.textLightSecondary
            : AppColors.textSecondary,
      ),
      prefixIcon: Icon(
        icon,
        color: isDark
            ? AppColors.textLightHint
            : AppColors.textHint,
      ),
      filled: true,
      fillColor:
          isDark ? AppColors.surfaceDark : AppColors.surface,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide(
          color:
              isDark ? AppColors.borderDark : AppColors.border,
        ),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide(
          color:
              isDark ? AppColors.borderDark : AppColors.border,
        ),
      ),
    );
  }

  Widget _buildTextFormField({
    required TextEditingController controller,
    required String label,
    required IconData icon,
    required bool isDark,
    String? Function(String?)? validator,
    int maxLines = 1,
  }) {
    return TextFormField(
      controller: controller,
      validator: validator,
      maxLines: maxLines,
      style: TextStyle(
        color: isDark
            ? AppColors.textLight
            : AppColors.textPrimary,
      ),
      decoration: _buildInputDecoration(
        label: label,
        icon: icon,
        isDark: isDark,
      ),
    );
  }

  Widget _buildImagePlaceholder(bool isDark,
      {double height = 120}) {
    return Container(
      height: height,
      decoration: BoxDecoration(
        color: isDark
            ? AppColors.surfaceDark
            : AppColors.surfaceVariant,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Icon(
        Icons.image_not_supported_outlined,
        size: 48,
        color: isDark
            ? AppColors.textLightHint
            : AppColors.textHint,
      ),
    );
  }

  Color _getTypeColor(String type) {
    switch (type.toLowerCase()) {
      case 'order':
        return AppColors.warning;
      case 'promotion':
        return AppColors.favorite;
      case 'urgent':
        return AppColors.error;
      default:
        return AppColors.info;
    }
  }

  IconData _getTypeIcon(String type) {
    switch (type.toLowerCase()) {
      case 'order':
        return Icons.local_shipping;
      case 'promotion':
        return Icons.local_offer;
      case 'urgent':
        return Icons.priority_high;
      default:
        return Icons.notifications;
    }
  }

  String _formatTimestamp(Timestamp timestamp) {
    final date = timestamp.toDate();
    final now = DateTime.now();
    final difference = now.difference(date);

    if (difference.inMinutes < 1) {
      return 'Just now';
    } else if (difference.inMinutes < 60) {
      return '${difference.inMinutes}m ago';
    } else if (difference.inHours < 24) {
      return '${difference.inHours}h ago';
    } else {
      return '${difference.inDays}d ago';
    }
  }

  Widget _buildLoadingState(bool isDark) {
    return Center(
      child: CircularProgressIndicator(
        color:
            isDark ? AppColors.textLight : AppColors.textPrimary,
      ),
    );
  }

  Widget _buildOverviewGrid({
    required double totalSales,
    required int totalOrders,
    required int totalUsers,
    required bool isDark,
  }) {
    final cf = NumberFormat.compactCurrency(
      symbol: "₹",
      locale: "en_IN",
      decimalDigits: 0,
    );

    return GridView.count(
      crossAxisCount: 2,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      childAspectRatio: 1.5,
      crossAxisSpacing: 16,
      mainAxisSpacing: 16,
      children: [
        _buildStatItem(
          "Total Sales",
          cf.format(totalSales),
          Icons.currency_rupee_rounded,
          AppColors.success,
          isDark,
        ),
        _buildStatItem(
          "Total Orders",
          "$totalOrders",
          Icons.shopping_cart_rounded,
          AppColors.info,
          isDark,
        ),
        _buildStatItem(
          "Total Users",
          "$totalUsers",
          Icons.people_rounded,
          AppColors.warning,
          isDark,
        ),
        _buildStatItem(
          "Notifications Sent",
          "∞",
          Icons.notifications_rounded,
          AppColors.processing,
          isDark,
        ),
      ],
    );
  }

  Widget _buildStatItem(
    String title,
    String value,
    IconData icon,
    Color color,
    bool isDark,
  ) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isDark
            ? AppColors.surfaceDark
            : AppColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color:
              isDark ? AppColors.borderDark : AppColors.border,
        ),
        boxShadow: [
          BoxShadow(
            color: isDark
                ? AppColors.shadowDark
                : AppColors.shadowLight,
            blurRadius: 8,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(icon, color: color, size: 20),
          ),
          const Spacer(),
          Text(
            value,
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.w800,
              color: color,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: 2),
          Text(
            title,
            style: AppTextStyles.bodySmall.copyWith(
              color: isDark
                  ? AppColors.textLightSecondary
                  : AppColors.textSecondary,
              fontWeight: FontWeight.w500,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    );
  }
}