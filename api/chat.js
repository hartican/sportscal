"use strict";

const fs = require("node:fs");
const path = require("node:path");
const chatContract = require("../config/chat-contract");
const {
  SupabaseRequestError,
  authenticatedUser,
  bearerToken,
  publicError,
  supabaseServiceRequest,
} = require("../lib/supabase-server");

const TABLES = Object.freeze({
  profiles:"nothingsports_chat_profiles",
  rooms:"nothingsports_chat_rooms",
  members:"nothingsports_chat_members",
  messages:"nothingsports_chat_messages",
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

function validInstant(value){
  const instant = String(value || "").trim();
  return instant && Number.isFinite(Date.parse(instant)) ? new Date(instant).toISOString() : "";
}

function fixtureMap(){
  if (canonicalFixtures) return canonicalFixtures;
  const root = path.join(__dirname, "..");
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "data/feed/manifest.json"), "utf8"));
  canonicalFixtures = new Map();
  (manifest.pages || []).forEach(page => {
    const document = JSON.parse(fs.readFileSync(path.join(root, page.path), "utf8"));
    (document.events || []).forEach(event => {
      const ids = [event.canonicalEventId, event.eventId, event.id].map(value => String(value || "").trim()).filter(Boolean);
      ids.forEach(id => canonicalFixtures.set(id, event));
    });
  });
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

async function roomById(roomId){
  const id = requireUuid(roomId, "room ID");
  return (await rows(TABLES.rooms, {
    id:`eq.${id}`,
    select:"id,canonical_fixture_id,fixture_snapshot,room_name,created_by,status,closed_at,purge_at,created_at,updated_at",
    limit:"1",
  }))[0] || null;
}

async function membership(roomId, userId){
  return (await rows(TABLES.members, {
    room_id:`eq.${requireUuid(roomId, "room ID")}`,
    user_id:`eq.${requireUuid(userId, "account ID")}`,
    select:"room_id,user_id,joined_at,last_read_at",
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
  const existing = (await rows(TABLES.profiles, {
    user_id:`eq.${requireUuid(user.id)}`,
    select:"user_id,email_normalized,display_name,updated_at",
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
    return saved?.[0] || { ...existing, user_id:user.id, email_normalized:email };
  }
  return existing;
}

async function displayNames(userIds){
  const ids = [...new Set((userIds || []).filter(value => UUID_PATTERN.test(String(value || ""))))];
  if (!ids.length) return new Map();
  const profiles = await rows(TABLES.profiles, {
    user_id:`in.(${ids.join(",")})`,
    select:"user_id,display_name",
  });
  return new Map(profiles.map(profile => [profile.user_id, profile.display_name || "Member"]));
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
  };
}

async function knownAuthUsers(){
  const payload = await supabaseServiceRequest("/auth/v1/admin/users?page=1&per_page=1000");
  return Array.isArray(payload?.users) ? payload.users : [];
}

async function handleActive(user, admin, profile){
  const active = await supabaseServiceRequest("/rest/v1/rpc/nothingsports_chat_active_rooms", {
    method:"POST",
    body:{ target_user:user.id, include_admin_rooms:admin },
  });
  return {
    schemaVersion:chatContract.SCHEMA_VERSION,
    isAdmin:admin,
    profile:{ displayName:profile?.display_name || null },
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

async function handleRoomGet(request, user, admin){
  const roomId = requireUuid(queryValue(request, "roomId"), "room ID");
  const { room, member } = await requireRoomAccess(roomId, user, admin);
  const before = validInstant(queryValue(request, "before"));
  const after = validInstant(queryValue(request, "after"));
  const newestPage = !after;
  const messageQuery = {
    room_id:`eq.${room.id}`,
    select:"id,room_id,sender_id,client_id,message_type,body,created_at",
    order:`created_at.${newestPage ? "desc" : "asc"},id.${newestPage ? "desc" : "asc"}`,
    limit:String(chatContract.LIMITS.historyPage),
  };
  if (after) messageQuery.created_at = `gt.${after}`;
  else if (before) messageQuery.created_at = `lt.${before}`;
  let messages = await rows(TABLES.messages, messageQuery);
  if (newestPage) messages = messages.reverse();
  const memberRows = await rows(TABLES.members, {
    room_id:`eq.${room.id}`,
    select:"user_id,joined_at,last_read_at",
    order:"joined_at.asc",
  });
  const names = await displayNames([
    ...memberRows.map(item => item.user_id),
    ...messages.map(item => item.sender_id),
  ]);
  return {
    schemaVersion:chatContract.SCHEMA_VERSION,
    isAdmin:admin,
    room:{
      ...publicRoom(room),
      memberCount:memberRows.length,
      canManage:admin,
      readOnly:room.status !== "open" || !member,
      members:memberRows.map(item => ({
        ...(admin ? { accountId:item.user_id } : {}),
        displayName:names.get(item.user_id) || "Member",
      })),
    },
    messages:messages.map(message => ({
      messageId:message.id,
      clientId:message.client_id,
      messageType:message.message_type,
      body:message.body,
      sentAt:message.created_at,
      senderName:names.get(message.sender_id) || "Member",
      own:message.sender_id === user.id,
    })),
    olderCursor:newestPage && messages.length === chatContract.LIMITS.historyPage ? messages[0]?.created_at || null : null,
    disclosure:"Invited members and app admins can read an open room. After closure, app admins retain read-only access for seven days before permanent purge.",
  };
}

async function setDisplayName(body, user){
  const name = chatContract.displayName(body.displayName);
  if (!name) throw new ChatRequestError("Use a chat display name between 2 and 30 characters.", 400, "invalid_chat_display_name");
  const email = String(user.email || "").trim().toLowerCase();
  const saved = await supabaseServiceRequest(restPath(TABLES.profiles, { on_conflict:"user_id" }), {
    method:"POST",
    headers:{ Prefer:"resolution=merge-duplicates,return=representation" },
    body:{ user_id:user.id, email_normalized:email, display_name:name, updated_at:new Date().toISOString() },
  });
  return { schemaVersion:chatContract.SCHEMA_VERSION, profile:{ displayName:saved?.[0]?.display_name || name } };
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
    await supabaseServiceRequest(restPath(TABLES.members, { on_conflict:"room_id,user_id" }), {
      method:"POST",
      headers:{ Prefer:"resolution=ignore-duplicates,return=minimal" },
      body:additions.map(accountId => ({ room_id:roomId, user_id:accountId, added_by:user.id })),
    });
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
  await requireRoomAccess(roomId, user, admin, { write:true });
  if (!profile?.display_name) throw new ChatRequestError("Set a chat display name before posting.", 409, "chat_display_name_required");
  const message = chatContract.messageBody(body.body);
  const clientId = chatContract.clientId(body.clientId);
  if (!message) throw new ChatRequestError("Messages must contain 1–500 Unicode characters.", 400, "invalid_chat_message");
  if (!clientId) throw new ChatRequestError("A valid idempotent client ID is required.", 400, "invalid_chat_client_id");
  const existingQuery = {
    room_id:`eq.${roomId}`,
    sender_id:`eq.${user.id}`,
    client_id:`eq.${clientId}`,
    select:"id,room_id,sender_id,client_id,message_type,body,created_at",
    limit:"1",
  };
  let row = (await rows(TABLES.messages, existingQuery))[0] || null;
  if (!row){
    const saved = await supabaseServiceRequest(restPath(TABLES.messages, { on_conflict:"room_id,sender_id,client_id" }), {
      method:"POST",
      headers:{ Prefer:"resolution=ignore-duplicates,return=representation" },
      body:{ room_id:roomId, sender_id:user.id, client_id:clientId, message_type:"text", body:message },
    });
    row = saved?.[0] || (await rows(TABLES.messages, existingQuery))[0] || null;
  }
  if (!row) throw new ChatRequestError("The message could not be confirmed.", 502, "chat_message_not_confirmed");
  return {
    schemaVersion:chatContract.SCHEMA_VERSION,
    message:{
      messageId:row.id,
      clientId:row.client_id,
      messageType:row.message_type,
      body:row.body,
      sentAt:row.created_at,
      senderName:profile.display_name,
      own:true,
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
    case "set-display-name": return setDisplayName(body, user);
    case "create-room": return createRoom(body, user, admin);
    case "add-members": return addMembers(body, user, admin);
    case "remove-member": return removeMember(body, user, admin);
    case "send-message": return sendMessage(body, user, admin, profile);
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
    const user = await authenticatedUser(bearerToken(request));
    const admin = isAdmin(user);
    const profile = await profileForUser(user);
    let payload;
    if ((request.method || "GET") === "GET"){
      const mode = String(queryValue(request, "mode") || "").trim();
      if (mode === "active") payload = await handleActive(user, admin, profile);
      else if (mode === "users") payload = await handleUserSearch(queryValue(request, "q"), admin);
      else if (queryValue(request, "roomId")) payload = await handleRoomGet(request, user, admin);
      else throw new ChatRequestError("Choose an active, users or room chat query.", 400, "invalid_chat_mode");
    } else {
      payload = await handlePost(request, user, admin, profile);
    }
    response.status(200).json(payload);
  }catch(error){
    if (error instanceof ChatRequestError){
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
  queryValue,
});

module.exports = chatHandler;
