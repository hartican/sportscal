(function(root){
'use strict';
const accountIndicatorSessionId=globalThis.crypto?.randomUUID?.() || 'account-'+Date.now();
// This recorder retains one safelisted attempt in memory. It never writes state or
// starts requests; the existing sync owner supplies every lifecycle hook.
const syncDiagnostic=root.NOTHINGSPORTS_SYNC_DIAGNOSTIC.create();
function beginSyncDiagnostic(scope){
  try{
    const generation=serverSyncClient.accountSnapshot?.().generation;
    let baseCompatible=null,ownerMatches=null;
    return syncDiagnostic.begin({current:()=>scope.current()&&serverSyncClient.accountSnapshot?.().generation===generation,
      versions:{shellVersion:document.querySelector('meta[name="app-shell-version"]')?.content,
        workerVersion:root.NOTHINGSPORTS_APP_UPDATE?.snapshot?.().workerVersion},
      facts(payload){
        const receipt=pendingPreferenceIntent(scope.accountId);
        if(payload){
          ownerMatches=payload.user?.id===scope.accountId;
          baseCompatible=!receipt||Boolean(payload.state&&(PROFILE_STORAGE.preferenceBaseMatches(receipt,payload.state.preferences)
            ||PROFILE_STORAGE.preferenceIntentMatches(receipt,payload.state.preferences,USER_STATE_SYNC)));
        }
        return {pendingReceipt:Boolean(receipt),baseCompatible,ownerMatches,
          generationMatches:serverSyncClient.accountSnapshot?.().generation===generation};
      }});
  }catch(_error){}
}
function appendSyncDiagnostic(controls){
  if(!syncDiagnostic.snapshot())return;
  const button=document.createElement('button');
  button.type='button';button.className='btn';button.textContent='Copy sync diagnostic';
  button.addEventListener('click',async()=>{
    const detail=syncDiagnostic.snapshot();
    if(!detail){button.remove();return;}
    try{
      await navigator.clipboard.writeText(JSON.stringify(detail));
      if(syncDiagnostic.snapshot())showToast('Sync diagnostic copied.');
    }catch(_error){showToast('Could not copy. Please try again.');}
  });
  controls.appendChild(button);
}
const syncHelp='Preferences, followed teams and athletes, saved Archive cards, results, standings, subscriptions and notification choices follow your account. Sync first loads the newest account state, then uploads only choices changed in this session. Disposable Feed cards stay local and rebuild from source data.';
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
  const help=document.getElementById('accountSyncHelp');if(help)help.textContent=syncHelp;
  appendSyncDiagnostic(controls);
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
  addEventListener('ns-account-change',()=>{syncDiagnostic.snapshot();});
  for(const event of ['online','pageshow'])addEventListener(event,foregroundAccount);
  addEventListener('offline',()=>{lastRecovery=null;renderAccountIndicator();});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)foregroundAccount();});
  if(serverPersistence.state==='error')void recoverAccount();
  if(settingsSection==='account' && document.getElementById('settingsModal')?.classList.contains('show'))renderSettingsScreen();
  return accountIndicatorController;
}
root.NOTHINGSPORTS_ACCOUNT_INDICATOR_APP=Object.freeze({beginDiagnostic:beginSyncDiagnostic,mount,open:openIndicatorAccount,finish:finishAccountIndicatorJourney,complete:completeAccountIndicatorJourney,acceptProfile:acceptAccountIndicatorProfile,appendRetry:appendAccountRetry,identityPrefix:accountIdentityPrefix,syncDetail:accountSyncDetail});

})(globalThis);
