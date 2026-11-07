'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const {chromium,webkit}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const policy=require('../config/editorial-maintenance'),source=require('../lib/editorial-maintenance').sources();
const html=fs.readFileSync('admin.html','utf8'),styles=[...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m=>m[1]).join('\n');
(async()=>{for(const [engine,type] of Object.entries({chromium,webkit})){const browser=await type.launch(engine==='chromium'?{channel:'chrome'}:{});try{
 for(const width of [390,1280]){
 const page=await browser.newPage({viewport:{width,height:1000}});
 await page.setContent('<style>'+styles+'</style><main id="editorial"></main>');
 await page.addScriptTag({path:'config/admin-editorial-workspace.js'});
 const events=source.events.filter(e=>['epl-2026-27-128980','evt_84'].includes(e.id));
 const cards=events.map(event=>({id:event.id,name:event.name,key:event.key,date:event.date,copy:policy.copy(event),sources:event.editorialSources,state:{revision:0,history:[]},eligibility:{reasons:['real-average-above-4.8']},schedule:{protected:policy.protectedFixture(event),due:true,cadenceDays:5,nextDueDate:event.date},selected:true}));
 await page.evaluate(async cards=>{
 window.editorialCommands=[];
 await NOTHINGSPORTS_ADMIN_EDITORIAL_UI.mount(document.querySelector('main'),{commsRequest:async command=>{
 if(command.action==='editorial-list')return {horizon:{from:'2026-10-02',to:'2026-10-16'},cards};
 if(window.editorialFailure)throw Error(window.editorialFailure);
 window.editorialCommands.push(command);const card=cards.find(c=>c.id===command.eventId);return {state:{...card.state,revision:card.state.revision+1,held:command.held??false,pending_copy:command.copy??null}};
 }});
 },cards);
 const city=page.locator('[data-editorial-id="epl-2026-27-128980"]');await city.locator(':scope > summary').click();
 assert.equal(await city.locator('textarea').count(),4);await city.locator('[data-editorial-field="hook"]').fill('A queued owner Hook');await city.locator('[data-editorial-save]').click();
 await page.waitForFunction(()=>window.editorialCommands.length===1);assert.equal((await page.evaluate(()=>editorialCommands[0])).expectedRevision,0);
 await city.locator('[data-editorial-hold]').click();await page.waitForFunction(()=>window.editorialCommands.length===2);const hold=await page.evaluate(()=>editorialCommands[1]);assert.equal(hold.expectedRevision,1);assert.equal(hold.held,true);
 await city.locator('[data-editorial-field="hook"]').fill('Unsaved copy survives the conflict');
 await page.evaluate(()=>{window.editorialFailure='Editorial revision conflict; reload before saving.';});
 await city.locator('[data-editorial-save]').click();
 await page.waitForFunction(()=>document.querySelector('[data-editorial-id="epl-2026-27-128980"] [data-editorial-status]').textContent.includes('reload before saving'));
 assert.equal(await city.locator('[data-editorial-field="hook"]').inputValue(),'Unsaved copy survives the conflict');
 assert.equal(await page.evaluate(()=>window.editorialCommands.length),2,'failed save cannot claim a queued edit or advance the revision');
 const nrl=page.locator('[data-editorial-id="evt_84"]');assert.equal(await nrl.locator('textarea:disabled').count(),4);assert(await nrl.locator('[data-editorial-save]').isDisabled());
 console.log(engine+' '+width+'px: full Owner copy, queued save, revision-aware hold and protected NRL passed.');await page.close();
 }
 }finally{await browser.close();}}})().catch(e=>{console.error(e);process.exitCode=1;});
