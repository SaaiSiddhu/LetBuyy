type AppStoreRecord = Record<string, unknown>;

function searchTokens(value: string): string[] {
    return value
        .toLowerCase()
        .split(/\s+/)
        .map((token) => token.trim())
        .filter((token) => token.length >= 2)
        .slice(0, 8);
}

function stringArray(value: unknown): string[] {
    return Array.isArray(value)
        ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
        : [];
}

function searchableField(value: unknown): string {
    return typeof value === 'string' ? value.toLowerCase() : '';
}

function categoryName(app: AppStoreRecord): string {
    const category = Array.isArray(app.app_categories) ? app.app_categories[0] : app.app_categories;
    return category && typeof category === 'object'
        ? searchableField((category as AppStoreRecord).name)
        : '';
}

function weightedTextScore(field: string, tokens: string[], weight: number): number {
    if (!field) return 0;
    return tokens.reduce((score, token) => {
        if (field === token) return score + weight * 5;
        if (field.startsWith(token)) return score + weight * 3;
        if (field.includes(token)) return score + weight;
        return score;
    }, 0);
}

export function scoreMarketplaceSearchResult(app: AppStoreRecord, search: string): number {
    const tokens = searchTokens(search);
    if (tokens.length === 0) return 0;
    const tags = stringArray(app.tags).join(' ').toLowerCase();
    const compatibilityTags = stringArray(app.compatibility_tags).join(' ').toLowerCase();
    const ratingAvg = Number(app.rating_avg || 0);
    const reviewCount = Number(app.review_count || 0);
    const installCount = Number(app.install_count || 0);

    return [
        weightedTextScore(searchableField(app.name), tokens, 24),
        weightedTextScore(searchableField(app.tagline), tokens, 18),
        weightedTextScore(categoryName(app), tokens, 14),
        weightedTextScore(tags, tokens, 10),
        weightedTextScore(compatibilityTags, tokens, 8),
        weightedTextScore(searchableField(app.description), tokens, 4),
        Math.min(18, ratingAvg * 2),
        Math.min(14, Math.log10(Math.max(reviewCount, 0) + 1) * 4),
        Math.min(18, Math.log10(Math.max(installCount, 0) + 1) * 4),
    ].reduce((total, score) => total + score, 0);
}
