'use strict';
const identity=require('../config/event-action-identity'),choice=require('../config/milestone-test-fixture');
async function fixture({eventId,user,installation,request}){
 if(!user||user.is_anonymous===true||installation.user_id!==user.id||installation.permission!=='granted')throw Object.assign(Error('Sign in with this notification installation before testing a milestone alert.'),{status:403,payload:{code:'milestone_test_account_required'}});
 let id=String(eventId||'');if(id.length>200)throw Object.assign(Error('Choose a supported Cricket fixture.'),{status:400,payload:{code:'invalid_milestone_fixture'}});
 let ids=id?[id]:[];
 if(!id){const rows=await request('/rest/v1/nothingsports_fixture_current?source_id=eq.cricket-ca-current&select=fixture&order=fixture_id.asc&limit=20',{timeoutMs:3000});ids=[...new Set((rows||[]).slice(0,20).map(r=>r.fixture).filter(choice.supported).map(e=>String(e.canonicalEventId||e.eventId||e.id||'')).filter(id=>id&&id.length<=200))];}
 if(!ids.length)throw Object.assign(Error('No retained supported Cricket fixture is available for the test.'),{status:409,payload:{code:'milestone_fixture_unavailable'}});
 const rows=await request('/rest/v1/rpc/nothingsports_read_match_scores',{method:'POST',body:{p_fixture_ids:ids},timeoutMs:3000});
 const events=(rows||[]).map(r=>r.fixture).filter(e=>choice.supported(e)&&identity.aliasesForEvent(e).some(alias=>ids.includes(alias)));
 const event=id?events.find(e=>identity.aliasesForEvent(e).includes(id)):choice.select(events);
 if(!event)throw Object.assign(Error('A retained supported Cricket fixture is required for the test.'),{status:409,payload:{code:'milestone_fixture_unavailable'}});
 return event;
}
function payload(event,testId,now=Date.now()){
 const eventId=String(event.canonicalEventId||event.eventId||event.id);
 const body=/^(completed|finished|final)$/.test(event.status||'')?'Test alert using a completed match. Open Match Centre.':choice.active(event,now)?'Test alert using a live match. Open Match Centre.':'Test alert: checking delivery and opening. Open Match Centre.';
 return {kind:'milestone',testId,eventId,momentId:'test-'+testId,title:'Test milestone alert',body,expiresAt:new Date(+now+120000).toISOString(),tag:'milestone-test-'+testId,url:'/?event='+encodeURIComponent(eventId)+'&surface=match-centre&moment=test-'+testId};
}
module.exports={fixture,payload};
