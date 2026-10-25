/** Executable source evidence. This does not promote a catalog or seed a merchant store. */
import { createRequire } from 'node:module';
import { writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const requireApp = createRequire(new URL('../../../../apps/commerce/web/package.json', import.meta.url));
const { firstPartyThemeListings, createFirstPartyCatalogBundle } = requireApp('@letbuyy/theme-engine');
const { resolveCatalogDemoContent, resolveCatalogDemoCollection } = requireApp('./src/lib/demo/catalog-demo-dispatch.ts');
const report = {
    generatedAt: new Date().toISOString(), source: 'Explicit v2 factory + immutable leaf fixture memberships; not persisted catalog, browser rollout or end-to-end acceptance.',
    dispatcherSha256: createHash('sha256').update(readFileSync(new URL('../../../../apps/commerce/web/src/lib/demo/catalog-demo-dispatch.ts', import.meta.url))).digest('hex'),
    themes: firstPartyThemeListings({ designVersion: '2.0.0' }).map((listing: { slug: string }) => {
        const bundle = createFirstPartyCatalogBundle(listing.slug, { designVersion: '2.0.0' });
        const context = resolveCatalogDemoContent(listing.slug, '2.0.0', { liquidBundle: bundle });
        if (!context) throw new Error(`Unavailable explicit v2 source: ${listing.slug}`);
        return { slug: context.slug, name: context.name, version: context.version, collections: context.collections.map((collection: {id:string;handle?:string;title:string;product_count:number}) => {
            const products = resolveCatalogDemoCollection(context, collection.id);
            if (!products || products.length !== collection.product_count) throw new Error(`Unconfirmed membership: ${context.slug}/${collection.id}`);
            return { id: collection.id, handle: collection.handle, title: collection.title, count: products.length, productIds: products.map((product: {id:string}) => product.id) };
        }) };
    }),
};
writeFileSync(new URL('collection-membership-audit.json', import.meta.url), JSON.stringify(report,null,2)+'\n');
const collections = report.themes.flatMap((theme: {collections:Array<{count:number}>}) => theme.collections);
process.stdout.write(JSON.stringify({ themes: report.themes.length, collections: collections.length, emptyCollections: collections.filter((collection: {count:number}) => collection.count===0).length })+'\n');
