#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const source=fs.readFileSync('index.html','utf8');
const section=(a,b)=>source.slice(source.indexOf(a),source.indexOf(b,source.indexOf(a)));
(async()=>{
 const state={selectedRoomIds:Array.from({length:123},(_,i)=>String(i)),rooms:Array.from({length:123},(_,i)=>({roomId:String(i)})),chatSelectionMode:true};
 let calls=[],fail=false;
 const request={chatRequest:async(_,body)=>{calls.push(body.roomIds);if(fail&&calls.length===2)throw Error('network');}};
 const remove=Function('chatState','serverSyncClient','refreshChatActive','renderActiveChats','chatConnection',section('async function deleteSelectedChats','function renderActiveChats')+';return deleteSelectedChats;')(state,request,async()=>{},()=>{},()=>{});
 const button={disabled:false};await remove(button);
 assert.deepEqual(calls.map(x=>x.length),[50,50,23]);assert.equal(state.rooms.length,0);assert.equal(state.selectedRoomIds.length,0);assert.equal(button.disabled,false);
 state.selectedRoomIds=Array.from({length:73},(_,i)=>String(i));state.rooms=state.selectedRoomIds.map(roomId=>({roomId}));state.chatSelectionMode=true;calls=[];fail=true;await remove(button);
 assert.equal(state.selectedRoomIds.length,23,'failed batch remains selected');assert.equal(state.rooms.length,23,'only confirmed deletes leave the list');assert.equal(button.disabled,false,'retry remains available');
 fail=false;calls=[];await remove(button);assert.equal(state.rooms.length,0);assert.equal(calls[0].length,23,'retry sends only remaining rooms');
 const messages={messages:[{messageId:'1',deliveryState:'sent'}]};
 const merge=Function('chatState',section('function mergeChatReceipts','function mergeChatMessages')+';return mergeChatReceipts;')(messages);
 assert.equal(merge([{messageId:'1',deliveryState:'delivered'}]),true);assert.equal(messages.messages[0].deliveryState,'delivered');assert.equal(merge([{messageId:'1',deliveryState:'delivered'}]),false);assert.equal(merge([{messageId:'1',deliveryState:'read'}]),true);assert.equal(messages.messages[0].deliveryState,'read');
 console.log('Bulk chat deletion and receipt updates: batching, retry, retained selection and sent/delivered/read transitions passed.');
})().catch(error=>{console.error(error);process.exitCode=1;});
