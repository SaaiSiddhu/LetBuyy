// Owned test clients may reach loopback services only. HTTPS is needed solely for
// the explicitly provisioned local hosted-checkout TLS fixture.
export function isOwnedClientServiceUrl(name, value) {
 try {
  const url=new URL(value);
  const local=['127.0.0.1','localhost','[::1]'].includes(url.hostname)||url.hostname.endsWith('.localhost');
  return local&&!url.username&&!url.password&&(url.protocol==='http:'||(name==='CHECKOUT_ORIGIN'&&url.protocol==='https:'));
 } catch { return false; }
}
