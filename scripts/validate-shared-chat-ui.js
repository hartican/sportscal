#!/usr/bin/env node

"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");

function section(source, start, end){
  const startIndex = source.indexOf(start);
  assert.notEqual(startIndex, -1, `missing section start: ${start}`);
  const endIndex = source.indexOf(end, startIndex + start.length);
  assert.notEqual(endIndex, -1, `missing section end: ${end}`);
  return source.slice(startIndex, endIndex);
}

function assertOrder(source, markers, message){
  let previous = -1;
  markers.forEach(marker => {
    const found = source.indexOf(marker, previous + 1);
    assert.notEqual(found, -1, `${message}: missing ${marker}`);
    assert(found > previous, `${message}: ${marker} is out of order`);
    previous = found;
  });
}

// The app share action belongs in the brand row and shares only the canonical app URL.
const brandRow = section(html, '<div class="brand-title-row">', '<div class="slogan"');
assert.match(brandRow, /id="shareAppBtn"/);
assert.match(brandRow, /data-vector-glyph="ui:share"/);
assert.match(brandRow, />Share app</);
const appShare = section(html, "function canonicalAppShareUrl()", 'document.getElementById("soundtrackToggle")');
assert.match(html, /<link rel="canonical" href="https:\/\/nothingsport\.vercel\.app\/">/, "the clean production app URL must be configured independently of preview origins");
assert.match(appShare, /document\.querySelector\('link\[rel="canonical"\]'\)/);
assert.match(appShare, /new URL\("\/", configured\)\.href/);
assert.match(appShare, /navigator\.share\(\{ title, text, url \}\)/, "Web Share must be the first app-link path");
assert.match(appShare, /navigator\.clipboard\?\.writeText/);
assert.match(appShare, /window\.prompt\("Copy this link", url\)/, "the final fallback must expose a selectable URL");
assertOrder(appShare, ["navigator.share", "navigator.clipboard", 'window.prompt("Copy this link"'], "share fallbacks");
assert.match(appShare, /id\("shareAppBtn"\)|getElementById\("shareAppBtn"\)/);
assert.match(appShare, /url:canonicalAppShareUrl\(\)/);

// Guest credentials are accepted only from the fragment, retained locally, then removed immediately.
const capabilityCapture = section(html, "function captureChatCapabilityFromLocation()", "let activeRecoverySession");
assert.match(capabilityCapture, /window\.location\.hash/);
assert.match(capabilityCapture, /fragment\.get\("chat"\)/);
assert.match(capabilityCapture, /sessionStorage\.setItem\(CHAT_CAPABILITY_STORAGE_KEY, capability\)/);
assertOrder(capabilityCapture, [
  'fragment.delete("chat")',
  "history.replaceState",
  "return capability",
], "capability capture and address-bar cleanup");
const guestUrl = section(html, "function roomGuestShareUrl(capability)", "async function shareRoomWithGuests");
assert.match(guestUrl, /#chat=\$\{encodeURIComponent/);
assert.doesNotMatch(guestUrl, /[?&]chat=/, "guest bearer credentials must not be placed in the request URL");

// A signed-out recipient sees a preview, chooses a room-scoped name, and joins with an invisible anonymous session.
const guestPreview = section(html, "function renderGuestChatPreview(preview, capability)", "async function openPendingSharedChat");
assert.match(guestPreview, /className = "chat-guest-preview"/);
assert.match(guestPreview, /no account or visible sign-in is required/i);
assert.match(guestPreview, /label\.textContent = "Name in this room"/);
assert.match(guestPreview, /input\.required = true/);
assertOrder(guestPreview, [
  "await serverSyncClient.anonymousChatSession({ capability, guestDisplayName:input.value })",
  "syncPermittedChatPushInstallation()",
  '{ action:"join-shared-room", capability, guestDisplayName:input.value }',
  "clearPendingChatCapability()",
], "anonymous guest join");
assert.doesNotMatch(guestPreview, /openSettings|signIn|login/i, "guest join must not divert to account UI");
const pendingShare = section(html, "async function openPendingSharedChat()", "function prepareChatAudio");
assert.match(pendingShare, /chatGuestPreview\(capability\)/);
assert.match(pendingShare, /serverSyncClient\.getSession\?\.\(\)/, "signed-in recipients must retain their account identity");
assert.match(pendingShare, /\{ action:"join-shared-room", capability \}/);

// Room order is Members disclosure, messages, reply preview, then the in-flow composer.
const roomRender = section(html, "function renderOpenChatRoom(", "function mergeChatMessages");
assertOrder(roomRender, [
  "body.replaceChildren()",
  "body.appendChild(renderChatMembersDisclosure(room))",
  "buildChatAlertPrompt()",
  "body.appendChild(buildChatMessageList())",
  "buildChatReplyPreview()",
  "body.appendChild(buildChatComposer",
], "room body layout");
const members = section(html, "function renderChatMembersDisclosure(room)", "function buildChatReplyPreview");
assert.match(members, /document\.createElement\("details"\)/);
assert.match(members, /summary\.textContent = `Members \(\$\{count\}\)`/);
assert.doesNotMatch(members, /details\.open\s*=\s*true/, "members must start collapsed");
assert.match(members, /renderChatAdminControls\(content, room\)/, "admin controls must remain inside the disclosure");
assert.match(roomRender, /shareHeader\.hidden = !\(chatState\.isAdmin && room\.status === "open"\)/);
assert.match(roomRender, /shareHeader\.textContent = "Share room"/);
assert.match(html, /\.chat-room-composer\{[\s\S]*?grid-template-columns:1fr;[\s\S]*?width:100%;/);
assert.match(html, /\.chat-room-composer textarea\{[\s\S]*?width:100%;/);
assert.match(html, /\.chat-room-composer \.btn\{ width:100%;/);
assert.doesNotMatch(html, /<form[^>]+class="chat-composer"/, "the retired fixed drawer composer must not render");

// Replies remain one level, while grouped reactions use the exact fixed palette and their own cursor.
const sendMessage = section(html, "async function sendChatMessage(form)", "function buildChatComposer");
assert.match(sendMessage, /replyToMessageId:chatState\.replyToMessageId/);
const messageView = section(html, "function chatMessageElement(message)", "function renderChatPublicProfileForm");
assert.match(messageView, /if \(message\.replyTo\)/);
assert.match(messageView, /message\.replyTo\.senderName/);
assert.match(messageView, /message\.replyTo\.body/);
assert.doesNotMatch(messageView, /message\.replyTo\.replyTo/, "quoted replies must not render nested threads");
assert.match(html, /const CHAT_REACTION_EMOJIS = Object\.freeze\(\["👍", "❤️", "😂", "😮", "😢", "👏"\]\)/);
assert.match(messageView, /CHAT_REACTION_EMOJIS\.forEach\(emoji =>/);
assert.match(messageView, /`\$\{reaction\.emoji\} \$\{reaction\.count\}`/);
assert.match(messageView, /aria-pressed[\s\S]*reaction\.own/);
assert.match(html, /action:"toggle-reaction"/);
const polling = section(html, "async function pollChatRoom()", "async function refreshChatActive");
assert.match(polling, /reactionAfter:chatState\.reactionCursor/);
assert.match(polling, /mergeChatReactionChanges\(payload\.reactionChanges\)/);
assert.match(polling, /payload\.reactionCursor/);
assert.match(polling, /refreshChatMessageStream\(/, "polling must patch the message stream without replacing the composer or Members state");
assert.match(polling, /if \(payload\.room\.status !== previousStatus\) renderOpenChatRoom[\s\S]{0,100}else if \(added \|\| reactionsChanged\) refreshChatMessageStream/, "only a room-status transition may rebuild the room body during polling");
const activePolling = section(html, "function chatUnreadIncreasedOutsideOpenRoom", "function scheduleChatActivePoll");
assert.match(activePolling, /previousUnreadByRoom/);
assert.match(activePolling, /room\.roomId !== currentRoomId/, "the active poll must leave the open room's cue to its message poll");
assert.match(activePolling, /Number\(room\.unreadCount \|\| 0\) > Number\(previousUnreadByRoom\.get\(room\.roomId\) \|\| 0\)/);
assert.match(activePolling, /chatState\.activeSignature[\s\S]+chatUnreadIncreasedOutsideOpenRoom/);
assert.equal((activePolling.match(/playIncomingChatSound\(\)/g) || []).length,1,"one active poll must play at most one cue for all outside-room unread increases");
const unreadHelperSource = section(html, "function chatUnreadIncreasedOutsideOpenRoom", "async function refreshChatActive");
const chatUnreadIncreasedOutsideOpenRoom = Function(`${unreadHelperSource}; return chatUnreadIncreasedOutsideOpenRoom;`)();
assert.equal(chatUnreadIncreasedOutsideOpenRoom(
  [{roomId:"open",unreadCount:0},{roomId:"outside",unreadCount:1}],
  [{roomId:"open",unreadCount:1},{roomId:"outside",unreadCount:2}],
  "open",
),true,"one outside-room unread increase must request a cue even when the open room also changes");
assert.equal(chatUnreadIncreasedOutsideOpenRoom(
  [{roomId:"open",unreadCount:0}],
  [{roomId:"open",unreadCount:1}],
  "open",
),false,"the active poll must not duplicate the open room's message-poll cue");
assert.equal(chatUnreadIncreasedOutsideOpenRoom([], [{roomId:"outside",unreadCount:4}], null),false,"the first active snapshot must not sound for historical unread messages");

// Signed-in identity is one global Public Profile. Chat never writes the retired room profile.
assert.doesNotMatch(html, /Public pilot profile/i);
assert.doesNotMatch(html, /action\s*:\s*["']set-display-name["']/, "the UI must not create chat-specific display names");
const chatProfile = section(html, "function renderChatPublicProfileForm", "function renderChatAdminControls");
assert.match(chatProfile, /heading\.textContent = "Public Profile"/);
assert.match(chatProfile, /action:"profile"/);
assert.match(chatProfile, /nothingscoreRequest/);
const accountProfile = section(html, "function appendPublicProfileAccountSettings", "function renderAccountSettings");
assert.match(accountProfile, /title\.textContent = "Public Profile"/);
assert.match(accountProfile, /nothingscoreProfileForm\(\)/);
const nscDrawer = section(html, "function renderNothingscoreDrawer()", "async function loadNothingscoreLeaderboard");
assert.doesNotMatch(nscDrawer, /nothingscoreProfileForm\(\)/, "NSC must link to Settings instead of duplicating the editor");
assert.match(nscDrawer, /Edit in Settings/);
assert.match(nscDrawer, /settingsSection = "account"/);

console.log("Shared chat and Public Profile UI validation passed.");
