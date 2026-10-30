'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),policy=require('../config/app-icon-choice');
async function build(){
 const sharp=require('sharp');
 const source=path.join(root,'assets/brand/source/glass-icons-2026-10-30/exports/icons');
 const icons=path.join(root,'icons/brand');
 fs.mkdirSync(icons,{recursive:true});
 const originalManifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.webmanifest')));
 for(const v of policy.VARIANTS){
  const folder=path.join(source,v.id),app=path.join(folder,'app',`nothing-sport-${v.id}-1024x1024.png`);
  for(const size of [180,192,512])await sharp(app).resize(size,size).png().toFile(path.join(icons,`${v.id}-${size}.png`));
  for(const size of [16,32])fs.copyFileSync(path.join(folder,'favicon',`nothing-sport-${v.id}-n-only-${size}x${size}.png`),path.join(icons,`${v.id}-n-${size}.png`));
  const bg=await sharp(path.join(folder,'layers/glass-background-1024.png')).flatten({background:'#0C1010'}).resize(512,512).png().toBuffer();
  const fore=await sharp(path.join(folder,'layers/flat-artwork-1024.png')).resize(358,358).png().toBuffer();
  await sharp(bg).composite([{input:fore,left:77,top:77}]).png().toFile(path.join(icons,`${v.id}-maskable-512.png`));
  const manifest={...originalManifest,id:'/',scope:'/',start_url:'/',icons:[
   ...[192,512].map(size=>({src:`/icons/brand/${v.id}-${size}.png`,sizes:`${size}x${size}`,type:'image/png',purpose:'any'})),
   {src:`/icons/brand/${v.id}-maskable-512.png`,sizes:'512x512',type:'image/png',purpose:'maskable'}
  ]};
  fs.writeFileSync(path.join(icons,`${v.id}.webmanifest`),JSON.stringify(manifest,null,2)+'\n');
 }
 const id=policy.DEFAULT;
 for(const size of [180,192,512])fs.copyFileSync(path.join(icons,`${id}-${size}.png`),path.join(root,`icons/nothingsport-app-${size}.png`));
 fs.copyFileSync(path.join(icons,`${id}-n-32.png`),path.join(root,'icons/nothingsport-app-32.png'));
 fs.copyFileSync(path.join(icons,`${id}-maskable-512.png`),path.join(root,'icons/nothingsport-app-maskable-512.png'));
 await sharp(path.join(source,id,'app',`nothing-sport-${id}-1024x1024.png`)).resize(192,192).png().toFile(path.join(root,'assets/brand/web/nothingsport-app-icon.png'));
 console.log('Built eight glass-tile icon choices; flat artwork and original wordmarks retained.');
}
if(require.main===module)build().catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports=build;
