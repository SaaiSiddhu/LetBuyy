'use client'

import { LazyMotion, domAnimation } from 'framer-motion'
import type { ReactNode } from 'react'

/** Load the features used by this site synchronously, preserving first-frame
 * animations without shipping the unused drag and layout-projection engine. */
export default function MarketingMotionProvider({ children }: { children: ReactNode }) {
    return <LazyMotion features={domAnimation} strict>{children}</LazyMotion>
}
