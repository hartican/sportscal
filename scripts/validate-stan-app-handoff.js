#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../config/venue-panel-ui.js'),'utf8');
const launch=source.slice(source.indexOf('function configureProviderLaunch('),source.indexOf('\nfunction viewingAccessLabel'));
const marketing='https://www.stan.com.au/watch/sport/football/uefa-champions-league';
function render(viewing,navigator){const context={navigator,URL};vm.createContext(context);vm.runInContext(launch,context);const link={};context.configureProviderLaunch(link,viewing);return link;}
for(const navigator of [
 {userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1'},
 {userAgent:'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/134.0 Mobile Safari/537.36'},
 {userAgent:'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X)'},
 {userAgent:'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)',maxTouchPoints:5},
]){
 const link=render({providerId:'stan',webUrl:marketing},navigator);
 assert.equal(link.href,'https://play.stan.com.au/sport','Mobile Stan taps use its associated player host, not the marketing page');
 assert.equal(link.target,'_self','A direct user tap permits native app handoff without forcing a browser tab');
 assert(link.rel.includes('noopener')&&link.rel.includes('noreferrer'));
 const exact='https://play.stan.com.au/programs/verified-program-id';
 assert.equal(render({providerId:'stan',webUrl:exact},navigator).href,exact,'Retain an existing exact Stan player destination');
 assert.equal(render({providerId:'stan',webUrl:'https://stan.com.au/watch/sport/tennis'},navigator).href,'https://play.stan.com.au/sport');
 assert.equal(render({providerId:'stan',webUrl:'https://www.stan.com.au/account'},navigator).href,'https://www.stan.com.au/account','Do not reinterpret unrelated account routes');
 for(const webUrl of ['https://www.stan.com.au.evil.test/watch/sport','https://evil.test/watch/sport','https://www.stan.com.au@evil.test/watch/sport'])assert.equal(render({providerId:'stan',webUrl},navigator).href,webUrl,'App routing requires the exact official host');
 assert.equal(render({providerId:'nine',webUrl:marketing},navigator).href,marketing,'A URL alone cannot confer Stan provider identity');
 const youtube=render({providerId:'youtube',webUrl:'/api/fixtures?mode=highlight&ids=fixture%3Afootball%3Atest',highlightsTopResult:true},navigator);
 assert.equal(youtube.href,'/api/fixtures?mode=highlight&ids=fixture%3Afootball%3Atest');assert.equal(youtube.target,'_blank','Keep the existing highlights action');
}
for(const navigator of [{userAgent:'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)',maxTouchPoints:0},{userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'},{}]){
 const link=render({providerId:'stan',webUrl:marketing},navigator);assert.equal(link.href,marketing,'Desktop retains its verified web destination');assert.equal(link.target,'_blank');
}
assert.equal(render({providerId:'stan',webUrl:'javascript:alert(1)'},{userAgent:'iPhone'}).href,'#');
console.log('Stan app handoff: mobile associated-host routing, exact player links, desktop/highlights and host boundaries passed. Native installed-app launch requires physical-phone evidence.');
