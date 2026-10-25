import { LiquidThemePackageBundleSchema, type LiquidThemePackageBundle } from '/Volumes/Projects/LetBuyy/packages/theme-engine/src/theme-bundle';
import { createPlayfieldTheme } from '/Volumes/Projects/LetBuyy/packages/theme-engine/src/playfield-theme';

const dimensions = (name: string, labelled = true) => `${labelled ? `{% if ${name}.label != blank %}<strong>{{ ${name}.label }}</strong><br>{% endif %}` : ''}{% if ${name}.length %}Length {{ ${name}.length }} {{ ${name}.unit }}{% endif %}{% if ${name}.width %}{% if ${name}.length %} · {% endif %}Width {{ ${name}.width }} {{ ${name}.unit }}{% endif %}{% if ${name}.height %}{% if ${name}.length or ${name}.width %} · {% endif %}Height {{ ${name}.height }} {{ ${name}.unit }}{% endif %}`;
const ready = `{% assign pf201_ready = true %}{% if product.options.size > 0 %}{% assign pf201_ready = false %}{% endif %}`;
const quick = `${ready}{% if section.settings.showToyFacts %}<div class="pf-product-quick"><p data-lb-toy-field="age">{% if pf201_ready %}{% if product.toys.ageStatement != blank %}{{ product.toys.ageStatement }}{% elsif product.toys.ageBands.size > 0 %}{% for age in product.toys.ageBands %}{{ age }}{% unless forloop.last %}, {% endunless %}{% endfor %} years{% else %}Age information not supplied.{% endif %}{% else %}Choose an edition for age information.{% endif %}</p><a class="pf-link" href="#playfield-product-facts-{{ section.id }}">Contents, dimensions &amp; materials</a><p class="pf-note" data-lb-toy-status role="status" aria-live="polite">{% if pf201_ready %}Product facts supplied by the merchant.{% else %}Choose all options to see facts for the selected edition.{% endif %}</p></div><aside class="pf-warning" data-lb-toy-warnings aria-label="Merchant supplied warnings"{% if pf201_ready and product.toys.warnings.size > 0 %}{% else %} hidden{% endif %}>{% if pf201_ready and product.toys.warnings.size > 0 %}<h2>Read before choosing</h2>{% for warning in product.toys.warnings %}<p>{{ warning.text }}</p><p class="pf-note">Source: {{ warning.sourceLabel }}{% if warning.editionLabel != blank %} · {{ warning.editionLabel }}{% endif %}</p>{% endfor %}{% endif %}</aside>{% endif %}`;
const textFields = (['materials', 'finish', 'care'] as const).map(field => `<div><dt>${field[0].toUpperCase() + field.slice(1)}</dt><dd data-lb-toy-field="${field}">{% if product.toys.${field} != blank %}{{ product.toys.${field} }}{% else %}Not supplied.{% endif %}</dd></div>`).join('');
const facts = `{% if section.settings.showToyFacts %}<section class="pf-facts" id="playfield-product-facts-{{ section.id }}" aria-label="Product contents and facts"><p class="pf-eyebrow">THE DETAILS, BEFORE YOU BUY</p><div class="pf-facts-layout"><div><h2>What’s in the box?</h2><div data-lb-toy-contents>{% if pf201_ready and product.toys.contents.size > 0 %}<ul class="pf-contents">{% assign pf201_total = 0 %}{% for content in product.toys.contents %}{% assign pf201_total = pf201_total | plus: content.quantity %}<li><strong>{{ content.quantity }}</strong><span>{{ content.label }}</span></li>{% endfor %}</ul><p data-lb-toy-contents-completeness>{% if product.toys.contentsComplete %}{{ pf201_total }} items in total, according to the merchant.{% else %}This is a partial contents list supplied by the merchant.{% endif %}</p>{% elsif pf201_ready %}<p>Contents have not been supplied.</p>{% else %}<p>Choose an edition for its included contents.</p>{% endif %}</div></div><div><h2>Know the object.</h2><dl data-lb-toy-details>{% if pf201_ready %}<div><dt>Dimensions</dt><dd data-lb-toy-field="dimensions">{% if product.toys.dimensions %}${dimensions('product.toys.dimensions')}{% else %}Dimensions have not been supplied.{% endif %}</dd></div>{% for measured in product.toys.additionalDimensions %}<div><dt>{{ measured.label }}</dt><dd data-lb-toy-field="additional-dimensions">${dimensions('measured', false)}</dd></div>{% endfor %}${textFields}{% else %}<div><dt>Edition facts</dt><dd>Choose an edition for its measurements and materials.</dd></div>{% endif %}</dl><p class="pf-note">Product information is supplied by the merchant. Age recommendations are guidance for the adult choosing the product.</p></div></div></section>{% endif %}`;

function replaceRange(source: string, start: string, end: string, replacement: string): string {
    const first = source.indexOf(start), last = source.indexOf(end, first);
    if (first < 0 || last < 0 || source.indexOf(start, first + start.length) >= 0) throw new Error('Playfield 2.0.1 requires the unchanged 2.0.0 product section contract.');
    return source.slice(0, first) + replacement + source.slice(last);
}

/** Append-only package. The captured 2.0.0 factory and its styles remain unchanged. */
export function createPlayfieldThemeV201(base: LiquidThemePackageBundle): LiquidThemePackageBundle {
    const bundle = createPlayfieldTheme(base);
    bundle.package = { ...bundle.package, version: '2.0.1', version_number: 3 };
    const product = bundle.sections['product-detail'];
    const root = '<section class="lb-product-detail" data-section-id="{{ section.id }}">';
    if (!product.source.includes(root)) throw new Error('Playfield 2.0.1 requires the canonical product section root.');
    product.source = product.source.replace(root, '<section class="lb-product-detail" data-section-id="{{ section.id }}" data-product-id="{{ product.id }}" data-lb-variant-facts data-lb-facts-namespace="toys" data-lb-toy-presentation="1" data-lb-toy-facts-enabled="{{ section.settings.showToyFacts }}" data-toys-facts="{{ product.toys_resolved_json }}">');
    product.source = replaceRange(product.source, '<div class="pf-product-quick">', '\n  {% if product.options.size > 0 %}<lb-variant-picker', quick);
    product.source = replaceRange(product.source, '{% if section.settings.showToyFacts %}<section class="pf-facts"', '\n  {% if section.settings.showReviews and product.reviews.size > 0 %}', facts);
    // The related-products description is a declared merchant presentation field.
    const related = bundle.sections['featured-products'];
    const relatedTitle = '<h2>{{ section.settings.title }}</h2>';
    if (!related || !related.source.includes(relatedTitle)
        || related.source.indexOf(relatedTitle) !== related.source.lastIndexOf(relatedTitle)) {
        throw new Error('Playfield 2.0.1 requires the unchanged related-products heading contract.');
    }
    related.source = related.source.replace(relatedTitle, `${relatedTitle}{% if section.settings.subtitle != blank %}<p>{{ section.settings.subtitle }}</p>{% endif %}`);
    return LiquidThemePackageBundleSchema.parse(bundle);
}
