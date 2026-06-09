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
    return missingColumnFromError(error) === columnName || databaseErrorText(error).includes(columnName.toLowerCase());
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
