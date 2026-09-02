import 'dart:io';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';

import '../../app/store_context.dart';
import '../../services/kyc_service.dart';
import '../../services/store_service.dart';
import '../../theme/app_theme_colors.dart';

class KycScreen extends StatefulWidget {
  const KycScreen({super.key});

  @override
  State<KycScreen> createState() => _KycScreenState();
}

class _KycScreenState extends State<KycScreen> {
  String? _storeId;
  String? _error;
  bool _loading = true;

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

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final store = await context.read<StoreContext>().ensureSelectedStore();
      if (store == null) {
        _error = 'Select a store to manage verification.';
        return;
      }
      _storeId = store.id;
      if (!mounted) return;
      await context.read<KycService>().fetchOverview(store.id);
    } catch (_) {
      _error = 'Verification details are temporarily unavailable.';
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _showSubmitSheet([String? initialType]) async {
    final storeId = _storeId;
    if (storeId == null) return;

    var selectedType = initialType ?? 'business_pan';
    var last4 = '';
    XFile? selectedFile;
    var uploading = false;
    var submitting = false;

    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (sheetContext) {
        final colors = AppThemeColors.of(sheetContext);
        return StatefulBuilder(
          builder: (context, setSheetState) {
            Future<void> pick(ImageSource source) async {
              final image = await ImagePicker().pickImage(
                source: source,
                imageQuality: 85,
              );
              if (image == null) return;
              setSheetState(() => selectedFile = image);
            }

            Future<void> submit() async {
              if (submitting || uploading) return;
              if (last4.trim().isEmpty && selectedFile == null) {
                ScaffoldMessenger.of(sheetContext).showSnackBar(
                  const SnackBar(
                    content: Text('Add a document image or reference digits.'),
                  ),
                );
                return;
              }

              setSheetState(() {
                submitting = true;
                uploading = selectedFile != null;
              });
              try {
                String? fileUrl;
                String? fileName;
                final file = selectedFile;
                if (file != null) {
                  fileName = file.name.isNotEmpty
                      ? file.name
                      : file.path.split(Platform.pathSeparator).last;
                  fileUrl = await context.read<StoreService>().uploadStoreAsset(
                    File(file.path),
                    folder: 'kyc-documents',
                  );
                }
                setSheetState(() => uploading = false);
                await context.read<KycService>().submitDocument(
                  storeId: storeId,
                  documentType: selectedType,
                  documentNumberLast4: last4.trim().isEmpty
                      ? null
                      : last4.trim(),
                  fileUrl: fileUrl,
                  fileName: fileName,
                );
                if (!mounted) return;
                Navigator.pop(sheetContext);
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Verification document saved.')),
                );
              } catch (_) {
                if (!mounted) return;
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    content: Text('Could not save this document right now.'),
                  ),
                );
              } finally {
                if (mounted) {
                  setSheetState(() {
                    submitting = false;
                    uploading = false;
                  });
                }
              }
            }

            return SafeArea(
              child: Padding(
                padding: EdgeInsets.only(
                  left: 20,
                  right: 20,
                  top: 20,
                  bottom: MediaQuery.of(context).viewInsets.bottom + 20,
                ),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Submit document',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w700,
                        color: colors.textPrimary,
                      ),
                    ),
                    const SizedBox(height: 16),
                    DropdownButtonFormField<String>(
                      value: selectedType,
                      decoration: const InputDecoration(
                        labelText: 'Document type',
                        border: OutlineInputBorder(),
                      ),
                      items: _documentTitles.entries
                          .map(
                            (entry) => DropdownMenuItem(
                              value: entry.key,
                              child: Text(entry.value),
                            ),
                          )
                          .toList(growable: false),
                      onChanged: (value) {
                        if (value != null) {
                          setSheetState(() => selectedType = value);
                        }
                      },
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      decoration: const InputDecoration(
                        labelText: 'Reference digits',
                        hintText: 'Last 4 digits if available',
                        border: OutlineInputBorder(),
                      ),
                      textCapitalization: TextCapitalization.characters,
                      maxLength: 8,
                      onChanged: (value) => last4 = value,
                    ),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        Expanded(
                          child: OutlinedButton.icon(
                            onPressed: submitting
                                ? null
                                : () => pick(ImageSource.camera),
                            icon: const Icon(Icons.photo_camera_outlined),
                            label: const Text('Camera'),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: OutlinedButton.icon(
                            onPressed: submitting
                                ? null
                                : () => pick(ImageSource.gallery),
                            icon: const Icon(Icons.photo_library_outlined),
                            label: const Text('Gallery'),
                          ),
                        ),
                      ],
                    ),
                    if (selectedFile != null) ...[
                      const SizedBox(height: 8),
                      Text(
                        selectedFile!.name.isNotEmpty
                            ? selectedFile!.name
                            : 'Document image selected',
                        style: TextStyle(color: colors.textSecondary),
                      ),
                    ],
                    const SizedBox(height: 16),
                    SizedBox(
                      width: double.infinity,
                      child: FilledButton.icon(
                        onPressed: submitting ? null : submit,
                        icon: submitting
                            ? const SizedBox(
                                width: 16,
                                height: 16,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                ),
                              )
                            : const Icon(Icons.verified_user_outlined),
                        label: Text(uploading ? 'Uploading...' : 'Submit'),
                      ),
                    ),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }

  Future<void> _refreshDocument(String documentId) async {
    final storeId = _storeId;
    if (storeId == null) return;
    try {
      await context.read<KycService>().refreshDocument(documentId, storeId);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Verification status updated.')),
      );
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Verification status is unavailable right now.'),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);

    return Scaffold(
      backgroundColor: colors.card,
      appBar: AppBar(
        title: const Text('KYC'),
        backgroundColor: colors.card,
        foregroundColor: colors.textPrimary,
        elevation: 0,
        actions: [
          IconButton(
            onPressed: _load,
            icon: const Icon(Icons.refresh_outlined),
            tooltip: 'Refresh',
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _showSubmitSheet(),
        icon: const Icon(Icons.add_a_photo_outlined),
        label: const Text('Add document'),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
          ? _EmptyState(message: _error!, actionLabel: 'Retry', onTap: _load)
          : Consumer<KycService>(
              builder: (context, kyc, _) {
                final overview = kyc.overview ?? const <String, dynamic>{};
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
                        'Required documents',
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
                          onTap: () => _showSubmitSheet(
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
                              'Add business PAN, bank proof, and address proof to start verification.',
                        )
                      else
                        ...documents.map(
                          (document) => _DocumentTile(
                            document: document,
                            onRefresh: () =>
                                _refreshDocument(document['id'].toString()),
                          ),
                        ),
                      const SizedBox(height: 80),
                    ],
                  ),
                );
              },
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
    final status = overview['overall_status']?.toString() ?? 'not_started';
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
                  _statusTitle(status),
                  style: TextStyle(
                    fontWeight: FontWeight.w700,
                    color: colors.textPrimary,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  overview['next_action']?.toString() ??
                      'Submit required business documents.',
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
  const _RequirementTile({required this.item, required this.onTap});

  final Map<String, dynamic> item;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final status = item['status']?.toString() ?? 'draft';
    return ListTile(
      contentPadding: EdgeInsets.zero,
      leading: Icon(_statusIcon(status), color: _statusColor(status)),
      title: Text(item['title']?.toString() ?? 'Document'),
      subtitle: Text(_statusTitle(status)),
      trailing: TextButton(onPressed: onTap, child: const Text('Submit')),
    );
  }
}

class _DocumentTile extends StatelessWidget {
  const _DocumentTile({required this.document, required this.onRefresh});

  final Map<String, dynamic> document;
  final VoidCallback onRefresh;

  @override
  Widget build(BuildContext context) {
    final status = document['status']?.toString() ?? 'submitted';
    return ListTile(
      contentPadding: EdgeInsets.zero,
      leading: Icon(_statusIcon(status), color: _statusColor(status)),
      title: Text(
        _KycScreenState._documentTitles[document['document_type']] ??
            'Verification document',
      ),
      subtitle: Text(
        '${_statusTitle(status)} · ${document['file_name'] ?? 'document saved'}',
      ),
      trailing: IconButton(
        onPressed: onRefresh,
        icon: const Icon(Icons.sync_outlined),
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
