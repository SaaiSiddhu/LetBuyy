import 'dart:async';

import 'package:flutter/material.dart';
import 'package:letbuyy_api_client/letbuyy_api_client.dart';
import 'package:letbuyy_marketplace_models/letbuyy_marketplace_models.dart';
import 'package:letbuyy_marketplace_ui_kit/letbuyy_marketplace_ui_kit.dart';
import 'package:provider/provider.dart';

import '../../auth/buyer_sign_in_controller.dart';
import 'support_chat_screen.dart';

class SupportConversationsScreen extends StatefulWidget {
  // Keep existing routes/prefill intent; readback never submits these values.
  final bool showNewChatButton;
  final SupportTicketType? newChatType;
  final String? newChatSubject;
  final String? newChatMessage;
  final Map<String, dynamic>? newChatMetadata;

  const SupportConversationsScreen({
    super.key,
    this.showNewChatButton = true,
    this.newChatType,
    this.newChatSubject,
    this.newChatMessage,
    this.newChatMetadata,
  });

  @override
  State<SupportConversationsScreen> createState() =>
      _SupportConversationsScreenState();
}

class _SupportConversationsScreenState
    extends State<SupportConversationsScreen> {
  BuyerSignInController? _auth;
  ({String? buyerId, String? token}) _identity = (buyerId: null, token: null);
  int _generation = 0;
  List<JsonMap> _tickets = const [];
  bool _loading = false;
  String? _error;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final auth = Provider.of<BuyerSignInController>(context);
    final replaced = !identical(auth, _auth);
    if (replaced) {
      _auth?.removeListener(_onSessionChanged);
      _auth = auth..addListener(_onSessionChanged);
    }
    _syncSession(force: replaced);
  }

  void _onSessionChanged() => _syncSession();

  void _syncSession({bool force = false}) {
    final identity = (buyerId: _auth?.buyerId, token: _auth?.token);
    if (!force && identity == _identity) return;
    // Invalidate synchronously on every boundary, even A→logout→A between
    // frames. A delayed A result must never become current again accidentally.
    setState(() {
      _identity = identity;
      _generation++;
      _tickets = const [];
      _error = null;
      _loading = false;
    });
    if (identity.token != null && identity.buyerId != null) unawaited(_load());
  }

  bool _current(({String? buyerId, String? token}) identity, int generation) =>
      mounted &&
      _generation == generation &&
      _identity == identity &&
      _auth?.token == identity.token &&
      _auth?.buyerId == identity.buyerId;

  Future<void> _load() async {
    final identity = _identity;
    final token = identity.token;
    if (_loading || token == null || identity.buyerId == null) return;
    final generation = ++_generation;
    setState(() {
      _tickets = const [];
      _error = null;
      _loading = true;
    });
    try {
      final tickets = await context.read<BuyerSupportApi>().listTickets(token);
      if (!_current(identity, generation)) return;
      setState(() {
        _tickets = tickets;
        _loading = false;
      });
    } on ApiException catch (error) {
      if (!_current(identity, generation)) return;
      setState(() {
        _loading = false;
        _error = error.statusCode == 401 || error.statusCode == 403
            ? 'Your LetBuyy sign-in has ended. Sign in again from Profile.'
            : error.code == 'NETWORK_ERROR' || error.code == 'TIMEOUT'
            ? 'You seem to be offline. Check your connection and try again.'
            : 'We couldn’t load your support tickets. Please try again.';
      });
    } catch (_) {
      if (!_current(identity, generation)) return;
      setState(() {
        _loading = false;
        _error = 'We couldn’t load your support tickets. Please try again.';
      });
    }
  }

  @override
  void dispose() {
    _auth?.removeListener(_onSessionChanged);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final identity = _identity;
    final generation = _generation;
    return Scaffold(
      appBar: const CustomAppBar(title: 'Support', isGlass: false),
      body: identity.token == null || identity.buyerId == null
          ? const EmptyState(
              icon: Icons.lock_outline,
              title: 'Sign in to view your support tickets',
              message: 'Use Sign in with LetBuyy on the Profile tab.',
            )
          : _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
          ? ErrorView(message: _error!, onRetry: _load)
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.all(16),
                children: [
                  const Text(
                    'Showing up to 50 most recent tickets. Full history is not available in this view.',
                  ),
                  if (widget.showNewChatButton) ...[
                    const SizedBox(height: 8),
                    const Text(
                      'New tickets, replies and attachments are not available in this view yet. No new request has been sent.',
                    ),
                  ],
                  const SizedBox(height: 16),
                  if (_tickets.isEmpty)
                    const EmptyState(
                      icon: Icons.support_agent_outlined,
                      title: 'No support tickets yet',
                      message:
                          'Tickets recorded for your LetBuyy account will appear here.',
                    ),
                  for (final ticket in _tickets)
                    Card(
                      child: ListTile(
                        key: ValueKey('support-ticket-${ticket['id']}'),
                        title: Text(_text(ticket['subject'], 'Support ticket')),
                        subtitle: Text(
                          '${_text(ticket['ticket_ref'], 'Reference unavailable')}\n${_text(ticket['status'], 'Status unavailable')}',
                        ),
                        isThreeLine: true,
                        trailing: const Icon(Icons.chevron_right),
                        onTap: () {
                          if (!_current(identity, generation)) return;
                          Navigator.of(context).push(
                            MaterialPageRoute<void>(
                              builder: (_) => SupportChatScreen(
                                conversationId: ticket['id'] as String,
                              ),
                            ),
                          );
                        },
                      ),
                    ),
                ],
              ),
            ),
    );
  }

  static String _text(Object? value, String fallback) =>
      value is String && value.trim().isNotEmpty ? value : fallback;
}
