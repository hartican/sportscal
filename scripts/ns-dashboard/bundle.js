"use strict";

const fs = require("node:fs"), path = require("node:path"), crypto = require("node:crypto");
const { hash, fail } = require("./core");
const local = require("./local");
const { renderPages, renderOverview } = require("./overview");
function writeBundle(directory, projection, options) {
  directory = local.privateDirectory(directory);
  const lockPath = path.join(directory, ".dashboard.lock");
  let lock;
  try { lock = fs.openSync(lockPath, "wx", 0o600); }
  catch (error) { if (error.code === "EEXIST") fail("dashboard_busy"); throw error; }
  let stage;
  try {
    const pages = renderPages(projection, options);
    const generation = "snapshot-" + hash({ projection, pages });
    const destination = path.join(directory, generation);
    if (!fs.existsSync(destination)) {
      stage = fs.mkdtempSync(path.join(directory, ".dashboard-stage-"));
      for (const [name, html] of Object.entries(pages)) local.atomicText(stage, name, html);
      local.atomic(stage, "projection.json", projection);
      local.atomic(stage, "manifest.json", {
        schemaVersion: "ns-dashboard-bundle.v1", generation, generatedAt: projection.generatedAt || options.asOf,
        sourceExportHash: projection.sourceExportHash || null,
        pages: Object.entries(pages).map(([name, html]) => ({ name, sha256: crypto.createHash("sha256").update(html).digest("hex"), bytes: Buffer.byteLength(html) })),
        access: "Owner-local static files; no automatic refresh or hosted authentication.",
      });
      fs.renameSync(stage, destination); stage = undefined;
    } else {
      local.privateDirectory(destination);
      for (const [name, html] of Object.entries(pages)) {
        const target = path.join(destination, name);
        if (fs.lstatSync(target).isSymbolicLink() || fs.readFileSync(target, "utf8") !== html) fail("bundle_integrity_error");
      }
    }
    // Publish the stable bookmark only after every page in the immutable generation exists.
    // Navigation remains inside that generation, so an update cannot mix page snapshots.
    local.atomicText(directory, "index.html", renderOverview(projection, { ...options, navPrefix: generation + "/" }));
    return { entry: path.join(directory, "index.html"), generation, pages: Object.keys(pages) };
  } finally {
    if (stage) fs.rmSync(stage, { recursive: true, force: true });
    fs.closeSync(lock); fs.unlinkSync(lockPath);
  }
}
module.exports = { writeBundle };
