'use strict';
const assert=require('node:assert/strict');
const prefs=require('../config/fantasy-preferences');
const sync=require('../config/user-state-sync');
const {access}=require('../lib/fantasy/access');
const defaults=prefs.normalizePreferences(),rollout=prefs.migratePreferences(undefined);
assert.deepEqual(defaults,{enabled:false,gameByCompetition:{},rolloutVersion:2,choiceSource:'pending-onboarding'});
for(const legacy of [undefined,{}, {enabled:false,gameByCompetition:{}},{enabled:true,gameByCompetition:{}},{enabled:false,gameByCompetition:{'competition:premier-league':'fpl-classic'}}])assert.deepEqual(prefs.migratePreferences(legacy),rollout);
assert.equal(rollout.enabled,true);assert.equal(rollout.choiceSource,'rollout');assert.equal(rollout.gameByCompetition['competition:premier-league'],'fpl-classic');
assert.deepEqual(prefs.migratePreferences(defaults),defaults,'reset/new defaults never become legacy ON');
for(const enabled of [true,false]){
 const chosen=prefs.onboardingChoice(enabled);assert.equal(chosen.enabled,enabled);assert.equal(chosen.choiceSource,'onboarding');
 assert.deepEqual(prefs.migratePreferences(chosen),chosen);
 assert.deepEqual(chosen.gameByCompetition,enabled?rollout.gameByCompetition:{});
}
const off=prefs.normalizePreferences({...rollout,enabled:false,choiceSource:'settings'});
const none=prefs.normalizePreferences({...rollout,gameByCompetition:{},choiceSource:'settings'});
for(const decision of [off,none,prefs.onboardingChoice(false)]){
 assert.deepEqual(prefs.migratePreferences(decision),decision,'marked backups and explicit choices are retained');
 assert.deepEqual(prefs.hydratePreferences({},decision),decision,'legacy hydration cannot re-enable a local decision');
 assert.deepEqual(prefs.hydratePreferences(rollout,decision),decision,'automatic cloud ON cannot undo an offline decision');
 const cloud={preferences:{fantasyDeadlines:decision,theme:'night'}};
 const automatic=sync.createPatch({preferences:{fantasyDeadlines:{enabled:false,gameByCompetition:{}}}},{preferences:{fantasyDeadlines:rollout}});
 assert.deepEqual(sync.applyPatch(cloud,automatic),cloud,'replayed nested rollout patch is idempotent against a newer decision');
 for(const source of ['rollout','pending-onboarding']){
  const parent={schemaVersion:sync.PATCH_SCHEMA_VERSION,changes:[{path:['preferences'],value:{fantasyDeadlines:{...rollout,choiceSource:source},theme:'day'}}]};
  const actual=sync.applyPatch(cloud,parent);assert.deepEqual(actual.preferences.fantasyDeadlines,decision);assert.equal(actual.preferences.theme,'day');
 }
 const legacyDrop=sync.createPatch(cloud,{preferences:{...cloud.preferences,fantasyDeadlines:{enabled:decision.enabled,gameByCompetition:decision.gameByCompetition}}});
 assert.deepEqual(sync.applyPatch(cloud,legacyDrop),cloud,'older normalisers cannot erase markers');
 const remove={schemaVersion:sync.PATCH_SCHEMA_VERSION,changes:[{path:['preferences','fantasyDeadlines'],remove:true}]};
 assert.deepEqual(sync.applyPatch(cloud,remove),cloud,'legacy parent omission cannot erase the decision');
}
const automaticCloud={preferences:{fantasyDeadlines:rollout,theme:'night'}};
const explicit=sync.createPatch(automaticCloud,{preferences:{...automaticCloud.preferences,fantasyDeadlines:off}});
assert.deepEqual(sync.applyPatch(automaticCloud,explicit).preferences.fantasyDeadlines,off);
const legacyChoice={schemaVersion:sync.PATCH_SCHEMA_VERSION,changes:[{path:['preferences','fantasyDeadlines'],value:{enabled:false,gameByCompetition:{}}}]};
assert.deepEqual(sync.applyPatch(automaticCloud,legacyChoice).preferences.fantasyDeadlines,{...off,gameByCompetition:{}});
assert.deepEqual(prefs.hydratePreferences(defaults,off),defaults,'explicit server reset is accepted');
for(const enabled of [false,true])for(const evaluation of [false,true])for(const approved of [false,true]){
 const environment={FANTASY_FPL_ENABLED:String(enabled),FANTASY_FPL_EVALUATION_ENABLED:String(evaluation),FANTASY_FPL_ACCESS_APPROVED:String(approved)};
 assert.deepEqual(access(environment),{enabled:enabled&&(evaluation||approved),accessStatus:enabled&&(evaluation||approved)?approved?'approved':'evaluation':'disabled'});
 assert.equal(Boolean(require('../lib/fantasy/providers/fpl').source({environment,events:[]})),access(environment).enabled);
}
assert.deepEqual(access({FANTASY_FPL_ENABLED:'TRUE',FANTASY_FPL_EVALUATION_ENABLED:'true'}),{enabled:false,accessStatus:'disabled'});
console.log('Fantasy rollout: existing ON once, fresh/reset OFF, explicit choices, hydration, nested/root stale patches, legacy marker retention and evaluation flags passed.');
