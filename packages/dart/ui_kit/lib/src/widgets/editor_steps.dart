import 'package:flutter/material.dart';
import '../tokens/letbuyy_tokens.dart';
import 'choice_field.dart';

/// One scrolling editor body. Inactive form sections retain their native field
/// state and validation while retiring focus, semantics, input and tickers.
class LetbuyyEditorSteps extends StatefulWidget {
  const LetbuyyEditorSteps({
    super.key,
    required this.labels,
    required this.sections,
    required this.currentStep,
    required this.onStepChanged,
    this.enabled = true,
    this.notice,
  }) : assert(labels.length == sections.length),
       assert(currentStep >= 0 && currentStep < labels.length);
  final List<String> labels;
  final List<Widget> sections;
  final int currentStep;
  final ValueChanged<int> onStepChanged;
  final bool enabled;
  final Widget? notice;

  @override
  State<LetbuyyEditorSteps> createState() => _LetbuyyEditorStepsState();
}

class _LetbuyyEditorStepsState extends State<LetbuyyEditorSteps> {
  final _scroll = ScrollController();
  @override
  void dispose() {
    _scroll.dispose();
    super.dispose();
  }

  void _change(int step) {
    if (!widget.enabled || step == widget.currentStep) return;
    FocusScope.of(context).unfocus();
    widget.onStepChanged(step);
    if (_scroll.hasClients) _scroll.jumpTo(0);
  }

  @override
  Widget build(BuildContext context) => SingleChildScrollView(
    controller: _scroll,
    keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
    padding: const EdgeInsets.all(LetbuyySpacingTokens.space16),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (widget.notice != null) widget.notice!,
        Text(
          'Step ${widget.currentStep + 1} of ${widget.labels.length}',
          style: Theme.of(context).textTheme.bodyMedium,
        ),
        LetbuyyChoiceField<int>(
          label: 'Section',
          value: widget.currentStep,
          choices: [
            for (var i = 0; i < widget.labels.length; i++)
              LetbuyyChoice(value: i, label: widget.labels[i]),
          ],
          onChanged: widget.enabled ? _change : null,
        ),
        const SizedBox(height: LetbuyySpacingTokens.space16),
        for (var i = 0; i < widget.sections.length; i++)
          Offstage(
            offstage: i != widget.currentStep,
            child: ExcludeFocus(
              excluding: i != widget.currentStep || !widget.enabled,
              child: ExcludeSemantics(
                excluding: i != widget.currentStep,
                child: TickerMode(
                  enabled: i == widget.currentStep,
                  child: IgnorePointer(
                    ignoring: i != widget.currentStep || !widget.enabled,
                    child: widget.sections[i],
                  ),
                ),
              ),
            ),
          ),
        const SizedBox(height: LetbuyySpacingTokens.space20),
        OverflowBar(
          spacing: LetbuyySpacingTokens.space12,
          overflowSpacing: LetbuyySpacingTokens.space12,
          children: [
            if (widget.currentStep > 0)
              TextButton(
                onPressed: widget.enabled
                    ? () => _change(widget.currentStep - 1)
                    : null,
                child: const Text('Previous section'),
              ),
            if (widget.currentStep < widget.labels.length - 1)
              FilledButton(
                onPressed: widget.enabled
                    ? () => _change(widget.currentStep + 1)
                    : null,
                child: const Text('Continue'),
              ),
          ],
        ),
      ],
    ),
  );
}
