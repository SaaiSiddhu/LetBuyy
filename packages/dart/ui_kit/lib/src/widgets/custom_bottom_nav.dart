import 'dart:math' as math;
import 'package:flutter/material.dart';
import '../tokens/letbuyy_tokens.dart';

/// The shared native destination row. Large text keeps every label and target;
/// narrow windows scroll horizontally instead of squeezing or hiding entries.
class CustomBottomNav extends StatefulWidget {
  const CustomBottomNav({
    super.key,
    required this.currentIndex,
    required this.onTap,
    required this.items,
    this.isGlass = true,
  });
  final int currentIndex;
  final ValueChanged<int> onTap;
  final List<CustomBottomNavItem> items;
  // Kept for existing source compatibility. Surface and motion use ThemeData.
  final bool isGlass;

  @override
  State<CustomBottomNav> createState() => _CustomBottomNavState();
}

class _CustomBottomNavState extends State<CustomBottomNav> {
  late List<GlobalKey> _keys = List.generate(
    widget.items.length,
    (_) => GlobalKey(),
  );
  bool _revealQueued = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _revealSelected();
  }

  @override
  void didUpdateWidget(CustomBottomNav oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.items.length != widget.items.length) {
      _keys = List.generate(widget.items.length, (_) => GlobalKey());
    }
    if (oldWidget.currentIndex != widget.currentIndex ||
        oldWidget.items.length != widget.items.length ||
        List.generate(
          widget.items.length,
          (i) => oldWidget.items[i].label != widget.items[i].label,
        ).any((changed) => changed)) {
      _revealSelected();
    }
  }

  void _revealSelected() {
    if (_revealQueued) return;
    _revealQueued = true;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _revealQueued = false;
      if (!mounted ||
          widget.currentIndex < 0 ||
          widget.currentIndex >= _keys.length)
        return;
      final selected = _keys[widget.currentIndex].currentContext;
      if (selected != null) {
        Scrollable.ensureVisible(selected, alignment: .5);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context), scheme = theme.colorScheme;
    final style = theme.textTheme.labelMedium!;
    final scaler = MediaQuery.textScalerOf(context);
    var itemWidth = 56.0, labelHeight = 0.0;
    for (final item in widget.items) {
      final painter = TextPainter(
        text: TextSpan(text: item.label, style: style),
        textDirection: Directionality.of(context),
        textScaler: scaler,
        maxLines: 1,
      )..layout();
      itemWidth = math.max(itemWidth, painter.width.ceilToDouble());
      labelHeight = math.max(labelHeight, painter.height);
      painter.dispose();
    }
    return Material(
      color: scheme.surface,
      child: DecoratedBox(
        decoration: BoxDecoration(
          border: Border(top: BorderSide(color: scheme.outlineVariant)),
        ),
        child: SafeArea(
          top: false,
          child: Padding(
            padding: const EdgeInsets.all(LetbuyySpacingTokens.space8),
            child: LayoutBuilder(
              builder: (context, constraints) => SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: SizedBox(
                  width: math.max(
                    constraints.maxWidth,
                    itemWidth * widget.items.length,
                  ),
                  height: math.max(
                    64,
                    24 +
                        LetbuyySpacingTokens.space4 +
                        labelHeight +
                        LetbuyySpacingTokens.space16,
                  ),
                  child: Row(
                    children: [
                      for (var i = 0; i < widget.items.length; i++)
                        Expanded(
                          child: Padding(
                            padding: EdgeInsets.zero,
                            child: Semantics(
                              key: _keys[i],
                              label: '${widget.items[i].label} tab',
                              selected: widget.currentIndex == i,
                              button: true,
                              onTap: () => widget.onTap(i),
                              excludeSemantics: true,
                              child: TextButton(
                                onPressed: () => widget.onTap(i),
                                style: TextButton.styleFrom(
                                  backgroundColor: widget.currentIndex == i
                                      ? scheme.primary
                                      : null,
                                  foregroundColor: widget.currentIndex == i
                                      ? scheme.onPrimary
                                      : scheme.onSurfaceVariant,
                                  padding: EdgeInsets.zero,
                                  minimumSize: const Size(48, 64),
                                  shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(16),
                                  ),
                                ),
                                child: Column(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    Icon(
                                      widget.currentIndex == i
                                          ? widget.items[i].activeIcon
                                          : widget.items[i].icon,
                                      size: 24,
                                    ),
                                    const SizedBox(
                                      height: LetbuyySpacingTokens.space4,
                                    ),
                                    Text(
                                      widget.items[i].label,
                                      style: style.copyWith(
                                        color: widget.currentIndex == i
                                            ? scheme.onPrimary
                                            : scheme.onSurfaceVariant,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class CustomBottomNavItem {
  const CustomBottomNavItem({
    required this.icon,
    required this.activeIcon,
    required this.label,
  });
  final IconData icon, activeIcon;
  final String label;
}
