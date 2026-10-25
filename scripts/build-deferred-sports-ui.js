'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),terser=require('terser'),root=path.resolve(__dirname,'..');
const modules={
 'assets/js/account-awareness-runtime.js':['config/account-awareness.js','config/account-sync-diagnostic.js','config/preference-intent-reconcile.js','assets/js/account-awareness-ui.js','assets/js/account-indicator-app.js'],
 'assets/js/match-centre-ui.js':['assets/js/match-centre-ui.source.js'],
 'assets/js/all-sports-ui.js':['config/all-sports-view.js','assets/js/all-sports-ui.source.js'],
 'assets/js/milestone-alerts-ui.js':['config/milestone-preferences.js','config/milestone-test-fixture.js','assets/js/milestone-alerts-ui.source.js'],
 'assets/js/app-update.js':['assets/js/app-update.source.js'],
 'assets/js/notifications-inbox.js':['assets/js/notifications-inbox.source.js'],
};
function build({check=false}={}){for(const [target,inputs] of Object.entries(modules)){
 const source=inputs.map(file=>fs.readFileSync(path.join(root,file),'utf8')).join('\n;\n');
 const standalone=target==='assets/js/app-update.js'||target==='assets/js/notifications-inbox.js';
 const output=terser.minify_sync(source,standalone?{compress:false,mangle:false,format:{comments:false,ascii_only:true}}:{compress:{passes:4,global_defs:{module:undefined}},mangle:true}).code+'\n';
 if(check)assert.equal(fs.readFileSync(path.join(root,target),'utf8'),output,'Deferred sports UI is stale: '+target);
 else fs.writeFileSync(path.join(root,target),output);
}}
if(require.main===module)build({check:process.argv.includes('--check')});
module.exports={build,modules};
