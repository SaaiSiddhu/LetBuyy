import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import '../../theme/store_admin_colors.dart';
import '../../theme/app_theme_colors.dart';
import '../../services/theme_provider.dart';
import '../../services/language_service.dart';

/// Wizard Container Widget - Theme Aware
/// Supports both dark and light themes with language selector
class WizardContainer extends StatelessWidget {
  final Widget child;
  final int currentStep;
  final int totalSteps;
  final VoidCallback? onBack;
  final VoidCallback? onSkip;
  final String? skipText;
  final bool showBack;
  final bool showProgress;
  final IconData? backIcon; // Custom back icon (e.g., logout)

  const WizardContainer({
    super.key,
    required this.child,
    this.currentStep = 1,
    this.totalSteps = 7,
    this.onBack,
    this.onSkip,
    this.skipText,
    this.showBack = true,
    this.showProgress = true,
    this.backIcon,
  });

  @override
  Widget build(BuildContext context) {
    final themeProvider = context.watch<ThemeProvider>();
    final langService = context.watch<LanguageService>();
    final isDark = themeProvider.isDarkMode(context);
    final colors = AppThemeColors.of(context);

    // Use a simple Container with gradient instead of Scaffold
    // This allows content to scroll naturally without fixed screen height
    return Container(
      decoration: colors.backgroundGradient,
      child: SafeArea(
        child: Stack(
          children: [
            // Main content - scrollable
            SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(24, 60, 24, 100),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.start,
                crossAxisAlignment: CrossAxisAlignment.center,
                mainAxisSize: MainAxisSize.min,
                children: [
                  // Progress indicator at top
                  if (showProgress)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 28),
                      child: _buildProgressIndicator(isDark),
                    ),
                  
                  // Card
                  _buildStackedCard(child, isDark),
                  
                  // Skip link
                  if (onSkip != null)
                    Padding(
                      padding: const EdgeInsets.only(top: 20),
                      child: GestureDetector(
                        onTap: onSkip,
                        child: Text(
                          skipText ?? langService.skipStep,
                          style: TextStyle(
                            color: isDark ? Colors.white.withValues(alpha: 0.5) : Colors.black54,
                            fontSize: 14,
                          ),
                        ),
                      ),
                    ),
                ],
              ),
            ),
            
            // Top bar with back button + theme/language toggles
            Positioned(
              top: 12,
              left: 12,
              right: 12,
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  // Back button
                  if (showBack && onBack != null)
                    _buildGlassButton(
                      onTap: () {
                        HapticFeedback.lightImpact();
                        onBack?.call();
                      },
                      child: Icon(
                        backIcon ?? Icons.arrow_back_ios_new_rounded,
                        size: 18,
                        color: isDark ? Colors.white70 : Colors.black87,
                      ),
                      isDark: isDark,
                    )
                  else
                    const SizedBox(width: 40),
                  
                  // Right side: Language + Theme
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      _buildLanguageSelector(langService, isDark),
                      const SizedBox(width: 8),
                      _buildThemeToggle(themeProvider, isDark),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildGlassButton({required VoidCallback onTap, required Widget child, required bool isDark}) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          color: isDark ? Colors.white.withValues(alpha: 0.08) : Colors.white.withValues(alpha: 0.7),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: isDark ? Colors.white.withValues(alpha: 0.1) : Colors.black.withValues(alpha: 0.05)),
        ),
        child: child,
      ),
    );
  }

  Widget _buildLanguageSelector(LanguageService langService, bool isDark) {
    return PopupMenuButton<AppLanguage>(
      initialValue: langService.currentLanguage,
      onSelected: (lang) => langService.setLanguage(lang),
      offset: const Offset(0, 42),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      color: isDark ? const Color(0xFF1E1E2E) : Colors.white,
      elevation: 6,
      itemBuilder: (context) => [
        _buildLanguageItem(AppLanguage.english, 'English', '🇬🇧', langService, isDark),
        _buildLanguageItem(AppLanguage.tamil, 'தமிழ்', '🇮🇳', langService, isDark),
        _buildLanguageItem(AppLanguage.hindi, 'हिंदी', '🇮🇳', langService, isDark),
      ],
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        decoration: BoxDecoration(
          color: isDark ? Colors.white.withValues(alpha: 0.08) : Colors.white.withValues(alpha: 0.7),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: isDark ? Colors.white.withValues(alpha: 0.1) : Colors.black.withValues(alpha: 0.05)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.public_rounded, size: 16, color: isDark ? Colors.white70 : Colors.black87),
            const SizedBox(width: 6),
            Text(langService.languageName, style: TextStyle(color: isDark ? Colors.white : Colors.black87, fontSize: 12, fontWeight: FontWeight.w600)),
            const SizedBox(width: 4),
            Icon(Icons.expand_more_rounded, size: 16, color: isDark ? Colors.white54 : Colors.black54),
          ],
        ),
      ),
    );
  }

  PopupMenuItem<AppLanguage> _buildLanguageItem(AppLanguage lang, String name, String flag, LanguageService langService, bool isDark) {
    final isSelected = langService.currentLanguage == lang;
    return PopupMenuItem(
      value: lang,
      height: 40,
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(flag, style: const TextStyle(fontSize: 16)),
          const SizedBox(width: 10),
          Text(name, style: TextStyle(color: isDark ? Colors.white : Colors.black87, fontWeight: isSelected ? FontWeight.w600 : FontWeight.w400, fontSize: 13)),
          if (isSelected) ...[const SizedBox(width: 12), const Icon(Icons.check_rounded, size: 16, color: Color(0xFF8B5CF6))],
        ],
      ),
    );
  }

  Widget _buildThemeToggle(ThemeProvider themeProvider, bool isDark) {
    return GestureDetector(
      onTap: () { HapticFeedback.lightImpact(); themeProvider.toggleTheme(); },
      child: Container(
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          color: isDark ? Colors.white.withValues(alpha: 0.08) : Colors.white.withValues(alpha: 0.7),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: isDark ? Colors.white.withValues(alpha: 0.1) : Colors.black.withValues(alpha: 0.05)),
        ),
        child: Icon(
          isDark ? Icons.light_mode_rounded : Icons.dark_mode_rounded,
          size: 18,
          color: isDark ? const Color(0xFFFBBF24) : const Color(0xFF8B5CF6),
        ),
      ),
    );
  }

  Widget _buildProgressIndicator(bool isDark) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: List.generate(totalSteps, (index) {
        final isActive = index < currentStep;
        final isCurrent = index == currentStep - 1;
        
        return Container(
          width: isCurrent ? 24 : 8,
          height: 8,
          margin: const EdgeInsets.symmetric(horizontal: 4),
          decoration: BoxDecoration(
            color: isActive 
                ? StoreAdminColors.primary 
                : (isDark ? StoreAdminColors.slate700 : Colors.grey.shade300),
            borderRadius: BorderRadius.circular(4),
          ),
        );
      }),
    );
  }

  Widget _buildStackedCard(Widget content, bool isDark) {
    // Dark card matching setup screen style - no stacked effect
    return Container(
      width: double.infinity,
      constraints: const BoxConstraints(maxWidth: 440),
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: isDark ? Colors.white.withValues(alpha: 0.06) : Colors.white.withValues(alpha: 0.85),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: isDark ? Colors.white.withValues(alpha: 0.08) : Colors.black.withValues(alpha: 0.06),
          width: 1,
        ),
        boxShadow: isDark ? [] : [
          BoxShadow(color: Colors.black.withValues(alpha: 0.08), blurRadius: 40, offset: const Offset(0, 20)),
        ],
      ),
      child: content,
    );
  }
}

/// Option Card for selection steps - Theme Aware Design
class WizardOptionCard extends StatelessWidget {
  final IconData? icon;
  final String? iconEmoji;
  final String title;
  final String? subtitle;
  final bool isSelected;
  final VoidCallback onTap;

  const WizardOptionCard({
    super.key,
    this.icon,
    this.iconEmoji,
    required this.title,
    this.subtitle,
    this.isSelected = false,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final themeProvider = context.watch<ThemeProvider>();
    final isDark = themeProvider.isDarkMode(context);
    
    return GestureDetector(
      onTap: () {
        HapticFeedback.lightImpact();
        onTap();
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          color: isSelected 
              ? (isDark ? Colors.white.withValues(alpha: 0.1) : const Color(0xFF8B5CF6).withValues(alpha: 0.1))
              : (isDark ? Colors.white.withValues(alpha: 0.04) : Colors.grey.withValues(alpha: 0.05)),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: isSelected
                ? StoreAdminColors.primary
                : (isDark ? Colors.white.withValues(alpha: 0.08) : Colors.grey.withValues(alpha: 0.2)),
            width: isSelected ? 1.5 : 1,
          ),
        ),
        child: Row(
          children: [
            // Icon with gradient circle
            Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: isSelected
                      ? [StoreAdminColors.primary, StoreAdminColors.accent]
                      : (isDark 
                          ? [Colors.white.withValues(alpha: 0.15), Colors.white.withValues(alpha: 0.08)]
                          : [Colors.grey.withValues(alpha: 0.15), Colors.grey.withValues(alpha: 0.08)]),
                ),
                shape: BoxShape.circle,
              ),
              child: Center(
                child: iconEmoji != null
                    ? Text(iconEmoji!, style: const TextStyle(fontSize: 18))
                    : Icon(
                        icon ?? Icons.store,
                        size: 18,
                        color: isDark ? Colors.white : (isSelected ? Colors.white : Colors.black87),
                      ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    title,
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: isDark ? Colors.white : Colors.black87,
                      letterSpacing: -0.2,
                    ),
                  ),
                  if (subtitle != null) ...[
                    const SizedBox(height: 2),
                    Text(
                      subtitle!,
                      style: TextStyle(
                        fontSize: 12,
                        color: isDark ? Colors.white.withValues(alpha: 0.6) : Colors.black54,
                      ),
                    ),
                  ],
                ],
              ),
            ),
            // Indicator
            Icon(
              Icons.chevron_right_rounded,
              size: 18,
              color: isDark ? Colors.white.withValues(alpha: 0.5) : Colors.black38,
            ),
          ],
        ),
      ),
    );
  }
}

/// Primary CTA Button for wizard - Theme Aware
class WizardPrimaryButton extends StatelessWidget {
  final String text;
  final VoidCallback? onPressed;
  final bool isLoading;

  const WizardPrimaryButton({
    super.key,
    required this.text,
    this.onPressed,
    this.isLoading = false,
  });

  @override
  Widget build(BuildContext context) {
    final themeProvider = context.watch<ThemeProvider>();
    final isDark = themeProvider.isDarkMode(context);
    
    return SizedBox(
      width: double.infinity,
      height: 52,
      child: ElevatedButton(
        onPressed: isLoading ? null : onPressed,
        style: ElevatedButton.styleFrom(
          backgroundColor: StoreAdminColors.primary,
          foregroundColor: Colors.white,
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
          disabledBackgroundColor: isDark 
              ? Colors.white.withValues(alpha: 0.1) // Dark mode: subtle dark bg
              : StoreAdminColors.slate300,           // Light mode: light grey
          disabledForegroundColor: isDark 
              ? Colors.white.withValues(alpha: 0.4)  // Dark mode: semi-transparent white
              : Colors.grey,                          // Light mode: grey text
        ),
        child: isLoading
            ? const SizedBox(
                width: 24,
                height: 24,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  valueColor: AlwaysStoppedAnimation(Colors.white),
                ),
              )
            : Text(
                text,
                style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w600,
                ),
              ),
      ),
    );
  }
}

/// Text input field for wizard - Theme Aware
class WizardTextField extends StatelessWidget {
  final TextEditingController controller;
  final String? label;
  final String? hint;
  final String? suffix;
  final String? errorText;
  final bool autofocus;
  final ValueChanged<String>? onChanged;

  const WizardTextField({
    super.key,
    required this.controller,
    this.label,
    this.hint,
    this.suffix,
    this.errorText,
    this.autofocus = false,
    this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    final themeProvider = context.watch<ThemeProvider>();
    final isDark = themeProvider.isDarkMode(context);
    
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (label != null) ...[
          Text(
            label!,
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w500,
              color: isDark ? StoreAdminColors.textSecondary : Colors.black54,
            ),
          ),
          const SizedBox(height: 8),
        ],
        TextField(
          controller: controller,
          autofocus: autofocus,
          onChanged: onChanged,
          style: TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.w500,
            color: isDark ? StoreAdminColors.textPrimary : Colors.black87,
          ),
          decoration: InputDecoration(
            hintText: hint,
            hintStyle: TextStyle(
              color: isDark ? StoreAdminColors.slate400 : Colors.black38,
              fontWeight: FontWeight.normal,
            ),
            suffixText: suffix,
            suffixStyle: TextStyle(
              color: isDark ? StoreAdminColors.slate500 : Colors.black45,
              fontSize: 16,
            ),
            errorText: errorText,
            filled: true,
            fillColor: isDark ? StoreAdminColors.slate50 : Colors.grey.shade100,
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide(color: isDark ? StoreAdminColors.slate200 : Colors.grey.shade300),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide(color: isDark ? StoreAdminColors.slate200 : Colors.grey.shade300),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(color: StoreAdminColors.primary, width: 2),
            ),
            errorBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide(color: StoreAdminColors.error),
            ),
            contentPadding: const EdgeInsets.symmetric(
              horizontal: 16,
              vertical: 16,
            ),
          ),
        ),
      ],
    );
  }
}
