#!/usr/bin/env node

"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const brand = require("../config/brand-copy.js");
const vectors = require("../config/vector-assets.js");

const html = fs.readFileSync("index.html", "utf8") + "\n" + fs.readFileSync("config/fantasy-deadline-ui.js", "utf8");
const notFound = fs.readFileSync("404.html", "utf8");
const worker = fs.readFileSync("service-worker.js", "utf8");
const notificationDispatch = fs.readFileSync("api/notification-dispatch.js", "utf8");
const manifest = JSON.parse(fs.readFileSync("manifest.webmanifest", "utf8"));

assert.equal(brand.version, "sportsyurt-brand.v4");
assert.equal(brand.officialName, "SportsYurt");
assert.equal(brand.stylisedName, "sportsyurt");
assert.equal(brand.title, "SportsYurt — Sports Calendar");
assert.equal(brand.copyright, "Copyright ©\u00A02026\u00A0SportsYurt. All Rights Reserved.");
assert.deepEqual(brand.social.instagram, {
  handle:"@sportsyurt",
  url:"https://www.instagram.com/sportsyurt/",
  status:"active",
});
assert.deepEqual(brand.social.x, { handle:"", status:"coming soon" });
assert.deepEqual(brand.social.linkedin, { handle:"", status:"coming soon" });
assert.match(brand.countryAcknowledgement, /Yuin Nation/);
assert.match(brand.countryAcknowledgement, /Always was, always will be Aboriginal land\. Voice\. Treaty\. Truth\./);

assert.equal(manifest.name, brand.title);
assert.equal(manifest.short_name, brand.officialName);
assert.match(html, /<meta name="application-name" content="SportsYurt">/);
assert.match(html, /<meta name="apple-mobile-web-app-title" content="SportsYurt">/);
assert.match(html, /data-brand-copy="copyright">Copyright ©&nbsp;2026&nbsp;SportsYurt\. All Rights Reserved\.<\/div>/);
assert.match(html, /href="https:\/\/www\.instagram\.com\/sportsyurt\/"[^>]*target="_blank"[^>]*rel="noopener noreferrer external"/);
assert.equal((html.match(/class="footer-social-placeholder"/g) || []).length, 2);
assert.equal((html.match(/aria-disabled="true"/g) || []).length >= 2, true);
assert.equal((html.match(/title="coming soon" data-tooltip="coming soon"/g) || []).length, 2);
assert.match(html, /\.footer-social-link,[\s\S]{0,120}\.footer-social-placeholder\{[\s\S]{0,180}min-height:44px/);
assert.match(html, /\.footer-socials\{[\s\S]{0,180}flex-wrap:wrap/);
assert.match(html, /\.footer-social-link:focus-visible,[\s\S]{0,100}\.footer-social-placeholder:focus-visible/);
assert.match(html, /<nav class="footer-legal-links"[^>]*>[\s\S]*href="\/privacy\.html"[\s\S]*href="\/terms\.html"/);
assert.match(html, /function renderAboutSettings[\s\S]*data-legal-document="privacy"[\s\S]*data-legal-document="terms"/);
assert.match(html, /function renderLegalSettings[\s\S]*\/privacy\.html[\s\S]*\/terms\.html/);
assert.match(html, /closest\('a\[href="\/privacy\.html"\], a\[href="\/terms\.html"\]'\)[\s\S]*preventDefault\(\)[\s\S]*openLegalDocument/);
assert.match(html, /settingsNavigationStack\.push\(settingsSection\)/, "nested Settings screens must have a real in-app return path");
assert.doesNotMatch(html, /window\.location\.href\s*=\s*["'`]\/privacy\.html|window\.location\.href\s*=\s*["'`]\/terms\.html/);
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

assert.match(notFound, /Page moved — SportsYurt/);
assert.match(notFound, /alt="sportsyurt"/);
assert.match(notFound, />your SportsYurt feed</);
assert.match(worker, /"SportsYurt reminder"/);
assert.match(notificationDispatch, /Tap to open SportsYurt\./);
assert.doesNotMatch(html, /\bNothingsport\b/);
assert.doesNotMatch(notFound, /\bNothingsport\b/);
assert.doesNotMatch(notFound, /(?:content|alt|title)="[^"]*\bnothingsport\b[^"]*"/i);

const logoAlternatives = [...html.matchAll(/<img[^>]+sportsyurt-(?:logo|hero-logo)[^>]+alt="([^"]*)"/g)].map(match => match[1]);
assert(logoAlternatives.includes("sportsyurt"), "visible logo alternatives must preserve the stylised artwork name");
assert(logoAlternatives.every(value => value === "" || value === "sportsyurt"), "logo alternatives must use the exact visual artwork name or remain decorative");

console.log("SportsYurt brand and social footer contract passed.");
