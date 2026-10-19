(function(root){
'use strict';
let accountIndicatorProfileOwner='',accountIndicatorProfileGeneration=-1;
const accountIndicatorSessionId=globalThis.crypto?.randomUUID?.() || 'account-'+Date.now();
function accountIndicatorSnapshot(){
  const life = serverSyncClient?.accountSnapshot?.() || {accountId:'',hasSession:false,generation:0};
  const verified = accountIndicatorGeneration === life.generation;
  const user = verified ? serverPersistence.user : null;
  const state = !life.hasSession && serverPersistence.state !== 'requesting'
    ? 'signedOut' : !verified && serverPersistence.state==='syncing' ? 'checking'
    : !verified && life.hasSession && !['checking','requesting'].includes(serverPersistence.state) ? 'error' : serverPersistence.state;
  return {facts:{state,user,sessionOwnerId:life.accountId,sessionExpiresAt:life.expiresAt,
    profile:accountIndicatorProfileGeneration === life.generation ? nothingscoreViewer.profile : null,
    profileOwnerId:accountIndicatorProfileOwner,online:navigator.onLine,now:Date.now()},
    session:{appSessionId:accountIndicatorSessionId,accountEpoch:life.generation}};
}
function finishAccountIndicatorJourney(result){
  const journey=accountIndicatorJourney;if(!journey)return;
  accountIndicatorJourney=null;journey.resolve(result);
  if(!result?.signedIn && journey.returnFocus?.isConnected)journey.returnFocus.focus();
}
function openIndicatorAccount({returnFocus=document.activeElement}={}){
  finishAccountIndicatorJourney(null);
  return new Promise(resolve=>{accountIndicatorJourney={resolve,returnFocus,phase:'opened'};openSettings({section:'account'});});
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
  if(owner!==serverPersistence.user?.id || owner!==life?.accountId || accountIndicatorGeneration!==life.generation || generation!==life.generation)return;
  nothingscoreViewer=viewer;accountIndicatorProfileOwner=owner;accountIndicatorProfileGeneration=life.generation;
  renderAccountIndicator();
}
function mount(){
  if(accountIndicatorController)return accountIndicatorController;
  const host=document.getElementById('accountIndicator'),focused=host.contains(document.activeElement);
  host.replaceChildren();
  accountIndicatorController=NOTHINGSPORTS_ACCOUNT_AWARENESS_UI.create({host,readSnapshot:accountIndicatorSnapshot,openAccount:openIndicatorAccount});
  if(focused)host.querySelector('button').focus();
  return accountIndicatorController;
}
root.NOTHINGSPORTS_ACCOUNT_INDICATOR_APP=Object.freeze({mount,open:openIndicatorAccount,finish:finishAccountIndicatorJourney,complete:completeAccountIndicatorJourney,acceptProfile:acceptAccountIndicatorProfile});

})(globalThis);
