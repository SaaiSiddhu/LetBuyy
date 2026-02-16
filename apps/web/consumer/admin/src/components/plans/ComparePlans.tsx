'use client'

import { useState } from 'react'

/* ——————————————————————————————————————
   Compare Plans Component
   Feature comparison table with expandable 
   rows and "only show differences" toggle.
   —————————————————————————————————————— */

interface CompareItem {
    label: string
    description?: string
    starter: string | boolean
    business: string | boolean
    enterprise: string | boolean
}

interface CompareCategory {
    category: string
    items: CompareItem[]
}

interface ComparePlansProps {
    compareFeatures: CompareCategory[]
    planSlugs: string[]
    planNames: string[]
    popularIndex?: number
    onSelectPlan: (slug: string) => void
}

export default function ComparePlans({
    compareFeatures,
    planSlugs,
    planNames,
    popularIndex = 0,
    onSelectPlan,
}: ComparePlansProps) {
    const [showDiffsOnly, setShowDiffsOnly] = useState(false)
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
    const [showAll, setShowAll] = useState(false)

    const toggleRow = (key: string) => {
        const next = new Set(expandedRows)
        if (next.has(key)) {
            next.delete(key)
        } else {
            next.add(key)
        }
        setExpandedRows(next)
    }

    // Filter to show differences only
    const filterCategories = (categories: CompareCategory[]) => {
        if (!showDiffsOnly) return categories
        return categories
            .map(cat => ({
                ...cat,
                items: cat.items.filter(item => {
                    const vals = [item.starter, item.business, item.enterprise]
                    return new Set(vals.map(v => String(v))).size > 1
                }),
            }))
            .filter(cat => cat.items.length > 0)
    }

    const displayCategories = filterCategories(compareFeatures)
    const visibleCategories = showAll ? displayCategories : displayCategories.slice(0, 3)

    const renderValue = (val: string | boolean) => {
        if (val === true) return <span className="material-symbols-outlined compare-check">check</span>
        if (val === false) return <span className="compare-dash">—</span>
        return <span>{val}</span>
    }

    return (
        <div className="compare-plans">
            <div className="compare-plans__header">
                <h2 className="compare-plans__title">Compare plans</h2>
                <label className="compare-plans__toggle">
                    <input
                        type="checkbox"
                        checked={showDiffsOnly}
                        onChange={() => setShowDiffsOnly(!showDiffsOnly)}
                    />
                    <span className="compare-plans__toggle-slider"></span>
                    <span>Only show differences</span>
                </label>
            </div>

            <div className="compare-plans__table-wrap">
                <table className="compare-plans__table">
                    {/* Sticky header */}
                    <thead>
                        <tr>
                            <th className="compare-plans__feature-col"></th>
                            {planNames.map((name, i) => (
                                <th key={planSlugs[i]} className="compare-plans__plan-col">
                                    <div className="compare-plans__plan-header">
                                        <span className="compare-plans__plan-name">{name}</span>
                                        {i === popularIndex && (
                                            <span className="compare-plans__popular-badge">Most Popular</span>
                                        )}
                                    </div>
                                    <button
                                        className={`compare-plans__select-btn ${i === popularIndex ? 'compare-plans__select-btn--primary' : ''}`}
                                        onClick={() => onSelectPlan(planSlugs[i])}
                                    >
                                        Select {name}
                                    </button>
                                </th>
                            ))}
                        </tr>
                    </thead>

                    <tbody>
                        {visibleCategories.map((category) => (
                            <>
                                {/* Category header */}
                                <tr key={`cat-${category.category}`} className="compare-plans__category-row">
                                    <td colSpan={planSlugs.length + 1}>
                                        <strong>{category.category}</strong>
                                    </td>
                                </tr>

                                {/* Feature rows */}
                                {category.items.map((item) => {
                                    const rowKey = `${category.category}-${item.label}`
                                    const isExpanded = expandedRows.has(rowKey)
                                    const hasDescription = !!item.description

                                    return (
                                        <tr
                                            key={rowKey}
                                            className={`compare-plans__feature-row ${hasDescription ? 'compare-plans__feature-row--expandable' : ''} ${isExpanded ? 'compare-plans__feature-row--expanded' : ''}`}
                                            onClick={hasDescription ? () => toggleRow(rowKey) : undefined}
                                        >
                                            <td className="compare-plans__feature-label">
                                                <div className="compare-plans__feature-label-inner">
                                                    {hasDescription && (
                                                        <span className="material-symbols-outlined compare-plans__expand-icon">
                                                            {isExpanded ? 'expand_more' : 'chevron_right'}
                                                        </span>
                                                    )}
                                                    <div>
                                                        <span>{item.label}</span>
                                                        {isExpanded && item.description && (
                                                            <p className="compare-plans__feature-desc">
                                                                {item.description}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="compare-plans__feature-value">{renderValue(item.starter)}</td>
                                            <td className="compare-plans__feature-value">{renderValue(item.business)}</td>
                                            <td className="compare-plans__feature-value">{renderValue(item.enterprise)}</td>
                                        </tr>
                                    )
                                })}
                            </>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Show more/less */}
            {displayCategories.length > 3 && (
                <button
                    className="compare-plans__show-more"
                    onClick={() => setShowAll(!showAll)}
                >
                    <span className="material-symbols-outlined">
                        {showAll ? 'expand_less' : 'expand_more'}
                    </span>
                    {showAll ? 'Show less' : `See all ${displayCategories.length} categories`}
                </button>
            )}
        </div>
    )
}
