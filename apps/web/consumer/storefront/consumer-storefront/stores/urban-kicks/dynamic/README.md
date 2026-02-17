# Urban Kicks — Dynamic Module

The dynamic module contains theme-specific configurations for rendering the Urban Kicks storefront with **real** data from Supabase.

## Architecture

```
dynamic/
├── index.ts                    # Theme config, CSS generation, re-exports
├── pages/
│   ├── home-page.tsx           # Section rendering with real products
│   ├── shop-page.tsx           # Product grid with real inventory
│   ├── cart-page.tsx           # Re-exports shared cart (uses CartContext)
│   ├── checkout-page.tsx       # Re-exports shared checkout
│   ├── orders-page.tsx         # Re-exports shared orders
│   ├── product-detail-page.tsx # Re-exports shared PDP
│   └── account-page.tsx        # Re-exports shared account layout
└── README.md                   # This file
```

## How It Works

1. **Theme Config**: `index.ts` exports the Urban Kicks theme ID, preset colors, CSS generation function, and nav links
2. **CSS Variables**: `generateThemeCSS()` creates the full CSS custom properties block that the store layout injects
3. **Page Components**: Most pages re-export shared components since visual customization happens via CSS variables
4. **Custom Pages**: `home-page.tsx` and `shop-page.tsx` contain theme-specific data fetching logic

## Usage

Route wrappers in `src/app/store/[subdomain]/` import from this module:

```tsx
import DynamicHomePage from '@stores/urban-kicks/dynamic/pages/home-page';

export default function Page({ params }) {
  return <DynamicHomePage subdomain={params.subdomain} />;
}
```
