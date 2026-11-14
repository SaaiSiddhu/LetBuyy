import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:provider/provider.dart';
import 'package:uuid/uuid.dart';

import '../../app/store_context.dart';
import '../../services/api_client.dart';
import '../../services/store_auth_service.dart';

/// Owner-scoped public projection of the existing support authority.
/// Operator notes, files, credentials and unrestricted metadata never enter it.
class MerchantSupportScreen extends StatefulWidget {
  const MerchantSupportScreen({
    super.key,
    this.secureStorage = const FlutterSecureStorage(),
  });
  final FlutterSecureStorage secureStorage;
  @override
  State<MerchantSupportScreen> createState() => _MerchantSupportScreenState();
}

class _MerchantSupportScreenState extends State<MerchantSupportScreen> {
  final _subject = TextEditingController(), _body = TextEditingController();
  StoreContext? _stores;
  FlutterSecureStorage get _storage => widget.secureStorage;
  int _command = 0;
  String? get _storageKey {
    final actor = context.read<StoreAuthService>().currentUser?.id;
    return actor == null || _site == null
        ? null
        : 'letbuyy.merchant-support.v1.$actor.$_site';
  }

  String? _site, _ticket, _pendingKey, _pendingTarget;
  String _pendingOperation = 'create', _notice = '';
  Map<String, dynamic>? _pendingBody;
  List<Map<String, dynamic>> _tickets = [], _messages = [];
  Map<String, dynamic>? _current;
  int _generation = 0, _epoch = -1, _page = 1, _messagePage = 1;
  bool _busy = false,
      _loading = true,
      _readFailed = false,
      _more = false,
      _moreMessages = false;
  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final next = context.read<StoreContext>();
    if (!identical(_stores, next)) {
      _stores?.removeListener(_contextChanged);
      _stores = next;
      next.addListener(_contextChanged);
      _contextChanged();
    }
  }

  void _contextChanged() {
    final stores = _stores!;
    if (_epoch == stores.requestContextVersion &&
        _site == stores.selectedStoreId)
      return;
    _command++;
    _epoch = stores.requestContextVersion;
    _site = stores.selectedStoreId;
    _generation++;
    _ticket = null;
    _current = null;
    _pendingKey = null;
    _pendingBody = null;
    _tickets = [];
    _messages = [];
    _body.clear();
    _subject.clear();
    _notice = '';
    _page = 1;
    _messagePage = 1;
    if (mounted) {
      setState(() => _busy = false);
      _load();
    }
  }

  bool _valid(int generation) =>
      mounted &&
      generation == _generation &&
      _stores?.requestContextVersion == _epoch &&
      _stores?.selectedStoreId == _site;
  List<Map<String, dynamic>> _rows(Object? value) => (value as List? ?? [])
      .whereType<Map>()
      .map((v) => Map<String, dynamic>.from(v))
      .toList();
  Future<void> _load() async {
    final generation = ++_generation;
    setState(() {
      _loading = true;
      _readFailed = false;
      _current = null;
      _messages = [];
      _tickets = [];
      _more = false;
      _moreMessages = false;
    });
    try {
      final store = await _stores!.ensureSelectedStore();
      if (!_valid(generation)) return;
      _site = store?.id;
      if (_site == null) throw StateError('Select a store first.');
      final storageKey = _storageKey;
      if (storageKey != null && _pendingKey == null) {
        final raw = await _storage.read(key: storageKey);
        if (!_valid(generation)) return;
        if (raw != null) {
          final saved = jsonDecode(raw) as Map<String, dynamic>;
          final target = saved['target'];
          if (saved['key'] is! String ||
              !RegExp(r'^[a-f0-9-]{36}$').hasMatch(saved['key'] as String) ||
              !['create', 'reply'].contains(saved['operation']) ||
              (target != null &&
                  (target is! String ||
                      !RegExp(r'^[a-f0-9-]{36}$').hasMatch(target))))
            throw const FormatException('Invalid pending support request');
          _pendingKey = saved['key'] as String;
          _pendingOperation = saved['operation'] as String;
          _pendingTarget = target as String?;
          _pendingBody = Map<String, dynamic>.from(saved['body'] as Map);
          _pendingBody!['site_id'] = _site;
          _ticket = _pendingTarget;
          _body.text = _pendingBody!['body'] as String;
          _subject.text = (_pendingBody!['subject'] as String?) ?? '';
          _notice = 'A pending request was restored. Check its saved outcome before retrying.';
        }
      }
      final api = context.read<ApiClient>();
      final list = await api.get(
        '/merchant/support/tickets',
        query: {'site_id': _site, 'page': _page},
      );
      if (!_valid(generation)) return;
      _tickets = _rows(list['data']);
      _more = list['meta']?['has_next'] == true;
      if (_ticket != null) {
        final detail = await api.get(
          '/merchant/support/tickets/$_ticket',
          query: {'site_id': _site, 'page': _messagePage},
        );
        if (!_valid(generation)) return;
        _current = Map<String, dynamic>.from(detail['data']['ticket'] as Map);
        _messages = _rows(detail['data']['messages']);
        _moreMessages = detail['data']['message_meta']?['has_next'] == true;
      }
    } catch (error) {
      if (_valid(generation)) {
        _readFailed = true;
        _notice = 'Support is unavailable. Refresh to try again.';
      }
    } finally {
      if (_valid(generation)) setState(() => _loading = false);
    }
  }

  Future<void> _send({bool retry = false}) async {
    if (_busy || _site == null) return;
    if (!retry) {
      if (_body.text.trim().isEmpty ||
          _ticket == null && _subject.text.trim().length < 3) {
        setState(() => _notice = 'Enter a subject and message.');
        return;
      }
      _pendingKey = const Uuid().v4();
      _pendingTarget = _ticket;
      _pendingOperation = _ticket == null ? 'create' : 'reply';
      _pendingBody = {
        'site_id': _site,
        'body': _body.text.trim(),
        if (_ticket == null) 'subject': _subject.text.trim(),
        if (_ticket == null) 'topic': 'general',
      };
    }
    final generation = _generation,
        command = ++_command,
        storageKey = _storageKey;
    setState(() {
      _busy = true;
      _notice = 'Saving request…';
    });
    try {
      if (storageKey == null)
        throw StateError('A current account is required.');
      await _storage.write(
        key: storageKey,
        value: jsonEncode({
          'key': _pendingKey,
          'operation': _pendingOperation,
          'target': _pendingTarget,
          'body': _pendingBody,
        }),
      );
      if (!_valid(generation)) return;
      final api = context.read<ApiClient>();
      final response = await api.post(
        _pendingOperation == 'create'
            ? '/merchant/support/tickets'
            : '/merchant/support/tickets/$_pendingTarget/messages',
        body: _pendingBody,
        options: ApiRequestOptions(idempotencyKey: _pendingKey, maxRetries: 0),
      );
      if (!_valid(generation)) return;
      await _storage.delete(key: storageKey);
      if (!_valid(generation)) return;
      _ticket = response['data']['ticket']['id'] as String;
      _pendingKey = null;
      _pendingBody = null;
      _body.clear();
      _subject.clear();
      _notice = 'Saved. Read replies here; email delivery is separate.';
      await _load();
    } catch (error) {
      if (_valid(generation)) {
        if (error is ApiException &&
            [400, 401, 403, 404, 409, 422].contains(error.statusCode)) {
          if (storageKey != null) await _storage.delete(key: storageKey);
          if (!_valid(generation)) return;
          setState(() {
            _pendingKey = null;
            _pendingBody = null;
            _notice =
                'Request refused. Your draft is retained. ${error.message}';
          });
        } else {
          setState(
            () => _notice =
                'Outcome not confirmed. Check this request before retrying.',
          );
        }
      }
    } finally {
      if (mounted && command == _command) setState(() => _busy = false);
    }
  }

  Future<void> _recover() async {
    if (_busy || _pendingKey == null) return;
    final generation = _generation,
        command = ++_command,
        storageKey = _storageKey;
    setState(() => _busy = true);
    try {
      final result = await context.read<ApiClient>().post(
        '/merchant/support/tickets/recovery',
        body: {
          'site_id': _site,
          'operation': _pendingOperation,
          'target_id': _pendingTarget,
          'key': _pendingKey,
        },
        options: ApiRequestOptions(idempotencyKey: _pendingKey, maxRetries: 0),
      );
      if (!_valid(generation)) return;
      if (result['data']['state'] == 'completed') {
        if (storageKey != null) await _storage.delete(key: storageKey);
        if (!_valid(generation)) return;
        _ticket = result['data']['result']['ticket']['id'] as String;
        _pendingKey = null;
        _pendingBody = null;
        _body.clear();
        _subject.clear();
        _notice = 'Saved request recovered.';
        await _load();
      } else {
        setState(
          () => _notice = 'No committed result recorded yet. Retry the same request safely.',
        );
      }
    } catch (error) {
      if (_valid(generation))
        setState(
          () => _notice = 'Recovery unavailable. Keep the pending request.',
        );
    } finally {
      if (mounted && command == _command) setState(() => _busy = false);
    }
  }

  @override
  void dispose() {
    _generation++;
    _stores?.removeListener(_contextChanged);
    _subject.dispose();
    _body.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final resolved = ['resolved', 'closed'].contains(_current?['status']);
    return Scaffold(
      appBar: AppBar(title: const Text('Support tickets')),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Semantics(liveRegion: true, child: Text(_notice)),
          TextButton(
            onPressed: _busy ? null : _load,
            child: const Text('Refresh tickets'),
          ),
          if (_loading)
            const Center(child: CircularProgressIndicator())
          else if (_readFailed)
            const Text('Ticket data is unavailable. Refresh to try again.')
          else ...[
            if (_ticket == null) ...[
              if (_tickets.isEmpty) const Text('No tickets for this store.'),
              ..._tickets.map(
                (ticket) => ListTile(
                  title: Text(ticket['subject'] as String),
                  subtitle: Text(
                    '${ticket['ticket_ref']} · ${ticket['status']}',
                  ),
                  onTap: _busy || _pendingKey != null
                      ? null
                      : () {
                          _ticket = ticket['id'] as String;
                          _messagePage = 1;
                          _load();
                        },
                ),
              ),
              Wrap(
                spacing: 8,
                runSpacing: 4,
                children: [
                  TextButton(
                    onPressed: _page > 1 && !_busy
                        ? () {
                            _page--;
                            _load();
                          }
                        : null,
                    child: const Text('Previous tickets'),
                  ),
                  TextButton(
                    onPressed: _more && !_busy
                        ? () {
                            _page++;
                            _load();
                          }
                        : null,
                    child: const Text('Next tickets'),
                  ),
                ],
              ),
              TextField(
                controller: _subject,
                maxLength: 240,
                enabled: !_busy && _pendingKey == null,
                decoration: const InputDecoration(labelText: 'Subject'),
              ),
            ] else ...[
              Text(
                '${_current?['subject'] ?? 'Ticket unavailable'} · ${_current?['status'] ?? ''}',
                style: Theme.of(context).textTheme.titleMedium,
              ),
              ..._messages.map(
                (message) => ListTile(
                  title: Text(
                    message['author_type'] == 'agent' ? 'Support' : 'You',
                  ),
                  subtitle: Text(message['body'] as String),
                ),
              ),
              Wrap(
                spacing: 8,
                runSpacing: 4,
                children: [
                  TextButton(
                    onPressed: _messagePage > 1 && !_busy
                        ? () {
                            _messagePage--;
                            _load();
                          }
                        : null,
                    child: const Text('Earlier messages'),
                  ),
                  TextButton(
                    onPressed: _moreMessages && !_busy
                        ? () {
                            _messagePage++;
                            _load();
                          }
                        : null,
                    child: const Text('Later messages'),
                  ),
                ],
              ),
              TextButton(
                onPressed: _busy || _pendingKey != null
                    ? null
                    : () {
                        _ticket = null;
                        _current = null;
                        _body.clear();
                        _load();
                      },
                child: const Text('New request'),
              ),
            ],
            if (!resolved) ...[
              TextField(
                controller: _body,
                maxLength: 4000,
                minLines: 3,
                maxLines: 8,
                enabled: !_busy && _pendingKey == null,
                decoration: const InputDecoration(labelText: 'Message'),
              ),
              FilledButton(
                onPressed: _busy || _pendingKey != null ? null : () => _send(),
                child: Text(_ticket == null ? 'Create ticket' : 'Send reply'),
              ),
            ] else
              const Text(
                'This ticket is resolved. Start a new request for further help.',
              ),
            if (_pendingKey != null) ...[
              TextButton(
                onPressed: _busy ? null : _recover,
                child: const Text('Check saved request'),
              ),
              TextButton(
                onPressed: _busy ? null : () => _send(retry: true),
                child: const Text('Retry same request'),
              ),
            ],
          ],
        ],
      ),
    );
  }
}
