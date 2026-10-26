'use strict';
// Static data-channel framing only. No tools, processes, credentials or I/O.
// Keep the one extracted outer packet; never stringify/join its full envelope.
const MAX_WIRE=56*1024*1024,CHUNK=4*1024*1024,MAX_BASE64=4*Math.ceil(4194304/3);
function requireValue(ok){if(!ok)throw Error('PUBLIC_STATE_INPUT_FRAME');}
function keys(value,names){requireValue(value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join('|')===names.split(' ').sort().join('|'));}
function ascii(value){requireValue(!/[^\x00-\x7f]/.test(value));return value;}
function prefix(packet){return ascii(JSON.stringify({status:packet.status,manifest_text:packet.manifest_text,manifest_md5:packet.manifest_md5}).slice(0,-1)+',"parts":[');}
function head(part){return ascii(JSON.stringify({name:part.name,bytes:part.bytes,rows:part.rows,md5:part.md5}).slice(0,-1)+',"data_base64":"');}
function size(packet){
 keys(packet,'status manifest_text manifest_md5 parts');
 requireValue(typeof packet.status==='string'&&typeof packet.manifest_text==='string'&&packet.manifest_text.length<=65536&&typeof packet.manifest_md5==='string'&&Array.isArray(packet.parts)&&packet.parts.length<=16);
 let bytes=prefix(packet).length+2;
 for(const [index,part]of packet.parts.entries()){
  keys(part,'name bytes rows md5 data_base64');
  requireValue(typeof part.name==='string'&&Number.isSafeInteger(part.bytes)&&part.bytes>=1&&part.bytes<=4194304&&Number.isSafeInteger(part.rows)&&part.rows>=1&&typeof part.md5==='string');
  requireValue(typeof part.data_base64==='string'&&part.data_base64.length<=MAX_BASE64&&!/[^A-Za-z0-9+/=]/.test(part.data_base64));
  bytes+=(index?1:0)+head(part).length+part.data_base64.length+2;
  requireValue(bytes<=MAX_WIRE);
 }
 requireValue(bytes>0&&bytes<=MAX_WIRE);return bytes;
}
function* slices(value){for(let at=0;at<value.length;at+=CHUNK)yield value.slice(at,at+CHUNK);}
function* chunks(packet){
 size(packet);yield* slices(prefix(packet));
 for(const [index,part]of packet.parts.entries()){
  if(index)yield ',';
  yield* slices(head(part));yield* slices(part.data_base64);yield '"}';
 }
 yield ']}';
}
module.exports={size,chunks};
