'use strict';
const fs=require('node:fs'),path=require('node:path');
function sanitise(value){
 if(typeof value==='string'){
  for(const [key,secret]of Object.entries(process.env))if(/TOKEN|SECRET|PASSWORD|SERVICE_ROLE|API_KEY/.test(key)&&secret.length>=8)value=value.split(secret).join('[redacted]');
  return value.replace(/https?:\/\/[^\s"<>]+/g,raw=>{try{const url=new URL(raw);url.username='';url.password='';url.search='';url.hash='';return url.href;}catch{return '[invalid-url]';}}).replace(/(?:gh[pousr]_|sb_secret_)[A-Za-z0-9_-]+/g,'[redacted]').slice(0,1500);
 }
 if(Array.isArray(value))return value.slice(0,1000).map(sanitise);
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([key])=>!/^token|secret|password|authorization$/i.test(key)).map(([key,item])=>[key,sanitise(item)]));
 return value;
}
function update(patch,{file=process.env.REFRESH_REPORT}={}){
 if(!file)return;
 let previous={schemaVersion:'canonical-refresh-report.v1',sourceFailures:[],missingResults:[]};
 try{previous=JSON.parse(fs.readFileSync(file,'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
 const next=sanitise({...previous,...patch,updatedAt:new Date().toISOString()});fs.mkdirSync(path.dirname(file),{recursive:true});
 const temporary=file+'.tmp-'+process.pid;fs.writeFileSync(temporary,JSON.stringify(next,null,2)+'\n',{mode:0o600});fs.renameSync(temporary,file);return next;
}
module.exports={update,sanitise};
