import { createRequire } from 'node:module';
const require = createRequire('/Volumes/Projects/LetBuyy/apps/merchant/web/package.json');
const { parseLiquidThemePackageBundle } = require('@letbuyy/theme-engine');

export const CHILD_OUTLET = '{% for child in block.sub_blocks %}{% unless child.is_app_block %}{{ child.html | raw }}{% endunless %}{% endfor %}';

function inlineOutlet(source) {
    if (source.includes(CHILD_OUTLET)) return source;
    const opening = '{% for block in section.blocks %}';
    const start = source.indexOf(opening);
    if (start < 0 || source.indexOf(opening, start + opening.length) >= 0) throw new Error('Expected one captured first-party block loop');
    const bodyStart = start + opening.length;
    const tokens = /{%\s*(for|endfor)\b[^%]*%}/g;
    tokens.lastIndex = bodyStart;
    let depth = 1, end = -1, token;
    while ((token = tokens.exec(source))) {
        depth += token[1] === 'for' ? 1 : -1;
        if (!depth) { end = token.index; break; }
    }
    if (end < 0) throw new Error('Unclosed captured first-party block loop');
    const body = source.slice(bodyStart, end);
    const root = /^\s*<([a-z][a-z0-9-]*)\b/i.exec(body)?.[1];
    if (!root) throw new Error('Expected existing first-party block root element');
    const closing = `</${root}>`, close = body.lastIndexOf(closing);
    if (close < 0 || body.slice(close + closing.length).trim()) throw new Error('Expected exact captured block root closing boundary');
    return source.slice(0, bodyStart) + body.slice(0, close) + CHILD_OUTLET + body.slice(close) + source.slice(end);
}

/** Explicit private successor proposal; never called by any current/default builder. */
export function withKindredChildOutlets(base) {
    if (base.package.slug !== 'letbuyy-summit' || base.package.version !== '2.0.0') throw new Error('Expected exact captured Kindred proposal input; successor version remains unassigned');
    const bundle = structuredClone(base);
    const badge = bundle.blocks.badge;
    if (!badge || badge.schema.settings.find(field => field.id === 'label')?.type !== 'text') throw new Error('Expected canonical reusable badge label contract');
    if (!badge.source.includes(CHILD_OUTLET)) {
        const closing = '</span>';
        if (badge.source.split(closing).length !== 2) throw new Error('Expected exact captured badge root boundary');
        badge.source = badge.source.replace(closing, CHILD_OUTLET + closing);
    }
    for (const file of Object.values(bundle.sections)) {
        const inline = file.schema.blocks.filter(block => block.type !== '@app' && !Object.hasOwn(bundle.blocks, block.type));
        if (!inline.length) continue;
        file.source = inlineOutlet(file.source);
    }
    return parseLiquidThemePackageBundle(bundle);
}
