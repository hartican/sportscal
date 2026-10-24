'use strict';
// Pure checks of the exact request audit and pagination used by the native
// harness. No browser, server, database, provider or dependency installation.
const assert = require('node:assert/strict'), crypto = require('node:crypto'), vm = require('node:vm'), cp = require('node:child_process');
const fixture = require('./validate-public-feed-browser');
const base = 'http://127.0.0.1:12345';
const selected = process.argv.find(arg => arg.startsWith('--case='))?.slice(7);
const baseline = process.argv.includes('--reviewed-baseline');
const old = baseline ? cp.execFileSync('git', ['show', 'd4c42c3e8a1dae2cc9f0f401fea1c127a8b8c941:scripts/validate-public-feed-browser.js'], {encoding:'utf8'}) : null;
const oldApi = old ? vm.runInNewContext('(' + old.slice(old.indexOf('async function api('), old.indexOf('\nasync function isolate(')) + ')', {assert, crypto, session:() => ({}), gifConfig:() => ({capabilities:{}})}) : null;
const oldAudit = old ? new Function('assert', 'state', 'return (' + old.slice(old.indexOf('async function untouched('), old.indexOf('\nasync function open(')) + ');')(assert, async () => ({})) : null;
const token = owner => 'e30.' + Buffer.from(JSON.stringify({sub:owner})).toString('base64url') + '.synthetic';
const request = (method, body, owner) => ({method:() => method, postDataJSON:() => body, headers:() => ({authorization:'Bearer ' + token(owner)})});
const model = () => Object.assign(fixture.scenario(), {base});
async function invoke(target, method, body, actor = target.owner){
  let response;
  await (oldApi || fixture.api)({request:() => request(method, body, actor), fulfill:async value => { response = value; }}, target, new URL('/api/chat', base));
  return response;
}
const query = (target, values = {}) => { const url = new URL('/api/chat', base); url.search = new URLSearchParams({mode:'public-comments', roomId:target.event.id, ...values}); return url; };

async function mutation(method){
  const target = model();
  const response = await invoke(target, method, {action:'update-preferences', followedSports:['nrl']});
  assert.equal(target.apiWrites.length, 1, method + ' must be recorded even when no POST body path executes');
  if(oldAudit){
    await assert.rejects(oldAudit({evaluate:async () => []}, {}, target, 0), /Every mutating method/, 'Original chat-path exemption must fail the control');
  }else{
    assert.equal(response.status, 405); assert.equal(target.apiWrites[0].method, method); assert.equal(target.apiWrites[0].allowed, false);
    assert.throws(() => fixture.assertAllowedWrites(target), /Every mutating method/);
  }
}

function ownership(){
  const target = model(), row = target.rows[0];
  const validVote = {action:'public-comment-vote', eventId:target.event.id, id:row.id, value:1};
  const audit = (method, body, owner = target.owner, pathname = '/api/chat') => fixture.recordWrite(request(method, body, owner), target, new URL(pathname, base));
  assert(audit('POST', validVote).allowed);
  const media = require('../config/chat-media-ui'), gif = media.normalizedGiphyItem({id:'synthetic-0', title:'Actual picker shape', images:{original:{url:'https://media.giphy.com/media/synthetic/giphy.gif'}, fixed_width:{url:'https://media.giphy.com/media/synthetic/200w.gif'}}});
  assert.equal(gif.contentType, undefined, 'Actual picker input is normalized by the server, not pre-normalized in this audit');
  assert(audit('POST', {action:'public-comment-post', eventId:target.event.id, clientId:crypto.randomUUID(), body:'', gif}).allowed);
  for(const [body, owner] of [[validVote, '33333333-3333-4333-8333-333333333333'], [{...validVote, eventId:'fixture:wrong'}], [{...validVote, value:100}], [{...validVote, preferences:{followedSports:['nrl']}}], [{action:'public-comment-delete', eventId:target.event.id, id:row.id}]]) assert.equal(audit('POST', body, owner).allowed, false);
  assert.equal(audit('POST', {action:'gif-reference', roomId:'synthetic-private', gif:{contentUrl:'https://media.giphy.com/media/synthetic/giphy.gif'}}).allowed, false, 'No inferred private membership');
  target.privateMembers.add(target.owner);
  assert(audit('POST', {action:'gif-reference', roomId:'synthetic-private', gif:{contentUrl:'https://media.giphy.com/media/synthetic/giphy.gif'}}).allowed);
  target.points = 24;
  assert.equal(audit('POST', {action:'gif-reference', roomId:'synthetic-private', gif:{contentUrl:'https://media.giphy.com/media/synthetic/giphy.gif'}}).allowed, false);
  for(const method of ['PUT', 'PATCH', 'DELETE', 'TRACE']) assert.equal(audit(method, validVote).allowed, false);
  assert.equal(audit('POST', validVote, target.owner, '/api/preferences').allowed, false);
  assert.equal(audit('POST', {action:'password-sign-in', email:'synthetic@example.invalid', password:'synthetic'}, target.owner, '/api/auth').allowed, false);
  assert(target.apiWrites.every(record => record.method && record.currentOwner));
}

async function pagination(){
  const target = model(); fixture.paginatedFixture(target);
  if(oldApi){
    let response; await oldApi({request:() => request('GET', null, target.owner), fulfill:async value => { response = value; }}, target, query(target));
    assert(response.json.comments.filter(row => !row.parentId).length <= 25, 'Original unbounded root response must fail the control'); return;
  }
  const read = values => fixture.commentPage(target, query(target, values), target.owner);
  const roots = [], rootTokens = []; let cursor, pages = 0;
  do{
    const result = read(cursor ? {before:cursor} : {}); assert(!result.status); assert(result.json.comments.filter(row => !row.parentId).length <= 25);
    roots.push(...result.json.comments.filter(row => !row.parentId).map(row => row.id)); cursor = result.json.nextCursor; if(cursor) rootTokens.push(cursor); assert(++pages <= 3);
  }while(cursor);
  assert.equal(pages, 3); assert.equal(roots.length, 52); assert.equal(new Set(roots).size, 52);
  const replies = [], replyTokens = []; cursor = null; pages = 0;
  do{
    const result = read({q:target.rows[0].id, ...(cursor ? {before:cursor} : {})}); assert(!result.status); assert(result.json.comments.length <= 25);
    replies.push(...result.json.comments.map(row => row.id)); cursor = result.json.nextCursor; if(cursor) replyTokens.push(cursor); assert(++pages <= 3);
  }while(cursor);
  assert.equal(replies.length, 57); assert.equal(new Set(replies).size, 57);
  assert.equal(read({q:target.rows[0].id, before:rootTokens[0]}).status, 400);
  assert.equal(read({q:target.rows[1].id, before:replyTokens[0]}).status, 400);
  assert.equal(read({before:rootTokens[0] + 'tampered'}).status, 400);
  assert.equal(read({before:'x'.repeat(1025)}).status, 400);
  assert.equal(read({after:'-1'}).status, 400); assert.equal(read({after:String(target.revision + 1)}).status, 409);
  let after = 0, changes = [], batches = 0;
  do{ const result = read({after:String(after)}).json; assert(result.comments.length <= 102); assert(result.revision > after); changes.push(...result.comments); after = result.revision; assert(++batches <= 2); if(!result.hasMore) break; }while(true);
  assert.equal(batches, 2); assert.equal(new Set(changes.map(row => row.id)).size, target.rows.length);
  target.revision++; assert.equal(read({before:rootTokens[0]}).status, 409);
  assert.equal(fixture.commentPage(target, query(target), 'wrong-owner').status, 401);
  assert.equal(fixture.commentPage(target, query(target, {roomId:'fixture:other'}), target.owner).status, 404);
}

async function main(){
  for(const method of ['POST', 'PUT', 'PATCH', 'DELETE']) if(!selected || selected === method){ await mutation(method); console.log('Native fixture write audit: ' + method + ' passed.'); }
  if(!selected && !baseline){ ownership(); console.log('Native fixture write ownership/target/permission controls passed.'); }
  if(!selected || selected === 'pagination'){ await pagination(); console.log('Native fixture scoped root/reply pages and bounded deltas passed.'); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
