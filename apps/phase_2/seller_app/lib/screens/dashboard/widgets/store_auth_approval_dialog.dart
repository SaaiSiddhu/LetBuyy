// lib/screens/dashboard/widgets/store_auth_approval_dialog.dart
// 🏬 Store Builder Authentication Approval Dialog

import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:cloud_functions/cloud_functions.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';

/// Store Auth Request model
class StoreAuthRequest {
  final String id;
  final String sellerId;
  final String sellerEmail;
  final String deviceInfo;
  final String? location;
  final DateTime requestedAt;
  final DateTime expiresAt;

  StoreAuthRequest({
    required this.id,
    required this.sellerId,
    required this.sellerEmail,
    required this.deviceInfo,
    this.location,
    required this.requestedAt,
    required this.expiresAt,
  });

  factory StoreAuthRequest.fromFirestore(DocumentSnapshot doc) {
    final data = doc.data() as Map<String, dynamic>;
    return StoreAuthRequest(
      id: doc.id,
      sellerId: data['sellerId'] ?? '',
      sellerEmail: data['sellerEmail'] ?? '',
      deviceInfo: data['deviceInfo'] ?? 'Unknown device',
      location: data['location'],
      requestedAt: (data['requestedAt'] as Timestamp?)?.toDate() ?? DateTime.now(),
      expiresAt: (data['expiresAt'] as Timestamp?)?.toDate() ??
          DateTime.now().add(const Duration(minutes: 5)),
    );
  }

  bool get isExpired => DateTime.now().isAfter(expiresAt);
}

/// Widget that listens for store auth requests and shows approval dialog
class StoreAuthRequestListener extends StatefulWidget {
  final String sellerId;
  final Widget child;

  const StoreAuthRequestListener({
    super.key,
    required this.sellerId,
    required this.child,
  });

  @override
  State<StoreAuthRequestListener> createState() => _StoreAuthRequestListenerState();
}

class _StoreAuthRequestListenerState extends State<StoreAuthRequestListener> {
  bool _isDialogShowing = false;

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<QuerySnapshot>(
      stream: FirebaseFirestore.instance
          .collection('store_auth_requests')
          .where('sellerId', isEqualTo: widget.sellerId)
          .where('status', isEqualTo: 'pending')
          .snapshots(),
      builder: (context, snapshot) {
        // Check for pending requests
        if (snapshot.hasData && snapshot.data!.docs.isNotEmpty && !_isDialogShowing) {
          final request = StoreAuthRequest.fromFirestore(snapshot.data!.docs.first);
          
          if (!request.isExpired) {
            // Show dialog after current frame
            WidgetsBinding.instance.addPostFrameCallback((_) {
              _showApprovalDialog(context, request);
            });
          }
        }
        
        return widget.child;
      },
    );
  }

  void _showApprovalDialog(BuildContext context, StoreAuthRequest request) {
    if (_isDialogShowing) return;
    
    setState(() => _isDialogShowing = true);
    
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => StoreAuthApprovalDialog(
        request: request,
        onApproved: () {
          Navigator.pop(context);
          setState(() => _isDialogShowing = false);
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('✅ Store Builder login approved'),
              backgroundColor: Colors.green,
            ),
          );
        },
        onRejected: () {
          Navigator.pop(context);
          setState(() => _isDialogShowing = false);
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('❌ Store Builder login denied'),
              backgroundColor: Colors.red,
            ),
          );
        },
        onDismissed: () {
          setState(() => _isDialogShowing = false);
        },
      ),
    );
  }
}

/// The actual approval dialog
class StoreAuthApprovalDialog extends StatefulWidget {
  final StoreAuthRequest request;
  final VoidCallback onApproved;
  final VoidCallback onRejected;
  final VoidCallback onDismissed;

  const StoreAuthApprovalDialog({
    super.key,
    required this.request,
    required this.onApproved,
    required this.onRejected,
    required this.onDismissed,
  });

  @override
  State<StoreAuthApprovalDialog> createState() => _StoreAuthApprovalDialogState();
}

class _StoreAuthApprovalDialogState extends State<StoreAuthApprovalDialog> {
  bool _isLoading = false;
  String? _error;

  Future<void> _approve() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      await FirebaseFunctions.instance
          .httpsCallable('approveStoreAuth')
          .call({'requestId': widget.request.id});
      
      widget.onApproved();
    } catch (e) {
      setState(() {
        _isLoading = false;
        _error = 'Failed to approve: ${e.toString()}';
      });
    }
  }

  Future<void> _reject() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      await FirebaseFirestore.instance
          .collection('store_auth_requests')
          .doc(widget.request.id)
          .update({
        'status': 'rejected',
        'respondedAt': FieldValue.serverTimestamp(),
      });
      
      widget.onRejected();
    } catch (e) {
      setState(() {
        _isLoading = false;
        _error = 'Failed to reject: ${e.toString()}';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Dialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
      child: Container(
        width: 340,
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Icon
            Container(
              width: 72,
              height: 72,
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [AppColors.primary, AppColors.primary.withValues(alpha: 0.7)],
                ),
                shape: BoxShape.circle,
                boxShadow: [
                  BoxShadow(
                    color: AppColors.primary.withValues(alpha: 0.3),
                    blurRadius: 20,
                    offset: const Offset(0, 8),
                  ),
                ],
              ),
              child: const Icon(
                Icons.store_rounded,
                color: Colors.white,
                size: 36,
              ),
            ).animate().scale(duration: 400.ms, curve: Curves.elasticOut),
            
            const SizedBox(height: 20),
            
            // Title
            const Text(
              'Store Builder Login',
              style: TextStyle(
                fontSize: 22,
                fontWeight: FontWeight.bold,
              ),
            ).animate().fadeIn(delay: 100.ms),
            
            const SizedBox(height: 8),
            
            // Subtitle
            Text(
              'wants to access your account',
              style: TextStyle(
                color: Colors.grey[600],
                fontSize: 15,
              ),
            ).animate().fadeIn(delay: 200.ms),
            
            const SizedBox(height: 24),
            
            // Device Info Card
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.grey[100],
                borderRadius: BorderRadius.circular(16),
              ),
              child: Column(
                children: [
                  _buildInfoRow(
                    Icons.phone_android_rounded,
                    'Device',
                    widget.request.deviceInfo,
                  ),
                  const SizedBox(height: 12),
                  _buildInfoRow(
                    Icons.access_time_rounded,
                    'Time',
                    'Just now',
                  ),
                  if (widget.request.location != null) ...[
                    const SizedBox(height: 12),
                    _buildInfoRow(
                      Icons.location_on_rounded,
                      'Location',
                      widget.request.location!,
                    ),
                  ],
                ],
              ),
            ).animate().fadeIn(delay: 300.ms).slideY(begin: 0.1),
            
            const SizedBox(height: 20),
            
            // Warning
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.amber[50],
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.amber[200]!),
              ),
              child: Row(
                children: [
                  Icon(Icons.warning_amber_rounded, 
                      color: Colors.amber[700], size: 20),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      'Only approve if you initiated this login',
                      style: TextStyle(
                        color: Colors.amber[800],
                        fontSize: 13,
                      ),
                    ),
                  ),
                ],
              ),
            ).animate().fadeIn(delay: 400.ms),
            
            // Error
            if (_error != null)
              Container(
                margin: const EdgeInsets.only(top: 16),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.red[50],
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  _error!,
                  style: TextStyle(color: Colors.red[700], fontSize: 13),
                ),
              ),
            
            const SizedBox(height: 24),
            
            // Buttons
            if (_isLoading)
              const CircularProgressIndicator()
            else
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: _reject,
                      style: OutlinedButton.styleFrom(
                        foregroundColor: Colors.red,
                        side: const BorderSide(color: Colors.red),
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                      child: const Text('Deny'),
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: ElevatedButton(
                      onPressed: _approve,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.primary,
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                      child: const Text('Approve'),
                    ),
                  ),
                ],
              ).animate().fadeIn(delay: 500.ms),
          ],
        ),
      ),
    );
  }

  Widget _buildInfoRow(IconData icon, String label, String value) {
    return Row(
      children: [
        Container(
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(8),
          ),
          child: Icon(icon, size: 18, color: AppColors.primary),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: TextStyle(
                  color: Colors.grey[600],
                  fontSize: 11,
                ),
              ),
              Text(
                value,
                style: const TextStyle(
                  fontWeight: FontWeight.w600,
                  fontSize: 14,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ],
          ),
        ),
      ],
    );
  }
}
