"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { waitUntil } = require("@vercel/functions");
const chatContract = require("../config/chat-contract");
const chatPolicy = require("../config/chat-policy");
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
  supabaseServiceRoleConfig,
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
  attachments:"nothingsports_chat_attachments",
  savedMedia:"nothingsports_saved_game_media",
  nscPoints:"nothingsports_nsc_points",
});
const CHAT_MEDIA_BUCKET = "nothingsports-chat-transient";
const SAVED_MEDIA_BUCKET = "nothingsports-saved-game-media";
const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;
const MAX_ATTACHMENTS_PER_MESSAGE = 4;
const ALLOWED_MEDIA_TYPES = new Set([
  "image/jpeg", "image/png", "image/webp", "image/gif",
  "audio/mpeg", "audio/mp4", "audio/wav", "audio/ogg",
  "application/pdf", "text/plain", "text/csv",
  "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
let canonicalFixtures = null;

class ChatRequestError extends Error {
  constructor(message, status = 400, code = "invalid_chat_request", details = {}){
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function lifetimeNscPoints(userId){
  const ledger = await rows(TABLES.nscPoints, {
    user_id:`eq.${requireUuid(userId)}`,
    select:"points",
    limit:"10000",
  });
  return ledger.reduce((total, item) => total + Math.max(0, Number(item.points) || 0), 0);
}

async function chatCapabilities(user){
  return chatPolicy.gifCapability(isAnonymousUser(user) ? 0 : await lifetimeNscPoints(user.id));
}

async function requireGifCapability(user){
  const capability = await chatCapabilities(user);
  if (!capability.canUseGifs){
    throw new ChatRequestError(
      `Earn ${capability.gifMinimumPoints} NSC points to search, upload or send GIFs.`,
      403,
      "nsc_points_required",
      { currentPoints:capability.lifetimeNscPoints, requiredPoints:capability.gifMinimumPoints }
    );
  }
  return capability;
}

function cleanAttachmentName(value){
  return String(value || "attachment").replace(/[^A-Za-z0-9._ -]/g, "_").slice(0, 120) || "attachment";
}

function attachmentKind(contentType){
  if (contentType === "image/gif") return "gif";
  if (contentType.startsWith("image/")) return "image";
  if (contentType.startsWith("audio/")) return "audio";
  if (contentType === "application/pdf") return "pdf";
  return "file";
}

function validateAttachmentInput(body){
  const contentType = String(body.contentType || "").toLowerCase().split(";")[0];
  const byteSize = Number(body.byteSize);
  if (!ALLOWED_MEDIA_TYPES.has(contentType)) throw new ChatRequestError("That file type is not supported.", 415, "chat_attachment_type_rejected");
  if (!Number.isInteger(byteSize) || byteSize < 1 || byteSize > MAX_ATTACHMENT_BYTES) throw new ChatRequestError("Attachments must be no larger than 25 MB.", 413, "chat_attachment_too_large");
  return { contentType, byteSize, fileName:cleanAttachmentName(body.fileName), kind:attachmentKind(contentType) };
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
    const addFixture = event => {
      if (!event || typeof event !== "object") return;
      const ids = [event.canonicalEventId, event.eventId, event.id].map(value => String(value || "").trim()).filter(Boolean);
      ids.forEach(id => fixtures.set(id, event));
    };
    const followDocument = JSON.parse(readFileSync(path.join(root, "data/follow-fixtures.v1.json"), "utf8"));
    (followDocument.events || []).forEach(addFixture);
    const majorDocument = JSON.parse(readFileSync(path.join(root, "data/major-events.v1.json"), "utf8"));
    const visit = event => {
      addFixture(event);
      for (const key of ["fixtures", "subEvents", "events", "schedule"]){
        if (Array.isArray(event?.[key])) event[key].forEach(visit);
      }
    };
    (majorDocument.events || []).forEach(visit);
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
  return chatPolicy.fixtureEligibility(event, now).eligible;
}

function canonicalFixtureSnapshot(fixtureId, now = new Date()){
  const id = chatContract.fixtureId(fixtureId);
  const event = id ? fixtureMap().get(id) : null;
  if (!event) throw new ChatRequestError("That canonical fixture is not available.", 404, "fixture_not_found");
  if (!fixtureIsUpcomingOrLive(event, now)){
    throw new ChatRequestError("Chats can only be created for an upcoming or live fixture.", 409, "fixture_not_chat_eligible");
  }
  const timing = chatPolicy.fixtureTiming(event);
  return {
    canonicalFixtureId:String(event.canonicalEventId || event.eventId || event.id),
    eventId:String(event.eventId || event.id),
    name:String(event.displayTitleCompact || event.name || "Fixture"),
    sport:String(event.sport || event.key || "Sport"),
    competitionId:event.competitionId || null,
    startTimeUtc:timing.startTimeUtc,
    sessionStartTimeUtc:timing.sessionStartTimeUtc,
    timingPrecision:timing.timingPrecision,
    sequenceInSession:timing.sequenceInSession,
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
  const [active, capabilities] = await Promise.all([
    supabaseServiceRequest("/rest/v1/rpc/nothingsports_chat_active_rooms", {
      method:"POST",
      body:{ target_user:user.id, include_admin_rooms:admin },
    }),
    chatCapabilities(user),
  ]);
  return {
    schemaVersion:chatContract.SCHEMA_VERSION,
    isAdmin:admin,
    profile:{
      displayName:profile?.display_name || null,
      publicProfile:Boolean(profile?.public_profile),
      canPost:Boolean(profile?.public_profile),
    },
    capabilities,
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
  const capabilities = await chatCapabilities(user);
  const attachmentRows = messages.length ? await rows(TABLES.attachments, {
    message_id:`in.(${messages.map(item => item.id).join(",")})`,
    status:"in.(ready,saved)",
    select:"attachment_id,message_id,kind,file_name,content_type,byte_size,object_path,status,source_metadata,created_at",
  }) : [];
  const attachmentsByMessage = new Map();
  await Promise.all(attachmentRows.map(async attachment => {
    const list = attachmentsByMessage.get(attachment.message_id) || [];
    list.push({
      attachmentId:attachment.attachment_id,
      kind:attachment.kind,
      fileName:attachment.file_name,
      contentType:attachment.content_type,
      byteSize:Number(attachment.byte_size),
      url:await storageSignedDownload(CHAT_MEDIA_BUCKET, attachment.object_path),
      saved:attachment.status === "saved",
      sourceMetadata:attachment.source_metadata || {},
    });
    attachmentsByMessage.set(attachment.message_id, list);
  }));
  return {
    schemaVersion:chatContract.SCHEMA_VERSION,
    isAdmin:admin,
    capabilities,
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
      attachments:attachmentsByMessage.get(message.id) || [],
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

async function storageSignedUpload(bucket, objectPath){
  const payload = await supabaseServiceRequest(`/storage/v1/object/upload/sign/${bucket}/${objectPath}`, { method:"POST", body:{} });
  const relative = payload?.url || payload?.signedURL || payload?.signedUrl;
  const base = String(process.env.SUPABASE_URL || "").replace(/\/$/, "");
  if (!relative || !base) throw new ChatRequestError("A private upload could not be prepared.", 502, "chat_attachment_upload_unavailable");
  return relative.startsWith("http") ? relative : `${base}/storage/v1${relative.startsWith("/") ? "" : "/"}${relative}`;
}

async function storageSignedDownload(bucket, objectPath){
  const payload = await supabaseServiceRequest(`/storage/v1/object/sign/${bucket}/${objectPath}`, { method:"POST", body:{ expiresIn:300 } });
  const relative = payload?.signedURL || payload?.signedUrl || payload?.url;
  const base = String(process.env.SUPABASE_URL || "").replace(/\/$/, "");
  if (!relative || !base) throw new ChatRequestError("That private attachment is unavailable.", 404, "chat_attachment_unavailable");
  return relative.startsWith("http") ? relative : `${base}/storage/v1${relative.startsWith("/") ? "" : "/"}${relative}`;
}

function encodedStoragePath(bucket, objectPath){
  return [bucket, ...String(objectPath || "").split("/")].map(encodeURIComponent).join("/");
}

function sniffAttachmentContentType(bytes){
  const ascii = bytes.toString("ascii");
  if (ascii.startsWith("GIF87a") || ascii.startsWith("GIF89a")) return "image/gif";
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]))) return "image/png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (ascii.startsWith("%PDF-")) return "application/pdf";
  if (ascii.startsWith("RIFF") && ascii.slice(8, 12) === "WEBP") return "image/webp";
  if (ascii.startsWith("RIFF") && ascii.slice(8, 12) === "WAVE") return "audio/wav";
  if (ascii.startsWith("OggS")) return "audio/ogg";
  if (ascii.startsWith("ID3") || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0)) return "audio/mpeg";
  return null;
}

async function inspectStoredAttachment(attachment){
  const storagePath = encodedStoragePath(CHAT_MEDIA_BUCKET, attachment.object_path);
  const info = await supabaseServiceRequest(`/storage/v1/object/info/${storagePath}`);
  const storedSize = Number(info?.metadata?.size ?? info?.metadata?.contentLength ?? info?.size);
  if (!Number.isFinite(storedSize) || storedSize < 1 || storedSize > MAX_ATTACHMENT_BYTES || storedSize !== Number(attachment.byte_size)){
    throw new ChatRequestError("The uploaded file size does not match the prepared attachment.", 409, "chat_attachment_size_mismatch");
  }
  const config = supabaseServiceRoleConfig();
  const response = await fetch(`${config.url}/storage/v1/object/authenticated/${storagePath}`, {
    headers:{
      apikey:config.serviceRoleKey,
      ...(config.opaqueSecret ? {} : { Authorization:`Bearer ${config.serviceRoleKey}` }),
      Range:"bytes=0-15",
    },
    signal:AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new ChatRequestError("The uploaded file could not be verified.", 409, "chat_attachment_verification_failed");
  const detectedContentType = sniffAttachmentContentType(Buffer.from(await response.arrayBuffer()));
  const declaredFamily = attachmentKind(attachment.content_type);
  const detectedFamily = detectedContentType ? attachmentKind(detectedContentType) : null;
  if (detectedFamily && detectedFamily !== declaredFamily){
    if (detectedContentType !== "image/gif") throw new ChatRequestError("The uploaded file does not match its declared type.", 415, "chat_attachment_type_mismatch");
  }
  return detectedContentType || attachment.content_type;
}

async function prepareAttachment(body, user, admin){
  const roomId = requireUuid(body.roomId, "room ID");
  await requireRoomAccess(roomId, user, admin, { write:true });
  const input = validateAttachmentInput(body);
  if (input.kind === "gif") await requireGifCapability(user);
  const attachmentId = crypto.randomUUID();
  const objectPath = `${user.id}/${roomId}/${attachmentId}/${input.fileName}`;
  await supabaseServiceRequest(restPath(TABLES.attachments), {
    method:"POST",
    headers:{ Prefer:"return=minimal" },
    body:{
      attachment_id:attachmentId, room_id:roomId, uploader_id:user.id,
      kind:input.kind, file_name:input.fileName, content_type:input.contentType,
      byte_size:input.byteSize, storage_bucket:CHAT_MEDIA_BUCKET, object_path:objectPath, status:"pending",
    },
  });
  return {
    schemaVersion:chatContract.SCHEMA_VERSION,
    attachment:{ attachmentId, ...input, uploadUrl:await storageSignedUpload(CHAT_MEDIA_BUCKET, objectPath) },
  };
}

async function completeAttachment(body, user, admin){
  const attachmentId = requireUuid(body.attachmentId, "attachment ID");
  const attachment = (await rows(TABLES.attachments, {
    attachment_id:`eq.${attachmentId}`, uploader_id:`eq.${user.id}`,
    select:"attachment_id,room_id,kind,content_type,byte_size,object_path,status", limit:"1",
  }))[0] || null;
  if (!attachment) throw new ChatRequestError("That upload is unavailable.", 404, "chat_attachment_not_found");
  await requireRoomAccess(attachment.room_id, user, admin, { write:true });
  const detectedContentType = await inspectStoredAttachment(attachment);
  // GIFs are gated against the uploaded bytes so a forged declared type cannot bypass the reward.
  if (attachment.kind === "gif" || attachment.content_type === "image/gif" || detectedContentType === "image/gif") await requireGifCapability(user);
  await supabaseServiceRequest(restPath(TABLES.attachments, { attachment_id:`eq.${attachmentId}` }), {
    method:"PATCH", headers:{ Prefer:"return=minimal" }, body:{
      status:"ready", ready_at:new Date().toISOString(),
      content_type:detectedContentType, kind:attachmentKind(detectedContentType),
    },
  });
  return { schemaVersion:chatContract.SCHEMA_VERSION, attachmentId, ready:true };
}

function cleanSourceMetadata(value){
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return Object.fromEntries(Object.entries(source)
    .filter(([, item]) => ["string", "number", "boolean"].includes(typeof item))
    .map(([key, item]) => [String(key).slice(0, 80), typeof item === "string" ? item.slice(0, 2000) : item]));
}

async function resolveGifProviderMedia(providerValue, gifIdValue){
  const provider = String(providerValue || "").trim().toLowerCase();
  const gifId = String(gifIdValue || "").trim().slice(0, 200);
  if (!gifId || !["giphy", "wikimedia"].includes(provider)){
    throw new ChatRequestError("That GIF provider reference is invalid.", 400, "invalid_gif_reference");
  }
  if (provider === "giphy"){
    const key = String(process.env.GIPHY_API_KEY || "").trim();
    if (!key) throw new ChatRequestError("GIPHY is not configured.", 503, "gif_provider_unavailable");
    const url = new URL(`https://api.giphy.com/v1/gifs/${encodeURIComponent(gifId)}`);
    url.searchParams.set("api_key", key);
    const response = await fetch(url, { signal:AbortSignal.timeout(10_000) });
    if (!response.ok) throw new ChatRequestError("That GIF is no longer available.", 404, "gif_not_found");
    const item = (await response.json())?.data || {};
    const originalUrl = item.images?.original?.url;
    if (!originalUrl) throw new ChatRequestError("That GIF is no longer available.", 404, "gif_not_found");
    return {
      provider, gifId:String(item.id || gifId), mediaUrl:originalUrl,
      title:String(item.title || "GIF").slice(0, 120),
      sourceMetadata:cleanSourceMetadata({
        provider, providerId:String(item.id || gifId), sourcePage:item.url || "https://giphy.com/",
        attribution:"Powered by GIPHY", creator:item.username || "", licence:"GIPHY Terms",
      }),
    };
  }
  if (!/^\d{1,20}$/.test(gifId)) throw new ChatRequestError("That Wikimedia GIF reference is invalid.", 400, "invalid_gif_reference");
  const url = new URL("https://commons.wikimedia.org/w/api.php");
  url.search = new URLSearchParams({
    action:"query", pageids:gifId, prop:"imageinfo", iiprop:"url|mime|size|extmetadata", format:"json", origin:"*",
  }).toString();
  const response = await fetch(url, { signal:AbortSignal.timeout(10_000) });
  if (!response.ok) throw new ChatRequestError("That GIF is no longer available.", 404, "gif_not_found");
  const page = (await response.json())?.query?.pages?.[gifId] || null;
  const info = page?.imageinfo?.[0] || {};
  if (info.mime !== "image/gif" || !info.url) throw new ChatRequestError("That Wikimedia item is not a GIF.", 415, "gif_type_rejected");
  const metadata = info.extmetadata || {};
  return {
    provider, gifId, mediaUrl:info.url,
    title:String(page?.title || "GIF").replace(/^File:/, "").slice(0, 120),
    sourceMetadata:cleanSourceMetadata({
      provider, providerId:gifId,
      sourcePage:info.descriptionurl || `https://commons.wikimedia.org/?curid=${gifId}`,
      attribution:metadata.Credit?.value || metadata.Artist?.value || "Wikimedia Commons",
      creator:metadata.Artist?.value || "", licence:metadata.LicenseShortName?.value || "See source page",
      licenceUrl:metadata.LicenseUrl?.value || "",
    }),
  };
}

async function gifImport(body, user, admin){
  const roomId = requireUuid(body.roomId, "room ID");
  await requireRoomAccess(roomId, user, admin, { write:true });
  await requireGifCapability(user);
  const resolved = await resolveGifProviderMedia(body.provider, body.gifId);
  const mediaUrl = new URL(resolved.mediaUrl);
  const allowedHost = resolved.provider === "giphy"
    ? /(^|\.)giphy\.com$/i.test(mediaUrl.hostname) || /(^|\.)giphy\.net$/i.test(mediaUrl.hostname)
    : /(^|\.)wikimedia\.org$/i.test(mediaUrl.hostname);
  if (mediaUrl.protocol !== "https:" || !allowedHost) throw new ChatRequestError("That GIF source is not trusted.", 400, "gif_source_rejected");
  const download = await fetch(mediaUrl, { redirect:"follow", signal:AbortSignal.timeout(15_000) });
  if (!download.ok) throw new ChatRequestError("That GIF could not be imported.", 502, "gif_import_failed");
  const finalUrl = new URL(download.url || mediaUrl.href);
  const finalHostAllowed = resolved.provider === "giphy"
    ? /(^|\.)giphy\.com$/i.test(finalUrl.hostname) || /(^|\.)giphy\.net$/i.test(finalUrl.hostname)
    : /(^|\.)wikimedia\.org$/i.test(finalUrl.hostname);
  if (finalUrl.protocol !== "https:" || !finalHostAllowed) throw new ChatRequestError("That GIF source redirected outside its trusted provider.", 400, "gif_source_rejected");
  const declaredSize = Number(download.headers.get("content-length") || 0);
  if (declaredSize > MAX_ATTACHMENT_BYTES) throw new ChatRequestError("That GIF is larger than 25 MB.", 413, "chat_attachment_too_large");
  const bytes = Buffer.from(await download.arrayBuffer());
  if (!bytes.length || bytes.length > MAX_ATTACHMENT_BYTES) throw new ChatRequestError("That GIF is larger than 25 MB.", 413, "chat_attachment_too_large");
  if (sniffAttachmentContentType(bytes.subarray(0, 16)) !== "image/gif") throw new ChatRequestError("That provider item is not a GIF.", 415, "gif_type_rejected");
  const attachmentId = crypto.randomUUID();
  const fileName = cleanAttachmentName(`${resolved.title || resolved.gifId}.gif`);
  const objectPath = `${user.id}/${roomId}/${attachmentId}/${fileName}`;
  const uploadUrl = await storageSignedUpload(CHAT_MEDIA_BUCKET, objectPath);
  const upload = await fetch(uploadUrl, { method:"PUT", headers:{ "Content-Type":"image/gif" }, body:bytes, signal:AbortSignal.timeout(15_000) });
  if (!upload.ok) throw new ChatRequestError("That GIF could not be stored.", 502, "gif_import_storage_failed");
  await supabaseServiceRequest(restPath(TABLES.attachments), {
    method:"POST", headers:{ Prefer:"return=minimal" },
    body:{
      attachment_id:attachmentId, room_id:roomId, uploader_id:user.id, kind:"gif", file_name:fileName,
      content_type:"image/gif", byte_size:bytes.length, storage_bucket:CHAT_MEDIA_BUCKET, object_path:objectPath,
      status:"ready", ready_at:new Date().toISOString(), source_metadata:resolved.sourceMetadata,
    },
  });
  return {
    schemaVersion:chatContract.SCHEMA_VERSION,
    attachment:{
      attachmentId, kind:"gif", fileName, contentType:"image/gif", byteSize:bytes.length,
      url:await storageSignedDownload(CHAT_MEDIA_BUCKET, objectPath), saved:false,
      sourceMetadata:resolved.sourceMetadata,
    },
  };
}

async function gifSearch(query, user){
  const capabilities = await requireGifCapability(user);
  const q = String(query || "").trim().slice(0, 80);
  if (!q) return { schemaVersion:chatContract.SCHEMA_VERSION, capabilities, gifs:[] };
  const key = String(process.env.GIPHY_API_KEY || "").trim();
  if (key){
    const url = new URL("https://api.giphy.com/v1/gifs/search");
    url.search = new URLSearchParams({ api_key:key, q, limit:"24", rating:"pg-13", lang:"en" }).toString();
    const result = await fetch(url, { signal:AbortSignal.timeout(10_000) });
    if (!result.ok) throw new ChatRequestError("GIF search is temporarily unavailable.", 502, "gif_search_unavailable");
    const payload = await result.json();
    return {
      schemaVersion:chatContract.SCHEMA_VERSION, capabilities,
      attribution:"Powered by GIPHY",
      attributionUrl:"https://giphy.com/",
      gifs:(payload.data || []).map(item => ({
        id:item.id, gifId:item.id, provider:"giphy", title:item.title || "GIF", contentType:"image/gif",
        previewUrl:item.images?.fixed_width_small?.url || item.images?.preview_gif?.url,
        width:Number(item.images?.original?.width || 0), height:Number(item.images?.original?.height || 0),
        sourcePage:item.url || "https://giphy.com/", licence:"GIPHY Terms", attribution:"Powered by GIPHY",
      })).filter(item => item.previewUrl),
    };
  }

  const url = new URL("https://commons.wikimedia.org/w/api.php");
  url.search = new URLSearchParams({
    action:"query", generator:"search", gsrsearch:`${q} filemime:image/gif`,
    gsrnamespace:"6", gsrlimit:"24", prop:"imageinfo", iiprop:"url|mime|size|extmetadata",
    iiurlwidth:"240", format:"json", origin:"*",
  }).toString();
  const result = await fetch(url, { signal:AbortSignal.timeout(10_000) });
  if (!result.ok) throw new ChatRequestError("GIF search is temporarily unavailable.", 502, "gif_search_unavailable");
  const payload = await result.json();
  return {
    schemaVersion:chatContract.SCHEMA_VERSION, capabilities,
    attribution:"GIFs from Wikimedia Commons",
    attributionUrl:"https://commons.wikimedia.org/",
    gifs:Object.values(payload.query?.pages || {}).map(page => {
      const info = page.imageinfo?.[0] || {};
      const metadata = info.extmetadata || {};
      return {
        id:String(page.pageid || ""), gifId:String(page.pageid || ""), provider:"wikimedia",
        title:String(page.title || "GIF").replace(/^File:/, ""),
        contentType:"image/gif", previewUrl:info.thumburl || info.url,
        width:Number(info.width || 0), height:Number(info.height || 0),
        sourcePage:info.descriptionurl || `https://commons.wikimedia.org/?curid=${page.pageid}`,
        licence:metadata.LicenseShortName?.value || "See source page",
        attribution:metadata.Credit?.value || metadata.Artist?.value || "Wikimedia Commons",
      };
    }).filter(item => item.previewUrl && item.gifId),
  };
}

async function attachmentDownload(request, user, admin){
  const attachmentId = requireUuid(queryValue(request, "attachmentId"), "attachment ID");
  const attachment = (await rows(TABLES.attachments, {
    attachment_id:`eq.${attachmentId}`,
    status:"in.(ready,saved)",
    select:"attachment_id,room_id,storage_bucket,object_path",
    limit:"1",
  }))[0] || null;
  if (!attachment) throw new ChatRequestError("That attachment is unavailable.", 404, "chat_attachment_not_found");
  await requireRoomAccess(attachment.room_id, user, admin);
  return storageSignedDownload(attachment.storage_bucket, attachment.object_path);
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
  const attachmentIds = [...new Set((Array.isArray(body.attachmentIds) ? body.attachmentIds : []).map(value => requireUuid(value, "attachment ID")))];
  if (attachmentIds.length > MAX_ATTACHMENTS_PER_MESSAGE) throw new ChatRequestError("A message can include at most four attachments.", 400, "chat_attachment_limit");
  const messageAttachments = attachmentIds.length ? await rows(TABLES.attachments, {
    attachment_id:`in.(${attachmentIds.join(",")})`, room_id:`eq.${roomId}`, uploader_id:`eq.${user.id}`, status:"eq.ready",
    select:"attachment_id,kind,file_name,content_type,byte_size,source_metadata",
  }) : [];
  if (messageAttachments.length !== attachmentIds.length) throw new ChatRequestError("Every attachment must finish uploading before it can be sent.", 409, "chat_attachment_not_ready");
  if (messageAttachments.some(item => item.kind === "gif" || item.content_type === "image/gif")) await requireGifCapability(user);
  const clientId = chatContract.clientId(body.clientId);
  const replyToMessageId = body.replyToMessageId ? requireUuid(body.replyToMessageId, "reply message ID") : null;
  if (!message && !messageAttachments.length) throw new ChatRequestError("Add a message or attachment before sending.", 400, "invalid_chat_message");
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
        message_type:messageAttachments.length ? (message ? "mixed" : "media") : "text",
        body:message || "",
        reply_to_message_id:replyToMessageId,
        sender_display_name:guest ? senderDisplayName : null,
      },
    });
    row = saved?.[0] || (await rows(TABLES.messages, existingQuery))[0] || null;
  }
  if (!row) throw new ChatRequestError("The message could not be confirmed.", 502, "chat_message_not_confirmed");
  if (messageAttachments.length){
    await supabaseServiceRequest(restPath(TABLES.attachments, { attachment_id:`in.(${attachmentIds.join(",")})` }), {
      method:"PATCH", headers:{ Prefer:"return=minimal" }, body:{ message_id:row.id },
    });
  }
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
  const notificationFanout = dispatchChatMessageNotifications({ message:row, room, senderId:user.id })
    .catch(() => ({ attempted:0, sent:0, failed:0 }));
  try{
    waitUntil(notificationFanout);
  }catch(_error){
    // Local and non-Vercel runtimes may not expose a request context. The
    // promise has already started and remains deliberately detached from ack.
    void notificationFanout;
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
      attachments:messageAttachments.map(item => ({
        attachmentId:item.attachment_id, kind:item.kind, fileName:item.file_name,
        contentType:item.content_type, byteSize:Number(item.byte_size),
        url:null,
        saved:false,
        sourceMetadata:item.source_metadata || {},
      })),
      replyTo:replyTo ? {
        messageId:replyTo.id,
        senderName:replySenderName,
        body:replyTo.body,
      } : null,
    },
  };
}

async function saveAttachment(body, user, admin){
  if (isAnonymousUser(user)) throw new ChatRequestError("Sign in to save game media.", 401, "chat_sign_in_required");
  const attachmentId = requireUuid(body.attachmentId, "attachment ID");
  const attachment = (await rows(TABLES.attachments, {
    attachment_id:`eq.${attachmentId}`, uploader_id:`eq.${user.id}`, status:"eq.ready",
    select:"*", limit:"1",
  }))[0] || null;
  if (!attachment) throw new ChatRequestError("Only the person who posted this media can save it.", 403, "chat_attachment_save_forbidden");
  await requireRoomAccess(attachment.room_id, user, admin);
  const savedId = crypto.randomUUID();
  const savedPath = `${user.id}/${savedId}/${attachment.file_name}`;
  await supabaseServiceRequest(`/storage/v1/object/copy`, {
    method:"POST",
    body:{ bucketId:attachment.storage_bucket, sourceKey:attachment.object_path, destinationBucket:SAVED_MEDIA_BUCKET, destinationKey:savedPath },
  });
  await supabaseServiceRequest(restPath(TABLES.savedMedia), {
    method:"POST", headers:{ Prefer:"return=minimal" },
    body:{ saved_media_id:savedId, owner_id:user.id, source_attachment_id:attachmentId, room_id:attachment.room_id,
      event_id:(await roomById(attachment.room_id))?.canonical_fixture_id || null, file_name:attachment.file_name,
      content_type:attachment.content_type, byte_size:attachment.byte_size, storage_bucket:SAVED_MEDIA_BUCKET, object_path:savedPath,
      source_metadata:attachment.source_metadata || {} },
  });
  await supabaseServiceRequest(restPath(TABLES.attachments, { attachment_id:`eq.${attachmentId}` }), {
    method:"PATCH", headers:{ Prefer:"return=minimal" }, body:{ status:"saved", saved_at:new Date().toISOString() },
  });
  return { schemaVersion:chatContract.SCHEMA_VERSION, saved:true, savedMediaId:savedId };
}

async function listSavedMedia(user){
  if (isAnonymousUser(user)) throw new ChatRequestError("Sign in to view saved game media.", 401, "chat_sign_in_required");
  const saved = await rows(TABLES.savedMedia, {
    owner_id:`eq.${user.id}`,
    select:"saved_media_id,event_id,file_name,content_type,byte_size,storage_bucket,object_path,source_metadata,created_at",
    order:"created_at.desc",
    limit:"200",
  });
  return {
    schemaVersion:chatContract.SCHEMA_VERSION,
    media:await Promise.all(saved.map(async item => ({
      savedMediaId:item.saved_media_id, eventId:item.event_id, fileName:item.file_name,
      contentType:item.content_type, byteSize:Number(item.byte_size), savedAt:item.created_at,
      url:await storageSignedDownload(item.storage_bucket, item.object_path),
      sourceMetadata:item.source_metadata || {},
    }))),
  };
}

async function deleteSavedMedia(body, user){
  if (isAnonymousUser(user)) throw new ChatRequestError("Sign in to manage saved game media.", 401, "chat_sign_in_required");
  const savedMediaId = requireUuid(body.savedMediaId, "saved media ID");
  const item = (await rows(TABLES.savedMedia, {
    saved_media_id:`eq.${savedMediaId}`, owner_id:`eq.${user.id}`,
    select:"saved_media_id,storage_bucket,object_path", limit:"1",
  }))[0] || null;
  if (!item) throw new ChatRequestError("That saved media is unavailable.", 404, "saved_media_not_found");
  await supabaseServiceRequest(`/storage/v1/object/${item.storage_bucket}`, {
    method:"DELETE", body:{ prefixes:[item.object_path] },
  });
  await supabaseServiceRequest(restPath(TABLES.savedMedia, { saved_media_id:`eq.${savedMediaId}`, owner_id:`eq.${user.id}` }), {
    method:"DELETE", headers:{ Prefer:"return=minimal" },
  });
  return { schemaVersion:chatContract.SCHEMA_VERSION, deleted:true, savedMediaId };
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
  if (room.status === "closed") throw new ChatRequestError("This chat is already closed.", 409, "chat_room_closed");
  if (room.status === "open"){
    await supabaseServiceRequest(restPath(TABLES.rooms, { id:`eq.${roomId}`, select:"*" }), {
      method:"PATCH", headers:{ Prefer:"return=representation" }, body:{ status:"closing", closed_by:user.id },
    });
  }
  const transient = await rows(TABLES.attachments, {
    room_id:`eq.${roomId}`, status:"in.(pending,ready)",
    select:"attachment_id,object_path",
  });
  if (transient.length){
    await supabaseServiceRequest(`/storage/v1/object/${CHAT_MEDIA_BUCKET}`, {
      method:"DELETE", body:{ prefixes:transient.map(item => item.object_path) },
    });
    await supabaseServiceRequest(restPath(TABLES.attachments, { room_id:`eq.${roomId}`, status:"in.(pending,ready)" }), {
      method:"DELETE", headers:{ Prefer:"return=minimal" },
    });
  }
  const saved = await supabaseServiceRequest(restPath(TABLES.rooms, { id:`eq.${roomId}`, status:"eq.closing", select:"*" }), {
    method:"PATCH", headers:{ Prefer:"return=representation" }, body:{ status:"closed", closed_by:user.id },
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
    case "attachment-upload-url": return prepareAttachment(body, user, admin);
    case "attachment-complete": return completeAttachment(body, user, admin);
    case "gif-import": return gifImport(body, user, admin);
    case "attachment-save": return saveAttachment(body, user, admin);
    case "saved-media-delete": return deleteSavedMedia(body, user);
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
      else if (mode === "gif-search") payload = await gifSearch(queryValue(request, "q"), user);
      else if (mode === "saved-media") payload = await listSavedMedia(user);
      else if (mode === "attachment"){
        response.redirect(302, await attachmentDownload(request, user, admin));
        return;
      }
      else if (queryValue(request, "roomId")) payload = await handleRoomGet(request, user, admin, profile);
      else throw new ChatRequestError("Choose an active, users or room chat query.", 400, "invalid_chat_mode");
    } else {
      payload = await handlePost(request, user, admin, profile);
    }
    response.status(200).json(payload);
  }catch(error){
    if (error instanceof ChatRequestError || error instanceof ChatCapabilityError){
      response.status(error.status).json({ error:error.message, code:error.code, ...(error.details || {}) });
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
