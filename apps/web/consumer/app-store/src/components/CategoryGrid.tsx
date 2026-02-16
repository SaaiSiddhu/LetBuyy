import Link from 'next/link';
import { APP_CATEGORIES } from '@/lib/constants/categories';

export function CategoryGrid() {
    // Group categories — show unique groups
    const groups = Array.from(new Set(APP_CATEGORIES.map(c => c.group)));

    return (
        <div className="category-grid">
            {APP_CATEGORIES.map(cat => (
                <Link
                    key={cat.slug}
                    href={`/categories/${cat.slug}`}
                    className="category-card"
                >
                    <span className="category-card__icon">{cat.icon}</span>
                    <span className="category-card__name">{cat.name}</span>
                </Link>
            ))}
        </div>
    );
}

// Compact version showing only group headers
export function CategoryGroupGrid() {
    const groupIcons: Record<string, string> = {
        Products: '📦',
        Selling: '💳',
        Orders: '🚚',
        Marketing: '📧',
        Conversion: '⭐',
        Design: '🏗️',
        Support: '💬',
        Analytics: '📊',
        Finance: '🧾',
    };

    const groups = Array.from(new Set(APP_CATEGORIES.map(c => c.group)));

    return (
        <div className="category-grid">
            {groups.map(group => (
                <Link
                    key={group}
                    href={`/categories/${APP_CATEGORIES.find(c => c.group === group)!.slug}`}
                    className="category-card"
                >
                    <span className="category-card__icon">{groupIcons[group] || '📁'}</span>
                    <span className="category-card__name">{group}</span>
                    <span className="category-card__count">
                        {APP_CATEGORIES.filter(c => c.group === group).length} categories
                    </span>
                </Link>
            ))}
        </div>
    );
}
