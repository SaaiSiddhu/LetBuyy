import fs from 'node:fs'
import vm from 'node:vm'
import crypto from 'node:crypto'
import ts from '/Users/saai_mithra/Projects/Start_Up/LetBuyy/node_modules/typescript/lib/typescript.js'
import * as geography from '/Users/saai_mithra/Projects/Start_Up/LetBuyy/apps/marketing/web/src/lib/commerce-globe.ts'
import * as finale from '/Users/saai_mithra/Projects/Start_Up/LetBuyy/apps/marketing/web/src/lib/globe-finale.ts'
import { createRenderer } from '/Users/saai_mithra/Projects/Start_Up/LetBuyy/apps/marketing/web/src/lib/commerce-globe-renderer.ts'

const w='/tmp/letbuyy-mobile-performance-20261030'
const source=fs.readFileSync(w+'/before/apps/marketing/web/src/components/CommerceGlobeCanvas.tsx','utf8')
const grid=source.slice(source.indexOf('const GRID:'),source.indexOf('type GlobeColors'))
const functions=source.slice(source.indexOf('type GlobeColors'),source.indexOf('export default function'))
const baseline=ts.transpileModule(grid+functions+'\nexports.renderer=createRenderer;', {compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText
const points=JSON.parse(fs.readFileSync('apps/marketing/web/public/maps/earth-land-dots-v1.json','utf8'))
const regions=JSON.parse(fs.readFileSync('apps/marketing/web/public/maps/india-states-v1.json','utf8'))
const land=points.map(([lat,lon])=>geography.locationVector({lat,lon}))
function recorder(){
 const hash=crypto.createHash('sha256');let operations=0,serial=0
 function value(v){return v instanceof Canvas?{canvas:v.id}:v}
 function add(...args){hash.update(JSON.stringify(args.map(value))+'\n');operations++}
 class Canvas{
  id=serial++;_width=300;_height=150;ctx
  set width(v){this._width=v;add(this.id,'width',v)}get width(){return this._width}
  set height(v){this._height=v;add(this.id,'height',v)}get height(){return this._height}
  getContext(kind){add(this.id,'getContext',kind);if(this.ctx)return this.ctx;const id=this.id;this.ctx=new Proxy({}, {set(target,key,v){add(id,'set',key,v);target[key]=v;return true},get(target,key){if(key in target)return target[key];return(...args)=>{add(id,key,...args);if(String(key).includes('Gradient')){const name=serial++;return{gradient:name,addColorStop:(...stops)=>add(name,'addColorStop',...stops)}}if(key==='createPattern')return{pattern:serial++}}}});return this.ctx}
 }
 return {Canvas,finish:()=>({hash:hash.digest('hex'),operations})}
}
const rows=[]
for(const [width,height,pixelRatio]of[[375,280,1.75],[640,420,2],[600,520,1]])for(const opaque of[false,true])for(const ms of[0,650,1700,3000,6000,9000,9300,9800,10500,11600]){
 const palette={ocean:[.05,.04,.1],surface:[.55,.35,.9],coast:[.7,.5,1],light:[1,1,1],opaque}
 const results=[]
 for(const previous of[true,false]){
  const rec=recorder();const surface=new rec.Canvas();const particles=new rec.Canvas();let renderer
  if(previous){const exports={};vm.runInNewContext(baseline,{...geography,...finale,exports,document:{createElement:()=>new rec.Canvas()},window:{devicePixelRatio:pixelRatio}});renderer=exports.renderer(surface,land,regions)}
  else renderer=createRenderer(surface,land,regions,()=>new rec.Canvas())
  renderer.resize(width,height,pixelRatio)
  const camera=geography.globeFrameAt(geography.globePlaybackAt(ms).milliseconds);const state=finale.globeFinaleAt(ms,geography.GLOBE_PRESENTATION_END_MS)
  if(state.sphereOpacity>0)renderer.draw(camera,palette)
  renderer.shatter(particles.getContext('2d'),palette,state.elapsed,state.particleOpacity)
  results.push(rec.finish())
 }
 rows.push({width,height,pixelRatio,opaque,ms,baseline:results[0],current:results[1],equal:results[0].hash===results[1].hash&&results[0].operations===results[1].operations})
}
const result={captured_at:new Date().toISOString(),method:'Canvas2D command traces from the frozen original renderer and extracted canonical renderer at identical geometry, palette, clock, dimensions and DPR; does not substitute for browser behavior tests',source_sha256:crypto.createHash('sha256').update(source).digest('hex'),cases:rows.length,all_equal:rows.every(x=>x.equal),rows}
fs.writeFileSync(w+'/renderer-parity.json',JSON.stringify(result,null,2));console.log(JSON.stringify({cases:rows.length,all_equal:result.all_equal}));if(!result.all_equal)process.exitCode=1
