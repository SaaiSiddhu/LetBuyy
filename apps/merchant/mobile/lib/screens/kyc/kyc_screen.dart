import 'dart:io';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:image_picker/image_picker.dart';

import '../../app/store_context.dart';
import '../../services/api_client.dart';
import '../../services/kyc_service.dart';
import '../../theme/app_theme_colors.dart';

class KycScreen extends StatefulWidget {
  const KycScreen({super.key, this.pickDocumentPhoto});

  final Future<XFile?> Function()? pickDocumentPhoto;

  @override
  State<KycScreen> createState() => _KycScreenState();
}

class _KycScreenState extends State<KycScreen> {
  String? _storeId;
  String? _error;
  bool _loading = true;
  Map<String, dynamic>? _overview;
  StoreContext? _storeContext;
  KycService? _kyc;
  Object? _sdkContext;
  bool _referenceOpen = false;
  Object? _contextKey;
  int _requestVersion = 0;
  String? _refreshingId;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _kyc = context.read<KycService>();
    final stores = context.read<StoreContext>();
    if (!identical(stores, _storeContext)) {
      _storeContext?.removeListener(_onStoreContextChanged);
      _storeContext = stores;
      stores.addListener(_onStoreContextChanged);
    }
  }

  void _onStoreContextChanged() {
    if (!mounted || _contextKey == null) return;
    if (_storeContext?.requestContextKey == _contextKey &&
        _sdkContext == _kyc?.captureRequestContext())
      return;
    _requestVersion++;
    setState(() {
      _storeId = null;
      _overview = null;
      _sdkContext = null;
      _loading = false;
      _refreshingId = null;
      _error = 'Store access changed. Reload verification details.';
    });
  }

  @override
  void dispose() {
    _requestVersion++;
    _storeContext?.removeListener(_onStoreContextChanged);
    super.dispose();
  }

  bool _isCurrent(int version, Object key) =>
      mounted &&
      version == _requestVersion &&
      _storeContext?.requestContextKey == key &&
      _sdkContext == _kyc?.captureRequestContext();

  static const _documentTitles = {
    'business_pan': 'Business PAN',
    'bank_proof': 'Bank proof',
    'address_proof': 'Address proof',
    'gst_certificate': 'GST certificate',
    'identity_proof': 'Identity proof',
  };

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load({Object? expectedSDKContext}) async {
    final version = ++_requestVersion;
    final stores = context.read<StoreContext>();
    final epoch = stores.requestContextVersion;
    _contextKey = null;
    setState(() {
      _loading = true;
      _error = null;
      _overview = null;
      _storeId = null;
      _refreshingId = null;
    });
    try {
      final store = await stores.ensureSelectedStore();
      if (!mounted || version != _requestVersion) return;
      if (epoch != stores.requestContextVersion) {
        throw const ApiException(
          message: 'Store access changed.',
          statusCode: 409,
          code: 'SESSION_CONTEXT_CHANGED',
        );
      }
      if (store == null) {
        _error = 'Select a store to manage verification.';
        return;
      }
      final key = stores.requestContextKey;
      final service = context.read<KycService>();
      final sdkContext = expectedSDKContext ?? service.captureRequestContext();
      if (sdkContext != service.captureRequestContext())
        throw _changedContext();
      _contextKey = key;
      _sdkContext = sdkContext;
      final overview = await service.fetchOverview(
        store.id,
        options: ApiRequestOptions(expectedContextVersion: sdkContext),
      );
      if (!_isCurrent(version, key)) {
        _onStoreContextChanged();
        return;
      }
      _storeId = store.id;
      _overview = overview;
    } catch (error) {
      if (!mounted || version != _requestVersion) return;
      _overview = null;
      _error = error is ApiException && [401, 403].contains(error.statusCode)
          ? 'You do not have access to verification for this store.'
          : 'Verification details are temporarily unavailable.';
    } finally {
      if (mounted && version == _requestVersion)
        setState(() => _loading = false);
    }
  }

  Future<void> _refreshDocument(String documentId) async {
    final storeId = _storeId, key = _contextKey;
    final version = _requestVersion;
    if (storeId == null ||
        key == null ||
        _refreshingId != null ||
        !_isCurrent(version, key))
      return;
    final sdkContext = _sdkContext;
    setState(() => _refreshingId = documentId);
    try {
      await context.read<KycService>().refreshDocument(
        documentId,
        storeId,
        options: ApiRequestOptions(expectedContextVersion: sdkContext),
      );
      if (!_isCurrent(version, key)) {
        _onStoreContextChanged();
        return;
      }
      await _load(expectedSDKContext: sdkContext);
    } catch (error) {
      if (!_isCurrent(version, key)) {
        _onStoreContextChanged();
        return;
      }
      if (error is ApiException && [401, 403].contains(error.statusCode)) {
        setState(() {
          _overview = null;
          _storeId = null;
          _error = 'You do not have access to verification for this store.';
        });
        return;
      }
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Verification status is unavailable. Try refreshing again.',
          ),
        ),
      );
    } finally {
      if (mounted && version == _requestVersion)
        setState(() => _refreshingId = null);
    }
  }

  static ApiException _changedContext() => const ApiException(
    message: 'Store access changed. Reopen verification.',
    statusCode: 409,
    code: 'SESSION_CONTEXT_CHANGED',
  );

  Future<void> _showReferenceDialog([String? documentType]) async {
    final storeId = _storeId, key = _contextKey, stores = _storeContext;
    final version = _requestVersion, sdkContext = _sdkContext;
    if (storeId == null ||
        key == null ||
        stores == null ||
        _referenceOpen ||
        _overview?['private_upload_available'] != true ||
        !_isCurrent(version, key))
      return;
    final service = context.read<KycService>();
    bool current() =>
        _isCurrent(version, key) &&
        service.captureRequestContext() == sdkContext;
    setState(() => _referenceOpen = true);
    try {
      final recorded = await showDialog<bool>(
        context: context,
        builder: (dialogContext) => _ReferenceDialog(
          stores: stores,
          documentTypes: _documentTitles,
          initialType: _documentTitles.containsKey(documentType)
              ? documentType!
              : 'business_pan',
          isCurrent: current,
          record: (type, digits, file) async {
            if (!current()) throw _changedContext();
            await service.uploadDocument(
              storeId: storeId,
              documentType: type,
              documentNumberLast4: digits,
              file: file,
              options: ApiRequestOptions(expectedContextVersion: sdkContext),
            );
            if (!current()) throw _changedContext();
          },
          pickDocumentPhoto: widget.pickDocumentPhoto,
        ),
      );
      if (!mounted) return;
      if (!current()) {
        _onStoreContextChanged();
        return;
      }
      if (recorded == true) {
        setState(() => _overview = service.overview);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Private document received. No security scan result yet.'),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _referenceOpen = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    final canAddDocument =
        !_loading &&
        _error == null &&
        _storeId != null &&
        _overview?['private_upload_available'] == true;

    return Scaffold(
      backgroundColor: colors.card,
      appBar: AppBar(
        title: const Text('KYC'),
        backgroundColor: colors.card,
        foregroundColor: colors.textPrimary,
        elevation: 0,
        actions: [
          IconButton(
            onPressed: _loading || _referenceOpen ? null : _load,
            icon: const Icon(Icons.refresh_outlined),
            tooltip: 'Refresh',
          ),
        ],
      ),
      floatingActionButton: canAddDocument
          ? FloatingActionButton.extended(
              onPressed: _referenceOpen ? null : () => _showReferenceDialog(),
              icon: const Icon(Icons.edit_note),
              label: const Text('Add document'),
            )
          : null,
      body: Column(
        children: [
          ListTile(
            leading: const Icon(Icons.lock_outline),
            title: const Text('Private document upload'),
            subtitle: Text(
              _loading
                  ? 'Checking private upload availability.'
                  : _error != null
                  ? 'Verification is unavailable. Retry to check whether private upload is available.'
                  : _overview?['private_upload_available'] == false
                  ? 'Private upload is unavailable. Your saved status remains visible; retry later.'
                  : 'Upload verification documents here. A trusted security scan must pass before provider review.',
            ),
          ),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : _error != null
                ? _EmptyState(
                    message: _error!,
                    actionLabel: 'Retry',
                    onTap: _load,
                  )
                : Builder(
                    builder: (context) {
                      final overview = _overview ?? const <String, dynamic>{};
                      final documents = _listOfMaps(overview['documents']);
                      final requirements = _listOfMaps(
                        overview['required_documents'],
                      );
                      return RefreshIndicator(
                        onRefresh: _load,
                        child: ListView(
                          padding: const EdgeInsets.all(16),
                          children: [
                            _StatusPanel(overview: overview),
                            const SizedBox(height: 16),
                            Text(
                              'Verification documents',
                              style: TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.w700,
                                color: colors.textPrimary,
                              ),
                            ),
                            const SizedBox(height: 8),
                            ...requirements.map(
                              (item) => _RequirementTile(
                                item: item,
                                referenceRecorded: documents.any(
                                  (doc) =>
                                      doc['document_type'] ==
                                          item['document_type'] &&
                                      _referenceOnly(doc),
                                ),
                                onRecord:
                                    _referenceOpen ||
                                        overview['private_upload_available'] !=
                                            true
                                    ? null
                                    : () => _showReferenceDialog(
                                        item['document_type']?.toString(),
                                      ),
                              ),
                            ),
                            const SizedBox(height: 16),
                            Text(
                              'Submitted documents',
                              style: TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.w700,
                                color: colors.textPrimary,
                              ),
                            ),
                            const SizedBox(height: 8),
                            if (documents.isEmpty)
                              const _EmptyState(
                                message: 'No documents submitted yet.',
                                detail:
                                    'Upload documents privately. Reference digits alone do not verify identity or bank ownership.',
                              )
                            else
                              ...documents.map(
                                (document) => _DocumentTile(
                                  document: document,
                                  refreshing: _refreshingId == document['id'],
                                  onRefresh:
                                      _refreshingId != null || _referenceOpen
                                      ? null
                                      : () => _refreshDocument(
                                          document['id'].toString(),
                                        ),
                                ),
                              ),
                            const SizedBox(height: 80),
                          ],
                        ),
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }

  static List<Map<String, dynamic>> _listOfMaps(Object? value) {
    if (value is! List) return const [];
    return value
        .whereType<Map>()
        .map((row) => Map<String, dynamic>.from(row))
        .toList(growable: false);
  }
}

class _StatusPanel extends StatelessWidget {
  const _StatusPanel({required this.overview});

  final Map<String, dynamic> overview;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    final uploadUnavailable = overview['private_upload_available'] == false;
    final hasReference = (overview['documents'] as List? ?? const [])
        .whereType<Map>()
        .any(_referenceOnly);
    final status =
        hasReference ||
            (overview['provider_mode'] == 'sandbox' &&
                overview['overall_status'] == 'verified')
        ? 'in_progress'
        : overview['overall_status']?.toString() ?? 'not_started';
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: colors.glassLight,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: colors.glassMediumBorder),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          CircleAvatar(
            backgroundColor: _statusColor(status).withValues(alpha: 0.15),
            child: Icon(_statusIcon(status), color: _statusColor(status)),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  hasReference ? 'Verification pending' : _statusTitle(status),
                  style: TextStyle(
                    fontWeight: FontWeight.w700,
                    color: colors.textPrimary,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  uploadUnavailable
                      ? overview['next_action']?.toString() ??
                            'Private document upload is unavailable. Retry later.'
                      : hasReference
                      ? 'Reference digits are not verification evidence. Upload a private document.'
                      : overview['provider_mode'] == 'sandbox'
                      ? overview['next_action']?.toString() ??
                            'Sandbox uploads are not provider reviewed and do not approve live payouts.'
                      : overview['next_action']?.toString() ??
                            'Submit the required documents for provider review.',
                  style: TextStyle(color: colors.textSecondary),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _RequirementTile extends StatelessWidget {
  const _RequirementTile({
    required this.item,
    required this.onRecord,
    required this.referenceRecorded,
  });

  final Map<String, dynamic> item;
  final VoidCallback? onRecord;
  final bool referenceRecorded;

  @override
  Widget build(BuildContext context) {
    final status = referenceRecorded
        ? 'submitted'
        : item['status']?.toString() ?? 'draft';
    final requirement = item['required'] == true
        ? 'Required'
        : item['required'] == false
        ? 'Optional'
        : null;
    final progress = referenceRecorded
        ? 'Reference recorded · Upload required'
        : _statusTitle(status);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(_statusIcon(status), color: _statusColor(status)),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(item['title']?.toString() ?? 'Document'),
                    Text(
                      requirement == null
                          ? progress
                          : '$requirement · $progress',
                    ),
                  ],
                ),
              ),
            ],
          ),
          Align(
            alignment: Alignment.centerRight,
            child: TextButton(
              key: ValueKey('record-reference-${item['document_type']}'),
              onPressed: onRecord,
              child: const Text('Upload document'),
            ),
          ),
        ],
      ),
    );
  }
}

class _DocumentTile extends StatelessWidget {
  const _DocumentTile({
    required this.document,
    required this.onRefresh,
    required this.refreshing,
  });

  final Map<String, dynamic> document;
  final VoidCallback? onRefresh;
  final bool refreshing;

  @override
  Widget build(BuildContext context) {
    final referenceOnly = _referenceOnly(document);
    final status = referenceOnly
        ? 'submitted'
        : document['status']?.toString() ?? 'submitted';
    return ListTile(
      contentPadding: EdgeInsets.zero,
      leading: Icon(_statusIcon(status), color: _statusColor(status)),
      title: Text(
        _KycScreenState._documentTitles[document['document_type']] ??
            'Verification document',
      ),
      subtitle: Text(
        referenceOnly
            ? 'Reference recorded · Upload required'
            : '${_documentProgressTitle(document, status)} · ${document['file_name'] ?? 'document saved'}',
      ),
      trailing: IconButton(
        onPressed: onRefresh,
        icon: refreshing
            ? const SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(strokeWidth: 2),
              )
            : const Icon(Icons.sync_outlined),
        tooltip: 'Refresh status',
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState({
    required this.message,
    this.detail,
    this.actionLabel,
    this.onTap,
  });

  final String message;
  final String? detail;
  final String? actionLabel;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.verified_user_outlined, color: colors.textSecondary),
            const SizedBox(height: 12),
            Text(
              message,
              textAlign: TextAlign.center,
              style: TextStyle(
                color: colors.textPrimary,
                fontWeight: FontWeight.w700,
              ),
            ),
            if (detail != null) ...[
              const SizedBox(height: 6),
              Text(
                detail!,
                textAlign: TextAlign.center,
                style: TextStyle(color: colors.textSecondary),
              ),
            ],
            if (actionLabel != null && onTap != null) ...[
              const SizedBox(height: 12),
              OutlinedButton(onPressed: onTap, child: Text(actionLabel!)),
            ],
          ],
        ),
      ),
    );
  }
}

String _statusTitle(String status) {
  switch (status) {
    case 'verified':
      return 'Verified';
    case 'rejected':
      return 'Action needed';
    case 'needs_review':
      return 'Needs review';
    case 'submitted':
    case 'in_progress':
      return 'In progress';
    default:
      return 'Not started';
  }
}

String _documentProgressTitle(Map<String, dynamic> document, String status) {
  if (document['evidence_scan_status'] == 'rejected')
    return 'Security scan failed';
  if (document['requires_resubmission'] == true) return 'Replace document';
  if (status != 'submitted') return _statusTitle(status);
  switch (document['evidence_scan_status']) {
    case 'pending':
      return 'No scan result yet';
  }
  if (document['provider_unavailable'] == true) return 'Provider unavailable';
  if (document['provider_mode'] == 'sandbox') return 'Sandbox received';
  return 'Awaiting provider review';
}

IconData _statusIcon(String status) {
  switch (status) {
    case 'verified':
      return Icons.verified_outlined;
    case 'rejected':
      return Icons.error_outline;
    case 'needs_review':
      return Icons.rate_review_outlined;
    case 'submitted':
    case 'in_progress':
      return Icons.pending_actions_outlined;
    default:
      return Icons.radio_button_unchecked;
  }
}

Color _statusColor(String status) {
  switch (status) {
    case 'verified':
      return const Color(0xFF047857);
    case 'rejected':
      return const Color(0xFFB42318);
    case 'needs_review':
      return const Color(0xFFB54708);
    case 'submitted':
    case 'in_progress':
      return const Color(0xFF2563EB);
    default:
      return const Color(0xFF6B7280);
  }
}

// A reference-only acknowledgment is not evidence of document verification,
// even when the sandbox adapter returns its historical "verified" status.
bool _referenceOnly(Map row) =>
    (row['document_number_last4']?.toString().isNotEmpty ?? false) &&
    row['has_private_upload'] != true;

class _ReferenceDialog extends StatefulWidget {
  const _ReferenceDialog({
    required this.stores,
    required this.documentTypes,
    required this.initialType,
    required this.isCurrent,
    required this.record,
    this.pickDocumentPhoto,
  });
  final StoreContext stores;
  final Map<String, String> documentTypes;
  final String initialType;
  final bool Function() isCurrent;
  final Future<void> Function(String type, String digits, File file) record;
  final Future<XFile?> Function()? pickDocumentPhoto;

  @override
  State<_ReferenceDialog> createState() => _ReferenceDialogState();
}

class _ReferenceDialogState extends State<_ReferenceDialog> {
  final _digits = TextEditingController();
  late String _type = widget.initialType;
  bool _saving = false;
  XFile? _file;
  String? _error;

  @override
  void dispose() {
    _digits.dispose();
    super.dispose();
  }

  Future<void> _record() async {
    if (_saving || !widget.isCurrent()) return;
    final digits = _digits.text.trim();
    if (!RegExp(r'^[A-Za-z0-9]{2,4}$').hasMatch(digits)) {
      setState(() => _error = 'Enter only the final 2–4 reference characters.');
      return;
    }
    if (_file == null) {
      setState(() => _error = 'Choose a document photo.');
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await widget.record(_type, digits, File(_file!.path));
      if (!mounted || !widget.isCurrent()) return;
      Navigator.of(context).pop(true);
    } catch (error) {
      if (!mounted || !widget.isCurrent()) return;
      setState(
        () => _error =
            error is ApiException && [401, 403].contains(error.statusCode)
            ? 'You do not have permission to upload this document.'
            : 'Document could not be uploaded. Try again.',
      );
    } finally {
      if (mounted && widget.isCurrent()) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: widget.stores,
    builder: (context, _) {
      if (!widget.isCurrent()) {
        return AlertDialog(
          title: const Text('Store access changed'),
          content: const Text(
            'Close and reopen verification for the current account and store.',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: const Text('Close'),
            ),
          ],
        );
      }
      return AlertDialog(
        title: const Text('Upload verification document'),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text(
                'Choose a clear photo of your document (JPEG or PNG, under 5 MB). Upload is private and still requires provider review.',
              ),
              const SizedBox(height: 16),
              DropdownButtonFormField<String>(
                initialValue: _type,
                decoration: const InputDecoration(labelText: 'Document type'),
                items: widget.documentTypes.entries
                    .map(
                      (entry) => DropdownMenuItem(
                        value: entry.key,
                        child: Text(entry.value),
                      ),
                    )
                    .toList(),
                onChanged: _saving
                    ? null
                    : (value) {
                        if (value != null) setState(() => _type = value);
                      },
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _digits,
                enabled: !_saving,
                maxLength: 4,
                decoration: const InputDecoration(
                  labelText: 'Reference digits',
                  hintText: 'Last 4 characters, where available',
                ),
                textCapitalization: TextCapitalization.characters,
              ),
              OutlinedButton.icon(
                onPressed: _saving
                    ? null
                    : () async {
                        final selected =
                            await (widget.pickDocumentPhoto?.call() ??
                                ImagePicker().pickImage(
                                  source: ImageSource.gallery,
                                  imageQuality: 90,
                                ));
                        if (mounted && widget.isCurrent())
                          setState(() => _file = selected);
                      },
                icon: const Icon(Icons.upload_file),
                label: Text(_file?.name ?? 'Choose document photo'),
              ),
              if (_error != null)
                Text(_error!, key: const ValueKey('reference-error')),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Close'),
          ),
          FilledButton(
            onPressed: _saving ? null : _record,
            child: _saving
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Text('Upload document'),
          ),
        ],
      );
    },
  );
}
