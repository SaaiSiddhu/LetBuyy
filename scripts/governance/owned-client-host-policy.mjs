import {isOwnedClientServiceUrl} from './owned-client-url-policy.mjs';
// Explicit browser-only host mapping for the canonical storefront root. Backend
// URLs still pass the loopback guard; the checkout and storefront share the
// parent's one local TLS listener. This does not change DNS or product auth.
export function resolveOwnedStoreRoot({mode,requestedRoot,storefrontUrl,checkoutOrigin,canonicalRoot}) {
 if(!mode)return 'localhost';
 if(mode!=='canonical-storefront-loopback')throw new Error('unknown owned host mode');
 const storefront=new URL(storefrontUrl),checkout=new URL(checkoutOrigin);
 if(!canonicalRoot||requestedRoot!==canonicalRoot||storefront.hostname!==canonicalRoot||storefront.protocol!=='https:'
  ||storefront.username||storefront.password||storefront.pathname!=='/'||storefront.search||storefront.hash
  ||!storefront.port||Number(storefront.port)<1024||storefront.port!==checkout.port
  ||checkout.protocol!=='https:'||!isOwnedClientServiceUrl('CHECKOUT_ORIGIN',checkoutOrigin))throw new Error('canonical host mode requires the scoped loopback TLS fixture');
 return canonicalRoot;
}
