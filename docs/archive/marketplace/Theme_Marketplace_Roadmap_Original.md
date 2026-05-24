# 🎨 LetBuyy Theme Marketplace - Complete Roadmap

**Vision:** Build a world-class theme marketplace like Shopify Theme Store + Webflow Templates, where users can browse, preview, purchase, and instantly apply themes to their storefronts.

---

## 📐 Architecture Overview

### **Monorepo Structure** (Turborepo + pnpm)

```
letbuyy-monorepo/
├── apps/
│   ├── storefront/              # Customer-facing stores ({store}.letbuyy.store)
│   ├── theme-marketplace/       # Theme store (themes.letbuyy.store) 🆕
│   ├── admin/                   # Store owner dashboard (admin.letbuyy.store)
│   ├── theme-builder/           # Visual theme customizer (future)
│   └── docs/                    # Documentation site
│
├── packages/
│   ├── ui/                      # Shared React components (shadcn/ui based)
│   ├── theme-engine/            # Core theme rendering logic 🆕
│   ├── database/                # Supabase client + Prisma schemas
│   ├── auth/                    # Supabase Auth wrapper
│   ├── payments/                # Stripe + Razorpay integration
│   ├── analytics/               # Posthog/Mixpanel events
│   ├── email/                   # Resend/SendGrid templates
│   └── config/                  # Shared configs (ESLint, TS, Tailwind)
│
├── packages/theme-engine/       # 🔥 Core Innovation
│   ├── src/
│   │   ├── renderer/            # SSR theme renderer
│   │   ├── schemas/             # Zod schemas for theme config
│   │   ├── presets/             # Theme preset definitions
│   │   ├── hydration/           # Client-side hydration
│   │   └── customization/       # Theme customizer logic
│   └── themes/                  # All theme implementations
│       ├── store/
│       │   ├── urban-kicks/
│       │   ├── luxe-atelier/
│       │   └── neon-tech/
│       ├── portfolio/
│       ├── resume/
│       └── landing/
│
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```

---

## 🎯 Key Architectural Decisions

### **1. Theme Engine as a Package**

**Why?** Themes aren't uploaded files - they're **code** living in your monorepo.

```typescript
// packages/theme-engine/src/renderer/index.ts
export async function renderTheme(options: ThemeRenderOptions) {
  const { themeId, storeData, userCustomizations } = options;
  
  // Get theme preset from registry
  const ThemeComponent = THEME_REGISTRY[themeId];
  
  // Merge with user customizations
  const config = mergeConfigs(ThemeComponent.defaultConfig, userCustomizations);
  
  // Server-side render
  return renderToString(<ThemeComponent config={config} data={storeData} />);
}
```

**Benefits:**
- ✅ Type-safe theme development
- ✅ Instant deployment (no user uploads)
- ✅ Version control for themes
- ✅ Easy A/B testing
- ✅ Preview without applying

---

### **2. Database Schema (Enhanced)**

```sql
-- ============================================
-- THEME CATALOG
-- ============================================

CREATE TABLE themes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    long_description TEXT,
    
    -- Classification
    category TEXT NOT NULL CHECK (category IN ('store','portfolio','resume','landing','saas')),
    industry TEXT[], -- ['fashion', 'tech', 'food']
    
    -- Technical
    theme_preset_id TEXT NOT NULL,  -- Maps to THEME_REGISTRY key
    version TEXT DEFAULT '1.0.0',
    is_active BOOLEAN DEFAULT true,
    requires_min_version TEXT,      -- Minimum storefront version
    
    -- Pricing
    pricing_type TEXT NOT NULL CHECK (pricing_type IN ('free','one_time','subscription')),
    price_usd DECIMAL(10,2) DEFAULT 0,
    price_inr DECIMAL(10,2) DEFAULT 0,
    subscription_interval TEXT CHECK (subscription_interval IN ('month','year')),
    
    -- Media
    thumbnail_url TEXT,
    screenshots TEXT[] DEFAULT '{}',
    demo_video_url TEXT,
    
    -- Customization Options
    customizable_sections JSONB DEFAULT '{}',  -- Which sections users can customize
    color_presets JSONB DEFAULT '[]',          -- Pre-defined color schemes
    font_options TEXT[] DEFAULT '{}',          -- Allowed fonts
    
    -- Demo Data
    demo_store_config JSONB,                   -- Full mock store data for preview
    
    -- Metadata
    author_id TEXT,                            -- Creator (for third-party themes)
    author_name TEXT DEFAULT 'LetBuyy Team',
    tags TEXT[] DEFAULT '{}',
    features TEXT[] DEFAULT '{}',
    
    -- Stats
    rating DECIMAL(2,1) DEFAULT 0,
    review_count INT DEFAULT 0,
    install_count INT DEFAULT 0,
    purchase_count INT DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    published_at TIMESTAMPTZ
);

-- ============================================
-- USER PURCHASES
-- ============================================

CREATE TABLE theme_purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Relations
    user_id TEXT NOT NULL,               -- Supabase Auth user
    theme_id UUID REFERENCES themes(id),
    
    -- Payment
    payment_provider TEXT CHECK (payment_provider IN ('stripe','razorpay','free')),
    payment_intent_id TEXT,              -- Stripe PI / Razorpay order ID
    payment_status TEXT DEFAULT 'completed' CHECK (payment_status IN ('pending','completed','failed','refunded')),
    
    amount_paid DECIMAL(10,2) DEFAULT 0,
    currency TEXT DEFAULT 'USD',
    
    -- Licensing
    license_key TEXT UNIQUE,             -- UUID for verification
    license_type TEXT DEFAULT 'single_site',
    max_installations INT DEFAULT 1,
    
    -- Metadata
    purchased_at TIMESTAMPTZ DEFAULT NOW(),
    refunded_at TIMESTAMPTZ,
    invoice_url TEXT
);

-- ============================================
-- THEME INSTALLATIONS (Which store uses which theme)
-- ============================================

CREATE TABLE store_themes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Relations
    store_id TEXT NOT NULL,              -- From stores table
    user_id TEXT NOT NULL,               -- Owner verification
    theme_id UUID REFERENCES themes(id),
    purchase_id UUID REFERENCES theme_purchases(id),
    
    -- State
    is_active BOOLEAN DEFAULT false,     -- Only one active theme per store
    
    -- Customizations
    customizations JSONB DEFAULT '{}',   -- User's color/font/section overrides
    
    -- Timestamps
    installed_at TIMESTAMPTZ DEFAULT NOW(),
    activated_at TIMESTAMPTZ,
    last_modified TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- THEME REVIEWS
-- ============================================

CREATE TABLE theme_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    theme_id UUID REFERENCES themes(id),
    user_id TEXT NOT NULL,
    purchase_id UUID REFERENCES theme_purchases(id),
    
    rating INT CHECK (rating >= 1 AND rating <= 5),
    title TEXT,
    comment TEXT,
    
    -- Helpful votes
    helpful_count INT DEFAULT 0,
    
    -- Moderation
    is_verified_purchase BOOLEAN DEFAULT false,
    is_approved BOOLEAN DEFAULT false,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- THEME CHANGELOG
-- ============================================

CREATE TABLE theme_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    theme_id UUID REFERENCES themes(id),
    version TEXT NOT NULL,
    changelog TEXT,
    breaking_changes TEXT[],
    
    released_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX idx_themes_category ON themes(category);
CREATE INDEX idx_themes_pricing ON themes(pricing_type);
CREATE INDEX idx_themes_active ON themes(is_active) WHERE is_active = true;
CREATE INDEX idx_theme_purchases_user ON theme_purchases(user_id);
CREATE INDEX idx_theme_purchases_theme ON theme_purchases(theme_id);
CREATE INDEX idx_store_themes_store ON store_themes(store_id);
CREATE INDEX idx_store_themes_active ON store_themes(store_id, is_active) WHERE is_active = true;
CREATE INDEX idx_reviews_theme ON theme_reviews(theme_id);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

ALTER TABLE theme_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_themes ENABLE ROW LEVEL SECURITY;
ALTER TABLE theme_reviews ENABLE ROW LEVEL SECURITY;

-- Users can only see their own purchases
CREATE POLICY "Users can view own purchases" ON theme_purchases
    FOR SELECT USING (auth.uid() = user_id);

-- Users can only modify their own store themes
CREATE POLICY "Users can manage own store themes" ON store_themes
    FOR ALL USING (auth.uid() = user_id);
```

---

## 🛠️ Tech Stack

### **Frontend**
- **Framework:** Next.js 15 (App Router)
- **Styling:** Tailwind CSS 4.0 + shadcn/ui
- **State:** Zustand + React Query (TanStack Query)
- **Forms:** React Hook Form + Zod
- **Animations:** Framer Motion
- **Icons:** Lucide React

### **Backend**
- **Database:** Supabase (PostgreSQL)
- **Auth:** Supabase Auth
- **Storage:** Supabase Storage (for user uploads like logos)
- **API:** Next.js API Routes + tRPC (type-safe)
- **Payments:** Stripe + Razorpay
- **Email:** Resend

### **DevOps**
- **Monorepo:** Turborepo
- **Package Manager:** pnpm
- **Hosting:** Vercel (or Cloud Run)
- **CI/CD:** GitHub Actions
- **Monitoring:** Sentry + Axiom

---

## 📅 Development Phases

### **Phase 1: Foundation (Week 1-2)**

#### **Setup Monorepo**
```bash
npx create-turbo@latest letbuyy-monorepo
cd letbuyy-monorepo

# Add apps
pnpm create next-app apps/theme-marketplace
pnpm create next-app apps/storefront

# Add packages
mkdir -p packages/{ui,theme-engine,database,auth,payments}
```

#### **Database Setup**
- [ ] Execute SQL schema in Supabase
- [ ] Set up Prisma (optional, for type-safety)
- [ ] Create seed data for 5 initial themes

#### **Theme Engine Core**
```typescript
// packages/theme-engine/src/index.ts
export { renderTheme } from './renderer';
export { THEME_REGISTRY } from './registry';
export type { ThemeConfig, ThemeProps } from './types';

// packages/theme-engine/src/registry.ts
import UrbanKicks from './themes/store/urban-kicks';
import LuxeAtelier from './themes/store/luxe-atelier';

export const THEME_REGISTRY = {
  'urban-kicks': UrbanKicks,
  'luxe-atelier': LuxeAtelier,
  // ... more themes
} as const;

export type ThemeId = keyof typeof THEME_REGISTRY;
```

---

### **Phase 2: Theme Marketplace UI (Week 3-4)**

#### **Pages**
- [ ] `/themes` - Gallery with filters
- [ ] `/themes/[slug]` - Detail page
- [ ] `/themes/[slug]/preview` - Live preview
- [ ] `/themes/auth/*` - Login/Register
- [ ] `/themes/dashboard/*` - User dashboard
- [ ] `/themes/checkout/[slug]` - Checkout flow

#### **Key Components**
```typescript
// apps/theme-marketplace/components/theme-card.tsx
export function ThemeCard({ theme }: { theme: Theme }) {
  return (
    <div className="group relative overflow-hidden rounded-lg border">
      <div className="aspect-video relative">
        <Image src={theme.thumbnail_url} fill className="object-cover" />
        
        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition">
          <div className="flex items-center justify-center h-full gap-2">
            <Button variant="secondary">Preview</Button>
            <Button>View Details</Button>
          </div>
        </div>
      </div>
      
      <div className="p-4">
        <h3 className="font-semibold">{theme.name}</h3>
        <p className="text-sm text-muted-foreground">{theme.description}</p>
        
        <div className="flex items-center justify-between mt-4">
          <div className="flex items-center gap-1">
            <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
            <span className="text-sm">{theme.rating} ({theme.review_count})</span>
          </div>
          
          <div className="font-bold">
            {theme.pricing_type === 'free' ? 'FREE' : `$${theme.price_usd}`}
          </div>
        </div>
      </div>
    </div>
  );
}
```

---

### **Phase 3: Purchase Flow (Week 5)**

#### **Stripe Integration**
```typescript
// apps/theme-marketplace/app/api/checkout/create-session/route.ts
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(request: Request) {
  const { themeId } = await request.json();
  const userId = await getUserId(request);
  
  // Get theme details
  const theme = await supabase
    .from('themes')
    .select('*')
    .eq('id', themeId)
    .single();
  
  // Create checkout session
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [{
      price_data: {
        currency: 'usd',
        product_data: {
          name: theme.name,
          description: theme.description,
          images: [theme.thumbnail_url],
        },
        unit_amount: theme.price_usd * 100,
      },
      quantity: 1,
    }],
    metadata: {
      themeId,
      userId,
    },
    success_url: `${process.env.NEXT_PUBLIC_URL}/themes/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.NEXT_PUBLIC_URL}/themes/${theme.slug}`,
  });
  
  return Response.json({ url: session.url });
}
```

#### **Webhook Handler**
```typescript
// apps/theme-marketplace/app/api/webhooks/stripe/route.ts
export async function POST(request: Request) {
  const sig = request.headers.get('stripe-signature')!;
  const body = await request.text();
  
  const event = stripe.webhooks.constructEvent(
    body,
    sig,
    process.env.STRIPE_WEBHOOK_SECRET!
  );
  
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const { themeId, userId } = session.metadata;
    
    // Record purchase
    await supabase.from('theme_purchases').insert({
      user_id: userId,
      theme_id: themeId,
      payment_provider: 'stripe',
      payment_intent_id: session.payment_intent,
      amount_paid: session.amount_total / 100,
      currency: session.currency,
      license_key: crypto.randomUUID(),
    });
    
    // Update theme stats
    await supabase.rpc('increment_purchase_count', { theme_id: themeId });
  }
  
  return Response.json({ received: true });
}
```

---

### **Phase 4: Theme Application System (Week 6)**

#### **Apply Theme to Store**
```typescript
// apps/theme-marketplace/app/api/themes/apply/route.ts
export async function POST(request: Request) {
  const { storeId, themeId } = await request.json();
  const userId = await getUserId(request);
  
  // Verify user owns the store
  const store = await supabase
    .from('stores')
    .select('*')
    .eq('id', storeId)
    .eq('user_id', userId)
    .single();
  
  if (!store) {
    return Response.json({ error: 'Store not found' }, { status: 404 });
  }
  
  // Verify user purchased the theme
  const purchase = await supabase
    .from('theme_purchases')
    .select('*')
    .eq('user_id', userId)
    .eq('theme_id', themeId)
    .single();
  
  if (!purchase) {
    return Response.json({ error: 'Theme not purchased' }, { status: 403 });
  }
  
  // Deactivate current theme
  await supabase
    .from('store_themes')
    .update({ is_active: false })
    .eq('store_id', storeId)
    .eq('is_active', true);
  
  // Apply new theme
  await supabase.from('store_themes').insert({
    store_id: storeId,
    user_id: userId,
    theme_id: themeId,
    purchase_id: purchase.id,
    is_active: true,
    activated_at: new Date().toISOString(),
  });
  
  return Response.json({ success: true });
}
```

#### **Storefront Theme Loading**
```typescript
// apps/storefront/app/store/[subdomain]/page.tsx
import { renderTheme } from '@letbuyy/theme-engine';

export default async function StorePage({ params }: { params: { subdomain: string } }) {
  // Get store data
  const store = await getStoreBySubdomain(params.subdomain);
  
  // Get active theme
  const activeTheme = await supabase
    .from('store_themes')
    .select('*, themes(*)')
    .eq('store_id', store.id)
    .eq('is_active', true)
    .single();
  
  // Render theme
  const themeHtml = await renderTheme({
    themeId: activeTheme.themes.theme_preset_id,
    storeData: store,
    userCustomizations: activeTheme.customizations,
  });
  
  return <div dangerouslySetInnerHTML={{ __html: themeHtml }} />;
}
```

---

### **Phase 5: Live Preview System (Week 7)**

#### **Preview with Mock Data**
```typescript
// apps/theme-marketplace/app/themes/[slug]/preview/page.tsx
import { THEME_REGISTRY } from '@letbuyy/theme-engine';

export default async function ThemePreviewPage({ params }: { params: { slug: string } }) {
  const theme = await getThemeBySlug(params.slug);
  
  // Get the theme component
  const ThemeComponent = THEME_REGISTRY[theme.theme_preset_id];
  
  return (
    <div className="min-h-screen">
      {/* Preview Toolbar */}
      <PreviewToolbar theme={theme} />
      
      {/* Rendered Theme with Mock Data */}
      <div className="preview-container">
        <ThemeComponent 
          config={theme.demo_store_config}
          isPreview={true}
        />
      </div>
    </div>
  );
}
```

---

### **Phase 6: Advanced Features (Week 8-10)**

#### **1. Theme Customizer**
Allow users to customize colors, fonts, layouts without code.

```typescript
// packages/theme-engine/src/customizer/index.ts
export interface CustomizationOptions {
  colors: {
    primary: string;
    secondary: string;
    accent: string;
  };
  fonts: {
    heading: string;
    body: string;
  };
  layout: {
    headerStyle: 'minimal' | 'classic' | 'centered';
    footerColumns: 2 | 3 | 4;
  };
  sections: {
    showHero: boolean;
    showTestimonials: boolean;
    showNewsletter: boolean;
  };
}

export function applyCustomizations(
  baseTheme: ThemeConfig,
  customizations: Partial<CustomizationOptions>
): ThemeConfig {
  return {
    ...baseTheme,
    colors: { ...baseTheme.colors, ...customizations.colors },
    fonts: { ...baseTheme.fonts, ...customizations.fonts },
    // ... deep merge logic
  };
}
```

#### **2. Theme Analytics**
Track theme performance metrics.

```sql
CREATE TABLE theme_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    theme_id UUID REFERENCES themes(id),
    store_id TEXT,
    
    -- Metrics
    page_views INT DEFAULT 0,
    conversion_rate DECIMAL(5,2),
    avg_session_duration INT,
    bounce_rate DECIMAL(5,2),
    
    -- Period
    period_start TIMESTAMPTZ,
    period_end TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### **3. A/B Testing**
Allow stores to test multiple themes.

```typescript
// packages/theme-engine/src/ab-testing/index.ts
export async function getThemeForVisitor(
  storeId: string,
  visitorId: string
): Promise<Theme> {
  const experiment = await getActiveExperiment(storeId);
  
  if (!experiment) {
    return getActiveTheme(storeId);
  }
  
  // Assign variant based on visitor hash
  const variant = hashVisitor(visitorId) % 2 === 0 
    ? experiment.variant_a 
    : experiment.variant_b;
  
  return variant;
}
```

#### **4. Theme Reviews & Ratings**
```typescript
// apps/theme-marketplace/components/review-form.tsx
export function ReviewForm({ themeId }: { themeId: string }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  
  const submitReview = async () => {
    await fetch('/api/themes/reviews', {
      method: 'POST',
      body: JSON.stringify({ themeId, rating, comment }),
    });
  };
  
  return (
    <form onSubmit={submitReview}>
      <StarRating value={rating} onChange={setRating} />
      <Textarea value={comment} onChange={(e) => setComment(e.target.value)} />
      <Button type="submit">Submit Review</Button>
    </form>
  );
}
```

---

## 🎨 Theme Development Workflow

### **Creating a New Theme**

1. **Define Theme Config**
```typescript
// packages/theme-engine/themes/store/minimalist-pro/config.ts
import { ThemeConfig } from '@letbuyy/theme-engine';

export const config: ThemeConfig = {
  id: 'minimalist-pro',
  name: 'Minimalist Pro',
  category: 'store',
  
  colors: {
    primary: '#000000',
    secondary: '#ffffff',
    accent: '#666666',
  },
  
  fonts: {
    heading: 'Inter',
    body: 'Inter',
  },
  
  sections: {
    header: { enabled: true, style: 'minimal' },
    hero: { enabled: true, layout: 'centered' },
    products: { enabled: true, columns: 3 },
    footer: { enabled: true, columns: 3 },
  },
  
  customizable: {
    colors: true,
    fonts: true,
    layouts: ['header', 'hero'],
  },
};
```

2. **Build Theme Components**
```tsx
// packages/theme-engine/themes/store/minimalist-pro/index.tsx
import { ThemeProps } from '@letbuyy/theme-engine';
import { config } from './config';

export default function MinimalistPro({ data, customizations }: ThemeProps) {
  const finalConfig = applyCustomizations(config, customizations);
  
  return (
    <div className="theme-minimalist-pro">
      <Header config={finalConfig.sections.header} store={data} />
      <Hero config={finalConfig.sections.hero} store={data} />
      <ProductGrid config={finalConfig.sections.products} products={data.products} />
      <Footer config={finalConfig.sections.footer} store={data} />
    </div>
  );
}
```

3. **Register in Theme Registry**
```typescript
// packages/theme-engine/src/registry.ts
import MinimalistPro from './themes/store/minimalist-pro';

export const THEME_REGISTRY = {
  // ... existing themes
  'minimalist-pro': MinimalistPro,
};
```

4. **Create Database Entry**
```sql
INSERT INTO themes (
  slug,
  name,
  description,
  category,
  theme_preset_id,
  pricing_type,
  price_usd,
  features,
  demo_store_config
) VALUES (
  'minimalist-pro',
  'Minimalist Pro',
  'Clean, minimal store theme for modern brands',
  'store',
  'minimalist-pro',
  'one_time',
  49.00,
  ARRAY['Responsive design', 'SEO optimized', 'Fast loading'],
  '{"name":"Demo Store","products":[...]}'::jsonb
);
```

---

## 🚢 Deployment Strategy

### **Vercel Deployment**
```json
// vercel.json
{
  "buildCommand": "turbo run build",
  "devCommand": "turbo run dev",
  "installCommand": "pnpm install",
  "framework": null,
  "outputDirectory": "apps/theme-marketplace/.next",
  "env": {
    "NEXT_PUBLIC_SUPABASE_URL": "@supabase-url",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY": "@supabase-anon-key",
    "STRIPE_SECRET_KEY": "@stripe-secret",
    "STRIPE_WEBHOOK_SECRET": "@stripe-webhook"
  },
  "builds": [
    {
      "src": "apps/theme-marketplace/package.json",
      "use": "@vercel/next"
    },
    {
      "src": "apps/storefront/package.json",
      "use": "@vercel/next"
    }
  ],
  "routes": [
    {
      "src": "^themes\\.letbuyy\\.store/(.*)$",
      "dest": "apps/theme-marketplace/$1"
    },
    {
      "src": "^(.+)\\.letbuyy\\.store/(.*)$",
      "dest": "apps/storefront/$2"
    }
  ]
}
```

### **CI/CD Pipeline**
```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - uses: pnpm/action-setup@v2
        with:
          version: 8
      
      - uses: actions/setup-node@v3
        with:
          node-version: 20
          cache: 'pnpm'
      
      - run: pnpm install
      - run: pnpm turbo run build
      - run: pnpm turbo run test
      
      - name: Deploy to Vercel
        run: vercel deploy --prod --token=${{ secrets.VERCEL_TOKEN }}
```

---

## 💡 Additional Ideas & Enhancements

### **1. Theme Categories & Collections**
- **Seasonal Collections:** "Summer Sale Themes", "Holiday Themes"
- **Industry-Specific:** "Restaurant Themes", "Fitness Themes", "SaaS Themes"
- **Featured by LetBuyy:** Curated top-quality themes

### **2. Theme Bundles**
```sql
CREATE TABLE theme_bundles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    theme_ids UUID[] NOT NULL,
    bundle_price_usd DECIMAL(10,2),
    discount_percentage INT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### **3. White Label / Reseller Program**
Allow agencies to rebrand and resell themes:
```typescript
interface WhiteLabelConfig {
  agencyId: string;
  branding: {
    logo: string;
    colors: Record<string, string>;
    domain: string; // themes.agency-name.com
  };
  commission: number; // 30% of sales
}
```

### **4. Theme Marketplace API**
Allow developers to programmatically access themes:
```typescript
// GET /api/v1/themes
// POST /api/v1/themes/{id}/install
// GET /api/v1/user/themes
```

### **5. Smart Theme Recommendations**
```typescript
export async function recommendThemes(storeData: Store): Promise<Theme[]> {
  // Analyze store industry, products, traffic
  const recommendations = await ml.predict({
    industry: storeData.industry,
    productCount: storeData.products.length,
    averagePrice: storeData.avgProductPrice,
  });
  
  return recommendations;
}
```

### **6. Theme Performance Scoring**
```typescript
interface ThemeScore {
  lighthouse: {
    performance: number;
    accessibility: number;
    seo: number;
    bestPractices: number;
  };
  conversion: {
    addToCartRate: number;
    checkoutCompletionRate: number;
  };
  userEngagement: {
    avgSessionDuration: number;
    bounceRate: number;
  };
}
```

### **7. Community Features**
- **Theme Showcase:** Users submit their stores using a theme
- **Theme Requests:** Upvote themes you want built
- **Theme Modifications:** Hire a developer to customize

### **8. Subscription Model**
```sql
CREATE TABLE theme_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    plan TEXT CHECK (plan IN ('starter','pro','unlimited')),
    themes_included INT, -- NULL for unlimited
    price_monthly DECIMAL(10,2),
    status TEXT DEFAULT 'active',
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ
);
```

### **9. Version Control & Rollback**
```typescript
export async function rollbackTheme(
  storeId: string,
  targetVersion: string
): Promise<void> {
  const previousConfig = await getThemeVersion(storeId, targetVersion);
  await applyThemeConfig(storeId, previousConfig);
}
```

### **10. Theme Builder (Visual Editor)**
Future app for drag-and-drop theme creation:
```
apps/theme-builder/
├── components/
│   ├── canvas/           # Visual editing canvas
│   ├── sidebar/          # Component library
│   └── inspector/        # Property inspector
```

---

## 📊 Success Metrics

### **KPIs to Track**
1. **Marketplace Health:**
   - Total themes available
   - Average theme rating
   - Theme purchase conversion rate
   - Preview-to-purchase rate

2. **Revenue:**
   - Monthly recurring revenue (MRR)
   - Average revenue per user (ARPU)
   - Theme sales by category

3. **User Engagement:**
   - Active theme installations
   - Theme changes per store
   - Customization feature usage

4. **Performance:**
   - Theme load time (< 2s)
   - Lighthouse scores (> 90)
   - Preview render time (< 1s)

---

## ⚡ Quick Start Guide

```bash
# 1. Clone and setup
git clone https://github.com/letbuyy/monorepo.git
cd letbuyy-monorepo
pnpm install

# 2. Setup environment
cp .env.example .env.local
# Add Supabase, Stripe keys

# 3. Setup database
pnpm db:push

# 4. Seed themes
pnpm db:seed

# 5. Start dev server
pnpm dev

# Access:
# - Theme Marketplace: http://themes.localhost:3000
# - Demo Store: http://demo.localhost:3000
```

---

## 🎯 Final Thoughts

Your theme marketplace design is **solid**, but here's what makes this roadmap **next-level:**

✅ **Monorepo Architecture** - Better code sharing, type safety  
✅ **Theme Engine Package** - Centralized rendering logic  
✅ **Instant Application** - No file uploads, just DB toggles  
✅ **Live Previews** - Real working demos before purchase  
✅ **Customization Options** - Without code knowledge  
✅ **Modern Stack** - Next.js 15, Supabase, Stripe  
✅ **Scalable** - Handles 1000s of themes + stores  

---

**Next Steps:**
1. Set up monorepo structure (Day 1-2)
2. Build theme engine core (Day 3-5)
3. Create marketplace UI (Week 2)
4. Implement purchase flow (Week 3)
5. Launch with 5-10 themes (Week 4)
6. Iterate based on feedback

Let me know which phase you want to dive into first! 🚀