import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../app/store_context.dart';
import 'package:image_picker/image_picker.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import '../../services/store_service.dart';

import '../../models/store_model.dart';

/// Store details editing screen
class StoreDetailsScreen extends StatefulWidget {
  const StoreDetailsScreen({super.key});

  @override
  State<StoreDetailsScreen> createState() => _StoreDetailsScreenState();
}

class _StoreDetailsScreenState extends State<StoreDetailsScreen> {
  StoreModel? _store;
  bool _isLoading = true;
  bool _isSaving = false;
  bool _hasChanges = false;

  final _nameController = TextEditingController();
  final _taglineController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _loadStore();
  }

  Future<void> _loadStore() async {
    setState(() => _isLoading = true);
    try {
      final store = await context.read<StoreContext>().ensureSelectedStore();
      setState(() {
        _store = store;
        _nameController.text = store?.name ?? '';
        _taglineController.text = store?.tagline ?? '';
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
        name: _nameController.text,
        tagline: _taglineController.text,
      );

      await storeService.updateStore(updatedStore.id, {
        'name': updatedStore.name,
        'tagline': updatedStore.tagline,
      });

      setState(() {
        _store = updatedStore;
        _hasChanges = false;
      });

      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: Text('Store details saved!')));
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
    _nameController.dispose();
    _taglineController.dispose();
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
        title: const Text('Store Details'),
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
          // Logo
          _buildLogoSection(),
          const SizedBox(height: 24),

          // Basic Info
          _buildSectionTitle('Basic Information'),
          const SizedBox(height: 12),
          _buildField(
            label: 'Store Name',
            hint: 'My Awesome Store',
            controller: _nameController,
            icon: Icons.store_rounded,
          ),
          const SizedBox(height: 16),
          _buildField(
            label: 'Tagline',
            hint: 'Your catchy tagline...',
            controller: _taglineController,
            icon: Icons.format_quote_rounded,
            maxLines: 2,
          ),
          const SizedBox(height: 24),

          // Store URL info
          _buildSectionTitle('Store URL'),
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.grey[50],
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: Colors.grey[200]!),
            ),
            child: Row(
              children: [
                Icon(Icons.link_rounded, color: Colors.grey[600]),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    '${_store?.subdomain ?? 'mystore'}.letbuyy.store',
                    style: TextStyle(
                      fontFamily: 'monospace',
                      color: Colors.grey[700],
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'Subdomain cannot be changed after creation',
            style: TextStyle(fontSize: 12, color: Colors.grey[500]),
          ),
          const SizedBox(height: 100),
        ],
      ),
    );
  }

  Widget _buildLogoSection() {
    return Center(
      child: Column(
        children: [
          GestureDetector(
            onTap: _pickLogo,
            child: Container(
              width: 100,
              height: 100,
              decoration: BoxDecoration(
                color: AppColors.primary.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(24),
                border: Border.all(
                  color: AppColors.primary.withValues(alpha: 0.3),
                  width: 2,
                ),
                image: _store?.logoUrl != null
                    ? DecorationImage(
                        image: NetworkImage(_store!.logoUrl!),
                        fit: BoxFit.cover,
                      )
                    : null,
              ),
              child: _store?.logoUrl == null
                  ? Icon(
                      Icons.add_a_photo_rounded,
                      color: AppColors.primary,
                      size: 32,
                    )
                  : null,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'Tap to change logo',
            style: TextStyle(color: Colors.grey[600], fontSize: 12),
          ),
        ],
      ),
    );
  }

  Widget _buildSectionTitle(String title) {
    return Text(
      title,
      style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 16),
    );
  }

  Widget _buildField({
    required String label,
    required String hint,
    required TextEditingController controller,
    required IconData icon,
    int maxLines = 1,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(fontWeight: FontWeight.w500, fontSize: 14),
        ),
        const SizedBox(height: 8),
        TextField(
          controller: controller,
          maxLines: maxLines,
          decoration: InputDecoration(
            hintText: hint,
            prefixIcon: Icon(icon, size: 20),
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

  Future<void> _pickLogo() async {
    final picker = ImagePicker();
    final image = await picker.pickImage(source: ImageSource.gallery);

    if (image != null) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Logo upload coming soon!')));
    }
  }
}
