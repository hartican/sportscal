'use strict';
// Provider responses below are synthetic. Fixture identities and context come
// from the published corpus; this test makes no provider, database or API calls.
const assert=require('node:assert/strict');
const selection=require('../lib/highlight-selection');
const contract=require('../config/fixture-highlights');
const identity=require('../config/fixture-identity');
const now=new Date('2026-10-15T00:00:00Z');
const events=require('../data/events.json').events.map(identity.normalizeCore);
const recent=events.filter(e=>contract.completed(e)&&contract.recent(e,now)&&e.name);
const find=predicate=>{const event=recent.find(predicate);assert(event,'required real published fixture');return event;};
const fixtures={
  baseball:find(e=>e.key==='baseball'),
  nbl:find(e=>e.codeId==='sport:nbl'),
  aflw:find(e=>e.key==='aflw'),
  rugby:find(e=>e.id==='rugby-new-zealand-australia-2026-10-10'),
  football:find(e=>e.key==='premier-league'),
  f1:find(e=>e.key==='f1'&&/Practice 1/.test(e.stage)),
  supercars:find(e=>e.key==='supercars'),
  tennis:find(e=>e.key==='tennis'),
  motogp:find(e=>e.key==='motogp'&&e.sessionType==='qualifying')
};
const publication=event=>new Date(Math.max(Date.parse(event.actualStartTimeUtc||event.startTimeUtc||event.date+'T00:00:00Z')+3600000,Date.parse(event.date+'T12:00:00Z'))).toISOString();
const title=event=>event.key==='tennis'?event.name+' | Shanghai 2026 Highlights':event.name+' | '+(event.key==='aflw'?'AFLW ':'')+(event.roundLabel||event.stage||'')+' 2026 Highlights';
const asVideo=item=>({videoId:item.id,url:'https://www.youtube.com/watch?v='+item.id,...item.snippet});
function item(event,{id='FIXTURE0001',channelId='unreviewed',title:heading=title(event),description='',publishedAt=publication(event),language='en',duration='PT5M',details={},status={}}={}){
  return {id,snippet:{channelId,title:heading,description,publishedAt,defaultAudioLanguage:language},contentDetails:{duration,...details},status:{privacyStatus:'public',uploadStatus:'processed',...status}};
}
const matches=(event,patch)=>selection.contextMatches(asVideo(item(event,patch)),event,now);
async function main(){
  // This assertion fails on the pre-expansion selector: F1 was always scored as
  // an unreviewed source even on its own official channel.
  const first=item(fixtures.f1,{channelId:'UCB_qr75-ydFVKSF9Dmo6izg'});
  assert.equal(selection.score(asVideo(first),fixtures.f1,now),0,'official F1 dedicated highlights must outrank a general first result');
  const registry=require('../lib/highlight-channels');
  const original=JSON.stringify(fixtures);
  const carriedFootball=require('../data/follow-schedule/football.json').fixtures;
  for(const key of ['fifa','competition:uefa-champions-league','competition:uefa-europa-league','competition:football:international-friendlies']){
    const event=carriedFootball.find(e=>e.key===key||e.competitionId===key);assert(event,'real carried football competition '+key);
    const names=event.participants.map(p=>p.displayName||p.name).join(' v ');
    const heading=names+' | '+(event.competitionName||event.key)+' '+(event.roundLabel||'')+' 2026 Highlights';
    assert(matches(event,{title:heading,publishedAt:'2026-10-14T12:00:00Z'}),'carried football context '+key);
    assert(!matches(event,{title:heading.replace(names,event.participants[0].displayName||event.participants[0].name),publishedAt:'2026-10-14T12:00:00Z'}),'carried football still requires both participants '+key);
  }
  let families=0;
  for(const [family,event] of Object.entries(fixtures)){
    const channels=registry.channelsFor(event);assert(channels.length,'reviewed official channel for '+family);
    const official=item(event,{channelId:channels[0].id});
    assert.equal(selection.score(asVideo(official),event,now),0,family+' official dedicated priority');
    const general=item(event,{id:'GENERAL0001'});
    assert.equal(selection.score(asVideo(general),event,now),2,family+' suitable general result remains available');
    assert.equal(selection.select([general,official],event,now)?.item.id,official.id,family+' official source wins independently of relevance order');
    assert.equal(selection.select([item(event,{duration:'PT45S',channelId:channels[0].id})],event,now)?.seconds,45,'valid brief highlights stay eligible');
    for(const patch of [
      {publishedAt:'2022-10-14T12:00:00Z'}, {publishedAt:undefined},
      {publishedAt:new Date(+now+1).toISOString()}, {duration:'PT3H'},
      {duration:'PT0S'}, {duration:'invalid'}, {language:'id'},
      {title:title(event).replace('Highlights','Full Match Highlights')},
      {details:{regionRestriction:{blocked:['AU']}}}, {status:{privacyStatus:'private'}}
    ]){
      const bad=item(event,patch);if(Object.hasOwn(patch,'publishedAt'))bad.snippet.publishedAt=patch.publishedAt;
      assert.equal(selection.select([bad],event,now),null,family+' rejects unsuitable metadata '+JSON.stringify(patch));
    }
    const languageUnknown=item(event,{duration:'PT20M'});delete languageUnknown.snippet.defaultAudioLanguage;
    assert(selection.select([languageUnknown],event,now),'unknown language is not invented; exact 20-minute boundary allowed');
    const translated=structuredClone(languageUnknown);translated.snippet.defaultLanguage='id';
    assert(selection.select([translated],event,now),family+' translated title metadata does not declare non-English audio');
    translated.snippet.defaultAudioLanguage='en';
    assert(selection.select([translated],event,now),family+' English audio remains eligible with translated title metadata');
    translated.snippet.defaultAudioLanguage='id';translated.snippet.defaultLanguage='en';
    assert.equal(selection.select([translated],event,now),null,family+' English title metadata cannot override declared non-English audio');
    assert.equal(selection.select([item(event,{duration:'PT20M1S'})],event,now),null,'duration above boundary rejected');
    const requested=[];
    const feed=channel=>'<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns:media="http://search.yahoo.com/mrss/"><author><uri>https://www.youtube.com/channel/'+channel.id+'</uri></author><entry><yt:videoId>'+official.id+'</yt:videoId><yt:channelId>'+channel.id+'</yt:channelId><title><![CDATA['+official.snippet.title+']]></title><link rel="alternate" href="https://www.youtube.com/watch?v='+official.id+'"/><published>'+official.snippet.publishedAt+'</published><media:description></media:description></entry></feed>';
    const found=await selection.officialCandidates(event,now,{fetchImpl:async url=>{const parsed=new URL(url);assert.equal(parsed.hostname,'www.youtube.com');assert.equal(parsed.pathname,'/feeds/videos.xml');const channel=channels.find(c=>c.id===parsed.searchParams.get('channel_id'));assert(channel,'only fixture-appropriate official channels are requested');requested.push(channel.id);return new Response(feed(channel));}});
    assert(requested.length&&found.some(v=>v.videoId===official.id),family+' finds official public-feed candidates without a search');
    families++;
  }
  assert(!registry.channelsFor(fixtures.nbl).some(c=>c.id==='UCWJ2lWNubArHWmf3FIHbfcQ'),'legacy nba key never admits the NBA official channel for NBL');
  assert(matches(fixtures.rugby,{title:'All Blacks v Wallabies | Bledisloe Cup First Test 2026 Highlights'}),'rugby nicknames match actual country identity');
  assert(matches(fixtures.rugby,{title:'New Zealand v Australia | Bledisloe Cup First Test 2026 Highlights'}),'country aliases match actual rugby fixture');
  assert(!matches(fixtures.rugby,{title:'New Zealand v South Africa | Rugby 2026 Highlights'}),'the wrong rugby opponent cannot borrow shared country terms');
  assert(!matches(fixtures.football,{title:'Arsenal v Manchester United | Premier League 2026 Highlights'}),'United token cannot match Leeds United');
  assert(!matches(fixtures.aflw,{title:'Western Bulldogs v Essendon | AFL Men Round 9 2026 Highlights'}),'same clubs in the men’s competition do not match AFLW');
  assert(!matches(fixtures.baseball,{title:title(fixtures.baseball).replace('Game 3','Game 2')}),'repeated baseball opponents must respect supplied game number');
  assert(!matches(fixtures.baseball,{title:title(fixtures.baseball)+' | 2026-10-01'}),'explicit older match date cannot be refreshed by a new upload');
  for(const [event,wrong] of [
    [fixtures.f1,'Singapore GP Practice 2 2026 Highlights'],
    [fixtures.f1,'Singapore GP Race 2026 Highlights'],
    [fixtures.f1,'Singapore GP Sprint 2026 Highlights'],
    [fixtures.f1,'Japanese GP Practice 1 2026 Highlights'],
    [fixtures.supercars,'Sandown 500 Race 2026 Highlights'],
    [fixtures.supercars,'Bathurst 1000 Qualifying 2026 Highlights'],
    [fixtures.motogp,'MotoGP Indonesian GP Sprint 2026 Highlights'],
    [fixtures.motogp,'MotoGP Japanese GP Qualifying 2026 Highlights']
  ])assert(!matches(event,{title:wrong}),'reject wrong location/session: '+wrong);
  for(const event of Object.values(fixtures))assert(!matches(event,{title:title(event).replace('2026','2025')}),'wrong edition rejected');
  const football=fixtures.football,channel=registry.channelsFor(football)[0].id;
  const reel=item(football,{id:'REELVIDEO01',channelId:channel,title:'Premier League Matchweek 6 Day Highlights 2026',description:'Arsenal v Leeds United. Chelsea v Everton.'});
  assert.equal(selection.score(asVideo(reel),football,now),1,'an explicit matching official day/round reel ranks below a dedicated video');
  assert.equal(selection.score(asVideo({...reel,snippet:{...reel.snippet,description:'Arsenal v Manchester United. Chelsea v Everton.'}}),football,now),Infinity,'shared reel requires both actual opponents');
  assert.equal(selection.score(asVideo({...reel,snippet:{...reel.snippet,title:'Premier League Matchweek 5 Day Highlights 2026'}}),football,now),Infinity,'shared reel cannot bind the wrong supplied round');
  assert.equal(selection.score(asVideo({...reel,snippet:{...reel.snippet,title:'Premier League Best Moments Compilation 2026'}}),football,now),Infinity,'a generic compilation is not a fixture reel');
  const f1=fixtures.f1,f1channel=registry.channelsFor(f1)[0].id;
  const sessionReel=item(f1,{channelId:f1channel,title:'Singapore GP Practice 1 Day 1 Highlights 2026'});
  assert.equal(selection.score(asVideo(sessionReel),f1,now),1,'official session reel identifies the same race location and practice unit');
  assert.equal(selection.score(asVideo({...sessionReel,snippet:{...sessionReel.snippet,title:'Singapore GP Practice 2 Day 1 Highlights 2026'}}),f1,now),Infinity,'a same-day racing reel cannot borrow a different practice session');
  const directory=require('../data/canonical/football-directory.v1.json');
  for(const league of directory.leagues){
    const clubs=directory.teams.filter(t=>t.leagueId===league.id).slice(0,2);assert.equal(clubs.length,2);
    const event={id:'controlled:football:'+league.key,key:league.key,competitionId:league.id,competitionName:league.displayName,name:clubs.map(t=>t.displayName).join(' v '),date:'2026-10-14',startTimeUtc:'2026-10-14T08:00:00Z',status:'completed',participants:clubs.map(t=>({id:t.id,name:t.displayName}))};
    const official=registry.channelsFor(event);assert(official.length,'reviewed channel for controlled league probe '+league.key);
    const clip=item(event,{channelId:official[0].id});assert.equal(selection.score(asVideo(clip),event,now),0,'controlled league official priority '+league.key);
    assert(matches({...event,competitionId:'competition:controlled-unknown'},{title:title(event)}),'controlled general matching independent of registry coverage '+league.key);
  }
  const madrid=directory.teams.find(t=>t.displayName==='Real Madrid'),barca=directory.teams.find(t=>t.displayName==='Barcelona');
  const clasico={id:'controlled:football:madrid-barcelona',key:'la-liga',competitionId:'competition:la-liga',name:'Real Madrid v Barcelona',date:'2026-10-14',startTimeUtc:'2026-10-14T08:00:00Z',status:'completed',participants:[madrid,barca].map(t=>({id:t.id,name:t.displayName}))};
  assert(!matches(clasico,{title:'Atletico Madrid v Barcelona | La Liga 2026 Highlights'}),'shared Madrid term cannot substitute Atletico for Real Madrid');
  assert.equal(JSON.stringify(fixtures),original,'selection never changes sporting facts');
  console.log('Cross-sport highlight selection: '+families+' real published sport families, injected official feeds, dedicated/reel/general ranking, aliases, competition/gender/session/date conflicts and upload/duration/language/availability guards passed; zero live requests.');
}
if(require.main===module)main().catch(error=>{console.error(error);process.exitCode=1;});
module.exports={main};
