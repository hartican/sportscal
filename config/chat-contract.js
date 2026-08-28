(function(root, factory){
  const value = factory();
  if (typeof module === "object" && module.exports) module.exports = value;
  if (root) root.NOTHINGSPORTS_CHAT = value;
})(typeof globalThis !== "undefined" ? globalThis : this, function(){
  "use strict";

  const SCHEMA_VERSION = "private-fixture-chat.v1";
  const LIMITS = Object.freeze({
    membersPerRoom:25,
    openRoomsPerFixture:10,
    messageCodePoints:500,
    messagesPerMinute:30,
    historyPage:100,
    displayNameMin:2,
    displayNameMax:30,
    roomNameMax:80,
    userSearchMin:3,
    userSearchResults:10,
  });
  const POLLING = Object.freeze({ roomMs:2_000, activeMs:30_000, failureMs:30_000 });

  function codePointLength(value){
    return Array.from(String(value || "")).length;
  }

  function cleanSingleLine(value){
    return String(value || "")
      .normalize("NFC")
      .replace(/[\u0000-\u001f\u007f]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function displayName(value){
    const cleaned = cleanSingleLine(value);
    const length = codePointLength(cleaned);
    return length >= LIMITS.displayNameMin && length <= LIMITS.displayNameMax ? cleaned : "";
  }

  function roomName(value){
    const cleaned = cleanSingleLine(value);
    const length = codePointLength(cleaned);
    return length >= 1 && length <= LIMITS.roomNameMax ? cleaned : "";
  }

  function messageBody(value){
    const cleaned = String(value || "")
      .normalize("NFC")
      .replace(/\r\n?/g, "\n")
      .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
      .trim();
    const length = codePointLength(cleaned);
    return length >= 1 && length <= LIMITS.messageCodePoints ? cleaned : "";
  }

  function clientId(value){
    const cleaned = String(value || "").trim();
    return /^[A-Za-z0-9:_-]{8,128}$/.test(cleaned) ? cleaned : "";
  }

  function fixtureId(value){
    const cleaned = String(value || "").trim();
    return cleaned.length >= 1 && cleaned.length <= 180 && !/[\u0000-\u001f\u007f]/.test(cleaned) ? cleaned : "";
  }

  return Object.freeze({
    SCHEMA_VERSION,
    LIMITS,
    POLLING,
    clientId,
    codePointLength,
    displayName,
    fixtureId,
    messageBody,
    roomName,
  });
});
