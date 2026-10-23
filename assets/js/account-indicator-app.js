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
function accountSyncTimeLabel(value){
  const parsed = new Date(value || "");
  if (Number.isNaN(parsed.getTime())) return "Not synced yet";
  return `Last synced ${parsed.toLocaleString("en-AU", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  })}`;
}

function accountSyncDetail(){
  const state=serverPersistence.state;
  const signedIn=Boolean(serverPersistence.user)&&["signedIn","syncing","error"].includes(state);
  return state === "local"
    ? "Your choices remain saved on this device. Server sync becomes available when the Supabase project is connected."
    : state === "checking"
      ? "Checking whether server sync is available."
      : state === "requesting"
        ? (serverPersistence.message || "Checking your email and password securely.")
        : state === "error" || state === "syncing"
              ? (serverPersistence.message || "Your local copy is active while sync recovers.")
            : signedIn
              ? accountSyncTimeLabel(serverPersistence.lastSyncedAt)
              : (serverPersistence.message || "Sign in, or create a verified account with your lightweight Feed setup.");
}
function accountIdentityPrefix(){
  const view=root.NOTHINGSPORTS_ACCOUNT_AWARENESS.accountView(accountIndicatorSnapshot().facts);
  return ['signedIn','offline'].includes(view.status)?'Signed in as':'Saved account:';
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
// Resume uses the existing scoped, serialised sync path. No polling or second
// auth owner: one bounded read per foreground burst, no retries while hidden.
let recoveryJob=null,lastRecovery=null;
function recoverAccount({manual=false}={}){
  const life=serverSyncClient?.accountSnapshot?.();
  if(!life?.hasSession || !navigator.onLine || document.hidden)return Promise.resolve();
  const same=value=>value?.accountId===life.accountId && value?.generation===life.generation;
  if(same(recoveryJob))return recoveryJob.promise;
  if(['checking','requesting','syncing'].includes(serverPersistence.state))return Promise.resolve();
  if(!manual && same(lastRecovery) && Date.now()-lastRecovery.at<15000)return Promise.resolve();
  lastRecovery={...life,at:Date.now()};
  const job={...life,promise:null};
  recoveryJob=job;
  job.promise=Promise.resolve().then(()=>{
    const current=serverSyncClient.accountSnapshot();
    if(!same(current) || !current.hasSession)return;
    return serverPersistence.user?.id===life.accountId && accountIndicatorGeneration===life.generation
      ? syncCurrentServerState({notify:manual})
      : bootstrapServerPersistence({checkStatus:false});
  }).catch(()=>{}).finally(()=>{if(recoveryJob===job)recoveryJob=null;renderAccountIndicator();});
  return job.promise;
}
function appendAccountRetry(controls){
  if(serverPersistence.state!=='error' || serverPersistence.user || !serverSyncClient?.accountSnapshot?.().hasSession)return false;
  const retry=document.createElement('button');
  retry.type='button';retry.className='btn primary';retry.textContent='Retry account';
  retry.addEventListener('click',()=>void recoverAccount({manual:true}));
  controls.appendChild(retry);
  return true;
}
function foregroundAccount(){renderAccountIndicator();void recoverAccount();}
function mount(){
  if(accountIndicatorController)return accountIndicatorController;
  const host=document.getElementById('accountIndicator'),focused=host.contains(document.activeElement);
  host.replaceChildren();
  accountIndicatorController=NOTHINGSPORTS_ACCOUNT_AWARENESS_UI.create({host,readSnapshot:accountIndicatorSnapshot,openAccount:openIndicatorAccount,openPicture:options=>openIndicatorAccount({...options,profilePicture:true})});
  if(focused)host.querySelector('.account-awareness-control').focus();
  for(const event of ['online','pageshow'])addEventListener(event,foregroundAccount);
  addEventListener('offline',()=>{lastRecovery=null;renderAccountIndicator();});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)foregroundAccount();});
  if(serverPersistence.state==='error')void recoverAccount();
  if(settingsSection==='account' && document.getElementById('settingsModal')?.classList.contains('show'))renderSettingsScreen();
  return accountIndicatorController;
}
root.NOTHINGSPORTS_ACCOUNT_INDICATOR_APP=Object.freeze({mount,open:openIndicatorAccount,finish:finishAccountIndicatorJourney,complete:completeAccountIndicatorJourney,acceptProfile:acceptAccountIndicatorProfile,appendRetry:appendAccountRetry,identityPrefix:accountIdentityPrefix,syncDetail:accountSyncDetail});

})(globalThis);
