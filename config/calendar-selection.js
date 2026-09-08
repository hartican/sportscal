(function(root,factory){const api=factory();root.NOTHINGSPORTS_CALENDAR_SELECTION=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;})(globalThis,function(){
  'use strict';
  async function selectBatch(events,{included=new Set(),excluded=new Set(),refs=new Map(),selected=true,idFor,knownDate,signal,onProgress=()=>{},yieldTask=()=>new Promise(resolve=>setTimeout(resolve,0)),batchSize=128}={}){
    const next={included:new Set(included),excluded:new Set(excluded),refs:new Map(refs)};
    for(let offset=0;offset<events.length;offset+=batchSize){
      signal?.throwIfAborted();
      for(const event of events.slice(offset,offset+batchSize)){
        if(!knownDate(event))continue;
        const id=idFor(event);if(!id)continue;next.refs.set(id,event);
        if(selected){next.included.add(id);next.excluded.delete(id);}else{next.excluded.add(id);next.included.delete(id);}
      }
      onProgress(Math.min(events.length,offset+batchSize),events.length);await yieldTask();
    }
    signal?.throwIfAborted();return next;
  }
  return {selectBatch};
});
