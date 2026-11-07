/* Private Impact destinations. Loaded only for a request or deliberate inbox tap. */
(function(root){
 'use strict';
 let generation=0,dialog=null;
 const owner=()=>serverSyncClient?.sessionSubject()||'';
 const element=(tag,text)=>{const node=document.createElement(tag);if(text)node.textContent=text;return node;};
 async function items(eventId='',digestDay=''){
  if(startupCoordinator.isHydrating())throw Error('Your Feed is still loading. Try again when it is ready.');
  const account=owner();if(!account)throw Error('Sign in to open your Impact requests.');
  const payload=await serverSyncClient.inboxRequest({impact:true,eventId,digestDay});
  if(account!==owner())throw Error('Your account changed. Open the request again.');
  return {account,rows:payload.items||[]};
 }
 async function open(eventId){
  const ticket=++generation,{account,rows}=await items(eventId);if(ticket!==generation)return;
  if(!rows.some(item=>item.eventId===eventId))throw Error('This Impact request is no longer available.');
  const payload=await serverSyncClient.nothingscoreRequest({fixture:eventId});if(ticket!==generation||account!==owner())return;
  if(!payload.event||payload.detail&&payload.detail.phase!=='impact'||getEventAction(payload.event).dismissed||getEventAction(payload.event).isPurged)throw Error('This Impact request is no longer available.');
  // The rating drawer reads the current phase. Opening submits nothing, changes
  // no Results/Follow choice and never creates or restores a Feed card.
  await openNothingscoreContribution(payload.event);
 }
 async function inbox(day){
  const ticket=++generation,{account,rows}=await items('',day);if(ticket!==generation)return;
  dialog?.close();dialog?.remove();dialog=element('dialog');dialog.className='calendar-dialog impact-requests';dialog.setAttribute('aria-label','Your Impact requests');
  const ownDialog=dialog,close=element('button','Close');close.type='button';close.className='btn ghost';close.onclick=()=>ownDialog.close();dialog.append(element('h2','Your Impact requests'),close);
  if(!rows.length)dialog.append(element('p','You’re all caught up.'));
  for(const row of rows){const button=element('button',row.detail||'Rate the Impact');button.type='button';button.className='btn ghost';button.onclick=async()=>{if(account!==owner())return;try{await open(row.eventId);if(account===owner())ownDialog.close();}catch(error){showToast(error.message);}};dialog.append(button);}
  document.body.append(dialog);dialog.showModal();close.focus();dialog.addEventListener('close',()=>ownDialog.remove(),{once:true});
 }
 async function route(){
  const url=new URL(location.href),id=url.searchParams.get('impactRequest'),digest=url.searchParams.get('impactInbox');if(!id&&!digest)return;
  if(startupCoordinator.isHydrating())return;
  if(!owner())return; // Preserve the private destination while account startup resolves.
  if(id&&!/^[a-zA-Z0-9:_-]{1,180}$/.test(id)||digest&&!/^\d{4}-\d{2}-\d{2}$/.test(digest))return;
  url.searchParams.delete('impactRequest');url.searchParams.delete('impactInbox');history.replaceState(history.state,'',url);
  try{if(id)await open(id);else await inbox(digest);}catch(error){showToast(error.message);}
 }
 addEventListener('ns-account-change',()=>{generation++;dialog?.close();dialog?.remove();void route();});
 addEventListener('ns-startup-ready',()=>void route());
 root.NOTHINGSPORTS_IMPACT_UI={open,inbox,route};
})(globalThis);
