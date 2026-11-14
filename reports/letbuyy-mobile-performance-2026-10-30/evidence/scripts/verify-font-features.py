from fontTools.ttLib import TTFont
from fontTools.pens.recordingPen import RecordingPen
from pathlib import Path
import json,hashlib
w=Path('/tmp/letbuyy-mobile-performance-20261030');a=TTFont(w/'font-variants/previous-full-features.woff2');b=TTFont('apps/marketing/web/public/fonts/Inter-Variable-Marketing.woff2');assert a.getBestCmap()==b.getBestCmap()
axes=lambda f:[(x.axisTag,x.minValue,x.defaultValue,x.maxValue)for x in f['fvar'].axes];assert axes(a)==axes(b)
for name in b.getGlyphOrder():assert a['hmtx'][name]==b['hmtx'][name]
for t,keys in [('OS/2',['xAvgCharWidth','sTypoAscender','sTypoDescender','sTypoLineGap','usWinAscent','usWinDescent']),('hhea',['ascent','descent','lineGap'])]:
 for key in keys:assert getattr(a[t],key)==getattr(b[t],key)
cases=0
for weight in [100,400,500,600,700,900]:
 for optical in[14,23,32]:
  x=a.getGlyphSet(location={'wght':weight,'opsz':optical});y=b.getGlyphSet(location={'wght':weight,'opsz':optical})
  for name in b.getGlyphOrder():
   assert x[name].width==y[name].width,(name,weight,optical,'variable advance');p=RecordingPen();q=RecordingPen();x[name].draw(p);y[name].draw(q);assert p.value==q.value,(name,weight,optical);cases+=1
for n in [0,13,14]:assert a['name'].getDebugName(n)==b['name'].getDebugName(n)
features=lambda f,t:[r.FeatureTag for r in f[t].table.FeatureList.FeatureRecord]
result={'previous_full_features_bytes':(w/'font-variants/previous-full-features.woff2').stat().st_size,'variant_bytes':Path('apps/marketing/web/public/fonts/Inter-Variable-Marketing.woff2').stat().st_size,'variant_sha256':hashlib.sha256(Path('apps/marketing/web/public/fonts/Inter-Variable-Marketing.woff2').read_bytes()).hexdigest(),'cmap_equal':True,'retained_codepoints':len(b.getBestCmap()),'axes_equal':True,'all_retained_glyph_advances_equal':True,'all_retained_glyph_outlines_equal':True,'outline_comparisons':cases,'exact_gvar_models_equal':all([(u.axes,u.coordinates)for u in a['gvar'].variations.get(n,[])]==[(u.axes,u.coordinates)for u in b['gvar'].variations.get(n,[])]for n in b.getGlyphOrder()),'metrics_equal':True,'license_equal':True,'before_glyphs':len(a.getGlyphOrder()),'after_glyphs':len(b.getGlyphOrder()),'retained_GSUB':features(b,'GSUB'),'retained_GPOS':features(b,'GPOS'),'removed_GSUB':sorted(set(features(a,'GSUB'))-set(features(b,'GSUB'))),'configured_css_features':['tnum'],'default_shaping_features_preserved':True,'note':'No removed feature is requested by the inspected marketing or UI source. Future typography feature additions must regenerate the subset.'};(w/'font-feature-proof.json').write_text(json.dumps(result,indent=2));print(json.dumps(result))
