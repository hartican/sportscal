(function(root){
'use strict';
const accountIndicatorSessionId=globalThis.crypto?.randomUUID?.() || 'account-'+Date.now();
function accountIndicatorSnapshot(){
  const life = serverSyncClient?.accountSnapshot?.() || {accountId:'',hasSession:false,generation:0};
  const verified = accountIndicatorGeneration === life.generation;
  const user = verified ? serverPersistence.user : null;
  const profileScope=nothingscoreViewerScope;
  const profile=verified&&profileScope?.owner===life.accountId&&profileScope.generation===life.generation?nothingscoreViewer.profile:null;
  const state = !life.hasSession && serverPersistence.state !== 'requesting'
    ? 'signedOut' : !verified && serverPersistence.state==='syncing' ? 'checking'
    : !verified && life.hasSession && !['checking','requesting'].includes(serverPersistence.state) ? 'error' : serverPersistence.state;
  return {facts:{state,user,sessionOwnerId:life.accountId,sessionExpiresAt:life.expiresAt,
    profile,profileOwnerId:profile?profileScope.owner:'',online:navigator.onLine,now:Date.now()},
    session:{appSessionId:accountIndicatorSessionId,accountEpoch:life.generation}};
}
function finishAccountIndicatorJourney(result){
  const journey=accountIndicatorJourney;if(!journey)return;
  accountIndicatorJourney=null;journey.resolve(result);
  if(!result?.signedIn && journey.returnFocus?.isConnected)journey.returnFocus.focus();
}
function openIndicatorAccount({returnFocus=document.activeElement,profilePicture=false,intentScope=null}={}){
  finishAccountIndicatorJourney(null);
  return new Promise(resolve=>{
    accountIndicatorJourney={resolve,returnFocus,phase:'opened'};openSettings({section:'account'});
    if(profilePicture){
      const model=root.NOTHINGSPORTS_ACCOUNT_AWARENESS,fresh=accountIndicatorSnapshot(),view=model.accountView(fresh.facts),scope=model.scopeFor(view,fresh.session);
      if(!model.sameScope(intentScope,scope)||!['signedIn','offline'].includes(view.status))return;
      const input=document.querySelector('#settingsBody .public-profile-avatar-editor input[type="file"]');
      if(!input?.isConnected||input.disabled)return;
      input.focus({preventScroll:true});input.closest('.public-profile-avatar-editor')?.scrollIntoView({block:'center'});
      const latest=accountIndicatorSnapshot();if(!model.sameScope(scope,model.scopeFor(model.accountView(latest.facts),latest.session)))return;
      input.click();
    }
  });
}
function completeAccountIndicatorJourney(journey,life){
  const fresh=serverSyncClient?.accountSnapshot?.();
  if(journey && journey===accountIndicatorJourney && fresh?.accountId===life?.accountId
    && fresh.generation===life.generation && serverPersistence.state==='signedIn'
    && serverPersistence.user?.id===fresh.accountId){
    finishAccountIndicatorJourney({signedIn:true,accountId:fresh.accountId,
      appSessionId:accountIndicatorSessionId,accountEpoch:fresh.generation});
  }else if(journey && journey===accountIndicatorJourney)finishAccountIndicatorJourney(null);
}
function acceptAccountIndicatorProfile(viewer,owner,generation){
  const life=serverSyncClient?.accountSnapshot?.();
  if(owner!==serverPersistence.user?.id || owner!==life?.accountId || accountIndicatorGeneration!==life.generation || generation!==life.generation
    || nothingscoreViewerScope?.owner!==owner || nothingscoreViewerScope.generation!==generation || viewer!==nothingscoreViewer)return;
  renderAccountIndicator();
}
function mount(){
  if(accountIndicatorController)return accountIndicatorController;
  const host=document.getElementById('accountIndicator'),focused=host.contains(document.activeElement);
  host.replaceChildren();
  accountIndicatorController=NOTHINGSPORTS_ACCOUNT_AWARENESS_UI.create({host,readSnapshot:accountIndicatorSnapshot,openAccount:openIndicatorAccount,openPicture:options=>openIndicatorAccount({...options,profilePicture:true})});
  if(focused)host.querySelector('.account-awareness-control').focus();
  return accountIndicatorController;
}
root.NOTHINGSPORTS_ACCOUNT_INDICATOR_APP=Object.freeze({mount,open:openIndicatorAccount,finish:finishAccountIndicatorJourney,complete:completeAccountIndicatorJourney,acceptProfile:acceptAccountIndicatorProfile});

})(globalThis);
