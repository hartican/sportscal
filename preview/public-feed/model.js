(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.PUBLIC_FEED_TEST_MODEL=api;})(globalThis,function(){
 'use strict';
 const KEY='ns-public-feed-test-v1',VERSION=1;
 const ids={alice:'11111111-1111-4111-8111-111111111111',sam:'22222222-2222-4222-8222-222222222222',carol:'33333333-3333-4333-8333-333333333333',bob:'44444444-4444-4444-8444-444444444444'};
 const copy=x=>JSON.parse(JSON.stringify(x));
 function failure(message,status=400,code='invalid_public_comment_request'){return Object.assign(Error(message),{status,code});}
 function create({storage,policy,epic,now=Date.now(),changed=()=>{}}){
  if(!policy||!epic)throw Error('Actual comment and archive policies are required.');
  function fresh(){
   const at=new Date(now).toISOString(),day=epic.day(at),event=(suffix,name,status,offset)=>{
    const id='fixture:nrl:public-feed-test-'+suffix,start=new Date(now+offset).toISOString();
    return{id,eventId:id,canonicalEventId:id,sourceEventIds:[id+'-alias'],kind:'fixture',key:'nrl',sport:'Rugby League',competitionName:'TEST FIXTURE · no real match',name,
     homeParticipantId:'team:nrl:test-home',awayParticipantId:'team:nrl:test-away',participantIds:['team:nrl:test-home','team:nrl:test-away'],participants:[{id:'team:nrl:test-home',displayName:'Test Home'},{id:'team:nrl:test-away',displayName:'Test Away'}],
     date:day,startTimeUtc:start,status,homeScore:status==='upcoming'?null:18,awayScore:status==='upcoming'?null:12,statusCheckedAt:at,scoreCheckedAt:at,statusSourceUrl:'https://example.invalid/synthetic-test',sourceStale:false,
     ...(status==='completed'?{completedAt:at,actualEndTimeUtc:at,endDate:day,finalDate:day}:{}),};
   };
   const accounts=Object.entries(ids).map(([name,id],i)=>({id,name,handle:'@'+name+'_test',points:name==='bob'?24:25,registered:true,visible:true,erasing:false,followed:Object.values(ids).filter(x=>x!==id&&x!==ids.bob),settings:{comments:true,global:true,device:true,results:true},classics:{},review:{revision:0,selection:[],caption:''}}));
   const fixtures=[event('live','TEST · Home v Away','live',-3600000),event('next','TEST · North v South','upcoming',3600000),event('final','TEST · A fixture to remember','completed',-7200000)];
   const value={version:VERSION,startedAt:at,clock:at,owner:ids.alice,accounts,fixtures,threads:{},notifications:[],heads:{},limits:{},serial:0};
   for(const fixture of fixtures){const thread=value.threads[fixture.id]={revision:0,closed:false,rows:[],quotes:[]};for(const [index,author]of [ids.sam,ids.carol,ids.bob].entries())thread.rows.push({id:crypto.randomUUID(),author,parentId:null,body:['A test conversation starts here. Try replying 👋','Which moment stood out? Vote this up or down.','I have 24 NSC points: GIFs unlock at 25.'][index],gif:null,baseScore:3-index,votes:{},createdAt:new Date(now-60000+index).toISOString(),revision:++thread.revision});thread.rows.push({id:crypto.randomUUID(),author:ids.alice,parentId:thread.rows[0].id,body:'Replies sit with their comment 😀',gif:null,baseScore:2,votes:{},createdAt:new Date(now-30000).toISOString(),revision:++thread.revision});}
   return value;
  }
  let state;
  try{const raw=storage?.getItem(KEY);if(raw&&raw.length<2000000){const parsed=JSON.parse(raw);if(parsed.version===VERSION&&Array.isArray(parsed.accounts)&&Array.isArray(parsed.fixtures)&&parsed.fixtures.length===3)state=parsed;}}catch{}
  state ||= fresh();
  const account=(id=state.owner,s=state)=>s.accounts.find(a=>a.id===id);
  const admitted=(id,s=state)=>s.fixtures.some(f=>f.id===id)&&!s.threads[id]?.closed&&!account(s.owner,s)?.dismissed?.includes(id);
  function persist(next,kind){try{storage?.setItem(KEY,JSON.stringify(next));}catch{throw failure('Test storage is full or unavailable. Reset the test or allow browser storage.',503,'test_storage_unavailable');}state=next;changed({kind});}
  function transaction(kind,run){const next=copy(state),result=run(next);persist(next,kind);return result;}
  function registered(id=state.owner,s=state){const a=account(id,s);if(!a?.registered)throw failure('Choose a registered test account above to open comments.',401,'account_required');if(a.erasing)throw failure('This test account is being erased.',403,'account_erasure_in_progress');return a;}
  function fixtureFor(id,s=state){return s.fixtures.find(f=>[f.id,...f.sourceEventIds].includes(id));}
  function threadFor(id,s=state){const fixture=fixtureFor(id,s);if(!fixture)throw failure('Test fixture not found.',404,'fixture_not_found');const thread=s.threads[fixture.id];if(thread.closed)throw failure('Comments have retired with this test fixture.',410,'public_comments_retired');return{fixture,thread};}
  const score=row=>row.baseScore+Object.values(row.votes).reduce((a,b)=>a+b,0);
  function visible(row,viewer,s=state){
   const author=account(row.author,s);if(row.removed)return{id:row.id,revision:row.revision,removed:true};
   const hidden=row.deleted||!author?.visible||author.erasing;
   return{id:row.id,parentId:row.parentId,handle:hidden?'':author.handle,body:hidden?'':row.body,gif:hidden?null:row.gif,deleted:!!hidden,own:viewer===row.author,score:score(row),myVote:row.votes[viewer]||0,createdAt:row.createdAt,revision:row.revision,replyCount:s.threads[row.eventId]?.rows.filter(r=>r.parentId===row.id&&!r.removed).length||0};
  }
  function read(eventId,q={},viewer=state.owner){
   registered(viewer);const{fixture,thread}=threadFor(eventId),rows=thread.rows.map(r=>({...visible({...r,eventId:fixture.id},viewer),replyCount:thread.rows.filter(x=>x.parentId===r.id&&!x.removed).length}));
   if(q.after!==undefined&&q.after!==''){const after=Number(q.after);if(!Number.isSafeInteger(after)||after<0||after>thread.revision)throw failure('Comments changed. Refresh the discussion.',409,'public_comment_cursor_changed');const all=rows.filter(r=>r.revision>after).sort((a,b)=>a.revision-b.revision),page=all.slice(0,policy.LIMITS.changes),more=all.length>page.length,parents=rows.filter(r=>page.some(x=>x.parentId===r.id)&&!page.some(x=>x.id===r.id));return{comments:[...page,...parents],revision:more?page.at(-1).revision:thread.revision,hasMore:more,nextCursor:null};}
   const parent=q.parentId||q.q||null;let offset=0;const token=q.cursor||q.before;
   if(token){let c;try{c=JSON.parse(atob(token));}catch{throw failure('Invalid test cursor.');}if(c.event!==fixture.id||c.owner!==viewer||c.parent!==parent)throw failure('This cursor belongs to another discussion.');if(c.revision!==thread.revision)throw failure('Comments changed. Reload the page.',409,'public_comment_cursor_changed');offset=c.offset;}
   const all=rows.filter(r=>!r.removed&&(r.parentId||null)===parent).sort(policy.compare),page=all.slice(offset,offset+policy.LIMITS.page),previews=parent?[]:page.flatMap(root=>rows.filter(r=>r.parentId===root.id&&!r.removed).sort(policy.compare).slice(0,policy.LIMITS.replyPreview)),next=offset+page.length<all.length?btoa(JSON.stringify({event:fixture.id,owner:viewer,parent,revision:thread.revision,offset:offset+page.length})):null;
   return{comments:[...page,...previews],revision:thread.revision,nextCursor:next};
  }
  function write(eventId,command,actor=state.owner){
   registered(actor);const prior=threadFor(eventId);const duplicate=command.action==='post'&&prior.thread.rows.find(r=>r.author===actor&&r.clientId===command.clientId);if(duplicate){if(duplicate.body!==policy.text(command.body||'')||JSON.stringify(duplicate.gif)!==JSON.stringify(command.gif?{...command.gif,contentType:'image/gif'}:null))throw failure('This comment changed.',409,'public_comment_id_conflict');return{comment:visible({...duplicate,eventId:prior.fixture.id},actor),replayed:true};}
   return transaction('comment',s=>{
    const a=registered(actor,s),{fixture,thread}=threadFor(eventId,s),minute=Math.floor(Date.parse(s.clock)/60000),limit=s.limits[actor]?.minute===minute?s.limits[actor]:{minute,posts:0,votes:0};s.limits[actor]=limit;
    let row;
    if(command.action==='post'){
     if(!a.visible||!a.handle)throw failure('Create a public test handle before commenting.',409,'public_comment_handle_required');if(++limit.posts>policy.LIMITS.commentsPerMinute)throw failure('Slow down and try again shortly.',429,'public_comment_rate_limit');if(!policy.uuid(command.clientId))throw failure('Invalid comment identifier.');
     const body=policy.text(command.body||''),gif=command.gif||null;if(!body&&!gif)throw failure('Write a comment or choose a GIF.');
     if(gif){if(a.points<25)throw failure('GIFs unlock at 25 lifetime NSC points.',403,'public_comment_gif_locked');if(gif.provider!=='giphy'||!/^https:\/\/media\.giphy\.com\/media\/preview-(cheer|wow|clap)\/giphy\.gif$/.test(gif.contentUrl||''))throw failure('Only the supplied test GIFs are available.');}
     const parent=command.parentId||null;if(parent&&!thread.rows.some(r=>r.id===parent&&!r.parentId&&!r.removed&&!r.deleted))throw failure('Reply to a top-level comment.',400,'public_comment_invalid_parent');
     if(thread.rows.length>=400)throw failure('This browser test is full. Reset the test to start again.',429,'test_storage_limit');
     row={id:crypto.randomUUID(),author:actor,parentId:parent,clientId:command.clientId,body,gif:gif?{...gif,contentType:'image/gif'}:null,baseScore:0,votes:{},createdAt:new Date(Date.parse(s.clock)+(++s.serial)).toISOString(),revision:++thread.revision};thread.rows.push(row);
     for(const recipient of s.accounts){if(!recipient.registered||recipient.erasing||!recipient.visible||recipient.dismissed?.includes(fixture.id))continue;const key=recipient.id+'|'+fixture.id,run=policy.nextRun(s.heads[key],{authorId:actor},{recipient:recipient.id,followed:new Set(recipient.followed)});s.heads[key]=run.previous;if(!run.notify){const old=[...s.notifications].reverse().find(n=>n.recipient===recipient.id&&n.eventId===fixture.id&&n.actor===actor&&n.run===s.heads[key]);if(old&&recipient.id!==actor&&recipient.followed.includes(actor))old.count++;continue;}if(recipient.settings.comments&&recipient.settings.global&&recipient.settings.device)s.notifications.push({id:crypto.randomUUID(),recipient:recipient.id,eventId:fixture.id,actor,count:1,run:actor,createdAt:row.createdAt,read:false,demonstration:true});}
    }else{
     row=thread.rows.find(r=>r.id===command.id&&!r.removed);if(!row)throw failure('Comment not found.',404,'public_comment_not_found');
     if(command.action==='vote'){if(++limit.votes>policy.LIMITS.votesPerMinute)throw failure('Slow down and try again shortly.',429,'public_comment_rate_limit');const value=policy.vote(command.value);if(row.deleted||!account(row.author,s)?.visible||account(row.author,s)?.erasing)throw failure('This comment is unavailable.',404,'public_comment_not_found');if(value)row.votes[actor]=value;else delete row.votes[actor];}
     else if(command.action==='delete'){if(row.author!==actor)throw failure('You can delete only your own comments.',403,'public_comment_not_owned');row.deleted=true;row.body='';row.gif=null;}else throw failure('Unknown test comment action.');row.revision=++thread.revision;
    }
    return{comment:visible({...row,eventId:fixture.id},actor,s),revision:thread.revision};
   });
  }
  function select(owner){if(owner!=='visitor'&&!account(owner))throw failure('Unknown test account.');transaction('account',s=>{s.owner=owner;});}
  function settings(patch){transaction('settings',s=>{const a=registered(s.owner,s);for(const key of ['comments','global','device','results'])if(Object.hasOwn(patch,key))a.settings[key]=patch[key]===true;});}
  function follow(author,enabled){transaction('follow',s=>{const a=registered(s.owner,s);a.followed=a.followed.filter(x=>x!==author);if(enabled&&account(author,s)&&author!==a.id)a.followed.push(author);});}
  function rate(eventId,value){transaction('rating',s=>{const a=registered(s.owner,s),fixture=fixtureFor(eventId,s);if(!fixture||![1,2,3,4,5].includes(value))throw failure('Choose a test rating.');a.ratings ||= {};a.ratings[fixture.id]=value;if(value===5&&!a.classics[fixture.id])a.classics[fixture.id]={removed:false,revision:1,qualifiedAt:s.clock,qualifiedPhase:fixture.status==='completed'?'impact':fixture.status==='live'?'pulse':'heat'};});}
  function dismiss(eventId,hide=true){transaction('dismissal',s=>{const a=registered(s.owner,s);a.dismissed=(a.dismissed||[]).filter(id=>id!==eventId);if(hide)a.dismissed.push(eventId);});}
  function points(author,value){transaction('points',s=>{if(![24,25].includes(value)||!account(author,s))throw failure('Only the 24/25 test boundary is available.');account(author,s).points=value;});}
  function captureFailure(enabled){transaction('test-failure',s=>{s.captureFailure=enabled===true;});}
  function advance(days){transaction('clock',s=>{if(![0,7,8].includes(days))throw failure('Unknown test clock step.');const[y,m,d]=epic.day(s.startedAt).split('-').map(Number);s.clock=new Date(Date.UTC(y,m-1,d+days,1)).toISOString();});}
  function retire(){return transaction('retirement',s=>{const retired=[];for(const f of s.fixtures){const t=s.threads[f.id];if(t.closed||f.status!=='completed'||!epic.retired(f,new Date(s.clock)))continue;const qualify=s.accounts.some(a=>a.classics[f.id]);if(qualify&&s.captureFailure)throw failure('TEST: archive capture failed; comments were kept. Turn off the failure and retry.',503,'test_capture_failure');t.quotes=qualify?policy.topThree(t.rows.map(r=>visible({...r,eventId:f.id},null,s))):[];t.rows=[];t.closed=true;t.revision++;retired.push(f.id);}return retired;});}
  function privacy(author,{visible:show,erase=false}){transaction('privacy',s=>{const a=account(author,s);if(!a)throw failure('Unknown test account.');if(erase)a.erasing=true;else a.visible=show===true;for(const t of Object.values(s.threads)){for(const row of t.rows){if(row.author===author){if(erase){row.removed=true;row.body='';row.gif=null;}row.revision=++t.revision;}if(erase&&row.parentId&&t.rows.some(r=>r.id===row.parentId&&r.author===author)){row.parentId=null;row.revision=++t.revision;}if(erase&&row.votes[author]){delete row.votes[author];row.revision=++t.revision;}}if(erase)t.quotes=t.quotes.filter(q=>!t.rows.some(r=>r.id===q.id&&r.author===author)&&q.handle!==a.handle);}if(erase){a.classics={};s.notifications=s.notifications.filter(n=>n.actor!==author&&n.recipient!==author);}});}
  function classics(q={},command=null){
   const a=registered();if(command)return transaction('archive',s=>{const owner=registered(s.owner,s);if(command.action==='notifications'){owner.yearReviewEnabled=command.enabled===true;return{};}if(command.action==='review-save'){if(command.revision!==owner.review.revision)throw failure('The test review changed.',409);owner.review={revision:owner.review.revision+1,selection:command.selection,caption:command.caption};return{revision:owner.review.revision};}if(['save','remove'].includes(command.action)){const entry=owner.classics[command.eventId];if(!entry)throw failure('Test classic not found.',404);entry.removed=command.action==='remove';entry.revision++;return{};}throw failure('Unsupported test archive command.');});
   const record=f=>({...f,year:Number(epic.day(f.completedAt||f.startTimeUtc).slice(0,4)),completed:f.status==='completed',finalDate:epic.finalDay(f,new Date(state.clock))});
   if(q.years)return{years:[Number(epic.day(state.clock).slice(0,4))]};
   if(q.eventId){const f=fixtureFor(q.eventId);if(!f||!a.classics[f.id]||a.classics[f.id].removed)throw failure('Test classic not found.',404);const thread=state.threads[f.id],comments=q.results==='1'?thread.quotes.filter(quote=>state.accounts.some(author=>author.handle===quote.handle&&author.visible&&!author.erasing)):[];return{fixture:record(f),editorial:[],comments};}
   const entries=Object.entries(a.classics).filter(([,entry])=>entry.removed===(q.removed==='1')).map(([eventId,entry])=>({event_id:eventId,fixture:record(fixtureFor(eventId)),qualified_at:entry.qualifiedAt,qualified_phase:entry.qualifiedPhase,revision:entry.revision})).filter(e=>!q.review||e.fixture.completed);
   return{entries,nextCursor:null,role:'member',yearReviewEnabled:a.yearReviewEnabled!==false,review:copy(a.review)};
  }
  function reset(){persist(fresh(),'reset');}
  function sync(){try{const value=JSON.parse(storage?.getItem(KEY)||'null');if(value?.version===VERSION){value.owner=state.owner;state=value;changed({kind:'sync'});}}catch{}}
  return{KEY,ids,snapshot:()=>copy(state),account:()=>copy(account()||null),fixtures:()=>copy(state.fixtures),admitted,registered,read,write,select,settings,follow,rate,dismiss,points,captureFailure,advance,retire,privacy,classics,reset,sync};
 }
 return{create,KEY,ids};
});
