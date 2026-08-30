"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const chatContract = require("../config/chat-contract");
const {
  ChatCapabilityError,
  createShareCapability:shareCapability,
  parseShareCapability:parsedShareCapability,
  requireShareSecret,
} = require("../lib/chat-capability");
const {
  SupabaseRequestError,
  authenticatedUser,
  bearerToken,
  publicError,
  supabaseServiceRequest,
} = require("../lib/supabase-server");
const { dispatchChatMessageNotifications } = require("../lib/chat-notifications");

const TABLES = Object.freeze({
  profiles:"nothingsports_chat_profiles",
  publicProfiles:"nothingsports_nsc_profiles",
  rooms:"nothingsports_chat_rooms",
  members:"nothingsports_chat_members",
  messages:"nothingsports_chat_messages",
  reactions:"nothingsports_chat_reactions",
});
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
let canonicalFixtures = null;

class ChatRequestError extends Error {
  constructor(message, status = 400, code = "invalid_chat_request"){
    super(message);
    this.status = status;
    this.code = code;
  }
}

function setPrivateHeaders(response){
  response.setHeader("Cache-Control", "private, no-store, max-age=0");
  response.setHeader("Pragma", "no-cache");
  response.setHeader("Vary", "Authorization");
}

function requestBody(request){
  if (request?.body && typeof request.body === "object") return request.body;
  try{ return JSON.parse(request?.body || "{}"); }catch(_error){ return {}; }
}

function queryValue(request, name){
  if (request?.query && Object.prototype.hasOwnProperty.call(request.query, name)){
    const value = request.query[name];
    return Array.isArray(value) ? value[0] : value;
  }
  try{
    return new URL(request?.url || "/api/chat", "https://nothingsport.vercel.app").searchParams.get(name) || "";
  }catch(_error){
    return "";
  }
}

function adminEmails(environment = process.env){
  return new Set(String(environment.CHAT_ADMIN_EMAILS || "")
    .split(",")
    .map(value => value.trim().toLowerCase())
    .filter(Boolean));
}

function isAdmin(user, environment = process.env){
  const email = String(user?.email || "").trim().toLowerCase();
  const allowlist = adminEmails(environment);
  return Boolean(email && allowlist.size && allowlist.has(email));
}

function requireAdmin(admin){
  if (!admin) throw new ChatRequestError("Chat administration is restricted to app admins.", 403, "chat_admin_required");
}

function requireUuid(value, field = "account ID"){
  const id = String(value || "").trim();
  if (!UUID_PATTERN.test(id)) throw new ChatRequestError(`A valid ${field} is required.`, 400, "invalid_identifier");
  return id;
}

function isAnonymousUser(user){
  return user?.is_anonymous === true;
}

function validInstant(value){
  const instant = String(value || "").trim();
  return instant && Number.isFinite(Date.parse(instant)) ? new Date(instant).toISOString() : "";
}

function loadFixtureMap(readFileSync = fs.readFileSync, root = path.join(__dirname, "..")){
  try{
    const manifest = JSON.parse(readFileSync(path.join(root, "data/feed/manifest.json"), "utf8"));
    const fixtures = new Map();
    (manifest.pages || []).forEach(page => {
      const document = JSON.parse(readFileSync(path.join(root, page.path), "utf8"));
      (document.events || []).forEach(event => {
        const ids = [event.canonicalEventId, event.eventId, event.id].map(value => String(value || "").trim()).filter(Boolean);
        ids.forEach(id => fixtures.set(id, event));
      });
    });
    return fixtures;
  }catch(_error){
    throw new ChatRequestError(
      "Chat fixture data is temporarily unavailable.",
      503,
      "chat_fixture_data_unavailable"
    );
  }
}

function fixtureMap(){
  if (!canonicalFixtures) canonicalFixtures = loadFixtureMap();
  return canonicalFixtures;
}

function fixtureIsUpcomingOrLive(event, now = new Date()){
  const startsAt = Date.parse(event?.startTimeUtc || "");
  if (!Number.isFinite(startsAt)) return false;
  if (["cancelled", "postponed", "completed", "past"].includes(String(event?.status || "").toLowerCase())) return false;
  const liveHours = Math.max(0.25, Math.min(24, Number(event?.liveWindow || 3)));
  return startsAt > now.getTime() || now.getTime() <= startsAt + liveHours * 60 * 60 * 1000;
}

function canonicalFixtureSnapshot(fixtureId, now = new Date()){
  const id = chatContract.fixtureId(fixtureId);
  const event = id ? fixtureMap().get(id) : null;
  if (!event) throw new ChatRequestError("That canonical fixture is not available.", 404, "fixture_not_found");
  if (!fixtureIsUpcomingOrLive(event, now)){
    throw new ChatRequestError("Chats can only be created for an upcoming or live fixture.", 409, "fixture_not_chat_eligible");
  }
  return {
    canonicalFixtureId:String(event.canonicalEventId || event.eventId || event.id),
    eventId:String(event.eventId || event.id),
    name:String(event.displayTitleCompact || event.name || "Fixture"),
    sport:String(event.sport || event.key || "Sport"),
    competitionId:event.competitionId || null,
    startTimeUtc:new Date(event.startTimeUtc).toISOString(),
    date:event.date || null,
    time:event.time || null,
    venue:event.venueDisplayName || event.venue || null,
    broadcaster:event.broadcaster || null,
    liveWindow:Number(event.liveWindow || 3),
    sourceName:event.canonicalSourceName || event.sourceName || null,
    sourceUrl:event.canonicalSourceUrl || event.sourceUrl || null,
    sourceCheckedAt:event.canonicalSourceCheckedAt || event.sourceCheckedAt || null,
  };
}

function restPath(table, parameters = {}){
  const query = new URLSearchParams(parameters);
  return `/rest/v1/${table}${query.size ? `?${query.toString()}` : ""}`;
}

async function rows(table, parameters = {}){
  const result = await supabaseServiceRequest(restPath(table, parameters));
  return Array.isArray(result) ? result : [];
}

async function requireAttestedAnonymousGuest(user){
  if(!isAnonymousUser(user))return;
  if(user?.app_metadata?.chat_guest_attested===true)return;
  const priorGuestMembership=(await rows(TABLES.members,{
    user_id:`eq.${requireUuid(user.id,"account ID")}`,
    member_kind:"eq.guest",
    select:"user_id",
    limit:"1",
  }))[0]||null;
  if(!priorGuestMembership){
    throw new ChatRequestError("This guest session is not authorized for shared chat.",403,"chat_guest_session_invalid");
  }
  try{
    await supabaseServiceRequest(`/auth/v1/admin/users/${encodeURIComponent(user.id)}`,{
      method:"PUT",
      body:{app_metadata:{...(user.app_metadata||{}),chat_guest_attested:true}},
    });
  }catch(_error){
    // A pre-release guest membership is itself durable server-side attestation.
    // The metadata upgrade is retried on the next shared-room join.
  }
}

async function roomById(roomId){
  const id = requireUuid(roomId, "room ID");
  return (await rows(TABLES.rooms, {
    id:`eq.${id}`,
    select:"id,canonical_fixture_id,fixture_snapshot,room_name,created_by,status,closed_at,purge_at,guest_share_enabled,guest_share_version,guest_share_nonce,guest_share_enabled_at,guest_share_disabled_at,created_at,updated_at",
    limit:"1",
  }))[0] || null;
}

async function membership(roomId, userId){
  return (await rows(TABLES.members, {
    room_id:`eq.${requireUuid(roomId, "room ID")}`,
    user_id:`eq.${requireUuid(userId, "account ID")}`,
    select:"room_id,user_id,member_kind,guest_display_name,joined_at,last_read_at",
    limit:"1",
  }))[0] || null;
}

async function requireRoomAccess(roomId, user, admin, { write = false } = {}){
  const room = await roomById(roomId);
  if (!room) throw new ChatRequestError("Chat room not found.", 404, "chat_room_not_found");
  const member = await membership(room.id, user.id);
  if (write){
    if (room.status !== "open") throw new ChatRequestError("This chat is closed and read-only for app admins until purge.", 409, "chat_room_closed");
    if (!member) throw new ChatRequestError("Only current room members may post.", 403, "chat_membership_required");
  } else if (room.status === "closed"){
    if (!admin) throw new ChatRequestError("This chat is closed.", 403, "chat_room_closed");
  } else if (!member && !admin){
    throw new ChatRequestError("You are not a member of this chat.", 403, "chat_membership_required");
  }
  return { room, member };
}

async function profileForUser(user){
  if (isAnonymousUser(user)){
    return { display_name:null, public_profile:false, anonymous:true, legacy_display_name:null };
  }
  const existing = (await rows(TABLES.profiles, {
    user_id:`eq.${requireUuid(user.id)}`,
    select:"user_id,email_normalized,display_name,updated_at",
    limit:"1",
  }))[0] || null;
  const publicProfile = (await rows(TABLES.publicProfiles, {
    user_id:`eq.${requireUuid(user.id)}`,
    select:"user_id,display_name,handle,visibility,updated_at",
    limit:"1",
  }))[0] || null;
  const email = String(user.email || "").trim().toLowerCase();
  if (!email) throw new ChatRequestError("This account does not have a usable email address.", 409, "chat_email_required");
  if (!existing || existing.email_normalized !== email){
    const saved = await supabaseServiceRequest(restPath(TABLES.profiles, { on_conflict:"user_id" }), {
      method:"POST",
      headers:{ Prefer:"resolution=merge-duplicates,return=representation" },
      body:{
        user_id:user.id,
        email_normalized:email,
        display_name:existing?.display_name || null,
        updated_at:new Date().toISOString(),
      },
    });
    const legacy = saved?.[0] || { ...existing, user_id:user.id, email_normalized:email };
    return {
      ...legacy,
      display_name:publicProfile && publicProfile.visibility !== "deleted" ? publicProfile.display_name : legacy.display_name,
      public_profile:Boolean(publicProfile && publicProfile.visibility !== "deleted"),
      public_profile_visibility:publicProfile?.visibility || null,
      legacy_display_name:legacy.display_name || null,
    };
  }
  return {
    ...existing,
    display_name:publicProfile && publicProfile.visibility !== "deleted" ? publicProfile.display_name : existing?.display_name,
    public_profile:Boolean(publicProfile && publicProfile.visibility !== "deleted"),
    public_profile_visibility:publicProfile?.visibility || null,
    legacy_display_name:existing?.display_name || null,
  };
}

async function displayNames(userIds){
  const ids = [...new Set((userIds || []).filter(value => UUID_PATTERN.test(String(value || ""))))];
  if (!ids.length) return new Map();
  const [publicProfiles, legacyProfiles] = await Promise.all([
    rows(TABLES.publicProfiles, {
      user_id:`in.(${ids.join(",")})`,
      select:"user_id,display_name,visibility",
    }),
    rows(TABLES.profiles, {
      user_id:`in.(${ids.join(",")})`,
      select:"user_id,display_name",
    }),
  ]);
  const publicById = new Map(publicProfiles.map(profile => [profile.user_id, profile]));
  const legacyById = new Map(legacyProfiles.map(profile => [profile.user_id, profile.display_name || null]));
  return new Map(ids.map(id => {
    const canonical = publicById.get(id);
    if (canonical) return [id, canonical.visibility === "deleted" ? "Member" : canonical.display_name || "Member"];
    return [id, legacyById.get(id) || "Member"];
  }));
}

function publicRoom(row){
  return {
    roomId:row.id || row.room_id,
    canonicalFixtureId:row.canonical_fixture_id,
    fixture:row.fixture_snapshot,
    roomName:row.room_name,
    status:row.status || "open",
    memberCount:Number(row.member_count || 0),
    unreadCount:Number(row.unread_count || 0),
    lastMessageAt:row.last_message_at || null,
    createdAt:row.created_at,
    closedAt:row.closed_at || null,
    purgeAt:row.purge_at || null,
    guestShareEnabled:Boolean(row.guest_share_enabled),
  };
}

async function knownAuthUsers(){
  const payload = await supabaseServiceRequest("/auth/v1/admin/users?page=1&per_page=1000");
  return (Array.isArray(payload?.users) ? payload.users : [])
    .filter(user => (
      !isAnonymousUser(user)
      && String(user.email || "").trim()
      && Boolean(user.email_confirmed_at || user.confirmed_at)
    ));
}

async function handleActive(user, admin, profile){
  const active = await supabaseServiceRequest("/rest/v1/rpc/nothingsports_chat_active_rooms", {
    method:"POST",
    body:{ target_user:user.id, include_admin_rooms:admin },
  });
  return {
    schemaVersion:chatContract.SCHEMA_VERSION,
    isAdmin:admin,
    profile:{
      displayName:profile?.display_name || null,
      publicProfile:Boolean(profile?.public_profile),
      canPost:Boolean(profile?.public_profile),
    },
    rooms:(Array.isArray(active) ? active : []).map(publicRoom),
  };
}

async function handleUserSearch(query, admin){
  requireAdmin(admin);
  const q = String(query || "").trim().toLowerCase();
  if (Array.from(q).length < chatContract.LIMITS.userSearchMin){
    throw new ChatRequestError("Search with at least three characters.", 400, "chat_search_too_short");
  }
  const users = (await knownAuthUsers())
    .filter(user => String(user.email || "").toLowerCase().includes(q))
    .slice(0, chatContract.LIMITS.userSearchResults);
  const names = await displayNames(users.map(user => user.id));
  return {
    schemaVersion:chatContract.SCHEMA_VERSION,
    users:users.map(user => ({
      accountId:user.id,
      email:String(user.email || "").toLowerCase(),
      displayName:names.get(user.id) || null,
    })),
  };
}

async function reactionState(roomId, userId, messageIds, after){
  const changedQuery = {
    room_id:`eq.${roomId}`,
    select:"reaction_id,message_id,actor_id,emoji,active,updated_at",
    order:"updated_at.asc,reaction_id.asc",
    limit:"500",
  };
  // Include the cursor instant and let the client merge by stable row/message
  // IDs. A strict timestamp-only `gt` can skip rows committed at the same
  // database instant as the last row from the previous poll.
  if (after) changedQuery.updated_at = `gte.${after}`;
  else if (messageIds.length) changedQuery.message_id = `in.(${messageIds.join(",")})`;
  else return { changes:[], cursor:after || "1970-01-01T00:00:00.000Z" };
  const changed = await rows(TABLES.reactions, changedQuery);
  const affected = new Set(after ? changed.map(item => item.message_id) : messageIds);
  if (!affected.size){
    return { changes:[], cursor:after || "1970-01-01T00:00:00.000Z" };
  }
  const active = await rows(TABLES.reactions, {
    room_id:`eq.${roomId}`,
    message_id:`in.(${[...affected].join(",")})`,
    active:"eq.true",
    select:"message_id,actor_id,emoji",
  });
  const grouped = new Map([...affected].map(messageId => [messageId, new Map()]));
  active.forEach(item => {
    const byEmoji = grouped.get(item.message_id) || new Map();
    const aggregate = byEmoji.get(item.emoji) || { emoji:item.emoji, count:0, own:false };
    aggregate.count += 1;
    if (item.actor_id === userId) aggregate.own = true;
    byEmoji.set(item.emoji, aggregate);
    grouped.set(item.message_id, byEmoji);
  });
  const cursor = changed.reduce((latest, item) => (
    Date.parse(item.updated_at || "") > Date.parse(latest || "") ? item.updated_at : latest
  ), after || "1970-01-01T00:00:00.000Z");
  return {
    changes:[...affected].map(messageId => ({
      messageId,
      reactions:chatContract.REACTION_EMOJIS
        .map(emoji => grouped.get(messageId)?.get(emoji))
        .filter(Boolean),
    })),
    cursor,
  };
}

async function handleRoomGet(request, user, admin, profile){
  const roomId = requireUuid(queryValue(request, "roomId"), "room ID");
  const { room, member } = await requireRoomAccess(roomId, user, admin);
  const before = validInstant(queryValue(request, "before"));
  const after = validInstant(queryValue(request, "after"));
  const newestPage = !after;
  const messageQuery = {
    room_id:`eq.${room.id}`,
    select:"id,room_id,sender_id,client_id,message_type,body,reply_to_message_id,sender_display_name,created_at",
    order:`created_at.${newestPage ? "desc" : "asc"},id.${newestPage ? "desc" : "asc"}`,
    limit:String(chatContract.LIMITS.historyPage),
  };
  // Poll inclusively at the last seen instant. Message IDs are stable and the
  // client de-duplicates them, so this preserves simultaneous rows without
  // changing the legacy timestamp cursor contract.
  if (after) messageQuery.created_at = `gte.${after}`;
  else if (before) messageQuery.created_at = `lt.${before}`;
  let messages = await rows(TABLES.messages, messageQuery);
  if (newestPage) messages = messages.reverse();
  const memberRows = await rows(TABLES.members, {
    room_id:`eq.${room.id}`,
    select:"user_id,member_kind,guest_display_name,joined_at,last_read_at",
    order:"joined_at.asc",
  });
  const replyIds = [...new Set(messages.map(item => item.reply_to_message_id).filter(Boolean))];
  const replyRows = replyIds.length ? await rows(TABLES.messages, {
    id:`in.(${replyIds.join(",")})`,
    room_id:`eq.${room.id}`,
    select:"id,sender_id,body,sender_display_name",
  }) : [];
  const names = await displayNames([
    ...memberRows.filter(item => item.member_kind !== "guest").map(item => item.user_id),
    ...messages.map(item => item.sender_id),
    ...replyRows.map(item => item.sender_id),
  ]);
  const guestNames = new Map(memberRows
    .filter(item => item.member_kind === "guest")
    .map(item => [item.user_id, item.guest_display_name || "Guest"]));
  const senderName = item => {
    const accountName = names.get(item.sender_id);
    return guestNames.get(item.sender_id)
      || (accountName && accountName !== "Member" ? accountName : null)
      || item.sender_display_name
      || accountName
      || "Member";
  };
  const repliesById = new Map(replyRows.map(item => [item.id, item]));
  const reactionAfter = validInstant(queryValue(request, "reactionAfter"));
  const reactionResult = await reactionState(room.id, user.id, messages.map(item => item.id), reactionAfter);
  const viewerName = member?.member_kind === "guest"
    ? member.guest_display_name || "Guest"
    : profile?.display_name || null;
  const canPost = Boolean(
    room.status === "open"
    && member
    && (member.member_kind === "guest" ? member.guest_display_name : profile?.public_profile)
  );
  return {
    schemaVersion:chatContract.SCHEMA_VERSION,
    isAdmin:admin,
    room:{
      ...publicRoom(room),
      memberCount:memberRows.length,
      canManage:admin,
      readOnly:room.status !== "open" || !member,
      viewer:{
        member:Boolean(member),
        kind:member?.member_kind || (admin ? "admin" : null),
        displayName:viewerName,
        canPost,
        publicProfileRequired:Boolean(member && member.member_kind !== "guest" && !profile?.public_profile),
      },
      members:memberRows.map(item => ({
        ...(admin ? { accountId:item.user_id } : {}),
        displayName:item.member_kind === "guest" ? item.guest_display_name || "Guest" : names.get(item.user_id) || "Member",
        kind:item.member_kind || "account",
        joinedAt:item.joined_at,
      })),
    },
    messages:messages.map(message => ({
      messageId:message.id,
      clientId:message.client_id,
      messageType:message.message_type,
      body:message.body,
      sentAt:message.created_at,
      senderName:senderName(message),
      own:message.sender_id === user.id,
      ...(message.reply_to_message_id ? (() => {
        const reply = repliesById.get(message.reply_to_message_id);
        return { replyTo:reply ? { messageId:reply.id, senderName:senderName(reply), body:reply.body } : null };
      })() : { replyTo:null }),
    })),
    reactionChanges:reactionResult.changes,
    reactionCursor:reactionResult.cursor,
    olderCursor:newestPage && messages.length === chatContract.LIMITS.historyPage ? messages[0]?.created_at || null : null,
    disclosure:"Invited members and app admins can read an open room. After closure, app admins retain read-only access for seven days before permanent purge.",
  };
}

async function setDisplayName(_body, user, profile){
  if (isAnonymousUser(user)){
    throw new ChatRequestError("Guest names are set when joining a shared room.", 409, "chat_guest_name_room_scoped");
  }
  if (!profile?.public_profile){
    throw new ChatRequestError("Create your Public Profile before posting in chat.", 409, "chat_public_profile_required");
  }
  return {
    schemaVersion:chatContract.SCHEMA_VERSION,
    profile:{ displayName:profile.display_name, publicProfile:true },
  };
}

async function createRoom(body, user, admin){
  requireAdmin(admin);
  const roomName = chatContract.roomName(body.roomName);
  if (!roomName) throw new ChatRequestError("Use a room name between 1 and 80 characters.", 400, "invalid_chat_room_name");
  const fixture = canonicalFixtureSnapshot(body.canonicalFixtureId);
  const requested = Array.isArray(body.memberIds) ? body.memberIds.map(value => requireUuid(value)) : [];
  const memberIds = [...new Set([user.id, ...requested])];
  if (memberIds.length > chatContract.LIMITS.membersPerRoom){
    throw new ChatRequestError("A chat room may have at most 25 members.", 409, "chat_member_limit");
  }
  const knownIds = new Set((await knownAuthUsers()).map(account => account.id));
  if (memberIds.some(id => !knownIds.has(id))){
    throw new ChatRequestError("Every chat member must be an existing account.", 400, "unknown_chat_member");
  }
  const result = await supabaseServiceRequest("/rest/v1/rpc/nothingsports_chat_create_room", {
    method:"POST",
    body:{
      target_fixture_id:fixture.canonicalFixtureId,
      target_fixture_snapshot:fixture,
      target_room_name:roomName,
      target_creator:user.id,
      target_members:memberIds,
    },
  });
  const roomId = Array.isArray(result) ? result[0] : result;
  return { schemaVersion:chatContract.SCHEMA_VERSION, room:publicRoom(await roomById(roomId)) };
}

async function roomForCapability(value){
  const parsed = parsedShareCapability(value);
  const room = await roomById(parsed.roomId);
  if (!room){
    throw new ChatRequestError("That guest chat link is invalid or expired.", 404, "chat_share_invalid");
  }
  if (room.status !== "open"){
    throw new ChatRequestError("This chat room is closed.", 409, "chat_room_closed");
  }
  if (!room.guest_share_enabled){
    throw new ChatRequestError("That guest chat link is invalid or expired.", 404, "chat_share_invalid");
  }
  if (Number(room.guest_share_version) !== parsed.version || room.guest_share_nonce !== parsed.nonce){
    throw new ChatRequestError("That guest chat link is invalid or expired.", 404, "chat_share_invalid");
  }
  return room;
}

async function guestPreview(body){
  const room = await roomForCapability(body.capability);
  const members = await rows(TABLES.members, { room_id:`eq.${room.id}`, select:"user_id" });
  return {
    schemaVersion:chatContract.SCHEMA_VERSION,
    room:{ ...publicRoom(room), memberCount:members.length },
  };
}

async function joinSharedRoom(body, user, profile){
  const parsed = parsedShareCapability(body.capability);
  const anonymous = isAnonymousUser(user);
  if(anonymous)await requireAttestedAnonymousGuest(user);
  const guestDisplayName = anonymous ? chatContract.displayName(body.guestDisplayName) : "";
  if (anonymous && !guestDisplayName){
    throw new ChatRequestError("Choose a guest name between 2 and 30 characters.", 400, "chat_guest_name_required");
  }
  const result = await supabaseServiceRequest("/rest/v1/rpc/nothingsports_chat_join_shared_room", {
    method:"POST",
    body:{
      target_room:parsed.roomId,
      target_version:parsed.version,
      target_nonce:parsed.nonce,
      target_user:user.id,
      target_member_kind:anonymous ? "guest" : "account",
      target_guest_display_name:anonymous ? guestDisplayName : null,
    },
  });
  const joined=Array.isArray(result)?result[0]:result;
  if(joined?.outcome==="full")throw new ChatRequestError("This chat room already has 25 participants.",409,"chat_room_full");
  if(joined?.outcome==="closed")throw new ChatRequestError("This chat room is closed.",409,"chat_room_closed");
  if(!["joined","existing"].includes(joined?.outcome))throw new ChatRequestError("That guest chat link is invalid or expired.",404,"chat_share_invalid");
  const room=await roomById(parsed.roomId);
  if(!room)throw new ChatRequestError("That guest chat link is invalid or expired.",404,"chat_share_invalid");
  return {
    schemaVersion:chatContract.SCHEMA_VERSION,
    joined:true,
    existing:joined.outcome==="existing"||joined.existing_member===true,
    room:{ ...publicRoom(room), memberCount:Number(joined.member_count)||0 },
    viewer:{
      kind:anonymous ? "guest" : "account",
      displayName:anonymous ? guestDisplayName : profile?.display_name || null,
      canPost:Boolean(anonymous ? guestDisplayName : profile?.public_profile),
      publicProfileRequired:Boolean(!anonymous && !profile?.public_profile),
    },
  };
}

async function configureGuestShare(body, user, admin, mode){
  requireAdmin(admin);
  const roomId = requireUuid(body.roomId, "room ID");
  const { room } = await requireRoomAccess(roomId, user, admin);
  if (room.status !== "open") throw new ChatRequestError("Closed chats cannot be shared.", 409, "chat_room_closed");
  requireShareSecret();
  const enabled = mode !== "disable";
  const rotate = mode === "rotate";
  const result = await supabaseServiceRequest("/rest/v1/rpc/nothingsports_chat_configure_guest_share", {
    method:"POST",
    body:{
      target_room:room.id,
      target_enabled:enabled,
      target_rotate:rotate,
      target_nonce:enabled ? crypto.randomBytes(24).toString("base64url") : null,
    },
  });
  const updated = Array.isArray(result) ? result[0] : result;
  if (!updated) throw new ChatRequestError("Guest chat sharing could not be updated.", 502, "chat_share_not_confirmed");
  return {
    schemaVersion:chatContract.SCHEMA_VERSION,
    guestShare:{
      enabled:Boolean(updated.guest_share_enabled),
      version:Number(updated.guest_share_version || 0),
      ...(updated.guest_share_enabled ? { capability:shareCapability(updated) } : {}),
    },
  };
}

async function addMembers(body, user, admin){
  requireAdmin(admin);
  const roomId = requireUuid(body.roomId, "room ID");
  const { room } = await requireRoomAccess(roomId, user, admin);
  if (room.status !== "open") throw new ChatRequestError("Closed chats cannot be changed.", 409, "chat_room_closed");
  const requested = [...new Set((Array.isArray(body.memberIds) ? body.memberIds : []).map(value => requireUuid(value)))];
  if (!requested.length) throw new ChatRequestError("Choose at least one account.", 400, "chat_members_required");
  const current = await rows(TABLES.members, { room_id:`eq.${roomId}`, select:"user_id" });
  const currentIds = new Set(current.map(item => item.user_id));
  const additions = requested.filter(id => !currentIds.has(id));
  if (current.length + additions.length > chatContract.LIMITS.membersPerRoom){
    throw new ChatRequestError("A chat room may have at most 25 members.", 409, "chat_member_limit");
  }
  const knownIds = new Set((await knownAuthUsers()).map(account => account.id));
  if (additions.some(id => !knownIds.has(id))) throw new ChatRequestError("Every chat member must be an existing account.", 400, "unknown_chat_member");
  if (additions.length){
    try{
      await supabaseServiceRequest(restPath(TABLES.members, { on_conflict:"room_id,user_id" }), {
        method:"POST",
        headers:{ Prefer:"resolution=ignore-duplicates,return=minimal" },
        body:additions.map(accountId => ({
          room_id:roomId,
          user_id:accountId,
          added_by:user.id,
          member_kind:"account",
          guest_display_name:null,
        })),
      });
    }catch(error){
      if (error instanceof SupabaseRequestError && /25 members|member limit/i.test(String(error.message || ""))){
        throw new ChatRequestError("A chat room may have at most 25 members.", 409, "chat_member_limit");
      }
      throw error;
    }
  }
  return { schemaVersion:chatContract.SCHEMA_VERSION, added:additions.length };
}

async function removeMember(body, user, admin){
  requireAdmin(admin);
  const roomId = requireUuid(body.roomId, "room ID");
  const accountId = requireUuid(body.accountId, "account ID");
  const { room } = await requireRoomAccess(roomId, user, admin);
  if (room.status !== "open") throw new ChatRequestError("Closed chats cannot be changed.", 409, "chat_room_closed");
  await supabaseServiceRequest(restPath(TABLES.members, {
    room_id:`eq.${roomId}`,
    user_id:`eq.${accountId}`,
  }), { method:"DELETE", headers:{ Prefer:"return=minimal" } });
  return { schemaVersion:chatContract.SCHEMA_VERSION, removed:true };
}

async function sendMessage(body, user, admin, profile){
  const roomId = requireUuid(body.roomId, "room ID");
  const { room, member } = await requireRoomAccess(roomId, user, admin, { write:true });
  const guest = member?.member_kind === "guest";
  const senderDisplayName = guest ? member.guest_display_name : profile?.display_name;
  if (guest && !senderDisplayName){
    throw new ChatRequestError("Choose a guest name before posting.", 409, "chat_guest_name_required");
  }
  if (!guest && !profile?.public_profile){
    throw new ChatRequestError("Create your Public Profile before posting in chat.", 409, "chat_public_profile_required");
  }
  const message = chatContract.messageBody(body.body);
  const clientId = chatContract.clientId(body.clientId);
  const replyToMessageId = body.replyToMessageId ? requireUuid(body.replyToMessageId, "reply message ID") : null;
  if (!message) throw new ChatRequestError("Messages must contain 1–500 Unicode characters.", 400, "invalid_chat_message");
  if (!clientId) throw new ChatRequestError("A valid idempotent client ID is required.", 400, "invalid_chat_client_id");
  let replyTo = null;
  if (replyToMessageId){
    replyTo = (await rows(TABLES.messages, {
      id:`eq.${replyToMessageId}`,
      room_id:`eq.${roomId}`,
      select:"id,sender_id,body,sender_display_name",
      limit:"1",
    }))[0] || null;
    if (!replyTo) throw new ChatRequestError("That reply message is not available in this room.", 404, "chat_reply_not_found");
  }
  const existingQuery = {
    room_id:`eq.${roomId}`,
    sender_id:`eq.${user.id}`,
    client_id:`eq.${clientId}`,
    select:"id,room_id,sender_id,client_id,message_type,body,reply_to_message_id,sender_display_name,created_at",
    limit:"1",
  };
  let row = (await rows(TABLES.messages, existingQuery))[0] || null;
  if (!row){
    const saved = await supabaseServiceRequest(restPath(TABLES.messages, { on_conflict:"room_id,sender_id,client_id" }), {
      method:"POST",
      headers:{ Prefer:"resolution=ignore-duplicates,return=representation" },
      body:{
        room_id:roomId,
        sender_id:user.id,
        client_id:clientId,
        message_type:"text",
        body:message,
        reply_to_message_id:replyToMessageId,
        sender_display_name:guest ? senderDisplayName : null,
      },
    });
    row = saved?.[0] || (await rows(TABLES.messages, existingQuery))[0] || null;
  }
  if (!row) throw new ChatRequestError("The message could not be confirmed.", 502, "chat_message_not_confirmed");
  if (row.reply_to_message_id){
    if (replyTo?.id !== row.reply_to_message_id){
      replyTo = (await rows(TABLES.messages, {
        id:`eq.${row.reply_to_message_id}`,
        room_id:`eq.${roomId}`,
        select:"id,sender_id,body,sender_display_name",
        limit:"1",
      }))[0] || null;
    }
  } else {
    replyTo = null;
  }
  try{
    await dispatchChatMessageNotifications({ message:row, room, senderId:user.id });
  }catch(_error){
    // A saved message must never be rolled back or reported failed because push
    // delivery is unavailable. The delivery ledger remains safe to retry.
  }
  let replySenderName = null;
  if (replyTo){
    const replyNames = await displayNames([replyTo.sender_id]);
    const accountName = replyNames.get(replyTo.sender_id);
    replySenderName = (accountName && accountName !== "Member" ? accountName : null) || replyTo.sender_display_name || accountName || "Member";
  }
  return {
    schemaVersion:chatContract.SCHEMA_VERSION,
    message:{
      messageId:row.id,
      clientId:row.client_id,
      messageType:row.message_type,
      body:row.body,
      sentAt:row.created_at,
      senderName:senderDisplayName,
      own:true,
      replyTo:replyTo ? {
        messageId:replyTo.id,
        senderName:replySenderName,
        body:replyTo.body,
      } : null,
    },
  };
}

async function toggleReaction(body, user, admin){
  const roomId = requireUuid(body.roomId, "room ID");
  const messageId = requireUuid(body.messageId, "message ID");
  await requireRoomAccess(roomId, user, admin, { write:true });
  const emoji = chatContract.reactionEmoji(body.emoji);
  if (!emoji){
    throw new ChatRequestError("Choose one of the available chat reactions.", 400, "invalid_chat_reaction");
  }
  const message = (await rows(TABLES.messages, {
    id:`eq.${messageId}`,
    room_id:`eq.${roomId}`,
    select:"id",
    limit:"1",
  }))[0] || null;
  if (!message) throw new ChatRequestError("That message is not available in this room.", 404, "chat_message_not_found");
  const existing = (await rows(TABLES.reactions, {
    message_id:`eq.${messageId}`,
    actor_id:`eq.${user.id}`,
    emoji:`eq.${emoji}`,
    select:"reaction_id,active,updated_at",
    limit:"1",
  }))[0] || null;
  const active = !existing?.active;
  const updatedAt = new Date().toISOString();
  let saved;
  if (existing){
    saved = await supabaseServiceRequest(restPath(TABLES.reactions, {
      reaction_id:`eq.${existing.reaction_id}`,
      select:"reaction_id,message_id,emoji,active,updated_at",
    }), {
      method:"PATCH",
      headers:{ Prefer:"return=representation" },
      body:{ active, updated_at:updatedAt },
    });
  } else {
    saved = await supabaseServiceRequest(restPath(TABLES.reactions, { on_conflict:"message_id,actor_id,emoji" }), {
      method:"POST",
      headers:{ Prefer:"resolution=merge-duplicates,return=representation" },
      body:{ room_id:roomId, message_id:messageId, actor_id:user.id, emoji, active:true, updated_at:updatedAt },
    });
  }
  const reaction = saved?.[0] || { message_id:messageId, emoji, active, updated_at:updatedAt };
  return {
    schemaVersion:chatContract.SCHEMA_VERSION,
    reaction:{
      messageId:reaction.message_id || messageId,
      emoji:reaction.emoji || emoji,
      active:Boolean(reaction.active),
      updatedAt:reaction.updated_at || updatedAt,
    },
  };
}

async function markRead(body, user, admin){
  const roomId = requireUuid(body.roomId, "room ID");
  const { room, member } = await requireRoomAccess(roomId, user, admin);
  if (!member || room.status !== "open") throw new ChatRequestError("Only current members can mark a chat read.", 403, "chat_membership_required");
  const readAt = new Date().toISOString();
  await supabaseServiceRequest(restPath(TABLES.members, {
    room_id:`eq.${roomId}`,
    user_id:`eq.${user.id}`,
  }), {
    method:"PATCH",
    headers:{ Prefer:"return=minimal" },
    body:{ last_read_at:readAt },
  });
  return { schemaVersion:chatContract.SCHEMA_VERSION, readAt };
}

async function closeRoom(body, user, admin){
  requireAdmin(admin);
  const roomId = requireUuid(body.roomId, "room ID");
  const { room } = await requireRoomAccess(roomId, user, admin);
  if (room.status !== "open") throw new ChatRequestError("This chat is already closed.", 409, "chat_room_closed");
  const saved = await supabaseServiceRequest(restPath(TABLES.rooms, { id:`eq.${roomId}`, select:"*" }), {
    method:"PATCH",
    headers:{ Prefer:"return=representation" },
    body:{ status:"closed", closed_by:user.id },
  });
  return { schemaVersion:chatContract.SCHEMA_VERSION, room:publicRoom(saved?.[0] || await roomById(roomId)) };
}

async function handlePost(request, user, admin, profile){
  const body = requestBody(request);
  switch (body.action){
    case "set-display-name": return setDisplayName(body, user, profile);
    case "join-shared-room": return joinSharedRoom(body, user, profile);
    case "create-room": return createRoom(body, user, admin);
    case "enable-share": return configureGuestShare(body, user, admin, "enable");
    case "rotate-share": return configureGuestShare(body, user, admin, "rotate");
    case "disable-share": return configureGuestShare(body, user, admin, "disable");
    case "add-members": return addMembers(body, user, admin);
    case "remove-member": return removeMember(body, user, admin);
    case "send-message": return sendMessage(body, user, admin, profile);
    case "toggle-reaction": return toggleReaction(body, user, admin);
    case "mark-read": return markRead(body, user, admin);
    case "close-room": return closeRoom(body, user, admin);
    default: throw new ChatRequestError("Unknown chat action.", 400, "unknown_chat_action");
  }
}

async function chatHandler(request, response){
  setPrivateHeaders(response);
  try{
    if (!["GET", "POST"].includes(request.method || "GET")){
      response.setHeader("Allow", "GET, POST");
      response.status(405).json({ error:"Chat supports GET and POST only.", code:"method_not_allowed" });
      return;
    }
    const body = (request.method || "GET") === "POST" ? requestBody(request) : null;
    if (body?.action === "guest-preview"){
      response.status(200).json(await guestPreview(body));
      return;
    }
    const user = await authenticatedUser(bearerToken(request));
    const admin = isAdmin(user);
    const profile = await profileForUser(user);
    let payload;
    if ((request.method || "GET") === "GET"){
      const mode = String(queryValue(request, "mode") || "").trim();
      if (mode === "active") payload = await handleActive(user, admin, profile);
      else if (mode === "users") payload = await handleUserSearch(queryValue(request, "q"), admin);
      else if (queryValue(request, "roomId")) payload = await handleRoomGet(request, user, admin, profile);
      else throw new ChatRequestError("Choose an active, users or room chat query.", 400, "invalid_chat_mode");
    } else {
      payload = await handlePost(request, user, admin, profile);
    }
    response.status(200).json(payload);
  }catch(error){
    if (error instanceof ChatRequestError || error instanceof ChatCapabilityError){
      response.status(error.status).json({ error:error.message, code:error.code });
      return;
    }
    if (error instanceof SupabaseRequestError){
      const outgoing = publicError(error);
      response.status(outgoing.status).json(outgoing.body);
      return;
    }
    response.status(500).json({ error:"Chat is temporarily unavailable.", code:"chat_unavailable" });
  }
}

chatHandler._test = Object.freeze({
  ChatRequestError,
  adminEmails,
  canonicalFixtureSnapshot,
  fixtureIsUpcomingOrLive,
  isAdmin,
  isAnonymousUser,
  loadFixtureMap,
  parsedShareCapability,
  queryValue,
  shareCapability,
});

module.exports = chatHandler;
