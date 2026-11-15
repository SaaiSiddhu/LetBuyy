import 'package:flutter/material.dart';
import '../tokens/letbuyy_tokens.dart';
import 'form_sheet.dart';

/// A bounded presentation choice. Options and their meaning belong to callers;
/// selecting a radio changes only the sheet draft until Apply is pressed.
class LetbuyyChoice<T extends Object> {
  const LetbuyyChoice({required this.value, required this.label});
  final T value;
  final String label;
}

class LetbuyyChoiceField<T extends Object> extends FormField<T> {
  LetbuyyChoiceField({
    super.key,
    required this.label,
    required this.value,
    required this.choices,
    required this.onChanged,
    this.compact = false,
    super.validator,
    super.autovalidateMode = AutovalidateMode.onUserInteraction,
  }) : super(
         initialValue: value,
         enabled: onChanged != null,
         builder: (field) => (field as _LetbuyyChoiceFieldState<T>)._build(),
       );
  final String label;
  final T? value;
  final List<LetbuyyChoice<T>> choices;
  final ValueChanged<T>? onChanged;

  /// Toolbar choices retain their visible label and explicit Apply behavior.
  final bool compact;

  @override
  FormFieldState<T> createState() => _LetbuyyChoiceFieldState<T>();
}

class _LetbuyyChoiceFieldState<T extends Object> extends FormFieldState<T> {
  LetbuyyChoiceField<T> get _field => widget as LetbuyyChoiceField<T>;
  final _focus = FocusNode();
  bool _opening = false;
  final _sheets = <_ChoiceAvailability>{};

  void _retireSheet() {
    // Disposal/value updates can happen while another route is building. The
    // sheet owns its signal until actual route disposal, including exit motion.
    for (final sheet in _sheets.toList(growable: false)) {
      WidgetsBinding.instance.addPostFrameCallback((_) => sheet.retire());
    }
  }

  @override
  void didUpdateWidget(covariant LetbuyyChoiceField<T> oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.value != _field.value) {
      _retireSheet();
      setValue(_field.value);
    }
    if (_field.onChanged == null) _retireSheet();
    final oldChoices = oldWidget.choices, choices = _field.choices;
    if (oldWidget.label != _field.label ||
        oldChoices.length != choices.length ||
        List.generate(choices.length, (index) => index).any(
          (index) =>
              oldChoices[index].value != choices[index].value ||
              oldChoices[index].label != choices[index].label,
        )) {
      _retireSheet();
    }
  }

  @override
  void dispose() {
    _retireSheet();
    _focus.dispose();
    super.dispose();
  }

  Future<void> _choose() async {
    if (_opening || _field.onChanged == null) return;
    final originalValue = _field.value;
    final choices = _field.choices;
    late final _ChoiceAvailability sheet;
    sheet = _ChoiceAvailability(() => _sheets.remove(sheet));
    _sheets.add(sheet);
    setState(() => _opening = true);
    try {
      final selected = await showLetbuyyFormSheet<T>(
        context: context,
        builder: (_) => sheet.disposed
            ? const SizedBox.shrink()
            : _ChoiceSheet<T>(
                availability: sheet,
                title: _field.label,
                choices: choices,
                initial: value,
              ),
      );
      if (mounted &&
          selected != null &&
          _field.onChanged != null &&
          _field.value == originalValue &&
          selected != value &&
          _field.choices.any((choice) => choice.value == selected)) {
        didChange(selected);
        _field.onChanged!(selected);
      }
    } finally {
      if (!sheet.claimed && !sheet.disposed) sheet.dispose();
      if (mounted) {
        setState(() => _opening = false);
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (mounted && ModalRoute.of(context)?.isCurrent == true)
            _focus.requestFocus();
        });
      }
    }
  }

  Widget _build() {
    final theme = Theme.of(context);
    final selected = _field.choices
        .where((choice) => choice.value == value)
        .firstOrNull;
    return Padding(
      padding: const EdgeInsets.symmetric(
        vertical: LetbuyySpacingTokens.space8,
      ),
      child: Column(
        crossAxisAlignment: _field.compact
            ? CrossAxisAlignment.start
            : CrossAxisAlignment.stretch,
        children: [
          if (_field.compact)
            OutlinedButton.icon(
              focusNode: _focus,
              onPressed: _opening || _field.onChanged == null ? null : _choose,
              style: OutlinedButton.styleFrom(minimumSize: const Size(48, 48)),
              icon: const Icon(Icons.expand_more),
              label: Text(
                '${_field.label}: ${selected?.label ?? 'Choose an option'}',
              ),
            )
          else
            OutlinedButton(
              focusNode: _focus,
              onPressed: _opening || _field.onChanged == null ? null : _choose,
              child: Padding(
                padding: const EdgeInsets.symmetric(
                  vertical: LetbuyySpacingTokens.space12,
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(_field.label, style: theme.textTheme.labelMedium),
                    const SizedBox(height: LetbuyySpacingTokens.space4),
                    Row(
                      children: [
                        Expanded(
                          child: Text(selected?.label ?? 'Choose an option'),
                        ),
                        const Icon(Icons.expand_more),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          if (errorText != null)
            Semantics(
              liveRegion: true,
              child: Padding(
                padding: const EdgeInsets.only(
                  top: LetbuyySpacingTokens.space8,
                ),
                child: Text(
                  errorText!,
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: theme.colorScheme.error,
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

/// The originating field can retire input; the actual sheet route owns the
/// signal's disposal so outgoing route frames never subscribe after disposal.
class _ChoiceAvailability extends ValueNotifier<bool> {
  _ChoiceAvailability(this.onDisposed) : super(true);
  final VoidCallback onDisposed;
  bool claimed = false, disposed = false;
  void retire() {
    if (!disposed) value = false;
  }

  @override
  void dispose() {
    disposed = true;
    onDisposed();
    super.dispose();
  }
}

class _ChoiceSheet<T extends Object> extends StatefulWidget {
  const _ChoiceSheet({
    required this.availability,
    required this.title,
    required this.choices,
    required this.initial,
  });
  final _ChoiceAvailability availability;
  final String title;
  final List<LetbuyyChoice<T>> choices;
  final T? initial;
  @override
  State<_ChoiceSheet<T>> createState() => _ChoiceSheetState<T>();
}

class _ChoiceSheetState<T extends Object> extends State<_ChoiceSheet<T>> {
  late T? _draft = widget.initial;
  @override
  void initState() {
    super.initState();
    widget.availability.claimed = true;
  }

  @override
  void dispose() {
    widget.availability.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => ValueListenableBuilder<bool>(
    valueListenable: widget.availability,
    builder: (_, available, __) => LetbuyyFormSheet(
      title: available ? widget.title : 'Choice unavailable',
      actions: [
        TextButton(
          onPressed: () => completeLetbuyySurface(context),
          child: const Text('Cancel'),
        ),
        FilledButton(
          onPressed:
              available &&
                  _draft != null &&
                  widget.choices.any((choice) => choice.value == _draft)
              ? () => completeLetbuyySurface(context, _draft)
              : null,
          child: const Text('Apply selection'),
        ),
      ],
      child: !available
          ? const Text(
              'Close this choice and reopen it from the current screen.',
            )
          : RadioGroup<T>(
              groupValue: _draft,
              onChanged: (value) {
                if (value != null) setState(() => _draft = value);
              },
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  for (final choice in widget.choices)
                    RadioListTile<T>(
                      value: choice.value,
                      title: Text(choice.label),
                    ),
                ],
              ),
            ),
    ),
  );
}
