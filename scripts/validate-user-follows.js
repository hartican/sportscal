#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),{setFollow,followingProfileIds}=require('../lib/user-follows');
(async()=>{
 const actor={id:'actor'},target={user_id:'target',profile_id:'01010101-0101-4101-8101-010101010101'};let visible=true,moderated=false;const writes=[];
 const deps={api:{TABLES:{profiles:'profiles'},rows:async(_table,params)=>params.visibility&&!visible?[]:[target],personaFor:async()=>({moderation_flag:moderated})},request:async(path,options)=>{writes.push({path,options});return [];}};
 const body={targetProfileId:target.profile_id,following:true,follower_user_id:'forged'};
 await assert.rejects(setFollow(body,null,deps),error=>error.status===401);
 await assert.rejects(setFollow({...body,targetProfileId:'invalid'},actor,deps));
 await assert.rejects(setFollow(body,{id:target.user_id},deps));
 visible=false;await assert.rejects(setFollow(body,actor,deps));visible=true;
 moderated=true;await assert.rejects(setFollow(body,actor,deps));moderated=false;
 assert.equal(writes.length,0,'invalid, private, self or moderated follows never write');
 assert.deepEqual(await setFollow(body,actor,deps),{targetProfileId:target.profile_id,following:true});
 assert.equal(writes[0].options.body.follower_user_id,actor.id,'actor comes from verified session');
 assert.equal(writes[0].options.body.followed_user_id,target.user_id);
 visible=false;await setFollow({...body,following:false},actor,deps);
 assert.equal(writes[1].options.method,'DELETE');assert(writes[1].path.includes('follower_user_id=eq.actor'));
 assert.equal((await followingProfileIds(null,{request:()=>{throw Error('unexpected')}})).size,0);
 console.log('Public user follows: authentication, privacy, moderation, directed ownership and unfollow passed.');
})().catch(error=>{console.error(error);process.exitCode=1;});
