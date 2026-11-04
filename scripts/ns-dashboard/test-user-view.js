"use strict";
const test=require('node:test'),assert=require('node:assert/strict');
const {overviewFixture,AS_OF}=require('./overview-fixture');
const {renderUserPage}=require('../../lib/ns-dashboard/user-view');
test('all four hosted pages use the approved plain-language layout and canonical navigation',()=>{
 for(const view of ['overview','delivery','queue','evidence']){
  const html=renderUserPage(overviewFixture(),view,{asOf:AS_OF,publishedAt:AS_OF});
  for(const label of ['Home','Changes','Being fixed','About this page'])assert.ok(html.includes('>'+label+'</a>'));
  assert.match(html,/What is working, what still needs fixing, and what happens next/);
  assert.doesNotMatch(html,/PR #|receipt:|Deployment|Sources and definitions|<script|\/Users\//);
  assert.match(html,/href="\/admin\/dashboard\/evidence"/);
 }
});
test('technical owner notes do not leak into everyday pages or become invented user claims',()=>{
 const p=overviewFixture();p.briefing.work[0].title='PR141 C142974242a87';p.briefing.work[0].reason='HTTP504 CAS sourceHead UNRUN';p.briefing.work[0].nextAction='Run RPC against projection';p.briefing.work[0].owner='nsSYNC + nsUPDATE';
 const html=renderUserPage(p,'queue',{asOf:AS_OF,publishedAt:AS_OF});
 assert.doesNotMatch(html,/PR141|C142974242a87|HTTP504|UNRUN|RPC|nsSYNC|nsUPDATE/);
 assert.match(html,/plain language/);assert.match(html,/Follow team/);assert.match(html,/fixture team/);
});
test('refresh failure retains the dated progress while reporting the failed update in plain language',()=>{
 const p=overviewFixture();p.freshness.state='error';
 const html=renderUserPage(p,'overview',{asOf:AS_OF,publishedAt:AS_OF});
 assert.match(html,/The update failed. The last saved information is shown/);assert.match(html,/Selection-saving update/);
 assert.match(html,/not checked the app again/);
});
test('about page distinguishes saved dates from browser reload and does not claim automatic refresh',()=>{
 const p=overviewFixture();const html=renderUserPage(p,'evidence',{asOf:AS_OF,publishedAt:AS_OF});
 assert.match(html,/Automatic updates are not running yet/);assert.match(html,/does not gather new information/);assert.match(html,/datetime="2026-11-02T04:00:00Z"/);assert.match(html,/AEDT/);
});
