import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

/// Store header card with store info, domain status, and URLs
class StoreHeaderCard extends StatelessWidget {
  final String storeName;
  final String subdomain;
  final String? logoUrl;
  final bool isPublished;
  final String domainStatus; // "pending" | "active" | "rejected"
  final String previewUrl;
  final VoidCallback? onVisitStore;
  final VoidCallback? onCopyUrl;
  final VoidCallback? onTogglePublish;
  final bool isLoading;
  final DateTime? publishedAt;

  const StoreHeaderCard({
    super.key,
    required this.storeName,
    required this.subdomain,
    this.logoUrl,
    this.isPublished = false,
    this.domainStatus = 'pending',
    required this.previewUrl,
    this.onVisitStore,
    this.onCopyUrl,
    this.onTogglePublish,
    this.isLoading = false,
    this.publishedAt,
  });

  String get subdomainUrl => 'https://$subdomain.letbuyy.store';
  bool get isSubdomainActive => domainStatus == 'active';

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.05), // Glass effect
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.2),
            blurRadius: 30,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: Stack(
        children: [
          // Background Pattern (subtle circles)
          Positioned(
            top: -50,
            right: -50,
            child: Container(
              width: 200,
              height: 200,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: Colors.white.withValues(alpha: 0.03),
              ),
            ),
          ),
          
          Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Top Row: Logo + Status
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      width: 64,
                      height: 64,
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: Colors.white.withValues(alpha: 0.2)),
                        image: logoUrl != null
                            ? DecorationImage(
                                image: NetworkImage(logoUrl!),
                                fit: BoxFit.cover,
                              )
                            : null,
                      ),
                      child: logoUrl == null
                          ? const Icon(Icons.store_rounded, color: Colors.white, size: 32)
                          : null,
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            storeName,
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 24,
                              fontWeight: FontWeight.bold,
                              letterSpacing: -0.5,
                            ),
                          ),
                          const SizedBox(height: 8),
                          // Smart Status Badge
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                            decoration: BoxDecoration(
                              color: isPublished && !isSubdomainActive
                                  ? Colors.amber.withValues(alpha: 0.2)
                                  : isPublished
                                      ? Colors.green.withValues(alpha: 0.2)
                                      : Colors.grey.withValues(alpha: 0.2),
                              borderRadius: BorderRadius.circular(20),
                              border: Border.all(
                                color: isPublished && !isSubdomainActive
                                    ? Colors.amber
                                    : isPublished
                                        ? Colors.greenAccent
                                        : Colors.grey,
                                width: 1,
                              ),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                // Status Indicator
                                if (isPublished) ...[
                                  const Icon(Icons.check_circle_rounded, color: Colors.greenAccent, size: 14),
                                  const SizedBox(width: 6),
                                  const Text(
                                    'Live',
                                    style: TextStyle(
                                      color: Colors.greenAccent,
                                      fontSize: 12,
                                      fontWeight: FontWeight.bold,
                                    ),
                                  ),
                                ] else ...[
                                  const Icon(Icons.pause_circle_rounded, color: Colors.grey, size: 14),
                                  const SizedBox(width: 6),
                                  const Text(
                                    'Draft',
                                    style: TextStyle(
                                      color: Colors.grey,
                                      fontSize: 12,
                                      fontWeight: FontWeight.bold,
                                    ),
                                  ),
                                ],

                                // Padding & Divider
                                Padding(
                                  padding: const EdgeInsets.symmetric(horizontal: 8),
                                  child: Container(
                                    width: 1,
                                    height: 12,
                                    color: isPublished ? Colors.green.withValues(alpha: 0.3) : Colors.grey.withValues(alpha: 0.3),
                                  ),
                                ),

                                // Compact Toggle
                                SizedBox(
                                  height: 20,
                                  child: isLoading
                                      ? const SizedBox(
                                          width: 20,
                                          height: 20,
                                          child: CircularProgressIndicator(
                                            strokeWidth: 2,
                                            valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                                          ),
                                        )
                                      : Transform.scale(
                                          scale: 0.7,
                                          child: Switch.adaptive(
                                            value: isPublished,
                                            onChanged: (val) => onTogglePublish?.call(),
                                            activeColor: Colors.greenAccent,
                                            activeTrackColor: Colors.green.withValues(alpha: 0.2),
                                            inactiveThumbColor: Colors.grey[300],
                                            inactiveTrackColor: Colors.grey.withValues(alpha: 0.1),
                                            materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                                          ),
                                        ),
                                ),
                              ],
                            ),
                          ),
                          if (isPublished && publishedAt != null)
                            Padding(
                              padding: const EdgeInsets.only(top: 4, left: 4),
                              child: Text(
                                'Last published: ${_formatDate(publishedAt!)}',
                                style: TextStyle(
                                  color: Colors.white.withValues(alpha: 0.4),
                                  fontSize: 10,
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                            ),
                        ],
                      ),
                    ),
                  ],
                ),
                
                const SizedBox(height: 24),
                
                // URL & actions
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (isPublished && !isSubdomainActive)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 8),
                        child: Text(
                          '• Configuring *.letbuyy.store DNS...',
                          style: TextStyle(
                            color: Colors.amber.withValues(alpha: 0.8),
                            fontSize: 12,
                            fontStyle: FontStyle.italic,
                          ),
                        ),
                      ),
                    
                    // Domain Row
                    Row(
                      children: [
                        Expanded(
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                            decoration: BoxDecoration(
                              color: Colors.black.withValues(alpha: 0.3),
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(color: Colors.white.withValues(alpha: 0.05)),
                            ),
                            child: Row(
                              children: [
                                Icon(
                                  Icons.dns_rounded, 
                                  color: Colors.white60, 
                                  size: 18
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                       Text(
                                        'Wildcard DNS Config',
                                        style: TextStyle(
                                          color: Colors.white.withValues(alpha: 0.5),
                                          fontSize: 10,
                                          fontWeight: FontWeight.w600,
                                          letterSpacing: 0.5,
                                        ),
                                      ),
                                      const SizedBox(height: 2),
                                      RichText(
                                        text: TextSpan(
                                          style: const TextStyle(
                                            color: Colors.white, 
                                            fontSize: 14,
                                            fontFamily: 'monospace'
                                          ),
                                          children: [
                                            TextSpan(
                                              text: isSubdomainActive ? subdomain : '...',
                                              style: TextStyle(
                                                color: isSubdomainActive ? Colors.greenAccent : Colors.amber,
                                                fontWeight: FontWeight.bold
                                              ),
                                            ),
                                            const TextSpan(text: '.letbuyy.store'),
                                          ],
                                        ),
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                         const SizedBox(width: 8),
                         // Config/DNS Button
                         Material(
                          color: Colors.white.withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(12),
                          child: InkWell(
                            onTap: () {
                              // Show DNS config dialog or info
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(content: Text('Wildcard DNS is managed automatically.')),
                              );
                            },
                             borderRadius: BorderRadius.circular(12),
                            child: Container(
                              padding: const EdgeInsets.all(12),
                              decoration: BoxDecoration(
                                borderRadius: BorderRadius.circular(12),
                                border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
                              ),
                              child: const Icon(Icons.settings_ethernet_rounded, color: Colors.white, size: 20),
                            ),
                          ),
                        ),
                      ],
                    ),
                    
                     const SizedBox(height: 8),
                     
                     // Public URL Copy Row
                     if (isPublished)
                       GestureDetector(
                         onTap: () {
                           final url = isSubdomainActive ? subdomainUrl : previewUrl;
                            Clipboard.setData(ClipboardData(text: url));
                            HapticFeedback.lightImpact();
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(content: Text('Store URL copied!')),
                            );
                         },
                         child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                          decoration: BoxDecoration(
                            color: Colors.transparent, // blended
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Row(
                            children: [
                               Icon(Icons.link_rounded, color: Colors.white.withValues(alpha: 0.5), size: 16),
                               const SizedBox(width: 12),
                               Expanded(
                                 child: Text(
                                   isSubdomainActive ? subdomainUrl : previewUrl,
                                   style: TextStyle(
                                     color: Colors.white.withValues(alpha: 0.6),
                                     fontSize: 13,
                                   ),
                                   maxLines: 1,
                                   overflow: TextOverflow.ellipsis,
                                 ),
                               ),
                               Icon(Icons.copy_rounded, color: Colors.white.withValues(alpha: 0.4), size: 14),
                            ],
                          ),
                         ),
                       ),
                  ],
                ),
                
                const SizedBox(height: 20),
                
                // Main CTA
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: onVisitStore,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.white,
                      foregroundColor: const Color(0xFF0F172A),
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      elevation: 0,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                    child: Text(
                      isPublished && !isSubdomainActive ? 'Visit Preview' : 'Visit Storefront',
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  String _formatDate(DateTime date) {
    final now = DateTime.now();
    final diff = now.difference(date);
    if (diff.inMinutes < 1) return 'Just now';
    if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
    if (diff.inHours < 24) return '${diff.inHours}h ago';
    return '${date.day}/${date.month}/${date.year}';
  }
}
