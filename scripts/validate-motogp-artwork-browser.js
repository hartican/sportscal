#!/usr/bin/env node
'use strict';
// Rasterise the shipped SVGs independently in both engines: transparent holes
// are a product requirement, not merely an SVG file-format check.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium,webkit}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assets=require('../assets/identities/motogp/asset-manifest.json').assets.filter(a=>a.presentation==='track-outline');
const base=process.env.REPAIR_QA_URL||'http://127.0.0.1:33956',out=process.env.MOTOGP_QA_OUTPUT||'/tmp/motogp-qa';
(async()=>{
 const rows=[];
 for(const [name,engine]of[['chromium',chromium],['webkit',webkit]]){
  const browser=await engine.launch({headless:true,...(name==='chromium'?{channel:'chrome'}:{})});
  try{
   const page=await browser.newPage({serviceWorkers:'block'});await page.goto(base,{waitUntil:'domcontentloaded'});
   for(const asset of assets){
    const result=await page.evaluate(async url=>{
     const image=new Image();image.src=url;await image.decode();const w=400,h=300,canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
     const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0,w,h);const rgba=ctx.getImageData(0,0,w,h).data,ink=new Uint8Array(w*h),seen=new Uint8Array(w*h);
     let opaque=0,nonWhite=0;for(let i=0;i<ink.length;i++){ink[i]=rgba[i*4+3]>=128?1:0;if(ink[i]){opaque++;if(rgba[i*4]<250||rgba[i*4+1]<250||rgba[i*4+2]<250)nonWhite++;}}
     const queue=new Int32Array(w*h);function area(start){let head=0,tail=1;queue[0]=start;seen[start]=1;while(head<tail){const i=queue[head++],x=i%w,y=Math.floor(i/w);for(const n of[x>0?i-1:-1,x<w-1?i+1:-1,y>0?i-w:-1,y<h-1?i+w:-1])if(n>=0&&!seen[n]&&!ink[n]){seen[n]=1;queue[tail++]=n;}}return tail;}
     // Mark the exterior from every edge so disconnected margins cannot be
     // mistaken for a transparent enclosed circuit interior.
     for(let i=0;i<w*h;i++)if((i<w||i>=w*(h-1)||i%w===0||i%w===w-1)&&!seen[i]&&!ink[i])area(i);
     let largestHole=0;for(let i=0;i<ink.length;i++)if(!seen[i]&&!ink[i])largestHole=Math.max(largestHole,area(i));
     return{opaqueFraction:opaque/(w*h),interiorFraction:largestHole/(w*h),nonWhite,corners:[0,w-1,w*(h-1),w*h-1].map(i=>rgba[i*4+3])};
    },asset.path);
    assert(result.opaqueFraction>0.01&&result.opaqueFraction<0.3,`${name} ${asset.id}: track-only linework must not become a filled footprint`);
    assert(result.interiorFraction>0.04,`${name} ${asset.id}: enclosed circuit area must remain transparent`);
    assert.deepEqual(result.corners,[0,0,0,0],`${asset.id}: exterior transparency`);assert.equal(result.nonWhite,0,`${asset.id}: monochrome white`);
    rows.push({engine:name,id:asset.id,...result});
   }
  }finally{await browser.close();}
 }
 fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'artwork-transparency.json'),JSON.stringify(rows,null,2)+'\n');
 console.log(`MotoGP artwork: ${assets.length} track-only SVGs passed interior/exterior transparency and white linework checks in Chromium/WebKit.`);
})().catch(error=>{console.error(error);process.exitCode=1;});
