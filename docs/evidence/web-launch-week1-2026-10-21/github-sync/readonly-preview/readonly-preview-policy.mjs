// Audit-only request policy. This is not a production API authorization layer.
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function classifyPreviewRead(method,url,{handle,storeId,accessHost}) {
 if(!['GET','HEAD'].includes(method))return null;
 // Keep capabilities, encoded path separators and ambiguous duplicate query values out.
 if(/%2f|%5c|%25/i.test(url.pathname)||url.pathname.includes('\\'))return null;
 if([...url.searchParams.keys()].some(key=>/token|secret|password|authorization/i.test(key)||url.searchParams.getAll(key).length!==1))return null;
 if(url.pathname==='/v1/internal/store-access/resolve')return url.searchParams.get('host')===accessHost?'access':null;
 if(url.pathname==='/v1/storefront/reviews'){
  if([...url.searchParams.keys()].some(key=>!['store_id','product_id'].includes(key)))return null;
  return url.searchParams.get('store_id')===storeId&&uuid.test(url.searchParams.get('product_id')??'')?'reviews':null;
 }
 const prefix='/v1/storefront/'+handle;
 if(url.pathname===prefix)return 'store';
 if(!url.pathname.startsWith(prefix+'/'))return null;
 const tail=url.pathname.slice(prefix.length);
 return /^\/(status|navigation|products|collections|policies|pages|blog|search)(\/|$)/.test(tail)?'store-resource':null;
}
