import sys,json,pathlib,datetime,socket,io,urllib.parse as U,xml.etree.ElementTree as ET
sys.path.insert(0,'/Users/saai_mithra/.codex/skills/seo/scripts')
from url_safety import safe_requests_get,decode_response_text,MAX_PAGE_BYTES
from PIL import Image
R=pathlib.Path('/Users/saai_mithra/Projects/Start_Up/LetBuyy/reports/letbuyy.com-comprehensive-audit-2026-10-29');data=json.loads((R/'evidence/crawl.json').read_text());home=next(p for p in data['pages'] if p['url']=='https://www.letbuyy.com/in')
images=['https://www.letbuyy.com/og/letbuyy-default.png','https://www.letbuyy.com/icons/letbuyy-logo-512.png']
for im in home.get('images',[]):
 url=U.urljoin(home['url'],im.get('src',''))
 if url not in images and (url.endswith(('.webp','.png','.svg'))):images.append(url)
images=images[:16]
resources=['https://themes.letbuyy.com/sitemap.xml','https://apps.letbuyy.com/sitemap.xml','https://developer.letbuyy.com/sitemap.xml','https://accounts.letbuyy.com','https://www.letbuyy.com/in/legal/grievance']
rows=[]
for url in resources+images:
 row={'url':url,'captured_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'kind':'image' if url in images else 'resource'}
 try:
  with safe_requests_get(url,timeout=20,allow_redirects=False,stream=True) as res:
   row.update({'status':res.status_code,'headers':{k.lower():v for k,v in res.headers.items() if k.lower() not in ['set-cookie','authorization']}});body=b''
   for chunk in res.iter_content(65536):
    body+=chunk
    if len(body)>4194304:row['truncated']=True;break
   row['decoded_bytes']=len(body)
   if row['kind']=='image':
    try:
     im=Image.open(io.BytesIO(body));row.update({'width':im.width,'height':im.height,'format':im.format})
    except Exception:pass
   else:row['body_excerpt']=body.decode(errors='replace')[:500]
 except Exception as ex:row['error']=str(ex)[:700]
 rows.append(row);(R/'evidence/resource-probes.json').write_text(json.dumps(rows,indent=2));print(url,row.get('status'),row.get('error',''),flush=True)
for host in ['themes.letbuyy.com','apps.letbuyy.com','developer.letbuyy.com']:
 u='https://dns.google/resolve?name='+host+'&type=A'
 try:
  with safe_requests_get(u,timeout=15) as res:obj=res.json()
  rows.append({'kind':'public-dns-check','host':host,'resolver':'dns.google','result':obj,'captured_at':datetime.datetime.now(datetime.timezone.utc).isoformat()})
 except Exception as e:rows.append({'kind':'public-dns-check','host':host,'error':str(e)[:500]})
(R/'evidence/resource-probes.json').write_text(json.dumps(rows,indent=2))
