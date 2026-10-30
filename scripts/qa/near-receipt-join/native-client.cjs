'use strict';
// Linux CI native transport only. Requiring this file does not spawn a process.
const {spawn}=require('node:child_process'),crypto=require('node:crypto');
const literal=v=>v===null||v===undefined?'null':typeof v==='boolean'?(v?'true':'false'):typeof v==='number'?(Number.isFinite(v)?String(v):(()=>{throw Error('Nonfinite SQL number');})()):"'"+String(v).replace(/'/g,"''")+"'";
class Client{
 constructor(database,limits){
  const binding=limits.binding(database);if(database!=='postgres'&&!/^ns_near_receipt_(17|18)_[a-f0-9]{12}_(perf|checks)$/.test(database))throw Error('Unexpected isolated database');
  this.limits=limits;this.database=database;this.closed=false;this.active=null;this.buffer='';
  if(!/^[a-f0-9]{64}$/.test(binding.cid)||![17,18].includes(binding.major))throw Error('Unverified isolated container');
  this.child=spawn('/usr/bin/docker',['--host','unix:///var/run/docker.sock','exec','-i','-u','postgres',binding.cid,'/usr/bin/env','-i','PATH=/usr/bin:/bin','LANG=C.UTF-8','PGHOST=/var/run/postgresql','PGPORT=5432','PGUSER=postgres','PGDATABASE='+database,'PGPASSFILE=/dev/null','PGSERVICEFILE=/dev/null','/usr/lib/postgresql/'+binding.major+'/bin/psql','-X','-h','/var/run/postgresql','-p','5432','-U','postgres','-d',database,'-qAt','-P','pager=off','-v','VERBOSITY=verbose'],{env:binding.env,stdio:['pipe','pipe','pipe']});
  limits.processControl.track(this.child);this.child.stdout.setEncoding('utf8');this.child.stderr.setEncoding('utf8');
  this.child.stdout.on('data',s=>{this.buffer+=s;this.drain();});this.child.stderr.on('data',s=>{this.buffer+=s;this.drain();});
  const ended=(error)=>{this.closed=true;if(this.active){clearTimeout(this.active.timer);this.active.reject(error);this.active=null;}};
  this.child.on('error',ended);this.child.on('exit',(code,signal)=>ended(Error('Owned native client ended: '+code+'/'+signal)));
 }
 drain(){
  if(this.buffer.length>40*1024*1024){this.abort('Native output exceeded 40MiB');return;}
  const p=this.active;if(!p)return;const at=this.buffer.indexOf(p.marker);if(at<0)return;const end=this.buffer.indexOf('\n',at);if(end<0)return;
  const text=this.buffer.slice(0,at).trim(),status=this.buffer.slice(at+p.marker.length,end).trim();this.buffer=this.buffer.slice(end+1);this.active=null;clearTimeout(p.timer);
  const error=text.match(/(?:^|\n)(?:ERROR|FATAL):\s+(?:([0-9A-Z]{5}):\s*)?([^\n]+)/);
  if(error||status!=='00000'){const e=Error(error?.[2]||'Native SQLSTATE '+status);e.code=error?.[1]||status;e.nativeOutput=text;p.reject(e);}else p.resolve(text);
 }
 abort(message){if(this.active){clearTimeout(this.active.timer);this.active.reject(Error(message));this.active=null;}this.child.kill('SIGKILL');}
 command(sql,{cleanup=false}={}){
  this.limits.check(cleanup);if(this.closed||this.active)throw Error('Owned native client unavailable or already busy');
  if(/(?:^|\n)\s*\\(?:!|include|i|connect|c|copy|o|out|w|gexec|setenv)\b/i.test(sql))throw Error('psql external/file escape refused');
  const marker='__NE_'+crypto.randomBytes(12).toString('hex')+'__';
  return new Promise((resolve,reject)=>{const timer=setTimeout(()=>this.abort('Native client host ceiling 7500ms'),7500);this.active={marker,resolve,reject,timer};this.child.stdin.write(sql+';\n\\echo '+marker+' :SQLSTATE\n');});
 }
 async exec(sql,options){await this.command(sql,options);}
 async query(sql,options){const t=await this.command("SELECT coalesce(json_agg(row_to_json(q)),'[]'::json) FROM ("+sql.replace(/;\s*$/,'')+') q',options);return JSON.parse(t.replace(/^NOTICE:[^\n]*\n/gm,'').trim());}
 async close(){
  if(this.limits.processControl.status(this.child).confirmed)return this.limits.processControl.status(this.child);
  if(this.active)this.abort('Closing owned active client');else if(!this.closed)this.child.stdin.end('\\q\n');
  return await this.limits.processControl.settle(this.child,{graceMs:1500,forceMs:1500});
 }
}
module.exports={Client,literal};
