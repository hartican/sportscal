#!/usr/bin/env node

const hierarchy = require("../config/sport-hierarchy.js");

function childrenByParent(nodes = hierarchy.nodes){
  const result = new Map();
  nodes.forEach(node => {
    const key = node.parentId || null;
    const children = result.get(key) || [];
    children.push(node);
    result.set(key, children);
  });
  return result;
}

function renderText(nodes = hierarchy.nodes){
  const children = childrenByParent(nodes);
  const lines = [`nothingsport sport hierarchy ${hierarchy.schemaVersion}`, ""];
  function visit(parentId, depth){
    (children.get(parentId) || []).forEach(node => {
      lines.push(`${"  ".repeat(depth)}- ${node.label} [${node.level}] ${node.id}`);
      visit(node.id, depth + 1);
    });
  }
  visit(null, 0);
  lines.push("", `Nodes: ${nodes.length}`);
  lines.push(`Legacy ID aliases: ${Object.keys(hierarchy.legacyIds).length}`);
  lines.push(`Legacy sport-key aliases: ${Object.keys(hierarchy.legacySportKeys).length}`);
  return `${lines.join("\n")}\n`;
}

function main(argv = process.argv.slice(2)){
  if (argv.includes("--json")){
    process.stdout.write(`${JSON.stringify({
      schemaVersion: hierarchy.schemaVersion,
      levels: hierarchy.levels,
      nodes: hierarchy.nodes,
      legacyIds: hierarchy.legacyIds,
      legacySportKeys: hierarchy.legacySportKeys,
    }, null, 2)}\n`);
    return;
  }
  process.stdout.write(renderText());
}

if (require.main === module) main();

module.exports = { childrenByParent, renderText };
