import 'dart:async';

import 'package:flutter/material.dart';
import 'package:letbuyy_api_client/letbuyy_api_client.dart';
import 'package:letbuyy_marketplace_models/letbuyy_marketplace_models.dart';
import 'package:letbuyy_marketplace_ui_kit/letbuyy_marketplace_ui_kit.dart';
import 'package:provider/provider.dart';

import '../../auth/buyer_sign_in_controller.dart';
import '../../data/buyer_support_commands.dart';

class SupportChatScreen extends StatefulWidget {
  const SupportChatScreen({
    super.key,
    this.conversationId,
    this.ticketType,
    this.subject,
    this.initialMessage,
    this.metadata,
  });
  final String? conversationId;
  final SupportTicketType? ticketType;
  final String? subject;
  final String? initialMessage;
  final Map<String, dynamic>? metadata;
  @override
  State<SupportChatScreen> createState() => _SupportChatScreenState();
}

class _SupportChatScreenState extends State<SupportChatScreen> {
  BuyerSignInController? _auth;
  ({String? buyerId, String? token}) _identity = (buyerId: null, token: null);
  final _subject = TextEditingController(), _body = TextEditingController();
  String? _ticketId;
  int _generation = 0, _sessionRevision = 0;
  List<JsonMap> _messages = const [];
  bool _loading = false,
      _loadingMore = false,
      _hasMore = false,
      _sending = false,
      _restoring = false,
      _denied = false;
  bool _prefillConsumed = false;
  String? _cursor, _error, _sendError;
  BuyerSupportCommand? _pending;
  BuyerSupportCommandResult? _confirmation;

  @override
  void initState() {
    super.initState();
    _ticketId = widget.conversationId;
  }

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
    if (oldWidget.conversationId != widget.conversationId) {
      _ticketId = widget.conversationId;
      _syncSession(force: true);
    }
  }

  void _onSessionChanged() => _syncSession();
  void _syncSession({bool force = false}) {
    final identity = (buyerId: _auth?.buyerId, token: _auth?.token);
    if (!force && identity == _identity) return;
    final sameActor =
        !force &&
        identity.buyerId != null &&
        identity.buyerId == _identity.buyerId &&
        identity.token != null &&
        _identity.token != null;
    setState(() {
      _identity = identity;
      _generation++;
      _sessionRevision++;
      _messages = const [];
      _error = null;
      _sendError = null;
      _cursor = null;
      _loading = false;
      _loadingMore = false;
      _hasMore = false;
      _sending = false;
      _restoring = false;
      _denied = false;
      _confirmation = null;
      if (!sameActor) {
        _ticketId = widget.conversationId;
        _body.clear();
        _subject.clear();
        _pending = null;
      }
      if (!_prefillConsumed &&
          identity.buyerId != null &&
          identity.token != null) {
        _prefillConsumed = true;
        if (_ticketId == null) {
          _subject.text = widget.subject ?? '';
          _body.text = widget.initialMessage ?? '';
        }
      }
    });
    if (identity.token != null && identity.buyerId != null) {
      unawaited(_restorePending(replaceDraft: !sameActor));
      if (_ticketId != null) unawaited(_load());
    }
  }

  bool _sessionCurrent(
    ({String? buyerId, String? token}) identity,
    int revision,
    String? ticketId,
  ) =>
      mounted &&
      _sessionRevision == revision &&
      _identity == identity &&
      _ticketId == ticketId &&
      _auth?.buyerId == identity.buyerId &&
      _auth?.token == identity.token;
  bool _current(
    ({String? buyerId, String? token}) identity,
    String id,
    int generation,
  ) =>
      mounted &&
      _generation == generation &&
      _identity == identity &&
      _ticketId == id &&
      _auth?.buyerId == identity.buyerId &&
      _auth?.token == identity.token;

  Future<void> _restorePending({bool replaceDraft = true}) async {
    final identity = _identity, revision = _sessionRevision, id = _ticketId;
    if (identity.buyerId == null || identity.token == null) return;
    setState(() => _restoring = true);
    try {
      final pending = await context.read<BuyerSupportCommands>().restore(
        identity.buyerId!,
        ticketId: id,
      );
      if (!_sessionCurrent(identity, revision, id)) return;
      setState(() {
        _pending = pending;
        _restoring = false;
        if (pending != null && replaceDraft) {
          _subject.text = pending.subject ?? '';
          _body.text = pending.body;
        }
      });
    } catch (_) {
      if (!_sessionCurrent(identity, revision, id)) return;
      setState(() {
        _restoring = false;
        _sendError =
            'We couldn’t check your saved support request. Retry before sending; no new request has been sent.';
      });
    }
  }

  Future<void> _load({bool more = false}) async {
    final identity = _identity, token = identity.token, id = _ticketId;
    if (_loading ||
        _loadingMore ||
        token == null ||
        identity.buyerId == null ||
        id == null ||
        (more && !_hasMore))
      return;
    final cursor = more ? _cursor : null, generation = ++_generation;
    setState(() {
      if (!more) _messages = const [];
      _error = null;
      _loading = !more;
      _loadingMore = more;
    });
    try {
      final page = await context.read<BuyerSupportApi>().listPublicMessagePage(
        token,
        id,
        cursor: cursor,
      );
      if (!_current(identity, id, generation)) return;
      setState(() {
        if (more &&
            page.items.any(
              (row) => _messages.any((prior) => prior['id'] == row['id']),
            )) {
          _error =
              'Your thread changed. Refresh it before loading more messages.';
        } else {
          _messages = [if (more) ..._messages, ...page.items];
          _hasMore = page.hasMore;
          _cursor = page.nextCursor;
        }
        _loading = false;
        _loadingMore = false;
        _denied = false;
      });
    } on ApiException catch (error) {
      if (!_current(identity, id, generation)) return;
      setState(() {
        _loading = false;
        _loadingMore = false;
        _denied =
            error.statusCode == 401 ||
            error.statusCode == 403 ||
            error.statusCode == 404;
        if (_denied) {
          _messages = const [];
          _body.clear();
          _subject.clear();
        }
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
        _loadingMore = false;
        _denied = true;
        _error = 'We couldn’t find this support ticket.';
      });
    } catch (_) {
      if (!_current(identity, id, generation)) return;
      setState(() {
        _loading = false;
        _loadingMore = false;
        _error = 'We couldn’t load this support thread. Please try again.';
      });
    }
  }

  String? _metadataId(String snake, String camel) {
    final value = widget.metadata?[snake] ?? widget.metadata?[camel];
    return value is String && value.isNotEmpty ? value : null;
  }

  Future<void> _send() async {
    final identity = _identity,
        token = identity.token,
        id = _ticketId,
        revision = _sessionRevision;
    if (_sending ||
        _restoring ||
        _denied ||
        token == null ||
        identity.buyerId == null)
      return;
    final commands = context.read<BuyerSupportCommands>(),
        api = context.read<BuyerSupportApi>();
    setState(() {
      _sending = true;
      _sendError = null;
    });
    try {
      final command = await commands.prepare(
        buyerId: identity.buyerId!,
        ticketId: id,
        subject: id == null ? _subject.text : null,
        body: _body.text,
        siteId: id == null
            ? (_pending?.siteId ?? _metadataId('site_id', 'siteId'))
            : null,
        orderId: id == null
            ? (_pending?.orderId ?? _metadataId('order_id', 'orderId'))
            : null,
      );
      if (!_sessionCurrent(identity, revision, id)) return;
      setState(() => _pending = command);
      final result = await commands.send(
        command,
        api,
        buyerId: identity.buyerId!,
        token: token,
        isCurrent: () => _sessionCurrent(identity, revision, id),
      );
      if (!_sessionCurrent(identity, revision, id)) return;
      setState(() => _confirmation = result);
      // Keep the durable key until the current screen accepts a validated,
      // server-recorded result. A storage failure leaves a safe same-key retry.
      await commands.acknowledge(command, result.receipt);
      if (!_sessionCurrent(identity, revision, id)) return;
      setState(() {
        _pending = null;
        _body.clear();
        _subject.clear();
        _sending = false;
        if (id == null) {
          _ticketId = result.receipt.ticketId;
          _generation++;
        }
      });
      unawaited(_load());
    } on ArgumentError {
      if (!_sessionCurrent(identity, revision, id)) return;
      setState(() {
        _sending = false;
        _sendError =
            'Enter a subject (up to 200 characters) and message (up to 4,000 characters).';
      });
    } on ApiException catch (error) {
      if (!_sessionCurrent(identity, revision, id)) return;
      setState(() {
        _sending = false;
        if (error.statusCode == 401 || error.statusCode == 403) {
          _denied = true;
          _messages = const [];
          _body.clear();
          _subject.clear();
          _sendError =
              'Your LetBuyy sign-in has ended. Sign in again from Profile to recover your saved request.';
        } else if (error.code == 'SUPPORT_PENDING_CHANGED')
          _sendError =
              'A different request is saved. Recover the saved request before sending your edited text.';
        else if (error.statusCode == 404)
          _sendError =
              'We couldn’t find the linked order or ticket for your account. Your text has been kept.';
        else if (error.statusCode == 409)
          _sendError =
              'This saved request needs recovery. Retry the saved request; do not start another copy.';
        else
          _sendError =
              'We couldn’t confirm your request. Your text and saved request are kept. Retry safely to check whether it was recorded.';
      });
    } catch (_) {
      if (!_sessionCurrent(identity, revision, id)) return;
      setState(() {
        _sending = false;
        _sendError =
            'We couldn’t save or confirm this request. Your text has been kept. Retry safely.';
      });
    }
  }

  @override
  void dispose() {
    _auth?.removeListener(_onSessionChanged);
    _subject.dispose();
    _body.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: CustomAppBar(
      title: _ticketId == null ? 'New support request' : 'Support thread',
      isGlass: false,
    ),
    body: _identity.token == null || _identity.buyerId == null
        ? const EmptyState(
            icon: Icons.lock_outline,
            title: 'Sign in to view this support ticket',
            message: 'Use Sign in with LetBuyy on the Profile tab.',
          )
        : LayoutBuilder(
            builder: (context, constraints) => Column(
              children: [
                if (_confirmation != null)
                  _bounded(
                    Padding(
                      padding: const EdgeInsets.all(12),
                      child: Card(
                        child: Padding(
                          padding: const EdgeInsets.all(12),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              Text(
                                _confirmation!.complaintCopy != null
                                    ? 'Support request recorded'
                                    : 'Reply recorded',
                                style: Theme.of(context).textTheme.titleMedium,
                              ),
                              if (_confirmation!.ticket != null)
                                Text(
                                  _confirmation!.ticket!['ticket_ref']
                                          as String? ??
                                      'Reference unavailable',
                                ),
                              Text(
                                (_confirmation!.complaintCopy?['body'] ??
                                        _confirmation!.message?['body'] ??
                                        '')
                                    as String,
                              ),
                              Text(_date(_confirmation!.receipt.confirmedAt)),
                            ],
                          ),
                        ),
                      ),
                    ),
                    constraints,
                    0.18,
                  ),
                Expanded(
                  child: _ticketId == null
                      ? ListView(
                          padding: const EdgeInsets.all(16),
                          children: const [
                            Text(
                              'Review your subject and message, then send your request. Prefilled text is an unsent draft.',
                            ),
                          ],
                        )
                      : _loading
                      ? const Center(child: CircularProgressIndicator())
                      : _error != null
                      ? SingleChildScrollView(
                          child: ErrorView(message: _error!, onRetry: _load),
                        )
                      : RefreshIndicator(
                          onRefresh: _load,
                          child: ListView(
                            physics: const AlwaysScrollableScrollPhysics(),
                            padding: const EdgeInsets.all(16),
                            children: [
                              const Text(
                                'Public messages, oldest first. Continue to load later messages through the full history.',
                              ),
                              if (_messages.isEmpty)
                                const EmptyState(
                                  icon: Icons.forum_outlined,
                                  title: 'No public messages yet',
                                  message:
                                      'Public messages recorded for this ticket will appear here.',
                                ),
                              for (final message in _messages)
                                Card(
                                  key: ValueKey(
                                    'support-message-${message['id']}',
                                  ),
                                  child: Padding(
                                    padding: const EdgeInsets.all(16),
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.stretch,
                                      children: [
                                        Text(
                                          switch (message['author_type']) {
                                            'requester' => 'You',
                                            'agent' => 'Support team',
                                            _ => 'Support update',
                                          },
                                          style: Theme.of(
                                            context,
                                          ).textTheme.titleSmall,
                                        ),
                                        const SizedBox(height: 8),
                                        Text(message['body'] as String),
                                        const SizedBox(height: 8),
                                        Text(_date(message['created_at'])),
                                      ],
                                    ),
                                  ),
                                ),
                              if (_loadingMore)
                                const Center(
                                  child: CircularProgressIndicator(),
                                ),
                              if (_hasMore && !_loadingMore)
                                TextButton(
                                  onPressed: () => _load(more: true),
                                  child: const Text('Load later messages'),
                                ),
                            ],
                          ),
                        ),
                ),
                if (_restoring)
                  _bounded(
                    const Padding(
                      padding: EdgeInsets.all(8),
                      child: Text('Checking your saved support request…'),
                    ),
                    constraints,
                    0.05,
                  ),
                if (_sendError != null)
                  _bounded(
                    Padding(
                      padding: const EdgeInsets.all(12),
                      child: Text(
                        _sendError!,
                        key: const ValueKey('support-send-error'),
                      ),
                    ),
                    constraints,
                    0.10,
                  ),
                if (!_denied)
                  _bounded(
                    SafeArea(
                      top: false,
                      child: Padding(
                        padding: const EdgeInsets.all(12),
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            if (_pending != null)
                              const Text(
                                'A saved request is awaiting confirmation. Retrying checks the same recorded request.',
                              ),
                            if (_ticketId == null)
                              TextField(
                                controller: _subject,
                                enabled: !_sending && !_restoring,
                                maxLength: 200,
                                decoration: const InputDecoration(
                                  labelText: 'Subject',
                                ),
                              ),
                            TextField(
                              controller: _body,
                              enabled: !_sending && !_restoring,
                              maxLength: 4000,
                              minLines: 2,
                              maxLines: 4,
                              decoration: InputDecoration(
                                labelText: _ticketId == null
                                    ? 'Message'
                                    : 'Reply',
                              ),
                            ),
                            Wrap(
                              spacing: 8,
                              children: [
                                FilledButton(
                                  onPressed: _sending || _restoring
                                      ? null
                                      : _send,
                                  child: Text(
                                    _sending
                                        ? 'Checking request…'
                                        : _pending != null
                                        ? 'Retry saved request'
                                        : _ticketId == null
                                        ? 'Send request'
                                        : 'Send reply',
                                  ),
                                ),
                                TextButton(
                                  onPressed: _sending || _restoring
                                      ? null
                                      : _restorePending,
                                  child: const Text('Recover saved request'),
                                ),
                              ],
                            ),
                            const Text('Attachments are not available yet.'),
                          ],
                        ),
                      ),
                    ),
                    constraints,
                    0.65,
                  ),
              ],
            ),
          ),
  );
  // The keyboard or a short window must not push the error, recorded receipt
  // or draft outside the available viewport. Each panel can scroll independently.
  Widget _bounded(Widget child, BoxConstraints constraints, double fraction) =>
      ConstrainedBox(
        constraints: BoxConstraints(
          maxHeight: constraints.maxHeight * fraction,
        ),
        child: SingleChildScrollView(primary: false, child: child),
      );
  String _date(Object? value) {
    final date = value is String ? DateTime.tryParse(value)?.toLocal() : null;
    if (date == null) return 'Date unavailable';
    final local = MaterialLocalizations.of(context);
    return '${local.formatMediumDate(date)} · ${local.formatTimeOfDay(TimeOfDay.fromDateTime(date))}';
  }
}
