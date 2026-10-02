(function(root){
  'use strict';
  const ROLLOUT_VERSION=2,competition='competition:premier-league',game='fpl-classic';
  const choices=new Set(['rollout','pending-onboarding','onboarding','settings']);
  function normalizePreferences(raw){
    const p=raw&&typeof raw==='object'?raw:{};
    return {enabled:p.enabled===true,gameByCompetition:p.gameByCompetition?.[competition]===game?{[competition]:game}:{},rolloutVersion:Number.isSafeInteger(p.rolloutVersion)&&p.rolloutVersion>=ROLLOUT_VERSION?p.rolloutVersion:ROLLOUT_VERSION,choiceSource:choices.has(p.choiceSource)?p.choiceSource:'pending-onboarding'};
  }
  function migratePreferences(raw){
    if(Number.isSafeInteger(raw?.rolloutVersion)&&raw.rolloutVersion>=ROLLOUT_VERSION)return normalizePreferences(raw);
    return normalizePreferences({enabled:true,gameByCompetition:{[competition]:game},choiceSource:'rollout'});
  }
  function onboardingChoice(enabled){return normalizePreferences({enabled,gameByCompetition:enabled?{[competition]:game}:{},choiceSource:'onboarding'});}
  function hydratePreferences(remote,local){
    const incoming=migratePreferences(remote);
    return incoming.choiceSource==='rollout'&&local?.rolloutVersion>=2&&['settings','onboarding'].includes(local.choiceSource)?normalizePreferences(local):incoming;
  }
  const api={normalizePreferences,migratePreferences,onboardingChoice,hydratePreferences};
  root.NOTHINGSPORTS_FANTASY_PREFERENCES=api;
  root.NOTHINGSPORTS_FANTASY_DEADLINES=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
