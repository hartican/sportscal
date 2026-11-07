(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.NOTHINGSPORTS_LOCAL_PREFERENCE_RECOVERY=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const clone=value=>JSON.parse(JSON.stringify(value));
function fail(code='local_recovery_refused'){throw Object.assign(new Error('Local recovery could not be completed. Your saved account was not changed.'),{code});}
function same(a,b){
 if(a===b)return true;
 if(Array.isArray(a)||Array.isArray(b))return Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((v,i)=>same(v,b[i]));
 return object(a)&&object(b)&&Object.keys(a).length===Object.keys(b).length&&Object.keys(a).every(key=>Object.hasOwn(b,key)&&same(a[key],b[key]));
}
function projectOwnRow(row,ownerId){
 if(!object(row)||row.user_id!==ownerId||!ownerId||row.schema_version!=='user-state.v2')fail();
 const fields=['profile','preferences','event_user_state','event_spoiler_state','ratings'];
 if(!fields.every(key=>object(row[key]))||!Array.isArray(row.archived_events)||typeof row.updated_at!=='string'||!Number.isFinite(Date.parse(row.updated_at)))fail();
 const state={};for(const key of ['schema_version',...fields,'archived_events','updated_at'])state[key]=row[key];
 const result={format:'own-state-recovery.v1',ownerId,state,restoreSafe:false};
 if(JSON.stringify(result).length>1024*1024)fail();
 return clone(result);
}
function stateFromSnapshot(response,ownerId){
 if(!object(response)||response.format!=='own-state-recovery.v1'||response.ownerId!==ownerId||response.restoreSafe!==false)fail();
 const row=projectOwnRow({...response.state,user_id:response.ownerId},ownerId).state;
 return {schemaVersion:row.schema_version,profile:row.profile,preferences:row.preferences,eventUserState:row.event_user_state,eventSpoilerState:row.event_spoiler_state,ratings:row.ratings,archivedEvents:row.archived_events,updatedAt:row.updated_at};
}
function sections(preferences){
 const graph=preferences.preferenceGraph;
 // Require the explicit saved graph; never borrow an old local graph on recovery.
 if(!object(graph)||!['domainPreferences','competitionPreferences','entityFollows'].every(key=>Array.isArray(graph[key])))fail();
 return {preferences:clone(preferences),domainPreferences:clone(graph.domainPreferences),competitionPreferences:clone(graph.competitionPreferences),entityFollows:clone(graph.entityFollows),viewingPreference:clone(graph.viewing??null),learningPreference:clone(graph.learning??null)};
}
async function recover(api){
 const captured=api.capture();
 const unchanged=()=>{if(!api.current(captured))fail('local_recovery_changed');};
 unchanged();await api.settle();unchanged();
 const state=stateFromSnapshot(await api.load(captured.accountId),captured.accountId);unchanged();
 if(!Number.isFinite(Date.parse(captured.acceptedUpdatedAt))||Date.parse(state.updatedAt)<Date.parse(captured.acceptedUpdatedAt)
  ||(state.updatedAt===captured.acceptedUpdatedAt&&!same(state.preferences,captured.acceptedPreferences)))fail('local_recovery_stale_response');
 // Refuse remote-only changes in unrelated data rather than relabel them as local removals.
 if(!object(captured.acceptedState)||!['schemaVersion','profile','eventUserState','eventSpoilerState','ratings','archivedEvents'].every(key=>same(state[key],captured.acceptedState[key])))fail('local_recovery_other_state_changed');
 const preferences=api.normalize(clone(state.preferences));
 // Current normalizer/payload must express the actual fresh saved copy, not new intent.
 if(!same(preferences,state.preferences)||!same(api.project(state.preferences,preferences),state.preferences))fail('local_recovery_normalization_changed');
 const next=sections(preferences);unchanged();
 const bundle=api.commit(captured,next); // Synchronous single-record transaction + readback.
 api.accept(bundle,preferences,state,captured);
 return {recovered:true,serverWritten:false};
}
return Object.freeze({projectOwnRow,stateFromSnapshot,sections,same,recover});
});
