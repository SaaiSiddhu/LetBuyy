import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:uuid/uuid.dart';

import '../../app/store_context.dart';
import '../../services/two_factor_service.dart';
import '../../services/security_command_store.dart';
import '../../services/api_client.dart';
import '../../theme/app_theme_colors.dart';

class TwoFactorScreen extends StatefulWidget {
  const TwoFactorScreen({super.key, this.approvalAction});
  final String? approvalAction;
  static Future<MerchantStepUpProof?> approve(
    BuildContext context, {
    String action = 'refund.approve',
  }) => Navigator.of(context).push<MerchantStepUpProof>(
    MaterialPageRoute(builder: (_) => TwoFactorScreen(approvalAction: action)),
  );
  @override
  State<TwoFactorScreen> createState() => _TwoFactorScreenState();
}

class _TwoFactorScreenState extends State<TwoFactorScreen> {
  final _code = TextEditingController();
  MerchantSecurityContext? _context;
  JsonMap? _enrollment;
  List<String> _codes = [];
  String? _activeId, _recoverId, _error;
  bool _loading = true,
      _working = false,
      _blocked = false,
      _disable = false,
      _useRecovery = false;
  String _challengeKey = const Uuid().v4();
  int _generation = 0;
  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    context.watch<StoreContext>();
    final security = context.read<TwoFactorService>();
    if (_context != null && !security.isCurrent(_context!)) {
      _generation++;
      _enrollment = null;
      _codes = [];
      _activeId = null;
      _recoverId = null;
      _code.clear();
      _blocked = true;
      _loading = false;
      _working = false;
      _error = 'The account or store changed. Close this screen and reopen it.';
    } else if (_context == null) {
      try {
        _context = security.capture();
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (mounted) _load();
        });
      } catch (_) {
        _blocked = true;
        _loading = false;
        _error = 'Sign in and select a store before changing security.';
      }
    }
  }

  bool _current(int generation) =>
      mounted &&
      ModalRoute.of(context)?.isCurrent == true &&
      !_blocked &&
      _generation == generation &&
      _context != null &&
      context.read<TwoFactorService>().isCurrent(_context!);
  Future<void> _load() async {
    if (_blocked || _context == null || _working) return;
    final generation = ++_generation;
    setState(() {
      _loading = true;
      _error = null;
      _enrollment = null;
      _codes = [];
    });
    try {
      final data = await context.read<TwoFactorService>().fetchOverview(
        expectedContext: _context!.version,
      );
      if (!_current(generation)) return;
      final active = (data['factors'] as List)
          .whereType<Map>()
          .where(
            (factor) =>
                factor['factor_type'] == 'totp' && factor['status'] == 'active',
          )
          .firstOrNull;
      setState(() {
        _activeId = active?['id']?.toString();
        _recoverId = data['pending_activation_factor_id']?.toString();
      });
    } catch (error) {
      if (_current(generation)) setState(() => _error = error.toString());
    } finally {
      if (_current(generation)) setState(() => _loading = false);
    }
  }

  Future<void> _run(
    Future<void> Function(TwoFactorService security, int generation) action,
  ) async {
    if (_working || _blocked || _loading || _context == null) return;
    final generation = _generation;
    setState(() {
      _working = true;
      _error = null;
    });
    try {
      await action(context.read<TwoFactorService>(), generation);
    } catch (error) {
      if (_current(generation)) setState(() => _error = error.toString());
    } finally {
      if (_current(generation)) setState(() => _working = false);
    }
  }

  Future<void> _enroll() => _run((security, generation) async {
    final data = await security.enrollTotp(expectedContext: _context!.version);
    if (!_current(generation)) return;
    setState(() {
      _enrollment = data;
      _code.clear();
    });
  });
  Future<void> _activate() => _run((security, generation) async {
    final id = _enrollment == null
        ? _recoverId
        : asJsonMap(_enrollment!['factor'])['id']?.toString();
    if (id == null) return;
    final data = await security.verifyTotp(
      factorId: id,
      code: _code.text.trim(),
      expectedContext: _context!.version,
    );
    if (!_current(generation)) return;
    setState(() {
      _activeId = id;
      _enrollment = null;
      _recoverId = null;
      _codes = List<String>.from(data['recovery_codes']);
      _code.clear();
    });
  });
  Future<void> _acknowledge() => _run((security, generation) async {
    await security.acknowledgeRecovery(
      _activeId!,
      expectedContext: _context!.version,
    );
    if (!_current(generation)) return;
    setState(() => _codes = []);
  });
  Future<void> _disableFactor() => _run((security, generation) async {
    await security.disable(
      factorId: _activeId!,
      code: _useRecovery ? null : _code.text.trim(),
      recoveryCode: _useRecovery ? _code.text.trim() : null,
      expectedContext: _context!.version,
    );
    if (!_current(generation)) return;
    setState(() {
      _activeId = null;
      _disable = false;
      _code.clear();
    });
  });
  Future<void> _approve() => _run((security, generation) async {
    final proof = await security.challenge(
      action: widget.approvalAction!,
      factorId: _activeId!,
      code: _code.text.trim(),
      idempotencyKey: _challengeKey,
      expectedContext: _context!.version,
    );
    if (!_current(generation)) return;
    _code.clear();
    Navigator.of(context).pop(proof);
  });
  Widget _input(String label, {bool recovery = false}) => TextField(
    controller: _code,
    obscureText: recovery,
    autocorrect: false,
    enableSuggestions: false,
    keyboardType: recovery ? TextInputType.text : TextInputType.number,
    inputFormatters: recovery
        ? null
        : [
            FilteringTextInputFormatter.digitsOnly,
            LengthLimitingTextInputFormatter(6),
          ],
    autofillHints: recovery ? null : const [AutofillHints.oneTimeCode],
    decoration: InputDecoration(
      labelText: label,
      border: const OutlineInputBorder(),
    ),
  );
  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    final security = context.watch<TwoFactorService>();
    return Scaffold(
      backgroundColor: colors.card,
      appBar: AppBar(
        title: Text(
          widget.approvalAction == null
              ? 'Two-factor authentication'
              : 'Verify refund approval',
        ),
        backgroundColor: colors.card,
        foregroundColor: colors.textPrimary,
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(20),
              children: [
                if (_error != null) ...[
                  Text(
                    _error!,
                    key: const Key('security-error'),
                    style: TextStyle(color: colors.error),
                  ),
                  const SizedBox(height: 16),
                ],
                if (_blocked)
                  const Text('Account or store access changed')
                else if (_codes.isNotEmpty) ...[
                  const Text(
                    'Save your recovery codes',
                    style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700),
                  ),
                  const SizedBox(height: 12),
                  const Text(
                    'Store these codes somewhere safe. Each can disable this authenticator while you are signed in. They cannot replace your password or recover a signed-out account.',
                  ),
                  const SizedBox(height: 12),
                  for (final code in _codes) SelectableText(code),
                  const SizedBox(height: 16),
                  FilledButton(
                    onPressed: _working ? null : _acknowledge,
                    child: const Text('I saved my recovery codes'),
                  ),
                ] else if (_enrollment != null || _recoverId != null) ...[
                  Text(
                    _recoverId == null
                        ? 'Set up authenticator'
                        : 'Recover your activation result',
                    style: const TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 12),
                  if (_enrollment != null)
                    SelectableText(
                      _enrollment!['secret'] as String,
                      semanticsLabel: 'Authenticator secret',
                    )
                  else
                    const Text(
                      'Enter a current authenticator code to recover the original recovery codes within 10 minutes. If that window has expired, continue without recovered codes, then disable and set up the authenticator again for new codes.',
                    ),
                  const SizedBox(height: 16),
                  _input('6-digit code'),
                  const SizedBox(height: 16),
                  FilledButton(
                    onPressed: _working ? null : _activate,
                    child: const Text('Verify and enable'),
                  ),
                  if (_recoverId != null && _error != null)
                    TextButton(
                      onPressed: _working
                          ? null
                          : () => _run((security, generation) async {
                              await security.acknowledgeRecovery(
                                _recoverId!,
                                expectedContext: _context!.version,
                              );
                              if (_current(generation))
                                setState(() => _recoverId = null);
                            }),
                      child: const Text('Continue without recovered codes'),
                    ),
                ] else if (_activeId != null) ...[
                  const Text(
                    'Authenticator app active',
                    style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700),
                  ),
                  const SizedBox(height: 16),
                  if (widget.approvalAction != null) ...[
                    _input('Authenticator code'),
                    const SizedBox(height: 16),
                    FilledButton(
                      onPressed: _working ? null : _approve,
                      child: const Text('Verify approval'),
                    ),
                    if (_error != null)
                      TextButton(
                        onPressed: _working
                            ? null
                            : () {
                                setState(() {
                                  _challengeKey = const Uuid().v4();
                                  _code.clear();
                                  _error = null;
                                });
                              },
                        child: const Text('Start a new verification'),
                      ),
                  ] else if (!_disable)
                    OutlinedButton(
                      onPressed: _working
                          ? null
                          : () => setState(() => _disable = true),
                      child: const Text('Disable authenticator'),
                    )
                  else ...[
                    CheckboxListTile(
                      value: _useRecovery,
                      onChanged: _working
                          ? null
                          : (value) => setState(() {
                              _useRecovery = value ?? false;
                              _code.clear();
                            }),
                      title: const Text('Use a recovery code'),
                    ),
                    _input(
                      _useRecovery ? 'Recovery code' : 'Authenticator code',
                      recovery: _useRecovery,
                    ),
                    const SizedBox(height: 16),
                    FilledButton(
                      onPressed: _working ? null : _disableFactor,
                      child: const Text('Confirm disable'),
                    ),
                  ],
                ] else if (_error != null)
                  FilledButton(
                    onPressed: _working ? null : _load,
                    child: const Text('Retry loading security'),
                  )
                else ...[
                  const Text('No authenticator configured'),
                  const SizedBox(height: 16),
                  FilledButton(
                    onPressed: _working ? null : _enroll,
                    child: const Text('Set up authenticator app'),
                  ),
                ],
                if (!_blocked &&
                    widget.approvalAction == null &&
                    !_loading &&
                    _enrollment == null &&
                    _codes.isEmpty &&
                    _recoverId == null) ...[
                  const SizedBox(height: 20),
                  const Text(
                    'Factors',
                    style: TextStyle(fontWeight: FontWeight.w700),
                  ),
                  for (final factor in security.factors)
                    ListTile(
                      leading: const Icon(Icons.security_outlined),
                      title: Text(factor['label']?.toString() ?? 'TOTP'),
                      subtitle: Text(factor['status']?.toString() ?? ''),
                    ),
                  const SizedBox(height: 20),
                  const Text(
                    'Active sessions',
                    style: TextStyle(fontWeight: FontWeight.w700),
                  ),
                  if (security.sessions.isEmpty)
                    const Text('No active sessions found.'),
                  for (final session in security.sessions)
                    ListTile(
                      leading: const Icon(Icons.devices_outlined),
                      title: Text(
                        session['device_id']?.toString() ?? 'Current device',
                      ),
                      subtitle: Text(
                        'Last active ${session['last_active'] ?? 'recently'}',
                      ),
                    ),
                ],
                if (_working)
                  const Padding(
                    padding: EdgeInsets.all(16),
                    child: Center(child: CircularProgressIndicator()),
                  ),
                const SizedBox(height: 12),
                TextButton(
                  onPressed: () => Navigator.of(context).pop(),
                  child: const Text('Close security'),
                ),
              ],
            ),
    );
  }

  @override
  void dispose() {
    _generation++;
    _enrollment = null;
    _codes = [];
    _code.clear();
    _code.dispose();
    super.dispose();
  }
}
