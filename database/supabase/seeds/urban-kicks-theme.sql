-- ============================================================================
-- Urban Kicks production theme seed
-- Applies section definitions, block definitions, renderer/schema manifests,
-- templates, and the default preset for theme package version 1.0.0.
-- ============================================================================

INSERT INTO theme_packages (
    slug,
    name,
    description,
    author_name,
    site_types,
    status,
    pricing_type,
    price,
    currency,
    marketplace_metadata,
    updated_at
)
VALUES (
    'urban-kicks',
    'Urban Kicks',
    'First-party sneaker and streetwear storefront theme used as the canonical LetBuyy commerce sample.',
    'LetBuyy',
    ARRAY['store']::text[],
    'active',
    'free',
    0,
    'INR',
    jsonb_build_object('source', 'database/supabase/seeds/urban-kicks-theme.sql', 'sample', true),
    NOW()
)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    author_name = EXCLUDED.author_name,
    site_types = EXCLUDED.site_types,
    status = EXCLUDED.status,
    pricing_type = EXCLUDED.pricing_type,
    price = EXCLUDED.price,
    currency = EXCLUDED.currency,
    marketplace_metadata = EXCLUDED.marketplace_metadata,
    deleted_at = NULL,
    updated_at = NOW();

WITH urban_package AS (
    SELECT id AS theme_package_id
      FROM theme_packages
     WHERE slug = 'urban-kicks'
     LIMIT 1
)
INSERT INTO theme_package_versions (
    theme_package_id,
    version,
    version_number,
    release_status,
    renderer_version,
    schema_version,
    compatibility_range,
    package_manifest,
    checksum,
    published_at,
    updated_at,
    deleted_at
)
SELECT
    theme_package_id,
    '1.0.0',
    1,
    'published',
    '1.0.0',
    '1.0.0',
    '>=1.0.0',
    jsonb_build_object('themeSlug', 'urban-kicks', 'source', 'database/supabase/seeds/urban-kicks-theme.sql'),
    'urban-kicks-local-seed',
    NOW(),
    NOW(),
    NULL
FROM urban_package
ON CONFLICT (theme_package_id, version) DO UPDATE SET
    version_number = EXCLUDED.version_number,
    release_status = EXCLUDED.release_status,
    renderer_version = EXCLUDED.renderer_version,
    schema_version = EXCLUDED.schema_version,
    compatibility_range = EXCLUDED.compatibility_range,
    package_manifest = EXCLUDED.package_manifest,
    checksum = EXCLUDED.checksum,
    published_at = COALESCE(theme_package_versions.published_at, EXCLUDED.published_at),
    deleted_at = NULL,
    updated_at = NOW();

INSERT INTO public.developer_profiles (
    handle,
    display_name,
    bio,
    support_email,
    website_url,
    verification_status,
    support_sla,
    metadata
)
VALUES (
    'letbuyy-labs',
    'LetBuyy Labs',
    'First-party commerce theme author used to prove multi-author marketplace catalog, author profile, and review aggregation behavior.',
    'support@letbuyy.com',
    '/authors/letbuyy-labs',
    'verified',
    'Local/staging support through the LetBuyy support desk',
    '{"program_terms":"local_15_percent_revenue_share"}'::jsonb
)
ON CONFLICT (handle) DO UPDATE
   SET display_name = EXCLUDED.display_name,
       bio = EXCLUDED.bio,
       support_email = EXCLUDED.support_email,
       website_url = EXCLUDED.website_url,
       verification_status = EXCLUDED.verification_status,
       support_sla = EXCLUDED.support_sla,
       metadata = EXCLUDED.metadata,
       updated_at = NOW();

INSERT INTO themes (
    slug,
    name,
    site_type,
    category,
    description,
    long_description,
    preview_url,
    thumbnail_url,
    is_premium,
    price,
    author,
    author_handle,
    version,
    is_active,
    sort_order,
    install_count,
    review_count,
    rating_avg,
    industry,
    theme_preset_id,
    letbuyy_pricing_type,
    letbuyy_price_usd,
    letbuyy_price_inr,
    screenshots,
    demo_url,
    color_presets,
    font_pairings,
    features,
    supported_site_types,
    supported_platforms,
    tags,
    author_url,
    author_verified,
    performance_report,
    accessibility_report,
    default_template,
    section_schemas,
    block_schemas,
    settings_schema,
    renderer_manifest,
    schema_version,
    renderer_version,
    updated_at
)
VALUES (
    'urban-kicks',
    'Urban Kicks',
    'store',
    'store',
    'First-party sneaker and streetwear storefront theme with product storytelling, category navigation, and trust sections.',
    'Urban Kicks is the canonical LetBuyy commerce sample theme. The seed keeps marketplace metrics honest at zero until real installs, purchases, and reviews exist.',
    '/previews/urban-kicks-detail.png',
    '/previews/urban-kicks-card.png',
    false,
    0,
    'LetBuyy Labs',
    'letbuyy-labs',
    '1.0.0',
    true,
    1,
    0,
    0,
    0,
    ARRAY['fashion', 'footwear', 'streetwear']::text[],
    'urban-kicks-default',
    'free',
    0,
    0,
    ARRAY['/previews/urban-kicks-detail.png', '/previews/urban-kicks-card.png'],
    '/preview/urban-kicks?theme=urban-kicks',
    jsonb_build_array(jsonb_build_object('name', 'Urban', 'colors', jsonb_build_object('primary', '#8B5CF6', 'accent', '#F59E0B', 'background', '#FFFFFF'))),
    jsonb_build_array(jsonb_build_object('heading', 'Inter', 'body', 'Inter')),
    ARRAY['Product storytelling', 'Category grid', 'Trust badges', 'Newsletter'],
    ARRAY['store']::text[],
    ARRAY['letbuyy', 'html', 'react']::text[],
    ARRAY['sneakers', 'streetwear', 'retail']::text[],
    '/authors/letbuyy-labs',
    true,
    jsonb_build_object('source', 'lhci-and-axe-local-ga', 'status', 'measured', 'measured', true, 'measured_at', '2026-06-07T22:25:00.000Z', 'lighthouse_performance', 63, 'first_contentful_paint_ms', 1400, 'largest_contentful_paint_ms', 8000, 'cumulative_layout_shift', 0.06),
    jsonb_build_object('source', 'lhci-and-axe-local-ga', 'status', 'measured', 'measured', true, 'measured_at', '2026-06-07T22:25:00.000Z', 'lighthouse_accessibility', 100, 'serious_violations', 0, 'critical_violations', 0, 'axe_checked', true),
    jsonb_build_object(
        'themeId', 'urban-kicks',
        'themeSettings', jsonb_build_object('primaryColor', '#8B5CF6', 'secondaryColor', '#3B82F6', 'accentColor', '#F59E0B', 'backgroundColor', '#FFFFFF', 'textColor', '#1F2937', 'fontFamily', 'Inter', 'headingFontFamily', 'Inter', 'borderRadius', 12, 'enableAnimations', true, 'enableShadows', true),
        'sections', jsonb_build_object(
            'header', jsonb_build_object('type', 'header', 'settings', jsonb_build_object('storeName', 'Urban Kicks', 'showSearch', true, 'showCart', true)),
            'template', jsonb_build_array(
                jsonb_build_object('id', 'hero-1', 'type', 'heroBanner', 'settings', jsonb_build_object('heading', 'Urban Kicks', 'subtitle', 'Streetwear storefront sample'), 'isVisible', true),
                jsonb_build_object('id', 'categories-1', 'type', 'categoryGrid', 'settings', jsonb_build_object('title', 'Shop by category'), 'isVisible', true),
                jsonb_build_object('id', 'products-1', 'type', 'productGrid', 'settings', jsonb_build_object('title', 'Featured drops'), 'isVisible', true),
                jsonb_build_object('id', 'trust-1', 'type', 'trustBadges', 'settings', jsonb_build_object('title', 'Built for confident checkout'), 'isVisible', true)
            ),
            'footer', jsonb_build_object('type', 'footer', 'settings', jsonb_build_object('copyrightText', 'Urban Kicks'))
        )
    ),
    jsonb_build_object(
        'header', jsonb_build_object('type', 'header', 'name', 'Header'),
        'heroBanner', jsonb_build_object('type', 'heroBanner', 'name', 'Hero banner'),
        'categoryGrid', jsonb_build_object('type', 'categoryGrid', 'name', 'Category grid'),
        'productGrid', jsonb_build_object('type', 'productGrid', 'name', 'Product grid'),
        'trustBadges', jsonb_build_object('type', 'trustBadges', 'name', 'Trust badges'),
        'footer', jsonb_build_object('type', 'footer', 'name', 'Footer')
    ),
    jsonb_build_object(
        'category', jsonb_build_object('name', 'Category card'),
        'badge', jsonb_build_object('name', 'Trust badge')
    ),
    jsonb_build_object('settings', jsonb_build_object('colors', jsonb_build_object('label', 'Colors'))),
    jsonb_build_object('engine', 'theme-engine-v1', 'sections', ARRAY['header', 'heroBanner', 'categoryGrid', 'productGrid', 'trustBadges', 'footer'], 'sample', true),
    '1.0.0',
    '1.0.0',
    NOW()
)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    site_type = EXCLUDED.site_type,
    category = EXCLUDED.category,
    description = EXCLUDED.description,
    long_description = EXCLUDED.long_description,
    preview_url = EXCLUDED.preview_url,
    thumbnail_url = EXCLUDED.thumbnail_url,
    is_premium = EXCLUDED.is_premium,
       price = EXCLUDED.price,
       author = EXCLUDED.author,
       author_handle = EXCLUDED.author_handle,
       version = EXCLUDED.version,
    is_active = EXCLUDED.is_active,
    sort_order = EXCLUDED.sort_order,
    industry = EXCLUDED.industry,
    theme_preset_id = EXCLUDED.theme_preset_id,
    letbuyy_pricing_type = EXCLUDED.letbuyy_pricing_type,
    letbuyy_price_usd = EXCLUDED.letbuyy_price_usd,
    letbuyy_price_inr = EXCLUDED.letbuyy_price_inr,
    screenshots = EXCLUDED.screenshots,
    demo_url = EXCLUDED.demo_url,
    color_presets = EXCLUDED.color_presets,
    font_pairings = EXCLUDED.font_pairings,
    features = EXCLUDED.features,
    supported_site_types = EXCLUDED.supported_site_types,
    supported_platforms = EXCLUDED.supported_platforms,
    tags = EXCLUDED.tags,
    author_url = EXCLUDED.author_url,
    author_verified = EXCLUDED.author_verified,
    performance_report = EXCLUDED.performance_report,
    accessibility_report = EXCLUDED.accessibility_report,
    default_template = EXCLUDED.default_template,
    section_schemas = EXCLUDED.section_schemas,
    block_schemas = EXCLUDED.block_schemas,
    settings_schema = EXCLUDED.settings_schema,
    renderer_manifest = EXCLUDED.renderer_manifest,
    schema_version = EXCLUDED.schema_version,
    renderer_version = EXCLUDED.renderer_version,
    updated_at = NOW();

WITH urban_version AS (
    SELECT tpv.id AS theme_package_version_id
    FROM theme_packages tp
    JOIN theme_package_versions tpv ON tpv.theme_package_id = tp.id
    WHERE tp.slug = 'urban-kicks'
      AND tpv.version = '1.0.0'
    LIMIT 1
)
INSERT INTO theme_renderer_manifests (
    theme_package_version_id,
    renderer_manifest,
    approved_renderer_keys,
    asset_manifest,
    performance_budget,
    updated_at
)
SELECT
    theme_package_version_id,
    jsonb_build_object(
        'renderer', 'storefront-runtime',
        'themeSlug', 'urban-kicks',
        'version', '1.0.0',
        'sectionRendererMap', jsonb_build_object(
            'header', 'core.header',
            'footer', 'core.footer',
            'heroBanner', 'core.hero',
            'productGrid', 'core.product-grid',
            'productDetail', 'core.product-detail',
            'featuredProducts', 'core.featured-products',
            'testimonials', 'core.testimonials',
            'aboutSection', 'core.about',
            'newsletter', 'core.newsletter',
            'portfolioGrid', 'core.portfolio-grid',
            'skillsSection', 'core.skills',
            'experienceTimeline', 'core.experience-timeline',
            'contactForm', 'core.contact-form',
            'ctaSection', 'core.cta',
            'servicesGrid', 'core.services-grid',
            'contentPage', 'core.rich-content',
            'categoryGrid', 'commerce.category-grid',
            'brandMarquee', 'commerce.brand-marquee',
            'trustBadges', 'commerce.trust-badges'
        )
    ),
    ARRAY[
        'core.header',
        'core.footer',
        'core.hero',
        'core.product-grid',
        'core.product-detail',
        'core.featured-products',
        'core.testimonials',
        'core.about',
        'core.newsletter',
        'core.portfolio-grid',
        'core.skills',
        'core.experience-timeline',
        'core.contact-form',
        'core.cta',
        'core.services-grid',
        'core.rich-content',
        'commerce.category-grid',
        'commerce.brand-marquee',
        'commerce.trust-badges'
    ],
    jsonb_build_object(
        'thumbnail_url', '/previews/urban-kicks-card.png',
        'preview_url', '/preview/urban-kicks?theme=urban-kicks',
        'detail_preview_url', '/previews/urban-kicks-detail.png'
    ),
    jsonb_build_object(
        'lcpMs', 2500,
        'maxInitialJsKb', 180,
        'maxImageKb', 350
    ),
    NOW()
FROM urban_version
ON CONFLICT (theme_package_version_id) DO UPDATE SET
    renderer_manifest = EXCLUDED.renderer_manifest,
    approved_renderer_keys = EXCLUDED.approved_renderer_keys,
    asset_manifest = EXCLUDED.asset_manifest,
    performance_budget = EXCLUDED.performance_budget,
    updated_at = NOW();

WITH urban_version AS (
    SELECT tpv.id AS theme_package_version_id
    FROM theme_packages tp
    JOIN theme_package_versions tpv ON tpv.theme_package_id = tp.id
    WHERE tp.slug = 'urban-kicks'
      AND tpv.version = '1.0.0'
    LIMIT 1
)
INSERT INTO theme_schema_manifests (
    theme_package_version_id,
    manifest_version,
    schema_manifest,
    section_schemas,
    block_schemas,
    settings_schema,
    template_schema,
    layout_schema,
    validation_rules,
    updated_at
)
SELECT
    theme_package_version_id,
    '1.0.0',
    jsonb_build_object(
        'themeId', 'urban-kicks',
        'name', 'Urban Kicks',
        'version', '1.0.0',
        'schemaVersion', '1.0.0',
        'sections', jsonb_build_array(
            'header',
            'footer',
            'heroBanner',
            'productGrid',
            'productDetail',
            'featuredProducts',
            'testimonials',
            'aboutSection',
            'newsletter',
            'portfolioGrid',
            'skillsSection',
            'experienceTimeline',
            'contactForm',
            'ctaSection',
            'servicesGrid',
            'contentPage',
            'categoryGrid',
            'brandMarquee',
            'trustBadges'
        ),
        'blocks', jsonb_build_array(
            'navPage',
            'footerLink',
            'socialLink',
            'category',
            'brand',
            'badge',
            'testimonialCard',
            'contentBlock'
        )
    ),
    jsonb_build_object(
        'source', 'database/supabase/seeds/urban-kicks-theme.sql',
        'schemaAuthority', 'packages/theme-engine/src/theme-registry.ts'
    ),
    jsonb_build_object(
        'navPage', jsonb_build_object('name', 'Navigation Link'),
        'footerLink', jsonb_build_object('name', 'Footer Link'),
        'socialLink', jsonb_build_object('name', 'Social Link'),
        'category', jsonb_build_object('name', 'Category Card'),
        'brand', jsonb_build_object('name', 'Brand'),
        'badge', jsonb_build_object('name', 'Trust Badge'),
        'testimonialCard', jsonb_build_object('name', 'Testimonial Card'),
        'contentBlock', jsonb_build_object('name', 'Content Block')
    ),
    jsonb_build_object(
        'colors', jsonb_build_object(
            'primaryColor', jsonb_build_object('type', 'color', 'label', 'Primary Color', 'default', '#8B5CF6'),
            'secondaryColor', jsonb_build_object('type', 'color', 'label', 'Secondary Color', 'default', '#3B82F6'),
            'accentColor', jsonb_build_object('type', 'color', 'label', 'Accent Color', 'default', '#F59E0B'),
            'backgroundColor', jsonb_build_object('type', 'color', 'label', 'Background Color', 'default', '#FFFFFF'),
            'textColor', jsonb_build_object('type', 'color', 'label', 'Text Color', 'default', '#1F2937')
        ),
        'typography', jsonb_build_object(
            'fontFamily', jsonb_build_object('type', 'select', 'label', 'Body Font', 'default', 'Inter', 'options', jsonb_build_array('Inter', 'Outfit', 'Poppins', 'DM Sans', 'Space Grotesk')),
            'headingFontFamily', jsonb_build_object('type', 'select', 'label', 'Heading Font', 'default', 'Inter', 'options', jsonb_build_array('Inter', 'Outfit', 'Poppins', 'Space Grotesk', 'Montserrat'))
        ),
        'layout', jsonb_build_object(
            'borderRadius', jsonb_build_object('type', 'range', 'label', 'Border Radius', 'default', 12, 'min', 0, 'max', 24, 'step', 2),
            'enableAnimations', jsonb_build_object('type', 'toggle', 'label', 'Enable Animations', 'default', TRUE),
            'enableShadows', jsonb_build_object('type', 'toggle', 'label', 'Enable Shadows', 'default', TRUE)
        )
    ),
    jsonb_build_object(
        'layouts', jsonb_build_array('theme'),
        'templates', jsonb_build_array('index', 'product', 'collection', 'page', 'policy', 'cart', 'checkout', 'order_confirmation', 'search', 'customer_account', 'not_found')
    ),
    jsonb_build_object(
        'theme', jsonb_build_object('sectionGroups', jsonb_build_array('header', 'template', 'footer'))
    ),
    jsonb_build_object(
        'maxSectionsPerTemplate', 50,
        'requiredTemplateKeys', jsonb_build_array('index', 'product', 'collection', 'cart', 'checkout', 'order_confirmation')
    ),
    NOW()
FROM urban_version
ON CONFLICT (theme_package_version_id) DO UPDATE SET
    manifest_version = EXCLUDED.manifest_version,
    schema_manifest = EXCLUDED.schema_manifest,
    section_schemas = EXCLUDED.section_schemas,
    block_schemas = EXCLUDED.block_schemas,
    settings_schema = EXCLUDED.settings_schema,
    template_schema = EXCLUDED.template_schema,
    layout_schema = EXCLUDED.layout_schema,
    validation_rules = EXCLUDED.validation_rules,
    updated_at = NOW();

WITH urban_version AS (
    SELECT tpv.id AS theme_package_version_id
    FROM theme_packages tp
    JOIN theme_package_versions tpv ON tpv.theme_package_id = tp.id
    WHERE tp.slug = 'urban-kicks'
      AND tpv.version = '1.0.0'
    LIMIT 1
)
INSERT INTO theme_layouts (
    theme_package_version_id,
    layout_key,
    name,
    layout_schema,
    section_group_keys,
    metadata,
    updated_at,
    deleted_at
)
SELECT
    theme_package_version_id,
    'theme',
    'Urban Kicks Theme Layout',
    jsonb_build_object('type', 'theme', 'maxWidth', 1280),
    ARRAY['header', 'template', 'footer'],
    jsonb_build_object('source', 'urban-kicks-theme-seed'),
    NOW(),
    NULL
FROM urban_version
ON CONFLICT (theme_package_version_id, layout_key) DO UPDATE SET
    name = EXCLUDED.name,
    layout_schema = EXCLUDED.layout_schema,
    section_group_keys = EXCLUDED.section_group_keys,
    metadata = EXCLUDED.metadata,
    deleted_at = NULL,
    updated_at = NOW();

WITH urban_version AS (
    SELECT tpv.id AS theme_package_version_id
    FROM theme_packages tp
    JOIN theme_package_versions tpv ON tpv.theme_package_id = tp.id
    WHERE tp.slug = 'urban-kicks'
      AND tpv.version = '1.0.0'
    LIMIT 1
)
INSERT INTO theme_templates (
    theme_package_version_id,
    template_key,
    template_type,
    layout_key,
    template_schema,
    default_sections,
    metadata,
    updated_at,
    deleted_at
)
SELECT
    uv.theme_package_version_id,
    template_key,
    template_type,
    'theme',
    template_schema,
    default_sections,
    jsonb_build_object('source', 'urban-kicks-theme-seed'),
    NOW(),
    NULL
FROM urban_version uv
CROSS JOIN (
    VALUES
        ('index', 'index', jsonb_build_object('type', 'index'), jsonb_build_array(
            jsonb_build_object('id', 'hero-default', 'type', 'heroBanner', 'order', 10, 'visible', TRUE),
            jsonb_build_object('id', 'trust-badges-default', 'type', 'trustBadges', 'order', 20, 'visible', TRUE),
            jsonb_build_object('id', 'product-grid-default', 'type', 'productGrid', 'order', 30, 'visible', TRUE),
            jsonb_build_object('id', 'brand-marquee-default', 'type', 'brandMarquee', 'order', 40, 'visible', TRUE),
            jsonb_build_object('id', 'category-grid-default', 'type', 'categoryGrid', 'order', 50, 'visible', TRUE),
            jsonb_build_object('id', 'newsletter-default', 'type', 'newsletter', 'order', 60, 'visible', TRUE)
        )),
        ('product', 'product', jsonb_build_object('type', 'product'), jsonb_build_array(jsonb_build_object('id', 'product-detail-default', 'type', 'productDetail', 'order', 10, 'visible', TRUE))),
        ('collection', 'collection', jsonb_build_object('type', 'collection'), jsonb_build_array(jsonb_build_object('id', 'collection-grid-default', 'type', 'productGrid', 'order', 10, 'visible', TRUE))),
        ('page', 'page', jsonb_build_object('type', 'page'), jsonb_build_array(jsonb_build_object('id', 'content-page-default', 'type', 'contentPage', 'order', 10, 'visible', TRUE))),
        ('policy', 'policy', jsonb_build_object('type', 'policy'), jsonb_build_array(jsonb_build_object('id', 'policy-page-default', 'type', 'contentPage', 'order', 10, 'visible', TRUE))),
        ('cart', 'cart', jsonb_build_object('type', 'cart'), '[]'::jsonb),
        ('checkout', 'checkout', jsonb_build_object('type', 'checkout'), '[]'::jsonb),
        ('order_confirmation', 'order_confirmation', jsonb_build_object('type', 'order_confirmation'), '[]'::jsonb),
        ('search', 'search', jsonb_build_object('type', 'search'), jsonb_build_array(jsonb_build_object('id', 'search-grid-default', 'type', 'productGrid', 'order', 10, 'visible', TRUE))),
        ('customer_account', 'customer_account', jsonb_build_object('type', 'customer_account'), '[]'::jsonb),
        ('not_found', 'not_found', jsonb_build_object('type', 'not_found'), '[]'::jsonb)
) AS templates(template_key, template_type, template_schema, default_sections)
ON CONFLICT (theme_package_version_id, template_key) DO UPDATE SET
    template_type = EXCLUDED.template_type,
    layout_key = EXCLUDED.layout_key,
    template_schema = EXCLUDED.template_schema,
    default_sections = EXCLUDED.default_sections,
    metadata = EXCLUDED.metadata,
    deleted_at = NULL,
    updated_at = NOW();

WITH urban_version AS (
    SELECT tpv.id AS theme_package_version_id
    FROM theme_packages tp
    JOIN theme_package_versions tpv ON tpv.theme_package_id = tp.id
    WHERE tp.slug = 'urban-kicks'
      AND tpv.version = '1.0.0'
    LIMIT 1
)
INSERT INTO theme_section_definitions (
    theme_package_version_id,
    section_key,
    renderer_key,
    section_schema,
    block_schema,
    presets,
    availability_rules,
    data_requirements,
    performance_budget,
    status,
    updated_at,
    deleted_at
)
SELECT
    uv.theme_package_version_id,
    section_key,
    renderer_key,
    section_schema,
    block_schema,
    presets,
    availability_rules,
    data_requirements,
    performance_budget,
    status,
    NOW(),
    NULL
FROM urban_version uv
CROSS JOIN (
    VALUES
        ('header', 'core.header', $json${"name":"Header","type":"header","description":"Sticky storefront header with logo, navigation, search, account, and cart controls.","defaults":{"behavior":"sticky","displayMode":"name","showSearch":true,"showCart":true,"showAccount":true},"settings_schema":{"displayMode":{"type":"select","label":"Display Mode","options":["logo","name","both"]},"showSearch":{"type":"toggle","label":"Show Search"},"showCart":{"type":"toggle","label":"Show Cart"},"showAccount":{"type":"toggle","label":"Show Account"}}}$json$::jsonb, $json${"navPage":{"name":"Navigation Link","fields":{"label":{"type":"text","label":"Label"},"href":{"type":"url","label":"URL"},"isVisible":{"type":"toggle","label":"Visible"}}}}$json$::jsonb, '[]'::jsonb, $json${"templates":["index","product","collection","page","policy","cart","checkout","order_confirmation"]}$json$::jsonb, '{}'::jsonb, $json${"critical":true}$json$::jsonb, 'active'),
        ('footer', 'core.footer', $json${"name":"Footer","type":"footer","description":"Store footer with link columns, social links, newsletter, and payment affordances.","defaults":{"columns":3,"showNewsletter":true,"showSocial":true,"showPaymentIcons":true},"settings_schema":{"columns":{"type":"range","label":"Columns","min":2,"max":4,"step":1},"showNewsletter":{"type":"toggle","label":"Show Newsletter"},"showSocial":{"type":"toggle","label":"Show Social Links"},"showPaymentIcons":{"type":"toggle","label":"Show Payment Icons"}}}$json$::jsonb, $json${"footerLink":{"name":"Footer Link"},"socialLink":{"name":"Social Link"}}$json$::jsonb, '[]'::jsonb, $json${"templates":["index","product","collection","page","policy","cart","checkout","order_confirmation"]}$json$::jsonb, '{}'::jsonb, '{}'::jsonb, 'active'),
        ('heroBanner', 'core.hero', $json${"name":"Hero Banner","type":"heroBanner","description":"Cinematic commerce hero with headline, supporting copy, image, overlay, and CTA.","defaults":{"heading":"New Season Essentials","subheading":"Fresh drops, everyday staples, and limited pieces curated for your store.","ctaText":"Shop Now","ctaLink":"#products","height":"large","textAlign":"left","overlay":0.4},"settings_schema":{"heading":{"type":"text","label":"Heading","maxLength":100},"subheading":{"type":"text","label":"Subheading","maxLength":200},"ctaText":{"type":"text","label":"Button Text","maxLength":40},"ctaLink":{"type":"url","label":"Button Link"},"image":{"type":"image","label":"Background Image"},"overlay":{"type":"range","label":"Overlay Opacity","min":0,"max":1,"step":0.1},"height":{"type":"select","label":"Height","options":["full","large","medium","small"]},"textAlign":{"type":"select","label":"Text Alignment","options":["left","center","right"]}}}$json$::jsonb, '{}'::jsonb, $json$[{"name":"Left hero","settings":{"height":"large","textAlign":"left"}},{"name":"Centered hero","settings":{"height":"full","textAlign":"center"}}]$json$::jsonb, $json${"templates":["index"]}$json$::jsonb, '{}'::jsonb, $json${"priorityImage":true}$json$::jsonb, 'active'),
        ('trustBadges', 'commerce.trust-badges', $json${"name":"Trust Badges","type":"trustBadges","description":"Trust and service badges for shipping, authenticity, returns, and support.","defaults":{"title":"","badges":[{"icon":"truck","label":"Free Shipping","description":"On orders above INR 999"},{"icon":"shield-check","label":"100% Authentic","description":"Guaranteed genuine products"},{"icon":"rotate-ccw","label":"Easy Returns","description":"7-day hassle-free returns"},{"icon":"headphones","label":"24/7 Support","description":"We're here to help"}]},"settings_schema":{"title":{"type":"text","label":"Section Heading","maxLength":60}}}$json$::jsonb, $json${"badge":{"name":"Badge","fields":{"icon":{"type":"select","label":"Icon","options":["truck","shield-check","rotate-ccw","headphones","award","star","heart","zap","lock","clock","globe","check-circle","package","credit-card"]},"label":{"type":"text","label":"Label"},"description":{"type":"text","label":"Description"}}}}$json$::jsonb, '[]'::jsonb, $json${"templates":["index","product","cart","checkout"]}$json$::jsonb, '{}'::jsonb, '{}'::jsonb, 'active'),
        ('productGrid', 'core.product-grid', $json${"name":"Product Grid","type":"productGrid","description":"Responsive product grid with price, rating, and add-to-cart controls.","defaults":{"title":"Featured Products","subtitle":"Products selected from your catalog","columns":4,"rows":2,"showPrice":true,"showRating":true,"showAddToCart":true,"cardStyle":"minimal","sortBy":"newest"},"settings_schema":{"title":{"type":"text","label":"Section Title"},"subtitle":{"type":"text","label":"Subtitle"},"columns":{"type":"range","label":"Columns","min":2,"max":4,"step":1},"rows":{"type":"range","label":"Rows","min":1,"max":4,"step":1},"showPrice":{"type":"toggle","label":"Show Price"},"showRating":{"type":"toggle","label":"Show Rating"},"showAddToCart":{"type":"toggle","label":"Show Add to Cart"},"cardStyle":{"type":"select","label":"Card Style","options":["standard","minimal","detailed"]},"sortBy":{"type":"select","label":"Sort By","options":["newest","price_low","price_high","popular"]}}}$json$::jsonb, '{}'::jsonb, $json$[{"name":"Four column grid","settings":{"columns":4,"rows":2}},{"name":"Three column collection","settings":{"columns":3,"rows":3}}]$json$::jsonb, $json${"templates":["index","collection","search"]}$json$::jsonb, $json${"products":true}$json$::jsonb, '{}'::jsonb, 'active'),
        ('productDetail', 'core.product-detail', $json${"name":"Product Detail","type":"productDetail","description":"Product media, price, variants, cart action, and availability details.","defaults":{"showVendor":false,"showSku":true,"showInventory":true,"showReviews":true,"showShare":true},"settings_schema":{"showSku":{"type":"toggle","label":"Show SKU"},"showInventory":{"type":"toggle","label":"Show Inventory"},"showReviews":{"type":"toggle","label":"Show Reviews"},"showShare":{"type":"toggle","label":"Show Share"}}}$json$::jsonb, '{}'::jsonb, '[]'::jsonb, $json${"templates":["product"]}$json$::jsonb, $json${"product":true}$json$::jsonb, '{}'::jsonb, 'active'),
        ('featuredProducts', 'core.featured-products', $json${"name":"Featured Products","type":"featuredProducts","description":"Curated product rail for featured or new products.","defaults":{"title":"Featured Drops","limit":8,"showAddToCart":true},"settings_schema":{"title":{"type":"text","label":"Title"},"limit":{"type":"range","label":"Product Limit","min":4,"max":12,"step":1},"showAddToCart":{"type":"toggle","label":"Show Add to Cart"}}}$json$::jsonb, '{}'::jsonb, '[]'::jsonb, $json${"templates":["index","product","collection"]}$json$::jsonb, $json${"products":true}$json$::jsonb, '{}'::jsonb, 'active'),
        ('categoryGrid', 'commerce.category-grid', $json${"name":"Category Grid","type":"categoryGrid","description":"Visual category cards linking to filtered shopping views.","defaults":{"title":"Shop by Category","subtitle":"Find exactly what you're looking for","columns":3,"cardStyle":"overlay"},"settings_schema":{"title":{"type":"text","label":"Heading"},"subtitle":{"type":"text","label":"Subheading"},"columns":{"type":"range","label":"Columns","min":2,"max":4,"step":1},"cardStyle":{"type":"select","label":"Card Style","options":["overlay","minimal","bordered"]}}}$json$::jsonb, $json${"category":{"name":"Category Card","fields":{"name":{"type":"text","label":"Name"},"slug":{"type":"text","label":"Slug"},"image":{"type":"image","label":"Image"},"tagline":{"type":"text","label":"Tagline"}}}}$json$::jsonb, '[]'::jsonb, $json${"templates":["index","collection"]}$json$::jsonb, '{}'::jsonb, '{}'::jsonb, 'active'),
        ('brandMarquee', 'commerce.brand-marquee', $json${"name":"Brand Marquee","type":"brandMarquee","description":"Scrolling brand, collection, or campaign strip.","defaults":{"title":"Featured brands","speed":25,"pauseOnHover":true,"brands":[]},"settings_schema":{"title":{"type":"text","label":"Heading"},"speed":{"type":"range","label":"Scroll Speed","min":10,"max":60,"step":5},"pauseOnHover":{"type":"toggle","label":"Pause on Hover"}}}$json$::jsonb, $json${"brand":{"name":"Brand","fields":{"name":{"type":"text","label":"Brand Name"},"logo":{"type":"image","label":"Logo"}}}}$json$::jsonb, '[]'::jsonb, $json${"templates":["index"]}$json$::jsonb, '{}'::jsonb, '{}'::jsonb, 'active'),
        ('newsletter', 'core.newsletter', $json${"name":"Newsletter","type":"newsletter","description":"Email signup section for store updates and discounts.","defaults":{"title":"Stay in the Loop","subtitle":"Get early access to new drops and exclusive discounts.","buttonText":"Subscribe","placeholder":"Enter your email","successMessage":"Thanks for subscribing!"},"settings_schema":{"title":{"type":"text","label":"Heading"},"subtitle":{"type":"text","label":"Subheading"},"buttonText":{"type":"text","label":"Button Text"},"placeholder":{"type":"text","label":"Placeholder Text"},"successMessage":{"type":"text","label":"Success Message"}}}$json$::jsonb, '{}'::jsonb, '[]'::jsonb, $json${"templates":["index","footer"]}$json$::jsonb, '{}'::jsonb, '{}'::jsonb, 'active'),
        ('testimonials', 'core.testimonials', $json${"name":"Testimonials","type":"testimonials","description":"Customer testimonial carousel or grid.","defaults":{"title":"What Customers Say","subtitle":"Customer stories and reviews","layout":"carousel","autoplay":true,"showRating":true,"showImage":false},"settings_schema":{"title":{"type":"text","label":"Section Title"},"subtitle":{"type":"text","label":"Subtitle"},"layout":{"type":"select","label":"Layout","options":["carousel","grid","masonry"]},"autoplay":{"type":"toggle","label":"Autoplay"},"showRating":{"type":"toggle","label":"Show Star Ratings"},"showImage":{"type":"toggle","label":"Show Customer Photos"}}}$json$::jsonb, $json${"testimonialCard":{"name":"Testimonial Card","fields":{"name":{"type":"text","label":"Name"},"text":{"type":"textarea","label":"Quote"},"rating":{"type":"range","label":"Rating","min":1,"max":5,"step":1},"image":{"type":"image","label":"Photo"}}}}$json$::jsonb, '[]'::jsonb, $json${"templates":["index","product"]}$json$::jsonb, '{}'::jsonb, '{}'::jsonb, 'active'),
        ('aboutSection', 'core.about', $json${"name":"About Section","type":"aboutSection","description":"Brand story section with copy and optional image.","defaults":{"title":"Built for the city","body":"Tell shoppers what makes your brand different.","image":"","ctaText":"","ctaLink":""},"settings_schema":{"title":{"type":"text","label":"Title"},"body":{"type":"textarea","label":"Body"},"image":{"type":"image","label":"Image"},"ctaText":{"type":"text","label":"CTA Text"},"ctaLink":{"type":"url","label":"CTA Link"}}}$json$::jsonb, '{}'::jsonb, '[]'::jsonb, $json${"templates":["index","page"]}$json$::jsonb, '{}'::jsonb, '{}'::jsonb, 'active'),
        ('portfolioGrid', 'core.portfolio-grid', $json${"name":"Portfolio Grid","type":"portfolioGrid","description":"Project or lookbook grid for creators and hybrid stores.","defaults":{"title":"Lookbook","columns":3},"settings_schema":{"title":{"type":"text","label":"Title"},"columns":{"type":"range","label":"Columns","min":2,"max":4,"step":1}}}$json$::jsonb, '{}'::jsonb, '[]'::jsonb, $json${"templates":["page","index"]}$json$::jsonb, '{}'::jsonb, '{}'::jsonb, 'active'),
        ('skillsSection', 'core.skills', $json${"name":"Skills Section","type":"skillsSection","description":"Skill or capability list for portfolio/resume store variants.","defaults":{"title":"Capabilities","items":[]},"settings_schema":{"title":{"type":"text","label":"Title"}}}$json$::jsonb, '{}'::jsonb, '[]'::jsonb, $json${"templates":["page","index"]}$json$::jsonb, '{}'::jsonb, '{}'::jsonb, 'active'),
        ('experienceTimeline', 'core.experience-timeline', $json${"name":"Experience Timeline","type":"experienceTimeline","description":"Timeline section for resume and portfolio variants.","defaults":{"title":"Experience","items":[]},"settings_schema":{"title":{"type":"text","label":"Title"}}}$json$::jsonb, '{}'::jsonb, '[]'::jsonb, $json${"templates":["page","index"]}$json$::jsonb, '{}'::jsonb, '{}'::jsonb, 'active'),
        ('contactForm', 'core.contact-form', $json${"name":"Contact Form","type":"contactForm","description":"Lead capture contact section.","defaults":{"title":"Contact","subtitle":"Send us a message"},"settings_schema":{"title":{"type":"text","label":"Title"},"subtitle":{"type":"text","label":"Subtitle"}}}$json$::jsonb, '{}'::jsonb, '[]'::jsonb, $json${"templates":["page","index"]}$json$::jsonb, '{}'::jsonb, '{}'::jsonb, 'active'),
        ('ctaSection', 'core.cta', $json${"name":"CTA Section","type":"ctaSection","description":"Focused promotional call-to-action band.","defaults":{"title":"Ready for the next drop?","body":"Shop the latest products now.","ctaText":"Shop now","ctaLink":"/shop"},"settings_schema":{"title":{"type":"text","label":"Title"},"body":{"type":"textarea","label":"Body"},"ctaText":{"type":"text","label":"CTA Text"},"ctaLink":{"type":"url","label":"CTA Link"}}}$json$::jsonb, '{}'::jsonb, '[]'::jsonb, $json${"templates":["index","page","product"]}$json$::jsonb, '{}'::jsonb, '{}'::jsonb, 'active'),
        ('servicesGrid', 'core.services-grid', $json${"name":"Services Grid","type":"servicesGrid","description":"Services or value proposition grid.","defaults":{"title":"Services","columns":3},"settings_schema":{"title":{"type":"text","label":"Title"},"columns":{"type":"range","label":"Columns","min":2,"max":4,"step":1}}}$json$::jsonb, '{}'::jsonb, '[]'::jsonb, $json${"templates":["page","index"]}$json$::jsonb, '{}'::jsonb, '{}'::jsonb, 'active'),
        ('contentPage', 'core.rich-content', $json${"name":"Rich Content","type":"contentPage","description":"Rich storefront content for pages and policies.","defaults":{"title":"","body":""},"settings_schema":{"title":{"type":"text","label":"Title"},"body":{"type":"richtext","label":"Body"}}}$json$::jsonb, $json${"contentBlock":{"name":"Content Block","fields":{"body":{"type":"richtext","label":"Body"}}}}$json$::jsonb, '[]'::jsonb, $json${"templates":["page","policy"]}$json$::jsonb, '{}'::jsonb, '{}'::jsonb, 'active')
) AS sections(section_key, renderer_key, section_schema, block_schema, presets, availability_rules, data_requirements, performance_budget, status)
ON CONFLICT (theme_package_version_id, section_key) DO UPDATE SET
    renderer_key = EXCLUDED.renderer_key,
    section_schema = EXCLUDED.section_schema,
    block_schema = EXCLUDED.block_schema,
    presets = EXCLUDED.presets,
    availability_rules = EXCLUDED.availability_rules,
    data_requirements = EXCLUDED.data_requirements,
    performance_budget = EXCLUDED.performance_budget,
    status = EXCLUDED.status,
    deleted_at = NULL,
    updated_at = NOW();

WITH urban_version AS (
    SELECT tpv.id AS theme_package_version_id
    FROM theme_packages tp
    JOIN theme_package_versions tpv ON tpv.theme_package_id = tp.id
    WHERE tp.slug = 'urban-kicks'
      AND tpv.version = '1.0.0'
    LIMIT 1
)
INSERT INTO theme_block_definitions (
    theme_package_version_id,
    block_key,
    renderer_key,
    block_schema,
    availability_rules,
    data_requirements,
    status,
    updated_at,
    deleted_at
)
SELECT
    uv.theme_package_version_id,
    block_key,
    renderer_key,
    block_schema,
    availability_rules,
    data_requirements,
    'active',
    NOW(),
    NULL
FROM urban_version uv
CROSS JOIN (
    VALUES
        ('navPage', 'core.nav-link', $json${"name":"Navigation Link","fields":{"label":{"type":"text","label":"Label","maxLength":30},"href":{"type":"url","label":"URL"},"isVisible":{"type":"toggle","label":"Visible","default":true}}}$json$::jsonb, $json${"sections":["header"]}$json$::jsonb, '{}'::jsonb),
        ('footerLink', 'core.footer-link', $json${"name":"Footer Link","fields":{"label":{"type":"text","label":"Label","maxLength":40},"href":{"type":"url","label":"URL"}}}$json$::jsonb, $json${"sections":["footer"]}$json$::jsonb, '{}'::jsonb),
        ('socialLink', 'core.social-link', $json${"name":"Social Link","fields":{"platform":{"type":"select","label":"Platform","options":["instagram","x","youtube","linkedin"]},"href":{"type":"url","label":"URL"}}}$json$::jsonb, $json${"sections":["footer"]}$json$::jsonb, '{}'::jsonb),
        ('category', 'commerce.category-card', $json${"name":"Category Card","fields":{"name":{"type":"text","label":"Name","maxLength":30},"slug":{"type":"text","label":"Slug"},"image":{"type":"image","label":"Image"},"tagline":{"type":"text","label":"Tagline","maxLength":50}}}$json$::jsonb, $json${"sections":["categoryGrid"]}$json$::jsonb, '{}'::jsonb),
        ('brand', 'commerce.brand-logo', $json${"name":"Brand","fields":{"name":{"type":"text","label":"Brand Name","maxLength":30},"logo":{"type":"image","label":"Logo"}}}$json$::jsonb, $json${"sections":["brandMarquee"]}$json$::jsonb, '{}'::jsonb),
        ('badge', 'commerce.trust-badge', $json${"name":"Trust Badge","fields":{"icon":{"type":"select","label":"Icon","options":["truck","shield-check","rotate-ccw","headphones","award","star","heart","zap","lock","clock","globe","check-circle","package","credit-card"]},"label":{"type":"text","label":"Label","maxLength":30},"description":{"type":"text","label":"Description","maxLength":60}}}$json$::jsonb, $json${"sections":["trustBadges"]}$json$::jsonb, '{}'::jsonb),
        ('testimonialCard', 'core.testimonial-card', $json${"name":"Testimonial Card","fields":{"name":{"type":"text","label":"Name","maxLength":40},"text":{"type":"textarea","label":"Quote","maxLength":240},"rating":{"type":"range","label":"Rating","min":1,"max":5,"step":1},"image":{"type":"image","label":"Photo"}}}$json$::jsonb, $json${"sections":["testimonials"]}$json$::jsonb, '{}'::jsonb),
        ('contentBlock', 'core.content-block', $json${"name":"Content Block","fields":{"body":{"type":"richtext","label":"Body"}}}$json$::jsonb, $json${"sections":["contentPage","aboutSection","ctaSection"]}$json$::jsonb, '{}'::jsonb)
) AS blocks(block_key, renderer_key, block_schema, availability_rules, data_requirements)
ON CONFLICT (theme_package_version_id, block_key) DO UPDATE SET
    renderer_key = EXCLUDED.renderer_key,
    block_schema = EXCLUDED.block_schema,
    availability_rules = EXCLUDED.availability_rules,
    data_requirements = EXCLUDED.data_requirements,
    status = 'active',
    deleted_at = NULL,
    updated_at = NOW();

WITH urban_version AS (
    SELECT tpv.id AS theme_package_version_id
    FROM theme_packages tp
    JOIN theme_package_versions tpv ON tpv.theme_package_id = tp.id
    WHERE tp.slug = 'urban-kicks'
      AND tpv.version = '1.0.0'
    LIMIT 1
)
INSERT INTO theme_presets (
    theme_package_version_id,
    preset_key,
    name,
    preset_config,
    preview_media,
    sort_order,
    updated_at,
    deleted_at
)
SELECT
    theme_package_version_id,
    'default',
    'Urban Kicks Default',
    jsonb_build_object(
        'themeId', 'urban-kicks',
        'themeSettings', jsonb_build_object(
            'primaryColor', '#8B5CF6',
            'secondaryColor', '#3B82F6',
            'accentColor', '#F59E0B',
            'backgroundColor', '#FFFFFF',
            'textColor', '#1F2937',
            'fontFamily', 'Inter',
            'headingFontFamily', 'Inter',
            'borderRadius', 12,
            'enableAnimations', TRUE,
            'enableShadows', TRUE
        ),
        'sections', jsonb_build_object(
            'header', jsonb_build_object('id', 'header', 'type', 'header', 'order', 0, 'visible', TRUE),
            'footer', jsonb_build_object('id', 'footer', 'type', 'footer', 'order', 100, 'visible', TRUE),
            'template', jsonb_build_array(
                jsonb_build_object('id', 'hero-default', 'type', 'heroBanner', 'order', 10, 'visible', TRUE),
                jsonb_build_object('id', 'trust-badges-default', 'type', 'trustBadges', 'order', 20, 'visible', TRUE),
                jsonb_build_object('id', 'product-grid-default', 'type', 'productGrid', 'order', 30, 'visible', TRUE),
                jsonb_build_object('id', 'brand-marquee-default', 'type', 'brandMarquee', 'order', 40, 'visible', TRUE),
                jsonb_build_object('id', 'category-grid-default', 'type', 'categoryGrid', 'order', 50, 'visible', TRUE),
                jsonb_build_object('id', 'newsletter-default', 'type', 'newsletter', 'order', 60, 'visible', TRUE)
            )
        )
    ),
    jsonb_build_object(
        'thumbnail_url', '/previews/urban-kicks-card.png',
        'preview_url', '/preview/urban-kicks?theme=urban-kicks',
        'detail_preview_url', '/previews/urban-kicks-detail.png'
    ),
    0,
    NOW(),
    NULL
FROM urban_version
ON CONFLICT (theme_package_version_id, preset_key) DO UPDATE SET
    name = EXCLUDED.name,
    preset_config = EXCLUDED.preset_config,
    preview_media = EXCLUDED.preview_media,
    sort_order = EXCLUDED.sort_order,
    deleted_at = NULL,
    updated_at = NOW();
-- ADDITIVE + idempotent: merge the Liquid bundle into themes.default_template for urban-kicks.
-- Keeps the existing React sections/templates intact; rendering stays React until a store opts into
-- liquidRenderingCanary (L15). Regenerate via scripts/liquid-parity/build-urban-kicks-bundle.mjs.
UPDATE public.themes
SET default_template = COALESCE(default_template, '{}'::jsonb)
        || jsonb_build_object('liquidBundle', $liquidbundle${"schema_version":"2026-06-liquid-sections","package":{"slug":"urban-kicks-liquid","name":"Urban Kicks Liquid","description":"First-party Urban Kicks storefront converted to portable Liquid sections and blocks.","author_name":"LetBuyy","site_types":["store"],"status":"active","pricing_type":"free","price":0,"currency":"INR","version":"1.0.0","version_number":1,"release_status":"published","compatibility_range":">=2026-06-liquid-sections"},"layout":{"theme":{"path":"layout/theme.liquid","source":"<!doctype html>\n<html lang=\"{{ request.locale | default: \"en\" }}\">\n<head>\n  <meta charset=\"utf-8\">\n  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n  <title>{{ shop.name }} - Urban Kicks</title>\n  {{ content_for_header | raw }}\n</head>\n<body class=\"lb-theme lb-theme--urban-kicks\">\n  <main id=\"MainContent\">\n    {{ content_for_layout | raw }}\n  </main>\n  {{ content_for_footer | raw }}\n</body>\n</html>"}},"config":{"settings_schema":{"schema_version":"2026-05-json-contract","settings":{"colors":{"label":"Colors","description":"Urban Kicks storefront color tokens.","fields":{"primaryColor":{"type":"color","label":"Primary color","default":"#8B5CF6"},"accentColor":{"type":"color","label":"Accent color","default":"#F59E0B"},"surfaceColor":{"type":"color","label":"Surface color","default":"#F8FAFC"}}},"typography":{"label":"Typography","description":"First-party type settings mirrored from the JSON-contract Urban Kicks theme.","fields":{"headingFontFamily":{"type":"text","label":"Heading font","default":"Inter"},"bodyFontFamily":{"type":"text","label":"Body font","default":"Inter"}}}}},"settings_data":{"current":{"primaryColor":"#8B5CF6","accentColor":"#F59E0B","surfaceColor":"#F8FAFC","headingFontFamily":"Inter","bodyFontFamily":"Inter"},"presets":{}}},"templates":{"header":{"name":"Urban Kicks header","layout":"theme","sections":{"header-default":{"type":"header","settings":{"storeName":"Urban Kicks","showSearch":true,"showCart":true},"blocks":{"header-products":{"type":"link","settings":{"label":"Products","href":"/products"},"disabled":false},"header-collections":{"type":"link","settings":{"label":"Collections","href":"/collections/new-arrivals"},"disabled":false}},"block_order":["header-products","header-collections"],"disabled":false}},"order":["header-default"]},"footer":{"name":"Urban Kicks footer","layout":"theme","sections":{"footer-default":{"type":"footer","settings":{"storeName":"Urban Kicks","tagline":"First-party Liquid commerce storefront."},"blocks":{"footer-contact":{"type":"link","settings":{"label":"Contact","href":"/contact"},"disabled":false},"footer-policy":{"type":"link","settings":{"label":"Policies","href":"/policies/shipping-policy"},"disabled":false}},"block_order":["footer-contact","footer-policy"],"disabled":false}},"order":["footer-default"]},"index":{"name":"Urban Kicks home page","layout":"theme","sections":{"announcement-default":{"type":"announcement-bar","settings":{"text":"Free shipping on fresh drops this week.","linkLabel":"Shop now","linkHref":"/products"},"blocks":{},"block_order":[],"disabled":false},"hero-default":{"type":"hero-banner","settings":{"eyebrow":"New season essentials","heading":"Fresh drops for daily buyers","subheading":"Launch-ready sneakers, apparel, and accessories for a commerce storefront.","ctaText":"Shop Now","ctaLink":"/products"},"blocks":{},"block_order":[],"disabled":false},"category-grid-default":{"type":"category-grid","settings":{"title":"Shop by style","subtitle":"Launch-ready groupings for daily buyers."},"blocks":{"category-sneakers":{"type":"category","settings":{"name":"Sneakers","slug":"sneakers","tagline":"Fresh pairs"},"disabled":false},"category-apparel":{"type":"category","settings":{"name":"Apparel","slug":"apparel","tagline":"Daily fits"},"disabled":false},"category-accessories":{"type":"category","settings":{"name":"Accessories","slug":"accessories","tagline":"Finish the look"},"disabled":false}},"block_order":["category-sneakers","category-apparel","category-accessories"],"disabled":false},"featured-collection-default":{"type":"featured-products","settings":{"title":"Drop-ready collection","subtitle":"Curated items for the first storefront launch.","viewAllLabel":"View collection","viewAllHref":"/collections/new-arrivals"},"blocks":{"product-sneaker":{"type":"product-card","settings":{"title":"Velocity Runner","price":"Rs 4,999","url":"/products/velocity-runner"},"disabled":false},"product-hoodie":{"type":"product-card","settings":{"title":"Everyday Hoodie","price":"Rs 2,499","url":"/products/everyday-hoodie"},"disabled":false},"product-cap":{"type":"product-card","settings":{"title":"Street Cap","price":"Rs 899","url":"/products/street-cap"},"disabled":false}},"block_order":["product-sneaker","product-hoodie","product-cap"],"disabled":false},"product-grid-default":{"type":"product-grid","settings":{"title":"Featured Products","subtitle":"Products selected from your catalog.","columns":4},"blocks":{"grid-sneaker":{"type":"product-card","settings":{"title":"Court Sneaker","price":"Rs 3,499","url":"/products/court-sneaker"},"disabled":false},"grid-backpack":{"type":"product-card","settings":{"title":"Transit Backpack","price":"Rs 1,999","url":"/products/transit-backpack"},"disabled":false}},"block_order":["grid-sneaker","grid-backpack"],"disabled":false},"spotlight-default":{"type":"spotlight","settings":{"heading":"A brand-new Liquid section","subheading":"Added as sections/spotlight.liquid without changing the storefront React registry."},"blocks":{"spotlight-badge":{"type":"badge","settings":{"label":"Zero storefront code change"},"disabled":false},"spotlight-app":{"type":"@app","settings":{"extension_handle":"urban-offer","slot":"home.spotlight.offer"},"disabled":false}},"block_order":["spotlight-badge","spotlight-app"],"disabled":false},"newsletter-default":{"type":"newsletter-signup","settings":{"title":"Get first access","subtitle":"Store updates, new drops, and offers sent to your inbox.","buttonLabel":"Sign up"},"blocks":{},"block_order":[],"disabled":false}},"order":["announcement-default","hero-default","category-grid-default","featured-collection-default","product-grid-default","spotlight-default","newsletter-default"]},"product":{"name":"Urban Kicks product","layout":"theme","sections":{"product-detail-default":{"type":"product-detail","settings":{"showGallery":true,"showDescription":true},"blocks":{},"block_order":[],"disabled":false},"product-related":{"type":"featured-products","settings":{"title":"You may also like"},"blocks":{},"block_order":[],"disabled":false}},"order":["product-detail-default","product-related"]},"collection":{"name":"Urban Kicks collection","layout":"theme","sections":{"collection-banner-default":{"type":"collection-banner","settings":{"showDescription":true},"blocks":{},"block_order":[],"disabled":false},"collection-products":{"type":"collection-product-list","settings":{"title":"Products"},"blocks":{},"block_order":[],"disabled":false}},"order":["collection-banner-default","collection-products"]},"search":{"name":"Urban Kicks search","layout":"theme","sections":{"search-box-default":{"type":"search-box","settings":{"placeholder":"Search products"},"blocks":{},"block_order":[],"disabled":false},"search-results":{"type":"collection-product-list","settings":{"title":"Results"},"blocks":{},"block_order":[],"disabled":false}},"order":["search-box-default","search-results"]},"cart":{"name":"Urban Kicks cart","layout":"theme","sections":{"cart-summary-default":{"type":"cart-summary","settings":{},"blocks":{},"block_order":[],"disabled":false}},"order":["cart-summary-default"]},"customers/login":{"name":"Login","layout":"theme","sections":{"customer-login-default":{"type":"customer-login","settings":{},"blocks":{},"block_order":[],"disabled":false}},"order":["customer-login-default"]},"customers/register":{"name":"Register","layout":"theme","sections":{"customer-register-default":{"type":"customer-register","settings":{},"blocks":{},"block_order":[],"disabled":false}},"order":["customer-register-default"]},"customers/account":{"name":"Account","layout":"theme","sections":{"customer-account-default":{"type":"customer-account","settings":{},"blocks":{},"block_order":[],"disabled":false}},"order":["customer-account-default"]},"customers/orders":{"name":"Order history","layout":"theme","sections":{"customer-orders-default":{"type":"customer-orders","settings":{},"blocks":{},"block_order":[],"disabled":false}},"order":["customer-orders-default"]},"customers/order":{"name":"Order detail","layout":"theme","sections":{"customer-order-detail-default":{"type":"customer-order-detail","settings":{},"blocks":{},"block_order":[],"disabled":false}},"order":["customer-order-detail-default"]}},"sections":{"customer-orders":{"path":"sections/customer-orders.liquid","source":"<section class=\"lb-orders\" data-section-id=\"{{ section.id }}\">\n  <h1>{{ section.settings.heading }}</h1>\n  {% if customer.orders and customer.orders.size > 0 %}\n  <ul class=\"lb-orders__list\">{% for order in customer.orders %}<li class=\"lb-orders__row\"><a href=\"/account/orders/{{ order.id }}\"><span class=\"lb-orders__num\">#{{ order.number }}</span><span class=\"lb-orders__status\">{{ order.status }}</span><span class=\"lb-orders__total\">{{ order.total | money_with_currency: order.currency }}</span></a></li>{% endfor %}</ul>\n  {% else %}<p class=\"lb-orders__empty\">No orders yet.</p>{% endif %}\n</section>\n{% schema %}\n{\n  \"name\": \"Order History\",\n  \"settings\": [\n    {\n      \"id\": \"heading\",\n      \"type\": \"text\",\n      \"label\": \"Heading\",\n      \"default\": \"Your orders\"\n    }\n  ],\n  \"blocks\": [],\n  \"presets\": [\n    {\n      \"name\": \"Order History\",\n      \"settings\": {},\n      \"blocks\": []\n    }\n  ]\n}\n{% endschema %}","schema":{"name":"Order History","tag":"section","settings":[{"type":"text","label":"Heading","default":"Your orders","id":"heading"}],"blocks":[],"presets":[{"name":"Order History","settings":{},"blocks":[]}],"enabled_on":{"templates":["*"]},"disabled_on":{"templates":[]}}},"customer-order-detail":{"path":"sections/customer-order-detail.liquid","source":"<section class=\"lb-order-detail\" data-section-id=\"{{ section.id }}\">\n  {% if order %}\n  <h1>Order #{{ order.number }}</h1>\n  <p class=\"lb-order-detail__status\">Status: {{ order.status }}</p>\n  <ul class=\"lb-order-detail__items\">{% for item in order.line_items %}<li><span class=\"lb-order-detail__title\">{{ item.title }}</span><span class=\"lb-order-detail__qty\">{{ item.quantity }}</span><span class=\"lb-order-detail__line\">{{ item.line_price | money_with_currency: order.currency }}</span></li>{% endfor %}</ul>\n  <p class=\"lb-order-detail__total\">Total: {{ order.total | money_with_currency: order.currency }}</p>\n  <ol class=\"lb-order-detail__timeline\">{% for step in order.timeline %}<li class=\"lb-order-detail__step{% if step.reached %} is-reached{% endif %}\">{{ step.label }}</li>{% endfor %}</ol>\n  {% if order.tracking_number != blank %}<p class=\"lb-order-detail__tracking\">Tracking: {{ order.tracking_number }}{% if order.carrier != blank %} ({{ order.carrier }}){% endif %}</p>{% endif %}\n  {% else %}<p class=\"lb-order-detail__missing\">Order not found.</p>{% endif %}\n</section>\n{% schema %}\n{\n  \"name\": \"Order Detail\",\n  \"settings\": [\n    {\n      \"id\": \"heading\",\n      \"type\": \"text\",\n      \"label\": \"Heading\",\n      \"default\": \"Order\"\n    }\n  ],\n  \"blocks\": [],\n  \"presets\": [\n    {\n      \"name\": \"Order Detail\",\n      \"settings\": {},\n      \"blocks\": []\n    }\n  ]\n}\n{% endschema %}","schema":{"name":"Order Detail","tag":"section","settings":[{"type":"text","label":"Heading","default":"Order","id":"heading"}],"blocks":[],"presets":[{"name":"Order Detail","settings":{},"blocks":[]}],"enabled_on":{"templates":["*"]},"disabled_on":{"templates":[]}}},"customer-account":{"path":"sections/customer-account.liquid","source":"<section class=\"lb-account\" data-section-id=\"{{ section.id }}\">\n  {% if customer %}\n  <h1>{{ section.settings.heading }}</h1>\n  <p class=\"lb-account__hello\">Signed in as {{ customer.name | default: customer.email }}</p>\n  <nav class=\"lb-account__nav\"><a href=\"/account/orders\">Orders</a><a href=\"/account/addresses\">Addresses</a><a href=\"/account/settings\">Settings</a><a href=\"/api/customer/logout\">Sign out</a></nav>\n  {% else %}\n  <p class=\"lb-account__guest\">Please <a href=\"/customers/login\">sign in</a> to view your account.</p>\n  {% endif %}\n</section>\n{% schema %}\n{\n  \"name\": \"Customer Account\",\n  \"settings\": [\n    {\n      \"id\": \"heading\",\n      \"type\": \"text\",\n      \"label\": \"Heading\",\n      \"default\": \"Your account\"\n    }\n  ],\n  \"blocks\": [],\n  \"presets\": [\n    {\n      \"name\": \"Customer Account\",\n      \"settings\": {},\n      \"blocks\": []\n    }\n  ]\n}\n{% endschema %}","schema":{"name":"Customer Account","tag":"section","settings":[{"type":"text","label":"Heading","default":"Your account","id":"heading"}],"blocks":[],"presets":[{"name":"Customer Account","settings":{},"blocks":[]}],"enabled_on":{"templates":["*"]},"disabled_on":{"templates":[]}}},"customer-login":{"path":"sections/customer-login.liquid","source":"<section class=\"lb-auth lb-auth--login\" data-section-id=\"{{ section.id }}\">\n  <h1>{{ section.settings.heading }}</h1>\n  <form class=\"lb-auth__form\" method=\"post\" action=\"/api/customer/login\">\n    <label>Email<input type=\"email\" name=\"email\" autocomplete=\"email\" required></label>\n    <label>Password<input type=\"password\" name=\"password\" autocomplete=\"current-password\" required></label>\n    <button type=\"submit\">Sign in</button>\n  </form>\n  <a href=\"/customers/register\">Create an account</a>\n</section>\n{% schema %}\n{\n  \"name\": \"Customer Login\",\n  \"settings\": [\n    {\n      \"id\": \"heading\",\n      \"type\": \"text\",\n      \"label\": \"Heading\",\n      \"default\": \"Sign in\"\n    }\n  ],\n  \"blocks\": [],\n  \"presets\": [\n    {\n      \"name\": \"Customer Login\",\n      \"settings\": {},\n      \"blocks\": []\n    }\n  ]\n}\n{% endschema %}","schema":{"name":"Customer Login","tag":"section","settings":[{"type":"text","label":"Heading","default":"Sign in","id":"heading"}],"blocks":[],"presets":[{"name":"Customer Login","settings":{},"blocks":[]}],"enabled_on":{"templates":["*"]},"disabled_on":{"templates":[]}}},"customer-register":{"path":"sections/customer-register.liquid","source":"<section class=\"lb-auth lb-auth--register\" data-section-id=\"{{ section.id }}\">\n  <h1>{{ section.settings.heading }}</h1>\n  <form class=\"lb-auth__form\" method=\"post\" action=\"/api/customer/register\">\n    <label>Name<input type=\"text\" name=\"name\" autocomplete=\"name\"></label>\n    <label>Email<input type=\"email\" name=\"email\" autocomplete=\"email\" required></label>\n    <label>Password<input type=\"password\" name=\"password\" autocomplete=\"new-password\" required></label>\n    <button type=\"submit\">Create account</button>\n  </form>\n  <a href=\"/customers/login\">Already have an account?</a>\n</section>\n{% schema %}\n{\n  \"name\": \"Customer Register\",\n  \"settings\": [\n    {\n      \"id\": \"heading\",\n      \"type\": \"text\",\n      \"label\": \"Heading\",\n      \"default\": \"Create account\"\n    }\n  ],\n  \"blocks\": [],\n  \"presets\": [\n    {\n      \"name\": \"Customer Register\",\n      \"settings\": {},\n      \"blocks\": []\n    }\n  ]\n}\n{% endschema %}","schema":{"name":"Customer Register","tag":"section","settings":[{"type":"text","label":"Heading","default":"Create account","id":"heading"}],"blocks":[],"presets":[{"name":"Customer Register","settings":{},"blocks":[]}],"enabled_on":{"templates":["*"]},"disabled_on":{"templates":[]}}},"cart-summary":{"path":"sections/cart-summary.liquid","source":"<section class=\"lb-cart\" data-section-id=\"{{ section.id }}\">\n  <h1>{{ section.settings.heading }}</h1>\n  {% if cart.item_count > 0 %}\n  <ul class=\"lb-cart__items\">{% for item in cart.items %}<li class=\"lb-cart__item\"><span class=\"lb-cart__title\">{{ item.title }}</span><span class=\"lb-cart__qty\">{{ item.quantity }}</span><span class=\"lb-cart__line\">{{ item.line_price | money_with_currency: cart.currency }}</span></li>{% endfor %}</ul>\n  <p class=\"lb-cart__total\">Total: {{ cart.total_price | money_with_currency: cart.currency }}</p>\n  <a class=\"lb-cart__checkout\" href=\"{{ cart.checkout_url }}\">Checkout</a>\n  {% else %}<p class=\"lb-cart__empty\">Your cart is empty.</p>{% endif %}\n</section>\n{% schema %}\n{\n  \"name\": \"Cart\",\n  \"settings\": [\n    {\n      \"id\": \"heading\",\n      \"type\": \"text\",\n      \"label\": \"Heading\",\n      \"default\": \"Your cart\"\n    }\n  ],\n  \"blocks\": [],\n  \"presets\": [\n    {\n      \"name\": \"Cart\",\n      \"settings\": {},\n      \"blocks\": []\n    }\n  ]\n}\n{% endschema %}","schema":{"name":"Cart","tag":"section","settings":[{"type":"text","label":"Heading","default":"Your cart","id":"heading"}],"blocks":[],"presets":[{"name":"Cart","settings":{},"blocks":[]}],"enabled_on":{"templates":["*"]},"disabled_on":{"templates":[]}}},"search-box":{"path":"sections/search-box.liquid","source":"<section class=\"lb-search\" data-section-id=\"{{ section.id }}\">\n  <lb-search data-lb-island=\"search\" data-search-url=\"/search\"><input type=\"search\" placeholder=\"{{ section.settings.placeholder }}\" aria-label=\"Search products\"></lb-search>\n  {% if search.terms %}<p class=\"lb-search__terms\">Results for \"{{ search.terms }}\"</p>{% endif %}\n</section>\n{% schema %}\n{\n  \"name\": \"Search\",\n  \"settings\": [\n    {\n      \"id\": \"placeholder\",\n      \"type\": \"text\",\n      \"label\": \"Placeholder\",\n      \"default\": \"Search products\"\n    }\n  ],\n  \"blocks\": [],\n  \"presets\": [\n    {\n      \"name\": \"Search\",\n      \"settings\": {},\n      \"blocks\": []\n    }\n  ]\n}\n{% endschema %}","schema":{"name":"Search","tag":"section","settings":[{"type":"text","label":"Placeholder","default":"Search products","id":"placeholder"}],"blocks":[],"presets":[{"name":"Search","settings":{},"blocks":[]}],"enabled_on":{"templates":["*"]},"disabled_on":{"templates":[]}}},"collection-banner":{"path":"sections/collection-banner.liquid","source":"<section class=\"lb-collection-banner\" data-section-id=\"{{ section.id }}\">\n  <h1>{{ collection.title }}</h1>\n  {% if section.settings.showDescription and collection.description %}<div class=\"lb-collection-banner__desc\">{{ collection.description }}</div>{% endif %}\n</section>\n{% schema %}\n{\n  \"name\": \"Collection Banner\",\n  \"settings\": [\n    {\n      \"id\": \"showDescription\",\n      \"type\": \"toggle\",\n      \"label\": \"Show description\",\n      \"default\": true\n    }\n  ],\n  \"blocks\": [],\n  \"presets\": [\n    {\n      \"name\": \"Collection Banner\",\n      \"settings\": {},\n      \"blocks\": []\n    }\n  ]\n}\n{% endschema %}","schema":{"name":"Collection Banner","tag":"section","settings":[{"type":"toggle","label":"Show description","default":true,"id":"showDescription"}],"blocks":[],"presets":[{"name":"Collection Banner","settings":{},"blocks":[]}],"enabled_on":{"templates":["*"]},"disabled_on":{"templates":[]}}},"collection-product-list":{"path":"sections/collection-product-list.liquid","source":"<section class=\"lb-product-grid\" data-section-id=\"{{ section.id }}\">\n  {% if section.settings.title %}<h2>{{ section.settings.title }}</h2>{% endif %}\n  <div class=\"lb-product-grid__items\">\n    {% for item in collection.products %}<article class=\"lb-product-card\"><a href=\"{{ item.url }}\"><strong>{{ item.title }}</strong><span>{{ item.price | money_with_currency: item.currency }}</span></a></article>{% endfor %}\n  </div>\n</section>\n{% schema %}\n{\n  \"name\": \"Collection Products\",\n  \"settings\": [\n    {\n      \"id\": \"title\",\n      \"type\": \"text\",\n      \"label\": \"Heading\",\n      \"default\": \"Products\"\n    }\n  ],\n  \"blocks\": [],\n  \"presets\": [\n    {\n      \"name\": \"Collection Products\",\n      \"settings\": {},\n      \"blocks\": []\n    }\n  ]\n}\n{% endschema %}","schema":{"name":"Collection Products","tag":"section","settings":[{"type":"text","label":"Heading","default":"Products","id":"title"}],"blocks":[],"presets":[{"name":"Collection Products","settings":{},"blocks":[]}],"enabled_on":{"templates":["*"]},"disabled_on":{"templates":[]}}},"announcement-bar":{"path":"sections/announcement-bar.liquid","source":"<section class=\"lb-announcement-bar\" data-section-id=\"{{ section.id }}\">\n  <span>{{ section.settings.text }}</span>\n  <a href=\"{{ section.settings.linkHref }}\">{{ section.settings.linkLabel }}</a>\n</section>\n{% schema %}\n{\n  \"name\": \"Announcement Bar\",\n  \"settings\": [\n    { \"id\": \"text\", \"type\": \"text\", \"label\": \"Message\", \"default\": \"Free shipping on fresh drops this week.\" },\n    { \"id\": \"linkLabel\", \"type\": \"text\", \"label\": \"Link label\", \"default\": \"Shop now\" },\n    { \"id\": \"linkHref\", \"type\": \"url\", \"label\": \"Link URL\", \"default\": \"/products\" }\n  ],\n  \"presets\": [{ \"name\": \"Announcement Bar\" }]\n}\n{% endschema %}","schema":{"name":"Announcement Bar","tag":"section","settings":[{"type":"text","label":"Message","default":"Free shipping on fresh drops this week.","id":"text"},{"type":"text","label":"Link label","default":"Shop now","id":"linkLabel"},{"type":"url","label":"Link URL","default":"/products","id":"linkHref"}],"blocks":[],"presets":[{"name":"Announcement Bar","settings":{},"blocks":[]}],"enabled_on":{"templates":["*"]},"disabled_on":{"templates":[]}}},"about-section":{"path":"sections/about-section.liquid","source":"<section class=\"lb-about-section\" data-section-id=\"{{ section.id }}\">\n  <h2>{{ section.settings.title }}</h2>\n  <div>{{ section.settings.content }}</div>\n  {% if section.settings.imageUrl %}<img src=\"{{ section.settings.imageUrl | image_url }}\" alt=\"{{ section.settings.title }}\">{% endif %}\n</section>\n{% schema %}\n{\n  \"name\": \"About Section\",\n  \"settings\": [\n    {\n      \"id\": \"title\",\n      \"type\": \"text\",\n      \"label\": \"Title\",\n      \"default\": \"About us\"\n    },\n    {\n      \"id\": \"content\",\n      \"type\": \"richtext\",\n      \"label\": \"Content\"\n    },\n    {\n      \"id\": \"imageUrl\",\n      \"type\": \"image\",\n      \"label\": \"Image\"\n    },\n    {\n      \"id\": \"layout\",\n      \"type\": \"select\",\n      \"label\": \"Layout\",\n      \"default\": \"left\",\n      \"options\": [\n        \"left\",\n        \"right\",\n        \"center\"\n      ]\n    }\n  ],\n  \"blocks\": [],\n  \"presets\": [\n    {\n      \"name\": \"About Section\",\n      \"settings\": {},\n      \"blocks\": []\n    }\n  ]\n}\n{% endschema %}","schema":{"name":"About Section","tag":"section","settings":[{"type":"text","label":"Title","default":"About us","id":"title"},{"type":"richtext","label":"Content","id":"content"},{"type":"image","label":"Image","id":"imageUrl"},{"type":"select","label":"Layout","default":"left","options":["left","right","center"],"id":"layout"}],"blocks":[],"presets":[{"name":"About Section","settings":{},"blocks":[]}],"enabled_on":{"templates":["*"]},"disabled_on":{"templates":[]}}},"app-block-slot":{"path":"sections/app-block-slot.liquid","source":"<section class=\"lb-app-block-slot\" data-section-id=\"{{ section.id }}\">\n  {% if section.settings.title %}<h2>{{ section.settings.title }}</h2>{% endif %}\n  {% for block in section.blocks %}{{ block.content | raw }}{% endfor %}\n</section>\n{% schema %}\n{\n  \"name\": \"App Block Slot\",\n  \"settings\": [\n    {\n      \"id\": \"title\",\n      \"type\": \"text\",\n      \"label\": \"Title\"\n    },\n    {\n      \"id\": \"slot\",\n      \"type\": \"text\",\n      \"label\": \"Slot\",\n      \"default\": \"storefront.home.after-hero\"\n    }\n  ],\n  \"blocks\": [\n    {\n      \"type\": \"@app\",\n      \"name\": \"App block\"\n    }\n  ],\n  \"presets\": [\n    {\n      \"name\": \"App Block Slot\",\n      \"settings\": {},\n      \"blocks\": []\n    }\n  ]\n}\n{% endschema %}","schema":{"name":"App Block Slot","tag":"section","settings":[{"type":"text","label":"Title","id":"title"},{"type":"text","label":"Slot","default":"storefront.home.after-hero","id":"slot"}],"blocks":[{"type":"@app","name":"App block","settings":[]}],"presets":[{"name":"App Block Slot","settings":{},"blocks":[]}],"enabled_on":{"templates":["*"]},"disabled_on":{"templates":[]}}},"banner-carousel":{"path":"sections/banner-carousel.liquid","source":"<section class=\"lb-banner-carousel\" data-section-id=\"{{ section.id }}\" data-autoplay=\"{{ section.settings.autoplay }}\">\n  {% if section.settings.title %}<h2>{{ section.settings.title }}</h2>{% endif %}\n  <div class=\"lb-banner-carousel__slides\">\n    {% for block in section.blocks %}<a href=\"{{ block.settings.link }}\">{% if block.settings.image %}<img src=\"{{ block.settings.image | image_url }}\" alt=\"{{ block.settings.heading }}\">{% endif %}<span>{{ block.settings.heading }}</span></a>{% endfor %}\n  </div>\n</section>\n{% schema %}\n{\n  \"name\": \"Banner Carousel\",\n  \"settings\": [\n    {\n      \"id\": \"title\",\n      \"type\": \"text\",\n      \"label\": \"Title\"\n    },\n    {\n      \"id\": \"autoplay\",\n      \"type\": \"toggle\",\n      \"label\": \"Autoplay\",\n      \"default\": true\n    }\n  ],\n  \"blocks\": [\n    {\n      \"type\": \"slide\",\n      \"name\": \"Slide\",\n      \"settings\": [\n        {\n          \"id\": \"heading\",\n          \"type\": \"text\",\n          \"label\": \"Heading\"\n        },\n        {\n          \"id\": \"image\",\n          \"type\": \"image\",\n          \"label\": \"Image\"\n        },\n        {\n          \"id\": \"link\",\n          \"type\": \"url\",\n          \"label\": \"Link\"\n        }\n      ]\n    }\n  ],\n  \"presets\": [\n    {\n      \"name\": \"Banner Carousel\",\n      \"settings\": {},\n      \"blocks\": []\n    }\n  ]\n}\n{% endschema %}","schema":{"name":"Banner Carousel","tag":"section","settings":[{"type":"text","label":"Title","id":"title"},{"type":"toggle","label":"Autoplay","default":true,"id":"autoplay"}],"blocks":[{"type":"slide","name":"Slide","settings":[{"type":"text","label":"Heading","id":"heading"},{"type":"image","label":"Image","id":"image"},{"type":"url","label":"Link","id":"link"}]}],"presets":[{"name":"Banner Carousel","settings":{},"blocks":[]}],"enabled_on":{"templates":["*"]},"disabled_on":{"templates":[]}}},"brand-marquee":{"path":"sections/brand-marquee.liquid","source":"<section class=\"lb-brand-marquee\" data-section-id=\"{{ section.id }}\">\n  <h2>{{ section.settings.title }}</h2>\n  <div>{% for block in section.blocks %}<span>{{ block.settings.name }}</span>{% endfor %}</div>\n</section>\n{% schema %}\n{\n  \"name\": \"Brand Marquee\",\n  \"settings\": [\n    {\n      \"id\": \"title\",\n      \"type\": \"text\",\n      \"label\": \"Title\",\n      \"default\": \"Featured brands\"\n    }\n  ],\n  \"blocks\": [\n    {\n      \"type\": \"brand\",\n      \"name\": \"Brand\",\n      \"settings\": [\n        {\n          \"id\": \"name\",\n          \"type\": \"text\",\n          \"label\": \"Name\"\n        }\n      ]\n    }\n  ],\n  \"presets\": [\n    {\n      \"name\": \"Brand Marquee\",\n      \"settings\": {},\n      \"blocks\": []\n    }\n  ]\n}\n{% endschema %}","schema":{"name":"Brand Marquee","tag":"section","settings":[{"type":"text","label":"Title","default":"Featured brands","id":"title"}],"blocks":[{"type":"brand","name":"Brand","settings":[{"type":"text","label":"Name","id":"name"}]}],"presets":[{"name":"Brand Marquee","settings":{},"blocks":[]}],"enabled_on":{"templates":["*"]},"disabled_on":{"templates":[]}}},"category-grid":{"path":"sections/category-grid.liquid","source":"<section class=\"lb-category-grid\" data-section-id=\"{{ section.id }}\">\n  <h2>{{ section.settings.title }}</h2>\n  <p>{{ section.settings.subtitle }}</p>\n  <div class=\"lb-category-grid__items\">\n    {% for block in section.blocks %}\n      {{ block.content | raw }}\n    {% endfor %}\n  </div>\n</section>\n{% schema %}\n{\n  \"name\": \"Category Grid\",\n  \"settings\": [\n    { \"id\": \"title\", \"type\": \"text\", \"label\": \"Heading\", \"default\": \"Shop by style\" },\n    { \"id\": \"subtitle\", \"type\": \"text\", \"label\": \"Subheading\" }\n  ],\n  \"blocks\": [{ \"type\": \"category\", \"name\": \"Category\" }],\n  \"presets\": [{ \"name\": \"Category Grid\" }]\n}\n{% endschema %}","schema":{"name":"Category Grid","tag":"section","settings":[{"type":"text","label":"Heading","default":"Shop by style","id":"title"},{"type":"text","label":"Subheading","id":"subtitle"}],"blocks":[{"type":"category","name":"Category","settings":[]}],"presets":[{"name":"Category Grid","settings":{},"blocks":[]}],"enabled_on":{"templates":["*"]},"disabled_on":{"templates":[]}}},"contact-form":{"path":"sections/contact-form.liquid","source":"<section class=\"lb-contact-form\" data-section-id=\"{{ section.id }}\">\n  <h2>{{ section.settings.title }}</h2>\n  <p>{{ section.settings.subtitle }}</p>\n  <form action=\"/contact\" method=\"post\"><input name=\"name\" aria-label=\"Name\"><input type=\"email\" name=\"email\" aria-label=\"Email\">{% if section.settings.showPhone %}<input name=\"phone\" aria-label=\"Phone\">{% endif %}<button type=\"submit\">Send</button></form>\n</section>\n{% schema %}\n{\n  \"name\": \"Contact Form\",\n  \"settings\": [\n    {\n      \"id\": \"title\",\n      \"type\": \"text\",\n      \"label\": \"Title\",\n      \"default\": \"Contact us\"\n    },\n    {\n      \"id\": \"subtitle\",\n      \"type\": \"text\",\n      \"label\": \"Subtitle\"\n    },\n    {\n      \"id\": \"showPhone\",\n      \"type\": \"toggle\",\n      \"label\": \"Show phone field\",\n      \"default\": true\n    }\n  ],\n  \"blocks\": [],\n  \"presets\": [\n    {\n      \"name\": \"Contact Form\",\n      \"settings\": {},\n      \"blocks\": []\n    }\n  ]\n}\n{% endschema %}","schema":{"name":"Contact Form","tag":"section","settings":[{"type":"text","label":"Title","default":"Contact us","id":"title"},{"type":"text","label":"Subtitle","id":"subtitle"},{"type":"toggle","label":"Show phone field","default":true,"id":"showPhone"}],"blocks":[],"presets":[{"name":"Contact Form","settings":{},"blocks":[]}],"enabled_on":{"templates":["*"]},"disabled_on":{"templates":[]}}},"cta-section":{"path":"sections/cta-section.liquid","source":"<section class=\"lb-cta-section\" data-section-id=\"{{ section.id }}\">\n  <h2>{{ section.settings.heading }}</h2>\n  <p>{{ section.settings.subheading }}</p>\n  <a href=\"{{ section.settings.ctaLink }}\">{{ section.settings.ctaText }}</a>\n</section>\n{% schema %}\n{\n  \"name\": \"Call to Action\",\n  \"settings\": [\n    {\n      \"id\": \"heading\",\n      \"type\": \"text\",\n      \"label\": \"Heading\",\n      \"default\": \"Ready to get started?\"\n    },\n    {\n      \"id\": \"subheading\",\n      \"type\": \"text\",\n      \"label\": \"Subheading\"\n    },\n    {\n      \"id\": \"ctaText\",\n      \"type\": \"text\",\n      \"label\": \"Button text\",\n      \"default\": \"Shop now\"\n    },\n    {\n      \"id\": \"ctaLink\",\n      \"type\": \"url\",\n      \"label\": \"Button link\",\n      \"default\": \"/products\"\n    }\n  ],\n  \"blocks\": [],\n  \"presets\": [\n    {\n      \"name\": \"Call to Action\",\n      \"settings\": {},\n      \"blocks\": []\n    }\n  ]\n}\n{% endschema %}","schema":{"name":"Call to Action","tag":"section","settings":[{"type":"text","label":"Heading","default":"Ready to get started?","id":"heading"},{"type":"text","label":"Subheading","id":"subheading"},{"type":"text","label":"Button text","default":"Shop now","id":"ctaText"},{"type":"url","label":"Button link","default":"/products","id":"ctaLink"}],"blocks":[],"presets":[{"name":"Call to Action","settings":{},"blocks":[]}],"enabled_on":{"templates":["*"]},"disabled_on":{"templates":[]}}},"featured-products":{"path":"sections/featured-products.liquid","source":"<section class=\"lb-featured-products\" data-section-id=\"{{ section.id }}\">\n  <div>\n    <h2>{{ section.settings.title }}</h2>\n    <p>{{ section.settings.subtitle }}</p>\n  </div>\n  <div class=\"lb-featured-products__items\">\n    {% for block in section.blocks %}\n      {{ block.content | raw }}\n    {% endfor %}\n  </div>\n  <a href=\"{{ section.settings.viewAllHref }}\">{{ section.settings.viewAllLabel }}</a>\n</section>\n{% schema %}\n{\n  \"name\": \"Featured Products\",\n  \"settings\": [\n    { \"id\": \"title\", \"type\": \"text\", \"label\": \"Heading\", \"default\": \"Drop-ready collection\" },\n    { \"id\": \"subtitle\", \"type\": \"text\", \"label\": \"Subheading\" },\n    { \"id\": \"viewAllLabel\", \"type\": \"text\", \"label\": \"View all label\", \"default\": \"View collection\" },\n    { \"id\": \"viewAllHref\", \"type\": \"url\", \"label\": \"View all URL\", \"default\": \"/collections/new-arrivals\" }\n  ],\n  \"blocks\": [{ \"type\": \"product-card\", \"name\": \"Product card\" }],\n  \"presets\": [{ \"name\": \"Featured Products\" }]\n}\n{% endschema %}","schema":{"name":"Featured Products","tag":"section","settings":[{"type":"text","label":"Heading","default":"Drop-ready collection","id":"title"},{"type":"text","label":"Subheading","id":"subtitle"},{"type":"text","label":"View all label","default":"View collection","id":"viewAllLabel"},{"type":"url","label":"View all URL","default":"/collections/new-arrivals","id":"viewAllHref"}],"blocks":[{"type":"product-card","name":"Product card","settings":[]}],"presets":[{"name":"Featured Products","settings":{},"blocks":[]}],"enabled_on":{"templates":["*"]},"disabled_on":{"templates":[]}}},"experience-timeline":{"path":"sections/experience-timeline.liquid","source":"<section class=\"lb-experience-timeline\" data-section-id=\"{{ section.id }}\">\n  <h2>{{ section.settings.title }}</h2>\n  {% for block in section.blocks %}<article><h3>{{ block.settings.title }}</h3><p>{{ block.settings.company }}</p><time>{{ block.settings.period }}</time></article>{% endfor %}\n</section>\n{% schema %}\n{\n  \"name\": \"Experience Timeline\",\n  \"settings\": [\n    {\n      \"id\": \"title\",\n      \"type\": \"text\",\n      \"label\": \"Title\",\n      \"default\": \"Experience\"\n    }\n  ],\n  \"blocks\": [\n    {\n      \"type\": \"experience\",\n      \"name\": \"Experience\",\n      \"settings\": [\n        {\n          \"id\": \"title\",\n          \"type\": \"text\",\n          \"label\": \"Title\"\n        },\n        {\n          \"id\": \"company\",\n          \"type\": \"text\",\n          \"label\": \"Company\"\n        },\n        {\n          \"id\": \"period\",\n          \"type\": \"text\",\n          \"label\": \"Period\"\n        }\n      ]\n    }\n  ],\n  \"presets\": [\n    {\n      \"name\": \"Experience Timeline\",\n      \"settings\": {},\n      \"blocks\": []\n    }\n  ]\n}\n{% endschema %}","schema":{"name":"Experience Timeline","tag":"section","settings":[{"type":"text","label":"Title","default":"Experience","id":"title"}],"blocks":[{"type":"experience","name":"Experience","settings":[{"type":"text","label":"Title","id":"title"},{"type":"text","label":"Company","id":"company"},{"type":"text","label":"Period","id":"period"}]}],"presets":[{"name":"Experience Timeline","settings":{},"blocks":[]}],"enabled_on":{"templates":["*"]},"disabled_on":{"templates":[]}}},"footer":{"path":"sections/footer.liquid","source":"<footer class=\"lb-footer\" data-section-id=\"{{ section.id }}\">\n  <div><strong>{{ section.settings.storeName }}</strong>{% if section.settings.tagline %}<p>{{ section.settings.tagline }}</p>{% endif %}</div>\n  <nav>{% for block in section.blocks %}<a href=\"{{ block.settings.href }}\">{{ block.settings.label }}</a>{% endfor %}</nav>\n</footer>\n{% schema %}\n{\n  \"name\": \"Footer\",\n  \"settings\": [\n    {\n      \"id\": \"storeName\",\n      \"type\": \"text\",\n      \"label\": \"Store name\",\n      \"default\": \"{{ shop.name }}\"\n    },\n    {\n      \"id\": \"tagline\",\n      \"type\": \"text\",\n      \"label\": \"Tagline\"\n    }\n  ],\n  \"blocks\": [\n    {\n      \"type\": \"link\",\n      \"name\": \"Link\",\n      \"settings\": [\n        {\n          \"id\": \"label\",\n          \"type\": \"text\",\n          \"label\": \"Label\"\n        },\n        {\n          \"id\": \"href\",\n          \"type\": \"url\",\n          \"label\": \"URL\"\n        }\n      ]\n    }\n  ],\n  \"presets\": [\n    {\n      \"name\": \"Footer\",\n      \"settings\": {},\n      \"blocks\": []\n    }\n  ]\n}\n{% endschema %}","schema":{"name":"Footer","tag":"section","settings":[{"type":"text","label":"Store name","default":"{{ shop.name }}","id":"storeName"},{"type":"text","label":"Tagline","id":"tagline"}],"blocks":[{"type":"link","name":"Link","settings":[{"type":"text","label":"Label","id":"label"},{"type":"url","label":"URL","id":"href"}]}],"presets":[{"name":"Footer","settings":{},"blocks":[]}],"enabled_on":{"templates":["*"]},"disabled_on":{"templates":[]}}},"header":{"path":"sections/header.liquid","source":"<header class=\"lb-header\" data-section-id=\"{{ section.id }}\">\n  <a class=\"lb-header__brand\" href=\"/\">{{ section.settings.storeName }}</a>\n  <nav>{% for block in section.blocks %}<a href=\"{{ block.settings.href }}\">{{ block.settings.label }}</a>{% endfor %}</nav>\n  <div class=\"lb-header__actions\">{% if section.settings.showSearch %}<lb-search data-lb-island=\"search\" data-search-url=\"/search\"></lb-search>{% endif %}{% if section.settings.showCart %}<a href=\"/cart\">{{ \"general.cart\" | t }} ({{ cart.item_count }})</a>{% endif %}</div>\n</header>\n{% schema %}\n{\n  \"name\": \"Header\",\n  \"settings\": [\n    {\n      \"id\": \"storeName\",\n      \"type\": \"text\",\n      \"label\": \"Store name\",\n      \"default\": \"{{ shop.name }}\"\n    },\n    {\n      \"id\": \"showSearch\",\n      \"type\": \"toggle\",\n      \"label\": \"Show search\",\n      \"default\": true\n    },\n    {\n      \"id\": \"showCart\",\n      \"type\": \"toggle\",\n      \"label\": \"Show cart\",\n      \"default\": true\n    }\n  ],\n  \"blocks\": [\n    {\n      \"type\": \"link\",\n      \"name\": \"Link\",\n      \"settings\": [\n        {\n          \"id\": \"label\",\n          \"type\": \"text\",\n          \"label\": \"Label\"\n        },\n        {\n          \"id\": \"href\",\n          \"type\": \"url\",\n          \"label\": \"URL\"\n        }\n      ]\n    }\n  ],\n  \"presets\": [\n    {\n      \"name\": \"Header\",\n      \"settings\": {},\n      \"blocks\": []\n    }\n  ]\n}\n{% endschema %}","schema":{"name":"Header","tag":"section","settings":[{"type":"text","label":"Store name","default":"{{ shop.name }}","id":"storeName"},{"type":"toggle","label":"Show search","default":true,"id":"showSearch"},{"type":"toggle","label":"Show cart","default":true,"id":"showCart"}],"blocks":[{"type":"link","name":"Link","settings":[{"type":"text","label":"Label","id":"label"},{"type":"url","label":"URL","id":"href"}]}],"presets":[{"name":"Header","settings":{},"blocks":[]}],"enabled_on":{"templates":["*"]},"disabled_on":{"templates":[]}}},"hero-banner":{"path":"sections/hero-banner.liquid","source":"<section class=\"lb-hero-banner\" data-section-id=\"{{ section.id }}\">\n  <p>{{ section.settings.eyebrow }}</p>\n  <h1>{{ section.settings.heading }}</h1>\n  <p>{{ section.settings.subheading }}</p>\n  <a href=\"{{ section.settings.ctaLink }}\">{{ section.settings.ctaText }}</a>\n</section>\n{% schema %}\n{\n  \"name\": \"Hero Banner\",\n  \"settings\": [\n    { \"id\": \"eyebrow\", \"type\": \"text\", \"label\": \"Eyebrow\", \"default\": \"New season essentials\" },\n    { \"id\": \"heading\", \"type\": \"text\", \"label\": \"Heading\", \"default\": \"Fresh drops for daily buyers\" },\n    { \"id\": \"subheading\", \"type\": \"textarea\", \"label\": \"Subheading\" },\n    { \"id\": \"ctaText\", \"type\": \"text\", \"label\": \"Button text\", \"default\": \"Shop Now\" },\n    { \"id\": \"ctaLink\", \"type\": \"url\", \"label\": \"Button link\", \"default\": \"/products\" }\n  ],\n  \"presets\": [{ \"name\": \"Hero Banner\" }]\n}\n{% endschema %}","schema":{"name":"Hero Banner","tag":"section","settings":[{"type":"text","label":"Eyebrow","default":"New season essentials","id":"eyebrow"},{"type":"text","label":"Heading","default":"Fresh drops for daily buyers","id":"heading"},{"type":"textarea","label":"Subheading","id":"subheading"},{"type":"text","label":"Button text","default":"Shop Now","id":"ctaText"},{"type":"url","label":"Button link","default":"/products","id":"ctaLink"}],"blocks":[],"presets":[{"name":"Hero Banner","settings":{},"blocks":[]}],"enabled_on":{"templates":["*"]},"disabled_on":{"templates":[]}}},"marquee":{"path":"sections/marquee.liquid","source":"<section class=\"lb-marquee\" data-section-id=\"{{ section.id }}\">\n  <p>{{ section.settings.text }}</p>\n</section>\n{% schema %}\n{\n  \"name\": \"Marquee\",\n  \"settings\": [\n    {\n      \"id\": \"text\",\n      \"type\": \"text\",\n      \"label\": \"Text\",\n      \"default\": \"Featured announcement\"\n    }\n  ],\n  \"blocks\": [],\n  \"presets\": [\n    {\n      \"name\": \"Marquee\",\n      \"settings\": {},\n      \"blocks\": []\n    }\n  ]\n}\n{% endschema %}","schema":{"name":"Marquee","tag":"section","settings":[{"type":"text","label":"Text","default":"Featured announcement","id":"text"}],"blocks":[],"presets":[{"name":"Marquee","settings":{},"blocks":[]}],"enabled_on":{"templates":["*"]},"disabled_on":{"templates":[]}}},"portfolio-grid":{"path":"sections/portfolio-grid.liquid","source":"<section class=\"lb-portfolio-grid\" data-section-id=\"{{ section.id }}\">\n  <h2>{{ section.settings.title }}</h2>\n  {% for block in section.blocks %}<article><h3>{{ block.settings.title }}</h3><p>{{ block.settings.summary }}</p><a href=\"{{ block.settings.link }}\">View</a></article>{% endfor %}\n</section>\n{% schema %}\n{\n  \"name\": \"Portfolio Grid\",\n  \"settings\": [\n    {\n      \"id\": \"title\",\n      \"type\": \"text\",\n      \"label\": \"Title\",\n      \"default\": \"Portfolio\"\n    }\n  ],\n  \"blocks\": [\n    {\n      \"type\": \"project\",\n      \"name\": \"Project\",\n      \"settings\": [\n        {\n          \"id\": \"title\",\n          \"type\": \"text\",\n          \"label\": \"Title\"\n        },\n        {\n          \"id\": \"summary\",\n          \"type\": \"textarea\",\n          \"label\": \"Summary\"\n        },\n        {\n          \"id\": \"link\",\n          \"type\": \"url\",\n          \"label\": \"Link\"\n        }\n      ]\n    }\n  ],\n  \"presets\": [\n    {\n      \"name\": \"Portfolio Grid\",\n      \"settings\": {},\n      \"blocks\": []\n    }\n  ]\n}\n{% endschema %}","schema":{"name":"Portfolio Grid","tag":"section","settings":[{"type":"text","label":"Title","default":"Portfolio","id":"title"}],"blocks":[{"type":"project","name":"Project","settings":[{"type":"text","label":"Title","id":"title"},{"type":"textarea","label":"Summary","id":"summary"},{"type":"url","label":"Link","id":"link"}]}],"presets":[{"name":"Portfolio Grid","settings":{},"blocks":[]}],"enabled_on":{"templates":["*"]},"disabled_on":{"templates":[]}}},"product-detail":{"path":"sections/product-detail.liquid","source":"<section class=\"lb-product-detail\" data-section-id=\"{{ section.id }}\">\n  <h1>{{ product.title }}</h1>\n  {% if section.settings.showGallery %}<div class=\"lb-product-detail__gallery\">{% for image in product.images %}<img src=\"{{ image | image_url }}\" alt=\"{{ product.title }}\">{% endfor %}</div>{% endif %}\n  <p>{{ product.price | money_with_currency: product.currency }}</p>\n  {% if section.settings.showDescription %}<div>{{ product.description }}</div>{% endif %}\n  <lb-add-to-cart data-lb-island=\"add-to-cart\" data-product-id=\"{{ product.id }}\" data-product-name=\"{{ product.title }}\" data-product-price=\"{{ product.price }}\" data-product-currency=\"{{ product.currency }}\" data-product-url=\"{{ product.url }}\"><button type=\"button\" data-lb-add-to-cart>Add to cart</button><span data-lb-add-to-cart-status aria-live=\"polite\"></span></lb-add-to-cart>\n</section>\n{% schema %}\n{\n  \"name\": \"Product Detail\",\n  \"settings\": [\n    {\n      \"id\": \"showGallery\",\n      \"type\": \"toggle\",\n      \"label\": \"Show gallery\",\n      \"default\": true\n    },\n    {\n      \"id\": \"showDescription\",\n      \"type\": \"toggle\",\n      \"label\": \"Show description\",\n      \"default\": true\n    }\n  ],\n  \"blocks\": [],\n  \"presets\": [\n    {\n      \"name\": \"Product Detail\",\n      \"settings\": {},\n      \"blocks\": []\n    }\n  ]\n}\n{% endschema %}","schema":{"name":"Product Detail","tag":"section","settings":[{"type":"toggle","label":"Show gallery","default":true,"id":"showGallery"},{"type":"toggle","label":"Show description","default":true,"id":"showDescription"}],"blocks":[],"presets":[{"name":"Product Detail","settings":{},"blocks":[]}],"enabled_on":{"templates":["*"]},"disabled_on":{"templates":[]}}},"product-grid":{"path":"sections/product-grid.liquid","source":"<section class=\"lb-product-grid\" data-section-id=\"{{ section.id }}\">\n  <h2>{{ section.settings.title }}</h2>\n  <p>{{ section.settings.subtitle }}</p>\n  <div class=\"lb-product-grid__items\" data-columns=\"{{ section.settings.columns }}\">\n    {% for block in section.blocks %}\n      {{ block.content | raw }}\n    {% endfor %}\n  </div>\n</section>\n{% schema %}\n{\n  \"name\": \"Product Grid\",\n  \"settings\": [\n    { \"id\": \"title\", \"type\": \"text\", \"label\": \"Heading\", \"default\": \"Featured Products\" },\n    { \"id\": \"subtitle\", \"type\": \"text\", \"label\": \"Subheading\" },\n    { \"id\": \"columns\", \"type\": \"range\", \"label\": \"Columns\", \"min\": 2, \"max\": 4, \"step\": 1, \"default\": 4 }\n  ],\n  \"blocks\": [{ \"type\": \"product-card\", \"name\": \"Product card\" }],\n  \"presets\": [{ \"name\": \"Product Grid\" }]\n}\n{% endschema %}","schema":{"name":"Product Grid","tag":"section","settings":[{"type":"text","label":"Heading","default":"Featured Products","id":"title"},{"type":"text","label":"Subheading","id":"subtitle"},{"type":"range","label":"Columns","default":4,"min":2,"max":4,"step":1,"id":"columns"}],"blocks":[{"type":"product-card","name":"Product card","settings":[]}],"presets":[{"name":"Product Grid","settings":{},"blocks":[]}],"enabled_on":{"templates":["*"]},"disabled_on":{"templates":[]}}},"rich-content":{"path":"sections/rich-content.liquid","source":"<section class=\"lb-rich-content\" data-section-id=\"{{ section.id }}\">\n  <h1>{{ section.settings.title }}</h1>\n  <div>{{ section.settings.body }}</div>\n</section>\n{% schema %}\n{\n  \"name\": \"Rich Content\",\n  \"settings\": [\n    {\n      \"id\": \"title\",\n      \"type\": \"text\",\n      \"label\": \"Title\"\n    },\n    {\n      \"id\": \"body\",\n      \"type\": \"richtext\",\n      \"label\": \"Body\"\n    }\n  ],\n  \"blocks\": [],\n  \"presets\": [\n    {\n      \"name\": \"Rich Content\",\n      \"settings\": {},\n      \"blocks\": []\n    }\n  ]\n}\n{% endschema %}","schema":{"name":"Rich Content","tag":"section","settings":[{"type":"text","label":"Title","id":"title"},{"type":"richtext","label":"Body","id":"body"}],"blocks":[],"presets":[{"name":"Rich Content","settings":{},"blocks":[]}],"enabled_on":{"templates":["*"]},"disabled_on":{"templates":[]}}},"services-grid":{"path":"sections/services-grid.liquid","source":"<section class=\"lb-services-grid\" data-section-id=\"{{ section.id }}\">\n  <h2>{{ section.settings.title }}</h2>\n  {% for block in section.blocks %}<article><h3>{{ block.settings.title }}</h3><p>{{ block.settings.description }}</p><a href=\"{{ block.settings.link }}\">Learn more</a></article>{% endfor %}\n</section>\n{% schema %}\n{\n  \"name\": \"Services Grid\",\n  \"settings\": [\n    {\n      \"id\": \"title\",\n      \"type\": \"text\",\n      \"label\": \"Title\",\n      \"default\": \"Services\"\n    }\n  ],\n  \"blocks\": [\n    {\n      \"type\": \"service\",\n      \"name\": \"Service\",\n      \"settings\": [\n        {\n          \"id\": \"title\",\n          \"type\": \"text\",\n          \"label\": \"Title\"\n        },\n        {\n          \"id\": \"description\",\n          \"type\": \"textarea\",\n          \"label\": \"Description\"\n        },\n        {\n          \"id\": \"link\",\n          \"type\": \"url\",\n          \"label\": \"Link\"\n        }\n      ]\n    }\n  ],\n  \"presets\": [\n    {\n      \"name\": \"Services Grid\",\n      \"settings\": {},\n      \"blocks\": []\n    }\n  ]\n}\n{% endschema %}","schema":{"name":"Services Grid","tag":"section","settings":[{"type":"text","label":"Title","default":"Services","id":"title"}],"blocks":[{"type":"service","name":"Service","settings":[{"type":"text","label":"Title","id":"title"},{"type":"textarea","label":"Description","id":"description"},{"type":"url","label":"Link","id":"link"}]}],"presets":[{"name":"Services Grid","settings":{},"blocks":[]}],"enabled_on":{"templates":["*"]},"disabled_on":{"templates":[]}}},"skills-section":{"path":"sections/skills-section.liquid","source":"<section class=\"lb-skills-section\" data-section-id=\"{{ section.id }}\">\n  <h2>{{ section.settings.title }}</h2>\n  {% for block in section.blocks %}<span data-level=\"{{ block.settings.level }}\">{{ block.settings.name }} {{ block.settings.level }}%</span>{% endfor %}\n</section>\n{% schema %}\n{\n  \"name\": \"Skills Section\",\n  \"settings\": [\n    {\n      \"id\": \"title\",\n      \"type\": \"text\",\n      \"label\": \"Title\",\n      \"default\": \"Skills\"\n    }\n  ],\n  \"blocks\": [\n    {\n      \"type\": \"skill\",\n      \"name\": \"Skill\",\n      \"settings\": [\n        {\n          \"id\": \"name\",\n          \"type\": \"text\",\n          \"label\": \"Skill\"\n        },\n        {\n          \"id\": \"level\",\n          \"type\": \"range\",\n          \"label\": \"Level\",\n          \"min\": 0,\n          \"max\": 100,\n          \"step\": 5\n        }\n      ]\n    }\n  ],\n  \"presets\": [\n    {\n      \"name\": \"Skills Section\",\n      \"settings\": {},\n      \"blocks\": []\n    }\n  ]\n}\n{% endschema %}","schema":{"name":"Skills Section","tag":"section","settings":[{"type":"text","label":"Title","default":"Skills","id":"title"}],"blocks":[{"type":"skill","name":"Skill","settings":[{"type":"text","label":"Skill","id":"name"},{"type":"range","label":"Level","min":0,"max":100,"step":5,"id":"level"}]}],"presets":[{"name":"Skills Section","settings":{},"blocks":[]}],"enabled_on":{"templates":["*"]},"disabled_on":{"templates":[]}}},"testimonials":{"path":"sections/testimonials.liquid","source":"<section class=\"lb-testimonials\" data-section-id=\"{{ section.id }}\">\n  <h2>{{ section.settings.title }}</h2>\n  {% for block in section.blocks %}<blockquote><p>{{ block.settings.quote }}</p><cite>{{ block.settings.author }}</cite></blockquote>{% endfor %}\n</section>\n{% schema %}\n{\n  \"name\": \"Testimonials\",\n  \"settings\": [\n    {\n      \"id\": \"title\",\n      \"type\": \"text\",\n      \"label\": \"Title\",\n      \"default\": \"What customers say\"\n    }\n  ],\n  \"blocks\": [\n    {\n      \"type\": \"testimonial\",\n      \"name\": \"Testimonial\",\n      \"settings\": [\n        {\n          \"id\": \"quote\",\n          \"type\": \"textarea\",\n          \"label\": \"Quote\"\n        },\n        {\n          \"id\": \"author\",\n          \"type\": \"text\",\n          \"label\": \"Author\"\n        }\n      ]\n    }\n  ],\n  \"presets\": [\n    {\n      \"name\": \"Testimonials\",\n      \"settings\": {},\n      \"blocks\": []\n    }\n  ]\n}\n{% endschema %}","schema":{"name":"Testimonials","tag":"section","settings":[{"type":"text","label":"Title","default":"What customers say","id":"title"}],"blocks":[{"type":"testimonial","name":"Testimonial","settings":[{"type":"textarea","label":"Quote","id":"quote"},{"type":"text","label":"Author","id":"author"}]}],"presets":[{"name":"Testimonials","settings":{},"blocks":[]}],"enabled_on":{"templates":["*"]},"disabled_on":{"templates":[]}}},"trust-badges":{"path":"sections/trust-badges.liquid","source":"<section class=\"lb-trust-badges\" data-section-id=\"{{ section.id }}\">\n  {% if section.settings.title %}<h2>{{ section.settings.title }}</h2>{% endif %}\n  {% for block in section.blocks %}<article><strong>{{ block.settings.label }}</strong><span>{{ block.settings.description }}</span></article>{% endfor %}\n</section>\n{% schema %}\n{\n  \"name\": \"Trust Badges\",\n  \"settings\": [\n    {\n      \"id\": \"title\",\n      \"type\": \"text\",\n      \"label\": \"Title\"\n    }\n  ],\n  \"blocks\": [\n    {\n      \"type\": \"badge\",\n      \"name\": \"Badge\",\n      \"settings\": [\n        {\n          \"id\": \"label\",\n          \"type\": \"text\",\n          \"label\": \"Label\"\n        },\n        {\n          \"id\": \"description\",\n          \"type\": \"text\",\n          \"label\": \"Description\"\n        }\n      ]\n    }\n  ],\n  \"presets\": [\n    {\n      \"name\": \"Trust Badges\",\n      \"settings\": {},\n      \"blocks\": []\n    }\n  ]\n}\n{% endschema %}","schema":{"name":"Trust Badges","tag":"section","settings":[{"type":"text","label":"Title","id":"title"}],"blocks":[{"type":"badge","name":"Badge","settings":[{"type":"text","label":"Label","id":"label"},{"type":"text","label":"Description","id":"description"}]}],"presets":[{"name":"Trust Badges","settings":{},"blocks":[]}],"enabled_on":{"templates":["*"]},"disabled_on":{"templates":[]}}},"newsletter-signup":{"path":"sections/newsletter-signup.liquid","source":"<section class=\"lb-newsletter-signup\" data-section-id=\"{{ section.id }}\">\n  <h2>{{ section.settings.title }}</h2>\n  <p>{{ section.settings.subtitle }}</p>\n  <form action=\"/contact\" method=\"post\">\n    <input type=\"email\" name=\"email\" aria-label=\"Email\" required>\n    <button type=\"submit\">{{ section.settings.buttonLabel }}</button>\n  </form>\n</section>\n{% schema %}\n{\n  \"name\": \"Newsletter Signup\",\n  \"settings\": [\n    { \"id\": \"title\", \"type\": \"text\", \"label\": \"Heading\", \"default\": \"Get first access\" },\n    { \"id\": \"subtitle\", \"type\": \"text\", \"label\": \"Subheading\" },\n    { \"id\": \"buttonLabel\", \"type\": \"text\", \"label\": \"Button label\", \"default\": \"Sign up\" }\n  ],\n  \"presets\": [{ \"name\": \"Newsletter Signup\" }]\n}\n{% endschema %}","schema":{"name":"Newsletter Signup","tag":"section","settings":[{"type":"text","label":"Heading","default":"Get first access","id":"title"},{"type":"text","label":"Subheading","id":"subtitle"},{"type":"text","label":"Button label","default":"Sign up","id":"buttonLabel"}],"blocks":[],"presets":[{"name":"Newsletter Signup","settings":{},"blocks":[]}],"enabled_on":{"templates":["*"]},"disabled_on":{"templates":[]}}},"spotlight":{"path":"sections/spotlight.liquid","source":"<section class=\"lb-first-party-spotlight\" data-section-id=\"{{ section.id }}\">\n  <p>{{ section.settings.subheading }}</p>\n  <h2>{{ section.settings.heading }}</h2>\n  <div class=\"lb-first-party-spotlight__blocks\">\n    {% for block in section.blocks %}\n      {{ block.content | raw }}\n    {% endfor %}\n  </div>\n</section>\n{% schema %}\n{\n  \"name\": \"Spotlight\",\n  \"settings\": [\n    { \"id\": \"heading\", \"type\": \"text\", \"label\": \"Heading\", \"default\": \"A brand-new Liquid section\" },\n    { \"id\": \"subheading\", \"type\": \"text\", \"label\": \"Subheading\" }\n  ],\n  \"blocks\": [\n    { \"type\": \"badge\", \"name\": \"Badge\" },\n    { \"type\": \"@app\", \"name\": \"App block\" }\n  ],\n  \"presets\": [{ \"name\": \"Spotlight\" }]\n}\n{% endschema %}","schema":{"name":"Spotlight","tag":"section","settings":[{"type":"text","label":"Heading","default":"A brand-new Liquid section","id":"heading"},{"type":"text","label":"Subheading","id":"subheading"}],"blocks":[{"type":"badge","name":"Badge","settings":[]},{"type":"@app","name":"App block","settings":[]}],"presets":[{"name":"Spotlight","settings":{},"blocks":[]}],"enabled_on":{"templates":["*"]},"disabled_on":{"templates":[]}}}},"blocks":{"category":{"path":"blocks/category.liquid","source":"<a class=\"lb-category-card\" href=\"/collections/{{ block.settings.slug }}\" data-block-id=\"{{ block.id }}\">\n  <strong>{{ block.settings.name }}</strong>\n  <span>{{ block.settings.tagline }}</span>\n</a>","schema":{"name":"Category","settings":[{"type":"text","label":"Name","id":"name"},{"type":"text","label":"Slug","id":"slug"},{"type":"text","label":"Tagline","id":"tagline"}],"presets":[]}},"product-card":{"path":"blocks/product-card.liquid","source":"<article class=\"lb-product-card\" data-block-id=\"{{ block.id }}\">\n  <a href=\"{{ block.settings.url }}\">\n    <strong>{{ block.settings.title }}</strong>\n    <span>{{ block.settings.price }}</span>\n  </a>\n</article>","schema":{"name":"Product card","settings":[{"type":"text","label":"Title","id":"title"},{"type":"text","label":"Price","id":"price"},{"type":"url","label":"Product URL","id":"url"}],"presets":[]}},"badge":{"path":"blocks/badge.liquid","source":"<span class=\"lb-badge\" data-block-id=\"{{ block.id }}\">{{ block.settings.label }}</span>","schema":{"name":"Badge","settings":[{"type":"text","label":"Label","default":"Zero storefront code change","id":"label"}],"presets":[]}}},"locales":{"en":{"general":{"cart":"Cart"}}},"renderer":{"engine":"liquid","renderer_version":"0.1.0","liquid_ready":true,"assets":{}}}$liquidbundle$::jsonb),
    updated_at = NOW()
WHERE slug = 'urban-kicks';


-- ============================================================================
-- Fresh-DB mirror of migrations 180 (rendererEngine + themeSettings + settings_schema
-- appearance group), 181 (surfaceColor/isDark), and 193 (bodyFontFamily + registry sync).
-- On a database built from migrations + seeds (fresh DB), those three migrations run BEFORE
-- this seed creates the urban-kicks row, so their guarded `WHERE slug = 'urban-kicks'` UPDATEs
-- match zero rows — the same class of gap 180's own header already flagged ("if the theme is
-- (re)created from seeds/urban-kicks-theme.sql on a fresh DB, mirror these defaults there too").
-- The liquidBundle append above already carries this mirror (per the generator's header comment);
-- this block extends the same mirror to the renderer-activation + settings-schema-completion state
-- so a fresh DB and an already-migrated DB converge on identical final values. See migration
-- 199_liquid_activation_fresh_db_closure.sql for the paired already-migrated-DB repair.
-- ADDITIVE + idempotent: re-running this seed re-applies the same final values.
UPDATE public.themes
SET default_template = (
        COALESCE(default_template, '{}'::jsonb)
        || jsonb_build_object('rendererEngine', 'liquid')
        || jsonb_build_object('themeSettings', jsonb_build_object(
                'primaryColor',      '#6d5dfc',
                'secondaryColor',    '#4f7cff',
                'accentColor',       '#22d3ee',
                'backgroundColor',   'rgb(255 255 255)',
                'textColor',         'rgb(26 26 46)',
                'fontFamily',        'Inter',
                'headingFontFamily', 'Space Grotesk',
                'borderRadius',      12,
                'enableShadows',     true,
                'enableAnimations',  true
           ))
    ) #- '{sections,template,0,settings,subtitle}',
    settings_schema = jsonb_build_object(
        'settings', jsonb_build_object(
            'appearance', jsonb_build_object(
                'label', 'Appearance',
                'fields', jsonb_build_object(
                    'primaryColor',      jsonb_build_object('type', 'text',   'label', 'Primary color'),
                    'secondaryColor',    jsonb_build_object('type', 'text',   'label', 'Secondary color'),
                    'accentColor',       jsonb_build_object('type', 'text',   'label', 'Accent color'),
                    'backgroundColor',   jsonb_build_object('type', 'text',   'label', 'Background'),
                    'textColor',         jsonb_build_object('type', 'text',   'label', 'Text'),
                    'fontFamily',        jsonb_build_object('type', 'text',   'label', 'Body font'),
                    'headingFontFamily', jsonb_build_object('type', 'text',   'label', 'Heading font'),
                    'borderRadius',      jsonb_build_object('type', 'number', 'label', 'Corner radius'),
                    'enableShadows',     jsonb_build_object('type', 'toggle', 'label', 'Shadows'),
                    'enableAnimations',  jsonb_build_object('type', 'toggle', 'label', 'Animations'),
                    'surfaceColor',      jsonb_build_object('type', 'text',   'label', 'Surface'),
                    'isDark',            jsonb_build_object('type', 'toggle', 'label', 'Dark mode'),
                    'bodyFontFamily',    jsonb_build_object('type', 'text',   'label', 'Body font family')
                )
            )
        )
    ),
    updated_at = NOW()
WHERE slug = 'urban-kicks';

-- Registry-manifest mirror of migration 193 part (1): the manifest this seed just inserted above
-- (theme_schema_manifests, bare colors/typography/layout groups) has no top-level "settings" key,
-- so normalizeThemeSettingsSchema() takes its fallback branch and validateThemeSettings() rejects
-- every real key. Copy the now-correctly-shaped themes.settings_schema into the manifest, guarded
-- exactly as 193 guards it, so a marketplace-authored manifest with its own "settings" key is never
-- overwritten and re-running this seed is a no-op.
UPDATE public.theme_schema_manifests m
SET settings_schema = t.settings_schema,
    updated_at = NOW()
FROM public.theme_package_versions v
JOIN public.theme_packages p ON p.id = v.theme_package_id
JOIN public.themes t ON t.slug = p.slug
WHERE m.theme_package_version_id = v.id
  AND p.slug = 'urban-kicks'
  AND t.settings_schema ? 'settings'
  AND jsonb_typeof(t.settings_schema -> 'settings') = 'object'
  AND NOT (m.settings_schema ? 'settings');
