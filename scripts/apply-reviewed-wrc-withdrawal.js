#!/usr/bin/env node
'use strict';
const fs=require('node:fs');
const {eventToCard}=require('./sync-wrc-to-feed');
const canonical=require('../data/canonical/wrc-context-2026.json');
function apply(feed,context=canonical){
 const event=context.events.find(e=>e.id==='event:wrc:2026:round-14');
 if(event?.status!=='cancelled'||event.statusSourceUrl!=='https://api.fia.com/news/fia-and-wrc-promoter-confirm-final-round-2026-fia-world-rally-championship'||!Number.isFinite(Date.parse(event.statusCheckedAt)))throw Error('Reviewed WRC withdrawal evidence unavailable');
 const card=eventToCard(event,context),fields=['status','scheduleNote','statusSourceUrl','statusCheckedAt','replayEligible','highlightEligible','briefingEligible','catchupEligible','selectedSentence','fullSpiel','storyline'];
 return {...feed,events:feed.events.map(old=>old.id===card.id?{...old,...Object.fromEntries(fields.map(k=>[k,card[k]]))}:old)};
}
if(require.main===module)for(const file of['feeds/incoming/events.json','data/events.json'])fs.writeFileSync(file,JSON.stringify(apply(JSON.parse(fs.readFileSync(file))),null,2)+'\n');
module.exports={apply};
