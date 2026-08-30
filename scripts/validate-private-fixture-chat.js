#!/usr/bin/env node

"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const chatContract = require("../config/chat-contract");
const chatHandler = require("../api/chat");

function responseStub(){
  return {
    statusCode:null,
    headers:{},
    body:null,
    setHeader(name, value){ this.headers[name] = value; },
    status(code){ this.statusCode = code; return this; },
    json(value){ this.body = value; return this; },
  };
}

function fetchResponse(payload, status = 200){
  return {
    ok:status >= 200 && status < 300,
    status,
    async text(){ return payload === null ? "" : JSON.stringify(payload); },
  };
}

function tokenRequest(token, { method = "GET", query = {}, body } = {}){
  const url = new URL("https://test.invalid/api/chat");
  Object.entries(query).forEach(([key, value]) => url.searchParams.set(key, value));
  return {
    method,
    url:url.href,
    headers:{ authorization:`Bearer ${token}` },
    ...(body === undefined ? {} : { body }),
  };
}

async function invoke(request){
  const response = responseStub();
  await chatHandler(request, response);
  return response;
}

function firstEligibleFixtureId(){
  const manifest = JSON.parse(fs.readFileSync("data/feed/manifest.json", "utf8"));
  for (const page of manifest.pages){
    const document = JSON.parse(fs.readFileSync(page.path, "utf8"));
    const event = document.events.find(item => chatHandler._test.fixtureIsUpcomingOrLive(item));
    if (event) return event.canonicalEventId || event.eventId || event.id;
  }
  throw new Error("The published feed needs at least one upcoming or live canonical fixture for chat validation.");
}

async function run(){
  assert.equal(chatContract.SCHEMA_VERSION, "private-fixture-chat.v1");
  assert.equal(chatContract.LIMITS.membersPerRoom, 25);
  assert.equal(chatContract.LIMITS.openRoomsPerFixture, 10);
  assert.equal(chatContract.LIMITS.messageCodePoints, 500);
  assert.equal(chatContract.LIMITS.messagesPerMinute, 30);
  assert.equal(chatContract.LIMITS.historyPage, 100);
  assert.equal(chatContract.POLLING.roomMs, 2000);
  assert.equal(chatContract.POLLING.activeMs, 30000);
  assert.equal(chatContract.POLLING.failureMs, 30000);
  assert.equal(chatContract.displayName(" A "), "", "one-character names must fail");
  assert.equal(chatContract.displayName("  Jack   Hartican "), "Jack Hartican");
  assert.equal(chatContract.messageBody("😀".repeat(500)), "😀".repeat(500), "the message ceiling must count Unicode code points");
  assert.equal(chatContract.messageBody("😀".repeat(501)), "");

  const sql = fs.readFileSync("supabase/private-fixture-chat.sql", "utf8");
  const api = fs.readFileSync("api/chat.js", "utf8");
  const client = fs.readFileSync("config/server-sync.js", "utf8");
  const html = fs.readFileSync("index.html", "utf8");
  const worker = fs.readFileSync("service-worker.js", "utf8");
  for (const table of ["profiles", "rooms", "members", "messages"]){
    assert.match(sql, new RegExp(`nothingsports_chat_${table}[\\s\\S]+enable row level security`, "i"));
    assert.match(sql, new RegExp(`nothingsports_chat_${table}[\\s\\S]+force row level security`, "i"));
  }
  assert.match(sql, /revoke all on table public\.nothingsports_chat_profiles from public, anon, authenticated/i);
  assert.match(sql, /grant select, insert, update, delete on table public\.nothingsports_chat_messages to service_role/i);
  assert.match(sql, /status = 'closed'[\s\S]+purge_at <= now\(\)/i);
  assert.match(sql, /'nothingsports-chat-purge-hourly'[\s\S]+'0 \* \* \* \*'/i);
  assert.match(sql, /old\.status = 'closed'[\s\S]+cannot be reopened/i);
  assert.match(sql, />= 30[\s\S]+Chat message rate limit exceeded/i);
  assert.match(sql, />= 25[\s\S]+at most 25 members/i);
  assert.match(sql, />= 10[\s\S]+at most 10 open chat rooms/i);
  assert.match(sql, /pg_advisory_xact_lock[\s\S]+nothingsports-chat-room-limit/);
  assert.match(sql, /pg_advisory_xact_lock[\s\S]+nothingsports-chat-member-limit/);
  assert.match(sql, /pg_advisory_xact_lock[\s\S]+nothingsports-chat-message-rate/);
  assert.match(sql, /from public\.nothingsports_chat_rooms[\s\S]+for update;/i);
  assert.match(sql, /from public\.nothingsports_chat_members[\s\S]+for key share;/i);
  assert.match(sql, /unread\.sender_id <> target_user/, "a member's own messages must not count as unread");
  assert.match(api, /CHAT_ADMIN_EMAILS/);
  assert.match(api, /authenticatedUser\(bearerToken\(request\)\)/);
  assert.match(api, /supabaseServiceRequest/);
  assert.doesNotMatch(api, /console\.(?:log|info|warn|error)/, "chat content must never enter ordinary server logs");
  assert.match(client, /async chatRequest\([\s\S]+authenticatedRequest\("\/api\/chat"/);
  assert.match(html, /id="activeChatsBtn"/);
  assert.match(html, /Set up chat/);
  assert.match(html, /`Chat · \$\{rooms\.length\}`/);
  assert.match(html, /class="chat-drawer"[\s\S]+role="dialog"[\s\S]+aria-modal="true"/);
  assert.match(html, /body\.textContent = message\.body/, "messages must render as plain text");
  assert.doesNotMatch(html, /chat-message-body[^\n]+innerHTML/, "message bodies must never render as HTML");
  assert.match(html, /Load older messages/);
  assert.match(html, /loadOlderChatMessages/);
  assert.match(html, /This room is closed\.[\s\S]+read-only transcript/);
  assert.match(html, /CHAT\.POLLING\.roomMs/);
  assert.match(html, /CHAT\.POLLING\.failureMs/);
  assert.match(html, /document\.visibilityState !== "visible" \|\| !navigator\.onLine/);
  assert.match(html, /document\.visibilityState !== "visible" \|\| !navigator\.onLine\)\{[\s\S]+Background — polling paused[\s\S]+return;/);
  assert.match(html, /event\.key === "Escape"/);
  assert.match(worker, /nothingsport-shell-v183/);
  assert.match(worker, /"\/config\/chat-contract\.js"/);

  const ids = {
    adminA:"11111111-1111-4111-8111-111111111111",
    adminB:"22222222-2222-4222-8222-222222222222",
    userA:"33333333-3333-4333-8333-333333333333",
    userB:"44444444-4444-4444-8444-444444444444",
    outsider:"55555555-5555-4555-8555-555555555555",
  };
  const accounts = [
    { id:ids.adminA, email:"admin.one@example.com" },
    { id:ids.adminB, email:"admin.two@example.com" },
    { id:ids.userA, email:"member.one@example.com" },
    { id:ids.userB, email:"member.two@example.com" },
    { id:ids.outsider, email:"outsider@example.com" },
  ];
  const tokenUsers = new Map(accounts.map(account => [`token-${account.id}`, account]));
  const profiles = new Map();
  const rooms = [];
  const members = [];
  const messages = [];
  let roomSequence = 1;
  let messageSequence = 1;
  let clockSequence = 0;
  const timestamp = () => new Date(Date.parse("2026-08-29T00:00:00.000Z") + clockSequence++ * 1000).toISOString();
  const parseBody = options => options.body ? JSON.parse(options.body) : null;
  const eq = value => String(value || "").replace(/^eq\./, "");

  const originalEnvironment = {
    url:process.env.SUPABASE_URL,
    key:process.env.SUPABASE_PUBLISHABLE_KEY,
    service:process.env.SUPABASE_SERVICE_ROLE_KEY,
    admins:process.env.CHAT_ADMIN_EMAILS,
  };
  const originalFetch = global.fetch;
  process.env.SUPABASE_URL = "https://project-ref.supabase.co";
  process.env.SUPABASE_PUBLISHABLE_KEY = "publishable-test";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-test";
  process.env.CHAT_ADMIN_EMAILS = "admin.one@example.com,admin.two@example.com";

  global.fetch = async (input, options = {}) => {
    const url = new URL(input);
    const body = parseBody(options);
    if (url.pathname === "/auth/v1/user"){
      const token = String(options.headers?.Authorization || "").replace(/^Bearer\s+/, "");
      const user = tokenUsers.get(token);
      return user ? fetchResponse(user) : fetchResponse({ code:"invalid_access_token", message:"Invalid session" }, 401);
    }
    if (url.pathname === "/auth/v1/admin/users") return fetchResponse({ users:accounts });
    if (url.pathname === "/rest/v1/rpc/nothingsports_chat_create_room"){
      const id = `aaaaaaaa-aaaa-4aaa-8aaa-${String(roomSequence++).padStart(12, "0")}`;
      const createdAt = timestamp();
      rooms.push({
        id,
        canonical_fixture_id:body.target_fixture_id,
        fixture_snapshot:body.target_fixture_snapshot,
        room_name:body.target_room_name,
        created_by:body.target_creator,
        status:"open",
        closed_at:null,
        purge_at:null,
        created_at:createdAt,
        updated_at:createdAt,
      });
      body.target_members.forEach(userId => members.push({ room_id:id, user_id:userId, added_by:body.target_creator, joined_at:createdAt, last_read_at:createdAt }));
      return fetchResponse(id);
    }
    if (url.pathname === "/rest/v1/rpc/nothingsports_chat_active_rooms"){
      const ownMemberships = new Map(members.filter(member => member.user_id === body.target_user).map(member => [member.room_id, member]));
      return fetchResponse(rooms.filter(room => room.status === "open" && (body.include_admin_rooms || ownMemberships.has(room.id))).map(room => {
        const own = ownMemberships.get(room.id);
        return {
          room_id:room.id,
          canonical_fixture_id:room.canonical_fixture_id,
          fixture_snapshot:room.fixture_snapshot,
          room_name:room.room_name,
          member_count:members.filter(member => member.room_id === room.id).length,
          unread_count:own ? messages.filter(message => message.room_id === room.id && message.created_at > own.last_read_at).length : 0,
          last_message_at:messages.filter(message => message.room_id === room.id).at(-1)?.created_at || null,
          created_at:room.created_at,
        };
      }));
    }
    const table = url.pathname.split("/").at(-1);
    if (table === "nothingsports_chat_profiles"){
      if (options.method === "POST"){
        const previous = profiles.get(body.user_id) || {};
        const saved = { ...previous, ...body };
        profiles.set(body.user_id, saved);
        return fetchResponse([saved]);
      }
      const rawUserId = url.searchParams.get("user_id") || "";
      if (rawUserId.startsWith("in.(")){
        const selectedIds = rawUserId.slice(4, -1).split(",");
        return fetchResponse(selectedIds.map(id => profiles.get(id)).filter(Boolean));
      }
      const userId = eq(rawUserId);
      const profile = profiles.get(userId);
      return fetchResponse(profile ? [profile] : []);
    }
    if (table === "nothingsports_chat_rooms"){
      const roomId = eq(url.searchParams.get("id"));
      const room = rooms.find(item => item.id === roomId);
      if (options.method === "PATCH"){
        if (!room) return fetchResponse([]);
        if (room.status === "closed") return fetchResponse({ message:"Closed room" }, 409);
        Object.assign(room, body);
        if (body.status === "closed"){
          room.closed_at = timestamp();
          room.purge_at = new Date(Date.parse(room.closed_at) + 7 * 86400000).toISOString();
        }
        return fetchResponse([room]);
      }
      return fetchResponse(room ? [room] : []);
    }
    if (table === "nothingsports_chat_members"){
      const roomId = eq(url.searchParams.get("room_id"));
      const userId = eq(url.searchParams.get("user_id"));
      if (options.method === "DELETE"){
        for (let index = members.length - 1; index >= 0; index -= 1){
          if (members[index].room_id === roomId && members[index].user_id === userId) members.splice(index, 1);
        }
        return fetchResponse(null);
      }
      if (options.method === "PATCH"){
        members.filter(member => member.room_id === roomId && member.user_id === userId).forEach(member => Object.assign(member, body));
        return fetchResponse(null);
      }
      if (options.method === "POST"){
        const additions = Array.isArray(body) ? body : [body];
        additions.forEach(member => {
          if (!members.some(existing => existing.room_id === member.room_id && existing.user_id === member.user_id)){
            members.push({ ...member, joined_at:timestamp(), last_read_at:timestamp() });
          }
        });
        return fetchResponse([]);
      }
      return fetchResponse(members.filter(member => (!roomId || member.room_id === roomId) && (!userId || member.user_id === userId)));
    }
    if (table === "nothingsports_chat_messages"){
      const roomId = eq(url.searchParams.get("room_id"));
      const senderId = eq(url.searchParams.get("sender_id"));
      const clientId = eq(url.searchParams.get("client_id"));
      if (options.method === "POST"){
        const recent = messages.filter(message => message.room_id === body.room_id && message.sender_id === body.sender_id);
        if (recent.length >= chatContract.LIMITS.messagesPerMinute) return fetchResponse({ code:"rate_limited", message:"Too many messages" }, 429);
        const duplicate = messages.find(message => message.room_id === body.room_id && message.sender_id === body.sender_id && message.client_id === body.client_id);
        if (duplicate) return fetchResponse([]);
        const id = `bbbbbbbb-bbbb-4bbb-8bbb-${String(messageSequence++).padStart(12, "0")}`;
        const saved = { id, ...body, created_at:timestamp() };
        messages.push(saved);
        return fetchResponse([saved]);
      }
      let selected = messages.filter(message => (!roomId || message.room_id === roomId) && (!senderId || message.sender_id === senderId) && (!clientId || message.client_id === clientId));
      const createdFilter = url.searchParams.get("created_at") || "";
      const after = createdFilter.startsWith("gt.") ? createdFilter.slice(3) : "";
      const before = createdFilter.startsWith("lt.") ? createdFilter.slice(3) : "";
      if (after) selected = selected.filter(message => message.created_at > after);
      if (before) selected = selected.filter(message => message.created_at < before);
      if (String(url.searchParams.get("order") || "").startsWith("created_at.desc")) selected.reverse();
      return fetchResponse(selected.slice(0, Number(url.searchParams.get("limit") || 100)));
    }
    return fetchResponse({ message:`Unexpected test request ${url.pathname}` }, 500);
  };

  try{
    const missing = await invoke({ method:"GET", url:"https://test.invalid/api/chat?mode=active", headers:{} });
    assert.equal(missing.statusCode, 401, "missing sessions must fail closed");
    assert.equal(missing.headers["Cache-Control"], "private, no-store, max-age=0");

    const deniedSearch = await invoke(tokenRequest(`token-${ids.userA}`, { query:{ mode:"users", q:"mem" } }));
    assert.equal(deniedSearch.statusCode, 403, "ordinary users must not access the email account picker");

    const adminSearch = await invoke(tokenRequest(`token-${ids.adminA}`, { query:{ mode:"users", q:"member" } }));
    assert.equal(adminSearch.statusCode, 200);
    assert.equal(adminSearch.body.users.length, 2);
    assert(adminSearch.body.users.every(user => user.email.endsWith("@example.com")), "emails may appear in the admin-only picker");

    const fixtureId = firstEligibleFixtureId();
    const create = async (name, memberIds) => invoke(tokenRequest(`token-${ids.adminA}`, {
      method:"POST",
      body:{ action:"create-room", canonicalFixtureId:fixtureId, roomName:name, memberIds },
    }));
    const firstRoom = await create("Friends", [ids.userA, ids.userB]);
    const secondRoom = await create("Second screen", [ids.userB]);
    assert.equal(firstRoom.statusCode, 200);
    assert.equal(secondRoom.statusCode, 200, "multiple rooms per fixture must be supported");
    assert.notEqual(firstRoom.body.room.roomId, secondRoom.body.room.roomId);

    const activeMember = await invoke(tokenRequest(`token-${ids.userB}`, { query:{ mode:"active" } }));
    assert.equal(activeMember.body.rooms.length, 2, "membership, not follows, must drive Active chats");
    const activeAdmin = await invoke(tokenRequest(`token-${ids.adminB}`, { query:{ mode:"active" } }));
    assert.equal(activeAdmin.body.rooms.length, 2, "every allowlisted admin may inspect open rooms");

    const roomId = firstRoom.body.room.roomId;
    const isolated = await invoke(tokenRequest(`token-${ids.outsider}`, { query:{ roomId } }));
    assert.equal(isolated.statusCode, 403, "non-members must not read a room");

    const name = await invoke(tokenRequest(`token-${ids.userA}`, { method:"POST", body:{ action:"set-display-name", displayName:"Member One" } }));
    assert.equal(name.statusCode, 200);
    const clientId = "message-idempotent-0001";
    const send = () => invoke(tokenRequest(`token-${ids.userA}`, { method:"POST", body:{ action:"send-message", roomId, clientId, body:"Hello 😀" } }));
    const sent = await send();
    const repeated = await send();
    assert.equal(sent.statusCode, 200);
    assert.equal(repeated.statusCode, 200);
    assert.equal(messages.filter(message => message.client_id === clientId).length, 1, "idempotent sends must create one row");

    const roomRead = await invoke(tokenRequest(`token-${ids.userB}`, { query:{ roomId } }));
    assert.equal(roomRead.statusCode, 200);
    assert.equal(roomRead.body.messages[0].body, "Hello 😀");
    assert.equal(roomRead.body.messages[0].senderName, "Member One");
    assert.equal(Object.hasOwn(roomRead.body.messages[0], "email"), false, "members must receive display names without emails");

    const longMessage = await invoke(tokenRequest(`token-${ids.userA}`, { method:"POST", body:{ action:"send-message", roomId, clientId:"too-long-message", body:"😀".repeat(501) } }));
    assert.equal(longMessage.statusCode, 400);
    while (messages.filter(message => message.room_id === roomId && message.sender_id === ids.userA).length < 30){
      messages.push({
        id:`cccccccc-cccc-4ccc-8ccc-${String(messageSequence++).padStart(12, "0")}`,
        room_id:roomId,
        sender_id:ids.userA,
        client_id:`rate-limit-${String(messageSequence).padStart(4, "0")}`,
        message_type:"text",
        body:"Rate test",
        created_at:timestamp(),
      });
    }
    const limited = await invoke(tokenRequest(`token-${ids.userA}`, { method:"POST", body:{ action:"send-message", roomId, clientId:"rate-limit-final", body:"One too many" } }));
    assert.equal(limited.statusCode, 429, "the per-user, per-room minute ceiling must return rate limited");
    while (messages.filter(message => message.room_id === roomId).length < 105){
      messages.push({
        id:`dddddddd-dddd-4ddd-8ddd-${String(messageSequence++).padStart(12, "0")}`,
        room_id:roomId,
        sender_id:ids.userA,
        client_id:`history-page-${String(messageSequence).padStart(4, "0")}`,
        message_type:"text",
        body:"History test",
        created_at:timestamp(),
      });
    }
    const latestPage = await invoke(tokenRequest(`token-${ids.adminB}`, { query:{ roomId } }));
    assert.equal(latestPage.body.messages.length, 100, "initial history must return the newest 100 messages");
    assert(latestPage.body.olderCursor, "a full history page must expose an older cursor");
    const olderPage = await invoke(tokenRequest(`token-${ids.adminB}`, { query:{ roomId, before:latestPage.body.olderCursor } }));
    assert.equal(olderPage.body.messages.length, 5, "the older cursor must retrieve the remaining history");
    assert.equal(olderPage.body.olderCursor, null);

    const deniedManage = await invoke(tokenRequest(`token-${ids.userB}`, { method:"POST", body:{ action:"add-members", roomId, memberIds:[ids.outsider] } }));
    assert.equal(deniedManage.statusCode, 403, "ordinary members must not manage rooms");
    const removed = await invoke(tokenRequest(`token-${ids.adminA}`, { method:"POST", body:{ action:"remove-member", roomId, accountId:ids.userA } }));
    assert.equal(removed.statusCode, 200);
    const removedRead = await invoke(tokenRequest(`token-${ids.userA}`, { query:{ roomId } }));
    assert.equal(removedRead.statusCode, 403, "removed-member denial must take effect immediately");

    const closed = await invoke(tokenRequest(`token-${ids.adminB}`, { method:"POST", body:{ action:"close-room", roomId } }));
    assert.equal(closed.statusCode, 200);
    assert.equal(closed.body.room.status, "closed");
    assert.equal(Date.parse(closed.body.room.purgeAt) - Date.parse(closed.body.room.closedAt), 7 * 86400000);
    const closedMember = await invoke(tokenRequest(`token-${ids.userB}`, { query:{ roomId } }));
    assert.equal(closedMember.statusCode, 403, "members must lose reads immediately after closure");
    const closedAdmin = await invoke(tokenRequest(`token-${ids.adminA}`, { query:{ roomId } }));
    assert.equal(closedAdmin.statusCode, 200);
    assert.equal(closedAdmin.body.room.readOnly, true, "admins retain read-only closed transcript access");
    const closedWrite = await invoke(tokenRequest(`token-${ids.adminA}`, { method:"POST", body:{ action:"send-message", roomId, clientId:"closed-write-001", body:"No" } }));
    assert.equal(closedWrite.statusCode, 409, "closed rooms must reject all posting");

    const tooManyMembers = Array.from({ length:26 }, (_, index) => `90000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`);
    const memberLimit = await create("Too large", tooManyMembers);
    assert.equal(memberLimit.statusCode, 409);
    assert.equal(memberLimit.body.code, "chat_member_limit");
  } finally {
    global.fetch = originalFetch;
    if (originalEnvironment.url === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = originalEnvironment.url;
    if (originalEnvironment.key === undefined) delete process.env.SUPABASE_PUBLISHABLE_KEY; else process.env.SUPABASE_PUBLISHABLE_KEY = originalEnvironment.key;
    if (originalEnvironment.service === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = originalEnvironment.service;
    if (originalEnvironment.admins === undefined) delete process.env.CHAT_ADMIN_EMAILS; else process.env.CHAT_ADMIN_EMAILS = originalEnvironment.admins;
  }

  console.log("Private fixture chat validation passed: forced server boundary, admin controls, isolation, idempotency, limits, closure and polling UI.");
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
