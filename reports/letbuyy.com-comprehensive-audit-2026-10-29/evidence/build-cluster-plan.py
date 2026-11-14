"""Build local planning artifacts from verified source inventory and shared live evidence."""
from pathlib import Path
import re,json,csv,html
R=Path(__file__).resolve().parents[1]; repo=R.parents[1]
s=(repo/'apps/marketing/web/src/lib/resources/articles.ts').read_text()
items=[]
for b in re.split(r'\n  \{\n    slug:',s)[1:]:
 b='    slug:'+b
 def val(k):
  m=re.search(r"^    "+k+r": '((?:\\.|[^'])*)'",b,re.M)
  return m.group(1).replace("\\'","'") if m else None
 items.append({'slug':val('slug'),'category':val('category'),'title':val('title'),'url':'https://www.letbuyy.com/in/resources/'+str(val('category'))+'/'+str(val('slug'))})
lookup={i['slug']:i for i in items}
groups=[('Launch and conversion','#4E79A7',['building-first-letbuyy-store','product-page-optimization','store-seo-checklist','reducing-cart-abandonment']),('Payments and compliance','#59A14F',['upi-vs-cod-india','gst-for-ecommerce-india','invoicing-india-merchants','razorpay-integration-guide']),('Shipping and operations','#F28E2B',['inventory-management-guide','shipping-india-guide','order-fulfillment-guide','refunds-returns-policy-india']),('Acquisition and retention','#B07AA1',['first-100-orders-guide','d2c-brand-launch-guide','social-commerce-india','retention-strategies-india'])]
keywords={'how-to-start-an-online-store-india':'how to start an online store in India','building-first-letbuyy-store':'LetBuyy store setup walkthrough','product-page-optimization':'product page optimization India','store-seo-checklist':'online store SEO checklist','reducing-cart-abandonment':'reduce cart abandonment India','upi-vs-cod-india':'UPI vs cash on delivery','gst-for-ecommerce-india':'GST for ecommerce sellers India','invoicing-india-merchants':'GST invoice ecommerce India','razorpay-integration-guide':'LetBuyy Razorpay setup','inventory-management-guide':'ecommerce inventory management','shipping-india-guide':'ecommerce shipping India','order-fulfillment-guide':'ecommerce order fulfillment process','refunds-returns-policy-india':'ecommerce returns policy India','first-100-orders-guide':'first 100 online orders','d2c-brand-launch-guide':'launch D2C brand India','social-commerce-india':'social commerce India','retention-strategies-india':'customer retention ecommerce India'}
def node(slug):
 x=lookup[slug];return {**x,'keyword':keywords.get(slug),'volume':None,'template':'how-to' if 'guide' in slug or 'building' in slug else 'explainer','wordCount':None,'status':'written','editorial_status':'Existing page; correctness review required'}
pillar=node('how-to-start-an-online-store-india');pillar['template']='ultimate-guide'
clusters=[{'name':name,'color':color,'posts':[node(slug) for slug in slugs]} for name,color,slugs in groups]
links=[]
for i,c in enumerate(clusters):
 for j,p in enumerate(c['posts']):
  nid=f'cluster-{i}-post-{j}'
  links += [{'from':'pillar','to':nid,'type':'mandatory','anchor':p['keyword']},{'from':nid,'to':'pillar','type':'mandatory','anchor':'launch an online store in India'}]
 # Suggested sequence, not a mechanical all-to-all link quota.
 for j in range(len(c['posts'])-1):
  links.append({'from':f'cluster-{i}-post-{j}','to':f'cluster-{i}-post-{j+1}','type':'recommended','anchor':c['posts'][j+1]['keyword']})
phrases=[('online store builder India','commercial'),('ecommerce website builder India','commercial'),('online store platform India','commercial'),('online store builder pricing India','commercial'),('zero commission online store','commercial'),('free trial online store builder','commercial'),('how to start online store India','informational'),('how much does online store cost India','informational'),('online store launch checklist','informational'),('D2C brand launch India','informational'),('how to get first online orders','informational'),('product page optimization','informational'),('ecommerce cart abandonment India','informational'),('ecommerce reviews conversion','informational'),('store SEO checklist','informational'),('UPI vs COD ecommerce','informational'),('cash on delivery return costs','informational'),('UPI payment failures ecommerce','informational'),('payment gateway settlement ecommerce','informational'),('Razorpay store integration','informational'),('GST registration ecommerce seller','informational'),('GST ecommerce TCS India','informational'),('GST invoice fields ecommerce','informational'),('ecommerce returns policy India','informational'),('ecommerce shipping pincode coverage','informational'),('ecommerce order fulfillment','informational'),('inventory management small online store','informational'),('multi warehouse inventory ecommerce','informational'),('email marketing ecommerce India','informational'),('customer retention Indian D2C','informational'),('social commerce India','informational'),('Shopify alternative India','commercial'),('LetBuyy vs Shopify India','commercial'),('online store zero commission vs subscription','commercial'),('ecommerce platform migration checklist','informational'),('GST billing online store cost','commercial')]
plan={'version':'audit-plan-1','created_on':'2026-10-29','seed_keyword':'online store builder India','evidence':'evidence/content-search-samples.json; evidence/crawl.json; source registry used to locate existing pages','method':'Provisional editorial intent map. No controlled top-10 SERP-overlap clustering or search-volume data available. Page assignments are hypotheses requiring query/overlap validation.','serp_matrix':None,'keyword_candidates':[{'phrase':p,'intent':i,'volume':None,'origin':'Editorial expansion from inspected offering, existing page topics and four focused query samples; not measured PAA/related-search extraction'} for p,i in phrases],'pillar':pillar,'clusters':clusters,'links':links,'meta':{'totalPosts':17,'totalClusters':4,'totalLinks':len(links),'estimatedWords':None},'site_inventory':items,'all_categories':sorted(set(i['category'] for i in items)),'scope_note':'Map visualizes 17 priority existing pages. Remaining existing articles are inventoried here; no new pages are authorized or required.'}
(R/'cluster-plan.json').write_text(json.dumps(plan,ensure_ascii=False,indent=2))
nodes={'pillar':pillar,**{f'cluster-{i}-post-{j}':p for i,c in enumerate(clusters) for j,p in enumerate(c['posts'])}}
with (R/'internal-link-matrix.csv').open('w') as f:
 w=csv.DictWriter(f,fieldnames=['from_url','to_url','link_type','suggested_anchor','implementation_state']);w.writeheader()
 for l in links:w.writerow({'from_url':nodes[l['from']]['url'],'to_url':nodes[l['to']]['url'],'link_type':l['type'],'suggested_anchor':l['anchor'],'implementation_state':'Proposed contextual link; existing implementation not inferred'})
template=Path('/Users/saai_mithra/.codex/skills/seo/skills/seo-cluster/templates/cluster-map.html').read_text()
serialized=json.dumps(plan,ensure_ascii=False).replace('<','\\u003c')
template=re.sub(r'const CLUSTER_DATA = \{.*?\n    \};',lambda _: 'const CLUSTER_DATA = '+serialized+';',template,count=1,flags=re.S)
template=template.replace('<title>Content Cluster Map</title>','<title>LetBuyy provisional content map</title>').replace('<footer>Generated by Claude SEO</footer>','<footer>Planning artifact · 29 October 2026 · Existing pages; proposed links · Keyword volumes and SERP overlap not measured · Framework and prompts © Daniel Agrici, CC BY 4.0: github.com/AgriciDaniel/flow</footer>')
template=template.replace('(Number(data.meta.estimatedWords) || 0).toLocaleString()', '"Not measured"').replace('(Number(info.wordCount) || 0).toLocaleString()', '"Not measured"')
# Render the evidence limit prominently before any interactive chart.
template=template.replace('<body>','<body>\n<p style="padding:12px;text-align:center;background:#fff4d6;color:#232323">Provisional intent map of 17 existing pages. Lines are proposed links, not observed links. No keyword volume or controlled SERP overlap measured.</p>',1)
(R/'cluster-map.html').write_text(template)
print('Wrote cluster-plan.json, internal-link-matrix.csv and cluster-map.html; source inventory',len(items),'candidate phrases',len(phrases),'proposed links',len(links))
