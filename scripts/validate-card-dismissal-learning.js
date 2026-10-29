#!/usr/bin/env node

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const eventActionIdentity = require("../config/event-action-identity");

const html = fs.readFileSync("index.html", "utf8");
const userStateSchema = JSON.parse(fs.readFileSync("schemas/user-state.schema.json", "utf8"));
const nativeEditionBeforeCorrection = {
  id: "event:fixture:123",
  eventId: "event:fixture:123",
  canonicalEventId: "event:fixture:123",
  date: "2026-08-28",
  time: "19:30",
};
const nativeEditionAfterCorrection = {
  ...nativeEditionBeforeCorrection,
  time: "20:00",
};
assert.equal(
  eventActionIdentity.stableKey(nativeEditionBeforeCorrection),
  eventActionIdentity.stableKey(nativeEditionAfterCorrection),
  "the same native card edition must stay dismissed after a schedule correction"
);
const winnipegDirectoryFixture = {
  id:"fixture:nhl:2026010003",
  eventId:"fixture:nhl:2026010003",
  sourceEventIds:["fixture:nhl:2026010003"],
  name:"Winnipeg Jets v Edmonton Oilers",
};
const winnipegMergedFeedFixture = {
  id:"feed:ice-hockey:winnipeg-edmonton-2026-09-20",
  eventId:"feed:ice-hockey:winnipeg-edmonton-2026-09-20",
  canonicalEventId:"feed:ice-hockey:winnipeg-edmonton-2026-09-20",
  sourceEventIds:["fixture:nhl:2026010003"],
  name:"Winnipeg Jets v Edmonton Oilers",
};
const winnipegDismissal = eventActionIdentity.writeAction({}, winnipegDirectoryFixture, {
  dismissed:true,
  dismissedAt:"2026-09-16T00:00:00.000Z",
  lastActionAt:"2026-09-16T00:00:00.000Z",
});
assert.equal(
  eventActionIdentity.actionFor(winnipegMergedFeedFixture, winnipegDismissal).dismissed,
  true,
  "Winnipeg dismissal must survive a canonical Feed merge through its published source fixture ID"
);

const seededEditionBeforeRefresh = {
  id: "major-event:australian-grand-prix-2027",
  eventId: "major-event:australian-grand-prix-2027",
  date: "2027-03-05",
  time: "12:30",
};
const seededEditionAfterRefresh = {
  ...seededEditionBeforeRefresh,
  date: "2027-03-06",
  time: "14:00",
};
assert.equal(
  eventActionIdentity.stableKey(seededEditionBeforeRefresh),
  eventActionIdentity.stableKey(seededEditionAfterRefresh),
  "the same seeded Events edition must stay dismissed when its next child fixture changes"
);
assert.notEqual(
  eventActionIdentity.stableKey(nativeEditionBeforeCorrection),
  eventActionIdentity.stableKey({ ...nativeEditionBeforeCorrection, canonicalEventId:"event:fixture:123:2027", eventId:"event:fixture:123:2027", id:"event:fixture:123:2027" }),
  "a genuinely different future edition must remain eligible"
);

const legacyActions = {
  "event:fixture:123:2026-08-28T19:30": {
    eventId:"event:fixture:123",
    dismissed:false,
    lastActionAt:"2026-08-28T01:00:00.000Z",
  },
  "event:fixture:123:2026-08-28T20:00": {
    eventId:"event:fixture:123",
    dismissed:true,
    dismissedAt:"2026-08-28T02:00:00.000Z",
    lastActionAt:"2026-08-28T02:00:00.000Z",
  },
};
const migratedActions = eventActionIdentity.migrateActions(legacyActions);
assert.deepEqual(Object.keys(migratedActions), ["event:fixture:123"], "legacy schedule keys must consolidate to the stable edition key");
assert.equal(eventActionIdentity.actionFor(nativeEditionAfterCorrection, migratedActions).dismissed, true, "the most recent legacy action must survive migration");
const restoredActions = eventActionIdentity.writeAction(migratedActions, nativeEditionAfterCorrection, {
  ...eventActionIdentity.actionFor(nativeEditionAfterCorrection, migratedActions),
  dismissed:false,
  dismissedAt:null,
  dismissalSource:"hidden_restore",
});
assert.equal(eventActionIdentity.actionFor(nativeEditionBeforeCorrection, restoredActions).dismissed, false, "Hidden recovery must write through the stable identity");
assert.equal(restoredActions["event:fixture:123"].actionKey, "event:fixture:123");

const actionProperties = userStateSchema.$defs.eventAction.properties;
assert(actionProperties.actionKey, "event actions must persist their stable identity key");
assert(actionProperties.canonicalEventId, "event actions must retain canonical edition aliases when available");
assert(actionProperties.dismissed, "event actions must persist exact-card dismissal state");
assert(actionProperties.isDismissed, "event actions must persist Events-only dismissal state");
assert(actionProperties.isMinimised, "event actions must persist card minimisation independently");
assert(actionProperties.dismissedAt, "event actions must persist when an exact card was dismissed");
assert(actionProperties.eventsDismissedAt, "Events dismissal ordering must not overwrite the Feed dismissal timestamp");
assert.match(html, /function dismissEventCard\(/, "Feed and Events must share one exact-card dismissal path");
require("./app-shell-test-utils").assertShellModule(html,"config/event-action-identity.js");
assert.match(html, /direction === "negative" && getEventAction\(ev\)\.dismissed/, "repeat dislikes must be idempotent");
assert.match(html, /function restoreDismissedEvent\(/, "dismissed cards must have a durable restoration path");
assert.match(html, /PREFERENCE_SYSTEM\.applyLearningSignal/, "Feed feedback must update the durable learning graph");
assert.match(html, /PREFERENCE_SYSTEM\?\.softLearningScore/, "card enrichment must consume bounded soft learning");
assert.match(html, /!getEventAction\(ev\)\.dismissed/, "main Feed filtering must remove dismissed cards");
assert.match(html, /activeMajorRecords = visible\.events\.filter\(record => !getEventAction\(majorEventActionEvent\(record\)\)\.isDismissed\)/, "Events must isolate its own dismissal marker");
assert.match(html, /buildDismissedEventStub/, "Events must render dismissed editions as restorable stubs");
assert.match(html, /eventsOnly:true/, "Events dismiss and restore controls must not write the Feed dismissal marker");
assert.match(html, /eventsDismissedAt:dismissedAt/, "Events dismissal must use its own stable timestamp");
assert.match(html, /renderHiddenEventsSettings/, "Settings must expose dismissed cards for restoration");
assert.match(html, /showToast\([^\n]+\{[^}]*actionLabel:\s*"Undo"/, "dismissal must offer immediate Undo");
assert.doesNotMatch(html, /bindHorizontalLearningSwipe\(/, "Feed and Events cards must not capture horizontal Tinder-style gestures");
const swipeHandler = html.match(/function applyCuratedEventSwipe\([\s\S]*?\n\}/)?.[0] || "";
assert.doesNotMatch(
  swipeHandler,
  /document\.querySelectorAll/,
  "dismissal must animate the exact initiating card instead of the first duplicate event card in the document"
);
assert.match(swipeHandler, /\{ card = null \}/, "the dismissal handler must receive the exact initiating card");
// The retired suggestion builder never admitted a suggestion. Exercise the
// current shared Dismiss control, rather than requiring its unused Like code.
const controlsStart = html.indexOf('function buildEventCardControls(');
const controlsEnd = html.indexOf('\nfunction buildCardDisclosureControl(', controlsStart);
assert(controlsStart >= 0 && controlsEnd > controlsStart, 'shared card controls must be available');
const controlsSource = html.slice(controlsStart, controlsEnd);
function verifyDismissControl(source){
  for (const eventsOnly of [false, true]) for (const hasInitiatingCard of [false, true]){
    const event = {id:'fixture:dismiss-control',name:'Current fixture'};
    const previous = {dismissed:false,lastActionAt:'2026-10-10T00:00:00Z'};
    const initiatingCard = {id:'initiating-card'}, fallbackCard = {id:'fallback-card'};
    let sent = null, stopped = 0;
    const context = {
      activeTab:'feed',
      VECTOR_ASSETS:require('../config/vector-assets'),
      document:{createElement:()=>({children:[],dataset:{},style:{},attributes:{},appendChild(child){this.children.push(child);},setAttribute(key,value){this.attributes[key]=value;}})},
      storedEventAction:()=>previous,
      dismissEventCard:(fixture,options)=>{sent={fixture,options};options.previousAction.dismissed=true;},
    };
    vm.runInNewContext(require('./app-shell-test-utils').readInlineOwner('glyphMarkup',html),context);
    vm.runInNewContext(source,context);
    const controls = context.buildEventCardControls(event,{card:fallbackCard,eventsOnly,displayLabel:'Reviewed fixture'});
    assert.equal(controls.children.length,1,'each card has one shared Dismiss control');
    const button = controls.children[0];
    assert.equal(button.dataset.cardControl,'dismiss');
    assert.equal(button.attributes['aria-label'],'Dismiss Reviewed fixture');
    assert.match(button.innerHTML,/<img\b[^>]*src="data:image\/svg\+xml/,'Dismiss uses the actual image-backed icon family');
    button.onclick({stopPropagation:()=>stopped++,currentTarget:{closest:selector=>{assert.equal(selector,'.event-card');return hasInitiatingCard?initiatingCard:null;}}});
    assert.equal(stopped,1,'Dismiss cannot also expand or navigate the card');
    assert.equal(sent.fixture,event,'the exact fixture reaches its persistent dismissal owner');
    assert.equal(sent.options.card,hasInitiatingCard?initiatingCard:fallbackCard,'the initiating card wins over a duplicate or fallback');
    assert.equal(sent.options.eventsOnly,eventsOnly,'Events and Feed dismissal remain separate');
    assert.equal(sent.options.displayLabel,'Reviewed fixture');
    assert.equal(previous.dismissed,false,'the saved action is copied before use');
  }
}
verifyDismissControl(controlsSource);
assert.throws(()=>verifyDismissControl(controlsSource.replace("event.currentTarget.closest('.event-card') || card",'card')),/initiating card wins/,'the test must reject dismissing a duplicate card');

console.log("Card dismissal valid: exact-card persistence, bounded button learning, Undo and Hidden recovery are wired.");
