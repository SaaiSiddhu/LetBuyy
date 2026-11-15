import 'package:flutter/material.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';

/// Presentation shell only. Callers retain query, record and command authority.
/// One scroll owner keeps filters and saved-request recovery reachable even
/// when large text makes those sections taller than the viewport.
class WarehouseListScaffold extends StatelessWidget {
  const WarehouseListScaffold({
    super.key,
    required this.title,
    required this.description,
    required this.refreshLabel,
    required this.onRefresh,
    required this.loading,
    required this.header,
    required this.slivers,
    this.action,
    this.headerActions = const [],
    this.scrollIdentity,
  });
  final String title, description, refreshLabel;
  final Future<void> Function()? onRefresh;
  final bool loading;
  final List<Widget> header, slivers;
  final Widget? action;
  final List<Widget> headerActions;
  final Object? scrollIdentity;

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: CustomAppBar.responsive(
      context: context,
      title: title,
      leading: IconButton(
        tooltip: 'Back',
        onPressed: () => dismissLetbuyySurface(context),
        icon: const BackButtonIcon(),
      ),
      actions: [
        ...headerActions,
        IconButton(
          tooltip: refreshLabel,
          onPressed: onRefresh,
          icon: const Icon(Icons.refresh),
        ),
      ],
    ),
    body: SafeArea(
      top: false,
      bottom: false,
      child: Column(
        children: [
          if (loading)
            const LinearProgressIndicator(key: Key('merchant-list-progress')),
          Expanded(
            child: RefreshIndicator(
              onRefresh: () async => onRefresh?.call(),
              child: CustomScrollView(
                key: PageStorageKey((
                  title,
                  scrollIdentity,
                  'warehouse-list-scroll',
                )),
                physics: const AlwaysScrollableScrollPhysics(),
                slivers: [
                  SliverToBoxAdapter(
                    child: Padding(
                      padding: const EdgeInsets.all(
                        LetbuyySpacingTokens.space16,
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Text(
                            description,
                            style: Theme.of(context).textTheme.bodyMedium,
                          ),
                          ...header,
                        ],
                      ),
                    ),
                  ),
                  ...slivers,
                ],
              ),
            ),
          ),
        ],
      ),
    ),
    bottomNavigationBar: action == null
        ? null
        : SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.all(LetbuyySpacingTokens.space16),
              child: action!,
            ),
          ),
  );
}
