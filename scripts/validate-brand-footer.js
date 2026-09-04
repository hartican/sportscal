#!/usr/bin/env node

"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const brand = require("../config/brand-copy.js");
const vectors = require("../config/vector-assets.js");

const html = fs.readFileSync("index.html", "utf8");
const notFound = fs.readFileSync("404.html", "utf8");
const worker = fs.readFileSync("service-worker.js", "utf8");
const notificationDispatch = fs.readFileSync("api/notification-dispatch.js", "utf8");
const manifest = JSON.parse(fs.readFileSync("manifest.webmanifest", "utf8"));

assert.equal(brand.version, "nothingsport-brand.v11");
assert.equal(brand.officialName, "Nothing Sport");
assert.equal(brand.stylisedName, "nothing SPORT");
assert.equal(brand.title, "Nothing Sport — Smart sports feed");
assert.equal(brand.copyright, "Copyright ©\u00A02026\u00A0Nothing Sport. All Rights Reserved.");
assert.deepEqual(brand.social.instagram, {
  handle:"@_nothingsport",
  url:"https://www.instagram.com/_nothingsport/",
  status:"active",
});
assert.deepEqual(brand.social.x, { handle:"@nothingsport", status:"coming soon" });
assert.deepEqual(brand.social.linkedin, { handle:"@nothingsport", status:"coming soon" });
assert.match(brand.countryAcknowledgement, /Yuin Nation/);
assert.match(brand.countryAcknowledgement, /Always was, always will be Aboriginal land\. Voice\. Treaty\. Truth\./);

assert.equal(manifest.name, brand.title);
assert.equal(manifest.short_name, brand.officialName);
assert.match(html, /<meta name="application-name" content="Nothing Sport">/);
assert.match(html, /<meta name="apple-mobile-web-app-title" content="Nothing Sport">/);
assert.match(html, /data-brand-copy="copyright">Copyright ©&nbsp;2026&nbsp;Nothing Sport\. All Rights Reserved\.<\/div>/);
assert.match(html, /href="https:\/\/www\.instagram\.com\/_nothingsport\/"[^>]*target="_blank"[^>]*rel="noopener noreferrer external"/);
assert.equal((html.match(/class="footer-social-placeholder"/g) || []).length, 2);
assert.equal((html.match(/aria-disabled="true"/g) || []).length >= 2, true);
assert.equal((html.match(/title="coming soon" data-tooltip="coming soon"/g) || []).length, 2);
assert.match(html, /\.footer-social-link,[\s\S]{0,120}\.footer-social-placeholder\{[\s\S]{0,180}min-height:44px/);
assert.match(html, /\.footer-socials\{[\s\S]{0,180}flex-wrap:wrap/);
assert.match(html, /\.footer-social-link:focus-visible,[\s\S]{0,100}\.footer-social-placeholder:focus-visible/);
assert.match(html, /<nav class="footer-legal-links"[^>]*>[\s\S]*href="\/privacy\.html"[\s\S]*href="\/terms\.html"/);
assert.match(html, /function renderAboutSettings[\s\S]*cloneNode\(true\)[\s\S]*footer-legal-links/);
assert.match(html, /body\.settings-open \.app-footer\{[\s\S]{0,80}visibility:hidden/);
assert(fs.existsSync("privacy.html") && fs.existsSync("terms.html"));

["social:instagram", "social:x", "social:linkedin"].forEach(key => {
  const entry = vectors.openUse[key];
  assert(entry, `${key} must be registered`);
  assert.equal(entry.library, "Simple Icons");
  assert.equal(entry.license, "CC0-1.0");
  assert.match(entry.source, /github\.com\/simple-icons\/simple-icons/);
  assert.match(entry.disclaimer, /DISCLAIMER\.md/);
  assert.match(vectors.glyphMarkup(key, { label:key }), /<svg\b[\s\S]*<path\b/);
});

assert.match(notFound, /Page moved — Nothing Sport/);
assert.match(notFound, /alt="nothing SPORT"/);
assert.match(notFound, />your Nothing Sport feed</);
assert.match(worker, /"Nothing Sport reminder"/);
assert.match(notificationDispatch, /Tap to open Nothing Sport\./);
assert.doesNotMatch(html, /\bNothingsport\b/);
assert.doesNotMatch(notFound, /\bNothingsport\b/);
assert.doesNotMatch(notFound, /(?:content|alt|title)="[^"]*\bnothingsport\b[^"]*"/i);

const logoAlternatives = [...html.matchAll(/<img[^>]+nothingsport-(?:logo|hero-logo)[^>]+alt="([^"]*)"/g)].map(match => match[1]);
assert(logoAlternatives.includes("nothing SPORT"), "visible logo alternatives must preserve the stylised artwork name");
assert(logoAlternatives.every(value => value === "" || value === "nothing SPORT"), "logo alternatives must use the exact visual artwork name or remain decorative");

console.log("Nothing Sport brand and social footer contract passed.");
