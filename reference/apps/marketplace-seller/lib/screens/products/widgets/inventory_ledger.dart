// lib/screens/products/widgets/inventory_ledger.dart
// 📋 INVENTORY LEDGER - Stock movement history
// ✨ Professional audit trail

import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:intl/intl.dart';

class InventoryLedger extends StatelessWidget {
  final String productId;
  final String productName;

  const InventoryLedger({
    super.key,
    required this.productId,
    required this.productName,
  });

  static final _dateFormat = DateFormat('MMM d, yyyy h:mm a');

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Container(
      height: MediaQuery.of(context).size.height * 0.75,
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1E293B) : Colors.white,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: Column(
        children: [
          // Header
          Container(
            padding: const EdgeInsets.fromLTRB(20, 16, 16, 16),
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
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Icon(Icons.history_rounded, color: Color(0xFF3B82F6), size: 22),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Stock History',
                        style: TextStyle(
                          color: isDark ? Colors.white : const Color(0xFF111827),
                          fontSize: 17,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      Text(
                        productName,
                        style: TextStyle(color: Colors.grey[500], fontSize: 12),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
                IconButton(
                  onPressed: () => Navigator.pop(context),
                  icon: Icon(Icons.close_rounded, color: Colors.grey[500]),
                ),
              ],
            ),
          ),
          
          // History List
          Expanded(
            child: StreamBuilder<QuerySnapshot>(
              stream: FirebaseFirestore.instance
                  .collection('products')
                  .doc(productId)
                  .collection('stockHistory')
                  .orderBy('timestamp', descending: true)
                  .limit(50)
                  .snapshots(),
              builder: (context, snapshot) {
                if (snapshot.connectionState == ConnectionState.waiting) {
                  return const Center(child: CircularProgressIndicator());
                }
                
                if (!snapshot.hasData || snapshot.data!.docs.isEmpty) {
                  return _buildEmptyState(isDark);
                }
                
                final entries = snapshot.data!.docs;
                
                return ListView.builder(
                  padding: const EdgeInsets.all(16),
                  itemCount: entries.length,
                  itemBuilder: (context, index) {
                    final data = entries[index].data() as Map<String, dynamic>;
                    return _buildHistoryEntry(data, isDark, index);
                  },
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildHistoryEntry(Map<String, dynamic> data, bool isDark, int index) {
    final change = data['change'] ?? 0;
    final isIncrease = change > 0;
    final previousStock = data['previousStock'] ?? 0;
    final newStock = data['newStock'] ?? 0;
    final reason = data['reason'] ?? 'Stock Update';
    final timestamp = (data['timestamp'] as Timestamp?)?.toDate();
    
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: isDark ? Colors.black.withValues(alpha: 0.2) : Colors.grey[50],
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: (isIncrease ? const Color(0xFF10B981) : const Color(0xFFEF4444)).withValues(alpha: 0.2),
          ),
        ),
        child: Row(
          children: [
            // Change indicator
            Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                color: (isIncrease ? const Color(0xFF10B981) : const Color(0xFFEF4444)).withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(
                    isIncrease ? Icons.arrow_upward_rounded : Icons.arrow_downward_rounded,
                    color: isIncrease ? const Color(0xFF10B981) : const Color(0xFFEF4444),
                    size: 16,
                  ),
                  Text(
                    '${isIncrease ? '+' : ''}$change',
                    style: TextStyle(
                      color: isIncrease ? const Color(0xFF10B981) : const Color(0xFFEF4444),
                      fontSize: 12,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 14),
            
            // Details
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    reason,
                    style: TextStyle(
                      color: isDark ? Colors.white : const Color(0xFF111827),
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      Text(
                        '$previousStock',
                        style: TextStyle(color: Colors.grey[500], fontSize: 12),
                      ),
                      Icon(Icons.arrow_forward_rounded, color: Colors.grey[400], size: 14),
                      Text(
                        '$newStock',
                        style: TextStyle(
                          color: isDark ? Colors.white : const Color(0xFF111827),
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            
            // Timestamp
            if (timestamp != null)
              Text(
                _dateFormat.format(timestamp),
                style: TextStyle(color: Colors.grey[500], fontSize: 11),
              ),
          ],
        ),
      ),
    ).animate().fadeIn(delay: (index * 50).ms).slideX(begin: 0.02);
  }

  Widget _buildEmptyState(bool isDark) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.history_rounded, size: 48, color: Colors.grey[400]),
          const SizedBox(height: 16),
          Text(
            'No stock history yet',
            style: TextStyle(
              color: isDark ? Colors.white : const Color(0xFF111827),
              fontSize: 16,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            'Stock changes will appear here',
            style: TextStyle(color: Colors.grey[500], fontSize: 13),
          ),
        ],
      ),
    );
  }
}

// Helper function to show ledger
void showInventoryLedger(BuildContext context, String productId, String productName) {
  showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (context) => InventoryLedger(
      productId: productId,
      productName: productName,
    ),
  );
}
