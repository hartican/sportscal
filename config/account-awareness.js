(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.NOTHINGSPORTS_ACCOUNT_AWARENESS=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  // Approved account-awareness contract, 19 October 2026. This pure model
  // describes UI state and dispatch gates; it never authorises a server write.
  const personalActions=new Set(['follow','unfollow','save','unsave']);
  const accountActions=new Set(['rate','reminder-on']);
  const text=value=>typeof value==='string'?value.trim():'';
  const compact=value=>Array.from(value).length>14?Array.from(value).slice(0,13).join('')+'…':value;
  function initials(value){
    const words=value.replace(/^@/,'').split(/[\s_@.]+/).filter(Boolean);
    return (words.length>1?Array.from(words[0])[0]+Array.from(words[words.length-1])[0]:Array.from(words[0]||'').slice(0,2).join('')).toLocaleUpperCase('en-AU');
  }

  // now/expiry use the existing client's millisecond clock. The session subject
  // is an identity fence, not proof of authentication; server checks still win.
  function accountView({state='checking',user=null,sessionOwnerId='',sessionExpiresAt=null,profile=null,profileOwnerId='',online=true,now}={}){
    const owner=text(user?.id),sessionOwner=text(sessionOwnerId);
    const signedOut=state==='signedOut'||state==='local'||user?.isAnonymous===true;
    if(signedOut)return Object.freeze({status:'signedOut',accountId:'',identity:'',label:'Not signed in',avatarUrl:'',initials:'',ariaLabel:'Not signed in. Open Account to sign in.'});
    const sameOwner=Boolean(owner&&owner===sessionOwner);
    const currentProfile=sameOwner&&text(profileOwnerId)===owner?profile:null;
    const handle=text(currentProfile?.handle).replace(/^@/,'');
    const profileName=text(currentProfile?.displayName);
    const identity=sameOwner?(handle?'@'+handle:'Account'):'';
    const expiry=Number(sessionExpiresAt),reference=Number(now);
    const unexpired=Number.isFinite(expiry)&&Number.isFinite(reference)&&expiry>reference;
    let status;
    if(state==='checking'||state==='requesting')status='checking';
    else if(sameOwner&&unexpired&&['signedIn','syncing','error'].includes(state))status=online?'signedIn':'offline';
    else status='reconnect';
    const label=status==='checking'?'Checking account…':status==='reconnect'?(identity?'Reconnect · '+compact(identity):'Check sign-in'):status==='offline'?'Offline · '+compact(identity):compact(identity);
    return Object.freeze({status,accountId:sameOwner?owner:'',identity:status==='checking'?'':identity,label,
      avatarUrl:status==='checking'?'':text(currentProfile?.avatarUrl),
      initials:status==='checking'||!sameOwner?'':initials(profileName),
      ariaLabel:status==='checking'?'Checking account status.':status==='reconnect'?'Sign-in needs checking'+(identity?' for '+identity:'')+'. Open Account.':(status==='offline'?'Offline. ':'')+'Signed in as '+identity+'. Open Account.',
    });
  }

  // The eventual UI supplies its in-memory app session and an epoch changed by
  // sign-in/out/account replacement. This module creates no stored consent.
  function scopeFor(view,{appSessionId,accountEpoch}={}){
    if(!text(appSessionId)||!Number.isSafeInteger(accountEpoch)||accountEpoch<0)throw new TypeError('An app session and account epoch are required.');
    return Object.freeze({appSessionId:text(appSessionId),accountEpoch,accountId:text(view?.accountId)});
  }
  function sameScope(first,second){
    return Boolean(first&&second&&text(first.appSessionId)&&first.appSessionId===second.appSessionId&&first.accountEpoch===second.accountEpoch&&first.accountId===second.accountId);
  }
  function acknowledgeGuest(view,scope){
    return view?.status==='signedOut'&&scope?.accountId===''?Object.freeze({...scope}):null;
  }

  function actionDecision(action,view,{scope,intentScope=scope,guestAcknowledgement=null}={}){
    if(!personalActions.has(action)&&!accountActions.has(action)&&action!=='reminder-off')throw new TypeError('Unsupported account-awareness action.');
    if(!sameScope(scope,intentScope)||text(view?.accountId)!==scope.accountId)return 'cancel-stale';
    // OFF cannot be trapped behind sign-in or a guest acknowledgement.
    if(action==='reminder-off')return 'continue-off';
    if(view.status==='signedIn'||view.status==='offline')return 'continue-account';
    if(view.status!=='signedOut')return 'resolve-account';
    if(accountActions.has(action))return 'prompt-sign-in';
    return sameScope(scope,guestAcknowledgement)?'continue-local':'prompt-guest';
  }

  return Object.freeze({accountView,scopeFor,sameScope,acknowledgeGuest,actionDecision});
});
