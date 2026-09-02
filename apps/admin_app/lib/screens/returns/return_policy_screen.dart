// apps/admin/lib/screens/returns/return_policy_screen.dart
// ⚙️ RETURN POLICY EDITOR
// Admin manages return reasons and policies

import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:letbuyy_models/letbuyy_models.dart';
import 'package:letbuyy_services/letbuyy_services.dart';

class ReturnPolicyScreen extends StatefulWidget {
  const ReturnPolicyScreen({super.key});

  @override
  State<ReturnPolicyScreen> createState() => _ReturnPolicyScreenState();
}

class _ReturnPolicyScreenState extends State<ReturnPolicyScreen>
    with SingleTickerProviderStateMixin {
  final ReturnService _returnService = ReturnService();
  final FirebaseFirestore _firestore = FirebaseFirestore.instance;
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      appBar: AppBar(
        backgroundColor: const Color(0xFF1E293B),
        title: const Text(
          'Return Policies & Reasons',
          style: TextStyle(fontWeight: FontWeight.bold),
        ),
        actions: [
          // Seed Default Reasons
          TextButton.icon(
            onPressed: _seedReasons,
            icon: const Icon(Icons.data_array, color: Colors.white70),
            label: const Text('Seed Defaults', style: TextStyle(color: Colors.white70)),
          ),
          const SizedBox(width: 8),
        ],
        bottom: TabBar(
          controller: _tabController,
          indicatorColor: Colors.blue,
          tabs: const [
            Tab(text: 'Return Reasons'),
            Tab(text: 'Global Settings'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          _buildReasonsTab(),
          _buildSettingsTab(),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _showAddReasonDialog,
        icon: const Icon(Icons.add),
        label: const Text('Add Reason'),
        backgroundColor: Colors.blue[700],
      ),
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RETURN REASONS TAB
  // ═══════════════════════════════════════════════════════════════════════════

  Widget _buildReasonsTab() {
    return StreamBuilder<QuerySnapshot>(
      stream: _firestore
          .collection('return_reasons')
          .orderBy('sortOrder')
          .snapshots(),
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Center(child: CircularProgressIndicator());
        }

        final reasons = snapshot.data?.docs ?? [];

        if (reasons.isEmpty) {
          return Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.list_alt, size: 64, color: Colors.white.withValues(alpha: 0.2)),
                const SizedBox(height: 16),
                Text(
                  'No return reasons defined',
                  style: TextStyle(color: Colors.white.withValues(alpha: 0.5)),
                ),
                const SizedBox(height: 16),
                ElevatedButton.icon(
                  onPressed: _seedReasons,
                  icon: const Icon(Icons.add),
                  label: const Text('Seed Default Reasons'),
                ),
              ],
            ),
          );
        }

        return ReorderableListView.builder(
          padding: const EdgeInsets.all(20),
          itemCount: reasons.length,
          onReorder: (oldIndex, newIndex) => _reorderReasons(reasons, oldIndex, newIndex),
          itemBuilder: (context, index) {
            final doc = reasons[index];
            final reason = ReturnReasonModel.fromMap(
              doc.data() as Map<String, dynamic>,
              doc.id,
            );
            return _buildReasonCard(reason, index);
          },
        );
      },
    );
  }

  Widget _buildReasonCard(ReturnReasonModel reason, int index) {
    return Container(
      key: ValueKey(reason.id),
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF1E293B),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: reason.isActive ? Colors.white10 : Colors.red.withValues(alpha: 0.3),
        ),
      ),
      child: Row(
        children: [
          // Drag Handle
          Icon(
            Icons.drag_indicator,
            color: Colors.white.withValues(alpha: 0.3),
          ),
          const SizedBox(width: 12),
          
          // Sort Order
          Container(
            width: 32,
            height: 32,
            decoration: BoxDecoration(
              color: Colors.blue.withValues(alpha: 0.2),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Center(
              child: Text(
                '${reason.sortOrder}',
                style: const TextStyle(
                  color: Colors.blue,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
          ),
          const SizedBox(width: 16),
          
          // Info
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text(
                      reason.title,
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.bold,
                        fontSize: 15,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Text(
                        reason.code,
                        style: TextStyle(
                          color: Colors.white.withValues(alpha: 0.5),
                          fontSize: 10,
                          fontFamily: 'monospace',
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                Text(
                  reason.description,
                  style: TextStyle(
                    color: Colors.white.withValues(alpha: 0.6),
                    fontSize: 13,
                  ),
                ),
              ],
            ),
          ),
          
          // Requires Image Badge
          if (reason.requiresImage)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: Colors.orange.withValues(alpha: 0.2),
                borderRadius: BorderRadius.circular(6),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.camera_alt, size: 12, color: Colors.orange),
                  const SizedBox(width: 4),
                  const Text(
                    'Photo',
                    style: TextStyle(
                      color: Colors.orange,
                      fontSize: 11,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
              ),
            ),
          const SizedBox(width: 12),
          
          // Status Toggle
          Switch(
            value: reason.isActive,
            onChanged: (v) => _toggleReasonActive(reason, v),
            activeThumbColor: Colors.green,
          ),
          
          // Edit Button
          IconButton(
            icon: const Icon(Icons.edit, size: 18),
            color: Colors.white54,
            onPressed: () => _showEditReasonDialog(reason),
          ),
          
          // Delete Button
          IconButton(
            icon: const Icon(Icons.delete, size: 18),
            color: Colors.red[300],
            onPressed: () => _deleteReason(reason),
          ),
        ],
      ),
    ).animate(delay: (index * 50).ms).fadeIn().slideX(begin: 0.02);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GLOBAL SETTINGS TAB
  // ═══════════════════════════════════════════════════════════════════════════

  Widget _buildSettingsTab() {
    return StreamBuilder<DocumentSnapshot>(
      stream: _firestore.doc('settings/return_policy').snapshots(),
      builder: (context, snapshot) {
        final data = snapshot.data?.data() as Map<String, dynamic>? ?? {};

        return SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Return Window
              _buildSettingsCard(
                title: 'Return Window',
                icon: Icons.access_time,
                children: [
                  _buildSettingRow(
                    label: 'Default Return Window (days)',
                    value: '${data['returnWindowDays'] ?? 7}',
                    onEdit: () => _editSetting('returnWindowDays', data['returnWindowDays'] ?? 7),
                  ),
                  _buildSettingRow(
                    label: 'Exchange Window (days)',
                    value: '${data['exchangeWindowDays'] ?? 7}',
                    onEdit: () => _editSetting('exchangeWindowDays', data['exchangeWindowDays'] ?? 7),
                  ),
                ],
              ),
              const SizedBox(height: 20),

              // Pickup Settings
              _buildSettingsCard(
                title: 'Pickup Settings',
                icon: Icons.local_shipping,
                children: [
                  _buildSettingRow(
                    label: 'Minimum Days Before Pickup',
                    value: '${data['minPickupDays'] ?? 1}',
                    onEdit: () => _editSetting('minPickupDays', data['minPickupDays'] ?? 1),
                  ),
                  _buildSettingRow(
                    label: 'Maximum Days Before Pickup',
                    value: '${data['maxPickupDays'] ?? 14}',
                    onEdit: () => _editSetting('maxPickupDays', data['maxPickupDays'] ?? 14),
                  ),
                  _buildToggleRow(
                    label: 'Allow Customer Reschedule',
                    value: data['allowReschedule'] ?? true,
                    onChanged: (v) => _saveSetting('allowReschedule', v),
                  ),
                ],
              ),
              const SizedBox(height: 20),

              // Refund Settings
              _buildSettingsCard(
                title: 'Refund Settings',
                icon: Icons.currency_rupee,
                children: [
                  _buildSettingRow(
                    label: 'Refund Processing Days',
                    value: '${data['refundProcessingDays'] ?? 5}',
                    onEdit: () => _editSetting('refundProcessingDays', data['refundProcessingDays'] ?? 5),
                  ),
                  _buildToggleRow(
                    label: 'Auto-Refund After QC Pass',
                    value: data['autoRefundOnQcPass'] ?? false,
                    onChanged: (v) => _saveSetting('autoRefundOnQcPass', v),
                  ),
                  _buildToggleRow(
                    label: 'Require Bank Details for COD',
                    value: data['requireBankForCod'] ?? true,
                    onChanged: (v) => _saveSetting('requireBankForCod', v),
                  ),
                ],
              ),
              const SizedBox(height: 20),

              // Automation
              _buildSettingsCard(
                title: 'Automation',
                icon: Icons.smart_toy,
                children: [
                  _buildToggleRow(
                    label: 'Auto-Approve Low Value Returns',
                    value: data['autoApproveEnabled'] ?? false,
                    onChanged: (v) => _saveSetting('autoApproveEnabled', v),
                  ),
                  if (data['autoApproveEnabled'] == true)
                    _buildSettingRow(
                      label: 'Auto-Approve Threshold (₹)',
                      value: '${data['autoApproveThreshold'] ?? 500}',
                      onEdit: () => _editSetting('autoApproveThreshold', data['autoApproveThreshold'] ?? 500),
                    ),
                  _buildToggleRow(
                    label: 'Auto-Reject After X Days',
                    value: data['autoRejectEnabled'] ?? false,
                    onChanged: (v) => _saveSetting('autoRejectEnabled', v),
                  ),
                  if (data['autoRejectEnabled'] == true)
                    _buildSettingRow(
                      label: 'Auto-Reject Days',
                      value: '${data['autoRejectDays'] ?? 7}',
                      onEdit: () => _editSetting('autoRejectDays', data['autoRejectDays'] ?? 7),
                    ),
                ],
              ),
              const SizedBox(height: 20),

              // Notifications
              _buildSettingsCard(
                title: 'Notifications',
                icon: Icons.notifications,
                children: [
                  _buildToggleRow(
                    label: 'Notify Customer on Status Change',
                    value: data['notifyCustomer'] ?? true,
                    onChanged: (v) => _saveSetting('notifyCustomer', v),
                  ),
                  _buildToggleRow(
                    label: 'Notify Seller on New Request',
                    value: data['notifySeller'] ?? true,
                    onChanged: (v) => _saveSetting('notifySeller', v),
                  ),
                  _buildToggleRow(
                    label: 'Email Updates',
                    value: data['emailUpdates'] ?? true,
                    onChanged: (v) => _saveSetting('emailUpdates', v),
                  ),
                ],
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildSettingsCard({
    required String title,
    required IconData icon,
    required List<Widget> children,
  }) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: const Color(0xFF1E293B),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white10),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, color: Colors.blue, size: 20),
              const SizedBox(width: 8),
              Text(
                title,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          ...children,
        ],
      ),
    );
  }

  Widget _buildSettingRow({
    required String label,
    required String value,
    required VoidCallback onEdit,
  }) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        children: [
          Expanded(
            child: Text(
              label,
              style: TextStyle(color: Colors.white.withValues(alpha: 0.7)),
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.05),
              borderRadius: BorderRadius.circular(6),
            ),
            child: Text(
              value,
              style: const TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
          const SizedBox(width: 8),
          IconButton(
            icon: const Icon(Icons.edit, size: 16),
            color: Colors.white54,
            onPressed: onEdit,
          ),
        ],
      ),
    );
  }

  Widget _buildToggleRow({
    required String label,
    required bool value,
    required Function(bool) onChanged,
  }) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        children: [
          Expanded(
            child: Text(
              label,
              style: TextStyle(color: Colors.white.withValues(alpha: 0.7)),
            ),
          ),
          Switch(
            value: value,
            onChanged: onChanged,
            activeThumbColor: Colors.green,
          ),
        ],
      ),
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ACTIONS
  // ═══════════════════════════════════════════════════════════════════════════

  Future<void> _seedReasons() async {
    try {
      await _returnService.seedDefaultReasons();
      _showSuccess('Default reasons seeded');
    } catch (e) {
      _showError('Failed: $e');
    }
  }

  void _showAddReasonDialog() {
    _showReasonDialog(null);
  }

  void _showEditReasonDialog(ReturnReasonModel reason) {
    _showReasonDialog(reason);
  }

  void _showReasonDialog(ReturnReasonModel? reason) {
    final codeController = TextEditingController(text: reason?.code ?? '');
    final titleController = TextEditingController(text: reason?.title ?? '');
    final descController = TextEditingController(text: reason?.description ?? '');
    bool requiresImage = reason?.requiresImage ?? false;
    bool isActive = reason?.isActive ?? true;

    showDialog(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          backgroundColor: const Color(0xFF1E293B),
          title: Text(
            reason == null ? 'Add Return Reason' : 'Edit Return Reason',
            style: const TextStyle(color: Colors.white),
          ),
          content: SizedBox(
            width: 400,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(
                  controller: codeController,
                  style: const TextStyle(color: Colors.white),
                  decoration: _inputDecoration('Code (e.g., wrong_product)'),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: titleController,
                  style: const TextStyle(color: Colors.white),
                  decoration: _inputDecoration('Title'),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: descController,
                  style: const TextStyle(color: Colors.white),
                  maxLines: 2,
                  decoration: _inputDecoration('Description'),
                ),
                const SizedBox(height: 16),
                CheckboxListTile(
                  value: requiresImage,
                  onChanged: (v) => setDialogState(() => requiresImage = v ?? false),
                  title: const Text('Requires Photo', style: TextStyle(color: Colors.white)),
                  activeColor: Colors.orange,
                  contentPadding: EdgeInsets.zero,
                ),
                CheckboxListTile(
                  value: isActive,
                  onChanged: (v) => setDialogState(() => isActive = v ?? true),
                  title: const Text('Active', style: TextStyle(color: Colors.white)),
                  activeColor: Colors.green,
                  contentPadding: EdgeInsets.zero,
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Cancel'),
            ),
            ElevatedButton(
              onPressed: () async {
                Navigator.pop(context);
                await _saveReason(
                  id: reason?.id,
                  code: codeController.text,
                  title: titleController.text,
                  description: descController.text,
                  requiresImage: requiresImage,
                  isActive: isActive,
                  sortOrder: reason?.sortOrder ?? 99,
                );
              },
              child: const Text('Save'),
            ),
          ],
        ),
      ),
    );
  }

  InputDecoration _inputDecoration(String hint) {
    return InputDecoration(
      hintText: hint,
      hintStyle: TextStyle(color: Colors.white.withValues(alpha: 0.4)),
      border: const OutlineInputBorder(),
      enabledBorder: OutlineInputBorder(
        borderSide: BorderSide(color: Colors.white.withValues(alpha: 0.2)),
      ),
      focusedBorder: const OutlineInputBorder(
        borderSide: BorderSide(color: Colors.blue),
      ),
    );
  }

  Future<void> _saveReason({
    String? id,
    required String code,
    required String title,
    required String description,
    required bool requiresImage,
    required bool isActive,
    required int sortOrder,
  }) async {
    try {
      final data = {
        'code': code,
        'title': title,
        'description': description,
        'requiresImage': requiresImage,
        'isActive': isActive,
        'sortOrder': sortOrder,
        'updatedAt': FieldValue.serverTimestamp(),
      };

      if (id != null) {
        await _firestore.collection('return_reasons').doc(id).update(data);
      } else {
        data['createdAt'] = FieldValue.serverTimestamp();
        await _firestore.collection('return_reasons').doc(code).set(data);
      }
      _showSuccess('Reason saved');
    } catch (e) {
      _showError('Failed: $e');
    }
  }

  Future<void> _toggleReasonActive(ReturnReasonModel reason, bool isActive) async {
    await _firestore.collection('return_reasons').doc(reason.id).update({
      'isActive': isActive,
    });
  }

  Future<void> _deleteReason(ReturnReasonModel reason) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: const Color(0xFF1E293B),
        title: const Text('Delete Reason?', style: TextStyle(color: Colors.white)),
        content: Text(
          'Are you sure you want to delete "${reason.title}"?',
          style: const TextStyle(color: Colors.white70),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, true),
            style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
            child: const Text('Delete', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );

    if (confirmed == true) {
      await _firestore.collection('return_reasons').doc(reason.id).delete();
      _showSuccess('Reason deleted');
    }
  }

  Future<void> _reorderReasons(List<QueryDocumentSnapshot> reasons, int oldIndex, int newIndex) async {
    if (newIndex > oldIndex) newIndex--;
    
    final batch = _firestore.batch();
    for (int i = 0; i < reasons.length; i++) {
      int newOrder = i;
      if (i == oldIndex) {
        newOrder = newIndex;
      } else if (oldIndex < newIndex && i > oldIndex && i <= newIndex) {
        newOrder = i - 1;
      } else if (oldIndex > newIndex && i >= newIndex && i < oldIndex) {
        newOrder = i + 1;
      }
      batch.update(reasons[i].reference, {'sortOrder': newOrder});
    }
    await batch.commit();
  }

  void _editSetting(String key, int currentValue) {
    final controller = TextEditingController(text: '$currentValue');
    
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: const Color(0xFF1E293B),
        title: Text('Edit $key', style: const TextStyle(color: Colors.white)),
        content: TextField(
          controller: controller,
          keyboardType: TextInputType.number,
          style: const TextStyle(color: Colors.white),
          decoration: _inputDecoration('Enter value'),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(context);
              _saveSetting(key, int.tryParse(controller.text) ?? currentValue);
            },
            child: const Text('Save'),
          ),
        ],
      ),
    );
  }

  Future<void> _saveSetting(String key, dynamic value) async {
    await _firestore.doc('settings/return_policy').set({
      key: value,
      'updatedAt': FieldValue.serverTimestamp(),
    }, SetOptions(merge: true));
    _showSuccess('Setting saved');
  }

  void _showSuccess(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message), backgroundColor: Colors.green),
    );
  }

  void _showError(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message), backgroundColor: Colors.red),
    );
  }
}
