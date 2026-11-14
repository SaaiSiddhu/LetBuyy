from pathlib import Path
import json,hashlib
from fontTools.ttLib import TTFont
from fontTools import subset
from fontTools.pens.recordingPen import RecordingPen
root=Path.cwd();src=root/'apps/marketing/web/public/fonts/Inter-Variable.woff2';dest=src.with_name('Inter-Variable-Marketing.woff2');original=TTFont(src);cmap=original.getBestCmap();observed=set()
for p in (root/'apps/marketing/web/src').rglob('*'):
 if p.suffix in ['.ts','.tsx','.json','.css']:observed.update(map(ord,p.read_text()))
keep=set(range(0x100))|observed
unicodes=sorted(set(cmap)&keep);assert 0x20b9 in unicodes
options=subset.Options();options.flavor='woff2';options.layout_features=['calt','ccmp','clig','liga','locl','kern','mark','mkmk','rvrn','tnum','zero'];options.name_IDs=['*'];options.name_legacy=True;options.name_languages=['*'];options.glyph_names=True
font=TTFont(src);subsetter=subset.Subsetter(options=options);subsetter.populate(unicodes=unicodes);subsetter.subset(font);font.flavor='woff2';font.save(dest)
result=TTFont(dest);new=result.getBestCmap();assert set(unicodes) <= set(new);assert all(cp in new for cp in observed if cp in cmap)
axes=lambda f:[(a.axisTag,a.minValue,a.defaultValue,a.maxValue)for a in f['fvar'].axes];assert axes(original)==axes(result)
for cp in new:assert original['hmtx'][cmap[cp]]==result['hmtx'][new[cp]],hex(cp)
for weight in [100,400,900]:
 a=original.getGlyphSet(location={'wght':weight});b=result.getGlyphSet(location={'wght':weight})
 for char in 'LetBuyy0123456789₹.,—':
  if ord(char)not in new:continue
  x=RecordingPen();y=RecordingPen();a[cmap[ord(char)]].draw(x);b[new[ord(char)]].draw(y);assert x.value==y.value,(char,weight)
for name_id in [0,13,14]:assert original['name'].getDebugName(name_id)==result['name'].getDebugName(name_id)
proof={'original_bytes':src.stat().st_size,'subset_bytes':dest.stat().st_size,'original_sha256':hashlib.sha256(src.read_bytes()).hexdigest(),'subset_sha256':hashlib.sha256(dest.read_bytes()).hexdigest(),'source_codepoints':len(cmap),'retained_codepoints':len(new),'requested_codepoints':len(unicodes),'additional_layout_closure_codepoints':sorted(set(new)-set(unicodes)),'all_existing_marketing_characters_previously_supported_preserved':True,'variable_axes':axes(result),'advance_metrics_equal':True,'sample_outlines_equal_at_weights':[100,400,900],'copyright_and_license_metadata_preserved':True,'unicode_codepoints':unicodes,'tool':'fonttools4.60.1 with woff2; isolated temporary runtime','original_font_retained':True,'retained_opentype_features':{t:[r.FeatureTag for r in result[t].table.FeatureList.FeatureRecord]for t in ['GSUB','GPOS']},'feature_scope':'Default shaping plus current CSS tabular numerals/slashed zero; unused optional stylistic alternates removed. New typography features require regeneration.'}
Path('/tmp/letbuyy-mobile-performance-20261030/font-proof.json').write_text(json.dumps(proof,indent=2));print(json.dumps({k:v for k,v in proof.items()if k!='unicode_codepoints'}))
