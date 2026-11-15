/** Public, synthetic preview-only catalog. Never persisted as a merchant installation seed. */
import { SportsFactsSchema, SportsVariantFactsSchema, type ProductModel } from '@letbuyy/commerce-core';
import { LiquidThemePackageBundleSchema } from '@letbuyy/theme-engine';
import type { StoreNavigation } from '@letbuyy/tenant-core';
import { isCatalogDemoVersion } from './catalog-demo-versions';

const media = '/theme-assets/trailmark/v2/';
const productIds = ['7b669c70-8600-4000-8000-000000000001', '7b669c70-8600-4000-8000-000000000002', '7b669c70-8600-4000-8000-000000000003'];
const rawProducts = [
  {
    id: productIds[0], name: 'Rally68 badminton racket', description: 'A recreational badminton racket. Fictional sample; not for sale.', price: 2490, currency: 'INR', stock: 4, isActive: true, category: 'Badminton', images: [media+'racket.webp',media+'activity.webp'],
    sports: { version: 1 as const, activity: 'Badminton', equipmentType: 'racket' as const, length: { value: 68, unit: 'cm' as const }, weight: { value: 88, unit: 'g' as const }, material: 'Aluminium frame / steel shaft. Fictional supplied specification.', contents: ['1 strung racket'], conditions: 'Recreational dry court use. No string tension specification supplied.', care: 'Wipe dry; store indoors away from prolonged heat.', compatibility: { status: 'unconfirmed' as const, note: 'Replacement grip compatibility has not been supplied.' } },
    variantOptions: [{name:'Color',values:['Forest']},{name:'Grip circumference',values:['84 mm','88 mm']}],
    variants: [
      {id:'7b669c70-8610-4000-8000-000000000001',name:'Forest /84 mm',title:'Forest /84 mm',price:2490,stock:4,options:{Color:'Forest','Grip circumference':'84 mm'} as Record<string,string>,sports:{gripCircumference:{value:84,unit:'mm' as const}}},
      {id:'7b669c70-8610-4000-8000-000000000002',name:'Forest /88 mm',title:'Forest /88 mm',price:2490,stock:0,options:{Color:'Forest','Grip circumference':'88 mm'} as Record<string,string>,sports:{gripCircumference:{value:88,unit:'mm' as const}}},
    ],
  },
  {id:productIds[1],name:'Court Nylon3 shuttles',description:'Three white nylon shuttlecocks in a tube. Fictional sample; not for sale.',price:490,currency:'INR',stock:8,isActive:true,category:'Badminton',images:[media+'shuttles.webp'],sports:{version:1 as const,activity:'Badminton',equipmentType:'shuttles' as const,material:'Nylon skirt / cork base. Fictional merchant content.',contents:['3 white nylon shuttles','1 storage tube'],conditions:'Recreational badminton. Performance/speed classification not supplied.',care:'Store dry in the supplied tube.',compatibility:{status:'unconfirmed' as const}},variantOptions:[{name:'Pack',values:['3 per tube']}],variants:[{id:'7b669c70-8610-4000-8000-000000000003',name:'White /3 per tube',title:'White /3 per tube',price:490,stock:8,options:{Pack:'3 per tube'} as Record<string,string>}]},
  {id:productIds[2],name:'Court single-racket sleeve',description:'A single-compartment fabric cover. Fictional sample; not for sale.',price:690,currency:'INR',stock:5,isActive:true,category:'Badminton',images:[media+'sleeve.webp'],sports:{version:1 as const,activity:'Badminton',equipmentType:'storage' as const,dimensions:{length:72,width:24,unit:'cm' as const},material:'Woven fabric. Fictional merchant content.',contents:['1 graphite racket sleeve'],conditions:'For dry storage. Exterior dimensions only; internal opening not supplied.',care:'Wipe with a damp cloth and air dry.',compatibility:{status:'unconfirmed' as const,note:'Fit with Rally68 or any other racket remains unconfirmed.'}},variantOptions:[{name:'Color',values:['Graphite']}],variants:[{id:'7b669c70-8610-4000-8000-000000000004',name:'Graphite',title:'Graphite',price:690,stock:5,options:{Color:'Graphite'} as Record<string,string>}]},
];
// Canonical ProductModel remains the product contract; sports is the root-owned bounded extension.
export const TRAILMARK_DEMO_PRODUCTS: ProductModel[] = rawProducts.map(product => ({ ...product, sports: SportsFactsSchema.parse(product.sports), variants: product.variants.map(variant => ({ ...variant, ...('sports' in variant ? { sports: SportsVariantFactsSchema.parse(variant.sports) } : {}) })) }));
export const TRAILMARK_DEMO_COLLECTIONS = [
  {id:'7b669c70-8620-4000-8000-000000000001',title:'Court time',handle:'court-time',description:'Recreational badminton equipment. Demonstration collection.',image_url:media+'activity.webp',product_count:3},
  {id:'7b669c70-8620-4000-8000-000000000002',title:'Rackets',handle:'rackets',description:'Equipment measurements, not clothing sizes.',image_url:media+'racket.webp',product_count:1},
  {id:'7b669c70-8620-4000-8000-000000000003',title:'Court accessories',handle:'court-accessories',description:'Independent shuttle and storage products.',image_url:media+'accessories.webp',product_count:2},
];
/** Explicit preview membership; unknown collections must never expand to the whole catalogue. */
export const TRAILMARK_DEMO_COLLECTION_PRODUCT_IDS: Record<string, string[]> = {
  [TRAILMARK_DEMO_COLLECTIONS[0].id]: [...productIds],
  [TRAILMARK_DEMO_COLLECTIONS[1].id]: [productIds[0]],
  [TRAILMARK_DEMO_COLLECTIONS[2].id]: [productIds[1], productIds[2]],
};
const previewBase='/store/urban-kicks-demo';
export const TRAILMARK_DEMO_NAVIGATION: StoreNavigation = {
  main:[{id:'trailmark-demo-activities',label:'Activities',href:previewBase+'/products',isDefault:false,isVisible:true},{id:'trailmark-demo-equipment',label:'Equipment',href:previewBase+'/products',isDefault:false,isVisible:true},{id:'trailmark-demo-guide',label:'Measurements guide',href:previewBase+'/product/'+productIds[0]+'#equipment-facts',isDefault:false,isVisible:true}],
  footer:[{id:'trailmark-demo-badminton',label:'Explore court equipment',href:previewBase+'/products',isDefault:false,isVisible:true}],policies:[],
};
/** Isolated catalog preview settings only; live merchants keep their own resources and facts. */
export function withTrailmarkDemoContent(input: Record<string, unknown>): Record<string, unknown> {
  const bundle=LiquidThemePackageBundleSchema.parse(structuredClone(input.liquidBundle));
  if(bundle.package.slug!=='letbuyy-ride'||!isCatalogDemoVersion(bundle.package.version))throw new Error('Trailmark sample content requires the matching versioned package.');
  for(const template of Object.values(bundle.templates))for(const instance of Object.values(template.sections)){
    if(instance.type==='hero-banner')Object.assign(instance.settings,{image:media+'activity.webp',imageAlt:'Two adults enjoying a fictional recreational badminton game',imageFocus:'center'});
    if(instance.type==='category-grid')Object.assign(instance.settings,{collection1:TRAILMARK_DEMO_COLLECTIONS[0].id,collection2:TRAILMARK_DEMO_COLLECTIONS[1].id,collection3:TRAILMARK_DEMO_COLLECTIONS[2].id});
    if(instance.type==='product-grid')Object.assign(instance.settings,{collectionId:TRAILMARK_DEMO_COLLECTIONS[0].id});
    if(instance.type==='about-section')Object.assign(instance.settings,{image:media+'accessories.webp',imageAlt:'Shuttles, towel and racket sleeve; separate fictional accessories',content:'A racket’s length is a measurement. A shirt’s size is a garment label. Check equipment dimensions, the actual variant and supplied use conditions before choosing.',linkLabel:'Read the equipment facts',linkUrl:'/product/'+productIds[0]+'#equipment-facts'});
    if(instance.type==='featured-products')Object.assign(instance.settings,{image:media+'activity.webp',imageAlt:'Recreational court context; equipment is sold independently',product1:productIds[1],product2:productIds[2],subtitle:'Separate products, separate prices. Nothing is added automatically.'});
    if(instance.type==='trust-badges')Object.assign(instance.settings,{measurementsText:'Category-specific units; unknown values remain unknown.',contentsText:'Read each product’s supplied contents before choosing.',supportText:'Shipping quotes and policy links belong to the merchant’s canonical checkout and support paths.'});
  }
  return{...input,liquidBundle:bundle,templates:bundle.templates};
}
