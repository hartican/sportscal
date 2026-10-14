/* Deferred milestone controls. Permission and persistence remain host-owned. */
(() => {
 'use strict';
 const model=()=>globalThis.NOTHINGSPORTS_MILESTONES;
 function ready(){if(!model())throw Error('Milestone controls unavailable.');}
 function node(tag,text){const el=document.createElement(tag);if(text)el.textContent=text;return el;}
 function check(parent,label,checked,onchange){const row=node('label');row.className='viewing-toggle';const input=node('input');input.type='checkbox';input.checked=checked;input.addEventListener('change',()=>onchange(input.checked));row.append(input,node('span',label));parent.append(row);return input;}
 async function settings(host,draft){
  await ready();if(!host.isConnected)return;
  let value=model().normalize(draft.followFirst.notifications.milestones);
  const save=()=>{draft.followFirst.notifications.milestones=structuredClone(value);const level=value.sports.cricket.coverage,name=({off:'Off',low:'Low',medium:'Medium',high:'High'})[level],caps=model().LIMITS[level];summary.textContent='Cricket · '+name;limit.textContent=level==='off'?'Cricket milestone alerts are off.':name+' allows up to '+caps.match+' alerts per match and '+caps.total+' overall in 24 hours, at least '+caps.gap/60000+' minutes apart. Simultaneous moments are grouped.';};
  const panel=node('section');panel.className='filter-panel';const summary=node('p');summary.className='preference-help';
  panel.append(node('h3','Never miss a milestone.'));
  const help=node('p','Nudges for big moments in supported matches. Live coverage varies, and some moments may pass before an alert arrives.');help.className='preference-help';panel.append(help);
  const launch=node('p','Not sending yet. Your choice is saved for launch.');launch.className='preference-help';launch.dataset.milestoneLaunchStatus='';panel.append(launch);
  const enabled=check(panel,'Milestone alerts',value.enabled,v=>{value.enabled=v;save();});enabled.id='milestoneAlertsEnabled';panel.append(summary);
  const advanced=node('details');advanced.append(node('summary','Advanced milestone controls'));
  const label=node('label','Cricket coverage '),select=node('select');select.id='milestoneCricketCoverage';for(const [v,text] of [['off','Off'],['low','Low'],['medium','Medium'],['high','High']]){const option=node('option',text);option.value=v;select.append(option);}select.value=value.sports.cricket.coverage;label.append(select);advanced.append(label);
  select.addEventListener('change',()=>{value.sports.cricket.coverage=select.value;save();families();});
  const limit=node('p');limit.className='preference-help';advanced.append(limit);
  check(advanced,'Include other supported matches in Cricket I follow',value.sports.cricket.audience==='sport',v=>{value.sports.cricket.audience=v?'sport':'feed';save();});
  const audience=node('p','Feed matches are the default. Broader alerts keep your exclusions and separate women’s competition choices.');audience.className='preference-help';advanced.append(audience);
  const fieldset=node('fieldset');fieldset.append(node('legend','Moments to include'));advanced.append(fieldset);
  function families(){fieldset.querySelectorAll('label').forEach(n=>n.remove());for(const [key,label] of [['records','Reviewed records'],['finishes','Competitive finishes'],['bowling','Five-wicket hauls'],['centuries','Centuries'],['extraBatting','Fifties, double and triple centuries']])check(fieldset,label,model().allows({...value,enabled:true},key),v=>{value.sports.cricket.families[key]=v;save();});}
  families();
  const quietPanel=node('div'),quietStart=node('input'),quietEnd=node('input'),zone=node('select');quietStart.type=quietEnd.type='time';quietStart.value=value.quietHours?.start||'22:00';quietEnd.value=value.quietHours?.end||'08:00';
  const local=Intl.DateTimeFormat().resolvedOptions().timeZone||'Australia/Sydney';for(const timezone of new Set([value.quietHours?.timezone,local,'Australia/Sydney','Australia/Brisbane','Australia/Adelaide','Australia/Perth','UTC'].filter(Boolean))){const option=node('option',timezone);option.value=timezone;zone.append(option);}zone.value=value.quietHours?.timezone||local;
  let quietEnabled=Boolean(value.quietHours);const applyQuiet=()=>{value.quietHours=quietEnabled?{enabled:true,start:quietStart.value,end:quietEnd.value,timezone:zone.value}:null;value=model().normalize(value);save();};
  check(advanced,'Use quiet hours',quietEnabled,v=>{quietEnabled=v;quietPanel.hidden=!v;applyQuiet();});quietPanel.hidden=!quietEnabled;
  for(const [text,input] of [['From ',quietStart],['Until ',quietEnd],['Timezone ',zone]]){const label=node('label',text);label.append(input);quietPanel.append(label);input.addEventListener('change',applyQuiet);}advanced.append(quietPanel);
  const overnight=node('p','Without quiet hours, your device controls overnight alerts. Muted moments are not queued for later.');overnight.className='preference-help';advanced.append(overnight);
  const test=node('button','Send milestone test');test.type='button';test.className='btn ghost';const testStatus=node('p','This sends a labelled test only. Sign in and enable system alerts on this device. The test sends after 8 seconds so you can close the app, then tap into Match Centre.');testStatus.className='preference-help';
  test.onclick=async()=>{test.disabled=true;try{const event=[...activeEvents,...liveFixtureEvents].find(e=>/^cricket(?:-women)?$/.test(e.key||'')&&[e.id,e.eventId,e.canonicalEventId,...(e.sourceEventIds||[])].some(id=>/^fixture:cricket:CA:/.test(id||'')));await ensurePushInstallation();testStatus.textContent='Close the app now. A labelled test sends in 8 seconds; tap it to open Match Centre.';await notificationDiagnosticsCommand('milestone-test',{eventId:event?[event.id,event.eventId,event.canonicalEventId,...(event.sourceEventIds||[])].find(id=>/^fixture:cricket:CA:/.test(id||'')):undefined});testStatus.textContent='Test sent. Confirm the notification arrived with the app closed and opened the correct match.';await refreshNotificationDiagnosticsStatus();}catch(error){testStatus.textContent=error.message||'Milestone test failed.';}finally{test.disabled=false;}};
  advanced.append(test,testStatus);panel.append(advanced);host.replaceChildren(panel);save();
 }
 function toggleMatch(event,button){const muted=getEventAction(event).milestoneAlertsMuted!==true;updateEventAction(event,{milestoneAlertsMuted:muted});button.textContent=muted?'Unmute milestone alerts for this match':'Mute milestone alerts for this match';button.setAttribute('aria-pressed',String(muted));showToast(muted?'Milestone alerts muted for this match.':'Milestone alerts available for this match.');}
 function appendMute(actions,event){if(!actions.isConnected||actions.querySelector('.milestone-mute'))return;const button=node('button',getEventAction(event).milestoneAlertsMuted?'Unmute milestone alerts for this match':'Mute milestone alerts for this match');button.type='button';button.className='event-quick-action milestone-mute';button.setAttribute('aria-pressed',String(getEventAction(event).milestoneAlertsMuted===true));button.onclick=e=>{e.stopPropagation();toggleMatch(event,button);};actions.append(button);}
 function landingReceipt(moment){const testId=String(moment||'').match(/^test-([a-f0-9-]{36})$/)?.[1],credentials=readStorage(PUSH_INSTALLATION_STORAGE_KEY,null);if(testId&&credentials?.installationId&&credentials?.secret)void serverSyncClient.notificationCommand({action:'receipt',...credentials,testId},{authenticated:Boolean(serverSyncClient.getSession?.())}).catch(()=>{});}
 async function route(eventId,{current=()=>true}={}){
  const moment=new URLSearchParams(location.search).get('moment');
  const owner=serverSyncClient?.sessionSubject()||'public';
  if(!current())return false;
  const valid=()=>current()&&owner===(serverSyncClient?.sessionSubject()||'public')&&activeTab==='match-centre';
  activateTopLevelTab('match-centre',{resetViewport:false});await loadMatchCentre();if(!valid())return false;
  let data;try{const r=await fetch('/api/match-centre?ids='+encodeURIComponent(eventId)+'&context=milestone',{signal:AbortSignal.timeout(5000)});if(!r.ok)throw Error();data=await r.json();}catch{if(!valid())return false;if(await globalThis.openRetainedMilestoneMatchCentreFixture(eventId,valid)){if(!valid())return false;landingReceipt(moment);return true;}if(!valid())return false;throw Error('Match details could not load. Retry when connected.');}
  if(!valid())return false;
  const event=data.events?.find(e=>[e.id,e.eventId,e.canonicalEventId,...(e.sourceEventIds||[])].includes(eventId));
  if(!event)throw Error('This match is no longer available.');
  globalThis.openMilestoneMatchCentreFixture(event,data.fixtures?.find(s=>s.id===event.id));if(!valid())return false;landingReceipt(moment);return true;
 }
 globalThis.NOTHINGSPORTS_MILESTONE_UI={settings,toggleMatch,appendMute,route};
})();
