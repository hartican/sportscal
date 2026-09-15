#!/usr/bin/env node

"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");

const [revision, destinationArg, mode] = process.argv.slice(2);
if (!revision || !destinationArg){
  console.error("Usage: node scripts/materialize-git-tree.js <commit> <destination>");
  process.exit(2);
}

const destination = path.resolve(destinationArg);
const sourceRoot = process.cwd();
const policy = mode === '--deployment' ? require('../config/deployment-manifest.json') : null;
const retained = name => !name.includes('supabase_keys.txt') && !name.split('/').some(part=>part.startsWith('.env')) && (!policy || (
  !policy.excludeDirectories.some(prefix=>name.startsWith(prefix)) && !policy.excludeFiles.includes(name) &&
  (policy.includeDirectories.some(prefix=>name.startsWith(prefix)) || policy.includeFiles.includes(name) || (!name.includes('/') && policy.rootExtensions.includes(path.extname(name))))
));
fs.mkdirSync(destination, { recursive: true });

function gitBlobOid(content){
  return crypto.createHash("sha1")
    .update(`blob ${content.length}\0`)
    .update(content)
    .digest("hex");
}

function verifiedWorkingTreeContent(entry){
  const sourcePath = path.resolve(sourceRoot, ...entry.name.split("/"));
  if (sourcePath !== sourceRoot && !sourcePath.startsWith(`${sourceRoot}${path.sep}`)) return null;
  try{
    const stat = fs.lstatSync(sourcePath);
    const content = entry.mode === "120000" && stat.isSymbolicLink()
      ? Buffer.from(fs.readlinkSync(sourcePath))
      : stat.isFile()
        ? fs.readFileSync(sourcePath)
        : null;
    return content && gitBlobOid(content) === entry.oid ? content : null;
  }catch(_error){
    return null;
  }
}

const tree = execFileSync("git", ["ls-tree", "-rz", "--full-tree", revision], {
  encoding: null,
  maxBuffer: 64 * 1024 * 1024,
});
const entries = tree.toString("utf8").split("\0").filter(Boolean).map(record => {
  const separator = record.indexOf("\t");
  if (separator < 0) throw new Error(`Invalid git tree record: ${record}`);
  const [mode, type, oid] = record.slice(0, separator).split(" ");
  const name = record.slice(separator + 1);
  const normalized = path.posix.normalize(name);
  if (!name || path.posix.isAbsolute(name) || normalized === ".." || normalized.startsWith("../")){
    throw new Error(`Unsafe git tree path: ${name}`);
  }
  if (!['blob', 'commit'].includes(type)) throw new Error(`Unsupported git tree entry ${type}: ${name}`);
  return { mode, type, oid, name };
});
const byName=new Map(entries.map(e=>[e.name,e]));
const selected=new Set(entries.filter(e=>e.type==='blob'&&retained(e.name)).map(e=>e.name));
// Some live adapters import parsers under scripts/. Include their local dependency closure.
if(policy){
  for(const name of selected){
    if(!name.endsWith('.js'))continue;
    const entry=byName.get(name);
    const source=(verifiedWorkingTreeContent(entry)||execFileSync('git',['cat-file','blob',entry.oid],{maxBuffer:64*1024*1024})).toString();
    for(const match of source.matchAll(/require\(\s*['"](\.[^'"]+)['"]\s*\)/g)){
      const base=path.posix.normalize(path.posix.join(path.posix.dirname(name),match[1]));
      const dependency=[base,base+'.js',base+'.json',base+'/index.js'].find(p=>byName.has(p));
      if(dependency){
        if(dependency.includes('supabase_keys.txt')||dependency.split('/').some(p=>p.startsWith('.env')))throw new Error('Runtime dependency refers to excluded secret');
        selected.add(dependency);
      }
    }
  }
}
const blobs = entries.filter(entry => entry.type === "blob" && selected.has(entry.name));
const inventory=[];

blobs.forEach(entry => {
  const outputPath = path.resolve(destination, ...entry.name.split("/"));
  if (outputPath !== destination && !outputPath.startsWith(`${destination}${path.sep}`)) throw new Error(`Unsafe output path: ${entry.name}`);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  // Reuse only bytes whose Git blob SHA matches this commit. Changed files
  // fall back to isolated object reads, avoiding bulk packed-object SIGBUS.
  let content = verifiedWorkingTreeContent(entry) || execFileSync("git", ["cat-file", "blob", entry.oid], {
      encoding: null,
      maxBuffer: 64 * 1024 * 1024,
    });
  if(gitBlobOid(content)!==entry.oid)throw new Error(`Blob verification failed: ${entry.name}`);
  const sourceBytes=content.length;
  const compact=policy?.compactJson && entry.name.endsWith('.json') && !policy.preserveBytes.includes(entry.name);
  if(compact)content=Buffer.from(JSON.stringify(JSON.parse(content))+'\n');
  inventory.push({path:entry.name,gitBlob:entry.oid,sourceBytes,bytes:content.length,transform:compact?'json-compact':'identity',sha256:crypto.createHash('sha256').update(content).digest('hex')});
  if (entry.mode === "120000") fs.symlinkSync(content.toString("utf8"), outputPath);
  else {
    fs.writeFileSync(outputPath, content, { mode: entry.mode === "100755" ? 0o755 : 0o644 });
    fs.chmodSync(outputPath, entry.mode === "100755" ? 0o755 : 0o644);
  }
});
entries.filter(entry => entry.type === "commit").forEach(entry => {
  fs.mkdirSync(path.resolve(destination, ...entry.name.split("/")), { recursive: true });
});

const bytes=inventory.reduce((n,file)=>n+file.bytes,0);
if(policy){
  fs.writeFileSync(path.join(destination,'deployment-files.json'),JSON.stringify({revision,bytes,files:inventory},null,2)+'\n');
  fs.writeFileSync(path.join(destination,'.vercelignore'),'deployment-files.json\n');
  if(policy.acceptedBytes && bytes>policy.acceptedBytes*1.1)console.warn(`WARNING: deployment ${bytes} bytes exceeds accepted baseline ${policy.acceptedBytes} by more than 10%`);
}
console.log(`Materialized ${blobs.length} verified files from ${revision}: ${bytes} bytes.`);
