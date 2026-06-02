import Link from 'next/link';
import { MaterialIcon, type MaterialIconName } from '@letbuyy/ui';
import { APP_CATEGORIES } from '@/lib/constants/categories';

export function CategoryGrid() {
    return (
        <div className="category-grid">
            {APP_CATEGORIES.map(cat => (
                <Link
                    key={cat.slug}
                    href={`/categories/${cat.slug}`}
                    className="category-card"
                >
                    <MaterialIcon name={(cat.icon ?? 'category') as MaterialIconName} className="category-card__icon" />
                    <span className="category-card__name">{cat.name}</span>
                </Link>
            ))}
        </div>
    );
}

// Compact version showing only group headers
export function CategoryGroupGrid() {
    const groupIcons: Record<string, MaterialIconName> = {
        Products: 'inventory_2',
        Selling: 'payments',
        Orders: 'local_shipping',
        Marketing: 'mail',
        Conversion: 'star',
        Design: 'web_asset',
        Support: 'chat',
        Analytics: 'analytics',
        Finance: 'receipt_long',
    };

    const groups = Array.from(new Set(APP_CATEGORIES.map(c => c.group).filter((group): group is string => Boolean(group))));

    return (
        <div className="category-grid">
            {groups.map(group => (
                <Link
                    key={group}
                    href={`/categories/${APP_CATEGORIES.find(c => c.group === group)!.slug}`}
                    className="category-card"
                >
                    <MaterialIcon name={groupIcons[group] || 'folder'} className="category-card__icon" />
                    <span className="category-card__name">{group}</span>
                    <span className="category-card__count">
                        {APP_CATEGORIES.filter(c => c.group === group).length} categories
                    </span>
                </Link>
            ))}
        </div>
    );
}
