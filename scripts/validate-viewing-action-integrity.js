#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const follow=require('../config/follow-first');
const fixtures=require('../data/code-inspector/football.json').fixtures;
// Rights evidence may describe destination scope before a specific URL exists.
// That must retain a usable general provider destination without promoting it
// to a verified match or event permalink.
const nrlFinal=require('../data/code-inspector/nrl.json').fixtures.find(f=>f.canonicalEventId==='evt_84');assert(nrlFinal);
const finalOptions=follow.viewingOptions(nrlFinal);
assert.deepEqual(finalOptions.map(o=>o.providerId),['nine-tv','nine']);
for(const option of finalOptions){
 assert.equal(option.webUrl,follow.VIEWING_PROVIDERS[option.providerId].webUrl,'actual NRL final keeps its provider destination when rights metadata has scope but no URL');
 assert.equal(option.linkScope,'sport');assert.equal(option.permalinkVerifiedAt,null);
 assert.equal(option.verifiedAt,'2026-09-27T13:39:49.102Z','a destination fallback cannot renew rights evidence');
 assert.equal(option.replayVerified,false);
}
for(const linkScope of ['sport','event','fixture'])for(const webUrl of [undefined,null,'']){
 const event={...nrlFinal,viewingOptions:nrlFinal.viewingOptions.map(o=>({...o,linkScope,webUrl}))};
 const options=follow.viewingOptions(event);
 assert.deepEqual(options,finalOptions,'a missing scoped URL falls back honestly to the same general destination');
 assert.deepEqual(follow.viewingOptions({...event,viewingOptions:options}),options,'normalised fallback remains idempotent');
}
for(const linkScope of ['sport','event','fixture']){
 const explicit='https://www.9now.com.au/official-'+linkScope;
 const event={...nrlFinal,viewingOptions:nrlFinal.viewingOptions.map(o=>({...o,linkScope,webUrl:explicit}))};
 const options=follow.viewingOptions(event);
 assert(options.every(o=>o.webUrl===explicit&&o.linkScope===linkScope),'provided scoped URLs keep their existing precedence');
 assert(options.every(o=>o.permalinkVerifiedAt===(linkScope==='fixture'?o.verifiedAt:null)));
}
for(const competitionId of ['competition:premier-league-2026-27','competition:uefa-champions-league','competition:uefa-europa-league']){
 const final=fixtures.find(f=>f.competitionId===competitionId&&f.status==='completed');assert(final);
 for(const status of ['upcoming','scheduled','live','ongoing','in_progress','postponed','cancelled','abandoned','suspended','unknown']){
  const event={...final,status,scheduleStatus:status,score:'0 - 0',scoreDisplay:'0 - 0'};
  assert(follow.viewingOptions(event).every(o=>o.liveOrReplay==='live'),`${competitionId}/${status}: a partial or placeholder score cannot turn an unresolved match into a replay action`);
 }
 const options=follow.viewingOptions(final);assert(options.every(o=>o.liveOrReplay==='replay'&&o.replayVerified===false));
 const second=follow.viewingOptions({...final,viewingOptions:options,broadcastOptions:[],broadcaster:''});
 const third=follow.viewingOptions({...final,viewingOptions:second,broadcastOptions:[],broadcaster:''});
 assert.deepEqual(second,options,'real completed provider options retain unknown replay availability after normalization');
 assert.deepEqual(third,options,'unchanged repeated normalization remains idempotent');
 const proof={providerId:'stan',liveOrReplay:'both',sourceUrl:options[0].sourceUrl,verifiedAt:'2026-09-30T00:00:00Z',webUrl:options[0].webUrl,linkScope:'sport',rightsScope:'fixture'};
 for(const replayVerified of [false,null,'false',0])assert.equal(follow.viewingOptions({...final,viewingOptions:[{...proof,replayVerified}],broadcastOptions:[],broadcaster:''})[0].replayVerified,false,'an explicit negative/unknown marker cannot be promoted by dated general metadata');
 for(const replayVerified of [undefined,true])assert.equal(follow.viewingOptions({...final,viewingOptions:[{...proof,...(replayVerified===undefined?{}:{replayVerified})}],broadcastOptions:[],broadcaster:''})[0].replayVerified,true,'existing dated replay/both evidence remains usable; controlled proof, not a real playback claim');
 for(const remove of ['sourceUrl','verifiedAt']){const incomplete={...proof,replayVerified:true};delete incomplete[remove];assert.equal(follow.viewingOptions({...final,viewingOptions:[incomplete],broadcastOptions:[],broadcaster:''})[0].replayVerified,false,'a claim without the existing evidence fields remains unverified');}
 const legacy={...final,status:undefined,scheduleStatus:undefined,score:'1 - 0'};assert(follow.viewingOptions(legacy).every(o=>o.liveOrReplay==='replay'),'legacy score-only records with no explicit status keep their existing result fallback');
}
const nonFinal=new Map();
const unusableDestinations=[];
for(const name of fs.readdirSync(require('node:path').join(__dirname,'../data/code-inspector')).filter(f=>f.endsWith('.json')&&f!=='manifest.json')){
 for(const f of require('../data/code-inspector/'+name).fixtures||[])for(const o of follow.viewingOptions(f))if(!/^https:\/\//.test(o.webUrl||''))unusableDestinations.push({id:f.id,providerId:o.providerId});
 for(const f of require('../data/code-inspector/'+name).fixtures||[])if(f.score||f.scoreDisplay||f.canonicalResultScoreline){
  const status=String(f.status||f.scheduleStatus||'').trim().toLowerCase();
  if(status&&!['completed','past','finished','final'].includes(status))nonFinal.set(f.id,f);
 }
}
assert.deepEqual(unusableDestinations,[],'all actual published provider actions must have a usable HTTPS destination');
for(const f of nonFinal.values())assert(follow.viewingOptions(f).every(o=>o.liveOrReplay==='live'),`${f.id}: actual scored non-final record must not acquire replay purpose`);
console.log('Viewing actions: explicit match status, repeated unverified options, retained dated replay evidence and '+nonFinal.size+' actual scored non-final IDs passed.');
