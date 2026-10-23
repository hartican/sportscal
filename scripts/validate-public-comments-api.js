'use strict';
const assert=require('node:assert/strict'),crypto=require('node:crypto');
const {createHandler}=require('../lib/public-comments-api');
async function main(){
 const owner=crypto.randomUUID(),comment=crypto.randomUUID(),calls=[];let user={id:owner},lookup=0,failure=null;
 const event={id:'fixture:canonical',kind:'fixture',key:'cricket',name:'Fixture',participantIds:['team:cricket:australia','team:cricket:india'],date:'2026-10-24',status:'upcoming'};
 const api={eventFor(id){lookup++;return ['fixture:alias','fixture:canonical'].includes(id)?event:null;},canonicalEventId:id=>id};
 const handler=createHandler({authenticate:async()=>user,api,now:()=>new Date('2026-10-24T00:00Z'),onWrite:()=>{},requestImpl:async(path,options)=>{calls.push({path,...options});if(path.includes('claim_public_comment_runs'))return[];if(failure)throw failure;return{comments:[],revision:1,comment:{id:comment}};}});
 const request=async({method='GET',query={},body}={})=>{const response={headers:{},setHeader(k,v){this.headers[k]=v;},status(code){this.code=code;return this;},json(value){this.value=value;return this;}};await handler({method,url:'/api/chat',query,body},response);return response;};
 user={id:owner,is_anonymous:true};assert.equal((await request({query:{eventId:'fixture:alias'}})).code,401);assert.equal(lookup,0);assert.equal(calls.length,0);
 user=null;assert.equal((await request({query:{eventId:'fixture:alias'}})).code,401);user={id:owner};
 let reply=await request({query:{mode:'public-comments',roomId:'fixture:alias'}});assert.equal(reply.code,200);assert.equal(reply.headers['Cache-Control'],'private, no-store');assert.equal(calls.at(-1).body.target_fixture,'fixture:canonical');assert.equal(calls.at(-1).body.target_user,owner);
 assert.equal((await request({query:{eventId:['fixture:canonical']}})).code,400);assert.equal((await request({query:{eventId:'fixture:missing'}})).code,404);assert.equal((await request({query:{eventId:'fixture:alias',after:'-1'}})).code,400);
 const command={action:'public-comment-post',eventId:'fixture:alias',clientId:crypto.randomUUID(),body:'<img onerror=evil()>😀'};
 reply=await request({method:'POST',body:command});assert.equal(reply.code,200);assert.equal(calls.filter(c=>c.path.endsWith('/nothingsports_public_comments')).at(-1).body.command.body,command.body);
 for(const extra of [{authorId:crypto.randomUUID()},{attachment:{type:'image/png'}},{body:'a'.repeat(501)},{gif:{provider:'giphy',gifId:'x',contentUrl:'https://evil.example/a.gif',previewUrl:'https://evil.example/a.gif'}}])assert.equal((await request({method:'POST',body:{...command,...extra}})).code,400);
 assert.equal((await request({method:'POST',body:{action:'public-comment-vote',eventId:'fixture:alias',id:comment,value:-1}})).code,200);assert.equal(calls.filter(c=>c.path.endsWith('/nothingsports_public_comments')).at(-1).body.command.value,-1);
 failure=Object.assign(Error('database detail'),{payload:{message:'public_comment_gif_locked'}});assert.equal((await request({method:'POST',body:command})).code,403);
 failure=Object.assign(Error('database detail'),{payload:{message:'public_comment_cursor_changed'}});assert.equal((await request({query:{eventId:'fixture:alias'}})).code,409);
 failure=null;event.status='completed';event.completedAt='2026-10-01T08:00Z';event.actualEndTimeUtc='2026-10-01T08:00Z';event.date='2026-10-01';assert.equal((await request({query:{eventId:'fixture:alias'}})).code,410);
 console.log('Public comments API: anonymous exclusion, canonical alias/owner fencing, SDK bridge, input/media bounds, SQL error handling and retirement passed.');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
