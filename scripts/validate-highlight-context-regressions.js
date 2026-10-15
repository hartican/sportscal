'use strict';
// Independent review regressions: real published identities, synthetic media,
// no provider calls or database access.
const assert=require('node:assert/strict');
const selection=require('../lib/highlight-selection');
const context=require('../lib/highlight-context');
const events=require('../data/events.json').events;
const now=new Date('2026-10-15T00:00:00Z');
const fixture=id=>{const event=events.find(e=>e.id===id);assert(event,id);return event;};
const video=(title,description='')=>({title,description,publishedAt:'2026-10-14T20:00:00Z',channelId:'unreviewed'});
function main(){
  const baseball=fixture('fixture-mlb-849832');
  for(const date of ['October 1, 2026','1 October 2026','Oct 1st, 2026'])assert.equal(selection.contextMatches(video(baseball.name+' | '+date+' Highlights'),baseball,now),false,'fresh upload cannot renew a different explicitly dated game: '+date);
  assert(selection.contextMatches(video(baseball.name+' | October 9, 2026 Highlights'),baseball,now),'matching month-name game date remains accepted');
  const rugby=fixture('rugby-new-zealand-australia-2026-10-10');
  assert.equal(selection.contextMatches(video('New Zealand v Australia | Rugby League 2026 Highlights'),rugby,now),false,'country aliases cannot turn Bledisloe union into rugby league');
  assert(selection.contextMatches(video('New Zealand v Australia | Bledisloe Cup Rugby Union 2026 Highlights'),rugby,now),'same union identity is accepted');
  for(const family of ['nrl','nrlw']){
    const event=events.find(e=>e.key===family);assert(event);
    assert(context.matches(event,video(event.name+' | '+family.toUpperCase()+' Rugby League Highlights')),'explicit league media remains valid for '+family);
    assert.equal(context.matches(event,video(event.name+' | '+family.toUpperCase()+' Rugby Union Highlights')),false,'league card rejects union media');
  }
  const football=fixture('epl-2026-27-128973');
  const title='Premier League Matchweek 6 Day Highlights 2026';
  assert.equal(selection.contextMatches(video(title,'Arsenal v Everton. Leeds United v Chelsea.'),football,now),false,'a reel naming both teams in separate fixtures cannot certify their pairing');
  assert(selection.contextMatches(video(title,'00:00 Arsenal v Leeds United\n04:00 Chelsea v Everton'),football,now),'chapter explicitly naming both opponents is valid');
  assert(selection.contextMatches(video('Leeds United vs Arsenal | Premier League 2026 Highlights'),football,now),'opponent order is irrelevant');
  for(const marker of ['EA Sports FC 26 Gameplay','FIFA 2026 Simulation','eFootball PES 2026'])assert.equal(selection.contextMatches(video(football.name+' | '+marker+' Highlights'),football,now),false,'simulation cannot stand in for real match media');
  assert(selection.contextMatches(video(football.name+' | FIFA 2026 Highlights'),football,now),'FIFA itself is not a gaming marker');
  assert.equal(selection.contextMatches(video(football.name+' | Bundesliga 2026 Highlights'),football,now),false,'same clubs cannot borrow a conflicting football league');
  const january={...football,date:'2027-01-10',actualStartTimeUtc:null,startTimeUtc:'2027-01-10T12:00:00Z'};
  const januaryVideo=title=>({...video(title),publishedAt:'2027-01-11T00:00:00Z'});
  assert(selection.contextMatches(januaryVideo(football.name+' | Premier League 2026/27 Highlights'),january,new Date('2027-01-12T00:00:00Z')),'source-backed season range can span calendar years');
  assert.equal(selection.contextMatches(januaryVideo(football.name+' | Premier League 2026 Highlights'),january,new Date('2027-01-12T00:00:00Z')),false,'standalone previous year is not a season range');
  const tennis={...fixture('fixture-tennis-espn-atp-184949'),status:'completed'};
  const reel=description=>({...video('Shanghai 2026 Highlights Day 8',description),url:'https://www.youtube.com/watch?v=BPI3JafcKns',videoId:'BPI3JafcKns',channelId:'UCbcxFkd6B9xUU54InHv4Tig'});
  assert.equal(selection.contextMatches(reel('00:00 Daniil Medvedev v Taylor Fritz\n04:00 Stefanos Tsitsipas v Tommy Paul'),tennis,now),false,'tennis reel cannot bind opponents playing separate matches');
  for(const description of ['00:00 Tsitsipas v Medvedev','Stefanos Tsitsipas Faces Daniil Medvedev','Daniil Medvedev Plays Stefanos Tsitsipas'])assert(selection.contextMatches(reel(description),tennis,now),'real publisher match connectors remain accepted: '+description);
  const doubles={...fixture('fixture-us-open-2026-official-wd-4104'),status:'completed'};
  const doublesReel=description=>({...reel(description),title:'US Open 2026 Women Doubles Highlights Day 5',channelId:'UCXbboag48Qlr78zzz6SkzkQ'});
  assert(selection.contextMatches(doublesReel('DJ Bennett / Ava Esposito v Storm Hunter / Desirae Krawczyk'),doubles,now),'source-backed doubles side pairing remains valid');
  assert.equal(selection.contextMatches(doublesReel('DJ Bennett / Storm Hunter v Ava Esposito / Desirae Krawczyk'),doubles,now),false,'all four names cannot certify rearranged doubles partners');
  console.log('Independent highlight-context review regressions passed: explicit game dates, rugby codes and pair-specific shared reels; zero live calls.');
}
if(require.main===module)main();
module.exports={main};
