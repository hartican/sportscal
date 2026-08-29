"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");

const SNAPSHOT_SCHEMA_VERSION = "encrypted-follow-snapshot.v1";

function snapshotKey(raw = process.env.FOLLOW_SNAPSHOT_KEY){
  const key = Buffer.from(String(raw || ""), "base64");
  if (key.length !== 32) throw new Error("FOLLOW_SNAPSHOT_KEY must be a base64-encoded 256-bit key");
  return key;
}

function encryptSnapshot(payload, rawKey){
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", snapshotKey(rawKey), iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(payload), "utf8"), cipher.final()]);
  return {
    schemaVersion:SNAPSHOT_SCHEMA_VERSION,
    algorithm:"aes-256-gcm",
    iv:iv.toString("base64"),
    authTag:cipher.getAuthTag().toString("base64"),
    ciphertext:ciphertext.toString("base64"),
  };
}

function decryptSnapshot(envelope, rawKey){
  if (envelope?.schemaVersion !== SNAPSHOT_SCHEMA_VERSION || envelope.algorithm !== "aes-256-gcm"){
    throw new Error("Follow snapshot envelope is unsupported");
  }
  const decipher = crypto.createDecipheriv("aes-256-gcm", snapshotKey(rawKey), Buffer.from(envelope.iv, "base64"));
  decipher.setAuthTag(Buffer.from(envelope.authTag, "base64"));
  return JSON.parse(Buffer.concat([
    decipher.update(Buffer.from(envelope.ciphertext, "base64")),
    decipher.final(),
  ]).toString("utf8"));
}

function readSnapshot(filePath = process.env.FOLLOW_SNAPSHOT_PATH, rawKey = process.env.FOLLOW_SNAPSHOT_KEY){
  if (!filePath) throw new Error("FOLLOW_SNAPSHOT_PATH is required");
  return decryptSnapshot(JSON.parse(fs.readFileSync(filePath, "utf8")), rawKey);
}

module.exports = {
  SNAPSHOT_SCHEMA_VERSION,
  decryptSnapshot,
  encryptSnapshot,
  readSnapshot,
};
