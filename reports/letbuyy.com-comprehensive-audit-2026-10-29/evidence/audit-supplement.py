import concurrent.futures, collections, hashlib, ipaddress, json, pathlib, re, socket, subprocess, time, urllib.parse as U, urllib.robotparser, xml.etree.ElementTree as E
from html.parser import HTMLParser
ROOT=pathlib.Path('/Users/saai_mithra/Projects/Start_Up/LetBuyy/reports/letbuyy.com-comprehensive-audit-2026-10-29')
BASE='https://www.letbuyy.com'
class Page(HTMLParser):
 def __init__(self):
  super().__init__(convert_charrefs=True); self.lang=''; self.active_anchor=None; self.title=''; self.meta=[]; self.links=[]; self.anchors=[]; self.images=[]; self.headings=[]; self.schemas=[]; self.text=[]; self.main=[]; self.stack=[]; self.hide=0; self.inmain=0; self.cap=None; self.script=None
 def handle_starttag(self,tag,attrs):
  a=dict(attrs); self.stack.append(tag)
  if tag=='html': self.lang=a.get('lang','')
  if tag in ['script','style','noscript']: self.hide+=1
  if tag=='main': self.inmain+=1
  if tag=='script' and a.get('type')=='application/ld+json': self.script=''
  if tag in ['title','h1','h2','h3','h4']: self.cap=[tag,'']
  if tag=='meta': self.meta.append(a)
  if tag=='link': self.links.append(a)
  if tag=='a' and a.get('href'):
   a['text']=''; self.anchors.append(a); self.active_anchor=a
  if tag=='img': self.images.append(a)
 def handle_endtag(self,tag):
  if tag=='a': self.active_anchor=None
  if tag=='script' and self.script is not None:
   self.schemas.append(self.script); self.script=None
  if tag in ['script','style','noscript']: self.hide=max(0,self.hide-1)
  if tag=='main': self.inmain=max(0,self.inmain-1)
  if self.cap and self.cap[0]==tag:
   if tag=='title': self.title=self.cap[1].strip()
   else: self.headings.append({'tag':tag,'text':self.cap[1].strip()})
   self.cap=None
 def handle_data(self,data):
  if self.script is not None: self.script+=data
  if not self.hide:
   if self.active_anchor is not None: self.active_anchor['text']+=data
   if self.cap: self.cap[1]+=data
   if data.strip():
    self.text.append(data.strip())
    if self.inmain: self.main.append(data.strip())
 def result(self):
  t=' '.join(self.text); m=' '.join(self.main)
  return {'html_lang':self.lang,'title':self.title,'meta':self.meta,'links':self.links,'anchors':self.anchors,'images':self.images,'headings':self.headings,'schemas':self.schemas,'text':t,'main_text':m,'word_count':len(t.split()),'main_word_count':len(m.split())}
from datetime import datetime, timezone
ROOT.mkdir(exist_ok=True); (ROOT/'evidence/pages').mkdir(exist_ok=True)
robot=urllib.robotparser.RobotFileParser(); robot.parse((ROOT/'evidence/robots.txt').read_text().splitlines())
START=datetime.now(timezone.utc).isoformat(); UA='LetBuyySEOAudit/2.0 (owner-authorized public SEO review)'
def normalize(url):
 p=U.urlsplit(url)
 if p.scheme not in ['http','https'] or p.hostname not in ['www.letbuyy.com','letbuyy.com'] or p.username or p.password or p.port not in [None,80,443]: return None
 if p.query or re.search(r'/(logout|signout|cart|checkout|signup)(/|$)',p.path,re.I): return None
 if re.search(r'\.(png|svg|webp|jpg|jpeg|pdf|zip|woff2?|xml|ico|css|js)$',p.path,re.I): return None
 return U.urlunsplit((p.scheme,p.netloc,p.path.rstrip('/') or '/','',''))
def fetch(url):
 key=hashlib.sha256(url.encode()).hexdigest()[:16]; current=url; history=[]; captured=datetime.now(timezone.utc).isoformat(); hp=ROOT/f'evidence/pages/{key}.headers'; bp=ROOT/f'evidence/pages/{key}.html'
 try:
  for hop in range(4):
   p=U.urlsplit(current)
   if p.scheme not in ['http','https'] or p.hostname not in ['www.letbuyy.com','letbuyy.com'] or p.username or p.password or p.port not in [None,80,443]:
    return {'url':url,'final_url':current,'scope_boundary':True,'history':history,'captured_at':captured}
   if not robot.can_fetch(UA,current): return {'url':url,'blocked_by_robots':True,'history':history,'captured_at':captured}
   ips={x[4][0] for x in socket.getaddrinfo(p.hostname,None,socket.AF_INET)}
   if not ips or any(not ipaddress.ip_address(ip).is_global for ip in ips): raise ValueError('nonpublic DNS address')
   port=443 if p.scheme=='https' else 80
   cmd=['curl','-sS','--compressed','--connect-timeout','10','--max-time','30','--max-filesize','4194304','--resolve',f'{p.hostname}:{port}:{sorted(ips)[0]}','-A',UA,'-D',str(hp),'-o',str(bp),'-w','%{http_code}\t%{size_download}\t%{time_total}',current]
   rr=subprocess.run(cmd,capture_output=True,text=True); vals=rr.stdout.split('\t')
   if rr.returncode: raise ValueError(rr.stderr.strip())
   headers=hp.read_text(); h={}
   for line in headers.splitlines():
    if ':' in line:
     k,v=line.split(':',1)
     if k.lower().strip() not in ['set-cookie','authorization','proxy-authorization']: h[k.lower().strip()]=v.strip()
   hp.write_text('\n'.join(k+': '+v for k,v in h.items()))
   status=int(vals[0]); history.append({'url':current,'status':status,'location':h.get('location')})
   if status in [301,302,303,307,308] and h.get('location'): current=U.urljoin(current,h['location']); continue
   raw=bp.read_text(errors='replace'); parsed=Page(); ishtml='html' in h.get('content-type','')
   if ishtml: parsed.feed(raw)
   row={'url':url,'final_url':current,'status':status,'history':history,'headers':h,'captured_at':captured,'bytes_downloaded':float(vals[1]),'decoded_bytes':bp.stat().st_size,'fetch_seconds':float(vals[2]),'evidence_html':str(bp.relative_to(ROOT)),'evidence_headers':str(hp.relative_to(ROOT))}
   if ishtml: row.update(parsed.result())
   else: row['body']=raw[:150000]
   return row
  raise ValueError('redirect limit exceeded (3 hops)')
 except Exception as ex: return {'url':url,'error':str(ex),'history':history,'captured_at':captured}

urls=[BASE+'/in/resources/tag/cart',BASE+'/in-ta/resources/tag/cart',BASE+'/in-hi/resources/tag/cart',BASE+'/in/legal/grievance']
rows=[]
for url in urls:
 row=fetch(url); rows.append(row);print(url,row.get('status'),row.get('error',''),flush=True);time.sleep(1)
(ROOT/'evidence/crawl-supplement.json').write_text(json.dumps({'reason':'editorial tag/cart routes incorrectly excluded as cart actions; one transient legal page retry','pages':rows},ensure_ascii=False,indent=2))
p=ROOT/'evidence/crawl.json';d=json.loads(p.read_text());d['initial_attempt_count']=len(d['pages']);d['supplementary_attempt_count']=len(rows)
for row in rows:
 old=next((p for p in d['pages'] if p['url']==row['url']),None)
 if old is not None:
  row['prior_attempt']=old;d['pages']=[row if p['url']==row['url'] else p for p in d['pages']]
 else:
  d['pages'].append(row);d['discovered_urls'].append(row['url']);d['discovery_sources'][row['url']]=['article tag anchor; coverage reconciliation']
d['discovered_urls']=sorted(set(d['discovered_urls']));d['supplemented']=True;d['updated_at']=datetime.now(timezone.utc).isoformat();p.write_text(json.dumps(d,ensure_ascii=False,indent=2))
