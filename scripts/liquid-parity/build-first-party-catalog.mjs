import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { firstPartyThemeListings } from '../../packages/theme-engine/src/first-party-theme-catalog.ts';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const listings=firstPartyThemeListings();
const payload=JSON.stringify(listings);
const sql=`-- Generated from the existing preset registry. Additive catalog promotion only.
-- Existing Core/Urban Kicks selections, drafts and releases are never rewritten.
BEGIN;
ALTER TABLE public.themes ADD COLUMN catalog_visible boolean NOT NULL DEFAULT true;
UPDATE public.themes SET catalog_visible=false WHERE slug IN ('letbuyy-core','urban-kicks') AND owned_by_site_id IS NULL AND NOT is_site_private;
DO $catalog$
DECLARE base public.themes; item jsonb; doc jsonb; bundle jsonb;
BEGIN
 SELECT * INTO STRICT base FROM public.themes WHERE slug='letbuyy-core' AND NOT is_site_private AND owned_by_site_id IS NULL;
 IF base.default_template#>>'{liquidBundle,package,slug}' IS DISTINCT FROM 'letbuyy-core-liquid' THEN
  RAISE EXCEPTION 'Canonical Core bundle unavailable'; END IF;
 FOR item IN SELECT value FROM jsonb_array_elements($listings$${payload}$listings$::jsonb) LOOP
  IF EXISTS(SELECT 1 FROM public.themes WHERE slug=item->>'slug' AND id<>(item->>'id')::uuid) THEN
   RAISE EXCEPTION 'Catalog slug already belongs to another theme'; END IF;
  doc:=base.default_template||jsonb_build_object('themeId',item->>'slug','experienceId',item->>'presetId','rendererEngine','liquid',
   'themeSettings',coalesce(base.default_template->'themeSettings','{}')||(item->'settings'));
  bundle:=doc->'liquidBundle';
  bundle:=jsonb_set(bundle,'{package,slug}',item->'slug');
  bundle:=jsonb_set(bundle,'{package,name}',item->'name');
  bundle:=jsonb_set(bundle,'{config,settings_data,current}',coalesce(bundle#>'{config,settings_data,current}','{}')||(item->'settings'));
  doc:=jsonb_set(doc,'{liquidBundle}',bundle);
  INSERT INTO public.themes(id,slug,name,site_type,category,description,long_description,thumbnail_url,preview_url,
   is_active,is_premium,price,author,version,sort_order,letbuyy_pricing_type,letbuyy_price_inr,letbuyy_price_usd,
   supported_site_types,supported_platforms,theme_preset_id,config,default_template,settings_schema,section_schemas,block_schemas,
   renderer_manifest,schema_version,renderer_version,features,tags,industry)
  VALUES((item->>'id')::uuid,item->>'slug',item->>'name','store',item->>'category',item->>'description',item->>'description',
   item->>'thumbnail',NULL,true,false,0,'LetBuyy',base.version,100, 'free',0,0,
   base.supported_site_types,base.supported_platforms,item->>'presetId',
   jsonb_build_object('preset_id',item->>'presetId','colors',jsonb_build_object('primary',item#>>'{settings,primaryColor}',
    'accent',item#>>'{settings,accentColor}','background',item#>>'{settings,backgroundColor}','text',item#>>'{settings,textColor}')),
   doc,base.settings_schema,base.section_schemas,base.block_schemas,base.renderer_manifest,
   base.schema_version,base.renderer_version,ARRAY['Responsive layouts','Visual editor','Free'],ARRAY['first-party',item->>'presetId'],ARRAY[item->>'category'])
  ON CONFLICT(slug) DO NOTHING;
 END LOOP;
END $catalog$;
COMMIT;
`;
const outputs=[['database/supabase/migrations/372_first_party_theme_catalog.sql',sql],
 ['database/supabase/rollback/372_first_party_theme_catalog.rollback.sql',`-- Keep installed themes, drafts and releases recoverable; retire only catalog discovery.
BEGIN;
UPDATE public.themes SET catalog_visible=false WHERE id IN (${listings.map(t=>`'${t.id}'::uuid`).join(',')})
 AND owned_by_site_id IS NULL AND NOT is_site_private;
UPDATE public.themes SET catalog_visible=true WHERE slug IN ('letbuyy-core','urban-kicks') AND owned_by_site_id IS NULL AND NOT is_site_private;
COMMIT;
`]];
const escape=s=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
for(const t of listings){
 const s=t.settings;
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 760" role="img" aria-label="${escape(t.name)} design preview"><rect width="1000" height="760" fill="${s.backgroundColor}"/><rect width="1000" height="26" fill="${s.primaryColor}"/><text x="500" y="18" text-anchor="middle" fill="${s.backgroundColor}" font-family="sans-serif" font-size="11">Welcome to our store</text><text x="42" y="77" fill="${s.textColor}" font-family="${escape(s.headingFontFamily)},serif" font-size="27" font-weight="700">${escape(t.name)}</text><g fill="${s.textColor}" font-family="sans-serif" font-size="12"><text x="320" y="72">New arrivals</text><text x="435" y="72">Collections</text><text x="535" y="72">Our story</text><text x="895" y="72">Search</text></g><rect x="18" y="102" width="964" height="340" rx="${s.borderRadius}" fill="${s.surfaceColor}"/><path d="M600 102H982V442H540Z" fill="${s.primaryColor}"/><circle cx="795" cy="230" r="110" fill="${s.accentColor}" opacity=".6"/><path d="M745 197l-40 22 16 40 27-14v116h102V245l27 14 16-40-40-22-25 15h-58z" fill="${s.backgroundColor}"/><text x="60" y="198" fill="${s.primaryColor}" font-family="sans-serif" font-size="12" letter-spacing="3">THE NEW COLLECTION</text><text x="60" y="255" fill="${s.textColor}" font-family="${escape(s.headingFontFamily)},serif" font-size="43" font-weight="700">Made for</text><text x="60" y="309" fill="${s.textColor}" font-family="${escape(s.headingFontFamily)},serif" font-size="43" font-weight="700">your everyday.</text><rect x="60" y="344" width="142" height="44" rx="${s.borderRadius}" fill="${s.primaryColor}"/><text x="131" y="371" text-anchor="middle" fill="${s.backgroundColor}" font-family="sans-serif" font-size="13">Explore collection</text><text x="35" y="493" fill="${s.textColor}" font-family="${escape(s.headingFontFamily)},serif" font-size="23">Thoughtfully selected</text>${[0,1,2,3].map((n)=>`<rect x="${35+n*240}" y="515" width="215" height="170" rx="${s.borderRadius}" fill="${s.surfaceColor}"/><circle cx="${142+n*240}" cy="592" r="${42+n*4}" fill="${n%2?s.accentColor:s.primaryColor}" opacity="${.35+n*.15}"/><text x="${35+n*240}" y="711" fill="${s.textColor}" font-family="sans-serif" font-size="12">Collection ${n+1}</text>`).join('')}<text x="500" y="748" text-anchor="middle" fill="${s.textColor}" font-family="sans-serif" font-size="10">Illustrative design preview · Sample content</text></svg>`;
 for(const path of ['apps/merchant/web','apps/commerce/web','apps/frozen/theme-store'])outputs.push([`${path}/public/theme-previews/${t.presetId}.svg`,svg+'\n']);
}
for(const [path,content]of outputs){const file=resolve(root,path);if(process.argv.includes('--check')){if(readFileSync(file,'utf8')!==content)throw new Error('Stale catalog artifact: '+path);}else{mkdirSync(dirname(file),{recursive:true});writeFileSync(file,content);}}
console.info(JSON.stringify({themes:listings.map(t=>({id:t.id,slug:t.slug,preset:t.presetId})),check:process.argv.includes('--check')}));
