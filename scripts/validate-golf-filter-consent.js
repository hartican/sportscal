"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const follow = require("../config/follow-first");
const policy = require("../config/follow-feed-policy");
const tennis = require("../config/tennis-feed");
const {buildServerFeed} = require("../lib/server-feed-pipeline");

// Retained public BMW identity/field; fixed clocks reproduce the transition
// across the tournament end without depending on the day this test runs.
const minjee = "competitor:golf:minjee-lee";
const bmw = {
  id:"fixture:golf:lpga:2026072", eventId:"fixture:golf:lpga:2026072",
  name:"BMW Ladies Championship", key:"golf", competitionId:"competition:lpga-tour",
  genderCategory:"female", tournamentId:"2026072",
  cardType:"golf_tournament", date:"2026-10-22", endDate:"2026-10-25",
  participantsConfirmed:true, participantIds:[minjee],
  participants:[{id:minjee, countryCode:"AU"}],
};
const empty = () => ({version:24, selectedSelectorEntityIds:[], followedSports:[],
  followFirst:{followedSportIds:[]},
  preferenceGraph:{entityFollows:[], domainPreferences:[], competitionPreferences:[]}});
const withAu = (preferences, sportId="sport:golf") => ({...preferences,
  followFirst:{...preferences.followFirst, australiansOnlySportIds:[sportId]}});
const withSport = (sportId, canonicalSport=sportId.slice(6)) => ({...empty(),
  selectedSelectorEntityIds:[sportId], followedSports:[canonicalSport]});

// Execute the real shell admission caller, not a parallel test-only policy.
const shell = fs.readFileSync(path.join(__dirname,"../index.html"),"utf8");
const start = shell.indexOf("function eventFollowReason(");
const end = shell.indexOf("\nfunction eventMatchesBroadcasterPreferences(",start);
assert(start>=0 && end>start,"actual client admission function must be found");
let preferences, now, action;
const context = {
  FOLLOW_FEED_POLICY:policy, NOTHINGSPORTS_TENNIS_FEED:tennis,
  NOTHINGSPORTS_CRICKET_COVERAGE:require("../config/cricket-coverage"),
  CARD_LIFECYCLE:require("../config/card-lifecycle"),
  tennisFeedParentDocument:{parents:[], participantTours:{}},
  nowAEST:()=>now, getEventAction:()=>action,
  eventParticipantFollowLevels:()=>[],
  automaticEventFollowReason:()=>null,
};
Object.defineProperty(context,"userPreferences",{get:()=>preferences});
vm.createContext(context);
vm.runInContext(shell.slice(start,end),context,{filename:"index.html:eventFollowReason"});
const projection={parents:[],contests:[],participantTours:{}};
function check(label, event, prefs, expected, clock="2026-10-26T00:00:00Z", saved={}){
  const original=JSON.stringify(prefs);
  preferences=prefs; now=new Date(clock); action=saved;
  const client=context.eventFollowReason(event,{preparedPreferences:follow.migratePreferences(prefs),collectionsById:{}});
  assert.equal(Boolean(client),expected,`client: ${label}`);
  const server=buildServerFeed({events:[event],userId:"golf-filter-consent-test",
    userState:{preferences:prefs,event_user_state:{[event.id]:saved}},now,tennisProjection:projection});
  assert.equal(server.events.some(row=>row.id===event.id),expected,`server: ${label}`);
  assert.equal(JSON.stringify(prefs),original,`preferences unchanged: ${label}`);
}

assert.equal(policy.sportKey(bmw),"golf-women");
assert.equal(policy.golfMajor(bmw),false);
for(const clock of ["2026-10-25T08:00:00Z","2026-10-26T00:00:00Z"]){
  check("empty follows",bmw,empty(),false,clock);
  check("remembered men's Australian filter is not a follow",bmw,withAu(empty()),false,clock);
  check("remembered women's Australian filter is not a follow",bmw,withAu(empty(),"sport:golf-women"),false,clock);
  const majors={...empty(),followFirst:{followedMajorEventIds:["masters-tournament","pga-championship","us-open-golf","the-open"]}};
  check("men's major families do not admit BMW",bmw,withAu(majors),false,clock);
  check("men's Golf and its Australian filter do not follow women's Golf",bmw,withAu(withSport("sport:golf")),false,clock);
  const athlete={...empty(),preferenceGraph:{...empty().preferenceGraph,
    entityFollows:[{participantId:minjee,followLevel:"follow"}]}};
  check("independent confirmed golfer follow remains eligible",bmw,athlete,true,clock);
}

const womenAu=withAu(withSport("sport:golf-women"),"sport:golf-women");
check("matching women's sport and Australian filter",bmw,womenAu,true);
check("women's Golf alone does not admit an ordinary tournament",bmw,
  withSport("sport:golf-women"),false);
check("a men's selection cannot use a stale women's legacy alias",bmw,
  withAu({...withSport("sport:golf"),followedSports:["golf-women"]},"sport:golf-women"),false);
check("women's selection survives a legacy parent display alias",bmw,
  {...womenAu,followedSports:["golf"]},true);
check("confirmed participant still required",{...bmw,participantsConfirmed:false},womenAu,false);
check("Australian field evidence still required",{...bmw,
  participants:[{id:"competitor:golf:haeran-ryu",countryCode:"KR"}],
  participantIds:["competitor:golf:haeran-ryu"]},womenAu,false);
check("remembered filter with an explicitly disabled women's domain",bmw,
  {...withAu(empty(),"sport:golf-women"),preferenceGraph:{...empty().preferenceGraph,
    domainPreferences:[{sportDomainId:"sport:golf-women",enabled:false}]}},false);
check("matching enabled domain is effective sport consent",bmw,
  {...withAu(empty(),"sport:golf-women"),preferenceGraph:{...empty().preferenceGraph,
    domainPreferences:[{sportDomainId:"sport:golf-women",enabled:true}]}},true);

const men={...bmw,id:"synthetic:golf:men",eventId:"synthetic:golf:men",
  name:"Synthetic ordinary men's tournament",genderCategory:"male",competitionId:"competition:pga-tour",
  participantIds:["competitor:golf:adam-scott"],participants:[{id:"competitor:golf:adam-scott",countryCode:"AU"}]};
check("matching men's sport and Australian filter",men,withAu(withSport("sport:golf")),true);
check("women's sport cannot admit a men's tournament",men,womenAu,false);

check("independent event edition choice remains eligible",bmw,
  {...empty(),followFirst:{eventEditionDecisions:{states:{"2026072":"followed"}}}},true);
check("independent event family choice remains eligible",{...bmw,eventFamilyId:"bmw-ladies"},
  {...empty(),followFirst:{followedMajorEventIds:["bmw-ladies"]}},true);
check("explicit tournament exclusion still wins",bmw,
  {...womenAu,followFirst:{...womenAu.followFirst,eventEditionDecisions:{states:{"2026072":"excluded"}}}},false);
check("explicit participant mute still wins",bmw,
  {...womenAu,preferenceGraph:{...empty().preferenceGraph,
    entityFollows:[{participantId:minjee,followLevel:"mute"}]}},false);

const pinned={...bmw,id:"synthetic:bmw:round-4",eventId:"synthetic:bmw:round-4",
  cardType:"golf_session",date:"2026-10-25",endDate:"2026-10-25",manualPin:true};
check("explicit fixture pin remains eligible",pinned,empty(),true,undefined,
  {addedToFixtures:true,addedFixture:pinned});
check("explicit sport exclusion still blocks a fixture pin",pinned,
  {...empty(),preferenceGraph:{...empty().preferenceGraph,
    domainPreferences:[{sportDomainId:"sport:golf-women",enabled:false}]}},false,undefined,
  {addedToFixtures:true,addedFixture:pinned});

// Collection/expanded-member admission is a separate path from sport filters.
const collection="collection:synthetic-golf",collectionsById={[collection]:{memberIds:[minjee]}};
preferences={...empty(),followFirst:{collectionFollows:[collection]}};
now=new Date("2026-10-26T00:00:00Z");
assert(context.eventFollowReason(bmw,{preparedPreferences:follow.migratePreferences(preferences),collectionsById}),
  "client collection-derived participant consent remains eligible");
assert(tennis.reason(bmw,empty(),{expandedParticipantIds:new Set([minjee]),now}),
  "server shared parent reason retains expanded collection membership");

console.log("Golf Australian-only filters require matching sport consent; actual client/server end-boundary and gender cases passed.");
