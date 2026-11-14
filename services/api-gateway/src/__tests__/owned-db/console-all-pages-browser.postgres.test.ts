import assert from 'node:assert/strict';
import test from 'node:test';
import { expect } from '@playwright/test';
import { withConsoleBrowser } from './console-browser-fixture';
import { requireOwnedDatabase } from './owned-db-support';
import { newSyntheticTenant, seedSyntheticTenant } from './synthetic-tenant';
const owned=requireOwnedDatabase();
const paths=['dashboard','stores','merchants','founding','users','employees','revenue','subscriptions','money-reconciliation',
    'marketplace-listings','reels','trust-safety','analytics','operations','incidents','risk','compliance','approvals','audit-logs','settings'];

test('all enabled Console pages, populated details, pagination, responsive navigation and failed form drafts',{timeout:600000},async()=>{
    const tenant=newSyntheticTenant('all-pages');seedSyntheticTenant(owned.psql,tenant);
    await withConsoleBrowser(owned,async f=>{
        const actor=f.actors[1],{context,page}=await f.login(actor);
        // A suspended host network is infrastructure noise, not an application assertion.
        // Retry only this named Chromium failure once; HTTP and UI failures remain fatal.
        const visit=async(path:string)=>{
            try{await page.goto(f.origin+'/'+path);}catch(error){
                if(!(error instanceof Error)||!error.message.includes('ERR_NETWORK_IO_SUSPENDED'))throw error;
                console.info('OWNED_BROWSER_NETWORK_SUSPENSION_RETRY '+path.split('/')[0]);
                await page.goto(f.origin+'/'+path);
            }
        };
        const category=crypto.randomUUID(),caseId=crypto.randomUUID(),reel=crypto.randomUUID(),revision=crypto.randomUUID();
        owned.psql(`INSERT INTO marketplace_categories(id,slug,name) VALUES('${category}','synthetic-console-pages','Synthetic console category');
            UPDATE sites SET custom_user_id='${actor.id}' WHERE id='${tenant.siteId}';
            INSERT INTO ts_cases(id,site_id,subject_type,subject_id,category,severity,status,title)
                VALUES('${caseId}','${tenant.siteId}','site','${tenant.siteId}','fraud','high','open','Synthetic page review case');
            INSERT INTO commerce_reels(id,site_id,created_by,updated_by)VALUES('${reel}','${tenant.siteId}','${actor.id}','${actor.id}');
            INSERT INTO commerce_reel_revisions(id,site_id,reel_id,version,selection,created_by,updated_by)
                VALUES('${revision}','${tenant.siteId}','${reel}',1,'{"media_asset_id":null,"listing_id":null,"variant_id":null,"thumbnail_asset_id":null,"caption":"Synthetic private draft","rights_evidence_ids":[]}','${actor.id}','${actor.id}');
            -- Synthetic rejected record tests operator readback only; no media/inspection evidence is fabricated.
            UPDATE commerce_reels SET status='rejected',version=1,current_revision_id='${revision}' WHERE id='${reel}';
            DO $$DECLARE p uuid;l uuid;BEGIN PERFORM set_config('app.site_id','${tenant.siteId}',true);
                FOR n IN 1..26 LOOP p:=gen_random_uuid();l:=gen_random_uuid();
                    INSERT INTO products(id,site_id,store_id,name,slug,description,price,images,stock,is_active,status,country_of_origin)
                        VALUES(p,'${tenant.siteId}','${tenant.siteId}','Synthetic page product '||n,'syn-page-product-'||n,'Synthetic review fixture',129,ARRAY[]::text[],8,true,'active','IN');
                    INSERT INTO channel_listings(id,site_id,product_id,channel,marketplace_category_id,visibility)
                        VALUES(l,'${tenant.siteId}',p,'marketplace','${category}','public');
                    PERFORM transition_channel_listing('${tenant.siteId}',l,'pending_review','merchant','${actor.id}',NULL,'syn-page-submit-'||l::text);
                END LOOP;END$$;`);
        for(const path of paths){
            await visit(path);
            await expect(page.locator('#console-main h1').first()).toBeVisible();
            await expect(page.locator('#console-main [role=alert]')).toHaveCount(0);
            assert.equal(await page.getByRole('main').count(),1,path);
            await page.setViewportSize({width:390,height:844});
            assert.equal(await page.evaluate("document.documentElement.scrollWidth > window.innerWidth"),false,path+' mobile overflow');
            await page.setViewportSize({width:1440,height:1000});
        }
        for(const path of ['developers','marketplace-governance']){
            await visit(path);
            // Next may have started streaming the layout before notFound(); verify the rendered denial.
            await expect(page.getByRole('heading',{name:'404',exact:true})).toBeVisible();
        }
        const listing=owned.psql(`SELECT id FROM channel_listings WHERE site_id='${tenant.siteId}' ORDER BY id LIMIT 1;`);
        for(const path of ['merchants/'+tenant.siteId,'trust-safety/'+caseId,'marketplace-listings/'+listing,'reels/'+reel]){
            await visit(path);await expect(page.locator('#console-main h1').first()).toBeVisible();
            if(path.startsWith('reels/'))await expect(page.getByText('Caption: Synthetic private draft',{exact:true})).toBeVisible();
            await expect(page.locator('#console-main [role=alert]')).toHaveCount(0);
        }
        await visit('marketplace-listings');await page.getByRole('link',{name:'Next',exact:true}).click();
        await expect(page).toHaveURL(/page=2/);await expect(page.getByRole('link',{name:'Review listing',exact:true})).toHaveCount(1);
        await visit('operations');
        const form=page.locator('form').filter({has:page.getByRole('button',{name:'Create schedule',exact:true})});
        await form.getByLabel('Team',{exact:true}).fill('Synthetic retained draft');await form.getByLabel('Rotation',{exact:true}).fill('Synthetic rotation');
        await form.getByLabel('Primary employee ID',{exact:true}).fill('not-a-uuid');await form.getByLabel('Reason',{exact:true}).fill('Synthetic invalid-owner recovery check');
        const before=owned.psql('SELECT count(*) FROM oncall_schedules;');
        await form.getByRole('button',{name:'Create schedule',exact:true}).click();
        await expect(form.getByRole('alert')).toContainText('entries are retained');
        await expect(form.getByLabel('Team',{exact:true})).toHaveValue('Synthetic retained draft');
        assert.equal(owned.psql('SELECT count(*) FROM oncall_schedules;'),before);
        await visit('dashboard');await page.setViewportSize({width:390,height:844});
        await page.getByRole('button',{name:'Open navigation',exact:true}).click();await expect(page.getByRole('dialog',{name:'Navigation',exact:true})).toBeVisible();
        await page.getByRole('dialog',{name:'Navigation',exact:true}).getByRole('button',{name:'Close',exact:true}).click();
        await context.close();
        console.info('OWNED_CONSOLE_PAGE_COVERAGE '+JSON.stringify({indexPages:20,populatedDetails:4,frozenPages:2,listingSecondPage:true,draftFailureRetained:true,mobileNavigation:true}));
    },{makerRole:'super'});
});
