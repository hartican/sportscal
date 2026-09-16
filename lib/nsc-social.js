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
function item(id,kind){const known=entityDirectory().get(id),parts=String(id).split(':'),key=parts.find(v=>['nrl','nrlw','afl','aflw','cricket','tennis','rugby','rugby-union','football','f1','motorsport','nbl','nba'].includes(v));const entityType=kind==='entity'?(String(id).startsWith('team:')?'team':'athlete'):String(id).startsWith('competition:')?'competition':String(id).startsWith('sport:')?'sport':kind;return {id,kind,entityType,label:known?.label||id.replace(/^(?:sport|competition|collection|event-series):/,'').replace(/[-:]/g,' '),sport:known?.sport||key||'other'};}
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
async function copy(body,user,{profileLookup=publicProfile,stateLookup=stateFor,listPicks=picks,query=request}={}){
 const source=await profileLookup(body.targetProfileId);if(source.user_id===user.id)throw err('Choose another Nothinger.');
 if(!Array.isArray(body.items)||body.items.length>500||body.items.some(x=>!x||typeof x.id!=='string'||!['entity','selector','event','collection','fixture'].includes(x.kind)))throw err('Select up to 500 sporting picks.');
 const selected=new Set(body.items.map(x=>x.kind+':'+x.id));
 const [theirs,own]=await Promise.all([stateLookup(source.user_id),stateLookup(user.id)]);const available=listPicks(theirs);const mine=new Set(listPicks(own).map(x=>x.kind+':'+x.id));
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
 const result=await query('/rest/v1/rpc/nothingsports_copy_picks',{method:'POST',body:{actor:user.id,source_profile:source.profile_id,expected_preferences:own.preferences,expected_events:own.event_user_state||{},new_preferences:next,new_events:events,added_sports:[...new Set(added.map(x=>x.sport))]}});
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
function ratingAffinityFromRows(rows,eventLookup=server.eventFor){
 const unique=new Map();for(const row of rows){const key=`${row.event_id}:${row.phase}`,at=row.updated_at||row.submitted_at;if(!unique.has(key)||String(at)>String(unique.get(key).at))unique.set(key,{...row,at});}
 const roots={f1:'sport:motorsport',motorsport:'sport:motorsport',wrc:'sport:motorsport',motogp:'sport:motorsport',nba:'sport:nba',basketball:'sport:nba',nbl:'sport:nbl','premier-league':'sport:football',fifa:'sport:football',football:'sport:football',rugby:'sport:rugby','rugby-union':'sport:rugby'};
 const sports=new Map();for(const row of unique.values()){const event=eventLookup(row.event_id);if(!event)continue;const sport=event.codeId==="sport:nbl"||event.discoverySportId==="sport:nbl"?"nbl":labels.sport(event),sportId=roots[sport]||`sport:${sport}`,current=sports.get(sportId)||{sportId,count:0,lastInteractedAt:null};current.count++;if(!current.lastInteractedAt||String(row.at)>current.lastInteractedAt)current.lastInteractedAt=row.at;sports.set(sportId,current);}
 return[...sports.values()].sort((a,b)=>b.count-a.count||String(b.lastInteractedAt).localeCompare(String(a.lastInteractedAt))||a.sportId.localeCompare(b.sportId));
}
async function ratingAffinity(user,now=new Date()){
 if(!user)return{windowDays:90,sports:[]};
 const cutoff=new Date(now.getTime()-90*86400000).toISOString();
 const rows=await server.rows(server.TABLES.contributions,{user_id:`eq.${user.id}`,updated_at:`gte.${cutoff}`,select:'event_id,phase,submitted_at,updated_at'});
 return{windowDays:90,sports:ratingAffinityFromRows(rows)};
}
module.exports={publicProfile,preview,copy,activity,picks,excluded,ratingAffinity,ratingAffinityFromRows};
