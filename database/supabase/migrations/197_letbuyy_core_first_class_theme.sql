-- 197 — Make `letbuyy-core` a real, first-class, self-sufficient theme row on every database.
--
-- WHAT / WHY.
-- `letbuyy-core` is the canonical first-party theme slug (LETBUYY_CORE_THEME_SLUG,
-- packages/theme-engine/src/theme-bundle-core.ts:31), but no database has the row. Migration 188 tried to
-- create it with `INSERT ... SELECT ... FROM public.themes WHERE slug = 'urban-kicks'`, and on a fresh
-- database that source row does not exist yet — it is created by database/supabase/seeds/urban-kicks-theme.sql,
-- which runs AFTER all migrations. The SELECT yields zero rows, nothing is inserted, and 188's own header
-- admits it assumes somebody re-runs it later. Nothing does. Replaying every migration from zero and then
-- applying the seeds leaves `select slug from themes` returning only 'urban-kicks'.
-- 188 had a second defect wherever it DID run: it cloned urban-kicks overriding only id/name/slug, so the
-- row carried Urban Kicks branding in default_template/config and copied no renderer_manifest,
-- settings_schema completion, schema_version or renderer_version.
--
-- This migration therefore writes the row LITERALLY. It never reads public.themes to build the payload, so
-- it is correct on a fresh database, on a seeded database, and on an already-migrated one. Where 188 already
-- left a clone behind, the guarded repair below replaces only the values that are provably 188 artifacts.
--
-- The payload is not invented — every value is taken from what the engine already declares:
--   * section types + settings keys      — SECTION_SCHEMAS / BUILT_IN_SECTION_SCHEMAS and the canonical
--                                          default produced by getDefaultStorefrontThemeTemplate()
--                                          (packages/theme-engine/src/theme-registry.ts:574).
--   * brand palette + fonts              — the authored Core bundle's own declared settings
--                                          (packages/theme-engine/examples/letbuyy-core-liquid/files/config/
--                                          settings_data.json), completed for the fields it does not declare
--                                          from DEFAULT_THEME_SETTINGS and the engine default template.
--   * settings_schema appearance group   — the exact 13 fields the 180 -> 181 -> 193 chain declares for the
--                                          sibling first-party theme, so the two cannot drift. Any field-type
--                                          change (text -> color) must move both themes together.
--   * renderer_manifest / schema_version / renderer_version — the shapes and values migration 188 skipped
--                                          and database/supabase/seeds/urban-kicks-theme.sql establishes.
-- verification/055_only_urban_kicks_theme_catalog.sql is the repository's definition of a valid ACTIVE theme
-- row: slug, name, category, theme_preset_id, supported_site_types, supported_platforms all non-empty and
-- default_template, settings_schema, renderer_manifest all non-'{}'. This row satisfies every one of them.
--
-- section_schemas and block_schemas are DELIBERATELY left at the engine default '{}'. THEME-R3 makes the
-- engine BUILT_IN_SECTION_SCHEMAS the single schema source, and a DB copy is merged AFTER the built-ins
-- (`{ ...BUILT_IN_SECTION_SCHEMAS, ...input.runtime.sectionSchemas }`, packages/theme-engine/src/index.ts),
-- so it OVERRIDES them. The lossy `{ "header": { "type": "header", "name": "Header" } }` shape the urban-kicks
-- seed writes has no settings_schema, which makes validateThemeSectionSettings() reject every real section
-- setting. Leaving these empty makes legacyRuntime() fall back to getSectionSchemas(), i.e. the engine
-- registry, which is both correct and the single source THEME-R3 requires.
--
-- LIQUID DECISION — DELIBERATE, CONSERVATIVE.
-- default_template.rendererEngine is NOT set to 'liquid'. resolveThemeLiquidRenderingEnabled()
-- (packages/theme-engine/src/theme-governance.ts:154-160) returns true on that key alone, bypassing
-- THEME_LIQUID_RENDERING_DEFAULT_ENABLED, so setting it here would silently flip every store that installs
-- the canonical theme onto the Liquid renderer. ART-17 keeps Liquid a per-theme CANARY gated on a
-- render-parity, SSTI/XSS and performance harness that is not wired, and
-- THEME_LIQUID_PLATFORM_WIDE_FLIP_DECISION records the platform-wide flip as ARB-deferred. Materializing the
-- canonical row and flipping the renderer are two separate decisions; this migration only does the first, so
-- the row renders through the same frozen React fast path every store uses today. Attaching the Liquid bundle
-- to this theme stays a later, canary-scoped change.
--
-- ADDITIVE + IDEMPOTENT: the INSERT is ON CONFLICT (slug) DO NOTHING and the repair is guarded on the 188
-- clone signature, so re-running is a no-op. No money, identity, auth, session or RLS surface is touched —
-- only the public.themes catalog row. No table, column, index, policy, trigger or row is dropped, and no
-- existing row other than a proven 188 clone of this one slug is modified. NO DATA IS DELETED.

DO $$
DECLARE
    -- The 13 appearance fields the theme editor always sends (DEFAULT_THEME_SETTINGS + bodyFontFamily),
    -- declared exactly as migrations 180, 181 and 193 declare them for the sibling first-party theme.
    core_settings_schema jsonb := jsonb_build_object(
        'schema_version', '1.0',
        'settings', jsonb_build_object(
            'appearance', jsonb_build_object(
                'label', 'Appearance',
                'fields', jsonb_build_object(
                    'primaryColor',      jsonb_build_object('type', 'text',   'label', 'Primary color'),
                    'secondaryColor',    jsonb_build_object('type', 'text',   'label', 'Secondary color'),
                    'accentColor',       jsonb_build_object('type', 'text',   'label', 'Accent color'),
                    'backgroundColor',   jsonb_build_object('type', 'text',   'label', 'Background'),
                    'textColor',         jsonb_build_object('type', 'text',   'label', 'Text'),
                    'surfaceColor',      jsonb_build_object('type', 'text',   'label', 'Surface'),
                    'isDark',            jsonb_build_object('type', 'toggle', 'label', 'Dark mode'),
                    'fontFamily',        jsonb_build_object('type', 'text',   'label', 'Body font'),
                    'bodyFontFamily',    jsonb_build_object('type', 'text',   'label', 'Body font family'),
                    'headingFontFamily', jsonb_build_object('type', 'text',   'label', 'Heading font'),
                    'borderRadius',      jsonb_build_object('type', 'number', 'label', 'Corner radius'),
                    'enableShadows',     jsonb_build_object('type', 'toggle', 'label', 'Shadows'),
                    'enableAnimations',  jsonb_build_object('type', 'toggle', 'label', 'Animations')
                )
            )
        )
    );

    core_theme_settings jsonb := jsonb_build_object(
        'primaryColor',      '#8B5CF6',
        'secondaryColor',    '#3B82F6',
        'accentColor',       '#F59E0B',
        'backgroundColor',   '#FFFFFF',
        'textColor',         '#1F2937',
        'surfaceColor',      '#F8FAFC',
        'isDark',            false,
        'fontFamily',        'Inter',
        'bodyFontFamily',    'Inter',
        'headingFontFamily', 'Inter',
        'borderRadius',      12,
        'enableShadows',     true,
        'enableAnimations',  true
    );

    -- storeName and copyrightText stay empty on purpose: the storefront falls back to the merchant's own
    -- site name, which is exactly the leak that made the urban-kicks row ship 'Urban Kicks' into every store.
    core_default_template jsonb := jsonb_build_object(
        'themeId', 'letbuyy-core',
        'themeSettings', core_theme_settings,
        'sections', jsonb_build_object(
            'header', jsonb_build_object(
                'id', 'header', 'type', 'header', 'order', 0, 'visible', true,
                'settings', jsonb_build_object(
                    'behavior', 'sticky',
                    'storeName', '',
                    'logoUrl', '',
                    'logoPlacement', 'left',
                    'displayMode', 'name',
                    'navPlacement', 'right',
                    'showSearch', true,
                    'showCart', true,
                    'showAccount', true
                )
            ),
            'template', jsonb_build_array(
                jsonb_build_object(
                    'id', 'announcement-default', 'type', 'announcementBar', 'order', 5, 'visible', true,
                    'settings', jsonb_build_object(
                        'text', 'Free shipping on fresh drops this week.',
                        'linkLabel', 'Shop now',
                        'linkHref', '/products',
                        'alignment', 'center',
                        'backgroundColor', '#0F172A',
                        'textColor', '#FFFFFF',
                        'visibleOnMobile', true
                    )
                ),
                jsonb_build_object(
                    'id', 'hero-default', 'type', 'heroBanner', 'order', 10, 'visible', true,
                    'settings', jsonb_build_object(
                        'heading', 'New Season Essentials',
                        'subheading', 'Fresh drops, everyday staples, and limited pieces curated for your store.',
                        'ctaText', 'Shop Now',
                        'ctaLink', '#products',
                        'image', '',
                        'overlay', 0.4,
                        'height', 'large',
                        'textAlign', 'left'
                    )
                ),
                jsonb_build_object(
                    'id', 'category-grid-default', 'type', 'categoryGrid', 'order', 20, 'visible', true,
                    'settings', jsonb_build_object(
                        'title', 'Shop by style',
                        'subtitle', 'Launch-ready groupings for daily buyers.',
                        'columns', 3,
                        'cardStyle', 'overlay'
                    ),
                    'blocks', jsonb_build_array(
                        jsonb_build_object('id', 'category-sneakers', 'type', 'category', 'order', 0, 'visible', true,
                            'settings', jsonb_build_object('name', 'Sneakers', 'slug', 'sneakers', 'tagline', 'Fresh pairs')),
                        jsonb_build_object('id', 'category-apparel', 'type', 'category', 'order', 1, 'visible', true,
                            'settings', jsonb_build_object('name', 'Apparel', 'slug', 'apparel', 'tagline', 'Daily fits')),
                        jsonb_build_object('id', 'category-accessories', 'type', 'category', 'order', 2, 'visible', true,
                            'settings', jsonb_build_object('name', 'Accessories', 'slug', 'accessories', 'tagline', 'Finish the look'))
                    )
                ),
                jsonb_build_object(
                    'id', 'featured-collection-default', 'type', 'featuredProducts', 'order', 30, 'visible', true,
                    'settings', jsonb_build_object(
                        'title', 'Drop-ready collection',
                        'subtitle', 'Curated items for the first storefront launch.',
                        'collectionHandle', 'new-arrivals',
                        'limit', 4,
                        'columns', 4,
                        'showViewAll', true,
                        'viewAllLabel', 'View collection',
                        'productCardStyle', 'editorial'
                    )
                ),
                jsonb_build_object(
                    'id', 'product-grid-default', 'type', 'productGrid', 'order', 40, 'visible', true,
                    'settings', jsonb_build_object(
                        'title', 'Featured Products',
                        'subtitle', 'Products selected from your catalog',
                        'columns', 4,
                        'columnsTablet', 3,
                        'columnsMobile', 2,
                        'rows', 2,
                        'showTitle', true,
                        'showPrice', true,
                        'showRating', true,
                        'showAddToCart', true,
                        'cardStyle', 'minimal',
                        'sortBy', 'newest'
                    )
                ),
                -- newsletter.backgroundColor is intentionally absent: the engine default for that key is the
                -- string 'transparent', which validateThemeFieldValue() rejects for a 'color' field because it
                -- is neither hex nor rgb(). Omitting it keeps the row schema-valid and lets the section use
                -- its own render-time default.
                jsonb_build_object(
                    'id', 'newsletter-default', 'type', 'newsletter', 'order', 50, 'visible', true,
                    'settings', jsonb_build_object(
                        'title', 'Stay in the Loop',
                        'subtitle', 'Get early access to new drops and exclusive discounts.',
                        'buttonText', 'Subscribe',
                        'placeholder', 'Enter your email',
                        'successMessage', 'Thanks for subscribing!'
                    )
                )
            ),
            'footer', jsonb_build_object(
                'id', 'footer', 'type', 'footer', 'order', 100, 'visible', true,
                'settings', jsonb_build_object(
                    'columns', 3,
                    'showLogo', true,
                    'showNewsletter', true,
                    'showSocial', true,
                    'showPaymentIcons', true,
                    'copyrightText', '',
                    'instagramUrl', '',
                    'twitterUrl', '',
                    'contactEmail', 'help@letbuyy.com'
                )
            )
        )
    );

    -- Mirrors the themes.config column shape. getDefaultStorefrontThemeTemplate() reads colors/fonts from
    -- here when a store has no renderable template, so the code fallback resolves the same palette as the row.
    core_config jsonb := jsonb_build_object(
        'colors', jsonb_build_object(
            'primary', '#8B5CF6',
            'secondary', '#3B82F6',
            'accent', '#F59E0B',
            'background', '#FFFFFF',
            'text', '#1F2937'
        ),
        'fonts', jsonb_build_object('body', 'Inter', 'heading', 'Inter'),
        'layout', jsonb_build_object('maxWidth', 1280, 'headerStyle', 'sticky', 'footerStyle', 'standard'),
        'darkMode', false
    );

    core_renderer_manifest jsonb := jsonb_build_object(
        'engine', 'theme-engine-v1',
        'sections', jsonb_build_array(
            'header', 'announcementBar', 'heroBanner', 'categoryGrid',
            'featuredProducts', 'productGrid', 'newsletter', 'footer'
        )
    );

    core_description text :=
        'First-party LetBuyy Core storefront theme — the canonical LetBuyy commerce experience with header, announcement bar, hero, category grid, featured collection, product grid, and newsletter sections.';
    core_long_description text :=
        'LetBuyy Core is the canonical first-party LetBuyy storefront theme. Marketplace metrics stay honest at zero until real installs, purchases, and reviews exist.';

    migration_id constant text := '197_letbuyy_core_first_class_theme';

    inserted_rows integer;
    repaired_rows integer;
BEGIN
    INSERT INTO public.themes (
        name, slug, site_type, category,
        description, long_description,
        thumbnail_url,
        author, author_handle, author_url, author_verified,
        version, is_active, is_premium, price, sort_order,
        theme_preset_id, letbuyy_pricing_type, letbuyy_price_usd, letbuyy_price_inr,
        supported_site_types, supported_platforms, features, tags,
        config, default_template, settings_schema, renderer_manifest,
        schema_version, renderer_version, updated_at
    )
    VALUES (
        'LetBuyy Core', 'letbuyy-core', 'store', 'store',
        core_description, core_long_description,
        '/previews/store.png',
        'LetBuyy', 'letbuyy-labs', '/authors/letbuyy-labs', true,
        '1.0.0', true, false, 0, 0,
        'letbuyy-core-default', 'free', 0, 0,
        ARRAY['store']::text[], ARRAY['letbuyy']::text[],
        ARRAY['Announcement bar', 'Hero banner', 'Category grid', 'Featured collection', 'Product grid', 'Newsletter']::text[],
        ARRAY['first-party', 'commerce', 'core']::text[],
        core_config, core_default_template, core_settings_schema,
        core_renderer_manifest || jsonb_build_object(
            'provenance', jsonb_build_object('migration', migration_id, 'mode', 'insert')
        ),
        '1.0.0', '1.0.0', NOW()
    )
    ON CONFLICT (slug) DO NOTHING;

    GET DIAGNOSTICS inserted_rows = ROW_COUNT;
    IF inserted_rows = 1 THEN
        RETURN;
    END IF;

    -- The row already exists. Repair only what migration 188's urban-kicks clone provably got wrong, and only
    -- while the row is still first-party (owned_by_site_id IS NULL) — never overwrite a merchant-owned or
    -- marketplace-uploaded letbuyy-core row. A row whose default_template already identifies as letbuyy-core
    -- and carries no Urban Kicks branding is left completely untouched, which also makes a re-run a no-op.
    UPDATE public.themes
    SET name = 'LetBuyy Core',
        description = core_description,
        long_description = core_long_description,
        default_template = core_default_template,
        config = core_config,
        renderer_manifest = CASE
            WHEN renderer_manifest = '{}'::jsonb THEN core_renderer_manifest
            ELSE renderer_manifest
        END || jsonb_build_object(
            'provenance', jsonb_build_object('migration', migration_id, 'mode', 'repair')
        ),
        -- Additive field merge: canonical declarations fill the gaps, anything already declared wins, so a
        -- marketplace-extended schema keeps its own fields.
        settings_schema = jsonb_build_object('schema_version', '1.0') || jsonb_set(
            jsonb_set(
                COALESCE(settings_schema, '{}'::jsonb),
                '{settings,appearance}',
                COALESCE(settings_schema #> '{settings,appearance}', jsonb_build_object('label', 'Appearance')),
                true
            ),
            '{settings,appearance,fields}',
            (core_settings_schema #> '{settings,appearance,fields}')
                || COALESCE(settings_schema #> '{settings,appearance,fields}', '{}'::jsonb),
            true
        ),
        category = COALESCE(NULLIF(category, ''), 'store'),
        theme_preset_id = COALESCE(NULLIF(theme_preset_id, ''), 'letbuyy-core-default'),
        thumbnail_url = COALESCE(NULLIF(thumbnail_url, ''), '/previews/store.png'),
        supported_site_types = CASE
            WHEN COALESCE(array_length(supported_site_types, 1), 0) = 0 THEN ARRAY['store']::text[]
            ELSE supported_site_types
        END,
        supported_platforms = CASE
            WHEN COALESCE(array_length(supported_platforms, 1), 0) = 0 THEN ARRAY['letbuyy']::text[]
            ELSE supported_platforms
        END,
        updated_at = NOW()
    WHERE slug = 'letbuyy-core'
      AND owned_by_site_id IS NULL
      AND (
          default_template->>'themeId' IS DISTINCT FROM 'letbuyy-core'
          OR default_template::text LIKE '%Urban Kicks%'
          OR config::text LIKE '%Urban Kicks%'
      );

    GET DIAGNOSTICS repaired_rows = ROW_COUNT;
    IF repaired_rows = 0 THEN
        RAISE NOTICE 'letbuyy-core already exists as a first-class row; migration 197 made no change.';
    END IF;
END $$;
