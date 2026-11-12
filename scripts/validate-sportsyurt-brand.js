#!/usr/bin/env node
"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm"),crypto=require("node:crypto");
const brand=require("../config/brand-copy");
const html=fs.readFileSync("index.html","utf8");
assert.equal(brand.name,"SportsYurt");
assert.equal(brand.stylisedName,"sportsyurt");
assert.equal(brand.title,"SportsYurt — Sports Calendar");
assert.equal(brand.descriptor,"All sports under one roof.");
assert.match(brand.productCharter.commitments.find(c=>c.title==="Independent of gambling.").body,/will not offer betting products/);
assert.match(brand.countryAcknowledgement,/Yuin Nation/);
const manifest=JSON.parse(fs.readFileSync("manifest.webmanifest","utf8"));
assert.equal(manifest.id,"/");assert.equal(manifest.scope,"/");assert.equal(manifest.start_url,"/");
assert.equal(JSON.parse(fs.readFileSync("owner.webmanifest","utf8")).id,"/admin/");
assert.equal(manifest.short_name,brand.name);
assert.match(html,/<link rel="canonical" href="https:\/\/sportsyurt\.app\/">/);
assert.match(html,/day: "assets\/brand\/web\/sportsyurt-logo-day\.svg"/);
assert.match(html,/night: "assets\/brand\/web\/sportsyurt-logo-night\.svg"/);
assert.doesNotMatch(html,/class="header-logomark"/);
for(const [theme,colourway] of [["day","signature-light"],["night","signature-dark"]]){
 const a=fs.readFileSync(`assets/brand/web/sportsyurt-logo-${theme}.svg`);
 const b=fs.readFileSync(`assets/brand/source/SportsYurt_brand/logo/lockup/sportsyurt_lockup_${colourway}.svg`);
 assert(a.equals(b),"Use the unchanged supplied lockup");
 assert(!/\b(?:script|foreignObject)\b|https?:\/\/(?!www\.w3\.org\/2000\/svg)/.test(a.toString()),"Brand SVG must be self-contained");
}
const hash=b=>crypto.createHash("sha256").update(b).digest("hex");
for(const size of [16,32])assert.equal(hash(fs.readFileSync(`icons/sportsyurt-favicon-${size}.png`)),hash(fs.readFileSync(`assets/brand/source/SportsYurt_brand/web/favicon-${size}x${size}.png`)));
for(const icon of manifest.icons)assert(fs.existsSync(icon.src.slice(1)),icon.src);
const publicFiles=["index.html","404.html","privacy.html","terms.html","participate.html","admin.html","admin-comms.html","service-worker.js","config/brand-copy.js","lib/comms-content.js","lib/chat-notifications.js","api/notification-dispatch.js"];
for(const file of publicFiles){
 const text=fs.readFileSync(file,"utf8");
 assert.doesNotMatch(text,/Nothing Sport|nothing SPORT/,file+" must use current displayed branding");
 if(file.endsWith(".js"))new vm.Script(text,{filename:file});
 else for(const [,source] of text.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))if(source.trim())new vm.Script(source,{filename:file});
}
assert.match(fs.readFileSync("config/calendar-ics.js","utf8"),/\}@nothingsport\.app/,'calendar UIDs retain their compatibility domain');
console.log("SportsYurt brand passed: exact v4 artwork, theme assets, favicons, public copy, script syntax and installed/calendar identities.");
