'use strict';
const crypto=require('node:crypto');
const PUBLISHERS=Object.freeze({
 'bbc.co.uk':['bbc',false],'bbc.com':['bbc',false],'skysports.com':['sky',false],'reuters.com':['reuters',false],'apnews.com':['ap',false],
 'espn.com':['espn',false],'espncricinfo.com':['espn',false],'espn.in':['espn',false],'abc.net.au':['abc',false],'foxsports.com.au':['fox',false],
 'world.rugby':['world-rugby',true],'rugby.com.au':['rugby-australia',true],'cricket.com.au':['cricket-australia',true],'icc-cricket.com':['icc',true],
 'afl.com.au':['afl',true],'nrl.com':['nrl',true],'nrl.com.au':['nrl',true],'formula1.com':['formula-one',true],'fia.com':['fia',true],
 'premierleague.com':['premier-league',true],'usopen.org':['us-open',true],'atptour.com':['atp',true],'wtatennis.com':['wta',true],
 'nuerburgring-langstrecken-serie.de':['nls',true],'nuerburgring.de':['nurburgring',true],'news.verstappen.com':['verstappen',true],
 'acisport.it':['aci',true],'fiawec.com':['wec',true],'imsa.com':['imsa',true],'gt-world-challenge-europe.com':['sro',true],
 'motogp.com':['motogp',true],'fis-ski.com':['fis',true],'olympics.com':['ioc',true],'sixnationsrugby.com':['six-nations',true],
});
function trustedUrl(value){
 try{
  const url=new URL(value);if(url.protocol!=='https:'||url.username||url.password||url.port&&url.port!=='443')return null;
  const host=url.hostname.toLowerCase(),entry=Object.entries(PUBLISHERS).find(([domain])=>host===domain||host.endsWith(`.${domain}`));
  if(!entry)return null;
  url.hash='';for(const key of [...url.searchParams.keys()])if(/^(utm_|fbclid|gclid)/i.test(key))url.searchParams.delete(key);
  return {url:url.toString().replace(/\/$/,''),group:entry[1][0],official:entry[1][1]};
 }catch(_error){return null;}
}
function nameKey(value){return String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\b(?:vs?|versus)\.?\b/g,' ').replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');}
function containsEventDate(body,value){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value||''))return false;
 const [year,month,day]=value.split('-').map(Number),name=['January','February','March','April','May','June','July','August','September','October','November','December'][month-1];
 if(!name)return false;
 const named=`(?:${name}|${name.slice(0,3)})`,date=`(?:${year}[-/]0?${month}[-/]0?${day}|0?${day}[./-]0?${month}[./-]${year}|0?${day}(?:st|nd|rd|th)?\\s+${named}\\s*,?\\s*${year}|${named}\\s+0?${day}(?:st|nd|rd|th)?\\s*,?\\s*${year})`;
 return new RegExp(`\\b${date}\\b`,'i').test(body);
}
function retrievedUrls(response){
 const urls=[];
 for(const item of response?.output||[]){
  if(item.type==='web_search_call')for(const source of item.action?.sources||[])if(source.url)urls.push(source.url);
  for(const content of item.content||[])for(const annotation of content.annotations||[])if(annotation.type==='url_citation'&&annotation.url)urls.push(annotation.url);
 }
 return [...new Set(urls.map(url=>trustedUrl(url)?.url).filter(Boolean))];
}
function validEvidence(evidence,{retrieved,fixture,now}){
 const searched=new Set(retrieved.map(url=>trustedUrl(url)?.url).filter(Boolean));
 return (Array.isArray(evidence)?evidence:[]).flatMap(item=>{
  if(!item||typeof item!=='object')return [];
  const source=trustedUrl(item.url),published=Date.parse(item.publishedAt),eventDate=Date.parse(item.eventDate),expectedDate=Date.parse(fixture.date);
  if(!source||!searched.has(source.url)||!Number.isFinite(published)||published>+now+86400000||published<+now-30*86400000)return [];
  if(!Number.isFinite(eventDate)||!Number.isFinite(expectedDate)||Math.abs(eventDate-expectedDate)>86400000||nameKey(item.eventName)!==nameKey(fixture.name))return [];
  const knownGroups=new Set(Object.values(PUBLISHERS).map(value=>value[0]));
  if(item.publisherGroup&&!knownGroups.has(item.publisherGroup))return [];
  // A declared original wire source may reduce independence, never increase it.
  return [{...source,publishedAt:item.publishedAt,publisherGroup:source.group,originGroup:item.publisherGroup||source.group}];
 });
}
function acceptConsensus(candidate,{fixture,retrieved=[],now=new Date()}={}){
 const labels=['Rivalry','Derby','Record Chase','Final','Knockout','Round-Robin'];
 if(!fixture||candidate?.eventId!==fixture.id||!labels.includes(candidate.label)||!Number.isFinite(Number(candidate.confidence))||Number(candidate.confidence)<.7||Number(candidate.confidence)>1)return null;
 const evidence=validEvidence(candidate.evidence,{retrieved,fixture,now});
 const unique=[...new Map(evidence.map(item=>[item.url,item])).values()];
 const structural=['Final','Knockout','Round-Robin'].includes(candidate.label);
 if(!(structural&&unique.some(item=>item.official))&&(new Set(unique.map(item=>item.publisherGroup)).size<2||new Set(unique.map(item=>item.originGroup)).size<2))return null;
 if(candidate.label==='Record Chase'&&['completed','cancelled','abandoned'].includes(fixture.status))return null;
 const sourceUrls=unique.map(item=>item.url);
 return {label:candidate.label,confidence:Number(candidate.confidence),sourceUrls,method:'autonomous-reporting-consensus.v1',checkedAt:now.toISOString(),
  evidence:unique.map(({url,publisherGroup,originGroup,publishedAt})=>({url,publisherGroup,originGroup,publishedAt})),
  fingerprint:crypto.createHash('sha256').update(JSON.stringify([fixture.id,candidate.label,sourceUrls])).digest('hex'),
  ...(candidate.label==='Record Chase'?{expiresAt:new Date(Date.parse(fixture.endDate||fixture.date)+2*86400000).toISOString()}:{}),
 };
}
function acceptParticipation(candidate,{athletes=[],fixtures=[],retrieved=[],texts={},now=new Date()}={}){
 const athlete=athletes.find(item=>item.id===candidate?.participantId),fixture=fixtures.find(item=>item.id===candidate?.eventId);
 if(!athlete||!fixture||!['race','match'].includes(candidate.participationKind)||!['confirmed','provisional','completed','withdrawn'].includes(candidate.participationStatus))return null;
 const names=[athlete.displayName,...(athlete.aliases||[])].filter(name=>typeof name==='string'&&name.trim().split(/\s+/).length>1).map(nameKey);
 const matched=nameKey(candidate.matchedName);if(!names.includes(matched))return null;
 const evidence=validEvidence(candidate.evidence,{retrieved,fixture,now}).filter(source=>source.official);
 const phrase=candidate.participationStatus==='withdrawn'?/\b(?:withdrawn|withdraws|will not (?:race|play|compete)|ruled out)\b/i
  :candidate.participationStatus==='completed'?/\b(?:raced|played|finished|won|classified)\b/i
  :/\b(?:will (?:race|play|compete)|(?:confirmed|named|listed|entered|selected) (?:in|for|on)|entry list|starting line.?up)\b/i;
 const source=evidence.find(source=>{
  const body=String(texts[source.url]||''),normalized=nameKey(body),nameIndex=` ${normalized} `.indexOf(` ${matched} `);
  const eventDate=(candidate.evidence||[]).find(item=>trustedUrl(item.url)?.url===source.url)?.eventDate;
  if(nameIndex<0||!normalized.includes(nameKey(fixture.name))||!containsEventDate(body,eventDate))return false;
  // The athlete and affirmative participation claim must share a short passage;
  // interest, testing, team ownership and similarly named people are not entries.
  const passage=normalized.slice(Math.max(0,nameIndex-100),nameIndex+matched.length+220);
  return phrase.test(passage)&&!/\b(?:hopes?|might|may|rumou?r|unconfirmed|considering|test drive|testing)\b/.test(passage);
 });
 if(!source)return null;
 return {participantId:athlete.id,eventId:fixture.id,participationStatus:candidate.participationStatus,participationKind:candidate.participationKind,
  sourceUrl:source.url,checkedAt:now.toISOString().slice(0,10),publishedAt:source.publishedAt,method:'autonomous-official-entry.v1'};
}
module.exports={PUBLISHERS,trustedUrl,nameKey,retrievedUrls,validEvidence,acceptConsensus,acceptParticipation};
