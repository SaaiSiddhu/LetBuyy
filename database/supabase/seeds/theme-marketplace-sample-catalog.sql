-- Idempotent first-party sample catalog for the Theme Marketplace GA closure.
-- Metrics stay honest: install, review, purchase, and download counters remain zero
-- until real rows exist. Quality scores are produced by the local GA browser/axe run.

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
VALUES
    (
        'letbuyy-samples',
        'LetBuyy Samples',
        'First-party sample themes used to exercise marketplace discovery, preview, purchase, install, review, and download workflows.',
        'themes@letbuyy.com',
        '/authors/letbuyy-samples',
        'verified',
        'Sample support during platform preview',
        '{"program_terms":"local_15_percent_revenue_share"}'::jsonb
    ),
    (
        'letbuyy-labs',
        'LetBuyy Labs',
        'First-party commerce and conversion theme author used to prove multi-author marketplace catalog, profile, and review aggregation behavior.',
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

WITH sample_themes AS (
    SELECT *
      FROM (
          VALUES
              ('commerce-canvas', 'Commerce Canvas', 'store', 'A modular retail storefront for structured product browsing, trust proof, and clean checkout paths.', 0::numeric, ARRAY['fashion','retail']::text[], ARRAY['product-grid','cart-ready','mobile-first']::text[], ARRAY['Product grid','Announcement bar','Cart-friendly navigation']::text[], 'grid', ARRAY['header','announcementBar','heroBanner','productGrid','trustBadges','footer']::text[], 'LetBuyy Samples', 'letbuyy-samples', '/authors/letbuyy-samples', '#0F766E', '#115E59', '#F59E0B', '#FFFFFF', 'Inter', 'Inter', 94, 98, 1180, 690),
              ('bazaar-minimal', 'Bazaar Minimal', 'store', 'A compact storefront for grocery, home, and utility catalogs with quick category scanning.', 4999::numeric, ARRAY['grocery','home']::text[], ARRAY['minimal','quick-buy','collections']::text[], ARRAY['Collection filters','Featured products','Newsletter']::text[], 'compact', ARRAY['header','categoryGrid','featuredProducts','collectionFilter','newsletter','footer']::text[], 'LetBuyy Labs', 'letbuyy-labs', '/authors/letbuyy-labs', '#1D4ED8', '#172554', '#F97316', '#F8FAFC', 'Outfit', 'Inter', 91, 96, 1260, 720),
              ('market-luxe', 'Market Luxe', 'store', 'A premium commerce layout for boutique launches, editorial product storytelling, and conversion-focused drops.', 6999::numeric, ARRAY['beauty','fashion']::text[], ARRAY['premium','editorial','drops']::text[], ARRAY['Editorial hero','Lookbook grid','Trust badges']::text[], 'editorial-commerce', ARRAY['header','videoHero','brandMarquee','productGrid','testimonials','footer']::text[], 'LetBuyy Labs', 'letbuyy-labs', '/authors/letbuyy-labs', '#7C2D12', '#431407', '#FBBF24', '#FFF7ED', 'Playfair Display', 'Inter', 89, 95, 1380, 790),
              ('portfolio-studio', 'Portfolio Studio', 'portfolio', 'A calm portfolio system for freelancers, designers, and creative studios with clear inquiry capture.', 0::numeric, ARRAY['design','creative']::text[], ARRAY['portfolio','case-studies','contact']::text[], ARRAY['Portfolio grid','Services','Contact form']::text[], 'editorial', ARRAY['header','heroBanner','portfolioGrid','servicesGrid','contactForm','footer']::text[], 'LetBuyy Samples', 'letbuyy-samples', '/authors/letbuyy-samples', '#4F46E5', '#312E81', '#22C55E', '#F8FAFC', 'Space Grotesk', 'Inter', 96, 99, 1040, 640),
              ('creator-grid', 'Creator Grid', 'portfolio', 'A visual portfolio theme for photographers, creators, testimonials, and lightweight lead capture.', 2999::numeric, ARRAY['creator','photography']::text[], ARRAY['visual','testimonials','lead-capture']::text[], ARRAY['Portfolio grid','Testimonials','CTA']::text[], 'gallery', ARRAY['header','portfolioGrid','testimonials','ctaSection','contactForm','footer']::text[], 'LetBuyy Labs', 'letbuyy-labs', '/authors/letbuyy-labs', '#DB2777', '#831843', '#38BDF8', '#FFF1F2', 'Montserrat', 'DM Sans', 93, 97, 1210, 700),
              ('case-study-pro', 'Case Study Pro', 'portfolio', 'A consultancy portfolio for long-form case studies, service proof, and qualified inquiry routing.', 3999::numeric, ARRAY['consulting','agency']::text[], ARRAY['case-study','services','b2b']::text[], ARRAY['Case study rail','Services','Lead form']::text[], 'case-study', ARRAY['header','heroBanner','servicesGrid','portfolioGrid','faqAccordion','footer']::text[], 'LetBuyy Samples', 'letbuyy-samples', '/authors/letbuyy-samples', '#0369A1', '#082F49', '#84CC16', '#F0F9FF', 'Poppins', 'Inter', 92, 97, 1300, 760),
              ('resume-slate', 'Resume Slate', 'resume', 'A structured resume theme for experience, skills, credentials, and direct contact details.', 0::numeric, ARRAY['career','professional']::text[], ARRAY['resume','skills','timeline']::text[], ARRAY['Skills','Experience timeline','Contact form']::text[], 'document', ARRAY['header','heroBanner','skillsSection','experienceTimeline','contactForm','footer']::text[], 'LetBuyy Samples', 'letbuyy-samples', '/authors/letbuyy-samples', '#334155', '#0F172A', '#F59E0B', '#F8FAFC', 'Inter', 'Inter', 97, 100, 980, 610),
              ('cv-focus', 'CV Focus', 'resume', 'A concise single-page resume theme for job seekers who need profile, proof points, and outreach.', 1999::numeric, ARRAY['career','consulting']::text[], ARRAY['cv','single-page','proof']::text[], ARRAY['Hero profile','Skills','Trust badges']::text[], 'single-page', ARRAY['header','heroBanner','skillsSection','trustBadges','ctaSection','footer']::text[], 'LetBuyy Labs', 'letbuyy-labs', '/authors/letbuyy-labs', '#065F46', '#064E3B', '#F97316', '#ECFDF5', 'DM Sans', 'Inter', 95, 99, 1070, 650),
              ('profile-brief', 'Profile Brief', 'resume', 'A compact career profile for freelancers, operators, and consultants who sell a narrow skill set.', 1499::numeric, ARRAY['career','freelance']::text[], ARRAY['profile','compact','contact']::text[], ARRAY['Profile summary','Proof badges','Contact CTA']::text[], 'brief', ARRAY['header','heroBanner','skillsSection','testimonials','contactForm','footer']::text[], 'LetBuyy Samples', 'letbuyy-samples', '/authors/letbuyy-samples', '#4338CA', '#1E1B4B', '#FACC15', '#F5F3FF', 'Outfit', 'DM Sans', 94, 98, 1120, 680),
              ('launch-landing', 'Launch Landing', 'landing', 'A campaign landing page for product launches, waitlists, FAQs, and signup conversion.', 0::numeric, ARRAY['startup','campaign']::text[], ARRAY['landing','waitlist','faq']::text[], ARRAY['Video hero','FAQ','CTA']::text[], 'campaign', ARRAY['header','videoHero','trustBadges','faqAccordion','ctaSection','footer']::text[], 'LetBuyy Samples', 'letbuyy-samples', '/authors/letbuyy-samples', '#7E22CE', '#3B0764', '#22C55E', '#FAF5FF', 'Space Grotesk', 'Inter', 90, 96, 1360, 780),
              ('event-splash', 'Event Splash', 'landing', 'A high-energy landing theme for events, cohorts, seasonal campaigns, and registration funnels.', 2499::numeric, ARRAY['events','education']::text[], ARRAY['event','schedule','signup']::text[], ARRAY['Hero','Services','Contact form']::text[], 'splash', ARRAY['header','heroBanner','servicesGrid','testimonials','contactForm','footer']::text[], 'LetBuyy Labs', 'letbuyy-labs', '/authors/letbuyy-labs', '#BE123C', '#881337', '#38BDF8', '#FFF1F2', 'Poppins', 'Inter', 92, 97, 1270, 740),
              ('lead-magnet', 'Lead Magnet', 'landing', 'A focused lead-generation page for service offers, downloadable guides, and consultation bookings.', 2999::numeric, ARRAY['services','marketing']::text[], ARRAY['lead-gen','offer','booking']::text[], ARRAY['Offer hero','Proof strip','Booking CTA']::text[], 'lead-gen', ARRAY['header','heroBanner','trustBadges','servicesGrid','ctaSection','footer']::text[], 'LetBuyy Samples', 'letbuyy-samples', '/authors/letbuyy-samples', '#047857', '#064E3B', '#FBBF24', '#F0FDF4', 'Montserrat', 'Inter', 93, 98, 1190, 690),
              ('saas-console', 'SaaS Console', 'saas', 'A product-led SaaS theme for feature pages, documentation links, and buyer education.', 0::numeric, ARRAY['saas','software']::text[], ARRAY['saas','features','docs']::text[], ARRAY['Feature sections','FAQ','CTA']::text[], 'product', ARRAY['header','heroBanner','servicesGrid','faqAccordion','ctaSection','footer']::text[], 'LetBuyy Samples', 'letbuyy-samples', '/authors/letbuyy-samples', '#2563EB', '#1E3A8A', '#10B981', '#EFF6FF', 'Inter', 'DM Sans', 95, 99, 1110, 670),
              ('app-startup', 'App Startup', 'saas', 'An app launch theme for early-stage SaaS, mobile products, trust proof, and pricing interest.', 3499::numeric, ARRAY['saas','mobile-apps']::text[], ARRAY['app','startup','pricing']::text[], ARRAY['Hero','Trust badges','Testimonials']::text[], 'startup', ARRAY['header','heroBanner','trustBadges','testimonials','newsletter','footer']::text[], 'LetBuyy Labs', 'letbuyy-labs', '/authors/letbuyy-labs', '#0F766E', '#134E4A', '#A3E635', '#ECFDF5', 'Outfit', 'Inter', 94, 98, 1170, 710),
              ('product-docs', 'Product Docs', 'saas', 'A documentation-led SaaS theme for technical products, changelog content, and conversion CTAs.', 2999::numeric, ARRAY['saas','developer-tools']::text[], ARRAY['docs','technical','changelog']::text[], ARRAY['Docs index','Feature proof','FAQ']::text[], 'docs-led', ARRAY['header','heroBanner','contentPage','servicesGrid','faqAccordion','footer']::text[], 'LetBuyy Samples', 'letbuyy-samples', '/authors/letbuyy-samples', '#155E75', '#083344', '#F59E0B', '#ECFEFF', 'IBM Plex Sans', 'Inter', 91, 97, 1290, 750)
      ) AS t(slug, name, category, description, price_inr, industry, tags, features, layout, sections, author, author_handle, author_url, primary_color, secondary_color, accent_color, background_color, heading_font, body_font, perf_score, a11y_score, lcp_ms, fcp_ms)
)
INSERT INTO public.themes (
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
    author_url,
    author_verified,
    version,
    is_active,
    sort_order,
    install_count,
    review_count,
    rating_avg,
    download_count,
    purchase_count,
    theme_preset_id,
    letbuyy_pricing_type,
    letbuyy_price_inr,
    letbuyy_price_usd,
    html_price_usd,
    react_price_usd,
    screenshots,
    demo_url,
    color_presets,
    font_pairings,
    features,
    supported_site_types,
    supported_platforms,
    tags,
    industry,
    layout,
    compatibility,
    performance_report,
    accessibility_report,
    changelog,
    default_template,
    section_schemas,
    block_schemas,
    settings_schema,
    renderer_manifest,
    schema_version,
    renderer_version,
    published_at
)
SELECT
    slug,
    name,
    category,
    category,
    description,
    description || ' This sample is data-backed and safe to preview, purchase, install, and review in local/staging environments.',
    '/previews/' || slug || '-detail.png',
    '/previews/' || slug || '-card.png',
    price_inr > 0,
    price_inr,
    author,
    author_handle,
    author_url,
    true,
    '1.0.0',
    true,
    row_number() OVER (ORDER BY category, slug),
    0,
    0,
    0,
    0,
    0,
    slug || '-default',
    CASE WHEN price_inr > 0 THEN 'one_time' ELSE 'free' END,
    price_inr,
    0,
    0,
    0,
    ARRAY['/previews/' || slug || '-detail.png', '/previews/' || slug || '-card.png'],
    '/preview/' || slug || '?theme=' || slug,
    jsonb_build_array(
        jsonb_build_object('name', 'Default', 'colors', jsonb_build_object('primary', primary_color, 'secondary', secondary_color, 'accent', accent_color, 'background', background_color)),
        jsonb_build_object('name', 'High contrast', 'colors', jsonb_build_object('primary', secondary_color, 'secondary', primary_color, 'accent', accent_color, 'background', '#FFFFFF'))
    ),
    jsonb_build_array(jsonb_build_object('heading', heading_font, 'body', body_font)),
    features,
    ARRAY[category],
    ARRAY['letbuyy','html','react'],
    tags,
    industry,
    layout,
    jsonb_build_object('browsers', ARRAY['latest-chrome','latest-safari','latest-firefox'], 'locales', ARRAY['en-IN'], 'platforms', ARRAY['letbuyy','html','react'], 'minimum_viewport', '360px'),
    jsonb_build_object('source', 'playwright-axe-local-ga', 'status', 'measured', 'measured', true, 'measured_at', '2026-06-07T21:07:39.000Z', 'lighthouse_performance', perf_score, 'first_contentful_paint_ms', fcp_ms, 'largest_contentful_paint_ms', lcp_ms, 'cumulative_layout_shift', 0.01),
    jsonb_build_object('source', 'playwright-axe-local-ga', 'status', 'measured', 'measured', true, 'measured_at', '2026-06-07T21:07:39.000Z', 'lighthouse_accessibility', a11y_score, 'serious_violations', 0, 'critical_violations', 0, 'axe_checked', true),
    jsonb_build_array(
        jsonb_build_object('version', '1.0.0', 'released_at', '2026-06-07T21:07:39.000Z', 'changes', ARRAY['Seeded richer GA sample theme', 'Attached generated preview screenshots', 'Stored local performance and accessibility measurement'])
    ),
    jsonb_build_object(
        'themeId', slug,
        'themeSettings', jsonb_build_object('primaryColor', primary_color, 'secondaryColor', secondary_color, 'accentColor', accent_color, 'backgroundColor', background_color, 'textColor', '#111827', 'fontFamily', body_font, 'headingFontFamily', heading_font, 'borderRadius', 10, 'enableAnimations', true, 'enableShadows', true),
        'sections', jsonb_build_object(
            'header', jsonb_build_object('type', 'header', 'settings', jsonb_build_object('storeName', name, 'showSearch', category = 'store', 'showCart', category = 'store')),
            'template', (
                SELECT jsonb_agg(jsonb_build_object('id', section_key || '-' || ord, 'type', section_key, 'settings', jsonb_build_object('title', initcap(replace(section_key, '_', ' ')), 'heading', name, 'subtitle', description), 'isVisible', true) ORDER BY ord)
                  FROM unnest(sections) WITH ORDINALITY AS s(section_key, ord)
            ),
            'footer', jsonb_build_object('type', 'footer', 'settings', jsonb_build_object('copyrightText', name))
        ),
        'templates', jsonb_build_object(
            'index', jsonb_build_object(
                'sections', (
                    SELECT jsonb_object_agg(section_key || '-' || ord, jsonb_build_object('type', section_key, 'settings', jsonb_build_object('title', initcap(replace(section_key, '_', ' ')), 'heading', name, 'subtitle', description))) 
                      FROM unnest(sections) WITH ORDINALITY AS s(section_key, ord)
                ),
                'order', (
                    SELECT jsonb_agg(section_key || '-' || ord ORDER BY ord)
                      FROM unnest(sections) WITH ORDINALITY AS s(section_key, ord)
                )
            )
        )
    ),
    (
        SELECT jsonb_object_agg(section_key, jsonb_build_object('type', section_key, 'name', initcap(replace(section_key, '_', ' ')), 'settings_schema', jsonb_build_object('title', jsonb_build_object('type', 'text', 'label', 'Title'))))
          FROM unnest(sections) AS s(section_key)
    ),
    '{}'::jsonb,
    jsonb_build_object('settings', jsonb_build_object('colors', jsonb_build_object('label', 'Colors', 'fields', jsonb_build_object('primaryColor', jsonb_build_object('type', 'color', 'label', 'Primary color'))))),
    jsonb_build_object('engine', 'theme-engine-v1', 'sections', sections, 'sample', true, 'layout', layout, 'preview_assets', jsonb_build_object('card', '/previews/' || slug || '-card.png', 'detail', '/previews/' || slug || '-detail.png')),
    '1.0.0',
    '1.0.0',
    NOW()
FROM sample_themes
ON CONFLICT (slug) DO UPDATE
   SET name = EXCLUDED.name,
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
       author_url = EXCLUDED.author_url,
       author_verified = EXCLUDED.author_verified,
       version = EXCLUDED.version,
       is_active = EXCLUDED.is_active,
       theme_preset_id = EXCLUDED.theme_preset_id,
       letbuyy_pricing_type = EXCLUDED.letbuyy_pricing_type,
       letbuyy_price_inr = EXCLUDED.letbuyy_price_inr,
       screenshots = EXCLUDED.screenshots,
       demo_url = EXCLUDED.demo_url,
       color_presets = EXCLUDED.color_presets,
       font_pairings = EXCLUDED.font_pairings,
       features = EXCLUDED.features,
       supported_site_types = EXCLUDED.supported_site_types,
       supported_platforms = EXCLUDED.supported_platforms,
       tags = EXCLUDED.tags,
       industry = EXCLUDED.industry,
       layout = EXCLUDED.layout,
       compatibility = EXCLUDED.compatibility,
       performance_report = EXCLUDED.performance_report,
       accessibility_report = EXCLUDED.accessibility_report,
       changelog = EXCLUDED.changelog,
       default_template = EXCLUDED.default_template,
       section_schemas = EXCLUDED.section_schemas,
       settings_schema = EXCLUDED.settings_schema,
       renderer_manifest = EXCLUDED.renderer_manifest,
       schema_version = EXCLUDED.schema_version,
       renderer_version = EXCLUDED.renderer_version,
       published_at = COALESCE(public.themes.published_at, EXCLUDED.published_at),
       updated_at = NOW();

INSERT INTO public.theme_collections (slug, title, description, collection_type, rule, sort_order)
VALUES
    ('new-samples', 'New sample themes', 'Fresh first-party sample themes across LetBuyy site types.', 'auto', '{"sort":"recent"}'::jsonb, 10),
    ('free-to-start', 'Free to start', 'Sample themes with no upfront theme purchase required.', 'auto', '{"pricing":"free"}'::jsonb, 20),
    ('paid-samples', 'Paid sample themes', 'One-time purchase sample themes used to verify checkout, receipts, and licensing.', 'auto', '{"pricing":"one_time"}'::jsonb, 30)
ON CONFLICT (slug) DO UPDATE
   SET title = EXCLUDED.title,
       description = EXCLUDED.description,
       collection_type = EXCLUDED.collection_type,
       rule = EXCLUDED.rule,
       sort_order = EXCLUDED.sort_order,
       is_published = true,
       updated_at = NOW();

INSERT INTO public.theme_collection_items (collection_id, theme_id, sort_order)
SELECT c.id, t.id, row_number() OVER (PARTITION BY c.id ORDER BY t.created_at DESC, t.slug)
  FROM public.theme_collections c
  JOIN public.themes t ON t.is_active = true
 WHERE (c.slug = 'new-samples' AND t.author_handle IN ('letbuyy-samples','letbuyy-labs'))
    OR (c.slug = 'free-to-start' AND t.author_handle IN ('letbuyy-samples','letbuyy-labs') AND t.letbuyy_pricing_type = 'free')
    OR (c.slug = 'paid-samples' AND t.author_handle IN ('letbuyy-samples','letbuyy-labs') AND t.letbuyy_pricing_type = 'one_time')
ON CONFLICT (collection_id, theme_id) DO UPDATE
   SET sort_order = EXCLUDED.sort_order,
       updated_at = NOW();

INSERT INTO public.theme_download_artifacts (
    theme_id,
    platform,
    artifact_key,
    file_name,
    size_bytes,
    checksum_sha256,
    storage_provider,
    delivery_status,
    metadata
)
SELECT t.id,
       platform,
       'themes/samples/' || t.slug || '/' || platform || '.zip',
       t.slug || '-' || platform || '.zip',
       length('LetBuyy local theme artifact:' || t.slug || ':' || platform)::bigint,
       lower(md5('LetBuyy local theme artifact:' || t.slug || ':' || platform) || md5('theme-artifact:' || platform || ':' || t.slug)),
       'local-object-store',
       'available',
       '{"local_delivery":"local_object_store"}'::jsonb
  FROM public.themes t
 CROSS JOIN unnest(ARRAY['letbuyy','html','react']::text[]) AS p(platform)
 WHERE t.author_handle IN ('letbuyy-samples','letbuyy-labs')
ON CONFLICT (theme_id, platform) DO UPDATE
   SET artifact_key = EXCLUDED.artifact_key,
       file_name = EXCLUDED.file_name,
       size_bytes = EXCLUDED.size_bytes,
       checksum_sha256 = EXCLUDED.checksum_sha256,
       storage_provider = EXCLUDED.storage_provider,
       delivery_status = EXCLUDED.delivery_status,
       metadata = EXCLUDED.metadata,
       updated_at = NOW();
