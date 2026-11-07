'use strict';
// Public fixture context and observed titles; provider metadata is controlled.
// These checks certify parser behaviour only and make no live requests.
const assert=require('node:assert/strict'),selection=require('../lib/highlight-selection'),context=require('../lib/highlight-context'),registry=require('../lib/highlight-channels');
const now=new Date('2026-10-15T00:00:00Z');
const nhl={id:'fixture:nhl:2026020064',canonicalEventId:'fixture:nhl:2026020064',key:'ice-hockey',codeId:'sport:ice-hockey',competitionId:'competition:nhl',name:'Colorado Avalanche v Calgary Flames',date:'2026-10-09',startTimeUtc:'2026-10-09T01:00:00.000Z',status:'completed',participants:[]};
const sprint={id:'evt_motogp_2026_indonesia_sprint',canonicalEventId:'event:motogp:2026:indonesia:sprint',key:'motogp',codeId:'competition:motogp',competitionId:'competition:motogp',name:'MotoGP Indonesia Grand Prix · Sprint',date:'2026-10-10',startTimeUtc:'2026-10-10T07:00:00.000Z',status:'completed',stage:'Sprint',roundLabel:'Sprint',season:'2026',participants:[]};
const nhlTitle='Avalanche vs. Flames | NHL Highlights | Oct 8, 2026',sprintTitle='Top 3 Tissot Sprint moments😲 | 2026 Indonesian GP';
const item=(title,channelId,patch={})=>({id:'CONTROLLED1',snippet:{title,channelId,publishedAt:'2026-10-11T11:00:00Z',defaultAudioLanguage:'en',...patch.snippet},status:{privacyStatus:'public',uploadStatus:'processed',...patch.status},contentDetails:{duration:'PT5M',...patch.contentDetails}});
const accepts=(event,title,channelId,patch)=>Boolean(selection.select([item(title,channelId,patch)],event,now));
assert(accepts(nhl,nhlTitle,registry.channels.nhl.id),'reviewed NHL fixture accepts its North American game date');
for(const date of ['Oct 7, 2026','Oct 10, 2026'])assert(!accepts(nhl,nhlTitle.replace('Oct 8, 2026',date),registry.channels.nhl.id),'wrong NHL date remains rejected');
assert(!accepts({...nhl,startTimeUtc:null},nhlTitle,registry.channels.nhl.id),'no previous-day inference without source kickoff');
assert(!accepts({...nhl,competitionId:'competition:iihf',id:'fixture:iihf:2026020064',canonicalEventId:'fixture:iihf:2026020064'},nhlTitle,registry.channels.nhl.id),'other ice hockey competitions do not acquire NHL local dates');
assert(accepts({...nhl,competitionId:undefined},nhlTitle,registry.channels.nhl.id),'canonical NHL identity supports older cards without competition metadata');
assert(!accepts(nhl,nhlTitle.replace('Flames','Oilers'),registry.channels.nhl.id),'both actual opponents are still required');
assert(!accepts(nhl,nhlTitle.replace('2026','2025'),registry.channels.nhl.id),'wrong edition remains rejected');
assert(accepts(sprint,sprintTitle,registry.channels.motogp.id),'official MotoGP Tissot sprint moments identifies the exact sprint');
for(const [event,title,channelId] of [
  [sprint,sprintTitle,'unreviewed'],
  [sprint,sprintTitle.replace('2026 ',' '),registry.channels.motogp.id],
  [sprint,sprintTitle.replace('2026','2025'),registry.channels.motogp.id],
  [sprint,sprintTitle.replace('Indonesian','Japanese'),registry.channels.motogp.id],
  [sprint,sprintTitle.replace('Tissot','Historic'),registry.channels.motogp.id],
  [{...sprint,competitionId:'competition:moto2'},sprintTitle,registry.channels.motogp.id],
  [{...sprint,stage:'Race',roundLabel:'Race'},sprintTitle,registry.channels.motogp.id],
  [{...sprint,stage:'Qualifying',roundLabel:'Qualifying'},sprintTitle,registry.channels.motogp.id],
  ...['Moto2','Moto3','MotoE'].map(series=>[sprint,sprintTitle+' '+series,registry.channels.motogp.id])
])assert(!accepts(event,title,channelId),'shorthand remains bounded to official exact-year/event/class/session: '+title);
for(const patch of [{snippet:{publishedAt:'2022-10-10T11:00:00Z'}},{snippet:{publishedAt:'2026-10-16T00:00:00Z'}},{snippet:{defaultAudioLanguage:'id'}},{contentDetails:{duration:'PT3H'}},{contentDetails:{duration:'PT0S'}},{contentDetails:{regionRestriction:{blocked:['AU']}}},{status:{privacyStatus:'private'}}])assert(!accepts(sprint,sprintTitle,registry.channels.motogp.id,patch),'existing metadata eligibility remains mandatory');
assert.equal(context.matches(nhl,{title:nhlTitle.replace('Oct 8, 2026','Oct 9, 2026')}),true,'original source-date acceptance preserved');
console.log('Feed highlight title gaps: captured NHL local date, official MotoGP sprint shorthand, competing editions/opponents/classes/sessions and unchanged metadata rejection passed; zero live requests.');
