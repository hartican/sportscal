#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),path=require('node:path'),sharp=require('sharp');
const content=require('../lib/comms-content'),ui=require('../config/admin-comms-workspace');
const artifact=require('../data/marquee-candidates.v1.json'),sources=require('../data/comms-sources.v1.json');
async function main(){
  assert.equal(artifact.schemaVersion,'marquee-candidates.v1');assert.equal(artifact.shadowMode,true);
  assert.equal(artifact.summary.shown,artifact.candidates.length);
  const now=Date.parse(artifact.generatedAt),ids=new Set();
  const rows=artifact.candidates.map(c=>({event_id:c.eventId,proposed_send_at:c.proposedSendAt,candidate:c}));
  assert.deepEqual([...rows].sort(ui.compareCampaigns),rows,'Order by proposed post, then fixture date; pending last');
  for(const c of artifact.candidates){
    assert(!ids.has(c.campaignId));ids.add(c.campaignId);
    assert(c.eligibilityEvidence.stakesExactlyFive||c.eligibilityEvidence.majorEvent||c.eligibilityEvidence.communityEligible);
    assert(!/^ticket-sale:/.test(c.eventId));
    assert(c.drafts.hook);assert(c.drafts.email.subject.length<=150);assert(c.drafts.email.preheader.length<=150);
    assert(c.drafts.email.bodyParagraphs.length>=1&&c.drafts.email.bodyParagraphs.length<=8);
    assert(c.drafts.email.bodyParagraphs.every(p=>!/^(Why It Matters|Form|Match Context|Storyline|CTA)\s*[:|]/i.test(p)));
    assert.match(c.drafts.email.primaryCta.url,/^https:\/\/nothingsport\.vercel\.app\//);
    assert.match(c.participation.liveUrl,new RegExp('campaign='+c.campaignId));
    assert.equal(c.drafts.live.logos.order,'teams-first');assert.equal(c.drafts.live.animationPreset,'subtle','Editorial-only 5 is not real >4.8 Heat');
    assert.equal(c.channels.email.enabled,false);assert.equal(c.channels.social.enabled,false);
    assert.equal(c.drafts.email.suggestedSendAt.utc,c.proposedSendAt);
    assert.equal(c.drafts.email.image.altText,c.drafts.instagram.altText);
    const image=await sharp(path.join(__dirname,'..',c.assets.fallbackHero.path)).metadata();
    assert.equal(image.width,1080);assert.equal(image.height,1350);assert.equal(image.format,'jpeg');
    if(c.timing.startTimeUtc){assert(c.participation.enabled);assert(Date.parse(c.timing.endTimeUtc)>now);}
    else{assert.equal(c.participation.enabled,false);assert(c.readinessIssues.includes('estimated_post_time'));}
  }
  for(const e of sources.events.filter(e=>content.eligible(e,null,now))){assert(artifact.candidates.some(c=>c.eventId===require('../config/marquee-campaigns').fixtureId(e)),'Eligible current fixture/Major Event included: '+e.name);}
  const nrl=artifact.candidates.find(c=>c.eventId==='evt_84');assert(nrl,'Current NRL Grand Final included');
  assert.match(nrl.drafts.hook,/wooden spooners/);assert(nrl.drafts.email.bodyParagraphs.some(p=>/36[–-]20/.test(p)));assert.equal(nrl.identities.teams.length,2);
  const bledisloe=artifact.candidates.find(c=>c.eventId==='rugby-australia-new-zealand-2026-10-17');assert.match(bledisloe.material.recognisableTitle,/Bledisloe/);assert.equal(bledisloe.identities.teams.length,2);
  console.log('Marquee candidates passed: '+ids.size+' post tasks, current editorial, complete generic copy, current marks and Sydney chronology.');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
