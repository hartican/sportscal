'use strict';
// Whitelisted STATIC test artifact only. Never deploy the repository checkout.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..'),git=(...args)=>cp.execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
const prefix='/Users/jackhartican/Documents/AI/Codex/public-feed-test-preview-20261026';
const arg=process.argv.find(x=>x.startsWith('--out=')),out=path.resolve(arg?arg.slice(6):path.join(prefix,'build-'+git('rev-parse','--short','HEAD')+'-'+Date.now()));
if(out===root||out.startsWith(root+path.sep))throw Error('Preview output must be outside the source checkout.');
fs.mkdirSync(path.dirname(out),{recursive:true});fs.mkdirSync(out);
const hash=value=>crypto.createHash('sha256').update(value).digest('hex'),files={};
function write(name,value){const target=path.join(out,name);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,value);files[name]=hash(Buffer.isBuffer(value)?value:Buffer.from(value));}
const tracked=cp.execFileSync('git',['ls-files','-z'],{cwd:root,encoding:'utf8'}).split('\0').filter(Boolean);
const allowed=name=>/^(?:assets\/(?:js|styles|icons|brand|identities|providers|fonts)\/|styles\/|config\/)/.test(name)&&/\.(?:js|json|css|svg|png|jpe?g|webp|gif|ico|woff2?|ttf|otf)$/.test(name)&&!/(?:^|\/)(?:admin|owner|comms)[^/]*|\.source\.js$/.test(name)&&name!=='assets/js/app-update.js';
for(const name of tracked.filter(allowed)){const source=path.join(root,name);if(fs.lstatSync(source).isSymbolicLink())throw Error('Symlink forbidden in preview: '+name);write(name,fs.readFileSync(source));}
// Keep the actual current application modules/build settings, while replacing
// only the production builder's fixture/standings INPUTS in this test artifact.
const runtimeBuilder=require('./build-app-shell-runtime'),modules=JSON.parse(fs.readFileSync(path.join(root,'config/app-shell-modules.json'),'utf8'));
const runtimeSource='// Generated TEST runtime with synthetic inputs only\n'+runtimeBuilder.standingsSource([])+runtimeBuilder.pinnedFixtureEditorialSource({})+modules.map(file=>'\n;/* '+file+' */\n'+fs.readFileSync(path.join(root,file),'utf8')+'\n;').join('\n');
const runtime=require('terser').minify_sync(runtimeSource,{compress:{passes:4,global_defs:{module:undefined,require:undefined,NOTHINGSPORTS_DEFER_SETTINGS_COPY:true,NOTHINGSPORTS_SETTINGS_COPY_ONLY:false}},mangle:true,keep_fnames:false,format:{comments:false,ascii_only:true}}).code+'\n';
write('assets/js/app-shell-runtime.js',runtime);
for(const name of ['model.js','bootstrap.js','preview.css'])write('preview/'+name,fs.readFileSync(path.join(root,'preview/public-feed',name)));
const csp="default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; worker-src 'none'; media-src 'none'; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
let html=fs.readFileSync(path.join(root,'index.html'),'utf8');
html=html.replace(/<html([^>]*)>/,'<html$1 data-public-feed-test>').replace(/<title>[\s\S]*?<\/title>/,'<title>Public Feed · TEST MODE</title>');
html=html.replace(/<link\b[^>]*href=["']https?:[^>]*>/g,'').replace(/<link\b[^>]*rel=["']manifest["'][^>]*>/g,'').replace(/<script\b[^>]*src=["']\/?assets\/js\/app-update\.js[^"']*["'][^>]*><\/script>/g,'');
html=html.replace(/<meta\b[^>]*(?:property|name)=["'](?:og:url|twitter:url)["'][^>]*>/g,'');
const injected='<meta http-equiv="Content-Security-Policy" content="'+csp+'"><meta name="robots" content="noindex,nofollow,noarchive"><meta name="referrer" content="no-referrer"><meta name="public-feed-test" content="synthetic-only"><link rel="stylesheet" href="/preview/preview.css"><script src="/config/public-comments.js"></script><script src="/config/epic-classics.js"></script><script src="/preview/model.js"></script><script src="/preview/bootstrap.js"></script>';
html=html.replace(/<head>/,'<head>'+injected).replace(/<body([^>]*)>/,'<body$1><p id="test-loading">PUBLIC FEED · TEST MODE · Loading synthetic fixtures…</p>');
write('index.html',html);write('app-version.json',fs.readFileSync(path.join(root,'app-version.json')));
write('data/events.js','globalThis.EVENTS=[];globalThis.EVENTS_META={testMode:true};\n');
// Original synthetic animation: small palette/GIF frames, no downloaded media.
function gif(label){
 const width=120,height=80,palette=[7,21,16,214,255,66,255,255,255,52,106,76,62,150,95,20,44,33,255,180,70,105,190,255],parts=[Buffer.from('GIF89a'),Buffer.from([width,0,height,0,0xf2,0,0]),Buffer.from(palette),Buffer.from([0x21,0xff,11]),Buffer.from('NETSCAPE2.0'),Buffer.from([3,1,0,0,0])];
 const glyphs={G:['01110','10000','10111','10001','01110'],O:['01110','10001','10001','10001','01110'],W:['10001','10001','10101','10101','01010'],A:['01110','10001','11111','10001','10001'],C:['01111','10000','10000','10000','01111'],L:['10000','10000','10000','10000','11111'],P:['11110','10001','11110','10000','10000'],'!':['00100','00100','00100','00000','00100']};
 const text=label==='cheer'?'GO!':label==='wow'?'WOW':'CLAP';
 for(let frame=0;frame<3;frame++){const pixels=Array(width*height).fill(0);for(let y=5;y<75;y++)for(let x=5;x<115;x++)if(x<9||x>110||y<9||y>70)pixels[y*width+x]=1+frame;
  const scale=3,origin=Math.floor((width-text.length*18)/2);[...text].forEach((char,i)=>glyphs[char].forEach((row,y)=>[...row].forEach((bit,x)=>{if(bit==='1')for(let dy=0;dy<scale;dy++)for(let dx=0;dx<scale;dx++)pixels[(27+y*scale+dy)*width+origin+i*18+x*scale+dx]=frame?2:1;})));
  const codes=[];for(let i=0;i<pixels.length;i+=5)codes.push(8,...pixels.slice(i,i+5));codes.push(9);const packed=[];for(let i=0;i<codes.length;i+=2)packed.push(codes[i]|((codes[i+1]||0)<<4));const blocks=[];for(let i=0;i<packed.length;i+=255)blocks.push(Buffer.from([Math.min(255,packed.length-i)]),Buffer.from(packed.slice(i,i+255)));
  parts.push(Buffer.from([0x21,0xf9,4,0,24,0,0,0,0x2c,0,0,0,0,width,0,height,0,0,3]),...blocks,Buffer.from([0]));
 }parts.push(Buffer.from([0x3b]));return Buffer.concat(parts);
}
for(const name of ['cheer','wow','clap'])write('preview/gifs/'+name+'.gif',gif(name));
write('vercel.json',JSON.stringify({version:2,framework:null,buildCommand:null,headers:[{source:'/(.*)',headers:[{key:'Content-Security-Policy',value:csp},{key:'X-Robots-Tag',value:'noindex, nofollow, noarchive'},{key:'Cache-Control',value:'no-store'},{key:'Referrer-Policy',value:'no-referrer'},{key:'Permissions-Policy',value:'camera=(), microphone=(), geolocation=(), payment=(), notifications=()'},{key:'X-Content-Type-Options',value:'nosniff'},{key:'X-Frame-Options',value:'DENY'}]}]},null,2)+'\n');
const receipt={schemaVersion:'public-feed-test-artifact.v1',mode:'TEST',sha:git('rev-parse','HEAD'),tree:git('rev-parse','HEAD^{tree}'),dirty:git('status','--porcelain'),builtAt:new Date().toISOString(),files,runtimeInputs:{builder:hash(fs.readFileSync(path.join(root,'scripts/build-app-shell-runtime.js'))),modules:Object.fromEntries(modules.map(file=>[file,hash(fs.readFileSync(path.join(root,file)))])),standings:[],pinnedEditorial:{}},capabilities:['actual-shared-fixture-card','actual-public-comment-tray','registered-test-accounts','text-emoji-gif','one-level-replies','changeable-up-down-votes','live-local-polling','followed-author-run-demo','settings','browser-persistence-reset','seven-day-test-clock','top-three-text-only-yearbook','actual-yearbook-ui-export','privacy-erasure-demo'],limitations:['Synthetic browser model, not SQL/API/Auth correctness','No real sign-in, notifications, provider requests, customer data, multi-device sync or production service worker','Bundled synthetic GIFs, not a live GIPHY catalogue','Requires dedicated HTTPS preview origin; never a production alias','Physical iPhone Safari trial remains user acceptance'],sourceContract:'docs/plans/public-feed-2026-10-22.md'};
write('preview-manifest.json',JSON.stringify(receipt,null,2)+'\n');
console.log(JSON.stringify({out,sha:receipt.sha,dirty:!!receipt.dirty,fileCount:Object.keys(files).length,manifestSha256:hash(fs.readFileSync(path.join(out,'preview-manifest.json')))}));
