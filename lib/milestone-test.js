'use strict';
const identity=require('../config/event-action-identity'),coverage=require('../config/cricket-coverage');
async function fixture({eventId,user,installation,request}){
 if(!user||user.is_anonymous===true||installation.user_id!==user.id||installation.permission!=='granted')throw Object.assign(Error('Sign in with this notification installation before testing a milestone alert.'),{status:403,payload:{code:'milestone_test_account_required'}});
 let id=String(eventId||'');if(id.length>200)throw Object.assign(Error('Choose a supported Cricket fixture.'),{status:400,payload:{code:'invalid_milestone_fixture'}});
 if(!id){const rows=await request('/rest/v1/nothingsports_fixture_current?source_id=eq.cricket-ca-current&select=fixture&order=fixture_id.asc&limit=20',{timeoutMs:3000});const known=(rows||[]).map(r=>r.fixture).find(e=>coverage.allowed(e));id=String(known?.canonicalEventId||known?.eventId||known?.id||'');}
 if(!id)throw Object.assign(Error('No retained supported Cricket fixture is available for the test.'),{status:409,payload:{code:'milestone_fixture_unavailable'}});
 const rows=await request('/rest/v1/rpc/nothingsports_read_match_scores',{method:'POST',body:{p_fixture_ids:[id]},timeoutMs:3000});
 const event=(rows||[]).map(r=>r.fixture).find(e=>identity.aliasesForEvent(e).includes(id)&&coverage.allowed(e));
 if(!event)throw Object.assign(Error('A retained supported Cricket fixture is required for the test.'),{status:409,payload:{code:'milestone_fixture_unavailable'}});
 return event;
}
function payload(event,testId,now=Date.now()){
 const eventId=String(event.canonicalEventId||event.eventId||event.id);
 return {kind:'milestone',testId,eventId,momentId:'test-'+testId,title:'Test milestone alert',body:'This is a test. Open this match in Match Centre.',expiresAt:new Date(+now+120000).toISOString(),tag:'milestone-test-'+testId,url:'/?event='+encodeURIComponent(eventId)+'&surface=match-centre&moment=test-'+testId};
}
module.exports={fixture,payload};
