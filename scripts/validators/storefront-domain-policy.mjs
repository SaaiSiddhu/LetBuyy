// Current owner direction separates tenant storefront roots from platform accounts/admin/API.
// This is a narrow literal allowance, not a whole-file or directory scan exemption.
const storefrontEnvFiles = new Set([
 'config/env/production.env.template', 'config/env/production.env.example',
 'config/env/staging.env.template', 'config/env/staging.env.example',
 'config/env/templates/next-app.env.example', 'config/env/templates/worker.env.example',
]);
export function isApprovedStorefrontDomainLiteral(file, text, index) {
 const start=text.lastIndexOf('\n',index-1)+1,end=text.indexOf('\n',index);
 const line=text.slice(start,end<0?text.length:end).trim();
 if(file==='config/vercel/projects.json') {
  const owner=Array.from(text.slice(0,index).matchAll(/"directory"\s*:\s*"([^"]+)"/g)).at(-1)?.[1];
  return owner==='apps/commerce/web' && /^"url": "https:\/\/storefront(?:-staging)?\.letbuyy\.store",?$/.test(line);
 }
 if(file==='services/api-gateway/wrangler.toml') {
  if(/^NEXT_PUBLIC_STORE_ROOT_DOMAIN = "letbuyy\.store"$/.test(line))return true;
  const stanza=Array.from(text.slice(0,start).matchAll(/^\[([^\]]+)\]\s*$/gm)).at(-1)?.[1];
  return (stanza==='env.staging.vars' && /^CUSTOM_DOMAIN_CNAME_TARGET = "storefront-staging\.letbuyy\.store"$/.test(line))
   || (stanza==='env.production.vars' && /^CUSTOM_DOMAIN_CNAME_TARGET = "storefront\.letbuyy\.store"$/.test(line));
 }
 if(file==='packages/shared-types/src/brand.ts')return /^export const DEFAULT_STOREFRONT_DOMAIN = 'letbuyy\.store';$/.test(line);
 return storefrontEnvFiles.has(file)&&(/^(?:NEXT_PUBLIC_STORE_ROOT_DOMAIN|STOREFRONT_ROOT_DOMAIN)=letbuyy\.store$/.test(line) || /^NEXT_PUBLIC_STOREFRONT_URL=https:\/\/letbuyy\.store$/.test(line));
}
