import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../app/store_context.dart';
import '../../l10n/app_localizations.dart';
import '../../models/store_model.dart';
import '../../theme/app_theme_colors.dart';

class StoreSwitcherButton extends StatelessWidget {
  const StoreSwitcherButton({super.key, this.onChanged});

  final VoidCallback? onChanged;

  @override
  Widget build(BuildContext context) {
    final storeContext = context.watch<StoreContext>();
    final store = storeContext.selectedStore;
    final colors = AppThemeColors.of(context);
    final l10n = AppLocalizations.of(context);

    return Semantics(
      button: true,
      label: l10n.storeSwitcherLabel,
      value: store?.name ?? l10n.noStoreSelected,
      child: ConstrainedBox(
        constraints: const BoxConstraints(minHeight: 48, maxWidth: 220),
        child: OutlinedButton.icon(
          onPressed: storeContext.stores.length <= 1
              ? () => storeContext.loadStores(force: true)
              : () => _showSwitcher(context, storeContext),
          style: OutlinedButton.styleFrom(
            foregroundColor: colors.textPrimary,
            side: BorderSide(color: colors.glassMediumBorder),
            backgroundColor: colors.glassMedium,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
            ),
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            minimumSize: const Size(48, 48),
          ),
          icon: const Icon(Icons.storefront_outlined, size: 18),
          label: Text(
            store?.name ?? l10n.selectStore,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(fontWeight: FontWeight.w600),
          ),
        ),
      ),
    );
  }

  Future<void> _showSwitcher(
    BuildContext context,
    StoreContext storeContext,
  ) async {
    final colors = AppThemeColors.of(context);
    final selected = await showModalBottomSheet<StoreModel>(
      context: context,
      showDragHandle: true,
      backgroundColor: colors.card,
      builder: (sheetContext) {
        final l10n = AppLocalizations.of(sheetContext);
        return SafeArea(
          child: ListView(
            shrinkWrap: true,
            padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
            children: [
              Text(
                l10n.switchStore,
                style: TextStyle(
                  color: colors.textPrimary,
                  fontSize: 18,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 12),
              for (final store in storeContext.stores)
                Semantics(
                  button: true,
                  selected: store.id == storeContext.selectedStoreId,
                  child: ListTile(
                    minVerticalPadding: 12,
                    contentPadding: const EdgeInsets.symmetric(
                      horizontal: 4,
                      vertical: 4,
                    ),
                    leading: CircleAvatar(
                      backgroundColor: colors.elevation1,
                      child: Text(
                        store.name.isEmpty ? 'S' : store.name[0].toUpperCase(),
                        style: TextStyle(color: colors.textPrimary),
                      ),
                    ),
                    title: Text(
                      store.name,
                      style: TextStyle(
                        color: colors.textPrimary,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    subtitle: Text(
                      '${store.subdomain}.letbuyy.com',
                      style: TextStyle(color: colors.textSecondary),
                    ),
                    trailing: store.id == storeContext.selectedStoreId
                        ? Icon(Icons.check_circle, color: colors.accent)
                        : null,
                    onTap: () => Navigator.pop(sheetContext, store),
                  ),
                ),
            ],
          ),
        );
      },
    );

    if (selected == null) return;
    await storeContext.selectStore(selected);
    onChanged?.call();
  }
}
