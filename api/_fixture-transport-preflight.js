'use strict';
const fs=require('node:fs'),crypto=require('node:crypto');
module.exports=async(req,res)=>{
 res.setHeader('Cache-Control','private, no-store');
 const nonce=String(req.headers.authorization||'').replace(/^Bearer /,'');
 if(req.method!=='POST'||crypto.createHash('sha256').update(nonce).digest('hex')!=='db54347c14515ee73cc69428b9d8047114c7efc6aeb72500420ffb7ad57ee6d9'){res.statusCode=404;return res.end();}
 const output='/tmp/fixture-transport-proof.json';
 try{const proof=await require('../lib/fixture-transport-preflight').run({scope:require('../lib/fixture-transport-public-scope.json'),output});res.statusCode=200;res.end(JSON.stringify(proof));}
 catch(_){res.statusCode=503;res.end(fs.existsSync(output)?fs.readFileSync(output):JSON.stringify({passed:false,diagnosticOnly:true}));}
};
