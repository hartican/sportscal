"use strict";
const fs=require('node:fs'),path=require('node:path');
const document=require('../data/canonical/athlete-participation.v1.json');
require('../lib/athlete-participation').materializeParticipation(document);
const file=path.join(__dirname,'../data/canonical/athlete-participation.v1.js');
const content=`globalThis.NOTHINGSPORTS_ATHLETE_PARTICIPATION=${JSON.stringify(document)};\n`;
if(!fs.existsSync(file)||fs.readFileSync(file,'utf8')!==content){
  if(process.argv.includes('--check'))throw new Error('Athlete participation browser snapshot is stale');
  fs.writeFileSync(file,content);
}
console.log('Athlete participation: verified entries and browser history snapshot ready.');
