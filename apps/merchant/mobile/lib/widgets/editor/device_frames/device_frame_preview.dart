import 'package:flutter/material.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart' as mobile_tokens;
import 'package:flutter/services.dart';
import '../../../theme/app_theme_colors.dart';
import 'phone_frame.dart';
import 'samsung_frame.dart';
import 'tablet_frame.dart';
import 'laptop_frame.dart';

/// Device frame preview wrapper with device switching and zoom controls
/// Device frame is FIXED size - only internal content scrolls/zooms
class DeviceFramePreview extends StatefulWidget {
  final Widget child;
  final String deviceMode; // 'phone', 'tablet', 'laptop'
  final double zoomLevel;
  final ValueChanged<String> onDeviceChange;
  final ValueChanged<double> onZoomChange;

  const DeviceFramePreview({
    super.key,
    required this.child,
    required this.deviceMode,
    required this.zoomLevel,
    required this.onDeviceChange,
    required this.onZoomChange,
  });

  @override
  State<DeviceFramePreview> createState() => _DeviceFramePreviewState();
}

class _DeviceFramePreviewState extends State<DeviceFramePreview> {
  late AppThemeColors colors;

  // Phone model selection
  String _phoneModel = 'iphone'; // 'iphone' or 'samsung'

  @override
  Widget build(BuildContext context) {
    colors = AppThemeColors.of(context);
    return Column(
      children: [
        // Toolbar
        _buildToolbar(),

        // Device Frame (fixed size, centered)
        Expanded(
          child: Center(
            child: AnimatedSwitcher(
              duration: const Duration(milliseconds: 300),
              switchInCurve: Curves.easeOutCubic,
              switchOutCurve: Curves.easeInCubic,
              transitionBuilder: (child, animation) {
                return FadeTransition(
                  opacity: animation,
                  child: ScaleTransition(
                    scale: Tween<double>(
                      begin: 0.95,
                      end: 1.0,
                    ).animate(animation),
                    child: child,
                  ),
                );
              },
              child: _buildDeviceFrame(),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildToolbar() {
    return Container(
      margin: const EdgeInsets.fromLTRB(0, 0, 0, 8),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: colors.glassMedium,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: colors.glassMediumBorder),
      ),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            _DeviceModeButton(
              icon: Icons.phone_iphone_rounded,
              label: 'Mobile',
              isActive: widget.deviceMode == 'phone',
              onTap: () => widget.onDeviceChange('phone'),
            ),

            // Phone model dropdown (only visible when phone is selected)
            if (widget.deviceMode == 'phone') ...[
              const SizedBox(width: 4),
              _buildPhoneModelDropdown(),
            ],

            _DeviceModeButton(
              icon: Icons.tablet_mac_rounded,
              label: 'Tablet',
              isActive: widget.deviceMode == 'tablet',
              onTap: () => widget.onDeviceChange('tablet'),
            ),
            _DeviceModeButton(
              icon: Icons.laptop_mac_rounded,
              label: 'Desktop',
              isActive: widget.deviceMode == 'laptop',
              onTap: () => widget.onDeviceChange('laptop'),
            ),

            const SizedBox(width: 16),
            Container(width: 1, height: 24, color: colors.divider),
            const SizedBox(width: 16),

            // Zoom Controls
            // Internal: 0.35 = 50%, 0.7 = 100%, 1.05 = 150%
            _ZoomBtn(
              icon: Icons.remove,
              enabled: widget.zoomLevel > 0.35,
              onTap: () {
                final newZoom = ((widget.zoomLevel * 100 - 7).round() / 100)
                    .clamp(0.35, 1.05);
                widget.onZoomChange(newZoom);
              },
            ),
            const SizedBox(width: 8),
            GestureDetector(
              onTap: () => widget.onZoomChange(0.7), // Reset to 100%
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: colors.surfaceVariant,
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  // Convert internal to display: 0.7 = 100%
                  '${((widget.zoomLevel / 0.7) * 100).round()}%',
                  style: TextStyle(
                    color: colors.textSecondary,
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ),
            const SizedBox(width: 8),
            _ZoomBtn(
              icon: Icons.add,
              enabled: widget.zoomLevel < 1.05,
              onTap: () {
                final newZoom = ((widget.zoomLevel * 100 + 7).round() / 100)
                    .clamp(0.35, 1.05);
                widget.onZoomChange(newZoom);
              },
            ),

            const SizedBox(width: 16),

            // Device info
            Text(
              _getDeviceLabel(),
              style: TextStyle(color: colors.textSecondary, fontSize: 11),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPhoneModelDropdown() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: colors.surfaceVariant,
        borderRadius: BorderRadius.circular(6),
      ),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<String>(
          value: _phoneModel,
          isDense: true,
          icon: Icon(
            Icons.arrow_drop_down,
            size: 16,
            color: colors.textSecondary,
          ),
          style: TextStyle(
            color: colors.textSecondary,
            fontSize: 11,
            fontWeight: FontWeight.w500,
          ),
          dropdownColor: colors.card,
          items: const [
            DropdownMenuItem(value: 'iphone', child: Text('iPhone 15 Pro')),
            DropdownMenuItem(value: 'samsung', child: Text('Samsung S25')),
          ],
          onChanged: (value) {
            if (value != null) {
              setState(() => _phoneModel = value);
              HapticFeedback.selectionClick();
            }
          },
        ),
      ),
    );
  }

  Widget _buildDeviceFrame() {
    // Device frame stays FIXED - zoom is applied to content only (in WebsitePreview)
    Widget content = widget.child;

    switch (widget.deviceMode) {
      case 'tablet':
        return TabletFrame(key: const ValueKey('tablet'), child: content);
      case 'laptop':
        return LaptopFrame(key: const ValueKey('laptop'), child: content);
      default:
        // Phone mode - check which model
        if (_phoneModel == 'samsung') {
          return SamsungFrame(key: const ValueKey('samsung'), child: content);
        }
        return PhoneFrame(key: const ValueKey('iphone'), child: content);
    }
  }

  String _getDeviceLabel() {
    switch (widget.deviceMode) {
      case 'tablet':
        return 'iPad Pro 11"';
      case 'laptop':
        return 'MacBook Pro 14"';
      default:
        return _phoneModel == 'samsung' ? 'Samsung S25' : 'iPhone 15 Pro';
    }
  }
}

class _DeviceModeButton extends StatelessWidget {
  final IconData icon;
  final String label;
  final bool isActive;
  final VoidCallback onTap;

  const _DeviceModeButton({
    required this.icon,
    required this.label,
    required this.isActive,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    return Tooltip(
      message: '$label preview',
      child: GestureDetector(
        onTap: () {
          HapticFeedback.selectionClick();
          onTap();
        },
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 150),
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
          margin: const EdgeInsets.only(right: 4),
          decoration: BoxDecoration(
            color: isActive
                ? mobile_tokens.LetbuyyColorTokens.brandPrimary
                : Colors.transparent,
            borderRadius: BorderRadius.circular(8),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                icon,
                size: 18,
                color: isActive ? Colors.white : colors.textSecondary,
              ),
              const SizedBox(width: 6),
              Text(
                label,
                style: TextStyle(
                  color: isActive ? Colors.white : colors.textSecondary,
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Zoom button
class _ZoomBtn extends StatelessWidget {
  final IconData icon;
  final bool enabled;
  final VoidCallback onTap;

  const _ZoomBtn({
    required this.icon,
    required this.enabled,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    return GestureDetector(
      onTap: enabled
          ? () {
              HapticFeedback.lightImpact();
              onTap();
            }
          : null,
      child: Container(
        padding: const EdgeInsets.all(6),
        decoration: BoxDecoration(
          color: enabled ? colors.surfaceVariant : colors.glassMedium,
          borderRadius: BorderRadius.circular(6),
        ),
        child: Icon(
          icon,
          size: 16,
          color: enabled ? colors.textSecondary : colors.textTertiary,
        ),
      ),
    );
  }
}
