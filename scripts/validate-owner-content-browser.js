#!/usr/bin/env node
'use strict';
// Local browser regression with a synthetic admin client. Never authenticates or writes production.
const assert=require('node:assert/strict'),fs=require('node:fs'),{chromium,webkit}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.QA_BASE_URL||'http://127.0.0.1:33993',out=process.env.QA_OUTPUT_DIR||'/Users/jackhartican/Documents/AI/Codex/owner-content-20261002';
async function run(engine,label){
  const artifact=JSON.parse(fs.readFileSync(require('node:path').join(__dirname,'../data/marquee-candidates.v1.json'),'utf8'));
  const browser=await engine.launch(label==='chromium'?{channel:'chrome'}:{});
  try{
    for(const width of [390,1280]){
      const page=await browser.newPage({viewport:{width,height:844},serviceWorkers:'block'}),errors=[],rawReads=[];
      page.on('request',r=>{if(/\/data\/(marquee-candidates|comms-sources|editorial-maintenance-sources)\.v1\.json/.test(r.url()))rawReads.push(r.url());});
      page.on('pageerror',e=>errors.push(e.message));await page.route('**/api/**',r=>r.fulfill({status:401,json:{error:'Sign in required'}}));
      await page.goto(base+'/admin.html');await page.getByRole('heading',{name:'Owner sign in'}).waitFor();assert.equal(await page.getByText('Post workspace',{exact:true}).count(),0);
      await page.evaluate(async artifact=>{
        const rows=artifact.candidates.map(c=>({campaign_id:c.campaignId,event_id:c.eventId,campaign_revision:1,candidate:c,draft_copy:c.drafts,proposed_send_at:c.proposedSendAt,state:'draft'}));
        window.qaCalls=[];window.qaRows=rows;window.qaClient={getSession:()=>({user:{id:'qa-only'}}),commsRequest:async(command)=>{
          if(!command)return{campaigns:structuredClone(rows),assets:[],remindersEnabled:false};
          qaCalls.push(command);const row=rows.find(r=>r.campaign_id===command.campaignId);
          if(command.action==='autosave'){if(command.expectedRevision!==row.campaign_revision)throw Object.assign(Error('Conflict'),{code:'campaign_revision_conflict'});row.draft_copy=command.draftCopy;row.campaign_revision++;row.export_stale=!!row.export_snapshot;return{campaign:structuredClone(row)};}
          if(command.action==='handoff'){row.export_snapshot={campaignRevision:row.campaign_revision,subject:row.draft_copy.email.subject,previewText:row.draft_copy.email.preheader,bodyParagraphs:row.draft_copy.email.bodyParagraphs,primaryCta:row.draft_copy.email.primaryCta,image:{url:row.draft_copy.email.image.publicUrl,altText:'QA hero'},fixture:{liveUrl:row.candidate.participation.liveUrl}};row.export_stale=false;return row.export_snapshot;}
          if(command.action==='post-task'){row.campaign_revision++;if(command.taskAction==='posted')row.posted_at=new Date().toISOString();if(command.taskAction==='snooze')row.snoozed_until=new Date(Date.now()+3600000).toISOString();return{campaign:structuredClone(row)};}
          if(command.action==='publish-live')return{snapshot:{campaignRevision:row.campaign_revision}};
          return{};
        }};
        document.getElementById('adminNav').classList.remove('hidden');await NOTHINGSPORTS_ADMIN_COMMS_UI.mount(document.getElementById('adminApp'),qaClient);
      },artifact);
      assert.equal(await page.locator('[data-editor]:visible').count(),0,'All tasks begin compact');
      assert.equal(await page.locator('.editor-tabs').count(),0,'No mutually exclusive primary tabs');
      assert(!(await page.locator('body').innerText()).match(/Hootsuite|Mailchimp/));
      await page.locator('[data-select]').first().check();await page.waitForTimeout(900);assert.equal(await page.evaluate(()=>qaCalls.length),0,'Selection does not autosave draft');
      await page.locator('[data-open]').first().click();assert.equal(await page.locator('[data-editor]:visible').count(),1);assert(new URL(page.url()).searchParams.has('campaign'));
      const editor=page.locator('[data-editor]:visible');await editor.locator('[data-field=body]').fill('A new hook.\n\nA current form paragraph.');
      await page.waitForFunction(()=>window.qaCalls.some(c=>c.action==='autosave'));await editor.locator('[data-save-state]').filter({hasText:'Saved at'}).waitFor();
      assert.equal(await page.evaluate(()=>qaCalls.filter(c=>c.action==='autosave').at(-1).draftCopy.email.bodyParagraphs.length),2);
      await editor.locator('summary').filter({hasText:'Live ·'}).click();await editor.locator('.ns-live-asset').waitFor();
      assert.equal(await editor.locator('[data-field=animation]').count(),0);assert.equal(await editor.locator('[data-field=logo-order]').count(),0);
      assert(await editor.locator('[data-field=focal-x]').isDisabled(),'No fake crop controls on text fallback');
      assert.notEqual(await editor.locator('.ns-live-fallback').evaluate(e=>getComputedStyle(e).animationName),'none','Fallback animates too');
      await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await editor.locator('.ns-live-fallback').evaluate(e=>getComputedStyle(e).animationName),'none');
      await page.emulateMedia({reducedMotion:'no-preference'});
      await page.evaluate(()=>{const card=document.querySelector('.campaign-card.open');card.__draft.live.hero.firstPartyAssetsOnly=false;card.__draft.live.hero.publicUrl='/assets/brand/web/nothingsport-logo.png';card.querySelectorAll('[data-field^=focal-]').forEach(e=>e.disabled=false);});
      await editor.locator('[data-field=focal-x]').fill('0');await editor.locator('[data-field=focal-x]').dispatchEvent('input');
      assert.equal(await editor.locator('.ns-live-hero>img').evaluate(e=>e.style.objectPosition),'0% 50%');
      await page.locator('[data-open]').nth(1).click();assert.equal(await page.locator('[data-editor]:visible').count(),1);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'No horizontal overflow');
      await page.screenshot({path:out+'/'+label+'-'+width+'.png',fullPage:false});
      assert.deepEqual(errors,[]);assert.deepEqual(rawReads,[],'Owner browser fixtures must use the protected client projection, not raw server downloads');await page.close();
    }
  }finally{await browser.close();}
}
(async()=>{fs.mkdirSync(out,{recursive:true});await run(chromium,'chromium');await run(webkit,'webkit');console.log('Owner browser fixture tests passed: Chromium/WebKit mobile+desktop, sign-in gate, compact rows, deep links, autosave, crop zero and reduced motion.');})().catch(e=>{console.error(e);process.exitCode=1;});
