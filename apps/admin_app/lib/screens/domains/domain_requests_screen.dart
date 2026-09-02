import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import '../../models/domain_request_model.dart';

/// Admin screen to manage domain provisioning requests
class DomainRequestsScreen extends StatefulWidget {
  const DomainRequestsScreen({super.key});

  @override
  State<DomainRequestsScreen> createState() => _DomainRequestsScreenState();
}

class _DomainRequestsScreenState extends State<DomainRequestsScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  final _firestore = FirebaseFirestore.instance;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Domain Requests'),
        backgroundColor: AppColors.background,
        elevation: 0,
        bottom: TabBar(
          controller: _tabController,
          labelColor: AppColors.primary,
          unselectedLabelColor: Colors.grey,
          indicatorColor: AppColors.primary,
          tabs: const [
            Tab(text: 'Pending', icon: Icon(Icons.pending_outlined, size: 18)),
            Tab(text: 'Connected', icon: Icon(Icons.check_circle_outline, size: 18)),
            Tab(text: 'Rejected', icon: Icon(Icons.cancel_outlined, size: 18)),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          _buildRequestsList('pending'),
          _buildRequestsList('connected'),
          _buildRequestsList('rejected'),
        ],
      ),
    );
  }

  Widget _buildRequestsList(String status) {
    return StreamBuilder<QuerySnapshot>(
      stream: _firestore
          .collection('domain_requests')
          .where('status', isEqualTo: status)
          .orderBy('requestedAt', descending: true)
          .snapshots(),
      builder: (context, snapshot) {
        if (snapshot.hasError) {
          return Center(
            child: Container(
              padding: const EdgeInsets.all(24),
              margin: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: Colors.red.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: Colors.red.withValues(alpha: 0.3)),
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.error_outline, color: Colors.red, size: 48),
                  const SizedBox(height: 16),
                  const Text(
                    'Error Loading Requests',
                    style: TextStyle(
                      color: Colors.red,
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 8),
                  SelectableText(
                    '${snapshot.error}',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: Colors.red[700]),
                  ),
                ],
              ),
            ),
          );
        }

        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Center(child: CircularProgressIndicator());
        }

        if (!snapshot.hasData || snapshot.data!.docs.isEmpty) {
          return Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(
                  status == 'pending'
                      ? Icons.inbox_outlined
                      : status == 'connected'
                          ? Icons.check_circle_outline
                          : Icons.cancel_outlined,
                  size: 64,
                  color: Colors.grey[300],
                ),
                const SizedBox(height: 16),
                Text(
                  'No $status requests',
                  style: TextStyle(color: Colors.grey[500], fontSize: 16),
                ),
              ],
            ),
          );
        }

        final requests = snapshot.data!.docs
            .map((doc) => DomainRequestModel.fromFirestore(doc))
            .toList();

        return ListView.builder(
          padding: const EdgeInsets.all(16),
          itemCount: requests.length,
          itemBuilder: (context, index) {
            return _DomainRequestCard(
              request: requests[index],
              onConnect: () => _markAsConnected(requests[index]),
              onReject: () => _showRejectDialog(requests[index]),
            ).animate(delay: Duration(milliseconds: index * 50)).fadeIn().slideX(begin: 0.1);
          },
        );
      },
    );
  }

  Future<void> _markAsConnected(DomainRequestModel request) async {
    try {
      final adminUid = FirebaseAuth.instance.currentUser?.uid;
      
      // Update domain request
      await _firestore.collection('domain_requests').doc(request.id).update({
        'status': 'connected',
        'processedAt': FieldValue.serverTimestamp(),
        'processedBy': adminUid,
      });

      // Update store's domain status
      await _firestore.collection('stores').doc(request.storeId).update({
        'domainStatus': 'active',
        'domainConnectedAt': FieldValue.serverTimestamp(),
        'domainConnectedBy': adminUid,
      });

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('${request.subdomain}.letbuyy.com is now connected!'),
            backgroundColor: Colors.green,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: $e'), backgroundColor: Colors.red),
        );
      }
    }
  }

  Future<void> _showRejectDialog(DomainRequestModel request) async {
    final notesController = TextEditingController();
    
    final result = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Reject Request'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text('Reject ${request.subdomain}.letbuyy.com?'),
            const SizedBox(height: 16),
            TextField(
              controller: notesController,
              decoration: const InputDecoration(
                labelText: 'Reason (optional)',
                border: OutlineInputBorder(),
              ),
              maxLines: 3,
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, true),
            style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
            child: const Text('Reject'),
          ),
        ],
      ),
    );

    if (result == true) {
      try {
        final adminUid = FirebaseAuth.instance.currentUser?.uid;
        
        await _firestore.collection('domain_requests').doc(request.id).update({
          'status': 'rejected',
          'processedAt': FieldValue.serverTimestamp(),
          'processedBy': adminUid,
          'notes': notesController.text,
        });

        await _firestore.collection('stores').doc(request.storeId).update({
          'domainStatus': 'rejected',
        });

        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Request rejected')),
          );
        }
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Error: $e'), backgroundColor: Colors.red),
          );
        }
      }
    }
  }
}

class _DomainRequestCard extends StatelessWidget {
  final DomainRequestModel request;
  final VoidCallback onConnect;
  final VoidCallback onReject;

  const _DomainRequestCard({
    required this.request,
    required this.onConnect,
    required this.onReject,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 16),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppColors.primary.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(
                    request.isCustomDomainRequest
                        ? Icons.language
                        : Icons.subdirectory_arrow_right,
                    color: AppColors.primary,
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        request.storeName,
                        style: const TextStyle(
                          fontWeight: FontWeight.bold,
                          fontSize: 16,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        request.sellerEmail,
                        style: TextStyle(color: Colors.grey[600], fontSize: 13),
                      ),
                    ],
                  ),
                ),
                _buildStatusBadge(),
              ],
            ),
            
            const SizedBox(height: 16),
            const Divider(),
            const SizedBox(height: 16),
            
            // Domain info
            _buildInfoRow('Subdomain', request.subdomain),
            _buildInfoRow('Requested Domain', request.requestedDomain),
            _buildInfoRow(
              'Requested At',
              _formatDate(request.requestedAt),
            ),
            if (request.processedAt != null)
              _buildInfoRow(
                'Processed At',
                _formatDate(request.processedAt!),
              ),
            
            const SizedBox(height: 16),
            
            // Commands section (for pending requests)
            if (request.isPending) ...[
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.grey[100],
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        const Icon(Icons.dns, size: 18, color: Colors.grey),
                        const SizedBox(width: 8),
                        const Text(
                          'DNS Configuration',
                          style: TextStyle(fontWeight: FontWeight.w600),
                        ),
                        const Spacer(),
                        IconButton(
                          icon: const Icon(Icons.copy, size: 18),
                          onPressed: () {
                            Clipboard.setData(ClipboardData(
                              text: request.dnsInstructions,
                            ));
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(content: Text('DNS instructions copied!')),
                            );
                          },
                          tooltip: 'Copy DNS instructions',
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: Colors.grey[900],
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: SelectableText(
                        request.dnsInstructions,
                        style: const TextStyle(
                          fontFamily: 'monospace',
                          fontSize: 11,
                          color: Colors.greenAccent,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              
              // Action buttons
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: onReject,
                      icon: const Icon(Icons.cancel_outlined, size: 18),
                      label: const Text('Reject'),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: Colors.red,
                        side: const BorderSide(color: Colors.red),
                        padding: const EdgeInsets.symmetric(vertical: 12),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    flex: 2,
                    child: ElevatedButton.icon(
                      onPressed: onConnect,
                      icon: const Icon(Icons.check_circle, size: 18),
                      label: const Text('Mark as Connected'),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.green,
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 12),
                      ),
                    ),
                  ),
                ],
              ),
            ],
            
            // Notes (for rejected)
            if (request.isRejected && request.notes != null && request.notes!.isNotEmpty) ...[
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.red[50],
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: Colors.red[200]!),
                ),
                child: Row(
                  children: [
                    Icon(Icons.info_outline, size: 18, color: Colors.red[700]),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'Reason: ${request.notes}',
                        style: TextStyle(color: Colors.red[700], fontSize: 13),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildStatusBadge() {
    Color color;
    String label;
    IconData icon;

    switch (request.status) {
      case 'connected':
        color = Colors.green;
        label = 'Connected';
        icon = Icons.check_circle;
        break;
      case 'rejected':
        color = Colors.red;
        label = 'Rejected';
        icon = Icons.cancel;
        break;
      default:
        color = Colors.orange;
        label = 'Pending';
        icon = Icons.pending;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: color),
          const SizedBox(width: 4),
          Text(
            label,
            style: TextStyle(
              color: color,
              fontWeight: FontWeight.w600,
              fontSize: 12,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildInfoRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 140,
            child: Text(
              label,
              style: TextStyle(color: Colors.grey[600], fontSize: 13),
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: const TextStyle(fontWeight: FontWeight.w500, fontSize: 13),
            ),
          ),
        ],
      ),
    );
  }

  String _formatDate(DateTime date) {
    return '${date.day}/${date.month}/${date.year} ${date.hour}:${date.minute.toString().padLeft(2, '0')}';
  }
}
