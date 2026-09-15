"use strict";
self.addEventListener("message",event=>{
  const id=event.data?.id;
  try{
    const chunk=JSON.parse(String(event.data?.text||""));
    if(!chunk||typeof chunk!=="object"||!Array.isArray(chunk.records))throw new Error("Invalid Follow directory data");
    self.postMessage({id,chunk});
  }catch(error){self.postMessage({id,error:error?.message||"Follow directory parsing failed"});}
});
