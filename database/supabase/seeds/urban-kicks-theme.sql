-- ============================================================================
-- Urban Kicks production theme seed
-- Applies section definitions, block definitions, renderer/schema manifests,
-- templates, and the default preset for theme package version 1.0.0.
-- ============================================================================

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
        'thumbnail_url', '/images/banners/new-arrivals-1.png',
        'preview_url', '/store/urban-kicks-demo'
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
        ('heroBanner', 'core.hero', $json${"name":"Hero Banner","type":"heroBanner","description":"Cinematic commerce hero with headline, supporting copy, image, overlay, and CTA.","defaults":{"heading":"New Season Essentials","subheading":"Fresh drops, everyday staples, and limited pieces curated for your store.","ctaText":"Shop Now","ctaLink":"#products","height":"large","textAlign":"left","overlay":0.4},"settings_schema":{"heading":{"type":"text","label":"Heading","maxLength":100},"subheading":{"type":"text","label":"Subheading","maxLength":200},"ctaText":{"type":"text","label":"Button Text","maxLength":40},"ctaLink":{"type":"url","label":"Button Link"},"image":{"type":"image","label":"Background Image"},"overlay":{"type":"range","label":"Overlay Opacity","min":0,"max":1,"step":0.1},"height":{"type":"select","label":"Height","options":["full","large","medium","small"]},"textAlign":{"type":"select","label":"Text Alignment","options":["left","center","right"]}}}$json$::jsonb, '{}'::jsonb, $json$[{"name":"Left launch hero","settings":{"height":"large","textAlign":"left"}},{"name":"Centered hero","settings":{"height":"full","textAlign":"center"}}]$json$::jsonb, $json${"templates":["index"]}$json$::jsonb, '{}'::jsonb, $json${"priorityImage":true}$json$::jsonb, 'active'),
        ('trustBadges', 'commerce.trust-badges', $json${"name":"Trust Badges","type":"trustBadges","description":"Trust and service badges for shipping, authenticity, returns, and support.","defaults":{"title":"","badges":[{"icon":"truck","label":"Free Shipping","description":"On orders above INR 999"},{"icon":"shield-check","label":"100% Authentic","description":"Guaranteed genuine products"},{"icon":"rotate-ccw","label":"Easy Returns","description":"7-day hassle-free returns"},{"icon":"headphones","label":"24/7 Support","description":"We're here to help"}]},"settings_schema":{"title":{"type":"text","label":"Section Heading","maxLength":60}}}$json$::jsonb, $json${"badge":{"name":"Badge","fields":{"icon":{"type":"select","label":"Icon","options":["truck","shield-check","rotate-ccw","headphones","award","star","heart","zap","lock","clock","globe","check-circle","package","credit-card"]},"label":{"type":"text","label":"Label"},"description":{"type":"text","label":"Description"}}}}$json$::jsonb, '[]'::jsonb, $json${"templates":["index","product","cart","checkout"]}$json$::jsonb, '{}'::jsonb, '{}'::jsonb, 'active'),
        ('productGrid', 'core.product-grid', $json${"name":"Product Grid","type":"productGrid","description":"Responsive product grid with price, rating, and add-to-cart controls.","defaults":{"title":"Featured Products","subtitle":"Products selected from your catalog","columns":4,"rows":2,"showPrice":true,"showRating":true,"showAddToCart":true,"cardStyle":"minimal","sortBy":"newest"},"settings_schema":{"title":{"type":"text","label":"Section Title"},"subtitle":{"type":"text","label":"Subtitle"},"columns":{"type":"range","label":"Columns","min":2,"max":4,"step":1},"rows":{"type":"range","label":"Rows","min":1,"max":4,"step":1},"showPrice":{"type":"toggle","label":"Show Price"},"showRating":{"type":"toggle","label":"Show Rating"},"showAddToCart":{"type":"toggle","label":"Show Add to Cart"},"cardStyle":{"type":"select","label":"Card Style","options":["standard","minimal","detailed"]},"sortBy":{"type":"select","label":"Sort By","options":["newest","price_low","price_high","popular"]}}}$json$::jsonb, '{}'::jsonb, $json$[{"name":"Four column grid","settings":{"columns":4,"rows":2}},{"name":"Three column collection","settings":{"columns":3,"rows":3}}]$json$::jsonb, $json${"templates":["index","collection","search"]}$json$::jsonb, $json${"products":true}$json$::jsonb, '{}'::jsonb, 'active'),
        ('productDetail', 'core.product-detail', $json${"name":"Product Detail","type":"productDetail","description":"Product media, price, variants, cart action, and availability details.","defaults":{"showVendor":false,"showSku":true,"showInventory":true,"showReviews":true,"showShare":true},"settings_schema":{"showSku":{"type":"toggle","label":"Show SKU"},"showInventory":{"type":"toggle","label":"Show Inventory"},"showReviews":{"type":"toggle","label":"Show Reviews"},"showShare":{"type":"toggle","label":"Show Share"}}}$json$::jsonb, '{}'::jsonb, '[]'::jsonb, $json${"templates":["product"]}$json$::jsonb, $json${"product":true}$json$::jsonb, '{}'::jsonb, 'active'),
        ('featuredProducts', 'core.featured-products', $json${"name":"Featured Products","type":"featuredProducts","description":"Curated product rail for featured or new products.","defaults":{"title":"Featured Drops","limit":8,"showAddToCart":true},"settings_schema":{"title":{"type":"text","label":"Title"},"limit":{"type":"range","label":"Product Limit","min":4,"max":12,"step":1},"showAddToCart":{"type":"toggle","label":"Show Add to Cart"}}}$json$::jsonb, '{}'::jsonb, '[]'::jsonb, $json${"templates":["index","product","collection"]}$json$::jsonb, $json${"products":true}$json$::jsonb, '{}'::jsonb, 'active'),
        ('categoryGrid', 'commerce.category-grid', $json${"name":"Category Grid","type":"categoryGrid","description":"Visual category cards linking to filtered shopping views.","defaults":{"title":"Shop by Category","subtitle":"Find exactly what you're looking for","columns":3,"cardStyle":"overlay"},"settings_schema":{"title":{"type":"text","label":"Heading"},"subtitle":{"type":"text","label":"Subheading"},"columns":{"type":"range","label":"Columns","min":2,"max":4,"step":1},"cardStyle":{"type":"select","label":"Card Style","options":["overlay","minimal","bordered"]}}}$json$::jsonb, $json${"category":{"name":"Category Card","fields":{"name":{"type":"text","label":"Name"},"slug":{"type":"text","label":"Slug"},"image":{"type":"image","label":"Image"},"tagline":{"type":"text","label":"Tagline"}}}}$json$::jsonb, '[]'::jsonb, $json${"templates":["index","collection"]}$json$::jsonb, '{}'::jsonb, '{}'::jsonb, 'active'),
        ('brandMarquee', 'commerce.brand-marquee', $json${"name":"Brand Marquee","type":"brandMarquee","description":"Scrolling brand, collection, or campaign strip.","defaults":{"title":"Featured brands","speed":25,"pauseOnHover":true,"brands":[]},"settings_schema":{"title":{"type":"text","label":"Heading"},"speed":{"type":"range","label":"Scroll Speed","min":10,"max":60,"step":5},"pauseOnHover":{"type":"toggle","label":"Pause on Hover"}}}$json$::jsonb, $json${"brand":{"name":"Brand","fields":{"name":{"type":"text","label":"Brand Name"},"logo":{"type":"image","label":"Logo"}}}}$json$::jsonb, '[]'::jsonb, $json${"templates":["index"]}$json$::jsonb, '{}'::jsonb, '{}'::jsonb, 'active'),
        ('newsletter', 'core.newsletter', $json${"name":"Newsletter","type":"newsletter","description":"Email signup section for launch updates and discounts.","defaults":{"title":"Stay in the Loop","subtitle":"Get early access to new drops and exclusive discounts.","buttonText":"Subscribe","placeholder":"Enter your email","successMessage":"Thanks for subscribing!"},"settings_schema":{"title":{"type":"text","label":"Heading"},"subtitle":{"type":"text","label":"Subheading"},"buttonText":{"type":"text","label":"Button Text"},"placeholder":{"type":"text","label":"Placeholder Text"},"successMessage":{"type":"text","label":"Success Message"}}}$json$::jsonb, '{}'::jsonb, '[]'::jsonb, $json${"templates":["index","footer"]}$json$::jsonb, '{}'::jsonb, '{}'::jsonb, 'active'),
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
        'thumbnail_url', '/images/banners/new-arrivals-1.png',
        'preview_url', '/store/urban-kicks-demo'
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
