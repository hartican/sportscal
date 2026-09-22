#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const root=path.resolve(__dirname,'..');
 const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+(new URL(req.url,'http://local').pathname==='/'?'/index.html':new URL(req.url,'http://local').pathname));fs.readFile(file,(e,b)=>{res.writeHead(e?404:200,{'Content-Type':file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':file.endsWith('.json')?'application/json':'text/html'});res.end(e?'':file.endsWith('index.html')?b.toString().replace('const serverSyncClient =','let serverSyncClient ='):b);});});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({headless:true});
 try{
 const page=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block'});
 await page.route('**/api/**',r=>r.fulfill({status:503,json:{}}));await page.goto(`http://127.0.0.1:${server.address().port}`);await page.waitForFunction(()=>typeof openChatRoom==='function');
 page.setDefaultTimeout(15000);
 const result=await page.evaluate(async()=>{
  const waits=[];const calls=[];
  serverSyncClient={chatRequest:(query,command)=>{calls.push({query,command});if(command?.action==='mark-read'||command?.action==='mark-delivered'||query?.mode==='active')return Promise.resolve({rooms:[]});return new Promise((resolve,reject)=>waits.push({query,command,resolve,reject}));}};
  scheduleChatRoomPoll=()=>{};refreshChatActive=async()=>{};
  ensureChatMediaUi=async()=>{chatMediaUi={preview:()=>document.createElement('div'),refreshPreviews(){},closePicker(){}};};
  const message=(id)=>({messageId:id,body:id,sentAt:'2026-09-22T00:00:00Z',senderName:'Test',own:true,canDelete:true,attachments:[],reactions:[]});
  const payload=(id,mid=id)=>({room:{roomId:id,roomName:id,status:'open',members:[],viewer:{canPost:true},fixture:{name:'Test'}},messages:[message(mid)],olderCursor:'2026-09-21T00:00:00Z',reactionCursor:id});
  setChatDrawerOpen(true);
  const a=openChatRoom('A'), b=openChatRoom('B'), a2=openChatRoom('A');
  waits[2].resolve(payload('A','latest-A'));await a2;
  waits[1].resolve(payload('B'));await b;waits[0].resolve(payload('A','stale-A'));await a;
  const aba=chatState.currentRoom?.roomId==='A'&&chatState.messages[0]?.messageId==='latest-A';
  waits.length=0;
  const poll=pollChatRoom();setChatDrawerOpen(false);waits[0].resolve(payload('A','closed-poll'));await poll;
  const closed=chatState.currentRoom===null&&chatState.messages.length===0;
  async function enter(id){setChatDrawerOpen(true);const p=openChatRoom(id);waits.at(-1).resolve(payload(id));await p;}
  await enter('A');chatState.draftBody='draft-A';chatState.replyToMessageId='A';chatState.pendingAttachments=[{attachmentId:'file-A',status:'ready'}];
  const history=loadOlderChatMessages(document.createElement('button'));const hw=waits.at(-1);await enter('B');hw.resolve(payload('A','old-A'));await history;
  const older=chatState.currentRoom.roomId==='B'&&chatState.messages.every(m=>m.messageId==='B')&&chatState.draftBody===''&&chatState.pendingAttachments.length===0;
  await enter('A');const drafts=chatState.draftBody==='draft-A'&&chatState.replyToMessageId==='A'&&chatState.pendingAttachments[0]?.attachmentId==='file-A';
  const form=document.getElementById('chatRoomComposer');form.querySelector('textarea').value='send A';const send=sendChatMessage(form);const sw=waits.at(-1);await enter('B');sw.resolve({message:message('sent-A')});await send;
  const sending=chatState.currentRoom.roomId==='B'&&chatState.messages.every(m=>m.messageId==='B')&&sw.command.roomId==='A';
  await enter('A');const reaction=toggleChatReaction('A','🔥',document.createElement('button'));await new Promise(r=>setTimeout(r,0));const rw=waits.at(-1);await enter('B');rw.reject(new Error('Delayed reaction failure'));await reaction;
  const reacting=chatState.messages[0].messageId==='B'&&rw.command.roomId==='A'&&!document.getElementById('chatBody').textContent.includes('Delayed reaction');
  await enter('A');window.confirm=()=>true;const deletion=deleteChatMessage(chatState.messages[0],document.createElement('button'));const dw=waits.at(-1);await enter('B');dw.resolve({deleted:true});await deletion;
  const deleting=chatState.currentRoom.roomId==='B'&&chatState.messages[0].messageId==='B'&&dw.command.roomId==='A';
  document.getElementById('closeChatBtn').click();const back=!chatState.currentRoom&&document.getElementById('chatBackdrop').classList.contains('show');document.getElementById('closeChatBtn').click();const close=!document.getElementById('chatBackdrop').classList.contains('show');
  return {aba,closed,older,drafts,sending,reacting,deleting,back,close};
 });
 for(const [name,passed] of Object.entries(result))assert.equal(passed,true,name);console.log('Chat delayed responses:',result);
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
