"use strict";
// Defence in depth only. The trusted controller must enforce an independent OS boundary.
const fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto"),Module=require("node:module");
const root=process.env.NS_WITHDRAWAL_QUAL_ROOT,report=process.env.NS_WITHDRAWAL_QUAL_REPORT_DIR,binding=process.env.NS_WITHDRAWAL_QUAL_BINDING;
if(root!=="/work"||report!=="/work/report"||binding!=="/work/binding.json"||process.env.NS_WITHDRAWAL_QUAL_REQUEST_ID!=="ns-withdrawal-qual-v1-20261108-01")throw Error("UNRUN: invalid paths or request");
const st=fs.lstatSync(binding);if(!st.isFile()||st.isSymbolicLink()||st.size>131072)throw Error("UNRUN: invalid binding");
const b=JSON.parse(fs.readFileSync(binding,"utf8"));
if(b.requestId!=="ns-withdrawal-qual-v1-20261108-01"||b.candidate!=="aa14b59c844695d57a312d60c4ac741dfca57752"||!Array.isArray(b.files))throw Error("UNRUN: invalid binding metadata");
// This cannot authenticate the controller or establish container isolation.
const base=fs.realpathSync("/candidate");if(base!=="/candidate")throw Error("UNRUN: candidate root");
const closurePath="/candidate-binding/dependency-closure.v2.json";
const closureBytes=fs.readFileSync(closurePath);if(crypto.createHash("sha256").update(closureBytes).digest("hex")!=="43460d1c106ab22f1975ffa5bc00f314bd8cd4c89cdd1aa25757d8cfe9b57f45")throw Error("UNRUN: closure changed");
const closure=JSON.parse(closureBytes),expected=new Map(closure.files.map(x=>[x.path,x]));
const harness=["scripts/validate-retired-horse-official-results.js","scripts/validate-retired-horse-reviewed-evidence.js","scripts/validate-retired-horse-reminder-catalogue.js","scripts/validate-retired-horse-reminder-decisions.js","scripts/validate-retired-horse-joined-qualification.js","scripts/fixtures/retired-horse-publisher-input.v1.json","scripts/fixtures/retired-horse-joined-qualification.v1.json","scripts/lib/retired-horse-qualification-guards.js"];
if(b.files.length!==expected.size+harness.length)throw Error("UNRUN: incorrect bound file count");
if(!b.harnessManifestSha256||!/^[0-9a-f]{64}$/.test(b.harnessManifestSha256))throw Error("UNRUN: manifest pin missing");
const manifestBytes=fs.readFileSync("/candidate-binding/harness-manifest.v2.json");
if(crypto.createHash("sha256").update(manifestBytes).digest("hex")!==b.harnessManifestSha256)throw Error("UNRUN: manifest hash differs");
const manifest=JSON.parse(manifestBytes),harnessPins=new Map(manifest.files.map(x=>[x.path,x]));
if(harnessPins.size!==harness.length)throw Error("UNRUN: harness pin count");
const allow=new Set();for(const item of b.files){
 if(!item||typeof item.path!=="string"||item.path.startsWith("/")||item.path.split("/").some(x=>!x||x==="."||x==="..")||allow.has(item.path))throw Error("UNRUN: invalid bound path");
 const c=expected.get(item.path);if(!c&&!harness.includes(item.path))throw Error("UNRUN: unlisted source");
 if(c&&(c.sha256!==item.sha256||c.bytes!==item.bytes))throw Error("UNRUN: candidate pin differs");
 if(!c){const h=harnessPins.get(item.path);if(!h||h.sha256!==item.sha256||h.bytes!==item.bytes)throw Error("UNRUN: harness pin differs");}
 const full=path.join(base,item.path),stat=fs.lstatSync(full);if(!stat.isFile()||stat.isSymbolicLink()||fs.realpathSync(full)!==full||stat.size!==item.bytes)throw Error("UNRUN: source identity");
 if(crypto.createHash("sha256").update(fs.readFileSync(full)).digest("hex")!==item.sha256)throw Error("UNRUN: source hash");allow.add(item.path);
}
for(const p of [...expected.keys(),...harness])if(!allow.has(p))throw Error("UNRUN: missing bound source");
let violationCount=0;
const deny=()=>{violationCount++;throw Error("Qualification guard denied operation");};
module.exports=Object.freeze({violations:()=>violationCount});
const builtins=new Set(["assert","assert/strict","buffer","child_process","cluster","crypto","dgram","dns","fs","http","http2","https","module","net","os","path","tls","url","util","worker_threads"]);
const resolve=Module._resolveFilename;Module._resolveFilename=function(request,parent,...args){
 const id=String(request).replace(/^node:/,"");if(Module.builtinModules.includes(id)||Module.builtinModules.includes("node:"+id)){if(!builtins.has(id))return deny();try{return resolve.call(this,request,parent,...args);}catch(error){return deny();}}
 let file;try{file=resolve.call(this,request,parent,...args);}catch(error){return deny();}if(typeof file!=="string"||!file.startsWith(base+"/")||!allow.has(path.relative(base,file))||!(/\.(js|json)$/.test(file)))return deny();let real;try{real=fs.realpathSync(file);}catch(error){return deny();}if(real!==file)return deny();return file;
};
for(const name of ["node:net","node:tls","node:dgram","node:dns","node:http","node:https","node:http2","node:child_process","node:cluster","node:worker_threads"]){const mod=require(name);for(const key of ["connect","createConnection","createServer","request","get","lookup","resolve","createSocket","spawn","spawnSync","exec","execSync","execFile","execFileSync","fork","Worker"])if(typeof mod[key]==="function")mod[key]=deny;}
globalThis.fetch=deny;
const originalWrite=fs.writeFileSync;fs.writeFileSync=function(file,value,options){if(file!=="/work/report/qualification.json"||!options||options.flag!=="wx")return deny();return originalWrite.call(this,file,value,options);};
for(const key of ["appendFileSync","truncateSync","unlinkSync","mkdirSync","rmSync","rmdirSync","renameSync","copyFileSync","symlinkSync","linkSync","chmodSync","chownSync","writeFile","appendFile","truncate","unlink","mkdir","rm","rmdir","rename","copyFile","symlink","link","chmod","chown","open","createWriteStream"])if(typeof fs[key]==="function")fs[key]=deny;
if(fs.promises)for(const key of ["writeFile","appendFile","truncate","unlink","mkdir","rm","rmdir","rename","copyFile","symlink","link","chmod","chown","open"])if(typeof fs.promises[key]==="function")fs.promises[key]=deny;
// Do not override openSync: Node's writeFileSync(wx) must be able to open the
// one allowed report. Actual write confinement is the external OS boundary.
