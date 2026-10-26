(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.NOTHINGSPORTS_PUBLIC_COMMENTS=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const SCHEMA_VERSION='public-comments.v1';
 const LIMITS=Object.freeze({text:500,page:25,replyPreview:3,changes:100,commentsPerMinute:30,votesPerMinute:120,gifMinimumPoints:25});
 const POLLING=Object.freeze({active:1000,quiet:30000,quietAfter:60000,failure:30000});
 const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
 function text(value){if(typeof value!=='string')return '';const clean=value.normalize('NFC').replace(/\r\n?/g,'\n').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g,'').trim();if(Array.from(clean).length>LIMITS.text)throw new Error('Comments can contain up to 500 characters.');return clean;}
 function vote(value){if(!Number.isInteger(value)||![-1,0,1].includes(value))throw new Error('Choose an upvote, downvote or remove your vote.');return value;}
 function compare(a,b){return Number(b.score||0)-Number(a.score||0)||String(a.createdAt||a.created_at||'').localeCompare(String(b.createdAt||b.created_at||''))||String(a.id).localeCompare(String(b.id));}
 function topThree(entries){return entries.filter(e=>!e.deleted&&typeof e.body==='string'&&e.body.trim()&&e.handle).sort(compare).slice(0,3).map(e=>({id:e.id,handle:e.handle,body:text(e.body),score:Number(e.score)||0}));}
 function nextRun(previous,comment,{followed,recipient}={}){const author=comment.authorId;if(!author||author===recipient||!followed?.has(author)||comment.deleted)return{previous,notify:false};return{previous:author,notify:previous!==author};}
 function pollDelay(lastChange,now=Date.now()){return now-lastChange>=POLLING.quietAfter?POLLING.quiet:POLLING.active;}
 return Object.freeze({SCHEMA_VERSION,LIMITS,POLLING,uuid,text,vote,compare,topThree,nextRun,pollDelay});
});
