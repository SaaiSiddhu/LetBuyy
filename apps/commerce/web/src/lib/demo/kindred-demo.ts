/** Synthetic public catalog-preview data only. Never an installation seed or merchant catalog. */
import type { ProductModel } from '@letbuyy/commerce-core';
import { LiquidThemePackageBundleSchema } from '@letbuyy/theme-engine';
import type { StoreNavigation } from '@letbuyy/tenant-core';

const media = '/theme-assets/kindred/v2/';
// Check fixtures against the canonical public model while retaining their exact facts.
const product = <T extends ProductModel>(value: T): T => value;
export const KINDRED_DEMO_PRODUCTS = [
  product({ id: '7b669c70-4100-4000-8000-000000000001', name: 'Little Pause set', description: 'A mug, notebook and pen in a fixed ready-made set. Synthetic demonstration product; not for sale.', price: 1790, currency: 'INR', stock: 9, isActive: true, category: 'Ready-made gifts', images: [media+'little-pause-open.webp',media+'little-pause-closed.webp'], variantOptions: [{name:'Packaging',values:['Blush gift box','Kraft gift box','Moss gift box']}], variants: [
    {id:'7b669c70-4200-4000-8000-000000000001',name:'Blush gift box',price:1790,stock:5,options:{Packaging:'Blush gift box'}},
    {id:'7b669c70-4200-4000-8000-000000000002',name:'Kraft gift box',price:1590,stock:4,options:{Packaging:'Kraft gift box'}},
    {id:'7b669c70-4200-4000-8000-000000000003',name:'Moss gift box',price:1790,stock:0,options:{Packaging:'Moss gift box'}},
  ], gifts: {schemaVersion:1 as const,occasions:['birthday','thank-you','just-because'],recipients:['friend','family'],suitabilityNote:'For a friend who loves a quiet moment.',contents:[{label:'Speckled ceramic mug',quantity:1,detail:'Ivory · 300 ml',care:'Hand wash.'},{label:'Sage linen notebook',quantity:1,detail:'A5 · 96 lined pages'},{label:'Brass ballpoint pen',quantity:1,detail:'Black ink',care:'Refill type not supplied.'}],mediaRoles:{openBox:0,closedBox:1}}}),
  product({id:'7b669c70-4100-4000-8000-000000000002',name:'Desk Companion set',description:'A notebook, pen and cotton pouch in a fixed ready-made set. Synthetic demonstration product; not for sale.',price:1290,currency:'INR',stock:8,isActive:true,category:'Ready-made gifts',images:[media+'desk-companion.webp'],variantOptions:[{name:'Packaging',values:['Kraft gift box']}],variants:[{id:'7b669c70-4200-4000-8000-000000000004',name:'Kraft gift box',price:1290,stock:8,options:{Packaging:'Kraft gift box'}}],gifts:{schemaVersion:1 as const,occasions:['birthday','thank-you','housewarming'],recipients:['friend','colleague'],suitabilityNote:'For a fresh page and a new chapter.',contents:[{label:'Terracotta linen notebook',quantity:1,detail:'A5'},{label:'Brass ballpoint pen',quantity:1,detail:'Black ink'},{label:'Cotton zip pouch',quantity:1,detail:'Off-white'}],mediaRoles:{openBox:0}}}),
];
export const KINDRED_DEMO_COLLECTIONS = ['Birthday','Thank you','Housewarming','Just because'].map((title,i)=>({id:`7b669c70-4300-4000-8000-${String(i+1).padStart(12,'0')}`,title,handle:['birthday','thank-you','housewarming','just-because'][i],description:['Another year, a little joy.','For the things they do.','Make a place feel theirs.','No occasion needed.'][i],image_url:KINDRED_DEMO_PRODUCTS[i%2].images[0],product_count:i<2?2:1}));
/** Explicit synthetic membership, ordered by the approved independent product shelf. */
export const KINDRED_DEMO_COLLECTION_PRODUCT_IDS: Record<string, string[]> = Object.fromEntries(
  KINDRED_DEMO_COLLECTIONS.map(collection => [collection.id, KINDRED_DEMO_PRODUCTS.filter(item => item.gifts.occasions.includes(collection.handle)).map(item => item.id)]),
);
export const KINDRED_DEMO_DISCOVERY = {
  gift_discovery_enabled:true,
  gift_occasions:KINDRED_DEMO_COLLECTIONS.map(c=>({value:c.handle,label:c.title})),
  gift_recipients:[{value:'friend',label:'A friend'},{value:'family',label:'Family'},{value:'colleague',label:'A colleague'}],
};
export const KINDRED_DEMO_NAVIGATION: StoreNavigation = {
 main:[{id:'kindred-demo-occasions',label:'Occasions',href:'/store/urban-kicks-demo/collections',isDefault:false,isVisible:true},{id:'kindred-demo-recipients',label:'For whom',href:'/store/urban-kicks-demo/products',isDefault:false,isVisible:true},{id:'kindred-demo-budget',label:'Under a budget',href:'/store/urban-kicks-demo/products?min_price=1000&max_price=2000',isDefault:false,isVisible:true},{id:'kindred-demo-sets',label:'Ready-made sets',href:'/store/urban-kicks-demo/products',isDefault:false,isVisible:true}],
 footer:[{id:'kindred-demo-browse',label:'Browse gifts',href:'/store/urban-kicks-demo/products',isDefault:false,isVisible:true}],policies:[],
};
/** Configure only labelled preview copies of this exact package; installed themes keep real bindings. */
export function withKindredDemoContent(input:Record<string,unknown>):Record<string,unknown>{
 const bundle=LiquidThemePackageBundleSchema.parse(structuredClone(input.liquidBundle));
 if(bundle.package.slug!=='letbuyy-summit'||bundle.package.version!=='2.0.0')throw new Error('Kindred preview requires its exact v2 package.');
 for(const t of Object.values(bundle.templates))for(const s of Object.values(t.sections)){
  if(s.type==='hero-banner')Object.assign(s.settings,{image:media+'little-pause-open.webp',imageAlt:'Synthetic Little Pause set: one mug, one notebook and one pen'});
  if(s.type==='category-grid')Object.assign(s.settings,Object.fromEntries(KINDRED_DEMO_COLLECTIONS.map((c,i)=>[`collection${i+1}`,c.id])));
  if(s.type==='about-section')Object.assign(s.settings,{image:media+'little-pause-closed.webp',imageAlt:'Synthetic blush box closed with ivory ribbon',content:'See every included item and the selected packaging. Each ready-made set is sold exactly as listed.',linkLabel:'See the Little Pause set',linkUrl:`/product/${KINDRED_DEMO_PRODUCTS[0].id}`});
  if(s.type==='featured-products')Object.assign(s.settings,{product1:KINDRED_DEMO_PRODUCTS[1].id});
 }
 return {...input,liquidBundle:bundle,templates:bundle.templates};
}
