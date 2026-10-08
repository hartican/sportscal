"use strict";
let searchRecords=null;
self.addEventListener("message",event=>{
  const id=event.data?.id;
  try{
    if(event.data.kind==='search-init'){
      importScripts('football-directory.js?v=463','participant-directory.js?v=463');
      searchRecords=NOTHINGSPORTS_PARTICIPANT_DIRECTORY.unpack(JSON.parse(event.data.text));
      self.postMessage({id,ready:true,count:searchRecords.length});return;
    }
    if(event.data.kind==='search'){
      if(!searchRecords)throw Error('Participant search is not ready');
      const scored=searchRecords.map(record=>({record,score:NOTHINGSPORTS_FOOTBALL_DIRECTORY.searchMatchScore(record,event.data.query)})).filter(row=>Number.isFinite(row.score)).sort((a,b)=>a.score-b.score||a.record.displayName.localeCompare(b.record.displayName,'en-AU',{sensitivity:'base'}));
      self.postMessage({id,records:scored.slice(0,Math.min(200,event.data.limit||40)).map(row=>row.record),total:scored.length});return;
    }
    const chunk=JSON.parse(String(event.data?.text||""));
    if(!chunk||typeof chunk!=="object"||!Array.isArray(chunk.records))throw new Error("Invalid Follow directory data");
    self.postMessage({id,chunk});
  }catch(error){self.postMessage({id,error:error?.message||"Follow directory parsing failed"});}
});
