import type { StoreBrandingInput } from '@letbuyy/checkout-core';
import { hostedRazorpayTestCredentials } from './hosted-razorpay-credentials';
import type { PaymentSettings } from './store-payment-config';
import type { Context } from 'hono';
import { mapPublicStoreRenderPayload, type CheckoutStorePresentation, type StorefrontSiteRecord, type StorefrontThemeReleaseRecord } from '@letbuyy/tenant-core';
import { resolveStorefrontThemePresentation } from '@letbuyy/theme-engine';
import type { Env } from '../index';
import { getSupabaseAdmin } from './supabase';
import { AppError } from './errors';
const unavailable=()=>new AppError('Checkout presentation is temporarily unavailable',503,'CHECKOUT_UNAVAILABLE');
/** Called only after signed handoff and current purchase authorization. Two
 * site-scoped rows (plus a bounded legacy config fallback) replace the checkout
 * Page's full anonymous catalogue read. Only display fields leave this service;
 * private templates, settings, owner credentials and unpublished content do not.
 */
export async function loadCheckoutStorePresentation(c:Context<{Bindings:Env}>,siteId:string):Promise<CheckoutStorePresentation>{
 const db=getSupabaseAdmin(c);
 const {data,error}=await db.from('sites')
  .select('id,name,store_name,subdomain,user_id,custom_user_id,cod_enabled,online_payment_enabled,payment_settings,theme_id,locale,template_config,site_settings,current_theme_release_id')
  .eq('id',siteId).eq('status','published').not('published','is',false).is('deleted_at',null).maybeSingle();
 if(error)throw unavailable();
 if(!data)throw new AppError('Store not found',404,'NOT_FOUND');
 const row=data as unknown as StorefrontSiteRecord&{user_id?:string|null;custom_user_id?:string|null;cod_enabled?:boolean;online_payment_enabled?:boolean;payment_settings?:PaymentSettings|null;site_settings?:Record<string,unknown>|null};
 let release:StorefrontThemeReleaseRecord|null=null;
 let query=db.from('theme_releases').select('id,theme_id,release_version,template_snapshot,release_manifest,published_at')
  .eq('store_id',siteId).is('deleted_at',null);
 if(row.current_theme_release_id)query=query.eq('id',row.current_theme_release_id).in('release_status',['published','superseded']).not('published_at','is',null);
 else query=query.eq('is_current',true).eq('release_status','published');
 const selected=await query.order('release_version',{ascending:false}).limit(1).maybeSingle();
 if(selected.error||row.current_theme_release_id&&!selected.data)throw unavailable();
 if(selected.data){
  release=selected.data as unknown as StorefrontThemeReleaseRecord;
  if(!release.template_snapshot){
   const fallback=await db.from('theme_releases').select('release_config').eq('store_id',siteId).eq('id',release.id).is('deleted_at',null).maybeSingle();
   if(fallback.error||!fallback.data)throw unavailable();
   release={...release,release_config:fallback.data.release_config as Record<string,unknown>|null};
  }
 }
 const projected=mapPublicStoreRenderPayload(row,release);
 const config=projected.template_config&&typeof projected.template_config==='object'?projected.template_config as Record<string,unknown>:{};
 const appearance=row.site_settings&&typeof row.site_settings==='object'?row.site_settings as Record<string,unknown>:{};
 const {themeSettings:t}=resolveStorefrontThemePresentation(config,appearance,release?.theme_id||row.theme_id||String(config.themeId||'urban-kicks'),row.locale||'en-IN');
 const paymentReady=row.online_payment_enabled!==false&&Boolean(await hostedRazorpayTestCredentials(c,siteId,row));
 return{themeId:release?.theme_id||row.theme_id||String(config.themeId||''),paymentMode:paymentReady?'sandbox':'unavailable',id:siteId,sellerId:row.user_id||row.custom_user_id||'',name:row.name||row.store_name||'Store',subdomain:row.subdomain||row.store_name||'',codEnabled:row.cod_enabled!==false,onlinePaymentEnabled:paymentReady,
  themeSettings:{primaryColor:t.primaryColor,secondaryColor:t.secondaryColor,accentColor:t.accentColor,backgroundColor:t.backgroundColor,textColor:t.textColor,surfaceColor:t.surfaceColor,fontFamily:t.fontFamily,headingFontFamily:t.headingFontFamily,borderRadius:t.borderRadius,enableAnimations:t.enableAnimations,enableShadows:t.enableShadows,isDark:t.isDark}};
}

export function defaultBranding(siteId: string) {
    return {
        site_id: siteId,
        logo_url: null,
        favicon_url: null,
        primary_color: '#111827',
        accent_color: '#2563EB',
        checkout_theme: 'system',
        tokens: {},
    };
}

// T8/W2 — store_branding's real columns are only site_id/logo_url/favicon_url/primary_color/
// accent_color/checkout_theme/tokens/metadata (no migration this phase). The 7 new
// StoreBrandingSchema fields (secondary/background/text/surface colour, both fonts, radius,
// is_dark) are genuinely typed and validated at the Zod layer, but physically persist inside the
// existing schemaless `tokens` jsonb column under this reserved, unambiguous key prefix — never
// mixed with a merchant's own arbitrary `tokens` entries, and never spread directly onto the
// upsert payload (the table has no such columns; doing that would 500 on a real write).
const EXTENDED_BRANDING_TOKEN_PREFIX = 'theme_override__';
const EXTENDED_BRANDING_FIELDS = [
    'secondary_color', 'background_color', 'text_color', 'surface_color',
    'heading_font_family', 'body_font_family', 'border_radius', 'is_dark',
] as const;

export function packExtendedBrandingIntoTokens(body: StoreBrandingInput): Record<string, string | number | boolean> {
    const packed: Record<string, string | number | boolean> = { ...body.tokens };
    for (const field of EXTENDED_BRANDING_FIELDS) {
        const value = body[field];
        if (value === undefined || value === null) continue;
        packed[`${EXTENDED_BRANDING_TOKEN_PREFIX}${field}`] = value;
    }
    return packed;
}
