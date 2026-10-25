/** Derived review thumbnails only; raw full-page browser evidence remains unchanged. */
const path = require('node:path');
const fs = require('node:fs');
const sharp = require('/Users/saai_mithra/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const root = path.resolve('docs/implementation/niche-themes-2026-10-23/marginalia');
async function main() {
  fs.mkdirSync(path.join(root, 'browser-review'), { recursive: true });
  const scenes = ['home','collection','book','stationery','missing','empty','essays'];
  for (const device of ['desktop','tablet','mobile','narrow']) {
    const cells = [];
    for (const [index, scene] of scenes.entries()) {
      const name = `${scene}-${device}`, file = path.join(root, 'browser-captures', `${name}.png`);
      const metadata = await sharp(file).metadata();
      const thumb = await sharp(file).extract({ left:0, top:0, width:metadata.width, height:Math.min(metadata.height,Math.round(metadata.width*2)) }).resize({ width:280,height:550,fit:'inside' }).png().toBuffer();
      cells.push({ input:thumb,left:index%4*300+10,top:Math.floor(index/4)*590+30 });
      const label = Buffer.from(`<svg width="300" height="24"><rect width="300" height="24" fill="white"/><text x="10" y="17" font-family="Arial" font-size="13">${name}</text></svg>`);
      cells.push({ input:label,left:index%4*300,top:Math.floor(index/4)*590 });
    }
    await sharp({ create:{width:1200,height:1180,channels:3,background:'#eee'} }).composite(cells).png().toFile(path.join(root,'browser-review',`${device}.png`));
  }
  for (const [name, top] of [['book-mobile',850],['long-hindi-320-text2x',0]]) {
    const file = path.join(root,'browser-captures',`${name}.png`), metadata=await sharp(file).metadata();
    await sharp(file).extract({left:0,top,width:metadata.width,height:Math.min(metadata.height-top,1900)}).png().toFile(path.join(root,'browser-review',`${name}-detail.png`));
  }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
