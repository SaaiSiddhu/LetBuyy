// apps/marketplace/lib/screens/support/support_chat_screen.dart
// 💬 SUPPORT CHAT SCREEN

import 'package:flutter/material.dart';
import 'package:letbuyy_marketplace_models/letbuyy_marketplace_models.dart';
import 'package:letbuyy_marketplace_ui_kit/letbuyy_marketplace_ui_kit.dart';
import 'package:letbuyy_marketplace/widgets/premium_scaffold.dart';

// Phase 1R (Firebase removal, final pass): this screen used to construct SupportChatService
// (entirely FirebaseFirestore-backed) and stream live messages from it. There is no canonical
// LetBuyy backend for support conversations -- it is not among services/api-gateway's owned
// domains (products, inventory, cart, checkout, orders, payments, discounts, GST, shipping,
// settlement, customers, billing, analytics) -- so this is a genuinely deferred capability, not
// a rewiring target. A prior pass had already found the one real bug this created (this screen's
// only entry point never actually produced a conversation, since AuthProvider/FirebaseAuth was
// already dead) and neutered _initConversation() so _conversation stayed permanently null,
// leaving _buildNoConversation() as the screen's only reachable body -- but the SupportChatService
// field, its live-stream listener, the message-list/input-bar/message-bubble UI built to consume
// it, and the model imports they needed all stayed behind as unreachable code. Deleted here along
// with the whole file's Firebase coupling; what remains is an honest, permanent "not available yet"
// state, not a live chat UI with its data source removed.
class SupportChatScreen extends StatefulWidget {
  final String? conversationId;
  final SupportTicketType? ticketType;
  final String? subject;
  final String? initialMessage;
  final Map<String, dynamic>? metadata;

  const SupportChatScreen({
    super.key,
    this.conversationId,
    this.ticketType,
    this.subject,
    this.initialMessage,
    this.metadata,
  });

  @override
  State<SupportChatScreen> createState() => _SupportChatScreenState();
}

class _SupportChatScreenState extends State<SupportChatScreen> {
  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return PremiumScaffold(
      appBar: _buildAppBar(isDark),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.support_agent_outlined, size: 64, color: Colors.grey[400]),
              const SizedBox(height: 16),
              const Text(
                'Support chat isn\'t available in this build yet',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
              ),
              if (widget.ticketType != null) ...[
                const SizedBox(height: 8),
                Text(
                  'Topic: ${widget.ticketType!.displayName}',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 13, color: Colors.grey[600]),
                ),
              ],
              const SizedBox(height: 24),
              ElevatedButton(
                onPressed: () => Navigator.pop(context),
                child: const Text('Go Back'),
              ),
            ],
          ),
        ),
      ),
    );
  }

  PreferredSizeWidget _buildAppBar(bool isDark) {
    return AppBar(
      backgroundColor: isDark ? const Color(0xFF1A1F2C) : Colors.white,
      elevation: 0,
      leading: IconButton(
        icon: Icon(Icons.arrow_back, color: isDark ? Colors.white : Colors.black),
        onPressed: () => Navigator.pop(context),
      ),
      title: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [AppColors.primary, AppColors.primaryDark],
              ),
              borderRadius: BorderRadius.circular(10),
            ),
            child: const Icon(Icons.support_agent, size: 18, color: Colors.white),
          ),
          const SizedBox(width: 12),
          Text(
            'Support Team',
            style: TextStyle(
              color: isDark ? Colors.white : Colors.black,
              fontSize: 15,
              fontWeight: FontWeight.bold,
            ),
          ),
        ],
      ),
    );
  }
}
