import assert from 'node:assert/strict';
import test from 'node:test';
import {getDefaultStorefrontThemeTemplate,resolveStorefrontThemePresentation} from '../src/index';
test('merchant appearance controls storefront and checkout tokens without moving custom CSS into theme settings',()=>{
 const raw=getDefaultStorefrontThemeTemplate('letbuyy-core') as unknown as Record<string,unknown>;
 const appearance={primary_color:'#123456',font_family:'Khand',border_radius:0,custom_css:'private-unscoped-css-marker'};
 const resolved=resolveStorefrontThemePresentation(raw,appearance,'letbuyy-core','en-IN');
 assert.equal(resolved.themeSettings.primaryColor,'#123456');assert.equal(resolved.themeSettings.fontFamily,'Khand');assert.equal(resolved.themeSettings.headingFontFamily,'Khand');assert.equal(resolved.themeSettings.borderRadius,0);
 assert.equal(JSON.stringify(resolved.themeSettings).includes('private-unscoped-css-marker'),false);
});
test('empty old configs get the same renderable default and finite theme values',()=>{
 const resolved=resolveStorefrontThemePresentation({}, {}, 'letbuyy-core','en-IN');
 assert.ok(resolved.templateConfig.liquidBundle||resolved.templateConfig.sections);assert.match(resolved.themeSettings.primaryColor,/^#[0-9a-f]{6}$/i);assert.equal(Number.isFinite(resolved.themeSettings.borderRadius),true);
});
