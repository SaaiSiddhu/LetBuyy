import type { ReactNode } from 'react'
import {
    BarChart3,
    Code2,
    IndianRupee,
    Package,
    Rocket,
    ShoppingBag,
    Sparkles,
} from '@letbuyy/ui'

/**
 * Each category declares an icon name in its data; without this map every
 * category renders the same placeholder glyph.
 *
 * These are pre-built elements rather than component references on purpose —
 * looking up a component and rendering it inside a component body trips
 * react-hooks/static-components.
 *
 * Note: @letbuyy/ui imports TrendingUp for its material-icon map but does not
 * re-export it, so Growth uses BarChart3 as the nearest exported equivalent.
 */
const ICON_PROPS = { width: 22, height: 22, strokeWidth: 1.8 } as const

const CATEGORY_ICON_NODES: Record<string, ReactNode> = {
    ShoppingBag: <ShoppingBag {...ICON_PROPS} />,
    TrendingUp: <BarChart3 {...ICON_PROPS} />,
    IndianRupee: <IndianRupee {...ICON_PROPS} />,
    Package: <Package {...ICON_PROPS} />,
    Sparkles: <Sparkles {...ICON_PROPS} />,
    Code2: <Code2 {...ICON_PROPS} />,
    Rocket: <Rocket {...ICON_PROPS} />,
}

export function categoryIconNode(name: string): ReactNode {
    return CATEGORY_ICON_NODES[name] ?? CATEGORY_ICON_NODES.ShoppingBag
}
