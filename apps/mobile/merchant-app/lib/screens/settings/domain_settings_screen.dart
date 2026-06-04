import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import '../../services/store_service.dart';

import '../../models/store_model.dart';

/// Domain settings screen
class DomainSettingsScreen extends StatefulWidget {
  const DomainSettingsScreen({super.key});

  @override
  State<DomainSettingsScreen> createState() => _DomainSettingsScreenState();
}

class _DomainSettingsScreenState extends State<DomainSettingsScreen> {
  StoreModel? _store;
  bool _isLoading = true;
  final _customDomainController = TextEditingController();

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
        _customDomainController.text = store?.customDomain ?? '';
      });
    } catch (e) {
      debugPrint('Error loading store: $e');
    } finally {
      setState(() => _isLoading = false);
    }
  }

  @override
  void dispose() {
    _customDomainController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    final subdomain = _store?.subdomain ?? 'mystore';
    final defaultUrl = '$subdomain.letbuyy.store';

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Domain Settings'),
        backgroundColor: AppColors.background,
        surfaceTintColor: AppColors.background,
      ),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          // Default domain
          _buildSection(
            title: 'Default Domain',
            description: 'Your free LetBuyy subdomain',
            child: Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.grey[200]!),
              ),
              child: Row(
                children: [
                  Container(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(
                      color: AppColors.primary.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Icon(Icons.link_rounded, color: AppColors.primary),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          defaultUrl,
                          style: const TextStyle(
                            fontWeight: FontWeight.w600,
                            fontSize: 15,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Row(
                          children: [
                            Container(
                              width: 8,
                              height: 8,
                              decoration: const BoxDecoration(
                                color: Colors.green,
                                shape: BoxShape.circle,
                              ),
                            ),
                            const SizedBox(width: 6),
                            Text(
                              'Active',
                              style: TextStyle(
                                fontSize: 12,
                                color: Colors.grey[600],
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.copy_rounded, size: 20),
                    onPressed: () {
                      Clipboard.setData(
                        ClipboardData(text: 'https://$defaultUrl'),
                      );
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('URL copied!')),
                      );
                    },
                    color: Colors.grey[600],
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 24),

          // Custom domain
          _buildSection(
            title: 'Custom Domain',
            description: 'Connect your own domain (Premium)',
            child: Column(
              children: [
                TextField(
                  controller: _customDomainController,
                  decoration: InputDecoration(
                    hintText: 'www.yourstore.com',
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                    prefixIcon: const Icon(Icons.language_rounded),
                  ),
                ),
                const SizedBox(height: 16),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton.icon(
                    onPressed: () {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                          content: Text(
                            'Custom domain verification needs backend ownership checks.',
                          ),
                        ),
                      );
                    },
                    icon: const Icon(Icons.check_circle_rounded, size: 18),
                    label: const Text('Verify Domain'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.primary,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),

          // DNS instructions
          _buildSection(
            title: 'DNS Configuration',
            description:
                'Records appear after backend domain verification is available',
            child: Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.grey[50],
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.grey[200]!),
              ),
              child: _store?.dnsConfig.isEmpty ?? true
                  ? _buildDnsPlaceholder()
                  : Column(
                      children: _store!.dnsConfig.entries
                          .map(
                            (entry) =>
                                _buildDnsRow(entry.key, '${entry.value}'),
                          )
                          .toList(),
                    ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSection({
    required String title,
    required String description,
    required Widget child,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 16),
        ),
        const SizedBox(height: 4),
        Text(
          description,
          style: TextStyle(color: Colors.grey[600], fontSize: 13),
        ),
        const SizedBox(height: 12),
        child,
      ],
    );
  }

  Widget _buildDnsRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        children: [
          SizedBox(
            width: 60,
            child: Text(
              label,
              style: TextStyle(color: Colors.grey[600], fontSize: 13),
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: const TextStyle(
                fontWeight: FontWeight.w500,
                fontFamily: 'monospace',
              ),
            ),
          ),
          IconButton(
            icon: const Icon(Icons.copy_rounded, size: 16),
            onPressed: () {
              Clipboard.setData(ClipboardData(text: value));
              ScaffoldMessenger.of(
                context,
              ).showSnackBar(SnackBar(content: Text('$label copied!')));
            },
            constraints: const BoxConstraints(),
            padding: EdgeInsets.zero,
            color: Colors.grey[600],
          ),
        ],
      ),
    );
  }

  Widget _buildDnsPlaceholder() {
    return Column(
      children: [
        Icon(Icons.dns_outlined, color: Colors.grey[500], size: 32),
        const SizedBox(height: 8),
        Text(
          'No DNS records available',
          style: TextStyle(
            color: Colors.grey[700],
            fontWeight: FontWeight.w600,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          'Domain ownership, TXT/CNAME records, and SSL activation require a gateway domain-verification endpoint.',
          textAlign: TextAlign.center,
          style: TextStyle(color: Colors.grey[600], fontSize: 12),
        ),
      ],
    );
  }
}
