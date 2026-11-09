import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:provider/provider.dart';
import '../../services/theme_provider.dart';
import '../shared/accessible_tap_region.dart';

/// Device presentation preference only. The existing provider remains the sole
/// owner of resolution, default and persistence; a dismissed draft changes none.
class MerchantThemeSelector extends StatefulWidget {
  const MerchantThemeSelector({super.key});
  @override
  State<MerchantThemeSelector> createState() => _MerchantThemeSelectorState();
}

class _MerchantThemeSelectorState extends State<MerchantThemeSelector> {
  final _focus = FocusNode(debugLabel: 'Merchant theme selector');
  bool _opening = false;

  @override
  void dispose() {
    _focus.dispose();
    super.dispose();
  }

  Future<void> _choose() async {
    if (_opening) return;
    final provider = context.read<ThemeProvider>();
    var draft = provider.themeMode;
    setState(() => _opening = true);
    try {
      final selected = await showLetbuyyFormSheet<ThemeMode>(
        context: context,
        builder: (sheet) => StatefulBuilder(
          builder: (context, update) => LetbuyyFormSheet(
            title: 'Choose theme',
            description: 'Choose how Merchant looks on this device.',
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(sheet),
                child: const Text('Cancel'),
              ),
              FilledButton(
                onPressed: () => Navigator.pop(sheet, draft),
                child: const Text('Apply theme'),
              ),
            ],
            child: RadioGroup<ThemeMode>(
              groupValue: draft,
              onChanged: (value) {
                if (value != null) update(() => draft = value);
              },
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  for (final mode in ThemeMode.values)
                    RadioListTile<ThemeMode>(
                      value: mode,
                      title: Text(_label(mode)),
                      subtitle: Text(switch (mode) {
                        ThemeMode.system => 'Follow device appearance',
                        ThemeMode.light => 'Always use light appearance',
                        ThemeMode.dark => 'Always use dark appearance',
                      }),
                    ),
                ],
              ),
            ),
          ),
        ),
      );
      if (!mounted || selected == null) return;
      HapticFeedback.selectionClick();
      await provider.setThemeMode(selected);
    } finally {
      if (mounted) {
        setState(() => _opening = false);
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (mounted) _focus.requestFocus();
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final mode = context.watch<ThemeProvider>().themeMode;
    return AccessibleTapRegion(
      label: 'Current theme: ${_label(mode)}',
      hint: 'Choose a color theme',
      onTap: _opening ? null : _choose,
      excludeChildSemantics: true,
      child: TextButton.icon(
        focusNode: _focus,
        onPressed: _opening ? null : _choose,
        icon: const Icon(Icons.palette_outlined),
        label: Text(_label(mode)),
      ),
    );
  }
}

String _label(ThemeMode mode) => switch (mode) {
  ThemeMode.system => 'System',
  ThemeMode.light => 'Light',
  ThemeMode.dark => 'Dark',
};
