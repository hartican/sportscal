#!/usr/bin/env node

"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const webpush = require("web-push");
const chatContract = require("../config/chat-contract");
const chatHandler = require("../api/chat");
const { dispatchChatMessageNotifications, _test:chatNotificationTest } = require("../lib/chat-notifications");

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
  assert.equal(chatContract.SCHEMA_VERSION, "private-fixture-chat.v2");
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
  assert.equal(chatContract.reactionEmoji("❤️"), "❤️");
  assert.equal(chatContract.reactionEmoji("🔥"), "");

  const sql = fs.readFileSync("supabase/private-fixture-chat.sql", "utf8");
  const api = fs.readFileSync("api/chat.js", "utf8");
  const authApi = fs.readFileSync("api/auth.js", "utf8");
  const capabilitySource = fs.readFileSync("lib/chat-capability.js", "utf8");
  const notifications = fs.readFileSync("lib/chat-notifications.js", "utf8");
  const client = fs.readFileSync("config/server-sync.js", "utf8");
  const html = fs.readFileSync("index.html", "utf8");
  const worker = fs.readFileSync("service-worker.js", "utf8");
  const vercel = JSON.parse(fs.readFileSync("vercel.json", "utf8"));
  const feedManifest = JSON.parse(fs.readFileSync("data/feed/manifest.json", "utf8"));
  for (const table of ["profiles", "rooms", "members", "messages", "reactions", "notification_deliveries", "anonymous_session_limits", "anonymous_signup_tickets"]){
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
  assert.match(sql, /guest_share_version[\s\S]+guest_share_nonce/i);
  assert.match(sql, /nothingsports_chat_configure_guest_share[\s\S]+member_kind = 'guest'/i, "disabling sharing must revoke guest memberships atomically");
  assert.match(sql, /nothingsports_chat_join_shared_room[\s\S]+where id = target_room[\s\S]+for update[\s\S]+guest_share_version <> target_version[\s\S]+current_count >= 25[\s\S]+insert into public\.nothingsports_chat_members/i,"shared joins must lock and recheck the capability and capacity before insertion");
  assert.match(sql, /nothingsports_chat_authorize_anonymous_session[\s\S]+for share[\s\S]+nothingsports_chat_anonymous_session_limits[\s\S]+request_count < 10/i,"anonymous identity creation must consume a durable per-room rate gate only after a locked capability check");
  assert.match(sql,/nothingsports_chat_authorize_anonymous_session\([\s\S]+target_ticket_hash text[\s\S]+accepted_count is null[\s\S]+insert into public\.nothingsports_chat_anonymous_signup_tickets[\s\S]+interval '5 minutes'/i,"only an authorized, rate-limited capability request may persist a five-minute signup-ticket hash");
  assert.match(sql,/create table if not exists public\.nothingsports_chat_anonymous_signup_tickets[\s\S]+ticket_hash text primary key[\s\S]+expires_at > issued_at[\s\S]+expires_at <= issued_at \+ interval '5 minutes'/i);
  assert.match(sql,/nothingsports_chat_anonymous_signup_tickets_room_idx[\s\S]+\(room_id\)/i,"the one-use ticket room foreign key must have a covering index");
  assert.doesNotMatch(sql,/nothingsports_chat_anonymous_signup_tickets[\s\S]{0,350}\n\s*(?:raw_)?ticket\s+text/i,"anonymous signup tickets must be stored only as SHA-256 hashes");
  assert.match(sql,/nothingsports_before_user_created\(event jsonb\)[\s\S]+is_anonymous[^\n]+distinct from 'true'[\s\S]+return '\{\}'::jsonb[\s\S]+chat_signup_ticket[\s\S]+delete from public\.nothingsports_chat_anonymous_signup_tickets[\s\S]+expires_at > clock_timestamp\(\)[\s\S]+http_code', 403/i,"the Before User Created hook must allow ordinary users and atomically consume one valid unexpired anonymous ticket");
  assert.match(sql,/pg_catalog\.sha256\(pg_catalog\.convert_to\(signup_ticket, 'UTF8'\)\)/i,"the invoker hook must hash tickets with a pg_catalog function available to supabase_auth_admin");
  assert.doesNotMatch(sql,/extensions\.digest\(signup_ticket/i,"the Auth hook must not depend on extension-schema privileges unavailable to supabase_auth_admin");
  assert.match(sql,/revoke all on function public\.nothingsports_before_user_created\(jsonb\) from public, anon, authenticated, service_role[\s\S]+grant execute on function public\.nothingsports_before_user_created\(jsonb\) to supabase_auth_admin/i,"only Supabase Auth may invoke the signup hook");
  assert.match(sql,/auth hook consumes anonymous signup tickets[\s\S]+for delete to supabase_auth_admin/i);
  assert.match(sql,/delete from public\.nothingsports_chat_anonymous_signup_tickets[\s\S]+expires_at <= now\(\)/i,"expired one-use tickets must be cleaned automatically");
  assert.match(sql, /ip_hash text[\s\S]+\^\[0-9a-f\]\{64\}\$/i);
  assert.doesNotMatch(sql,/anonymous_session_limits[\s\S]{0,300}\b(?:raw_ip|ip_address)\b/i,"the anonymous limiter must never store raw IP addresses");
  assert.match(sql, /reply_to_message_id[\s\S]+Replies must target a message in the same chat room/i);
  assert.match(sql, /emoji in \('👍', '❤️', '😂', '😮', '😢', '👏'\)/);
  assert.match(sql, /nothingsports_chat_notification_deliveries[\s\S]+Message senders cannot receive their own chat notification/i);
  assert.match(sql, /nothingsports_chat_claim_notification_delivery[\s\S]+claimed_at is null or claimed_at < target_stale_before/i);
  assert.match(sql, /nothingsports_chat_unread_totals\(target_users uuid\[\]\)[\s\S]+unread\.sender_id <> requested\.user_id[\s\S]+unread\.created_at > membership\.last_read_at/i);
  assert.match(sql, /revoke all on function public\.nothingsports_chat_unread_totals\(uuid\[\]\) from public, anon, authenticated/i);
  assert.match(sql, /grant execute on function public\.nothingsports_chat_unread_totals\(uuid\[\]\) to service_role/i);
  assert.match(sql, /badges_enabled boolean not null default true/i);
  assert.match(notifications, /chat_alerts_enabled=eq\.true/, "chat push must exclude installations that explicitly opted out");
  assert.match(sql, /is_anonymous is true[\s\S]+interval '30 days'/i);
  assert.match(api, /CHAT_ADMIN_EMAILS/);
  assert.match(api, /authenticatedUser\(bearerToken\(request\)\)/);
  assert.match(api, /supabaseServiceRequest/);
  assert.doesNotMatch(api, /console\.(?:log|info|warn|error)/, "chat content must never enter ordinary server logs");
  assert.match(capabilitySource,/randomBytes\(32\)/i);
  assert.match(capabilitySource,/anonymousSignupTicketHash[\s\S]+createHash\("sha256"\)/i);
  assert.match(authApi,/target_ticket_hash:signupTicket\.hash[\s\S]+chat_signup_ticket:signupTicket\.ticket/i);
  assert.match(authApi,/SUPABASE_SECRET_KEY[\s\S]+"Sb-Forwarded-For":clientAddress\(request\)[\s\S]+grant_type=refresh_token/i,"anonymous signup and refresh must use secret-key client-IP forwarding");
  assert.match(authApi,/refresh-anonymous-chat-session[\s\S]+anonymousAuthRequest\(request,"\/auth\/v1\/token\?grant_type=refresh_token"/i,"later anonymous refreshes must retain secret-key client-IP forwarding");
  assert.match(authApi,/user_metadata:\{purpose:"fixture-chat-guest",chat_signup_ticket:null\}[\s\S]+chat_guest_attested:true/i,"the server must clear the raw ticket and attest the guest before returning its refreshed session");
  assert.doesNotMatch(authApi,/console\.(?:log|info|warn|error)/,"anonymous signup tickets and secret keys must never enter ordinary server logs");
  assert.match(api,/requireAttestedAnonymousGuest\(user\)[\s\S]+chat_guest_attested[\s\S]+member_kind:"eq\.guest"[\s\S]+chat_guest_session_invalid/i,"directly minted anonymous identities must be rejected while established pre-release guests can be attested from durable membership");
  assert.match(capabilitySource, /createHmac\("sha256"/);
  assert.match(capabilitySource, /timingSafeEqual/);
  assert.match(api, /changedQuery\.updated_at = `gte\.\$\{after\}`/, "reaction polling must include simultaneous rows at the cursor instant");
  assert.match(api, /messageQuery\.created_at = `gte\.\$\{after\}`/, "message polling must include simultaneous rows at the cursor instant");
  assert.doesNotMatch(api, /console\.(?:log|info|warn|error)[^\n]*capability/i, "share credentials must never enter server logs");
  const chatIncludeFiles = vercel.functions?.["api/chat.js"]?.includeFiles || "";
  assert.match(chatIncludeFiles, /feed\/\*\.json/, "the deployed chat function must include canonical fixture pages");
  assert.match(chatIncludeFiles, /follow-fixtures\.v1\.json/, "chat must include followed fixtures whose exact start is not yet known");
  assert.match(chatIncludeFiles, /major-events\.v1\.json/, "chat must include the surfaced Event schedule");
  assert.match(api, /require\("@vercel\/functions"\)/, "chat must use the Vercel request-lifetime API");
  assert.match(api, /const notificationFanout = dispatchChatMessageNotifications\([\s\S]{0,300}waitUntil\(notificationFanout\)/, "push fan-out must continue after the message acknowledgement instead of blocking it");
  feedManifest.pages.forEach(page => {
    assert.match(page.path, /^data\/feed\/[^/]+\.json$/, "every chat fixture page must match the Vercel includeFiles glob");
    assert(fs.existsSync(page.path), `chat fixture page must exist: ${page.path}`);
  });
  assert.throws(
    () => chatHandler._test.loadFixtureMap(() => { throw new Error("missing fixture bundle"); }),
    error => error?.status === 503 && error?.code === "chat_fixture_data_unavailable" && error?.message === "Chat fixture data is temporarily unavailable.",
    "missing deployed fixture files must return a safe, specific chat error"
  );
  assert.match(client, /async chatRequest\([\s\S]+chatAuthenticatedRequest\([`"]\/api\/chat/);
  assert.match(client, /async chatGuestPreview\([\s\S]+jsonRequest\("\/api\/chat"/);
  assert.match(client, /async anonymousChatSession\(\{ capability = "", guestDisplayName = "" \}[\s\S]+action:"anonymous-chat-session"[\s\S]+capability:String\(capability[\s\S]+guestDisplayName:String\(guestDisplayName/);
  assert.doesNotMatch(client,/captchaToken|captcha_token|captchaSiteKey/,"the client must not advertise an unimplemented CAPTCHA challenge");
  assert.match(client,/refreshGuestChatSession[\s\S]+action:"refresh-anonymous-chat-session"/i,"guest refresh must remain distinct from ordinary account refresh");
  assert.match(html, /const anonymousSession = await serverSyncClient\.anonymousChatSession[\s\S]+anonymousSession\.joined && anonymousSession\.room\?\.roomId[\s\S]+: await serverSyncClient\.chatRequest/, "a newly minted and atomically joined guest must not repeat the capability join after rotation");
  assert.match(html, /id="activeChatsBtn"/);
  assert.match(html, /chat\.textContent = "Chat"/);
  assert.match(html, /if \(rooms\.length\) openFixtureChats\(event\);[\s\S]+else openChatSetup\(event\);/);
  assert.match(html, /class="chat-drawer"[\s\S]+role="dialog"[\s\S]+aria-modal="true"/);
  assert.match(html, /body\.textContent = message\.body/, "messages must render as plain text");
  assert.doesNotMatch(html, /chat-message-body[^\n]+innerHTML/, "message bodies must never render as HTML");
  assert.match(html, /Load older messages/);
  assert.match(html, /loadOlderChatMessages/);
  assert.match(html, /Closed and read-only\.[\s\S]+administrators retain this archive for seven days/);
  assert.match(html, /CHAT\.POLLING\.roomMs/);
  assert.match(html, /CHAT\.POLLING\.failureMs/);
  assert.match(html, /document\.visibilityState !== "visible" \|\| !navigator\.onLine/);
  assert.match(html, /document\.visibilityState !== "visible" \|\| !navigator\.onLine\)\{[\s\S]+Background — polling paused[\s\S]+return;/);
  assert.match(html, /event\.key === "Escape"/);
  assert.match(html, /\.chat-composer\[hidden\]\{ display:none; \}/, "the message composer must stay hidden during room setup");
  assert.match(html, /copy\.className = "chat-user-copy"/);
  assert.match(html, /name\.className = "chat-user-name"/);
  assert.match(html, /email\.className = "chat-user-email"/, "member names and email addresses must render as separate rows");
  assert.match(worker, /nothingsport-shell-v226/);
  assert.equal(html.match(/name="app-shell-version" content="(\d+)"/)?.[1], "226");
  assert.match(worker, /"\/config\/chat-contract\.js"/);

  const ids = {
    adminA:"11111111-1111-4111-8111-111111111111",
    adminB:"22222222-2222-4222-8222-222222222222",
    userA:"33333333-3333-4333-8333-333333333333",
    userB:"44444444-4444-4444-8444-444444444444",
    outsider:"55555555-5555-4555-8555-555555555555",
    guest:"66666666-6666-4666-8666-666666666666",
    rogueGuest:"77777777-7777-4777-8777-777777777777",
    legacyGuest:"88888888-8888-4888-8888-888888888888",
  };
  const accounts = [
    { id:ids.adminA, email:"admin.one@example.com", email_confirmed_at:"2026-08-01T00:00:00.000Z" },
    { id:ids.adminB, email:"admin.two@example.com", email_confirmed_at:"2026-08-01T00:00:00.000Z" },
    { id:ids.userA, email:"member.one@example.com", email_confirmed_at:"2026-08-01T00:00:00.000Z" },
    { id:ids.userB, email:"member.two@example.com", email_confirmed_at:"2026-08-01T00:00:00.000Z" },
    { id:ids.outsider, email:"outsider@example.com", email_confirmed_at:"2026-08-01T00:00:00.000Z" },
    { id:ids.guest, email:"", is_anonymous:true, app_metadata:{chat_guest_attested:true} },
    { id:ids.rogueGuest, email:"", is_anonymous:true, app_metadata:{} },
    { id:ids.legacyGuest, email:"", is_anonymous:true, app_metadata:{} },
  ];
  const tokenUsers = new Map(accounts.map(account => [`token-${account.id}`, account]));
  const profiles = new Map();
  const publicProfiles = new Map([
    [ids.userA, { user_id:ids.userA, display_name:"Public Member One", handle:"member_one", visibility:"visible" }],
    [ids.userB, { user_id:ids.userB, display_name:"Public Member Two", handle:"member_two", visibility:"visible" }],
  ]);
  const rooms = [];
  const members = [];
  const messages = [];
  const reactions = [];
  let roomSequence = 1;
  let messageSequence = 1;
  let reactionSequence = 1;
  let clockSequence = 0;
  const timestamp = () => new Date(Date.parse("2026-08-29T00:00:00.000Z") + clockSequence++ * 1000).toISOString();
  const parseBody = options => options.body ? JSON.parse(options.body) : null;
  const eq = value => String(value || "").replace(/^eq\./, "");

  const originalEnvironment = {
    url:process.env.SUPABASE_URL,
    key:process.env.SUPABASE_PUBLISHABLE_KEY,
    service:process.env.SUPABASE_SERVICE_ROLE_KEY,
    admins:process.env.CHAT_ADMIN_EMAILS,
    shareSecret:process.env.CHAT_GUEST_LINK_SECRET,
  };
  const originalFetch = global.fetch;
  process.env.SUPABASE_URL = "https://project-ref.supabase.co";
  process.env.SUPABASE_PUBLISHABLE_KEY = "publishable-test";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-test";
  process.env.CHAT_ADMIN_EMAILS = "admin.one@example.com,admin.two@example.com";
  process.env.CHAT_GUEST_LINK_SECRET = "test-only-chat-share-secret-00000000000000000000";

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
        guest_share_enabled:false,
        guest_share_version:0,
        guest_share_nonce:null,
        guest_share_enabled_at:null,
        guest_share_disabled_at:null,
        created_at:createdAt,
        updated_at:createdAt,
      });
      body.target_members.forEach(userId => members.push({ room_id:id, user_id:userId, added_by:body.target_creator, member_kind:"account", guest_display_name:null, joined_at:createdAt, last_read_at:createdAt }));
      return fetchResponse(id);
    }
    if (url.pathname === "/rest/v1/rpc/nothingsports_chat_configure_guest_share"){
      const room = rooms.find(item => item.id === body.target_room);
      if (!room) return fetchResponse({ message:"Chat room not found" }, 404);
      if (body.target_enabled){
        if (!room.guest_share_enabled || body.target_rotate){
          room.guest_share_enabled = true;
          room.guest_share_version += 1;
          room.guest_share_nonce = body.target_nonce;
          room.guest_share_enabled_at = timestamp();
          room.guest_share_disabled_at = null;
        }
      } else {
        room.guest_share_enabled = false;
        room.guest_share_disabled_at = timestamp();
        for (let index = members.length - 1; index >= 0; index -= 1){
          if (members[index].room_id === room.id && members[index].member_kind === "guest") members.splice(index, 1);
        }
      }
      return fetchResponse([room]);
    }
    if (url.pathname === "/rest/v1/rpc/nothingsports_chat_join_shared_room"){
      const room=rooms.find(item=>item.id===body.target_room);
      if(!room)return fetchResponse([{outcome:"invalid",existing_member:false,member_count:0}]);
      if(room.status!=="open")return fetchResponse([{outcome:"closed",existing_member:false,member_count:0}]);
      if(!room.guest_share_enabled||room.guest_share_version!==body.target_version||room.guest_share_nonce!==body.target_nonce){
        return fetchResponse([{outcome:"invalid",existing_member:false,member_count:0}]);
      }
      const existing=members.find(item=>item.room_id===room.id&&item.user_id===body.target_user);
      if(existing){
        if(existing.member_kind==="guest"&&body.target_member_kind==="guest")existing.guest_display_name=body.target_guest_display_name;
        return fetchResponse([{outcome:"existing",existing_member:true,member_count:members.filter(item=>item.room_id===room.id).length}]);
      }
      const roomMembers=members.filter(item=>item.room_id===room.id);
      if(roomMembers.length>=25)return fetchResponse([{outcome:"full",existing_member:false,member_count:roomMembers.length}]);
      members.push({room_id:room.id,user_id:body.target_user,added_by:body.target_user,member_kind:body.target_member_kind,guest_display_name:body.target_guest_display_name,joined_at:timestamp(),last_read_at:timestamp()});
      return fetchResponse([{outcome:"joined",existing_member:false,member_count:roomMembers.length+1}]);
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
    if (table === "nothingsports_nsc_profiles"){
      const rawUserId = url.searchParams.get("user_id") || "";
      if (rawUserId.startsWith("in.(")){
        const selectedIds = rawUserId.slice(4, -1).split(",");
        return fetchResponse(selectedIds.map(id => publicProfiles.get(id)).filter(Boolean));
      }
      const profile = publicProfiles.get(eq(rawUserId));
      return fetchResponse(profile ? [profile] : []);
    }
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
    if (table === "nothingsports_nsc_points") return fetchResponse([]);
    if (table === "nothingsports_chat_attachments") return fetchResponse([]);
    if (table === "nothingsports_saved_game_media") return fetchResponse([]);
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
      const messageId = eq(url.searchParams.get("id"));
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
      let selected = messages.filter(message => (!messageId || message.id === messageId) && (!roomId || message.room_id === roomId) && (!senderId || message.sender_id === senderId) && (!clientId || message.client_id === clientId));
      const createdFilter = url.searchParams.get("created_at") || "";
      const inclusiveAfter = createdFilter.startsWith("gte.") ? createdFilter.slice(4) : "";
      const after = createdFilter.startsWith("gt.") ? createdFilter.slice(3) : "";
      const before = createdFilter.startsWith("lt.") ? createdFilter.slice(3) : "";
      if (inclusiveAfter) selected = selected.filter(message => message.created_at >= inclusiveAfter);
      if (after) selected = selected.filter(message => message.created_at > after);
      if (before) selected = selected.filter(message => message.created_at < before);
      if (String(url.searchParams.get("order") || "").startsWith("created_at.desc")) selected.reverse();
      return fetchResponse(selected.slice(0, Number(url.searchParams.get("limit") || 100)));
    }
    if (table === "nothingsports_chat_reactions"){
      const reactionId = eq(url.searchParams.get("reaction_id"));
      const roomId = eq(url.searchParams.get("room_id"));
      const rawMessageId = url.searchParams.get("message_id") || "";
      const messageIds = rawMessageId.startsWith("in.(") ? rawMessageId.slice(4, -1).split(",") : [];
      const messageId = messageIds.length ? "" : eq(rawMessageId);
      const actorId = eq(url.searchParams.get("actor_id"));
      const emoji = eq(url.searchParams.get("emoji"));
      if (options.method === "POST"){
        const previous = reactions.find(item => item.message_id === body.message_id && item.actor_id === body.actor_id && item.emoji === body.emoji);
        if (previous){
          Object.assign(previous, body, { updated_at:timestamp() });
          return fetchResponse([previous]);
        }
        const saved = {
          reaction_id:`eeeeeeee-eeee-4eee-8eee-${String(reactionSequence++).padStart(12, "0")}`,
          ...body,
          created_at:timestamp(),
          updated_at:timestamp(),
        };
        reactions.push(saved);
        return fetchResponse([saved]);
      }
      if (options.method === "PATCH"){
        const selected = reactions.filter(item => !reactionId || item.reaction_id === reactionId);
        selected.forEach(item => Object.assign(item, body, { updated_at:timestamp() }));
        return fetchResponse(selected);
      }
      let selected = reactions.filter(item => (
        (!reactionId || item.reaction_id === reactionId)
        && (!roomId || item.room_id === roomId)
        && (!messageId || item.message_id === messageId)
        && (!messageIds.length || messageIds.includes(item.message_id))
        && (!actorId || item.actor_id === actorId)
        && (!emoji || item.emoji === emoji)
      ));
      if (url.searchParams.get("active") === "eq.true") selected = selected.filter(item => item.active);
      const updatedFilter = String(url.searchParams.get("updated_at") || "");
      const inclusiveAfter = updatedFilter.startsWith("gte.") ? updatedFilter.slice(4) : "";
      const after = updatedFilter.startsWith("gt.") ? updatedFilter.slice(3) : "";
      if (inclusiveAfter) selected = selected.filter(item => item.updated_at >= inclusiveAfter);
      if (after) selected = selected.filter(item => item.updated_at > after);
      return fetchResponse(selected);
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
    members.push({
      room_id:secondRoom.body.room.roomId,user_id:ids.legacyGuest,added_by:ids.adminA,
      member_kind:"guest",guest_display_name:"Earlier Guest",joined_at:timestamp(),last_read_at:timestamp(),
    });

    const activeMember = await invoke(tokenRequest(`token-${ids.userB}`, { query:{ mode:"active" } }));
    assert.equal(activeMember.body.rooms.length, 2, "membership, not follows, must drive Active chats");
    const activeAdmin = await invoke(tokenRequest(`token-${ids.adminB}`, { query:{ mode:"active" } }));
    assert.equal(activeAdmin.body.rooms.length, 2, "every allowlisted admin may inspect open rooms");

    const roomId = firstRoom.body.room.roomId;
    const isolated = await invoke(tokenRequest(`token-${ids.outsider}`, { query:{ roomId } }));
    assert.equal(isolated.statusCode, 403, "non-members must not read a room");

    const enabledShare = await invoke(tokenRequest(`token-${ids.adminA}`, {
      method:"POST",
      body:{ action:"enable-share", roomId },
    }));
    assert.equal(enabledShare.statusCode, 200);
    const capability = enabledShare.body.guestShare.capability;
    assert.match(capability, /^v1\./);
    const repeatedEnable = await invoke(tokenRequest(`token-${ids.adminB}`, {
      method:"POST",
      body:{ action:"enable-share", roomId },
    }));
    assert.equal(repeatedEnable.body.guestShare.capability, capability, "re-copying must reproduce the current capability without rotating it");
    const preview = await invoke({ method:"POST", url:"https://test.invalid/api/chat", headers:{}, body:{ action:"guest-preview", capability } });
    assert.equal(preview.statusCode, 200, "a valid capability may be previewed without an app session");
    assert.equal(preview.body.room.roomName, "Friends");
    const forgedCapability = `${capability.slice(0, -1)}${capability.endsWith("A") ? "B" : "A"}`;
    const forgedPreview = await invoke({ method:"POST", url:"https://test.invalid/api/chat", headers:{}, body:{ action:"guest-preview", capability:forgedCapability } });
    assert.equal(forgedPreview.body.code, "chat_share_invalid", "a forged capability signature must fail before granting room access");
    const directAnonymousJoin=await invoke(tokenRequest(`token-${ids.rogueGuest}`,{
      method:"POST",
      body:{action:"join-shared-room",capability,guestDisplayName:"Direct Guest"},
    }));
    assert.equal(directAnonymousJoin.statusCode,403);
    assert.equal(directAnonymousJoin.body.code,"chat_guest_session_invalid","an anonymous identity minted outside the server ticket flow must not join a shared room");
    const legacyGuestJoin=await invoke(tokenRequest(`token-${ids.legacyGuest}`,{
      method:"POST",
      body:{action:"join-shared-room",capability,guestDisplayName:"Earlier Guest"},
    }));
    assert.equal(legacyGuestJoin.statusCode,200,"a pre-release anonymous guest with durable guest membership must be accepted and attested for another shared room");
    const missingGuestName = await invoke(tokenRequest(`token-${ids.guest}`, {
      method:"POST",
      body:{ action:"join-shared-room", capability },
    }));
    assert.equal(missingGuestName.body.code, "chat_guest_name_required");
    const guestJoin = await invoke(tokenRequest(`token-${ids.guest}`, {
      method:"POST",
      body:{ action:"join-shared-room", capability, guestDisplayName:"Guest One" },
    }));
    assert.equal(guestJoin.statusCode, 200);
    assert.equal(guestJoin.body.viewer.kind, "guest");
    assert.equal(guestJoin.body.viewer.displayName, "Guest One");
    const accountJoin = await invoke(tokenRequest(`token-${ids.outsider}`, {
      method:"POST",
      body:{ action:"join-shared-room", capability },
    }));
    assert.equal(accountJoin.statusCode, 200, "signed-in capability recipients join under their account identity");
    assert.equal(accountJoin.body.viewer.publicProfileRequired, true);
    const joinedRoom = await invoke(tokenRequest(`token-${ids.userB}`, { query:{ roomId } }));
    assert.equal(joinedRoom.body.room.viewer.kind, "account");
    assert.equal(joinedRoom.body.room.viewer.canPost, true);
    assert.equal(joinedRoom.body.room.members.find(item => item.displayName === "Guest One").kind, "guest");

    const rotated = await invoke(tokenRequest(`token-${ids.adminA}`, {
      method:"POST",
      body:{ action:"rotate-share", roomId },
    }));
    const rotatedCapability = rotated.body.guestShare.capability;
    assert.notEqual(rotatedCapability, capability);
    const stalePreview = await invoke({ method:"POST", url:"https://test.invalid/api/chat", headers:{}, body:{ action:"guest-preview", capability } });
    assert.equal(stalePreview.body.code, "chat_share_invalid", "rotation must invalidate the old capability");
    const staleJoin = await invoke(tokenRequest(`token-${ids.adminB}`, { method:"POST", body:{ action:"join-shared-room", capability } }));
    assert.equal(staleJoin.body.code,"chat_share_invalid","the locked join RPC must reject a capability rotated before insertion");
    const currentPreview = await invoke({ method:"POST", url:"https://test.invalid/api/chat", headers:{}, body:{ action:"guest-preview", capability:rotatedCapability } });
    assert.equal(currentPreview.statusCode, 200);
    const retainedAfterRotate=await invoke(tokenRequest(`token-${ids.userB}`,{query:{roomId}}));
    assert(retainedAfterRotate.body.room.members.some(item=>item.displayName==="Guest One"),"rotation must retain guests who joined before the room lock changed the capability");

    const name = await invoke(tokenRequest(`token-${ids.userA}`, { method:"POST", body:{ action:"set-display-name", displayName:"Ignored legacy name" } }));
    assert.equal(name.statusCode, 200);
    assert.equal(name.body.profile.displayName, "Public Member One", "chat identity must come from the canonical Public Profile");
    const clientId = "message-idempotent-0001";
    const send = () => invoke(tokenRequest(`token-${ids.userA}`, { method:"POST", body:{ action:"send-message", roomId, clientId, body:"Hello 😀" } }));
    const sent = await send();
    const repeated = await send();
    assert.equal(sent.statusCode, 200);
    assert.equal(repeated.statusCode, 200);
    assert.equal(messages.filter(message => message.client_id === clientId).length, 1, "idempotent sends must create one row");

    const guestReply = await invoke(tokenRequest(`token-${ids.guest}`, {
      method:"POST",
      body:{ action:"send-message", roomId, clientId:"guest-reply-0001", body:"Replying", replyToMessageId:sent.body.message.messageId },
    }));
    assert.equal(guestReply.statusCode, 200);
    assert.equal(guestReply.body.message.senderName, "Guest One");
    assert.equal(guestReply.body.message.replyTo.messageId, sent.body.message.messageId);
    const simultaneousMessageId=`bbbbbbbb-bbbb-4bbb-8bbb-${String(messageSequence++).padStart(12, "0")}`;
    messages.push({
      id:simultaneousMessageId,room_id:roomId,sender_id:ids.userB,client_id:"same-instant-message-0001",
      message_type:"text",body:"Same instant",reply_to_message_id:null,sender_display_name:"Public Member Two",
      created_at:guestReply.body.message.sentAt,
    });
    const simultaneousMessagePoll=await invoke(tokenRequest(`token-${ids.userA}`,{query:{roomId,after:guestReply.body.message.sentAt}}));
    assert(simultaneousMessagePoll.body.messages.some(message=>message.messageId===simultaneousMessageId),"inclusive polling must not skip a second message with the cursor timestamp");
    assert(simultaneousMessagePoll.body.messages.some(message=>message.messageId===guestReply.body.message.messageId),"the repeated cursor row is returned for stable-ID client de-duplication");
    const reacted = await invoke(tokenRequest(`token-${ids.userB}`, {
      method:"POST",
      body:{ action:"toggle-reaction", roomId, messageId:sent.body.message.messageId, emoji:"👍" },
    }));
    assert.equal(reacted.statusCode, 200);
    assert.equal(reacted.body.reaction.active, true);
    reactions.push({
      reaction_id:`eeeeeeee-eeee-4eee-8eee-${String(reactionSequence++).padStart(12,"0")}`,
      room_id:roomId,message_id:guestReply.body.message.messageId,actor_id:ids.userA,emoji:"❤️",active:true,
      created_at:reacted.body.reaction.updatedAt,updated_at:reacted.body.reaction.updatedAt,
    });
    const reactionPoll = await invoke(tokenRequest(`token-${ids.userA}`, { query:{ roomId, reactionAfter:reacted.body.reaction.updatedAt } }));
    assert.equal(reactionPoll.statusCode, 200);
    assert.equal(reactionPoll.body.reactionChanges.find(item => item.messageId === sent.body.message.messageId).reactions[0].count, 1);
    assert.equal(reactionPoll.body.reactionChanges.find(item => item.messageId === guestReply.body.message.messageId).reactions[0].emoji,"❤️","inclusive reaction polling must not skip a second row with the cursor timestamp");
    const unreacted = await invoke(tokenRequest(`token-${ids.userB}`, {
      method:"POST",
      body:{ action:"toggle-reaction", roomId, messageId:sent.body.message.messageId, emoji:"👍" },
    }));
    assert.equal(unreacted.body.reaction.active, false, "repeating a reaction toggles it off without deleting the polling tombstone");

    const roomRead = await invoke(tokenRequest(`token-${ids.userB}`, { query:{ roomId } }));
    assert.equal(roomRead.statusCode, 200);
    assert.equal(roomRead.body.messages[0].body, "Hello 😀");
    assert.equal(roomRead.body.messages[0].senderName, "Public Member One");
    assert.equal(Object.hasOwn(roomRead.body.messages[0], "email"), false, "members must receive display names without emails");

    const disabledShare = await invoke(tokenRequest(`token-${ids.adminA}`, {
      method:"POST",
      body:{ action:"disable-share", roomId },
    }));
    assert.equal(disabledShare.statusCode, 200);
    assert.equal(disabledShare.body.guestShare.enabled, false);
    const disabledPreview = await invoke({ method:"POST", url:"https://test.invalid/api/chat", headers:{}, body:{ action:"guest-preview", capability:rotatedCapability } });
    assert.equal(disabledPreview.statusCode, forgedPreview.statusCode);
    assert.deepEqual(disabledPreview.body, forgedPreview.body, "disabled and forged capabilities must not disclose different room state");
    const disabledJoin=await invoke(tokenRequest(`token-${ids.adminB}`,{method:"POST",body:{action:"join-shared-room",capability:rotatedCapability}}));
    assert.equal(disabledJoin.body.code,"chat_share_invalid","disable must win the room lock and reject every future shared join");
    const revokedGuest = await invoke(tokenRequest(`token-${ids.guest}`, { query:{ roomId } }));
    assert.equal(revokedGuest.statusCode, 403, "disabling guest access must immediately remove existing guests");
    const retainedTranscript = await invoke(tokenRequest(`token-${ids.userB}`, { query:{ roomId } }));
    assert.equal(retainedTranscript.body.messages.find(item => item.messageId === guestReply.body.message.messageId).senderName, "Guest One", "guest sender snapshots must survive membership revocation");

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

    const secondRoomId = secondRoom.body.room.roomId;
    const secondShare = await invoke(tokenRequest(`token-${ids.adminA}`, {
      method:"POST",
      body:{ action:"enable-share", roomId:secondRoomId },
    }));
    const secondRoomRow = rooms.find(item => item.id === secondRoomId);
    while (members.filter(item => item.room_id === secondRoomId).length < chatContract.LIMITS.membersPerRoom){
      const index = members.filter(item => item.room_id === secondRoomId).length;
      members.push({
        room_id:secondRoomId,
        user_id:`70000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
        added_by:ids.adminA,
        member_kind:"account",
        guest_display_name:null,
        joined_at:timestamp(),
        last_read_at:timestamp(),
      });
    }
    assert.equal(secondRoomRow.guest_share_enabled, true);
    const fullGuestJoin = await invoke(tokenRequest(`token-${ids.guest}`, {
      method:"POST",
      body:{ action:"join-shared-room", capability:secondShare.body.guestShare.capability, guestDisplayName:"Too Late" },
    }));
    assert.equal(fullGuestJoin.body.code, "chat_room_full", "the 25-person ceiling must include accounts and guests together");

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
    if (originalEnvironment.shareSecret === undefined) delete process.env.CHAT_GUEST_LINK_SECRET; else process.env.CHAT_GUEST_LINK_SECRET = originalEnvironment.shareSecret;
  }

  const pushEnvironment = {
    SUPABASE_URL:"https://project-ref.supabase.co",
    SUPABASE_PUBLISHABLE_KEY:"publishable-test",
    SUPABASE_SERVICE_ROLE_KEY:"service-test",
    VAPID_PUBLIC_KEY:"public-test",
    VAPID_PRIVATE_KEY:"private-test",
    VAPID_SUBJECT:"https://nothingsport.vercel.app/",
  };
  const pushFetch = global.fetch;
  const originalSendNotification = webpush.sendNotification;
  const originalSetVapidDetails = webpush.setVapidDetails;
  const pushRequests = [];
  const pushPayloads = [];
  let allowClaim = true;
  global.fetch = async (input, options = {}) => {
    const url = new URL(input);
    pushRequests.push({ url, options });
    if (url.pathname.endsWith("/nothingsports_chat_members")) return fetchResponse([{ user_id:ids.userB }]);
    if (url.pathname.endsWith("/nothingsports_push_installations")) return fetchResponse([{
      installation_id:"99999999-9999-4999-8999-999999999999",
      user_id:ids.userB,
      endpoint:"https://push.example.test/subscription",
      p256dh:"p256dh",
      auth_key:"auth",
      permission:"granted",
      chat_alerts_enabled:true,
      badges_enabled:true,
    }]);
    if (url.pathname.endsWith("/rpc/nothingsports_chat_unread_totals")) return fetchResponse([{ user_id:ids.userB, unread_count:7 }]);
    if (url.pathname.endsWith("/nothingsports_chat_notification_deliveries") && options.method === "POST") return fetchResponse([]);
    if (url.pathname.endsWith("/nothingsports_chat_notification_deliveries") && options.method === "PATCH") return fetchResponse([]);
    if (url.pathname.endsWith("/nothingsports_chat_notification_deliveries")) return fetchResponse([{
      delivery_id:"88888888-8888-4888-8888-888888888888",
      message_id:"77777777-7777-4777-8777-777777777777",
      installation_id:"99999999-9999-4999-8999-999999999999",
      attempts:0,
      dispatched_at:null,
    }]);
    if (url.pathname.endsWith("/rpc/nothingsports_chat_claim_notification_delivery")){
      return fetchResponse(allowClaim ? [{
        delivery_id:"88888888-8888-4888-8888-888888888888",
        attempts:0,
      }] : []);
    }
    return fetchResponse({ message:`Unexpected push test request ${url.pathname}` }, 500);
  };
  webpush.setVapidDetails = () => {};
  webpush.sendNotification = async (_subscription, payload) => { pushPayloads.push(JSON.parse(payload)); };
  try{
    const notificationInput = {
      message:{ id:"77777777-7777-4777-8777-777777777777" },
      room:{ id:"aaaaaaaa-aaaa-4aaa-8aaa-000000000001", room_name:"Friends" },
      senderId:ids.userA,
    };
    const delivered = await dispatchChatMessageNotifications(notificationInput, pushEnvironment);
    assert.deepEqual(delivered, { attempted:1, sent:1, failed:0 });
    assert.equal(pushPayloads[0].kind, "chat");
    assert.equal(pushPayloads[0].roomId, notificationInput.room.id);
    assert.equal(pushPayloads[0].title, "New message in Friends");
    assert.equal(pushPayloads[0].body, "Open Nothing Sport to read it.");
    assert.equal(pushPayloads[0].unreadCount, 7, "each chat push must carry that recipient's total unread chat-message count");
    assert(!JSON.stringify(pushPayloads[0]).includes("Public Member One"), "push payloads must not expose sender identity");
    assert(pushRequests.some(item => item.url.pathname.endsWith("/nothingsports_chat_members") && item.url.searchParams.get("user_id") === `neq.${ids.userA}`), "the sender must be excluded before installation lookup");
    const unreadRequest = pushRequests.find(item => item.url.pathname.endsWith("/rpc/nothingsports_chat_unread_totals"));
    assert.deepEqual(JSON.parse(unreadRequest.options.body).target_users,[ids.userB],"unread totals must be batched for push recipients only");
    assert.equal(Object.hasOwn(chatNotificationTest.notificationPayload(notificationInput.room,7,false),"unreadCount"),false,"a badge opt-out must omit the background badge value without disabling chat alerts");
    allowClaim = false;
    const duplicate = await dispatchChatMessageNotifications(notificationInput, pushEnvironment);
    assert.deepEqual(duplicate, { attempted:0, sent:0, failed:0 });
    assert.equal(pushPayloads.length, 1, "an already claimed delivery must not send a duplicate push");
  } finally {
    global.fetch = pushFetch;
    webpush.sendNotification = originalSendNotification;
    webpush.setVapidDetails = originalSetVapidDetails;
  }

  console.log("Private fixture chat validation passed: forced server boundary, signed capabilities, guests, profiles, replies, reactions, notification idempotency, limits and closure.");
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
