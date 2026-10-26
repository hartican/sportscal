'use strict';
const fs=require('node:fs'),crypto=require('node:crypto');
const contract=require('./live-coverage-read-contract');
const identity=require('../../config/fixture-identity');
const MAX_BYTES=2*1024*1024;
const digest=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
function reject(reason){throw Error('PUBLIC_COVERAGE_'+reason);}
function fields(value,allowed){if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(key=>!allowed.includes(key)))reject('PRIVATE_OR_UNKNOWN_FIELD');}
function text(value,max=200){if(typeof value!=='string'||!value||value.length>max||/[\x00-\x1f\x7f]/.test(value))reject('FIELD_TYPE');}
function id(value){text(value);if(!/^[a-z0-9_:.-]+$/i.test(value))reject('IDENTITY');}
function instant(value){if(typeof value!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(value)||!Number.isFinite(Date.parse(value)))reject('CLOCK');return Date.parse(value);}
const fixtureFields=['id','eventId','canonicalEventId','sourceEventIds','key','sportKey','sportDomainId','name','startTimeUtc','endTimeUtc','status','participants','participantIds','homeParticipantId','awayParticipantId','competitionId','competitionName','competitionScope','gender','sourceName','sourceUrl','sourceFixtureId','discoverySourceId','sourceCheckedAt','canonicalSourceCheckedAt','statusCheckedAt','scoreCheckedAt','statusFactObservedAt','scoreFactObservedAt','firstConfirmedCompleteAt','homeScore','awayScore','scoreDisplay'];
const clocks=['sourceCheckedAt','canonicalSourceCheckedAt','statusCheckedAt','scoreCheckedAt','statusFactObservedAt','scoreFactObservedAt','firstConfirmedCompleteAt'];
function fixture(value,row,capturedAt){
 fields(value,fixtureFields);id(value.id);if(value.id!==row.fixture_id)reject('IDENTITY');
 for(const key of ['eventId','canonicalEventId','competitionId','sourceFixtureId','discoverySourceId'])if(value[key]!==undefined)id(value[key]);
 for(const key of ['sourceEventIds','participantIds'])if(value[key]!==undefined){if(!Array.isArray(value[key])||value[key].length>32||new Set(value[key]).size!==value[key].length)reject('IDENTITY');value[key].forEach(id);}
 const reviewed=new Set(identity.fixtureAliases(row.fixture_id)),canonicalId=identity.canonicalFixtureId(row.fixture_id);
 for(const alias of [value.eventId,value.canonicalEventId,...(value.sourceEventIds||[]),...row.identity_keys].filter(alias=>alias!==undefined))if(!reviewed.has(alias)&&identity.canonicalFixtureId(alias)!==canonicalId)reject('ALIAS_UNQUALIFIED');
 for(const key of ['key','sportDomainId','name','sourceUrl'])text(value[key],500);
 for(const key of ['sportKey','competitionName','competitionScope','gender','sourceName','scoreDisplay'])if(value[key]!==undefined)text(value[key],500);
 if(!['cricket','rugby','rugby-union'].includes(value.key)||!['sport:cricket','sport:rugby-union'].includes(value.sportDomainId)||(row.source_id.includes('cricket')?value.key!=='cricket'||value.sportDomainId!=='sport:cricket':value.key==='cricket'||value.sportDomainId!=='sport:rugby-union'))reject('SOURCE_SPORT');
 if(!['scheduled','upcoming','live','completed','finished','final','cancelled','abandoned','postponed'].includes(value.status))reject('STATUS');
 instant(value.startTimeUtc);if(value.endTimeUtc!==undefined&&instant(value.endTimeUtc)<instant(value.startTimeUtc))reject('CLOCK');
 if(value.sourceCheckedAt===undefined&&value.canonicalSourceCheckedAt===undefined)reject('CLOCK');
 for(const key of clocks)if(value[key]!==undefined&&instant(value[key])>capturedAt+300000)reject('CLOCK');
 let url;try{url=new URL(value.sourceUrl);}catch{reject('SOURCE_URL');}
 if(url.protocol!=='https:'||url.username||url.password||url.hash||url.search)reject('SOURCE_URL');
 if(!Array.isArray(value.participants)||value.participants.length!==2||!Array.isArray(value.participantIds)||value.participantIds.length!==2)reject('SIDES');
 for(const p of value.participants){fields(p,['id','name']);id(p.id);text(p.name);if(/\b(?:tbc|tbd|to be confirmed|winner of|loser of|unknown|qualifier)\b/i.test(p.name))reject('SIDES');}
 id(value.homeParticipantId);id(value.awayParticipantId);
 if(value.homeParticipantId===value.awayParticipantId||JSON.stringify(value.participantIds)!==JSON.stringify([value.homeParticipantId,value.awayParticipantId])||JSON.stringify(value.participants.map(p=>p.id))!==JSON.stringify(value.participantIds))reject('SIDES');
 const scores=['homeScore','awayScore'].filter(key=>value[key]!==undefined);
 if(scores.length===1||scores.some(key=>!Number.isSafeInteger(value[key])||value[key]<0))reject('SCORE');
}
function validate(value){
 if(value?.schemaVersion==='live-coverage-public-capture.v3')return require('./public-coverage-capsules').consume(value).receipt;
 if(value?.schemaVersion==='live-coverage-public-capture.v2')return require('./public-coverage-producer').validate(value);
 fields(value,['schemaVersion','provenance','capturedAt','pages']);
 if(value.schemaVersion!=='live-coverage-public-capture.v1'||value.provenance!=='constructed-fixture')reject('PROVENANCE_UNQUALIFIED');
 const capturedAt=instant(value.capturedAt);
 if(!Array.isArray(value.pages)||!value.pages.length||value.pages.length>contract.MAX_PAGES||Buffer.byteLength(JSON.stringify(value))>MAX_BYTES)reject('PAGE_BUDGET');
 const seen=new Set();let rows=0;
 for(const [page,entry]of value.pages.entries()){
  fields(entry,['request','receivedAt','rows','sha256']);
  if(JSON.stringify(canonical(entry.request))!==JSON.stringify(canonical(contract.requestForPage(page))))reject('REQUEST_CONTRACT');
  const received=instant(entry.receivedAt);if(received>capturedAt||received<capturedAt-contract.MAX_PAGES*10000)reject('CAPTURE_WINDOW');
  if(!Array.isArray(entry.rows)||entry.rows.length>contract.PAGE_SIZE||entry.rows.length<contract.PAGE_SIZE&&page!==value.pages.length-1)reject('PAGE_COMPLETENESS');
  if(digest(entry.rows)!==entry.sha256)reject('PAGE_HASH');
  for(const row of entry.rows){
   fields(row,['source_id','fixture_id','fixture','identity_keys']);id(row.fixture_id);
   if(!contract.SOURCES.includes(row.source_id)||seen.has(row.source_id+'|'+row.fixture_id))reject('SOURCE_OR_DUPLICATE');seen.add(row.source_id+'|'+row.fixture_id);
   if(!Array.isArray(row.identity_keys)||row.identity_keys.length>32||!row.identity_keys.includes(row.fixture_id)||new Set(row.identity_keys).size!==row.identity_keys.length)reject('IDENTITY');row.identity_keys.forEach(id);
   fixture(row.fixture,row,capturedAt);rows++;
  }
 }
 if(value.pages.at(-1).rows.length===contract.PAGE_SIZE)reject('PAGE_COMPLETENESS');
 return {schemaVersion:value.schemaVersion,provenance:value.provenance,capturedAt:value.capturedAt,pages:value.pages.length,rows,sha256:digest(value),requestContract:contract.manifest(),currentSourceAcceptance:false,pendingIntents:['DEPLOY must validate actual producer/public projection and source scope','DEPLOY must check private protected-content/retirement rules without exporting them','DEPLOY alone qualifies shared publication; no publication ACK is implied']};
}
function read(file){
 const files=require('./public-coverage-files'),pinned=files.open(file,MAX_BYTES);let primary;
 try{const bytes=pinned.read(),value=files.json(bytes);
  if(value?.schemaVersion==='live-coverage-public-capture.v3')return require('./public-coverage-capsules').read(file,pinned,new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes));
  validate(value);pinned.verify();return value;
 }catch(error){primary=error;throw error;}finally{try{pinned.close();}catch(error){if(!primary)throw error;}}
}
function replay(value){
 const saved=structuredClone(value),v3=saved?.schemaVersion==='live-coverage-public-capture.v3'?require('./public-coverage-capsules').consume(saved):null,receipt=v3?v3.receipt:validate(saved),pages=v3?v3.pages:saved.pages;let page=0;
 return {receipt,async request(path,options){const actual={path,...options};if(page>=pages.length||JSON.stringify(canonical(actual))!==JSON.stringify(canonical(contract.requestForPage(page))))reject('REQUEST_CONTRACT');return structuredClone(pages[page++].rows);},complete(){if(page!==pages.length)reject('PAGE_COMPLETENESS');}};
}
module.exports={MAX_BYTES,validate,read,replay,fixtureFields};
