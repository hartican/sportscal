'use strict';
const assert=require('node:assert/strict');
const serverPath=require.resolve('../lib/supabase-server'),server=require(serverPath);let user={id:'11111111-1111-4111-8111-111111111111'},calls=[];
require.cache[serverPath].exports={...server,authenticatedUser:async token=>{if(!token)throw new server.SupabaseRequestError('Sign in',{status:401});return user;},supabaseServiceRequest:async(path,options)=>{calls.push({path,options});return {items:[],unreadCount:0};}};
const handler=require('../lib/inbox-api');
async function run(method='GET',body=null,url='/api/inbox',token='token'){
 const res={headers:{},setHeader(k,v){this.headers[k]=v;},status(code){this.code=code;return this;},json(payload){this.payload=payload;return this;}};
 await handler({method,body,url,headers:{authorization:token?`Bearer ${token}`:''}},res);return res;
}
(async()=>{
 assert.equal((await run('GET',null,'/api/inbox','')).code,401);
 user.is_anonymous=true;assert.equal((await run()).code,403);user.is_anonymous=false;
 assert.equal((await run('POST','bad JSON')).code,400);
 assert.equal((await run('GET',null,'/api/inbox?cursor=bad')).code,400);
 assert.equal((await run('POST',{seen:[{id:user.id,version:-1}]})).code,400);
 assert.equal((await run('POST',{seen:Array(26).fill({id:user.id,version:1})})).code,400);
 assert.equal((await run('DELETE')).code,405);
 const result=await run();assert.equal(result.code,200);assert.equal(result.headers['Cache-Control'],'private, no-store');
 await run('POST',{recipientId:'attacker',seen:[{id:user.id,version:1}]});assert.equal(calls.at(-1).options.body.target_user,user.id,'recipient always derived from validated account');
 assert.deepEqual(calls.at(-1).options.body.seen,[{id:user.id,version:1}]);
 const parent=require('../api/notifications'),response={setHeader(){},status(code){this.code=code;return this;},json(data){this.data=data;}};
 await parent({method:'GET',url:'/api/notifications?route=inbox',headers:{authorization:'Bearer token'}},response);assert.equal(response.code,200);assert(Array.isArray(response.data.items),'public rewrite reaches private inbox handler');
 console.log('Inbox API: authentication, guest denial, ownership, invalid input, bounds and cache policy passed.');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>{require.cache[serverPath].exports=server;});
