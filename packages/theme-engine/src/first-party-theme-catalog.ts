import { listExperiences, buildExperienceSettingsOverlay } from './theme-presets';
import { createLetbuyyCoreLiquidThemeBundleFixture } from './theme-bundle-core';
import { LiquidThemePackageBundleSchema, isLiquidAppBlockType, type LiquidThemePackageBundle } from './theme-bundle';
import { createThreadlineTheme } from './threadline-theme';
import { createThreadlineThemeV201 } from './threadline-theme-v201';
import { createPlayfieldTheme } from './playfield-theme';
import { createPlayfieldThemeV201 } from './playfield-theme-v201';
import { createPlayfieldThemeV202 } from './playfield-theme-v202';
import { createCircuitTheme } from './circuit-theme';
import { createCircuitThemeV201 } from './circuit-theme-v201';
import { createPantryTheme } from './pantry-theme';
import { createPantryThemeV201 } from './pantry-theme-v201';
import { createHabitatTheme } from './habitat-theme';
import { createKindredTheme } from './kindred-theme';
import { createMadeYoursTheme } from './madeyours-theme';
import { createDewdropTheme } from './dewdrop-theme';
import { createDewdropThemeV201 } from './dewdrop-theme-v201';
import { createTrailmarkTheme } from './trailmark-theme';
import { createTrailmarkThemeV201 } from './trailmark-theme-v201';
import { createMarginaliaTheme } from './marginalia-theme';
import { withNicheOrderPresentation } from './niche-order-presentation';

/** Starting design for new stores; existing selections remain durable merchant state. */
export { DEFAULT_STOREFRONT_THEME_SLUG } from '@letbuyy/shared-types';

// Explicit distribution input only. Persisted version selection remains the catalog's authority.
const NICHE_V2 = {
    bloom: { name: 'Playfield', category: 'toys', factory: createPlayfieldTheme },
    forge: { name: 'Circuit', category: 'electronics', factory: createCircuitTheme },
    refresh: { name: 'Pantry', category: 'food', factory: createPantryTheme },
    craft: { name: 'Habitat', category: 'furniture', factory: createHabitatTheme },
    summit: { name: 'Kindred', category: 'gifts', factory: createKindredTheme },
    nova: { name: 'MadeYours', category: 'personalized', factory: createMadeYoursTheme },
    aura: { name: 'Dewdrop', category: 'beauty', factory: createDewdropTheme },
    ride: { name: 'Trailmark', category: 'sports', factory: createTrailmarkTheme },
    dawn: { name: 'Marginalia', category: 'books', factory: createMarginaliaTheme },
} as const;
type CatalogBuildOptions = { customizationVersion?: '2.1.0'; designVersion?: '2.0.0'; playfieldVersion?: '2.0.1' | '2.0.2'; circuitVersion?: '2.0.1'; pantryVersion?: '2.0.1'; trailmarkVersion?: '2.0.1'; threadlineVersion?: '2.0.1'; dewdropVersion?: '2.0.1' };
// Identity is independent of catalog order and display copy. Existing Core/Urban
// Kicks stores and their saved experience selections are deliberately untouched.
const IDENTITIES: Readonly<Record<string, string>> = {
    forge: '7b669c70-0000-4000-8000-000000000001',
    sense: '7b669c70-0000-4000-8000-000000000002',
    aura: '7b669c70-0000-4000-8000-000000000003',
    craft: '7b669c70-0000-4000-8000-000000000004',
    refresh: '7b669c70-0000-4000-8000-000000000005',
    ride: '7b669c70-0000-4000-8000-000000000006',
    dawn: '7b669c70-0000-4000-8000-000000000007',
    bloom: '7b669c70-0000-4000-8000-000000000008',
    nova: '7b669c70-0000-4000-8000-000000000009',
    summit: '7b669c70-0000-4000-8000-000000000010',
};
/** Distribution input for the persisted themes catalog, not a second live catalog. */
export function firstPartyThemeListings(options: CatalogBuildOptions = {}) {
    return listExperiences().map(experience => {
        const id = IDENTITIES[experience.id];
        if (!id)
            throw new Error(`Missing stable theme identity: ${experience.id}`);
        const niche = options.designVersion === '2.0.0' && Object.hasOwn(NICHE_V2, experience.id)
            ? NICHE_V2[experience.id as keyof typeof NICHE_V2] : undefined;
        return {
            id, slug: `letbuyy-${experience.id}`, name: niche?.name ?? experience.name,
            presetId: experience.id, description: experience.description,
            category: niche?.category ?? (experience.industry || 'General'),
            thumbnail: experience.id === 'sense' ? '/theme-previews/threadline-2.0.0.webp' : `/theme-previews/${experience.id}.svg`,
            settings: buildExperienceSettingsOverlay(experience),
            preview: experience.preview,
        };
    });
}
export function createFirstPartyCatalogBundle(slug: string, options: CatalogBuildOptions = {}): LiquidThemePackageBundle {
    if (options.customizationVersion === '2.1.0') {
        return withFirstPartyChildOutlets(createFirstPartyCatalogBundle(slug, { designVersion: '2.0.0',
            playfieldVersion: '2.0.2', circuitVersion: '2.0.1', pantryVersion: '2.0.1',
            trailmarkVersion: '2.0.1', threadlineVersion: '2.0.1', dewdropVersion: '2.0.1' }));
    }
    const listing = firstPartyThemeListings(options).find(theme => theme.slug === slug);
    if (!listing)
        throw new Error('Unknown first-party catalog theme');
    const bundle = createLetbuyyCoreLiquidThemeBundleFixture();
    bundle.package.slug = slug;
    bundle.package.name = listing.name;
    const configured = LiquidThemePackageBundleSchema.parse({ ...bundle, config: { ...bundle.config,
            settings_data: { ...bundle.config.settings_data, current: {
                    ...bundle.config.settings_data.current, ...listing.settings,
                } },
        } });
    if (listing.presetId === 'sense') {
        return options.threadlineVersion === '2.0.1'
            ? createThreadlineThemeV201(configured)
            : createThreadlineTheme(configured);
    }
    if (options.designVersion === '2.0.0' && Object.hasOwn(NICHE_V2, listing.presetId)) {
        if (listing.presetId === 'aura' && options.dewdropVersion === '2.0.1') {
            return createDewdropThemeV201(configured);
        }
        if (listing.presetId === 'forge' && options.circuitVersion === '2.0.1') {
            return createCircuitThemeV201(configured);
        }
        if (listing.presetId === 'refresh' && options.pantryVersion === '2.0.1') {
            return createPantryThemeV201(configured);
        }
        if (listing.presetId === 'ride' && options.trailmarkVersion === '2.0.1') {
            return createTrailmarkThemeV201(configured);
        }
        if (listing.presetId === 'bloom' && options.playfieldVersion === '2.0.2') {
            return createPlayfieldThemeV202(configured);
        }
        if (listing.presetId === 'bloom' && options.playfieldVersion === '2.0.1') {
            return withNicheOrderPresentation(createPlayfieldThemeV201(configured));
        }
        return withNicheOrderPresentation(NICHE_V2[listing.presetId as keyof typeof NICHE_V2].factory(configured));
    }
    return configured;
}

// An explicit distribution revision only. Captured/default versions are immutable;
// persisted catalog selection remains the authority for an installed package.
const CHILD_OUTLET = '{% for child in block.sub_blocks %}{% unless child.is_app_block %}{{ child.html | raw }}{% endunless %}{% endfor %}';
const ROOT_BADGE_OUTLET = "{% for block in section.blocks %}{{ block.content | raw }}{% endfor %}";

/** Transform one exact, factory-owned block loop without changing its surrounding markup. */
function blockLoop(source: string, transform: (body: string) => string): string {
    const opening = '{% for block in section.blocks %}', start = source.indexOf(opening);
    if (start < 0 || source.indexOf(opening, start + opening.length) >= 0) throw new Error('Expected one canonical first-party block loop');
    const bodyStart = start + opening.length, tokens = /{%\s*(for|endfor)\b[^%]*%}/g;
    tokens.lastIndex = bodyStart;
    let depth = 1, end = -1, token: RegExpExecArray | null;
    while ((token = tokens.exec(source))) {
        depth += token[1] === 'for' ? 1 : -1;
        if (!depth) { end = token.index; break; }
    }
    if (end < 0) throw new Error('Unclosed canonical first-party block loop');
    return source.slice(0, bodyStart) + transform(source.slice(bodyStart, end)) + source.slice(end);
}

function withInlineChildOutlet(body: string): string {
    // Some niche blocks wrap their existing root in a Liquid condition. Place the
    // outlet within the final existing element while preserving that condition.
    const closings = [...body.matchAll(/<\/[a-z][a-z0-9-]*\s*>/gi)], last = closings.at(-1);
    if (!last || last.index === undefined) throw new Error('Expected canonical first-party block element boundary');
    return body.slice(0, last.index) + CHILD_OUTLET + body.slice(last.index);
}

function withFirstPartyChildOutlets(base: LiquidThemePackageBundle): LiquidThemePackageBundle {
    const bundle = structuredClone(base), badge = bundle.blocks.badge;
    if (!badge || badge.schema.settings.find(field => field.id === 'label')?.type !== 'text'
        || badge.source.split('</span>').length !== 2) throw new Error('Expected canonical reusable badge contract');
    badge.source = badge.source.replace('</span>', CHILD_OUTLET + '</span>');
    for (const file of Object.values(bundle.sections)) {
        if (!file.schema.blocks.some(block => !isLiquidAppBlockType(block.type))) continue;
        file.source = blockLoop(file.source, body => /block\.(?:content|html)\b/.test(body) ? body : withInlineChildOutlet(body));
    }
    // The existing service-information section is the semantic host. No default
    // blocks, extra fields, section IDs or theme layout changes are introduced.
    const host = bundle.sections['trust-badges'];
    if (!host || host.source.match(/{% schema %}[\s\S]*?{% endschema %}/g)?.length !== 1) throw new Error('Expected canonical badge host schema');
    if (!host.schema.blocks.some(block => block.type === 'badge')) {
        if (host.schema.blocks.length) {
            host.source = blockLoop(host.source, body => "{% if block.type == 'badge' %}{{ block.content | raw }}{% else %}" + body + '{% endif %}');
        } else {
            const end = host.source.lastIndexOf('</section>');
            if (end < 0) throw new Error('Expected existing service-information section boundary');
            host.source = host.source.slice(0, end) + ROOT_BADGE_OUTLET + host.source.slice(end);
        }
        host.schema.blocks.push({ type: 'badge', name: badge.schema.name, settings: structuredClone(badge.schema.settings) });
        host.source = host.source.replace(/{% schema %}[\s\S]*?{% endschema %}/, '{% schema %}\n' + JSON.stringify(host.schema) + '\n{% endschema %}');
    }
    bundle.package = { ...bundle.package, version: '2.1.0', version_number: 5 };
    delete bundle.package.checksum;
    return LiquidThemePackageBundleSchema.parse(bundle);
}

const childOutletReferences = new Map<string, LiquidThemePackageBundle>();
const sameDefinition = (left: unknown, right: unknown): boolean => {
    if (left === right) return true;
    if (!left || !right || typeof left !== 'object' || typeof right !== 'object') return false;
    if (Array.isArray(left) || Array.isArray(right)) return Array.isArray(left) && Array.isArray(right)
        && left.length === right.length && left.every((entry, index) => sameDefinition(entry, right[index]));
    const a = left as Record<string, unknown>, b = right as Record<string, unknown>, keys = Object.keys(a);
    return keys.length === Object.keys(b).length && keys.every(key => Object.hasOwn(b, key) && sameDefinition(a[key], b[key]));
};

/** Exact installed definitions, never a version-only or source-substring capability. */
export function qualifiedFirstPartyInlineChildParents(bundle: LiquidThemePackageBundle, sectionType: string): string[] {
    if (bundle.package.version !== '2.1.0' || bundle.package.version_number !== 5
        || !firstPartyThemeListings({ designVersion: '2.0.0' }).some(theme => theme.slug === bundle.package.slug)) return [];
    let reference = childOutletReferences.get(bundle.package.slug);
    if (!reference) {
        reference = createFirstPartyCatalogBundle(bundle.package.slug, { customizationVersion: '2.1.0' });
        childOutletReferences.set(bundle.package.slug, reference);
    }
    const file = bundle.sections[sectionType], expected = reference.sections[sectionType];
    if (!file || !expected || !sameDefinition(file, expected) || !sameDefinition(bundle.blocks, reference.blocks)) return [];
    // Reusable parents keep their existing undefined/empty/allowlist semantics.
    return file.schema.blocks.filter(block => !isLiquidAppBlockType(block.type) && !Object.hasOwn(bundle.blocks, block.type)).map(block => block.type);
}
