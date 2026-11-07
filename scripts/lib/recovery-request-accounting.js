'use strict';
// Test-only accounting. Never relax the scoped recovery operation contract.
const assert=require('node:assert/strict');
module.exports=function accountRecoveryRequests(packet){
 const need=(value,message)=>assert(value,'Recovery attribution: '+message);
 const integer=value=>Number.isSafeInteger(value)&&value>=0;
 need(packet?.complete===true&&packet.overflow===false&&packet.dropped===0,'complete untruncated evidence required');
 need(packet.nativeClicksComplete===true&&packet.recoveryObserverInvalid===false,'complete native observer required');
 need(packet.limits?.events===128&&packet.limits.eventBytes===122880&&packet.limits.packetBytes===131072,'unchanged evidence caps');
 const events=packet.events;need(Array.isArray(events)&&events.length>0&&events.length<=128,'bounded event array');
 need(Buffer.byteLength(JSON.stringify(packet),'utf8')<=131072,'bounded packet bytes');
 const bytes=events.reduce((sum,event)=>sum+Buffer.byteLength(JSON.stringify(event),'utf8'),0);
 need(bytes===packet.eventBytes&&bytes<=122880,'exact bounded event bytes');
 events.forEach((event,index)=>need(event.sequence===index+1&&Number.isFinite(event.atMs),'complete ordered Node sequence'));
 const phase=name=>{const matches=events.filter(event=>event.type==='phase'&&event.phase===name);need(matches.length===1,'one '+name);return matches[0];};
 const baseline=phase('recovery-baseline-before-explanation'),done=phase('recovery-done');need(baseline.sequence<done.sequence,'ordered interval');
 need(done.sequence===events.length,'no uncaptured trailing activity');
 const interval=events.filter(event=>event.sequence>baseline.sequence&&event.sequence<done.sequence);
 const metricKeys=['stateLoads','recoveryRpcs','rowWrites'],delta={};
 for(const key of [...metricKeys,'writes','refreshes','authSignIns','snapshots']){
  need(integer(packet.baseline?.[key])&&integer(packet.current?.[key]),'integer counters '+key);
  delta[key]=packet.current[key]-packet.baseline[key];need(delta[key]>=0,'nonnegative counter '+key);
 }
 for(const key of metricKeys)need(baseline.metrics?.[key]===packet.baseline[key]&&done.metrics?.[key]===packet.current[key],'phase counter '+key);
 need(baseline.snapshotGets===packet.baseline.snapshots&&done.snapshotGets===packet.current.snapshots,'phase snapshot counters');
 need(delta.snapshots===1&&delta.writes===0&&delta.refreshes===0&&delta.authSignIns===0&&delta.rowWrites===0,'one snapshot and no global write/auth mutation');
 const observer=events.filter(event=>event.type==='browser-initiator');
 const realms=new Map();
 for(const event of observer){
  need(['fetch-entry','trusted-native-click'].includes(event.event),'known browser evidence');
  need(Number.isFinite(event.browserTimeOrigin)&&Number.isFinite(event.browserAtMs)&&event.browserAtMs>=0&&integer(event.browserSequence)&&event.browserSequence>0,'browser identity/order');
  for(const key of ['busy','serverSyncTimerPending','directoryTimerPending','followTimerPending','followRebuildPending'])need(typeof event[key]==='boolean','browser flag '+key);
  const realm=realms.get(event.browserTimeOrigin)||[];realm.push(event);realms.set(event.browserTimeOrigin,realm);
 }
 for(const realm of realms.values()){
  realm.sort((a,b)=>a.browserSequence-b.browserSequence);
  realm.forEach((event,index)=>need(event.browserSequence===index+1,'complete unique browser sequence'));
 }
 const browser=interval.filter(event=>event.type==='browser-initiator');
 const clicks=action=>browser.filter(event=>event.event==='trusted-native-click'&&event.action===action);
 const opens=clicks('open'),confirms=clicks('confirm');need(opens.length===1&&confirms.length===1,'exact native OPEN/CONFIRM');
 const open=opens[0],confirm=confirms[0];need(open.trusted===true&&confirm.trusted===true,'trusted native clicks');
 need(open.browserTimeOrigin===confirm.browserTimeOrigin&&open.browserSequence<confirm.browserSequence&&!open.busy&&!confirm.busy,'same-realm ordered confirmation');
 const fetches=browser.filter(event=>event.event==='fetch-entry');
 need(browser.length===fetches.length+2,'no unknown native action');
 const normalFetches=fetches.filter(event=>event.mode==='normal'),snapshotFetches=fetches.filter(event=>event.mode==='snapshot-v1');
 need(snapshotFetches.length===1&&normalFetches.length<=1&&fetches.length===snapshotFetches.length+normalFetches.length,'exact known bounded fetch modes');
 for(const event of fetches)need(event.method==='GET'&&event.browserTimeOrigin===confirm.browserTimeOrigin,'same-realm GET only');
 const snapshotFetch=snapshotFetches[0];need(snapshotFetch.url==='/api/user-state?recovery-snapshot=v1'&&snapshotFetch.busy&&snapshotFetch.browserSequence>confirm.browserSequence,'snapshot after actual confirmation while locked');
 if(normalFetches.length){
  const normal=normalFetches[0];
  need(normal.url==='/api/user-state'&&!normal.busy&&normal.followRebuildPending,'observed ordinary Follow work only');
  const prior=(realms.get(normal.browserTimeOrigin)||[]).find(event=>event.browserSequence===normal.browserSequence-1);
  need(prior&&!prior.busy&&(prior.directoryTimerPending||prior.followTimerPending||prior.followRebuildPending),'Follow owner already pending at the immediately preceding browser witness');
  need(normal.browserSequence<confirm.browserSequence,'ordinary fetch strictly before native confirmation');
 }
 const requestEvents=interval.filter(event=>event.requestId!==undefined),starts=requestEvents.filter(event=>event.type==='request-start');
 const groups=new Map();
 for(const start of starts){need(/^request-\d+$/.test(start.requestId)&&!groups.has(start.requestId),'unique actual request IDs');groups.set(start.requestId,[]);}
 for(const event of requestEvents){need(groups.has(event.requestId),'no crossing or unstarted request');groups.get(event.requestId).push(event);}
 for(const event of interval)need(event.type==='browser-initiator'||event.type==='phase'||event.requestId!==undefined,'known interval event');
 for(const event of interval.filter(event=>event.type==='phase'))need(['explanation-visible','node-confirm-dispatch-before-native-click'].includes(event.phase),'known interval phase');
 need(starts.length===1+normalFetches.length,'handler request count matches bounded mode counts');
 need(integer(baseline.completedCalls)&&done.completedCalls===baseline.completedCalls+starts.length,'all completed calls accounted');
 const requests=[];
 for(const [id,group]of groups){
  const start=group[0],snapshot=start.mode==='snapshot-v1';
  need(start.method==='GET'&&(snapshot||start.mode==='normal'),'known handler GET modes');
  need(start.url===(snapshot?'/api/user-state?recovery-snapshot=v1':'/api/user-state'),'exact scoped handler URL');
  for(const event of group)need(event.mode===start.mode&&event.method===start.method&&event.url===start.url&&event.requestPhase===start.requestPhase,'stable ALS ownership');
  const expected=snapshot?['request-start','load-start','load-end','request-result','request-end']:['request-start','load-start','load-end','rpc-start','rpc-end','request-result','request-end'];
  assert.deepEqual(group.map(event=>event.type),expected,'Recovery attribution: exact per-request operations');
  need(group[1].subjectMatchesOwner===true&&group[2].found===true,'one own existing row');
  if(!snapshot)need(group[3].rpc==='active-preference-reset'&&group[4].rpc==='active-preference-reset','known legacy lookup/expiry-cleanup RPC');
  const result=group.at(-2);need(result.status===200&&result.callIndex===baseline.completedCalls+requests.length,'successful exact call completion');
  requests.push({requestId:id,mode:start.mode,stateLoads:1,recoveryRpcs:snapshot?0:1,rowWrites:0,status:200});
 }
 const snapshots=requests.filter(request=>request.mode==='snapshot-v1'),normals=requests.filter(request=>request.mode==='normal');
 need(snapshots.length===1&&normals.length===normalFetches.length,'one snapshot and complete bounded ordinary accounting');
 need(delta.stateLoads===1+normals.length&&delta.recoveryRpcs===normals.length,'every global SELECT and RPC accounted');
 return {global:delta,snapshot:snapshots[0],ordinary:{requests:normals.length,stateLoads:normals.length,recoveryRpcs:normals.length,rowWrites:0,
  rpcMeaning:'legacy active-recovery lookup/expiry cleanup; may delete expired metadata outside snapshot',requestIds:normals.map(request=>request.requestId)},
  browser:{realm:confirm.browserTimeOrigin,open:open.browserSequence,confirm:confirm.browserSequence,snapshot:snapshotFetch.browserSequence,ordinary:normalFetches.map(event=>event.browserSequence)},
  crossIdJoinAsserted:false,rowWriteMetricScope:'CI stub user_state rows only; ordinary legacy RPC may delete expired recovery metadata in production.',limits:'At most one already-pending Follow GET before CONFIRM, within fully accounted global interval; exact snapshot limits unchanged.'};
};
