'use strict';
class FeedResponseCache {
  constructor({maxEntries=100,maxBytes=32*1024*1024}={}){this.maxEntries=maxEntries;this.maxBytes=maxBytes;this.bytes=0;this.entries=new Map();this.pending=new Map();}
  delete(key){const item=this.entries.get(key);if(item){this.bytes-=item.bytes;this.entries.delete(key);}}
  get(key,now=Date.now()){
    const item=this.entries.get(key);if(!item)return null;
    if(now>=item.expiresAt){this.delete(key);return null;}
    this.entries.delete(key);this.entries.set(key,item);return item;
  }
  set(key,item){
    this.delete(key);const bytes=Buffer.byteLength(item.body)+Buffer.byteLength(key)+Buffer.byteLength(item.etag)+64;
    if(bytes>this.maxBytes)return;
    while(this.entries.size && (this.entries.size>=this.maxEntries||this.bytes+bytes>this.maxBytes))this.delete(this.entries.keys().next().value);
    this.entries.set(key,{...item,bytes});this.bytes+=bytes;
  }
  pendingEntry(key,create){
    let pending=this.pending.get(key);
    if(!pending){
      if(this.pending.size>=this.maxEntries)return Promise.resolve().then(create);
      pending=Promise.resolve().then(create);
      this.pending.set(key,pending);
      pending.then(
        ()=>{if(this.pending.get(key)===pending)this.pending.delete(key);},
        ()=>{if(this.pending.get(key)===pending)this.pending.delete(key);}
      );
    }
    return pending;
  }
}
module.exports={FeedResponseCache};
