'use strict';
const assert=require('node:assert/strict');
const view=require('../config/feed-live-scores').presentation;
const displayLabel=require('../config/feed-card-presentation').displayLabel;
const participantMarks=require('../config/card-identities').participantMarks;
const raw=require('./fixtures/cricket-ca39990-scorecard-20261011.json');
const checkedAt='2026-10-11T09:00:00.000Z',now=Date.parse(checkedAt);
const actual=require('../lib/source-coverage').parseCricketFixtures([raw.fixture],{sourceUrl:'https://www.cricket.com.au/matches/CA%3A39990',checkedAt})[0];
actual.cricketBalance=raw.fixture.resultText;
actual.scoreCheckedAt=checkedAt;
const options={resultsOn:true,now,displayLabel,participant:id=>participantMarks[id]};
const before=JSON.stringify(actual),captured=view(actual,options);
assert.equal(captured.summary,'Proteas 27/1 (8.4 overs) · Proteas trail Australia by 363 runs with 9 wickets remaining');
assert.equal(captured.status,'Stumps');
assert.equal(captured.checkedAt,checkedAt);
assert(!captured.text.includes('Men')&&!captured.summary.includes('Stumps:'),'Canonical display labels remove redundant gender and repeated source status');
assert(captured.text.includes('Australia 390/10 (137.2 overs)'),'Earlier innings remain available in full presentation');
assert.equal(JSON.stringify(actual),before,'Presentation never rewrites source objects or inning tables');
assert.equal(view(actual,{...options,resultsOn:false}),null,'Results OFF never exposes the shortened score');

const source=require('../data/follow-schedule/cricket.json').fixtures.find(f=>f.sourceEventIds?.includes('fixture:cricket:CA:39990'));
assert(source,'The current captured CA Test remains represented by its canonical fixture');
const currentBefore=JSON.stringify(source),current=view(source,{...options,now:Date.parse(source.scoreCheckedAt)});
const last=source.innings.reduce((a,b)=>b.inningNumber>a.inningNumber?b:a);
assert(current.summary.startsWith(`${displayLabel(last.participantId,last.team)} ${last.runsScored}/${last.numberOfWicketsFallen} (${last.oversBowled} overs)`),'The latest published innings controls the summary, including current Day 4 102/4 evidence');
assert.equal(view({...source,innings:[...source.innings].reverse()},{...options,now:Date.parse(source.scoreCheckedAt)}).summary,current.summary,'Provider array order cannot choose an older innings');
assert.equal(JSON.stringify(source),currentBefore);

const fourth={...actual,matchDay:4,innings:[...actual.innings,{participantId:'team:cricket:australia',team:'Australia Men',inningNumber:3,runsScored:314,numberOfWicketsFallen:6,oversBowled:'58.0'},{participantId:'team:cricket:south-africa',team:'South Africa Men',inningNumber:4,runsScored:102,numberOfWicketsFallen:4,oversBowled:'41.0'}],cricketBalance:'Stumps: South Africa require 319 runs to win with 6 wickets remaining'};
assert.equal(view(fourth,options).summary,'Proteas 102/4 (41.0 overs) · Proteas require 319 runs to win with 6 wickets remaining');
assert.equal(view({...fourth,cricketBalance:'Stumps: Australia require 12 runs to win with 2 wickets remaining'},options).summary,'Proteas 102/4 (41.0 overs) · Australia require 12 runs to win with 2 wickets remaining','An opponent balance cannot acquire the batting side name');
assert.equal(view({...fourth,cricketBalance:'Rain delay: South Africa require 319 runs to win with 6 wickets remaining'},options).summary,'Proteas 102/4 (41.0 overs) · Rain delay: Proteas require 319 runs to win with 6 wickets remaining','A different source status is retained, rather than silently discarded');
assert.match(view({...fourth,cricketBalance:'Stumps delay under review; South Africa require 319 runs to win'},options).summary,/Stumps delay under review/,'Only an exact repeated status prefix is removed');

const women={...actual,gender:'women',homeParticipantId:'team:cricket:south-africa-women',awayParticipantId:'team:cricket:new-zealand-women',participantIds:['team:cricket:south-africa-women','team:cricket:new-zealand-women'],participants:[{id:'team:cricket:south-africa-women',name:'South Africa Women',aliases:['South Africa W']},{id:'team:cricket:new-zealand-women',name:'New Zealand Women',aliases:['New Zealand W']}],participantSlots:[],innings:[{participantId:'team:cricket:south-africa-women',team:'South Africa Women',runsScored:44,numberOfWicketsFallen:2,oversBowled:'7.1',inningNumber:1}],cricketBalance:'Stumps: South Africa W trail New Zealand W by 16 runs with 8 wickets remaining'};
assert.equal(view(women,options).summary,'Proteas Women 44/2 (7.1 overs) · Proteas Women trail White Ferns by 16 runs with 8 wickets remaining','Reviewed women identities cannot become the men\'s teams');
const absentIds={...actual,innings:actual.innings.map(({participantId,battingTeamId,...i})=>i)};
assert.equal(view(absentIds,options).summary,captured.summary,'A source team name may resolve only through an unambiguous fixture participant alias');
const unknown={key:'cricket',status:'stumps',statusText:'Stumps',scoreCheckedAt:checkedAt,innings:[{team:'Mystery Men',runs:0,wickets:0,overs:'0.0'}],cricketBalance:'Stumps: Unknown XI await a revised target'};
assert.equal(view(unknown,options).summary,'Mystery Men 0/0 (0.0 overs) · Unknown XI await a revised target','Unknown names and match-position wording remain source-owned');
assert.equal(view({...unknown,innings:unknown.innings.map(i=>({...i,participantId:'team:cricket:unverified-source-id'}))},options).summary,view(unknown,options).summary,'An unverified provider identifier cannot strip unknown team wording');
assert.equal(view({...actual,cricketBalance:'South Africana lead Australians by 1 run'},options).summary,'Proteas 27/1 (8.4 overs) · South Africana lead Australians by 1 run','Alias matching cannot rewrite substrings of unrelated names');
const ambiguous={...actual,participants:[{id:actual.homeParticipantId,name:'South Africa',aliases:['XI']},{id:actual.awayParticipantId,name:'Australia',aliases:['XI']}],cricketBalance:'Stumps: XI require 10 runs to win'};
assert.equal(view(ambiguous,options).summary,'Proteas 27/1 (8.4 overs) · XI require 10 runs to win','Shared aliases remain unconfirmed');
const registryOnly={...actual,participants:[],participantSlots:[]};
const registryOptions={...options,participant:id=>participantMarks[id]};
assert.equal(view(registryOnly,registryOptions).summary,captured.summary,'The host registry can supply existing verified participant aliases');
assert.equal(view({...actual,status:'completed',cricketBalance:'Stumps: South Africa trail Australia by 363 runs with 9 wickets remaining'},options).status,'Finished');
assert.match(view({...actual,status:'completed'},options).summary,/Stumps:/,'A previous source phrase cannot be discarded against a different completed status');

// Exercise installation separately from the numerical model: a header may be
// absent on a legacy host, so its status cannot always be omitted from the footer.
class Element {
 constructor(tag){this.tagName=tag.toUpperCase();this.children=[];this.attributes={};this.dataset={};this.ownText='';}
 get textContent(){return this.ownText+this.children.map(c=>typeof c==='string'?c:c.textContent).join('');}
 set textContent(value){this.ownText=String(value);this.children=[];}
 append(...nodes){this.children.push(...nodes);}
 setAttribute(key,value){this.attributes[key]=value;}
 getAttribute(key){return this.attributes[key]??null;}
 closest(){return this.card;}
 querySelector(){return null;}
 remove(){}
}
const savedDocument=globalThis.document;
globalThis.document={createElement:tag=>new Element(tag),querySelector:()=>null,head:new Element('head')};
try {
 const install=require('../config/feed-live-scores').install;
 for(const header of ['STUMPS • Live again at 6:30 pm','RAIN DELAY • Resume time unconfirmed','']){
  const card=new Element('section'),badge=new Element('div');badge.textContent=header;
  let clicks=0,stops=0;card.classList={contains:()=>false};
  card.querySelector=selector=>selector==='.fixture-more'?{click:()=>clicks++}:null;
  card.querySelectorAll=selector=>selector==='.fixture-timing-badge'&&header?[badge]:[];
  install(card,unknown,options);
  const [button,detail]=card.children.at(-1).children;button.card=card;
  assert.equal(button.tagName,'BUTTON');assert.equal(button.type,'button');assert.equal(button.getAttribute('aria-expanded'),'false');
  assert.match(button.getAttribute('aria-label'),/Expand scorecard$/);
  button.onclick({stopPropagation:()=>stops++});assert.equal(clicks,1);assert.equal(stops,1,'The real summary button retains the existing scorecard control');
  assert.equal(detail.textContent.startsWith('Stumps · '),header!=='STUMPS • Live again at 6:30 pm','Only the identical visible header status replaces footer status');
  assert(!detail.textContent.startsWith(' · '),'A deduplicated footer has no dangling separator');
  assert.equal(detail.children.at(-1).dateTime,checkedAt,'Original checked date remains accessible after deduplication');
 }
}finally{globalThis.document=savedDocument;}

console.log('Cricket summary: captured score, current innings, canonical names, women, missing identities, source wording, immutable facts, Results OFF and accessible expansion passed.');
