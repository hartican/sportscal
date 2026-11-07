"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const VERSION = "pilot-cohort-selection.v1";
const POPULATION = "configured-invited-accounts";
const MAX_ACCOUNTS = 100;
const MAX_FILE_BYTES = 64 * 1024;
const UUID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

function exactKeys(value, keys, label){
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).some(key => !keys.includes(key)) || keys.some(key => !Object.hasOwn(value, key))){
    throw new Error(`${label} has missing or unsupported fields.`);
  }
}

function timestamp(value, label){
  const date = typeof value === "string" ? new Date(value) : null;
  if (!date || !Number.isFinite(date.getTime()) || ![date.toISOString(), date.toISOString().replace(".000Z", "Z")].includes(value)){
    throw new Error(`${label} must be an exact UTC ISO timestamp.`);
  }
  return date.toISOString();
}

function account(value){
  if (typeof value !== "string" || !UUID.test(value)) throw new Error("Account identifiers must be UUIDs.");
  return value.toLowerCase();
}

function normalizeSelection(input, now = new Date()){
  exactKeys(input, ["schemaVersion", "reviewedAt", "members", "excludedAccountIds"], "Private selection");
  if (input.schemaVersion !== VERSION) throw new Error("Unsupported private selection version.");
  const reviewedAt = timestamp(input.reviewedAt, "reviewedAt");
  if (!Number.isFinite(now.getTime()) || Date.parse(reviewedAt) > now.getTime()) throw new Error("Selection review cannot be future-dated.");
  if (!Array.isArray(input.members) || !input.members.length || input.members.length > MAX_ACCOUNTS || !Array.isArray(input.excludedAccountIds) || !input.excludedAccountIds.length || input.excludedAccountIds.length > MAX_ACCOUNTS){
    throw new Error("Record 1–100 members and explicit owner/QA exclusions (1–100 UUIDs).");
  }
  const members = input.members.map(member => {
    exactKeys(member, ["accountId", "joinedAt"], "Cohort member");
    const joinedAt = timestamp(member.joinedAt, "joinedAt");
    if (Date.parse(joinedAt) > Date.parse(reviewedAt)) throw new Error("Joining cannot be later than the selection review.");
    return { accountId:account(member.accountId), joinedAt };
  }).sort((a,b) => a.accountId.localeCompare(b.accountId));
  const excludedAccountIds = input.excludedAccountIds.map(account).sort();
  if (new Set(members.map(member => member.accountId)).size !== members.length || new Set(excludedAccountIds).size !== excludedAccountIds.length){
    throw new Error("Duplicate account identifiers are ambiguous; review the selection.");
  }
  const excluded = new Set(excludedAccountIds);
  const eligibleAccounts = members.filter(member => !excluded.has(member.accountId)).length;
  if (!eligibleAccounts) throw new Error("No eligible members remain after owner/QA exclusions.");
  const selection = { schemaVersion:VERSION, reviewedAt, members, excludedAccountIds };
  return { ...selection, eligibleAccounts, fingerprint:crypto.createHash("sha256").update(JSON.stringify(selection)).digest("hex") };
}

function replaceOnce(source, marker, replacement){
  if (source.split(marker).length !== 2) throw new Error("The aggregate SQL template changed; review its cohort insertion points.");
  return source.replace(marker, replacement);
}

function buildCohortSql(input, source, now = new Date()){
  const selection = normalizeSelection(input, now);
  const members = selection.members.map(member => `('${member.accountId}'::uuid, '${member.joinedAt}'::timestamptz)`).join(",\n    ");
  const excluded = selection.excludedAccountIds.map(id => `('${id}'::uuid)`).join(",\n    ");
  let sql = replaceOnce(source, "with measurement_events as (", `with configured_members(user_id, joined_at) as (\n  values ${members}\n), configured_exclusions(user_id) as (\n  values ${excluded}\n), measurement_events as (`);
  const window = "where event.occurred_at >= now() - interval '28 days' and event.occurred_at <= now()";
  sql = replaceOnce(sql, window, window+"\n    and exists (select 1 from configured_members member where member.user_id = event.user_id and event.occurred_at >= member.joined_at)\n    and not exists (select 1 from configured_exclusions excluded where excluded.user_id = event.user_id)");
  const select = "select\n  now() - interval '28 days' as measurement_window_started_at,";
  sql = replaceOnce(sql, select, `select\n  '${POPULATION}'::text as measurement_population,\n  '${selection.fingerprint}'::text as cohort_selection_sha256,\n  '${selection.reviewedAt}'::timestamptz as cohort_reviewed_at,\n  ${selection.members.length}::int as cohort_requested_accounts,\n  ${selection.excludedAccountIds.length}::int as cohort_exclusion_accounts,\n  ${selection.eligibleAccounts}::int as cohort_eligible_accounts,\n  (select count(distinct user_id) from measurement_events)::int as cohort_measured_accounts,\n  now() - interval '28 days' as measurement_window_started_at,`);
  return { sql:"-- PRIVATE account selection: administrator-only, read-only aggregate; do not publish this SQL.\n"+sql, selection };
}

function outsideGit(file){
  const resolved = fs.existsSync(file) ? fs.realpathSync(file) : path.join(fs.realpathSync(path.dirname(file)), path.basename(file));
  const marker = name => {
    try { return fs.lstatSync(name); }
    catch (error) {
      if (["ENOENT","ENOTDIR"].includes(error.code)) return null;
      throw new Error("Cannot establish the private file's Git boundary.");
    }
  };
  for (let directory=path.dirname(resolved);; directory=path.dirname(directory)){
    if (marker(path.join(directory,".git")) || (marker(path.join(directory,"HEAD")) && marker(path.join(directory,"objects")))){
      throw new Error("Private selection and output files must be outside Git checkouts.");
    }
    if (path.dirname(directory)===directory) return resolved;
  }
}

function readSelection(file){
  if (!path.isAbsolute(file)) throw new Error("Use an absolute private selection path.");
  const resolved = outsideGit(file);
  let descriptor;
  try {
    descriptor = fs.openSync(resolved, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
    const stat = fs.fstatSync(descriptor);
    if (!stat.isFile() || stat.size > MAX_FILE_BYTES) throw new Error();
    return JSON.parse(fs.readFileSync(descriptor, "utf8"));
  } catch (_) {
    throw new Error("Cannot read a regular private selection JSON file (maximum 64 KiB).");
  } finally {
    if (descriptor !== undefined) fs.closeSync(descriptor);
  }
}

function writePrivate(file, text){
  if (!path.isAbsolute(file)) throw new Error("Use an absolute output path outside Git.");
  const resolved = outsideGit(file);
  let descriptor;
  try {
    descriptor = fs.openSync(resolved, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW, 0o600);
    fs.fchmodSync(descriptor, 0o600);
    fs.writeFileSync(descriptor, text, "utf8");
  } catch (_) {
    throw new Error("Private output could not be created; use an existing directory and a new file path.");
  } finally {
    if (descriptor !== undefined) fs.closeSync(descriptor);
  }
  return resolved;
}

const SCOPE_KEYS = ["measurement_population", "cohort_selection_sha256", "cohort_reviewed_at", "cohort_requested_accounts", "cohort_exclusion_accounts", "cohort_eligible_accounts", "cohort_measured_accounts"];

function scopeFromReadout(payload){
  if (payload?.measurementScope) throw new Error("Use the original scoped aggregate export, rather than re-evaluating a rendered report.");
  const rows = Array.isArray(payload) ? payload : Array.isArray(payload?.data) ? payload.data : [];
  if (!rows.some(row => SCOPE_KEYS.some(key => Object.hasOwn(row, key)))) return null;
  const row = rows.find(row => row.cohort === "all" || row.cohort === "overall");
  if (!row || rows.some(item => SCOPE_KEYS.some(key => !Object.hasOwn(item,key) || String(item[key]) !== String(row[key])))) throw new Error("Mixed or missing population metadata in aggregate export.");
  const integer = key => {
    const raw = row[key], value = Number(raw);
    if (!["string","number"].includes(typeof raw) || String(raw).trim()==="" || !Number.isInteger(value) || value < 0 || value > MAX_ACCOUNTS) throw new Error("Invalid cohort count in aggregate export.");
    return value;
  };
  const requestedAccounts = integer("cohort_requested_accounts"), exclusionAccounts = integer("cohort_exclusion_accounts"), eligibleAccounts = integer("cohort_eligible_accounts"), measuredAccounts = integer("cohort_measured_accounts");
  if (![row.cohort_reviewed_at,row.measurement_generated_at].every(value => typeof value === "string" || value instanceof Date)) throw new Error("Missing cohort review or aggregate observation timestamp.");
  const reviewed = new Date(row.cohort_reviewed_at), generated = new Date(row.measurement_generated_at);
  if (row.measurement_population !== POPULATION || typeof row.cohort_selection_sha256 !== "string" || !/^[0-9a-f]{64}$/.test(row.cohort_selection_sha256) || !requestedAccounts || !exclusionAccounts || !eligibleAccounts || eligibleAccounts > requestedAccounts || measuredAccounts > eligibleAccounts || !Number.isFinite(reviewed.getTime()) || !Number.isFinite(generated.getTime()) || reviewed > generated){
    throw new Error("Invalid or future-dated cohort qualification metadata.");
  }
  for (const item of rows){
    for (const key of ["exposed_users", "useful_action_users", "returning_useful_users", "pulse_users"]){
      const value = Number(item[key]);
      if (!["string","number"].includes(typeof item[key]) || String(item[key]).trim()==="" || !Number.isInteger(value) || value < 0 || value > measuredAccounts) throw new Error("Account numerator exceeds the configured measured population.");
    }
    if (Number(item.returning_useful_users) > Number(item.useful_action_users)) throw new Error("Useful-return numerator exceeds its denominator.");
  }
  return { population:POPULATION, selectionFingerprint:row.cohort_selection_sha256, reviewedAt:reviewed.toISOString(), requestedAccounts, exclusionAccounts, eligibleAccounts, measuredAccounts, qualification:"Configured operator selection; invitation evidence, distinct people and Australian residence are not independently verified." };
}

module.exports = { VERSION, POPULATION, MAX_ACCOUNTS, normalizeSelection, buildCohortSql, readSelection, writePrivate, scopeFromReadout };
