#!/usr/bin/env node

"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");

const [revision, destinationArg] = process.argv.slice(2);
if (!revision || !destinationArg){
  console.error("Usage: node scripts/materialize-git-tree.js <commit> <destination>");
  process.exit(2);
}

const destination = path.resolve(destinationArg);
const sourceRoot = process.cwd();
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
const blobs = entries.filter(entry => entry.type === "blob");

blobs.forEach(entry => {
  const outputPath = path.resolve(destination, ...entry.name.split("/"));
  if (outputPath !== destination && !outputPath.startsWith(`${destination}${path.sep}`)) throw new Error(`Unsafe output path: ${entry.name}`);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  // Reuse only bytes whose Git blob SHA matches this commit. Changed files
  // fall back to isolated object reads, avoiding bulk packed-object SIGBUS.
  const content = verifiedWorkingTreeContent(entry) || execFileSync("git", ["cat-file", "blob", entry.oid], {
      encoding: null,
      maxBuffer: 64 * 1024 * 1024,
    });
  if (entry.mode === "120000") fs.symlinkSync(content.toString("utf8"), outputPath);
  else {
    fs.writeFileSync(outputPath, content, { mode: entry.mode === "100755" ? 0o755 : 0o644 });
    fs.chmodSync(outputPath, entry.mode === "100755" ? 0o755 : 0o644);
  }
});
entries.filter(entry => entry.type === "commit").forEach(entry => {
  fs.mkdirSync(path.resolve(destination, ...entry.name.split("/")), { recursive: true });
});

console.log(`Materialized ${entries.length} tracked files from ${revision}.`);
