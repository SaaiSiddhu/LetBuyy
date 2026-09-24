import type { Metadata } from 'next'

// The buyer pages are the account a shopper uses at every LetBuyy store; the root layout's title
// describes the merchant product. Indexing stays off, from the root layout.
export const metadata: Metadata = {
    title: 'LetBuyy account',
}

export default function BuyerLayout({ children }: { children: React.ReactNode }) {
    return children
}
