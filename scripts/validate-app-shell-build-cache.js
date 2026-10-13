#!/usr/bin/env node
"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const cp = require("node:child_process");
const root = path.resolve(__dirname, "..");
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "ns-build-cache-"));
const copy = file => {
  const target = path.join(temporary, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.cpSync(path.join(root, file), target, { recursive: true });
};
try {
  const moduleRoot = path.dirname(path.dirname(require.resolve("terser/package.json")));
  fs.symlinkSync(moduleRoot, path.join(temporary, "node_modules"), "dir");
  ["config", "scripts/lib", "data/canonical", "scripts/build-app-shell-runtime.js",
    "data/events.json", "data/major-events.v1.json", "data/editorial-knowledge.v1.json",
    "assets/js/app-shell-runtime.js", "assets/js/calendar-sync-ui.js", "assets/js/calendar-sync-ui.source.js"]
    .forEach(copy);
  require("../config/app-shell-modules.json").filter(file => !file.startsWith("config/")).forEach(copy);
  const builder = require(path.join(temporary, "scripts/build-app-shell-runtime.js"));
  const original = builder.build();
  assert.equal(builder.build(), original, "repeated builds preserve exact bytes");
  const input = path.join(temporary, "config/card-identities.js");
  const originalInput = fs.readFileSync(input, "utf8");
  const changedInput = originalInput + "\nglobalThis.NOTHINGSPORTS_BUILD_CACHE_PROBE=1;\n";
  fs.writeFileSync(input, changedInput);
  const changed = builder.build();
  assert.notEqual(changed, original, "a real source change must invalidate the prior output");
  assert.equal(builder.build(), changed, "repeated changed input remains deterministic");
  fs.writeFileSync(input, originalInput + "\nfunction )\n");
  assert.throws(() => builder.build(), { name: "SyntaxError" }, "invalid source must not reuse a successful output");
  fs.unlinkSync(input);
  assert.throws(() => builder.build(), { code: "ENOENT" }, "missing source must still fail before reuse");
  fs.writeFileSync(input, changedInput);
  assert.equal(builder.build(), changed, "source-read and parse failures do not poison subsequent checks");
  const stale = cp.spawnSync(process.execPath, ["scripts/build-app-shell-runtime.js", "--check"], { cwd: temporary, encoding: "utf8" });
  assert.notEqual(stale.status, 0, "the normal exact-byte gate rejects stale generated output");
  assert.match(stale.stderr, /App shell bundle is stale/, "the failure must be the unchanged source-to-runtime gate");
  fs.writeFileSync(input, originalInput);
  assert.equal(builder.build(), original, "restoring the actual source restores its exact output");
  fs.writeFileSync(path.join(temporary, "assets/js/app-shell-runtime.js"), original);
  const valid = cp.spawnSync(process.execPath, ["scripts/build-app-shell-runtime.js", "--check"], { cwd: temporary, encoding: "utf8" });
  assert.equal(valid.status, 0, valid.stderr);
  const manifest = path.join(temporary, "config/app-shell-modules.json");
  const originalManifest = fs.readFileSync(manifest, "utf8");
  const addedModule = "config/build-cache-manifest-probe.js";
  fs.writeFileSync(path.join(temporary, addedModule), "globalThis.NOTHINGSPORTS_BUILD_CACHE_MANIFEST_PROBE=1;\n");
  fs.writeFileSync(manifest, JSON.stringify([...JSON.parse(originalManifest), addedModule]));
  assert(builder.build() !== original, "a changed module manifest must be read before reuse");
  fs.writeFileSync(manifest, "[");
  assert.throws(() => builder.build(), { name: "SyntaxError" }, "invalid module metadata must not reuse output");
  fs.unlinkSync(manifest);
  assert.throws(() => builder.build(), { code: "ENOENT" }, "missing module metadata must fail");
  fs.writeFileSync(manifest, originalManifest);
  assert.equal(builder.build(), original, "restoring module order restores exact output");
  console.log("Build reuse: repeated bytes, real source changes, stale-output rejection and normal recovery pass in an isolated copy.");
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}
