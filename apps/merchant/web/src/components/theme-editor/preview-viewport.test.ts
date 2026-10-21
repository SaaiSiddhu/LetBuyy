import assert from 'node:assert/strict';
import test from 'node:test';
import {fitPreviewViewport} from './preview-viewport';

test('desktop presentation preserves a1440px viewport while fitting the available editor panel',()=>{
 const fit=fitPreviewViewport('desktop',575,744);assert.equal(fit.width,1440);
 assert.ok(Math.abs(fit.width*fit.scale-575)<.01);assert.ok(fit.height*fit.scale>=744&&fit.height*fit.scale<745);
});
test('mobile and tablet viewport widths agree with the labelled device rather than their available panel',()=>{
 assert.equal(fitPreviewViewport('mobile',575,744).width,390);assert.equal(fitPreviewViewport('mobile',575,744).scale,1);
 const tablet=fitPreviewViewport('tablet',500,744);assert.equal(tablet.width,820);assert.ok(Math.abs(tablet.width*tablet.scale-500)<.01);
});
test('unmeasured, invalid and extremely narrow panels cannot create unbounded iframe geometry',()=>{
 for(const [w,h] of [[0,0],[NaN,Infinity],[1,1000]]){const fit=fitPreviewViewport('desktop',w,h);assert.ok(Number.isFinite(fit.width)&&Number.isFinite(fit.height)&&Number.isFinite(fit.scale));assert.ok(fit.height>0&&fit.height<=4096);assert.ok(fit.scale>0&&fit.scale<=1);}
});
