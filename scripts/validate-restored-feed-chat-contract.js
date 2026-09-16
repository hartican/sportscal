#!/usr/bin/env node
const fs=require('fs');
const assert=require('assert');
const read=path=>fs.readFileSync(path,'utf8');

const html=read('index.html');
const chat=read('api/chat.js');
const migration=read('supabase/migrations/20260909143000_chat_fullscreen_receipts_invitations.sql');
const finals=JSON.parse(read('data/canonical/afl-nrl-finals-2026.json'));
const golf=JSON.parse(read('data/canonical/golf-majors-2027.json'));
const policy=require('../config/follow-feed-policy');
const practice={id:'fixture:f1:practice-1',key:'f1',cardKind:'fixture',name:'Italian GP Practice 1',date:'2026-09-04'};
assert(!policy.eligibleForFollow(practice,{competitionFollow:true}),'published F1 Practice sessions stay outside Feed');
assert(!policy.eligibleForFollow(practice,{}),'published F1 sessions never create a follow');
const {syncCanonicalFixtures}=require('./sync-canonical-fixtures-to-feed');
const canonical=JSON.parse(read('data/canonical/afl-nrl-2026.json'));
const grandFinalId='event:afl:cd_m20260142901';
const rebuilt=syncCanonicalFixtures({events:[]},canonical,{publishedAt:'2026-09-09T00:00:00Z'}).output;
assert.equal(rebuilt.events.find(event=>event.canonicalEventId===grandFinalId)?.name,'AFL Grand Final','canonical refresh must not reintroduce bracket title');
const resolved=structuredClone(canonical);
const resolvedFinal=resolved.events.find(event=>event.id===grandFinalId);
resolvedFinal.displayName='Sydney Swans v Hawthorn';
const resolvedFeed=syncCanonicalFixtures({events:[]},resolved,{publishedAt:'2026-09-09T00:00:00Z'}).output;
assert.equal(resolvedFeed.events.find(event=>event.canonicalEventId===grandFinalId)?.name,'Sydney Swans v Hawthorn','resolved clubs replace placeholder title');
assert.equal(resolvedFeed.events.find(event=>event.canonicalEventId===grandFinalId)?.stage,'Grand Final','resolved clubs retain stage');

assert.match(html,/fixture-participant-pager/,'F1 followed participants need a one-line pager');
assert.match(html,/time\.textContent=`\$\{timing\} • \$\{sportLabel\}`/,'compact cards need an explicit sport label');
assert.match(html,/Chat sound on/,'chat sound activation needs acknowledgement');
assert.match(html,/chatIncomingBanner/,'incoming chat needs an exact-room banner');
assert.match(html,/Remove from list/,'bulk personal archiving must remain distinct from destructive chat deletion');
assert.match(html,/action:"delete-room"/,'room creators and admins need destructive whole-chat deletion');
assert.match(html,/action:"delete-message"/,'message authors and admins need post deletion');
assert.match(html,/message\.deliveryState/,'messages need receipt state');
assert.match(html,/status\.appendChild\(time\)/,'receipts need a sent-time anchor');
assert.match(chat,/target_members:memberIds/);
assert.match(chat,/await inviteMembers\(\{roomId,memberIds:invitees\}/,'new rooms must invite rather than auto-admit requested accounts');
assert.match(chat,/restPath\(TABLES\.members, \{ on_conflict:"room_id,user_id" \}\)/,'Add selected members must create protected room membership immediately');
assert.match(migration,/nothingsports_chat_resolve_invitation/);
assert.match(migration,/has dogged the chat/);
assert.match(migration,/last_delivered_at/);

const fixtures=(finals.phases||[]).flatMap(phase=>phase.fixtures||[]);
const unresolved=fixtures.filter(item=>item.schedulePrecision==='week');
assert(unresolved.length>=8,'unresolved finals need week anchors');
assert(unresolved.every(item=>item.weekAnchorDate&&/^Week of Monday, /.test(item.displayDateLabel||'')),'week anchors need public labels');
for(const code of ['afl','nrl']){
  const grandFinal=fixtures.find(item=>String(item.id||'').includes(code)&&/grand final/i.test(item.publicStageLabel||item.stageLabel||item.name||''));
  assert(grandFinal,`${code.toUpperCase()} Grand Final missing`);
  assert(!/winner of/i.test(grandFinal.name||grandFinal.displayName||''),`${code.toUpperCase()} Grand Final leaked bracket copy`);
}

const majors=golf.events||golf.fixtures||[];
assert.strictEqual(majors.length,4,'exactly four upcoming men’s golf majors expected');
assert.deepStrictEqual(new Set(majors.map(item=>item.gender)),new Set(['men']));
assert(majors.every(item=>golf.sources?.[item.sourceId]?.url?.startsWith('https://')), 'golf majors need sources');

console.log('Restored Feed/chat acceptance contract: PASS');
