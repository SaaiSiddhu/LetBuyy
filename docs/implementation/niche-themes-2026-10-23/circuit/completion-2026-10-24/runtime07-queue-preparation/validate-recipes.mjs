// Source-only validation of the new controller inputs. No HTTP/DB/browser,
// process launch, provider binding or candidate mutation is performed.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
const root=process.cwd(),out=dirname(fileURLToPath(import.meta.url));
const candidate='/private/tmp/letbuyy-shared-completion-20261024-06';
const coverage=JSON.parse(readFileSync(resolve(root,'docs/implementation/niche-themes-2026-10-23/circuit/completion-2026-10-24/COVERAGE.json'),'utf8'));
const request=coverage.controllerQueueRequest;
assert.equal(request.runtime.runId,'49ada80bc494');assert.equal(request.revision,2);
const core=await import(pathToFileURL(resolve(candidate,'packages/commerce-core/src/index.ts')));
const results=[];
for(const recipe of request.supplementalRecipes){
  const input={store_id:request.runtime.siteId,...recipe.createFields};
  const parsed=core.CreateProductSchema.parse(input);
  assert.equal(parsed.name,input.name);assert.equal(parsed.price,input.price);
  assert.deepEqual(parsed.metadata,input.metadata,'Merchant metadata must survive the actual canonical create parser');
  assert.deepEqual(parsed.product_options,input.product_options);
  assert.equal(parsed.variants.length,input.variants.length);
  for(const[index,variant]of parsed.variants.entries()){
    assert.equal(variant.stock,input.variants[index].stock);
    assert.deepEqual(variant.options,input.variants[index].options);
    assert.equal(Object.hasOwn(variant.metadata,'electronics'),false,'Cosmetic variants cannot supply electronics overrides');
  }
  results.push({key:recipe.key,status:'VALID_CANONICAL_CREATE_INPUT_NOT_CREATED',name:parsed.name,variantCount:parsed.variants.length});
}
const fields=request.laterCatalogEdit.updateFields;
const unboundEdit=core.UpdateProductSchema.safeParse(fields);
assert.equal(unboundEdit.success,false);
assert.deepEqual(unboundEdit.error.issues.map(issue=>issue.path.join('.')).sort(),['idempotency_key','version']);
const parsedEdit=Object.fromEntries(Object.entries(fields).map(([key,value])=>[key,core.UpdateProductSchema.shape[key].parse(value)]));
assert.equal(Object.hasOwn(parsedEdit,'stock'),false);
assert.equal(parsedEdit.price,1300);assert.deepEqual(parsedEdit.metadata,fields.metadata);
const cable=request.supplementalRecipes.find(recipe=>recipe.key==='cable');
const actualUnicode=core.normalizeStorefrontManufacturerKey(cable.createFields.metadata.electronics.manufacturer);
const expectedUnicode=request.stages.find(stage=>stage.id==='F').expectedFacetRows.unicodeManufacturer.expectedCanonicalValue;
assert.equal(actualUnicode,expectedUnicode);
const sha=value=>createHash('sha256').update(value).digest('hex');
const result={recordedAt:new Date().toISOString(),classification:'NEW_RUNTIME07_RECIPE_INPUT_VALIDATION_NOT_RUNTIME_EXECUTION',requestId:request.requestId,revision:request.revision,runId:request.runtime.runId,results,laterEdit:{canonicalFieldsValid:true,stockOmitted:true,completeSaveCommand:false,missingActualBindings:['version','idempotency_key'],actualVersionAndIdempotencyMustComeFromController:true},manufacturer:{actualUnicode,expectedUnicode},sourceInputs:['packages/commerce-core/src/index.ts','packages/commerce-core/src/circuit-facts.ts','packages/commerce-core/src/storefront-discovery.ts'].map(path=>({path,candidateSha256:sha(readFileSync(resolve(candidate,path)))})),newInstalledPasses:0,noRuntimeOrProviderActions:true};
writeFileSync(resolve(out,'result.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});
process.stdout.write(JSON.stringify({validatedRecipes:results.length,laterEditFieldsValid:true,UnicodeExpectedValueExact:true,newInstalledPasses:0})+'\n');
