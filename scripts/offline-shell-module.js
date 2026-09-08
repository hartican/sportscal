'use strict';
const fs=require('node:fs');
module.exports=function offlineShellModule(file){
 const worker=fs.readFileSync('service-worker.js','utf8');
 const shell=worker.match(/const APP_SHELL = \[([\s\S]*?)\n\];/)?.[1]||'';
 const paths=[...shell.matchAll(/"([^\"]+)"/g)].map(m=>m[1].split('?')[0]);
 if(paths.includes('/'+file))return true;
 return paths.includes('/assets/js/app-shell-runtime.js') && require('../config/app-shell-modules.json').includes(file)
  && fs.readFileSync('assets/js/app-shell-runtime.js','utf8').includes('\n;/* '+file+' */\n'+fs.readFileSync(file,'utf8'));
};
