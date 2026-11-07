#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),sharp=require('sharp');
const {processImage}=require('../lib/profile-avatar-image');
(async()=>{
 const source=sharp({create:{width:900,height:1200,channels:3,background:'#ed6688'}});
 for(const format of ['jpeg','png','webp','tiff','avif','gif']){
  const bytes=await source.clone().toFormat(format).toBuffer();
  const result=await processImage(bytes);
  for(const [key,size,max] of [['thumbnail',128,32000],['expanded',512,200000]]){
   const meta=await sharp(result[key]).metadata();assert.equal(meta.width,size);assert.equal(meta.height,size);assert.equal(meta.format,'webp');assert(!meta.exif&&!meta.icc);assert(result[key].length<=max);
  }
  console.log(`${format}: accepted and compressed`);
 }
 const frames=Buffer.concat([Buffer.alloc(64*64*3,50),Buffer.alloc(64*64*3,200)]);
 for(const format of ['gif','tiff']){
  const animated=await sharp(frames,{raw:{width:64,height:128,channels:3,pageHeight:64}}).toFormat(format).toBuffer();
  assert.equal((await sharp(animated,{animated:true}).metadata()).pages,2);
  const first=await processImage(animated),stats=await sharp(first.expanded).stats();
  assert(stats.channels[0].mean<70,'only the first frame/page is retained');
 }
 const heic=await processImage(fs.readFileSync('scripts/fixtures/avatars/libheif-example.heic'));assert(heic.expanded.length<=200000);console.log('heic/heif: primary image decoded and compressed');
 const jpeg=await source.clone().jpeg().withMetadata({orientation:6}).toBuffer();
 const oriented=await processImage(jpeg);assert.equal((await sharp(oriented.expanded).metadata()).orientation,undefined);
 // A split-colour image makes orientation observable, instead of testing only metadata removal.
 const raw=Buffer.alloc(200*100*3);for(let y=0;y<100;y++)for(let x=0;x<200;x++){let i=(y*200+x)*3;raw[i]=x<100?255:0;raw[i+2]=x<100?0:255;}
 const rotated=await processImage(await sharp(raw,{raw:{width:200,height:100,channels:3}}).jpeg().withMetadata({orientation:6}).toBuffer());
 const pixels=await sharp(rotated.expanded).raw().toBuffer();const top=(32*512+256)*3,bottom=(480*512+256)*3;assert(pixels[top]>pixels[top+2]);assert(pixels[bottom+2]>pixels[bottom]);
 const full=Buffer.alloc(6000000);jpeg.copy(full);await processImage(full);
 await assert.rejects(processImage(Buffer.alloc(6000001)),e=>e.status===413);
 await assert.rejects(processImage(Buffer.from('not an image')),e=>e.status===415);
 await assert.rejects(processImage(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>')),e=>e.status===415);
 // High entropy exercises the compression ceiling rather than an easy flat-colour image.
 const noisy=require('node:crypto').randomBytes(1024*1024*3);const noisyResult=await processImage(await sharp(noisy,{raw:{width:1024,height:1024,channels:3}}).png().toBuffer());assert(noisyResult.thumbnail.length<=32000&&noisyResult.expanded.length<=200000);
 const service=require('../lib/supabase-server'),server=require('../lib/nothingscore-server');
 const originalRequest=service.supabaseServiceRequest,originalPersona=server.personaFor;
 let follow=false,moderated=new Set(),requests=[];
 service.supabaseServiceRequest=async path=>{requests.push(path);return path.includes('user_follows')&&follow?[{follower_user_id:'owner'}]:[];};
 server.personaFor=async id=>({moderation_flag:moderated.has(id)});
 delete require.cache[require.resolve('../lib/profile-avatars')];const avatars=require('../lib/profile-avatars');
 try{
  const profile={user_id:'owner',visibility:'visible'},viewer={id:'viewer'};
  assert.equal(await avatars.allowed(profile,null),false);assert.equal(await avatars.allowed(profile,{id:'viewer',is_anonymous:true}),false);
  assert.equal(await avatars.allowed(profile,{id:'owner'}),true);
  assert.equal(await avatars.allowed(profile,viewer),false,'reverse-only following grants no access');
  follow=true;assert.equal(await avatars.allowed(profile,viewer),true);
  assert(requests.some(p=>p.includes('follower_user_id=eq.owner')&&p.includes('followed_user_id=eq.viewer')));
  follow=false;assert.equal(await avatars.allowed(profile,viewer),false,'next request after unfollow denied');follow=true;
  assert.equal(await avatars.allowed({...profile,visibility:'hidden'},viewer),false);
  assert.equal(await avatars.allowed({...profile,visibility:'hidden'},{id:'owner'}),true);
  assert.equal(await avatars.allowed({...profile,visibility:'deleted'},{id:'owner'}),false);
  moderated.add('owner');assert.equal(await avatars.allowed(profile,viewer),false);moderated.clear();moderated.add('viewer');assert.equal(await avatars.allowed(profile,viewer),false);
  assert.deepEqual(avatars.storageHeaders({configured:true,opaqueSecret:true,serviceRoleKey:'sb_secret_test'}),{apikey:'sb_secret_test'});
  assert.deepEqual(avatars.storageHeaders({configured:true,opaqueSecret:false,serviceRoleKey:'legacy-test'}),{apikey:'legacy-test',Authorization:'Bearer legacy-test'});
 }finally{service.supabaseServiceRequest=originalRequest;server.personaFor=originalPersona;}
 console.log('Avatar image sizes, orientation, metadata, corrupt/oversized files, privacy direction, revocation and credential regression passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
