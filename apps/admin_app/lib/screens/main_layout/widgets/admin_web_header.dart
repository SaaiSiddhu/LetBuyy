import 'package:flutter/material.dart';
import 'package:letbuyy_marketplace_ui_kit/letbuyy_marketplace_ui_kit.dart'; // ✅ Using shared Cyan theme
import 'package:letbuyy_marketplace_services/letbuyy_marketplace_services.dart';
import 'package:provider/provider.dart';
import 'package:letbuyy_admin/providers/auth_provider.dart';

class UnifiedAdminHeader extends StatelessWidget {
  final String title;
  final VoidCallback onAddProduct;
  final Function(String) onSearch;
  final VoidCallback? onMenuPressed; // For mobile drawer
  final bool isMobile;

  const UnifiedAdminHeader({
    super.key,
    required this.title,
    required this.onAddProduct,
    required this.onSearch,
    this.onMenuPressed,
    this.isMobile = false,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final authProvider = Provider.of<AuthProvider>(context);
    final user = authProvider.currentUser;
    final width = MediaQuery.of(context).size.width;
    
    // Hide non-essential elements on narrow desktop screens
    final showSearch = !isMobile && width > 800;
    final showAddButton = !isMobile && width > 700;
    final showProfileName = !isMobile && width > 900;
    
    // Mobile-specific heights for a compact, premium feel
    // Add top padding calculation
    final double topPadding = isMobile ? MediaQuery.of(context).viewPadding.top : 0.0;
    final double headerContentHeight = isMobile ? 64.0 : 80.0;
    final double totalHeight = headerContentHeight + topPadding;

    return SizedBox(
      height: totalHeight,
      width: double.infinity,
      child: GlassContainer(
        blur: 20,
        opacity: isDark ? 0.85 : 0.92,
        color: isDark ? AppColors.surfaceDark : AppColors.surface,
        border: Border(
           bottom: BorderSide(
             color: isDark ? AppColors.borderDark : AppColors.borderLight,
             width: 1,
           ),
        ),
        borderRadius: BorderRadius.zero,
        child: Padding(
          padding: EdgeInsets.fromLTRB(
            isMobile ? 16 : 24,
            topPadding, // 🎯 Add top padding for status bar
            isMobile ? 16 : 24,
            0,
          ),
          child: Row(
            children: [
              // Mobile Menu Button - Enhanced
              if (isMobile) ...[
                Container(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: [
                        AppColors.primary.withValues(alpha: 0.1),
                        AppColors.primary.withValues(alpha: 0.05),
                      ],
                    ),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: AppColors.primary.withValues(alpha: 0.2)),
                  ),
                  child: IconButton(
                    onPressed: onMenuPressed,
                    icon: Icon(Icons.menu_rounded, color: AppColors.primary, size: 22),
                    style: IconButton.styleFrom(
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                  ),
                ),
                const SizedBox(width: 12),
              ],

              // Page Title / Breadcrumb
              Expanded(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                     // Only show breadcrumb on wide screens (> 1000px)
                     if (!isMobile && width > 1000)
                       Row(
                         children: [
                           Text(
                             "Admin Panel",
                             style: TextStyle(
                               color: isDark ? AppColors.textLightSecondary : AppColors.textSecondary,
                               fontSize: 11,
                             ),
                           ),
                           Icon(Icons.chevron_right_rounded, size: 12, color: isDark ? AppColors.textLightHint : AppColors.textHint),
                           Flexible(
                             child: Text(
                               title,
                               style: TextStyle(
                                 color: AppColors.primary,
                                 fontSize: 11,
                                 fontWeight: FontWeight.w600,
                               ),
                               overflow: TextOverflow.ellipsis,
                             ),
                           ),
                         ],
                       ),
                     if (!isMobile && width > 1000) const SizedBox(height: 2),
                     Text(
                       title,
                       style: TextStyle(
                         fontSize: isMobile ? 18 : (width > 800 ? 20 : 16),
                         fontWeight: FontWeight.w800,
                         color: isDark ? AppColors.textLight : AppColors.textPrimary,
                         letterSpacing: -0.5,
                       ),
                       overflow: TextOverflow.ellipsis,
                     ),
                  ],
                ),
              ),
              
              // Desktop Search Bar - only show if enough space
              if (showSearch) ...[
                Flexible(
                  flex: 2,
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 300, minWidth: 100),
                    child: SizedBox(
                      height: 40,
                      child: TextField(
                        onSubmitted: onSearch,
                        style: TextStyle(fontSize: 13, color: isDark ? AppColors.textLight : AppColors.textPrimary),
                        decoration: InputDecoration(
                          hintText: "Search...",
                          hintStyle: TextStyle(color: isDark ? AppColors.textLightHint : AppColors.textHint),
                          prefixIcon: Icon(Icons.search_rounded, size: 18, color: isDark ? AppColors.textLightHint : AppColors.textHint),
                          filled: true,
                          fillColor: isDark ? AppColors.surfaceDarkVariant.withValues(alpha: 0.3) : AppColors.surfaceVariant.withValues(alpha: 0.5),
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(12),
                            borderSide: BorderSide.none,
                          ),
                          contentPadding: const EdgeInsets.symmetric(horizontal: 16),
                        ),
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 16),
              ],
              
              // Actions (Desktop only - compact on small screens)
              if (showAddButton) ...[
                _buildActionButton(
                  icon: Icons.add_rounded,
                  label: "Add",
                  onTap: onAddProduct,
                  isPrimary: true,
                ),
                const SizedBox(width: 12),
              ],

              // ═══════════════════════════════════════════════════════════════
              // 📱 MOBILE ICONS: Search → Theme → Notifications (rightmost)
              // ═══════════════════════════════════════════════════════════════
              if (isMobile) ...[
                // Search Icon
                IconButton(
                  onPressed: () {}, // TODO: Expand search
                  icon: Icon(Icons.search_rounded, size: 22),
                  color: isDark ? AppColors.textLight : AppColors.textSecondary,
                  style: IconButton.styleFrom(
                    backgroundColor: isDark ? AppColors.surfaceDarkVariant.withValues(alpha: 0.3) : AppColors.surfaceVariant.withValues(alpha: 0.5),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                ),
                const SizedBox(width: 8),
                
                // Theme Toggle
                IconButton(
                  onPressed: () {
                    Provider.of<ThemeProvider>(context, listen: false).toggleTheme();
                  },
                  icon: Icon(
                    isDark ? Icons.light_mode_rounded : Icons.dark_mode_rounded,
                    size: 22,
                  ),
                  color: isDark ? AppColors.warning : AppColors.primary,
                  style: IconButton.styleFrom(
                    backgroundColor: isDark ? AppColors.warning.withValues(alpha: 0.1) : AppColors.primary.withValues(alpha: 0.1),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                ),
                const SizedBox(width: 8),
                
                // Notifications (Bell - rightmost)
                Stack(
                  clipBehavior: Clip.none,
                  children: [
                    IconButton(
                      onPressed: () {},
                      icon: Icon(Icons.notifications_none_rounded, size: 22),
                      color: isDark ? AppColors.textLight : AppColors.textSecondary,
                      style: IconButton.styleFrom(
                        backgroundColor: isDark ? AppColors.surfaceDarkVariant.withValues(alpha: 0.3) : AppColors.surfaceVariant.withValues(alpha: 0.5),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                      ),
                    ),
                    Positioned(
                      top: 6,
                      right: 6,
                      child: Container(
                        height: 10,
                        width: 10,
                        decoration: BoxDecoration(
                          color: AppColors.error,
                          shape: BoxShape.circle,
                          border: Border.all(color: isDark ? AppColors.surfaceDark : AppColors.surface, width: 1.5),
                        ),
                      ),
                    ),
                  ],
                ),
              ],

              // ═══════════════════════════════════════════════════════════════
              // 🖥️ DESKTOP ICONS: Notifications → Theme → Profile
              // ═══════════════════════════════════════════════════════════════
              if (!isMobile) ...[
                // Notifications
                Stack(
                  clipBehavior: Clip.none,
                  children: [
                    IconButton(
                      onPressed: () {}, 
                      icon: Icon(Icons.notifications_none_rounded, color: isDark ? AppColors.textLight : AppColors.textSecondary),
                    ),
                    Positioned(
                      top: 8,
                      right: 8,
                      child: Container(
                        height: 8,
                        width: 8,
                        decoration: const BoxDecoration(
                          color: AppColors.error,
                          shape: BoxShape.circle,
                        ),
                      ),
                    ),
                  ],
                ),
                
                // Theme Toggle
                IconButton(
                  onPressed: () {
                    Provider.of<ThemeProvider>(context, listen: false).toggleTheme();
                  },
                  icon: Icon(
                    isDark ? Icons.light_mode_rounded : Icons.dark_mode_rounded,
                    color: isDark ? AppColors.warning : AppColors.primary,
                  ),
                ),

                const SizedBox(width: 8),
                
                // Profile (Desktop only)
                Container(
                  height: 40,
                  padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 4),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(30),
                    border: Border.all(color: isDark ? AppColors.borderDark : AppColors.borderLight),
                    color: isDark ? AppColors.surfaceDarkVariant.withValues(alpha: 0.3) : AppColors.surface,
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      CircleAvatar(
                        radius: 16,
                        backgroundColor: AppColors.primary,
                        backgroundImage: (user?.photoUrl?.isNotEmpty ?? false)
                             ? NetworkImage(user!.photoUrl!)
                             : null,
                        child: (user?.photoUrl?.isEmpty ?? true)
                            ? Text(
                                user?.name.isNotEmpty == true ? user!.name[0].toUpperCase() : "A",
                                style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold),
                              )
                            : null,
                      ),
                      if (showProfileName) ...[
                        const SizedBox(width: 8),
                        Text(
                          user?.name ?? "Admin",
                          style: TextStyle(
                            fontSize: 13, 
                            fontWeight: FontWeight.w600,
                            color: isDark ? AppColors.textLight : AppColors.textPrimary,
                          ),
                        ),
                        const SizedBox(width: 4),
                        Icon(Icons.keyboard_arrow_down_rounded, size: 16, color: isDark ? AppColors.textLightHint : AppColors.textHint),
                      ],
                      const SizedBox(width: 4),
                    ],
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildActionButton({
    required IconData icon,
    required String label,
    required VoidCallback onTap,
    bool isPrimary = false,
  }) {
    return ElevatedButton.icon(
      onPressed: onTap,
      style: ElevatedButton.styleFrom(
        backgroundColor: isPrimary ? AppColors.primary : Colors.transparent,
        foregroundColor: isPrimary ? Colors.white : AppColors.textPrimary,
        elevation: isPrimary ? 8 : 0,
        shadowColor: isPrimary ? AppColors.primary.withValues(alpha: 0.4) : null,
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 18),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        side: isPrimary ? null : BorderSide(color: AppColors.borderLight),
      ),
      icon: Icon(icon, size: 20),
      label: Text(label, style: const TextStyle(fontWeight: FontWeight.w600)),
    );
  }
}
