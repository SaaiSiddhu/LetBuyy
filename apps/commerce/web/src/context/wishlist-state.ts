export function applyWishlistProductState(
    items: readonly string[],
    productId: string,
    shouldInclude: boolean,
): string[] {
    if (shouldInclude) return items.includes(productId) ? [...items] : [...items, productId];
    return items.filter((id) => id !== productId);
}
