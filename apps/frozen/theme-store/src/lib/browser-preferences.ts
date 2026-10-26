export const FAVORITES_KEY = 'letbuyy.themeMarketplace.favorites.v1';
export const COMPARE_KEY = 'letbuyy.themeMarketplace.compare.v1';
/** Clears only the local shortlist. Never touches session, appearance, or account records. */
export function clearSavedThemeChoices(storage: Pick<Storage, 'removeItem'>) {
    storage.removeItem(FAVORITES_KEY);
    storage.removeItem(COMPARE_KEY);
}
