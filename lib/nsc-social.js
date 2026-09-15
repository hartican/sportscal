'use strict';
const server=require('./nothingscore-server');
const {supabaseServiceRequest:request,USER_STATE_TABLE}=require('./supabase-server');
const labels=require('../config/fixture-labels');
const follow=require('../config/follow-first');
const preferences=require('../config/preference-system');
const {catalogue}=require('./calendar-catalogue');
const actionIdentity=require('../config/event-action-identity');
const policy=require('../config/follow-feed-policy');
const err=(message,status=400)=>Object.assign(new Error(message),{status});
async function publicProfile(id,handle){
 if(!handle&&!/^[\da-f-]{36}$/i.test(id||''))throw err('Choose a public profile.');
 if(handle&&!/^[a-z0-9_]{3,24}$/.test(handle))throw err('Invalid handle.');
 const profile=(await server.rows(server.TABLES.profiles,{...(handle?{handle:`eq.${handle}`}:{profile_id:`eq.${id}`}),visibility:'eq.visible',select:'user_id,profile_id,display_name,handle',limit:'1'}))[0];
 if(!profile||(await server.personaFor(profile.user_id)).moderation_flag)throw err('Profile unavailable.',404);
 return profile;
}
async function stateFor(id){return (await server.rows(USER_STATE_TABLE,{user_id:`eq.${id}`,select:'preferences,event_user_state',limit:'1'}))[0]||{preferences:{},event_user_state:{}};}
let directory;
function entityDirectory(){
 if(directory)return directory;directory=new Map();
 for(const event of catalogue()){
  const sport=labels.sport(event);const add=(id,label,kind)=>{if(id&&!directory.has(id))directory.set(id,{id,label:label||id,sport,kind});};
  add(event.eventId||event.id,event.name,'fixture');add(event.eventFamilyId||event.majorEventId,event.majorEventName||event.competitionName,'event');add(event.competitionId,event.competitionName,'selector');
  for(const p of event.participants||[])if(typeof p==='object')add(p.id,p.name||p.displayName,'entity');
  for(const id of event.participantIds||[])add(id,null,'entity');
 }
 // Follow directory records provide names for teams/players without a current fixture.
 const fs=require('node:fs'),path=require('node:path');
 const folder=path.join(__dirname,'../data/follow-directory');
 if(fs.existsSync(folder))for(const file of fs.readdirSync(folder).filter(f=>f.endsWith('.json'))){const doc=JSON.parse(fs.readFileSync(path.join(folder,file)));for(const p of doc.records||doc.participants||doc.entries||[]){if(p.id)directory.set(p.id,{id:p.id,label:p.displayName||p.name||p.id,sport:labels.sport({...p,key:doc.sportKey||file.split('.')[0]}),kind:'entity'});}}
 return directory;
}
function item(id,kind){const known=entityDirectory().get(id);const key=String(id).split(':').find(v=>['nrl','nrlw','afl','aflw','cricket','tennis','rugby','rugby-union','football'].includes(v));return {id,kind,label:known?.label||id.replace(/^(?:sport|competition|collection|event-series):/,'').replace(/[-:]/g,' '),sport:known?.sport||key||'other'};}
function picks(state){
 const p=follow.migratePreferences(state.preferences),items=[];
 for(const x of p.preferenceGraph?.entityFollows||[])if(!['none','mute'].includes(x.followLevel))items.push(item(x.participantId,'entity'));
 for(const id of p.selectedSelectorEntityIds||[])items.push(item(id,'selector'));
 for(const x of p.preferenceGraph?.competitionPreferences||[])if(x.enabled===true)items.push(item(x.competitionId,'selector'));
 for(const x of p.preferenceGraph?.domainPreferences||[])if(x.enabled===true)items.push(item(x.sportDomainId,'selector'));
 for(const id of p.followFirst?.followedMajorEventIds||[])items.push(item(id,'event'));
 for(const id of p.followFirst?.collectionFollows||[])items.push(item(id,'collection'));
 for(const [id,x]of Object.entries(state.event_user_state||{}))if(x.addedToFixtures)items.push(item(x.addedFixture?.eventId||id,'fixture'));
 return [...new Map(items.map(x=>[x.kind+':'+x.id,x])).values()];
}
function excluded(state,pick){
 const p=follow.migratePreferences(state.preferences);
 if(pick.kind==='entity')return p.preferenceGraph?.entityFollows?.some(x=>x.participantId===pick.id&&x.followLevel==='mute');
 if(pick.kind==='event')return p.followFirst?.excludedMajorEventIds?.includes(pick.id);
 if(pick.kind==='selector')return [...p.preferenceGraph?.domainPreferences||[],...p.preferenceGraph?.competitionPreferences||[]].some(x=>(x.sportDomainId===pick.id||x.competitionId===pick.id)&&x.enabled===false);
 if(pick.kind==='fixture'){const event=server.eventFor(pick.id);return event?Boolean(actionIdentity.actionFor(event,state.event_user_state).dismissed):true;}
 return false;
}
async function preview(profileId,user){const profile=await publicProfile(profileId);const [source,own]=await Promise.all([stateFor(profile.user_id),user?stateFor(user.id):Promise.resolve({preferences:{}})]);const mine=new Set(picks(own).map(x=>x.kind+':'+x.id));return {profile:{profileId:profile.profile_id,name:profile.display_name,handle:profile.handle},items:picks(source).map(p=>({...p,following:mine.has(p.kind+':'+p.id),excluded:excluded(own,p)}))};}
async function copy(body,user){
 const source=await publicProfile(body.targetProfileId);if(source.user_id===user.id)throw err('Choose another Nothinger.');
 const selected=new Set((body.items||[]).slice(0,500).map(x=>x.kind+':'+x.id));
 const [theirs,own]=await Promise.all([stateFor(source.user_id),stateFor(user.id)]);const available=picks(theirs);const mine=new Set(picks(own).map(x=>x.kind+':'+x.id));
 const added=available.filter(x=>selected.has(x.kind+':'+x.id)&&!mine.has(x.kind+':'+x.id));
 if(!added.length)return {added:0,bonusAwarded:0};
 let next=follow.migratePreferences(own.preferences);let events=structuredClone(own.event_user_state||{});
 for(const x of added){
 if(excluded(own,x)&&!(body.overrideIds||[]).includes(x.id))throw err('Select the excluded pick explicitly to follow it.');
 if(x.kind==='entity')next.preferenceGraph=preferences.setEntityFollow(next.preferenceGraph,x.id,'follow');
 if(x.kind==='selector'){
 next.selectedSelectorEntityIds=[...new Set([...next.selectedSelectorEntityIds,x.id])];
 next.preferenceGraph=x.id.startsWith('competition:')?preferences.upsertCompetitionPreference(next.preferenceGraph,x.id,{enabled:true}):preferences.applyDomainOverride(next.preferenceGraph,x.id,{enabled:true});
 }
 if(x.kind==='event'){
 next.followFirst.followedMajorEventIds=[...new Set([...next.followFirst.followedMajorEventIds,x.id])];
 next.followFirst.excludedMajorEventIds=next.followFirst.excludedMajorEventIds.filter(id=>id!==x.id);
 next.followFirst.eventFamilyDecisions={schemaVersion:'event-family-decisions.v1',states:{...next.followFirst.eventFamilyDecisions?.states,[x.id]:'followed'}};
 }
 if(x.kind==='collection')next=follow.setCollectionFollow(next,x.id,true);
 if(x.kind==='fixture'){
 const event=server.eventFor(x.id);if(!event)throw err('This fixture is no longer available.');
 if(policy.explicitlyExcluded(event,next))throw err('Refollow the excluded competition or tournament before adding this fixture.');
 const action=actionIdentity.actionFor(event,events);events=actionIdentity.writeAction(events,event,{...action,eventId:x.id,addedToFixtures:true,addedToFixturesAt:new Date().toISOString(),lastActionAt:new Date().toISOString(),addedFixture:{...event,manualPin:true},manualPin:true,dismissed:false});
 }
 }
 const result=await request('/rest/v1/rpc/nothingsports_copy_picks',{method:'POST',body:{actor:user.id,source_profile:source.profile_id,expected_preferences:own.preferences,expected_events:own.event_user_state||{},new_preferences:next,new_events:events,added_sports:[...new Set(added.map(x=>x.sport))]}});
 return {...result,added:added.length};
}
async function activity(user,cursor=0){
 if(!user)return {entries:[],nextCursor:null};const offset=Math.max(0,Number(cursor)||0);
 const rows=await server.rows('nothingsports_friend_activity',{recipient_user_id:`eq.${user.id}`,order:'created_at.desc,id',offset:String(offset),limit:'25'});
 const following=await require('./user-follows').followingProfileIds(user);const entries=[];
 const identities=await server.identityMaps([...new Set(rows.map(r=>r.rater_user_id))]);
 for(const row of rows){const profile=identities.profiles.get(row.rater_user_id);if(!profile||profile.visibility!=='visible'||!following.has(profile.profile_id)||identities.personas.get(row.rater_user_id)?.moderation_flag)continue;
 const event=server.eventFor(row.event_id);entries.push({id:row.id,eventId:row.event_id,fixture:event?.name||'Fixture',event:event?{...event,manualPin:true}:null,phase:row.phase,createdAt:row.created_at,profileId:profile.profile_id,name:profile.display_name,handle:profile.handle});}

 return {entries,nextCursor:rows.length===25?offset+25:null};
}
module.exports={publicProfile,preview,copy,activity,picks,excluded};
