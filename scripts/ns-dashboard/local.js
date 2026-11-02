"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { fail, hash, validateDataset, instant } = require("./core");
function insideGit(directory) {
  for (let p = directory; ; p = path.dirname(p)) {
    if (fs.existsSync(path.join(p, ".git"))) return true;
    if (path.dirname(p) === p) return false;
  }
}
function privateDirectory(directory) {
  if (!path.isAbsolute(directory)) fail("absolute_private_directory_required");
  // Resolve the existing ancestor before creation, so symlinked parents cannot conceal a Git checkout.
  let ancestor = directory;
  while (!fs.existsSync(ancestor)) ancestor = path.dirname(ancestor);
  if (insideGit(fs.realpathSync(ancestor))) fail("output_inside_git");
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  if (fs.lstatSync(directory).isSymbolicLink()) fail("symlink_output_denied");
  const resolved = fs.realpathSync(directory), stat = fs.statSync(resolved);
  if (insideGit(resolved) || !stat.isDirectory() || !process.getuid || stat.uid !== process.getuid() || (stat.mode & 0o077)) fail("owner_only_directory_required");
  return resolved;
}
function readJson(file, maxBytes = 75_000_000) {
  if (insideGit(fs.realpathSync(path.dirname(file)))) fail("private_input_inside_git");
  const stat = fs.lstatSync(file);
  if (stat.isSymbolicLink() || !stat.isFile() || !process.getuid || stat.uid !== process.getuid() || (stat.mode & 0o077) || stat.size > maxBytes) fail("unsafe_private_file");
  return JSON.parse(fs.readFileSync(file, "utf8"));
}
function atomic(directory, name, value) {
  directory = privateDirectory(directory);
  if (!/^[a-z][a-z0-9.-]*$/.test(name)) fail("invalid_export_name");
  const target = path.join(directory, name);
  if (fs.existsSync(target) && fs.lstatSync(target).isSymbolicLink()) fail("symlink_output_denied");
  const temp = path.join(directory, "." + name + "." + process.pid + "." + Math.random().toString(16).slice(2));
  let fd;
  try {
    fd = fs.openSync(temp, "wx", 0o600);
    const serialized = JSON.stringify(value) + "\n";
    if (Buffer.byteLength(serialized) > 75_000_000) fail("export_size_limit");
    fs.writeFileSync(fd, serialized);
    fs.fsyncSync(fd); fs.closeSync(fd); fd = undefined;
    fs.renameSync(temp, target);
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
    if (fs.existsSync(temp)) fs.unlinkSync(temp);
  }
}
function latest(directory) {
  const file = path.join(directory, "latest.json");
  if (!fs.existsSync(file)) return null;
  const pointer = readJson(file);
  if (!/^[a-f0-9]{64}$/.test(pointer.exportHash)) fail("invalid_snapshot_pointer");
  const data = readJson(path.join(directory, "export-" + pointer.exportHash + ".json"));
  if (hash(data) !== pointer.exportHash) fail("snapshot_integrity_error");
  validateDataset(data);
  return data;
}
async function refresh(directory, collect) {
  directory = privateDirectory(directory);
  const lockPath = path.join(directory, ".collector.lock");
  let lock;
  try { lock = fs.openSync(lockPath, "wx", 0o600); }
  catch (error) { if (error.code === "EEXIST") fail("collector_busy"); throw error; }
  try {
    fs.writeFileSync(lock, JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }));
    const previous = latest(directory);
    let attempt;
    try {
      attempt = await collect(previous);
      if (attempt.complete) {
        validateDataset(attempt);
        if (previous && instant(attempt.asOf) < instant(previous.asOf)) fail("older_export_cannot_replace_last_good");
      }
    } catch (error) {
      attempt = { complete: false, completedAt: new Date().toISOString(), error: { code: error.code || "collection_failed" } };
    }
    const exportHash = hash(attempt);
    atomic(directory, "export-" + exportHash + ".json", attempt);
    if (attempt.complete) atomic(directory, "latest.json", { exportHash });
    const status = {
      state: attempt.complete ? "fresh" : "error", attemptHash: exportHash,
      attemptedAt: attempt.completedAt, lastSuccessfulRefresh: attempt.complete ? attempt.completedAt : previous?.completedAt || null,
      error: attempt.complete ? null : attempt.error, coverage: attempt.coverage || null,
    };
    atomic(directory, "refresh-status.json", status);
    return { status, data: attempt.complete ? attempt : previous, attempt };
  } finally { fs.closeSync(lock); fs.unlinkSync(lockPath); }
}
function readView(directory, asOf = new Date().toISOString()) {
  directory = privateDirectory(directory);
  const data = latest(directory);
  const statusFile = path.join(directory, "refresh-status.json");
  const refreshStatus = fs.existsSync(statusFile) ? readJson(statusFile) : null;
  const ageSeconds = data ? (instant(asOf) - instant(data.asOf)) / 1000 : null;
  if (ageSeconds !== null && ageSeconds < 0) fail("view_before_collection");
  return { data, freshness: {
    state: refreshStatus?.state === "error" ? "error" : !data ? "empty" : ageSeconds > 86400 ? "stale" : "fresh",
    ageSeconds, lastSuccessfulRefresh: data?.completedAt || null,
    lastAttempt: refreshStatus?.attemptedAt || null, error: refreshStatus?.error || null,
    coverage: data?.coverage || null,
  } };
}
module.exports = { privateDirectory, readJson, atomic, latest, refresh, readView };
