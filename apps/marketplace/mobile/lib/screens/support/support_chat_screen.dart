import 'dart:async';

import 'package:flutter/material.dart';
import 'package:letbuyy_api_client/letbuyy_api_client.dart';
import 'package:letbuyy_marketplace_models/letbuyy_marketplace_models.dart';
import 'package:letbuyy_marketplace_ui_kit/letbuyy_marketplace_ui_kit.dart';
import 'package:provider/provider.dart';

import '../../auth/buyer_sign_in_controller.dart';

class SupportChatScreen extends StatefulWidget {
  // Legacy route names remain accepted. A conversationId now identifies a
  // canonical ticket; prefill is preserved but never submitted by readback.
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
  BuyerSignInController? _auth;
  ({String? buyerId, String? token}) _identity = (buyerId: null, token: null);
  int _generation = 0;
  List<JsonMap> _messages = const [];
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

  @override
  void didUpdateWidget(covariant SupportChatScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.conversationId != widget.conversationId)
      _syncSession(force: true);
  }

  void _onSessionChanged() => _syncSession();

  void _syncSession({bool force = false}) {
    final identity = (buyerId: _auth?.buyerId, token: _auth?.token);
    if (!force && identity == _identity) return;
    setState(() {
      _identity = identity;
      _generation++;
      _messages = const [];
      _error = null;
      _loading = false;
    });
    if (identity.token != null &&
        identity.buyerId != null &&
        widget.conversationId != null)
      unawaited(_load());
  }

  bool _current(
    ({String? buyerId, String? token}) identity,
    String id,
    int generation,
  ) =>
      mounted &&
      _generation == generation &&
      _identity == identity &&
      widget.conversationId == id &&
      _auth?.token == identity.token &&
      _auth?.buyerId == identity.buyerId;

  Future<void> _load() async {
    final identity = _identity;
    final token = identity.token;
    final id = widget.conversationId;
    if (_loading || token == null || identity.buyerId == null || id == null)
      return;
    final generation = ++_generation;
    setState(() {
      _messages = const [];
      _error = null;
      _loading = true;
    });
    try {
      final messages = await context.read<BuyerSupportApi>().listPublicMessages(
        token,
        id,
      );
      if (!_current(identity, id, generation)) return;
      setState(() {
        _messages = messages;
        _loading = false;
      });
    } on ApiException catch (error) {
      if (!_current(identity, id, generation)) return;
      setState(() {
        _loading = false;
        _error = error.statusCode == 401 || error.statusCode == 403
            ? 'Your LetBuyy sign-in has ended. Sign in again from Profile.'
            : error.statusCode == 404
            ? 'We couldn’t find this support ticket.'
            : error.code == 'NETWORK_ERROR' || error.code == 'TIMEOUT'
            ? 'You seem to be offline. Check your connection and try again.'
            : 'We couldn’t load this support thread. Please try again.';
      });
    } on ArgumentError {
      if (!_current(identity, id, generation)) return;
      setState(() {
        _loading = false;
        _error = 'We couldn’t find this support ticket.';
      });
    } catch (_) {
      if (!_current(identity, id, generation)) return;
      setState(() {
        _loading = false;
        _error = 'We couldn’t load this support thread. Please try again.';
      });
    }
  }

  @override
  void dispose() {
    _auth?.removeListener(_onSessionChanged);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: const CustomAppBar(title: 'Support thread', isGlass: false),
    body: _identity.token == null || _identity.buyerId == null
        ? const EmptyState(
            icon: Icons.lock_outline,
            title: 'Sign in to view this support ticket',
            message: 'Use Sign in with LetBuyy on the Profile tab.',
          )
        : widget.conversationId == null
        ? const EmptyState(
            icon: Icons.support_agent_outlined,
            title: 'Choose an existing support ticket',
            message:
                'New tickets, replies and attachments are not available in this view yet. No new request has been sent.',
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
                  'Showing up to the first 200 public messages, oldest first. Later messages may be unavailable in this view.',
                ),
                const SizedBox(height: 8),
                const Text(
                  'Replies and attachments are not available in this view yet.',
                ),
                const SizedBox(height: 16),
                if (_messages.isEmpty)
                  const EmptyState(
                    icon: Icons.forum_outlined,
                    title: 'No public messages yet',
                    message:
                        'Public messages recorded for this ticket will appear here.',
                  ),
                for (final message in _messages)
                  Card(
                    key: ValueKey('support-message-${message['id']}'),
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Text(switch (message['author_type']) {
                            'requester' => 'You',
                            'agent' => 'Support team',
                            _ => 'Support update',
                          }, style: Theme.of(context).textTheme.titleSmall),
                          const SizedBox(height: 8),
                          Text(message['body'] as String),
                          const SizedBox(height: 8),
                          Text(_date(message['created_at'])),
                        ],
                      ),
                    ),
                  ),
              ],
            ),
          ),
  );

  String _date(Object? value) {
    final date = value is String ? DateTime.tryParse(value)?.toLocal() : null;
    if (date == null) return 'Date unavailable';
    final local = MaterialLocalizations.of(context);
    return '${local.formatMediumDate(date)} · ${local.formatTimeOfDay(TimeOfDay.fromDateTime(date))}';
  }
}
