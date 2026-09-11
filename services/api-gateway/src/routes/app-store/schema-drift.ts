export const APP_CATEGORY_COLUMN_NAMES = [
    'id',
    'name',
    'slug',
    'description',
    'icon',
    'group_name',
    'sort_order',
    'is_active',
    'seo_title',
    'seo_description',
    'seo_content',
    'seo_faq',
    'buyer_guidance',
] as const;

const APP_DEVELOPER_PUBLIC_SELECT = 'app_developers!inner(id, company_name, slug, logo_url, website_url, support_email, verified)';
const APP_PRICING_PUBLIC_SELECT = 'app_pricing_plans(id, app_id, developer_id, plan_slug, name, description, pricing_model, billing_mode, currency, amount_minor, interval, trial_days, usage_meter, usage_unit, included_usage, usage_unit_amount_minor, features, limits, is_default, status, sort_order)';

type AppPublicSelectOptions = {
    includePricingPlans: boolean;
    includeCategoryGroupName: boolean;
};

function databaseErrorText(error: { message?: string; details?: string; hint?: string } | null | undefined): string {
    return [error?.message, error?.details, error?.hint].filter(Boolean).join(' ').toLowerCase();
}

export function missingColumnFromError(error: { message?: string; details?: string; hint?: string } | null | undefined): string | null {
    const text = databaseErrorText(error);
    const quotedColumn = text.match(/column\s+(?:[a-z0-9_]+\.)?([a-z0-9_]+)\s+does not exist/i)?.[1];
    if (quotedColumn) return quotedColumn;
    const schemaCacheColumn = text.match(/could not find (?:the )?'?([a-z0-9_]+)'? column/i)?.[1];
    if (schemaCacheColumn) return schemaCacheColumn;
    return null;
}

export function isMissingColumnError(
    error: { message?: string; details?: string; hint?: string } | null | undefined,
    columnName: string,
): boolean {
    // The precise test first: missingColumnFromError parses the column out of a drift message, so an
    // exact match is conclusive. It is kept because it is STRICTER than the majority predicate, not
    // looser.
    if (missingColumnFromError(error) === columnName) return true;

    // The fallback used to be `databaseErrorText(error).includes(columnName)` with no further
    // condition, which made ANY error merely mentioning the column read as a missing column — a
    // permission denial, a constraint violation, a type error. This route family drops the column
    // from its select and retries when this returns true, so an unrelated failure silently degraded
    // the response. Twelve other definitions of this predicate in the gateway require the column name
    // AND a drift-shaped phrase; this now matches them.
    const text = databaseErrorText(error);
    return text.includes(columnName.toLowerCase()) && (
        text.includes('does not exist') ||
        text.includes('schema cache') ||
        text.includes('could not find')
    );
}

export function isMissingAppPricingPlansRelation(
    error: { message?: string; details?: string; hint?: string } | null | undefined,
): boolean {
    const text = databaseErrorText(error);
    return text.includes('app_pricing_plans') && (
        text.includes('relationship') ||
        text.includes('schema cache') ||
        text.includes('could not find')
    );
}

function appCategoryRelationSelect(includeGroupName: boolean): string {
    const columns = ['id', 'name', 'slug', 'icon'];
    if (includeGroupName) columns.push('group_name');
    return `app_categories!inner(${columns.join(', ')})`;
}

export function appPublicSelect(options: AppPublicSelectOptions): string {
    return [
        '*',
        APP_DEVELOPER_PUBLIC_SELECT,
        appCategoryRelationSelect(options.includeCategoryGroupName),
        options.includePricingPlans ? APP_PRICING_PUBLIC_SELECT : null,
    ].filter(Boolean).join(', ');
}

export function appDetailSelect(options: AppPublicSelectOptions): string {
    return [
        '*',
        APP_DEVELOPER_PUBLIC_SELECT,
        appCategoryRelationSelect(options.includeCategoryGroupName),
        'app_extensions(*)',
        'app_versions(id, app_id, developer_id, version, release_notes, changelog, rollout_percentage, rollout_cohort, status, submitted_at, released_at, created_at, updated_at)',
        options.includePricingPlans ? APP_PRICING_PUBLIC_SELECT : null,
    ].filter(Boolean).join(', ');
}
