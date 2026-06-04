import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import '../../services/store_service.dart';

import '../../models/store_model.dart';

/// SEO settings screen
class SEOSettingsScreen extends StatefulWidget {
  const SEOSettingsScreen({super.key});

  @override
  State<SEOSettingsScreen> createState() => _SEOSettingsScreenState();
}

class _SEOSettingsScreenState extends State<SEOSettingsScreen> {
  StoreModel? _store;
  bool _isLoading = true;
  bool _isSaving = false;
  bool _hasChanges = false;

  final _titleController = TextEditingController();
  final _descriptionController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _loadStore();
  }

  Future<void> _loadStore() async {
    setState(() => _isLoading = true);
    try {
      final storeService = context.read<StoreService>();
      final store = await storeService.getFirstStore();
      setState(() {
        _store = store;
        _titleController.text = store?.seoTitle ?? store?.name ?? '';
        _descriptionController.text = store?.seoDescription ?? '';
      });
    } catch (e) {
      debugPrint('Error loading store: $e');
    } finally {
      setState(() => _isLoading = false);
    }
  }

  Future<void> _save() async {
    if (_store == null || _isSaving) return;

    setState(() => _isSaving = true);
    try {
      final storeService = context.read<StoreService>();
      final updatedStore = _store!.copyWith(
        seoTitle: _titleController.text,
        seoDescription: _descriptionController.text,
      );

      await storeService.updateStore(updatedStore.id, {
        'seo_title': updatedStore.seoTitle,
        'seo_description': updatedStore.seoDescription,
      });

      setState(() {
        _store = updatedStore;
        _hasChanges = false;
      });

      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: Text('SEO settings saved!')));
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('Error: $e')));
      }
    } finally {
      setState(() => _isSaving = false);
    }
  }

  @override
  void dispose() {
    _titleController.dispose();
    _descriptionController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('SEO Settings'),
        backgroundColor: AppColors.background,
        surfaceTintColor: AppColors.background,
        actions: [
          if (_hasChanges)
            TextButton.icon(
              onPressed: _isSaving ? null : _save,
              icon: _isSaving
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.save_rounded, size: 18),
              label: const Text('Save'),
            ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          // Preview card
          _buildPreviewCard(),
          const SizedBox(height: 24),

          // SEO Title
          _buildField(
            label: 'SEO Title',
            hint: 'Your Store Name - Best Products',
            controller: _titleController,
            maxLength: 60,
            helperText: 'Recommended: 50-60 characters',
          ),
          const SizedBox(height: 20),

          // Meta Description
          _buildField(
            label: 'Meta Description',
            hint: 'Describe your store and what makes it special...',
            controller: _descriptionController,
            maxLength: 160,
            maxLines: 3,
            helperText: 'Recommended: 150-160 characters',
          ),
          const SizedBox(height: 24),

          // Tips
          _buildTipsCard(),
        ],
      ),
    );
  }

  Widget _buildPreviewCard() {
    final title = _titleController.text.isEmpty
        ? 'Your Store Name'
        : _titleController.text;
    final description = _descriptionController.text.isEmpty
        ? 'Your store description will appear here...'
        : _descriptionController.text;
    final url = '${_store?.subdomain ?? 'mystore'}.letbuyy.store';

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.grey[200]!),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Google Preview',
            style: TextStyle(
              fontSize: 12,
              color: Colors.grey[600],
              fontWeight: FontWeight.w500,
            ),
          ),
          const SizedBox(height: 12),
          Text(url, style: TextStyle(fontSize: 12, color: Colors.green[700])),
          const SizedBox(height: 4),
          Text(
            title,
            style: const TextStyle(
              fontSize: 18,
              color: Colors.blue,
              fontWeight: FontWeight.w500,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: 4),
          Text(
            description,
            style: TextStyle(fontSize: 13, color: Colors.grey[600]),
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    );
  }

  Widget _buildField({
    required String label,
    required String hint,
    required TextEditingController controller,
    String? helperText,
    int? maxLength,
    int maxLines = 1,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
        ),
        const SizedBox(height: 8),
        TextField(
          controller: controller,
          maxLength: maxLength,
          maxLines: maxLines,
          decoration: InputDecoration(
            hintText: hint,
            helperText: helperText,
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
            contentPadding: const EdgeInsets.symmetric(
              horizontal: 16,
              vertical: 14,
            ),
          ),
          onChanged: (_) {
            setState(() => _hasChanges = true);
          },
        ),
      ],
    );
  }

  Widget _buildTipsCard() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.blue[50],
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.blue[100]!),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.lightbulb_rounded, color: Colors.blue[700], size: 20),
              const SizedBox(width: 8),
              Text(
                'SEO Tips',
                style: TextStyle(
                  fontWeight: FontWeight.w600,
                  color: Colors.blue[700],
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          _buildTip('Include your main keywords in the title'),
          _buildTip('Write a compelling description that encourages clicks'),
          _buildTip('Use unique titles for each page'),
        ],
      ),
    );
  }

  Widget _buildTip(String text) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('• ', style: TextStyle(color: Colors.blue[700])),
          Expanded(
            child: Text(
              text,
              style: TextStyle(fontSize: 13, color: Colors.blue[800]),
            ),
          ),
        ],
      ),
    );
  }
}
