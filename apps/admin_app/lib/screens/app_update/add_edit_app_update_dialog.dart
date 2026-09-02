// lib/screens/admin/app_update/add_edit_app_update_dialog.dart

import 'dart:io';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:file_picker/file_picker.dart';
import 'package:letbuyy_models/letbuyy_models.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';

class AddEditAppUpdateDialog extends StatefulWidget {
  final AppUpdateModel? update;
  final void Function(AppUpdateModel update, File? apkFile) onSave;

  const AddEditAppUpdateDialog({
    super.key,
    this.update,
    required this.onSave,
  });

  @override
  State<AddEditAppUpdateDialog> createState() => _AddEditAppUpdateDialogState();
}

class _AddEditAppUpdateDialogState extends State<AddEditAppUpdateDialog> {
  final _formKey = GlobalKey<FormState>();

  // Version fields (separated)
  late TextEditingController _majorController;
  late TextEditingController _minorController;
  late TextEditingController _patchController;
  late TextEditingController _buildController; // Version code

  // Content fields
  late TextEditingController _messageController;
  late TextEditingController _releaseNotesController;

  bool _mandatory = false;
  bool _isActive = false;
  AppType _selectedAppType = AppType.marketplace;

  File? _selectedApkFile;
  String? _apkUrlPreview;
  int _fileSize = 0;
  bool _isUploading = false;

  @override
  void initState() {
    super.initState();
    _majorController = TextEditingController(
        text: widget.update?.versionMajor.toString() ?? '1');
    _minorController = TextEditingController(
        text: widget.update?.versionMinor.toString() ?? '0');
    _patchController = TextEditingController(
        text: widget.update?.versionPatch.toString() ?? '0');
    _buildController = TextEditingController(
        text: widget.update?.versionCode.toString() ?? '');

    _messageController =
        TextEditingController(text: widget.update?.updateMessage ?? '');
    _releaseNotesController =
        TextEditingController(text: widget.update?.releaseNotes ?? '');

    _mandatory = widget.update?.mandatory ?? false;
    _isActive = widget.update?.isActive ?? false;
    _selectedAppType = widget.update?.appType ?? AppType.marketplace;
    _apkUrlPreview = widget.update?.apkUrl ?? '';
    _fileSize = widget.update?.fileSize ?? 0;
  }

  @override
  void dispose() {
    _majorController.dispose();
    _minorController.dispose();
    _patchController.dispose();
    _buildController.dispose();
    _messageController.dispose();
    _releaseNotesController.dispose();
    super.dispose();
  }

  Future<void> _pickApkFile() async {
    try {
      final result = await FilePicker.platform.pickFiles(
        type: FileType.custom,
        allowedExtensions: ['apk'],
      );

      if (result != null && result.files.isNotEmpty) {
        if (!kIsWeb) {
          final file = File(result.files.first.path!);
          final size = await file.length();
          setState(() {
            _selectedApkFile = file;
            _apkUrlPreview = null;
            _fileSize = size;
          });
        } else {
          // Web: get size from result
          setState(() {
            _fileSize = result.files.first.size;
          });
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text(
                  "APK upload on Web requires different handling. Using mobile admin recommended."),
            ),
          );
        }
      }
    } catch (e) {
      print("❌ APK pick error: $e");
    }
  }

  void _onSave() {
    if (!_formKey.currentState!.validate()) return;

    final major = int.tryParse(_majorController.text.trim()) ?? 1;
    final minor = int.tryParse(_minorController.text.trim()) ?? 0;
    final patch = int.tryParse(_patchController.text.trim()) ?? 0;
    final versionCode = int.tryParse(_buildController.text.trim()) ?? 0;

    if (versionCode <= 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please enter a valid build number')),
      );
      return;
    }

    setState(() => _isUploading = true);

    final update = AppUpdateModel(
      id: widget.update?.id ?? '',
      appType: _selectedAppType,
      versionCode: versionCode,
      versionMajor: major,
      versionMinor: minor,
      versionPatch: patch,
      apkUrl: _apkUrlPreview ?? '',
      updateMessage: _messageController.text.trim(),
      releaseNotes: _releaseNotesController.text.trim(),
      fileSize: _fileSize,
      mandatory: _mandatory,
      isActive: _isActive,
      createdAt: widget.update?.createdAt ?? DateTime.now(),
    );

    widget.onSave(update, _selectedApkFile);
  }

  String _formatFileSize(int bytes) {
    if (bytes <= 0) return '';
    if (bytes < 1024) return '$bytes B';
    if (bytes < 1024 * 1024) return '${(bytes / 1024).toStringAsFixed(1)} KB';
    return '${(bytes / 1024 / 1024).toStringAsFixed(1)} MB';
  }

  @override
  Widget build(BuildContext context) {
    final isEditing = widget.update != null;

    return Dialog(
      insetPadding: const EdgeInsets.all(16),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      child: Container(
        width: 450,
        constraints: BoxConstraints(
          maxHeight: MediaQuery.of(context).size.height * 0.85,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Header
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [AppColors.primaryDark, AppColors.primary],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius:
                    const BorderRadius.vertical(top: Radius.circular(20)),
              ),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.2),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Icon(
                      Icons.system_update_rounded,
                      color: Colors.white,
                      size: 24,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          isEditing ? 'Edit App Update' : 'Create App Update',
                          style: const TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                            color: Colors.white,
                          ),
                        ),
                        Text(
                          isEditing
                              ? 'Modify version details'
                              : 'Push a new version to users',
                          style: TextStyle(
                            fontSize: 12,
                            color: Colors.white.withValues(alpha: 0.8),
                          ),
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    onPressed: () => Navigator.pop(context),
                    icon: const Icon(Icons.close, color: Colors.white),
                  ),
                ],
              ),
            ),

            // Form Content
            Flexible(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(20),
                child: Form(
                  key: _formKey,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // APP TYPE SELECTOR
                      _buildSectionHeader('Target App', Icons.apps),
                      const SizedBox(height: 12),
                      DropdownButtonFormField<AppType>(
                        initialValue: _selectedAppType,
                        decoration: InputDecoration(
                          prefixIcon: const Icon(Icons.phone_android),
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                          contentPadding: const EdgeInsets.symmetric(
                            horizontal: 16,
                            vertical: 14,
                          ),
                        ),
                        items: AppType.values.map((type) {
                          return DropdownMenuItem<AppType>(
                            value: type,
                            child: Row(
                              children: [
                                Icon(
                                  _getAppIcon(type),
                                  size: 20,
                                  color: _getAppColor(type),
                                ),
                                const SizedBox(width: 12),
                                Text(type.displayName),
                              ],
                            ),
                          );
                        }).toList(),
                        onChanged: (val) {
                          if (val != null) {
                            setState(() => _selectedAppType = val);
                          }
                        },
                      ),
                      const SizedBox(height: 24),

                      // VERSION SECTION
                      _buildSectionHeader('Version Info', Icons.numbers),
                      const SizedBox(height: 12),

                      // Semantic Version (Major . Minor . Patch)
                      const Text(
                        'Version Name',
                        style: TextStyle(
                            fontSize: 13, fontWeight: FontWeight.w500),
                      ),
                      const SizedBox(height: 8),
                      Row(
                        children: [
                          _buildVersionField(_majorController, 'Major'),
                          _buildVersionDot(),
                          _buildVersionField(_minorController, 'Minor'),
                          _buildVersionDot(),
                          _buildVersionField(_patchController, 'Patch'),
                        ],
                      ),
                      const SizedBox(height: 16),

                      // Build Number (Version Code)
                      TextFormField(
                        controller: _buildController,
                        keyboardType: TextInputType.number,
                        inputFormatters: [
                          FilteringTextInputFormatter.digitsOnly
                        ],
                        decoration: InputDecoration(
                          labelText: 'Build Number (Version Code)',
                          hintText: 'e.g., 4008',
                          prefixIcon: const Icon(Icons.build_rounded),
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                          helperText:
                              'Unique integer used for update comparison',
                        ),
                        validator: (v) =>
                            (v == null || int.tryParse(v) == null)
                                ? 'Enter valid number'
                                : null,
                      ),

                      const SizedBox(height: 24),

                      // APK SECTION
                      _buildSectionHeader('APK File', Icons.android),
                      const SizedBox(height: 12),

                      // APK Upload Card
                      InkWell(
                        onTap: _pickApkFile,
                        borderRadius: BorderRadius.circular(12),
                        child: Container(
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(
                            border: Border.all(
                              color: _selectedApkFile != null
                                  ? AppColors.primary
                                  : Colors.grey.shade300,
                              width: _selectedApkFile != null ? 2 : 1,
                            ),
                            borderRadius: BorderRadius.circular(12),
                            color: _selectedApkFile != null
                                ? AppColors.primary.withValues(alpha: 0.05)
                                : Colors.grey.shade50,
                          ),
                          child: Row(
                            children: [
                              Container(
                                padding: const EdgeInsets.all(12),
                                decoration: BoxDecoration(
                                  color: _selectedApkFile != null
                                      ? AppColors.primary.withValues(alpha: 0.1)
                                      : Colors.grey.shade200,
                                  borderRadius: BorderRadius.circular(10),
                                ),
                                child: Icon(
                                  _selectedApkFile != null
                                      ? Icons.check_circle
                                      : Icons.upload_file,
                                  color: _selectedApkFile != null
                                      ? AppColors.primary
                                      : Colors.grey,
                                  size: 28,
                                ),
                              ),
                              const SizedBox(width: 16),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      _selectedApkFile != null
                                          ? _selectedApkFile!.path
                                              .split('/')
                                              .last
                                          : (_apkUrlPreview?.isNotEmpty == true
                                              ? 'Existing APK'
                                              : 'Select APK File'),
                                      style: TextStyle(
                                        fontWeight: FontWeight.w600,
                                        color: _selectedApkFile != null
                                            ? AppColors.primary
                                            : Colors.black87,
                                      ),
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                    if (_fileSize > 0) ...[
                                      const SizedBox(height: 4),
                                      Text(
                                        _formatFileSize(_fileSize),
                                        style: TextStyle(
                                          fontSize: 12,
                                          color: Colors.grey.shade600,
                                        ),
                                      ),
                                    ],
                                  ],
                                ),
                              ),
                              Icon(
                                Icons.chevron_right,
                                color: Colors.grey.shade400,
                              ),
                            ],
                          ),
                        ),
                      ),

                      const SizedBox(height: 24),

                      // CONTENT SECTION
                      _buildSectionHeader('Update Content', Icons.edit_note),
                      const SizedBox(height: 12),

                      // Update Message
                      TextFormField(
                        controller: _messageController,
                        maxLines: 2,
                        decoration: InputDecoration(
                          labelText: 'Update Message',
                          hintText: 'Brief description shown to users',
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                        ),
                      ),
                      const SizedBox(height: 16),

                      // Release Notes
                      TextFormField(
                        controller: _releaseNotesController,
                        maxLines: 4,
                        decoration: InputDecoration(
                          labelText: 'Release Notes',
                          hintText:
                              '• Bug fixes\n• New features\n• Performance improvements',
                          alignLabelWithHint: true,
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                        ),
                      ),

                      const SizedBox(height: 24),

                      // OPTIONS SECTION
                      _buildSectionHeader('Options', Icons.settings),
                      const SizedBox(height: 12),

                      // Toggles Row
                      Row(
                        children: [
                          Expanded(
                            child: _buildToggleCard(
                              'Mandatory',
                              'Users must update',
                              Icons.warning_amber_rounded,
                              _mandatory,
                              (v) => setState(() => _mandatory = v),
                              Colors.orange,
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: _buildToggleCard(
                              'Active',
                              'Make live now',
                              Icons.public,
                              _isActive,
                              (v) => setState(() => _isActive = v),
                              Colors.green,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ),

            // Footer
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.grey.shade50,
                borderRadius:
                    const BorderRadius.vertical(bottom: Radius.circular(20)),
                border: Border(
                  top: BorderSide(color: Colors.grey.shade200),
                ),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () => Navigator.pop(context),
                      style: OutlinedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                      child: const Text('Cancel'),
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    flex: 2,
                    child: ElevatedButton(
                      onPressed: _isUploading ? null : _onSave,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.primary,
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                      child: _isUploading
                          ? const SizedBox(
                              height: 20,
                              width: 20,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: Colors.white,
                              ),
                            )
                          : Text(
                              isEditing ? 'Update' : 'Create Update',
                              style:
                                  const TextStyle(fontWeight: FontWeight.w600),
                            ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSectionHeader(String title, IconData icon) {
    return Row(
      children: [
        Icon(icon, size: 18, color: AppColors.primary),
        const SizedBox(width: 8),
        Text(
          title,
          style: TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.bold,
            color: AppColors.primaryDark,
          ),
        ),
      ],
    );
  }

  Widget _buildVersionField(TextEditingController controller, String label) {
    return Expanded(
      child: TextFormField(
        controller: controller,
        keyboardType: TextInputType.number,
        textAlign: TextAlign.center,
        inputFormatters: [FilteringTextInputFormatter.digitsOnly],
        style: const TextStyle(
          fontSize: 20,
          fontWeight: FontWeight.bold,
        ),
        decoration: InputDecoration(
          hintText: '0',
          helperText: label,
          helperStyle: const TextStyle(fontSize: 11),
          contentPadding:
              const EdgeInsets.symmetric(vertical: 16, horizontal: 8),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
          ),
        ),
        validator: (v) =>
            (v == null || int.tryParse(v) == null) ? 'Invalid' : null,
      ),
    );
  }

  Widget _buildVersionDot() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 8),
      child: Text(
        '.',
        style: TextStyle(
          fontSize: 32,
          fontWeight: FontWeight.bold,
          color: AppColors.primary,
        ),
      ),
    );
  }

  Widget _buildToggleCard(
    String title,
    String subtitle,
    IconData icon,
    bool value,
    ValueChanged<bool> onChanged,
    Color color,
  ) {
    return InkWell(
      onTap: () => onChanged(!value),
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          border: Border.all(
            color: value ? color : Colors.grey.shade300,
            width: value ? 2 : 1,
          ),
          borderRadius: BorderRadius.circular(12),
          color: value ? color.withValues(alpha: 0.05) : Colors.grey.shade50,
        ),
        child: Row(
          children: [
            Icon(icon, color: value ? color : Colors.grey, size: 20),
            const SizedBox(width: 8),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: TextStyle(
                      fontWeight: FontWeight.w600,
                      fontSize: 13,
                      color: value ? color : Colors.black87,
                    ),
                  ),
                  Text(
                    subtitle,
                    style: TextStyle(
                      fontSize: 10,
                      color: Colors.grey.shade600,
                    ),
                  ),
                ],
              ),
            ),
            Switch(
              value: value,
              onChanged: onChanged,
              activeThumbColor: color,
            ),
          ],
        ),
      ),
    );
  }

  IconData _getAppIcon(AppType type) {
    switch (type) {
      case AppType.admin:
        return Icons.admin_panel_settings;
      case AppType.marketplace:
        return Icons.shopping_cart;
      case AppType.seller:
        return Icons.storefront;
      case AppType.store:
        return Icons.store;
    }
  }

  Color _getAppColor(AppType type) {
    switch (type) {
      case AppType.admin:
        return Colors.purple;
      case AppType.marketplace:
        return Colors.blue;
      case AppType.seller:
        return Colors.orange;
      case AppType.store:
        return Colors.teal;
    }
  }
}
