// lib/screens/sellers/seller_detail_screen.dart
// ADVANCED SELLER DETAIL - TOP GRADE PROFESSIONAL

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:photo_view/photo_view.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:intl/intl.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';

import 'package:letbuyy_models/letbuyy_models.dart';
import 'package:letbuyy_services/letbuyy_services.dart';
import 'package:letbuyy_core/letbuyy_core.dart';
import '../../app/themes/app_colors.dart';

class SellerDetailScreen extends StatefulWidget {
  final String sellerId;
  final SellerModel? seller;

  const SellerDetailScreen({
    super.key,
    required this.sellerId,
    this.seller,
  });

  @override
  State<SellerDetailScreen> createState() => _SellerDetailScreenState();
}

class _SellerDetailScreenState extends State<SellerDetailScreen>
    with TickerProviderStateMixin {
  late TabController _tabController;
  late AnimationController _headerController;
  final TextEditingController _rejectionReasonController = TextEditingController();
  final TextEditingController _adminNotesController = TextEditingController();

  bool _isLoading = true;
  bool _isProcessing = false;
  String? _error;

  Map<String, dynamic>? _sellerData;
  Map<String, dynamic>? _kycSubmission;
  SellerModel? _seller;
  List<Map<String, dynamic>> _statusHistory = [];

  late VerificationStatus _selectedStatus;
  late bool _isActive;
  bool _sendEmail = true;

  static const String _functionsBaseUrl = 'https://us-central1-letbuy-y.cloudfunctions.net';

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 4, vsync: this);
    _headerController = AnimationController(vsync: this, duration: const Duration(seconds: 3))..repeat(reverse: true);
    _selectedStatus = widget.seller?.verificationStatus ?? VerificationStatus.pending;
    _isActive = widget.seller?.isActive ?? true;
    _fetchData();
  }

  @override
  void dispose() {
    _tabController.dispose();
    _headerController.dispose();
    _rejectionReasonController.dispose();
    _adminNotesController.dispose();
    super.dispose();
  }

  Future<void> _fetchData() async {
    try {
      final sellerDoc = await FirebaseFirestore.instance
          .collection('sellers')
          .doc(widget.sellerId)
          .get();

      if (!sellerDoc.exists) throw Exception('Seller not found');

      _sellerData = sellerDoc.data();
      _seller = SellerModel.fromMap(_sellerData!, widget.sellerId);
      _selectedStatus = _seller!.verificationStatus;
      _isActive = _seller!.isActive;

      // Fetch KYC submission
      final kycDoc = await FirebaseFirestore.instance
          .collection('kyc_submissions')
          .doc(widget.sellerId)
          .get();

      if (kycDoc.exists) {
        _kycSubmission = kycDoc.data();
      }

      // Fetch status history (may fail if rules not set up)
      try {
        final historySnap = await FirebaseFirestore.instance
            .collection('sellers')
            .doc(widget.sellerId)
            .collection('status_history')
            .orderBy('timestamp', descending: true)
            .limit(10)
            .get();

        _statusHistory = historySnap.docs.map((d) => {...d.data(), 'id': d.id}).toList();
      } catch (e) {
        // Silently fail - status_history is optional
        debugPrint('Could not fetch status history: $e');
        _statusHistory = [];
      }

      if (mounted) setState(() => _isLoading = false);
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = e.toString();
          _isLoading = false;
        });
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // KYC ACTIONS WITH EMAIL
  // ═══════════════════════════════════════════════════════════════════════════
  Future<void> _approveKYC() async {
    final confirm = await _showEmailConfirmDialog(
      'Approve KYC',
      'Seller will be verified and can start selling on the platform.',
      AppColors.success,
      Icons.check_circle_rounded,
      emailSubject: 'Congratulations! Your KYC has been approved',
      emailPreview: 'Dear ${_seller?.name ?? "Seller"},\n\nYour KYC verification has been approved! You can now start listing products on LetBuyy.\n\nWelcome aboard!',
    );
    if (confirm != true) return;

    setState(() => _isProcessing = true);

    try {
      final response = await http.post(
        Uri.parse('$_functionsBaseUrl/adminReviewKyc'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'sellerId': widget.sellerId,
          'approved': true,
          'adminId': FirebaseAuth.instance.currentUser?.uid ?? 'admin',
          'sendEmail': _sendEmail,
          'adminNotes': _adminNotesController.text.trim(),
        }),
      );

      final data = jsonDecode(response.body);
      final result = data['result'] ?? data;

      if (result['success'] == true) {
        setState(() {
          _sellerData?['verificationStatus'] = 'verified';
          _selectedStatus = VerificationStatus.verified;
        });
        if (mounted) {
          HapticFeedback.heavyImpact();
          _showSuccessAnimation('KYC Approved!', 'Email notification sent to seller');
        }
      } else {
        throw Exception(result['message'] ?? 'Failed to approve KYC');
      }
    } catch (e) {
      if (mounted) SnackbarHelper.showError(context, 'Error: $e');
    } finally {
      if (mounted) setState(() => _isProcessing = false);
    }
  }

  Future<void> _rejectKYC() async {
    final result = await _showRejectDialog();
    if (result == null) return;

    setState(() => _isProcessing = true);

    try {
      final response = await http.post(
        Uri.parse('$_functionsBaseUrl/adminReviewKyc'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'sellerId': widget.sellerId,
          'approved': false,
          'rejectionReason': result['reason'],
          'adminId': FirebaseAuth.instance.currentUser?.uid ?? 'admin',
          'sendEmail': result['sendEmail'],
          'adminNotes': result['notes'],
        }),
      );

      final data = jsonDecode(response.body);
      final r = data['result'] ?? data;

      if (r['success'] == true) {
        setState(() {
          _sellerData?['verificationStatus'] = 'rejected';
          _sellerData?['rejectionReason'] = result['reason'];
          _selectedStatus = VerificationStatus.rejected;
        });
        if (mounted) {
          _showSuccessAnimation('KYC Rejected', 'Seller has been notified');
        }
      } else {
        throw Exception(r['message'] ?? 'Failed to reject KYC');
      }
    } catch (e) {
      if (mounted) SnackbarHelper.showError(context, 'Error: $e');
    } finally {
      if (mounted) setState(() => _isProcessing = false);
    }
  }

  Future<void> _updateSeller() async {
    if (_seller == null) return;
    if (_selectedStatus == _seller!.verificationStatus && _isActive == _seller!.isActive) {
      SnackbarHelper.showError(context, 'No changes to save');
      return;
    }

    final confirm = await _showEmailConfirmDialog(
      'Update Seller',
      'This will update the seller status.',
      AppColors.primary,
      Icons.save_rounded,
      emailSubject: !_isActive ? 'Account Suspended' : 'Account Status Updated',
      emailPreview: !_isActive 
          ? 'Your seller account has been suspended by our admin team.'
          : 'Your account status has been updated.',
    );
    if (confirm != true) return;

    setState(() => _isProcessing = true);

    try {
      // Call the new Firebase function that handles email + push
      final response = await http.post(
        Uri.parse('$_functionsBaseUrl/updateSellerStatus'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'sellerId': widget.sellerId,
          'verificationStatus': _selectedStatus.name,
          'isActive': _isActive,
          'adminId': FirebaseAuth.instance.currentUser?.uid ?? 'admin',
          'sendEmail': _sendEmail,
          'sendPush': true,
          'adminNotes': _adminNotesController.text.trim(),
        }),
      );

      final data = jsonDecode(response.body);
      final result = data['result'] ?? data;

      if (result['success'] == true) {
        // Log status change locally (may fail if rules not set up)
        try {
          await FirebaseFirestore.instance
              .collection('sellers')
              .doc(widget.sellerId)
              .collection('status_history')
              .add({
                'previousStatus': _seller!.verificationStatus.name,
                'newStatus': _selectedStatus.name,
                'previousActive': _seller!.isActive,
                'newActive': _isActive,
                'adminId': FirebaseAuth.instance.currentUser?.uid,
                'timestamp': FieldValue.serverTimestamp(),
                'notes': _adminNotesController.text.trim(),
              });
        } catch (e) {
          debugPrint('Could not log status history: $e');
        }

        if (mounted) {
          final message = !_isActive && _seller!.isActive
              ? 'Seller Suspended!'
              : (_isActive && !_seller!.isActive)
                  ? 'Seller Reactivated!'
                  : 'Status Updated!';
          _showSuccessAnimation(message, _sendEmail ? 'Email notification sent to seller' : 'Changes saved successfully');
          await Future.delayed(const Duration(seconds: 1));
          Navigator.pop(context, true);
        }
      } else {
        throw Exception(result['message'] ?? 'Failed to update seller');
      }
    } catch (e) {
      if (mounted) SnackbarHelper.showError(context, 'Error: $e');
    } finally {
      if (mounted) setState(() => _isProcessing = false);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DIALOGS
  // ═══════════════════════════════════════════════════════════════════════════
  Future<bool?> _showEmailConfirmDialog(
    String title, String message, Color color, IconData icon,
    {required String emailSubject, required String emailPreview}
  ) {
    final isDark = context.read<ThemeProvider>().isDarkMode;
    return showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        backgroundColor: isDark ? AppColors.surfaceDark : Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(icon, color: color, size: 24),
            ),
            const SizedBox(width: 12),
            Expanded(child: Text(title, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18))),
          ],
        ),
        content: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(message, style: TextStyle(fontSize: 14, color: isDark ? Colors.white70 : Colors.grey[700])),
              const SizedBox(height: 20),
              // Email toggle
              SwitchListTile(
                value: _sendEmail,
                onChanged: (v) => setState(() => _sendEmail = v),
                title: const Text('Send Email Notification', style: TextStyle(fontWeight: FontWeight.w600)),
                subtitle: Text('Notify seller via email', style: TextStyle(fontSize: 12, color: isDark ? Colors.white60 : Colors.grey[600])),
                activeThumbColor: color,
                contentPadding: EdgeInsets.zero,
              ),
              if (_sendEmail) ...[
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: isDark ? Colors.black26 : Colors.grey[100],
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: isDark ? AppColors.borderDark : AppColors.border),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Email Preview', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: color)),
                      const SizedBox(height: 8),
                      Text('Subject: $emailSubject', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: isDark ? Colors.white : Colors.black87)),
                      const SizedBox(height: 4),
                      Text(emailPreview, style: TextStyle(fontSize: 11, color: isDark ? Colors.white60 : Colors.grey[600])),
                    ],
                  ),
                ),
              ],
              const SizedBox(height: 16),
              TextField(
                controller: _adminNotesController,
                maxLines: 2,
                decoration: InputDecoration(
                  hintText: 'Add admin notes (optional)...',
                  filled: true,
                  fillColor: isDark ? Colors.black26 : Colors.grey[100],
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                ),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            child: const Text('Cancel'),
            onPressed: () => Navigator.pop(context, false),
          ),
          ElevatedButton.icon(
            icon: Icon(_sendEmail ? Icons.send_rounded : Icons.check_rounded, size: 18, color: Colors.white),
            label: Text(_sendEmail ? 'Confirm & Send' : 'Confirm', style: const TextStyle(color: Colors.white)),
            style: ElevatedButton.styleFrom(
              backgroundColor: color,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
            onPressed: () => Navigator.pop(context, true),
          ),
        ],
      ),
    );
  }

  Future<Map<String, dynamic>?> _showRejectDialog() {
    final isDark = context.read<ThemeProvider>().isDarkMode;
    bool sendEmail = true;
    
    return showDialog<Map<String, dynamic>>(
      context: context,
      builder: (_) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          backgroundColor: isDark ? AppColors.surfaceDark : Colors.white,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
          title: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: AppColors.error.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(Icons.cancel_rounded, color: AppColors.error, size: 24),
              ),
              const SizedBox(width: 12),
              const Expanded(child: Text('Reject KYC', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18))),
            ],
          ),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(
                  controller: _rejectionReasonController,
                  maxLines: 3,
                  decoration: InputDecoration(
                    hintText: 'Enter rejection reason...',
                    labelText: 'Rejection Reason *',
                    filled: true,
                    fillColor: isDark ? Colors.black26 : Colors.grey[100],
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                ),
                const SizedBox(height: 16),
                SwitchListTile(
                  value: sendEmail,
                  onChanged: (v) => setDialogState(() => sendEmail = v),
                  title: const Text('Send Email Notification', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
                  activeThumbColor: AppColors.error,
                  contentPadding: EdgeInsets.zero,
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _adminNotesController,
                  maxLines: 2,
                  decoration: InputDecoration(
                    hintText: 'Admin notes (optional)...',
                    filled: true,
                    fillColor: isDark ? Colors.black26 : Colors.grey[100],
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                  ),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              child: const Text('Cancel'),
              onPressed: () {
                _rejectionReasonController.clear();
                _adminNotesController.clear();
                Navigator.pop(context);
              },
            ),
            ElevatedButton.icon(
              icon: const Icon(Icons.cancel_rounded, size: 18, color: Colors.white),
              label: const Text('Reject', style: TextStyle(color: Colors.white)),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.error,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              onPressed: () {
                final reason = _rejectionReasonController.text.trim();
                if (reason.isEmpty) {
                  SnackbarHelper.showError(context, 'Please enter a rejection reason');
                  return;
                }
                Navigator.pop(context, {
                  'reason': reason,
                  'sendEmail': sendEmail,
                  'notes': _adminNotesController.text.trim(),
                });
                _rejectionReasonController.clear();
                _adminNotesController.clear();
              },
            ),
          ],
        ),
      ),
    );
  }

  void _showSuccessAnimation(String title, String subtitle) {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (_) => Dialog(
        backgroundColor: Colors.transparent,
        child: Container(
          padding: const EdgeInsets.all(32),
          decoration: BoxDecoration(
            color: context.read<ThemeProvider>().isDarkMode ? AppColors.surfaceDark : Colors.white,
            borderRadius: BorderRadius.circular(24),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: AppColors.success.withValues(alpha: 0.1),
                  shape: BoxShape.circle,
                ),
                child: Icon(Icons.check_circle_rounded, color: AppColors.success, size: 60),
              ).animate().scale(duration: 300.ms, curve: Curves.elasticOut),
              const SizedBox(height: 20),
              Text(title, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
              const SizedBox(height: 8),
              Text(subtitle, style: TextStyle(color: Colors.grey[600])),
            ],
          ),
        ),
      ),
    );
    Future.delayed(const Duration(seconds: 2), () {
      if (mounted) Navigator.pop(context);
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // BUILD
  // ═══════════════════════════════════════════════════════════════════════════
  @override
  Widget build(BuildContext context) {
    final isDark = context.watch<ThemeProvider>().isDarkMode;

    if (_isLoading) {
      return Scaffold(
        backgroundColor: isDark ? AppColors.backgroundDark : AppColors.background,
        body: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: AppColors.primary.withValues(alpha: 0.1),
                  shape: BoxShape.circle,
                ),
                child: CircularProgressIndicator(color: AppColors.primary, strokeWidth: 3),
              ),
              const SizedBox(height: 20),
              Text('Loading seller details...', style: TextStyle(color: isDark ? Colors.white60 : Colors.grey[600])),
            ],
          ),
        ),
      );
    }

    if (_error != null) {
      return Scaffold(
        backgroundColor: isDark ? AppColors.backgroundDark : AppColors.background,
        appBar: AppBar(backgroundColor: Colors.transparent, elevation: 0),
        body: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.error_outline_rounded, size: 64, color: AppColors.error),
              const SizedBox(height: 16),
              Text('Error loading data', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
              const SizedBox(height: 8),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 40),
                child: Text(_error!, textAlign: TextAlign.center, style: TextStyle(color: isDark ? Colors.white60 : Colors.grey[600])),
              ),
              const SizedBox(height: 24),
              ElevatedButton.icon(
                onPressed: () {
                  setState(() {
                    _isLoading = true;
                    _error = null;
                  });
                  _fetchData();
                },
                icon: const Icon(Icons.refresh_rounded),
                label: const Text('Retry'),
                style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary),
              ),
            ],
          ),
        ),
      );
    }

    return Scaffold(
      backgroundColor: isDark ? AppColors.backgroundDark : AppColors.background,
      body: NestedScrollView(
        headerSliverBuilder: (context, innerBoxIsScrolled) => [
          // ═══════════════════════════════════════════════════════════════════
          // PREMIUM HEADER
          // ═══════════════════════════════════════════════════════════════════
          SliverAppBar(
            expandedHeight: 280,
            floating: false,
            pinned: true,
            backgroundColor: AppColors.primary,
            foregroundColor: Colors.white,
            flexibleSpace: FlexibleSpaceBar(
              background: Container(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [AppColors.primary, AppColors.secondary],
                  ),
                ),
                child: SafeArea(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const SizedBox(height: 40),
                      // Avatar
                      Stack(
                        alignment: Alignment.bottomRight,
                        children: [
                          Container(
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              border: Border.all(color: Colors.white, width: 4),
                              boxShadow: [
                                BoxShadow(color: Colors.black.withValues(alpha: 0.3), blurRadius: 20),
                              ],
                            ),
                            child: CircleAvatar(
                              radius: 50,
                              backgroundColor: Colors.white,
                              backgroundImage: _seller?.photoUrl != null ? NetworkImage(_seller!.photoUrl!) : null,
                              child: _seller?.photoUrl == null
                                  ? Text(_seller?.name.isNotEmpty == true ? _seller!.name[0].toUpperCase() : 'S',
                                      style: TextStyle(fontSize: 40, fontWeight: FontWeight.bold, color: AppColors.primary))
                                  : null,
                            ),
                          ),
                          Container(
                            padding: const EdgeInsets.all(8),
                            decoration: BoxDecoration(
                              color: _getStatusColor(_seller?.verificationStatus.name ?? 'pending'),
                              shape: BoxShape.circle,
                              border: Border.all(color: Colors.white, width: 3),
                            ),
                            child: Icon(_getStatusIcon(_seller?.verificationStatus.name ?? 'pending'), color: Colors.white, size: 20),
                          ),
                        ],
                      ),
                      const SizedBox(height: 16),
                      Text(_seller?.name ?? 'Unknown', style: const TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.bold)),
                      const SizedBox(height: 4),
                      Text(_seller?.storeName ?? '', style: TextStyle(color: Colors.white70, fontSize: 14)),
                      const SizedBox(height: 12),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                        decoration: BoxDecoration(
                          color: _getStatusColor(_seller?.verificationStatus.name ?? 'pending').withValues(alpha: 0.2),
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: Text(
                          _seller?.verificationStatus.name.toUpperCase() ?? 'PENDING',
                          style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 12),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
            actions: [
              IconButton(
                icon: const Icon(Icons.refresh_rounded),
                onPressed: () {
                  setState(() => _isLoading = true);
                  _fetchData();
                },
              ),
              PopupMenuButton(
                icon: const Icon(Icons.more_vert),
                itemBuilder: (_) => [
                  PopupMenuItem(
                    child: ListTile(
                      leading: Icon(Icons.email_outlined, color: AppColors.primary),
                      title: const Text('Send Email'),
                      dense: true,
                      contentPadding: EdgeInsets.zero,
                    ),
                  ),
                  PopupMenuItem(
                    child: ListTile(
                      leading: Icon(Icons.delete_outline, color: AppColors.error),
                      title: const Text('Delete Seller'),
                      dense: true,
                      contentPadding: EdgeInsets.zero,
                    ),
                  ),
                ],
              ),
            ],
          ),

          // ═══════════════════════════════════════════════════════════════════
          // PREMIUM TAB BAR
          // ═══════════════════════════════════════════════════════════════════
          SliverPersistentHeader(
            pinned: true,
            delegate: _SliverTabBarDelegate(
              TabBar(
                controller: _tabController,
                indicatorColor: AppColors.primary,
                labelColor: AppColors.primary,
                unselectedLabelColor: isDark ? Colors.white60 : Colors.grey[600],
                indicatorWeight: 3,
                indicatorSize: TabBarIndicatorSize.label,
                labelStyle: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                tabs: [
                  Tab(icon: Icon(Icons.person_outline, size: 20), text: 'Overview'),
                  Tab(
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.verified_user_outlined, size: 20),
                        const SizedBox(width: 6),
                        const Text('KYC'),
                        if (_seller?.verificationStatus == VerificationStatus.pending)
                          Container(
                            margin: const EdgeInsets.only(left: 6),
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                            decoration: BoxDecoration(
                              color: AppColors.warning,
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: const Text('!', style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold)),
                          ),
                      ],
                    ),
                  ),
                  Tab(icon: Icon(Icons.edit_outlined, size: 20), text: 'Edit'),
                  Tab(icon: Icon(Icons.history_outlined, size: 20), text: 'History'),
                ],
              ),
              isDark,
            ),
          ),
        ],
        body: TabBarView(
          controller: _tabController,
          children: [
            _buildOverviewTab(isDark),
            _buildKYCTab(isDark),
            _buildEditTab(isDark),
            _buildHistoryTab(isDark),
          ],
        ),
      ),
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TAB 1: OVERVIEW
  // ═══════════════════════════════════════════════════════════════════════════
  Widget _buildOverviewTab(bool isDark) {
    final seller = _seller!;
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        children: [
          // Stats Grid
          Row(
            children: [
              Expanded(child: _buildStatCard('Products', seller.totalProducts.toString(), Icons.inventory_2_rounded, AppColors.primary, isDark)),
              const SizedBox(width: 12),
              Expanded(child: _buildStatCard('Orders', seller.totalOrders.toString(), Icons.shopping_bag_rounded, AppColors.success, isDark)),
            ],
          ).animate().fadeIn().slideY(begin: 0.1),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(child: _buildStatCard('Revenue', '₹${(seller.totalRevenue / 1000).toStringAsFixed(1)}K', Icons.currency_rupee, AppColors.warning, isDark)),
              const SizedBox(width: 12),
              Expanded(child: _buildStatCard('Rating', seller.rating.toStringAsFixed(1), Icons.star_rounded, _getRatingColor(seller.rating), isDark)),
            ],
          ).animate(delay: 100.ms).fadeIn().slideY(begin: 0.1),
          const SizedBox(height: 20),

          // Contact Info
          _buildSectionCard('Contact Information', Icons.contact_mail_outlined, [
            _buildInfoRow(Icons.email_outlined, 'Email', seller.email, isDark),
            _buildInfoRow(Icons.phone_outlined, 'Phone', seller.phone, isDark),
          ], isDark).animate(delay: 200.ms).fadeIn().slideX(begin: 0.05),
          const SizedBox(height: 16),

          // Business Info
          _buildSectionCard('Business Information', Icons.business_outlined, [
            _buildInfoRow(Icons.store_outlined, 'Store Name', seller.storeName, isDark),
            _buildInfoRow(Icons.business_center_outlined, 'Legal Name', seller.businessLegalName, isDark),
            _buildInfoRow(Icons.location_on_outlined, 'Address', seller.fullBusinessAddress, isDark),
            _buildInfoRow(Icons.location_city_outlined, 'Location', '${seller.businessCity}, ${seller.businessState}', isDark),
          ], isDark).animate(delay: 300.ms).fadeIn().slideX(begin: 0.05),
          const SizedBox(height: 16),

          // Tax Info
          _buildSectionCard('Tax Details', Icons.receipt_outlined, [
            _buildInfoRow(Icons.badge_outlined, 'PAN Number', seller.panNumber, isDark),
            _buildInfoRow(Icons.description_outlined, 'GST Number', seller.gstNumber.isEmpty ? (seller.gstExempt ? 'GST Exempt' : 'Not Provided') : seller.gstNumber, isDark),
          ], isDark).animate(delay: 400.ms).fadeIn().slideX(begin: 0.05),
          const SizedBox(height: 16),

          // Account Info
          _buildSectionCard('Account Details', Icons.account_circle_outlined, [
            _buildInfoRow(Icons.calendar_today_outlined, 'Joined', DateFormat('dd MMM yyyy').format(seller.createdAt), isDark),
            _buildInfoRow(Icons.toggle_on_outlined, 'Status', seller.isActive ? 'Active' : 'Suspended', isDark, color: seller.isActive ? AppColors.success : AppColors.error),
          ], isDark).animate(delay: 500.ms).fadeIn().slideX(begin: 0.05),
        ],
      ),
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TAB 2: KYC
  // ═══════════════════════════════════════════════════════════════════════════
  Widget _buildKYCTab(bool isDark) {
    final status = _sellerData?['verificationStatus']?.toString().toLowerCase() ?? 'pending';
    final docs = (_kycSubmission?['documents'] as Map?)?.cast<String, dynamic>() ?? {};

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        children: [
          // Status Card with Actions
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [_getStatusColor(status), _getStatusColor(status).withValues(alpha: 0.7)],
              ),
              borderRadius: BorderRadius.circular(20),
              boxShadow: [
                BoxShadow(color: _getStatusColor(status).withValues(alpha: 0.3), blurRadius: 20, offset: const Offset(0, 10)),
              ],
            ),
            child: Column(
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.2),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Icon(_getStatusIcon(status), color: Colors.white, size: 28),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('KYC Status', style: TextStyle(color: Colors.white70, fontSize: 12)),
                          const SizedBox(height: 4),
                          Text(status.toUpperCase(), style: const TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.bold)),
                        ],
                      ),
                    ),
                  ],
                ),
                if (status == 'pending') ...[
                  const SizedBox(height: 20),
                  Row(
                    children: [
                      Expanded(
                        child: ElevatedButton.icon(
                          onPressed: _isProcessing ? null : _approveKYC,
                          icon: _isProcessing ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)) : const Icon(Icons.check_circle_rounded, color: Colors.white),
                          label: const Text('Approve', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppColors.success,
                            padding: const EdgeInsets.symmetric(vertical: 14),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: ElevatedButton.icon(
                          onPressed: _isProcessing ? null : _rejectKYC,
                          icon: const Icon(Icons.cancel_rounded, color: Colors.white),
                          label: const Text('Reject', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppColors.error,
                            padding: const EdgeInsets.symmetric(vertical: 14),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ],
            ),
          ).animate().fadeIn().slideY(begin: 0.1),
          const SizedBox(height: 24),

          // Documents Section
          _buildSectionHeader('Identity Documents', Icons.folder_copy_outlined, isDark),
          const SizedBox(height: 12),
          if (docs.isEmpty)
            Container(
              padding: const EdgeInsets.all(40),
              decoration: BoxDecoration(
                color: isDark ? AppColors.surfaceDark : Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: isDark ? AppColors.borderDark : AppColors.border),
              ),
              child: Column(
                children: [
                  Icon(Icons.folder_off_outlined, size: 48, color: isDark ? Colors.white30 : Colors.grey[400]),
                  const SizedBox(height: 12),
                  Text('No documents uploaded', style: TextStyle(color: isDark ? Colors.white60 : Colors.grey[600])),
                ],
              ),
            )
          else
            GridView.count(
              crossAxisCount: 2,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              mainAxisSpacing: 12,
              crossAxisSpacing: 12,
              childAspectRatio: 1.1,
              children: docs.entries.map((e) => _buildDocCard(e.key, e.value?.toString() ?? '', isDark)).toList(),
            ).animate().fadeIn(delay: 200.ms),

          // Rejection Reason
          if (status == 'rejected' && _sellerData?['rejectionReason'] != null) ...[
            const SizedBox(height: 24),
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: AppColors.error.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: AppColors.error.withValues(alpha: 0.3)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Icon(Icons.warning_amber_rounded, color: AppColors.error, size: 20),
                      const SizedBox(width: 8),
                      Text('Rejection Reason', style: TextStyle(fontWeight: FontWeight.bold, color: AppColors.error)),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Text(_sellerData!['rejectionReason'].toString(), style: TextStyle(color: isDark ? Colors.white70 : Colors.black87)),
                ],
              ),
            ).animate().fadeIn(delay: 300.ms),
          ],
        ],
      ),
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TAB 3: EDIT
  // ═══════════════════════════════════════════════════════════════════════════
  Widget _buildEditTab(bool isDark) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        children: [
          // Verification Status
          _buildSectionCard('Verification Status', Icons.verified_outlined, [
            ...VerificationStatus.values.map((status) {
              final isSelected = _selectedStatus == status;
              return InkWell(
                onTap: () => setState(() => _selectedStatus = status),
                borderRadius: BorderRadius.circular(12),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 200),
                  padding: const EdgeInsets.all(16),
                  margin: const EdgeInsets.only(bottom: 8),
                  decoration: BoxDecoration(
                    color: isSelected ? _getStatusColor(status.name).withValues(alpha: 0.1) : Colors.transparent,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color: isSelected ? _getStatusColor(status.name) : (isDark ? AppColors.borderDark : AppColors.border),
                      width: isSelected ? 2 : 1,
                    ),
                  ),
                  child: Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(
                          color: _getStatusColor(status.name).withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Icon(_getStatusIcon(status.name), color: _getStatusColor(status.name), size: 20),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(_getStatusLabel(status), style: TextStyle(fontWeight: FontWeight.bold, color: isDark ? Colors.white : Colors.black87)),
                            Text(_getStatusDescription(status), style: TextStyle(fontSize: 12, color: isDark ? Colors.white60 : Colors.grey[600])),
                          ],
                        ),
                      ),
                      if (isSelected) Icon(Icons.check_circle_rounded, color: _getStatusColor(status.name)),
                    ],
                  ),
                ),
              );
            }),
          ], isDark).animate().fadeIn().slideY(begin: 0.1),
          const SizedBox(height: 16),

          // Account Status
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: isDark ? AppColors.surfaceDark : Colors.white,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: isDark ? AppColors.borderDark : AppColors.border),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Icon(Icons.toggle_on_outlined, color: AppColors.primary),
                    const SizedBox(width: 10),
                    Text('Account Status', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: isDark ? Colors.white : Colors.black87)),
                  ],
                ),
                const SizedBox(height: 16),
                SwitchListTile(
                  value: _isActive,
                  onChanged: (v) => setState(() => _isActive = v),
                  title: Text(_isActive ? 'Active' : 'Suspended', style: TextStyle(fontWeight: FontWeight.w600, color: _isActive ? AppColors.success : AppColors.error)),
                  subtitle: Text(_isActive ? 'Seller can access their account and sell products' : 'Seller is suspended from the platform'),
                  activeThumbColor: AppColors.success,
                  contentPadding: EdgeInsets.zero,
                ),
              ],
            ),
          ).animate(delay: 100.ms).fadeIn().slideY(begin: 0.1),
          const SizedBox(height: 24),

          // Save Button
          SizedBox(
            width: double.infinity,
            height: 56,
            child: ElevatedButton.icon(
              onPressed: _isProcessing ? null : _updateSeller,
              icon: _isProcessing
                  ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : const Icon(Icons.save_rounded, color: Colors.white),
              label: Text(_isProcessing ? 'Saving...' : 'Save Changes', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white)),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                elevation: 4,
                shadowColor: AppColors.primary.withValues(alpha: 0.4),
              ),
            ),
          ).animate(delay: 200.ms).fadeIn(),
        ],
      ),
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TAB 4: HISTORY
  // ═══════════════════════════════════════════════════════════════════════════
  Widget _buildHistoryTab(bool isDark) {
    if (_statusHistory.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.history_rounded, size: 64, color: isDark ? Colors.white24 : Colors.grey[300]),
            const SizedBox(height: 16),
            Text('No history available', style: TextStyle(fontSize: 16, color: isDark ? Colors.white60 : Colors.grey[600])),
          ],
        ),
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: _statusHistory.length,
      itemBuilder: (_, i) {
        final h = _statusHistory[i];
        final date = (h['timestamp'] as Timestamp?)?.toDate() ?? DateTime.now();
        return Container(
          margin: const EdgeInsets.only(bottom: 12),
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: isDark ? AppColors.surfaceDark : Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: isDark ? AppColors.borderDark : AppColors.border),
          ),
          child: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: AppColors.primary.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(Icons.history_rounded, color: AppColors.primary),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('${h['previousStatus']} → ${h['newStatus']}', style: TextStyle(fontWeight: FontWeight.bold, color: isDark ? Colors.white : Colors.black87)),
                    const SizedBox(height: 4),
                    Text(DateFormat('dd MMM yyyy, hh:mm a').format(date), style: TextStyle(fontSize: 12, color: isDark ? Colors.white60 : Colors.grey[600])),
                    if (h['notes']?.isNotEmpty == true) ...[
                      const SizedBox(height: 4),
                      Text('Note: ${h['notes']}', style: TextStyle(fontSize: 12, fontStyle: FontStyle.italic, color: isDark ? Colors.white54 : Colors.grey[500])),
                    ],
                  ],
                ),
              ),
            ],
          ),
        ).animate(delay: Duration(milliseconds: i * 100)).fadeIn().slideX(begin: 0.05);
      },
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HELPER WIDGETS
  // ═══════════════════════════════════════════════════════════════════════════
  Widget _buildStatCard(String label, String value, IconData icon, Color color, bool isDark) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: isDark ? AppColors.surfaceDark : Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: isDark ? AppColors.borderDark : AppColors.border),
        boxShadow: [
          BoxShadow(color: color.withValues(alpha: 0.1), blurRadius: 15, offset: const Offset(0, 5)),
        ],
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(14),
            ),
            child: Icon(icon, color: color, size: 24),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(value, style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: isDark ? Colors.white : Colors.black87)),
                Text(label, style: TextStyle(fontSize: 12, color: isDark ? Colors.white60 : Colors.grey[600])),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSectionCard(String title, IconData icon, List<Widget> children, bool isDark) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: isDark ? AppColors.surfaceDark : Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: isDark ? AppColors.borderDark : AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, color: AppColors.primary, size: 20),
              const SizedBox(width: 10),
              Text(title, style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: isDark ? Colors.white : Colors.black87)),
            ],
          ),
          const SizedBox(height: 16),
          ...children,
        ],
      ),
    );
  }

  Widget _buildSectionHeader(String title, IconData icon, bool isDark) {
    return Row(
      children: [
        Icon(icon, color: AppColors.primary, size: 20),
        const SizedBox(width: 10),
        Text(title, style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: isDark ? Colors.white : Colors.black87)),
      ],
    );
  }

  Widget _buildInfoRow(IconData icon, String label, String value, bool isDark, {Color? color}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        children: [
          Icon(icon, size: 18, color: AppColors.primary.withValues(alpha: 0.7)),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label, style: TextStyle(fontSize: 11, color: isDark ? Colors.white54 : Colors.grey[500])),
                const SizedBox(height: 2),
                Text(value.isEmpty ? 'N/A' : value, style: TextStyle(fontSize: 14, color: color ?? (isDark ? Colors.white : Colors.black87))),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDocCard(String title, String url, bool isDark) {
    final displayTitle = title.replaceAll('_', ' ').replaceAll('Url', '').trim();
    return InkWell(
      onTap: url.isNotEmpty ? () => _viewImage(url, displayTitle) : null,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        decoration: BoxDecoration(
          color: isDark ? AppColors.surfaceDark : Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: isDark ? AppColors.borderDark : AppColors.border),
          boxShadow: [
            BoxShadow(color: Colors.black.withValues(alpha: 0.05), blurRadius: 10, offset: const Offset(0, 4)),
          ],
        ),
        child: url.isNotEmpty
            ? ClipRRect(
                borderRadius: BorderRadius.circular(16),
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    CachedNetworkImage(
                      imageUrl: url,
                      fit: BoxFit.cover,
                      placeholder: (_, __) => Container(
                        color: isDark ? Colors.grey[800] : Colors.grey[200],
                        child: const Center(child: CircularProgressIndicator(strokeWidth: 2)),
                      ),
                    ),
                    Positioned(
                      bottom: 0,
                      left: 0,
                      right: 0,
                      child: Container(
                        padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 12),
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            colors: [Colors.black87, Colors.transparent],
                            begin: Alignment.bottomCenter,
                            end: Alignment.topCenter,
                          ),
                        ),
                        child: Text(displayTitle, style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w600)),
                      ),
                    ),
                    Positioned(
                      top: 10,
                      right: 10,
                      child: Container(
                        padding: const EdgeInsets.all(6),
                        decoration: BoxDecoration(
                          color: Colors.black54,
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: const Icon(Icons.zoom_in_rounded, color: Colors.white, size: 18),
                      ),
                    ),
                  ],
                ),
              )
            : Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.image_not_supported_outlined, color: isDark ? Colors.white30 : Colors.grey[400], size: 36),
                  const SizedBox(height: 8),
                  Text(displayTitle, style: TextStyle(fontSize: 11, color: isDark ? Colors.white60 : Colors.grey[600])),
                ],
              ),
      ),
    );
  }

  void _viewImage(String url, String title) {
    Navigator.push(
      context,
      MaterialPageRoute(builder: (_) => _FullScreenImageViewer(url: url, title: title)),
    );
  }

  Color _getStatusColor(String status) {
    switch (status.toLowerCase()) {
      case 'verified': return AppColors.success;
      case 'rejected': return AppColors.error;
      case 'pending': return AppColors.warning;
      case 'suspended': return Colors.grey;
      default: return AppColors.textSecondary;
    }
  }

  IconData _getStatusIcon(String status) {
    switch (status.toLowerCase()) {
      case 'verified': return Icons.verified_rounded;
      case 'rejected': return Icons.cancel_rounded;
      case 'pending': return Icons.hourglass_empty_rounded;
      case 'suspended': return Icons.block_rounded;
      default: return Icons.help_outline;
    }
  }

  String _getStatusLabel(VerificationStatus status) {
    switch (status) {
      case VerificationStatus.pending: return 'Pending Verification';
      case VerificationStatus.verified: return 'Verified';
      case VerificationStatus.rejected: return 'Rejected';
      case VerificationStatus.suspended: return 'Suspended';
    }
  }

  String _getStatusDescription(VerificationStatus status) {
    switch (status) {
      case VerificationStatus.pending: return 'Awaiting KYC review';
      case VerificationStatus.verified: return 'Seller is verified and active';
      case VerificationStatus.rejected: return 'KYC was rejected by admin';
      case VerificationStatus.suspended: return 'Account is suspended';
    }
  }

  Color _getRatingColor(double rating) {
    if (rating >= 4.5) return AppColors.success;
    if (rating >= 3.5) return AppColors.primary;
    if (rating >= 2.5) return AppColors.warning;
    return AppColors.error;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIVER TAB BAR DELEGATE
// ═══════════════════════════════════════════════════════════════════════════
class _SliverTabBarDelegate extends SliverPersistentHeaderDelegate {
  final TabBar tabBar;
  final bool isDark;

  _SliverTabBarDelegate(this.tabBar, this.isDark);

  @override
  double get minExtent => tabBar.preferredSize.height;
  @override
  double get maxExtent => tabBar.preferredSize.height;

  @override
  Widget build(BuildContext context, double shrinkOffset, bool overlapsContent) {
    return Container(
      color: isDark ? AppColors.surfaceDark : Colors.white,
      child: tabBar,
    );
  }

  @override
  bool shouldRebuild(_SliverTabBarDelegate oldDelegate) => false;
}

// ═══════════════════════════════════════════════════════════════════════════
// FULL SCREEN IMAGE VIEWER
// ═══════════════════════════════════════════════════════════════════════════
class _FullScreenImageViewer extends StatelessWidget {
  final String url;
  final String title;

  const _FullScreenImageViewer({required this.url, required this.title});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        title: Text(title, style: const TextStyle(color: Colors.white)),
        iconTheme: const IconThemeData(color: Colors.white),
      ),
      body: PhotoView(
        imageProvider: NetworkImage(url),
        minScale: PhotoViewComputedScale.contained,
        maxScale: PhotoViewComputedScale.covered * 3,
        backgroundDecoration: const BoxDecoration(color: Colors.black),
      ),
    );
  }
}
