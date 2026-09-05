#!/usr/bin/env node
"use strict";
// Local-only, compressed static QA server. No credentials and no API writes.
const http=require("node:http"),fs=require("node:fs"),path=require("node:path"),zlib=require("node:zlib");
const root=path.resolve(__dirname,".."),port=Number(process.env.NS_AUDIT_PORT || 33956);
const types={".html":"text/html",".js":"application/javascript",".json":"application/json",".css":"text/css",".svg":"image/svg+xml",".png":"image/png",".webp":"image/webp",".jpg":"image/jpeg",".ico":"image/x-icon",".woff2":"font/woff2"};
http.createServer(async(req,res)=>{
  const url=new URL(req.url,"http://localhost");
  if(req.method!=="GET"&&req.method!=="HEAD"){res.writeHead(405);return res.end();}
  if(url.pathname.startsWith("/api/")){
    if(!["/api/nothingscore","/api/auth"].includes(url.pathname)){res.writeHead(404);return res.end("{}");}
    try{const upstream=await fetch("https://nothingsport.vercel.app"+url.pathname+url.search);res.writeHead(upstream.status,{"Content-Type":"application/json","Cache-Control":"no-store"});return res.end(await upstream.text());}catch(_error){res.writeHead(503);return res.end("{}");}
  }
  const relative=decodeURIComponent(url.pathname==="/"?"/index.html":url.pathname);
  const file=path.resolve(root,"."+relative);
  if(!file.startsWith(root+path.sep)||relative.includes("/.")||!/^\/(?:assets\/|config\/|data\/|schemas\/|[a-z0-9-]+\.(?:html|js|json|webmanifest)$)/i.test(relative)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);return res.end();}
  const body=fs.readFileSync(file),ext=path.extname(file),compress=/html|javascript|json|css|svg/.test(types[ext]||"")&&/gzip/.test(req.headers["accept-encoding"]||"");
  const output=compress?zlib.gzipSync(body):body;
  res.writeHead(200,{"Content-Type":types[ext]||"application/octet-stream","Content-Length":output.length,"Cache-Control":"no-cache",...(compress?{"Content-Encoding":"gzip"}:{} )});
  res.end(req.method==="HEAD"?undefined:output);
}).listen(port,"127.0.0.1",()=>console.log(`UI audit server http://127.0.0.1:${port}`));
