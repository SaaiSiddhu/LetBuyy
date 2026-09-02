// lib/screens/user/profile/settings_screen.dart

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:letbuyy_marketplace_ui_kit/letbuyy_marketplace_ui_kit.dart';
import 'package:letbuyy_marketplace_services/letbuyy_marketplace_services.dart';
import '../../widgets/premium_scaffold.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen>
    with SingleTickerProviderStateMixin {
  bool _pushNotifications = true;
  bool _emailNotifications = false;
  bool _orderUpdates = true;
  bool _promotions = false;
  // bool _showPrices = true; // REMOVED as requested

  late AnimationController _fadeController;
  late Animation<double> _fadeAnimation;

  @override
  void initState() {
    super.initState();
    _fadeController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 400),
    );
    _fadeAnimation = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _fadeController, curve: Curves.easeOut),
    );
    _fadeController.forward();
  }

  @override
  void dispose() {
    _fadeController.dispose();
    super.dispose();
  }

  void _showSnackBar(String message, {required bool isDark}) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Row(
          children: [
            const Icon(Icons.check_circle, color: Colors.white, size: 20), // ✅ FIXED
            const SizedBox(width: 12),
            Text(
              message,
              style: const TextStyle(fontWeight: FontWeight.w600),
            ),
          ],
        ),
        backgroundColor: isDark ? AppColors.primaryLight : AppColors.primary,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        duration: const Duration(seconds: 2),
      ),
    );
  }

  Future<bool> _showConfirmDialog({
    required String title,
    required String message,
    required bool isDark,
  }) async {
    return await showDialog<bool>(
          context: context,
          builder: (context) => AlertDialog(
            backgroundColor: isDark ? AppColors.surfaceDark : AppColors.surface, // ✅ Fixed
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            title: Text(
              title,
              style: TextStyle(color: isDark ? AppColors.textLight : AppColors.textPrimary), // ✅ Fixed
            ),
            content: Text(
              message,
              style: TextStyle(color: isDark ? AppColors.textLightSecondary : AppColors.textSecondary), // ✅ Fixed
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(context, false),
                child: Text(
                  'Cancel',
                   style: TextStyle(color: isDark ? AppColors.textLightSecondary : AppColors.textSecondary), // ✅ Fixed
                ),
              ),
              ElevatedButton(
                onPressed: () => Navigator.pop(context, true),
                style: ElevatedButton.styleFrom(
                  backgroundColor: isDark ? AppColors.primaryLight : AppColors.primary,
                  foregroundColor: isDark ? AppColors.textPrimary : AppColors.white, // ✅ Fixed
                ),
                child: const Text('Confirm'),
              ),
            ],
          ),
        ) ??
        false;
  }

  @override
  Widget build(BuildContext context) {
    final themeProvider = Provider.of<ThemeProvider>(context);
    final isDark = themeProvider.isDarkMode;

    return PremiumScaffold(
      // resizeToAvoidBottomInset handled internally
      // backgroundColor handled internally
      appBar: AppBar(
        title: Text(
          'Settings',
          style: TextStyle(
            color: isDark ? AppColors.textLight : AppColors.white, // ✅ Fixed
            fontWeight: FontWeight.w700,
          ),
        ),
        backgroundColor: isDark ? AppColors.surfaceDark : AppColors.primary, // ✅ Fixed
        elevation: 0,
        iconTheme: IconThemeData(color: isDark ? AppColors.textLight : AppColors.white), // ✅ Fixed
      ),
      body: ListView(
          padding: const EdgeInsets.all(16),
          physics: const BouncingScrollPhysics(),
          children: [
            // Appearance Section
            _buildSectionTitle('Appearance', isDark),
            _buildSettingCard(
              isDark: isDark,
              children: [
                _buildSwitchTile(
                  title: 'Dark Mode',
                  subtitle: isDark ? 'Dark theme enabled' : 'Light theme enabled',
                  icon: isDark ? Icons.dark_mode : Icons.light_mode,
                  iconColor: isDark ? AppColors.processing : AppColors.processing, // ✅ Fixed
                  value: isDark,
                  isDark: isDark,
                  onChanged: (value) async {
                    HapticFeedback.mediumImpact();
                    await themeProvider.toggleTheme();
                    if (mounted) {
                      _showSnackBar(
                        value ? '🌙 Dark mode enabled' : '☀️ Light mode enabled',
                        isDark: value,
                      );
                    }
                  },
                ),
              ],
            ),

            const SizedBox(height: 20),

            // Notifications Section
            _buildSectionTitle('Notifications', isDark),
            _buildSettingCard(
              isDark: isDark,
              children: [
                _buildSwitchTile(
                  title: 'Push Notifications',
                  subtitle: 'Receive notifications on your device',
                  icon: Icons.notifications_active,
                  iconColor: isDark ? AppColors.warning : AppColors.warningDark, // ✅ Fixed
                  value: _pushNotifications,
                  isDark: isDark,
                  onChanged: (value) {
                    setState(() => _pushNotifications = value);
                    HapticFeedback.selectionClick();
                    _showSnackBar(
                      value
                          ? 'Push notifications enabled'
                          : 'Push notifications disabled',
                      isDark: isDark,
                    );
                  },
                ),
                Divider(
                  height: 1,
                  color: isDark ? AppColors.borderDark : AppColors.border, // ✅ Fixed
                ),
                _buildSwitchTile(
                  title: 'Order Updates',
                  subtitle: 'Get notified about your order status',
                  icon: Icons.shopping_bag,
                  iconColor: isDark ? AppColors.success : AppColors.successDark, // ✅ Fixed
                  value: _orderUpdates,
                  isDark: isDark,
                  onChanged: (value) {
                    setState(() => _orderUpdates = value);
                    HapticFeedback.selectionClick();
                  },
                ),
                Divider(
                  height: 1,
                  color: isDark ? AppColors.borderDark : AppColors.border, // ✅ Fixed
                ),
                _buildSwitchTile(
                  title: 'Email Notifications',
                  subtitle: 'Receive updates via email',
                  icon: Icons.email,
                  iconColor: isDark ? AppColors.info : AppColors.infoDark, // ✅ Fixed
                  value: _emailNotifications,
                  isDark: isDark,
                  onChanged: (value) {
                    setState(() => _emailNotifications = value);
                    HapticFeedback.selectionClick();
                  },
                ),
                Divider(
                  height: 1,
                  color: isDark ? AppColors.borderDark : AppColors.border, // ✅ Fixed
                ),
                _buildSwitchTile(
                  title: 'Promotions & Offers',
                  subtitle: 'Get exclusive deals and discounts',
                  icon: Icons.local_offer,
                  iconColor: isDark ? AppColors.error : AppColors.errorDark, // ✅ Fixed
                  value: _promotions,
                  isDark: isDark,
                  onChanged: (value) {
                    setState(() => _promotions = value);
                    HapticFeedback.selectionClick();
                  },
                ),
              ],
            ),

            const SizedBox(height: 20),

            // App Preferences Section
            _buildSectionTitle('App Preferences', isDark),
            _buildSettingCard(
              isDark: isDark,
              children: [
                // REMOVED 'Show Product Prices' switch tile
                // REMOVED Divider
                _buildActionTile(
                  title: 'Language',
                  subtitle: 'English (US)',
                  icon: Icons.language,
                  iconColor: isDark ? AppColors.info : AppColors.infoDark, // ✅ Fixed
                  isDark: isDark,
                  onTap: () {
                    HapticFeedback.lightImpact();
                    _showSnackBar('Language selection coming soon!',
                        isDark: isDark);
                  },
                ),
              ],
            ),

            const SizedBox(height: 20),

            // REMOVED 'Data & Storage' Section

            // About Section
            _buildSectionTitle('About', isDark),
            _buildSettingCard(
              isDark: isDark,
              children: [
                ListTile(
                  contentPadding:
                      const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  leading: Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: AppColors.primary.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Icon(
                      Icons.info_outline,
                      color: AppColors.primary,
                      size: 24,
                    ),
                  ),
                  title: Text(
                    'App Version',
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                      color: isDark ? AppColors.textLight : AppColors.textPrimary, // ✅ Fixed
                    ),
                  ),
                  subtitle: Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: Text(
                      'Version 1.0.0',
                      style: TextStyle(
                        fontSize: 12,
                        color: isDark ? AppColors.textLightSecondary : AppColors.textSecondary, // ✅ Fixed
                      ),
                    ),
                  ),
                  trailing: Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        colors: [
                          AppColors.success,
                          AppColors.success.withValues(alpha: 0.8)
                        ],
                      ),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Text(
                      'Latest',
                      style: TextStyle(
                        color: AppColors.white, // ✅ Fixed
                        fontSize: 11,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                ),
                Divider(
                  height: 1,
                  color: isDark ? AppColors.borderDark : AppColors.border, // ✅ Fixed
                ),
                _buildActionTile(
                  title: 'Report a Bug',
                  subtitle: 'Help us improve',
                  icon: Icons.bug_report_outlined,
                  iconColor: isDark ? AppColors.warning : AppColors.warningDark, // ✅ Fixed
                  isDark: isDark,
                  onTap: () {
                    HapticFeedback.lightImpact();
                    _showSnackBar('Bug report coming soon!', isDark: isDark);
                  },
                ),
                Divider(
                  height: 1,
                  color: isDark ? AppColors.borderDark : AppColors.border, // ✅ Fixed
                ),
                _buildActionTile(
                  title: 'Terms & Conditions',
                  subtitle: 'Read our terms',
                  icon: Icons.description_outlined,
                  iconColor: isDark ? AppColors.textSecondary : AppColors.textSecondary,
                  isDark: isDark,
                  onTap: () {
                    HapticFeedback.lightImpact();
                    _showSnackBar('Terms & Conditions coming soon!',
                        isDark: isDark);
                  },
                ),
              ],
            ),

            const SizedBox(height: 30),

            // Save Button
            SizedBox(
              width: double.infinity,
              height: 54,
              child: ElevatedButton.icon(
                onPressed: () {
                  HapticFeedback.mediumImpact();
                  _showSnackBar('Settings saved successfully', isDark: isDark);
                },
                icon: const Icon(Icons.check_circle, size: 20),
                label: const Text(
                  'Save Settings',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                style: ElevatedButton.styleFrom(
                  backgroundColor: isDark ? AppColors.primaryLight : AppColors.primary,
                  foregroundColor: isDark ? AppColors.textPrimary : AppColors.white, // ✅ Fixed
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14),
                  ),
                  elevation: 2,
                ),
              ),
            ),

            const SizedBox(height: 20),
          ],
        ),
    );
  }

  Widget _buildSectionTitle(String title, bool isDark) {
    return Padding(
      padding: const EdgeInsets.only(left: 4, bottom: 10),
      child: Text(
        title,
        style: TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w800,
          color: isDark ? AppColors.textLightSecondary : AppColors.textSecondary, // ✅ Fixed
          letterSpacing: 0.5,
        ),
      ),
    );
  }

  Widget _buildSettingCard({
    required bool isDark,
    required List<Widget> children,
  }) {
    return Container(
      decoration: BoxDecoration(
        color: isDark ? AppColors.surfaceDark : AppColors.surface, // ✅ Fixed
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: isDark ? AppColors.borderDark : AppColors.border, // ✅ Fixed
        ),
        boxShadow: [
          BoxShadow(
            color: isDark ? AppColors.shadowDark : AppColors.shadowLight, // ✅ Fixed
            blurRadius: 10,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(children: children),
    );
  }

  Widget _buildSwitchTile({
    required String title,
    required String subtitle,
    required IconData icon,
    required Color iconColor,
    required bool value,
    required bool isDark,
    required ValueChanged<bool> onChanged,
  }) {
    return ListTile(
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      leading: Container(
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          color: iconColor.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Icon(icon, color: iconColor, size: 24),
      ),
      title: Text(
        title,
        style: TextStyle(
          fontSize: 15,
          fontWeight: FontWeight.w600,
          color: isDark ? AppColors.textLight : AppColors.textPrimary, // ✅ Fixed
        ),
      ),
      subtitle: Padding(
        padding: const EdgeInsets.only(top: 4),
        child: Text(
          subtitle,
          style: TextStyle(
            fontSize: 12,
            color: isDark ? AppColors.textLightSecondary : AppColors.textSecondary, // ✅ Fixed
          ),
        ),
      ),
      trailing: Transform.scale(
        scale: 0.8,
        child: Switch(
          value: value,
          onChanged: onChanged,
          activeThumbColor: isDark ? AppColors.primaryLight : AppColors.primary,
        ),
      ),
    );
  }

  Widget _buildActionTile({
    required String title,
    required String subtitle,
    required IconData icon,
    required Color iconColor,
    required bool isDark,
    required VoidCallback onTap,
  }) {
    return ListTile(
      onTap: onTap,
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      leading: Container(
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          color: iconColor.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Icon(icon, color: iconColor, size: 24),
      ),
      title: Text(
        title,
        style: TextStyle(
          fontSize: 15,
          fontWeight: FontWeight.w600,
          color: isDark ? AppColors.textLight : AppColors.textPrimary, // ✅ Fixed
        ),
      ),
      subtitle: Padding(
        padding: const EdgeInsets.only(top: 4),
        child: Text(
          subtitle,
          style: TextStyle(
            fontSize: 12,
            color: isDark ? AppColors.textLightSecondary : AppColors.textSecondary, // ✅ Fixed
          ),
        ),
      ),
      trailing: Icon(
        Icons.arrow_forward_ios_rounded,
        size: 16,
        color: isDark ? AppColors.textLightHint : AppColors.textHint, // ✅ Fixed
      ),
    );
  }
}