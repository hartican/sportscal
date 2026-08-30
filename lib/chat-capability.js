"use strict";

const crypto = require("node:crypto");

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const NONCE_PATTERN = /^[A-Za-z0-9_-]{32}$/;
const SIGNATURE_PATTERN = /^[A-Za-z0-9_-]{43}$/;

class ChatCapabilityError extends Error{
  constructor(message, status = 404, code = "chat_share_invalid"){
    super(message);
    this.status = status;
    this.code = code;
  }
}

function requireShareSecret(environment = process.env){
  const secret = String(environment.CHAT_GUEST_LINK_SECRET || "").trim();
  if(secret.length < 32)throw new ChatCapabilityError("Guest chat sharing is temporarily unavailable.",503,"chat_share_unavailable");
  return secret;
}

function invalidCapability(){
  return new ChatCapabilityError("That guest chat link is invalid or expired.",404,"chat_share_invalid");
}

function signature(payload, environment){
  return crypto.createHmac("sha256",requireShareSecret(environment)).update(payload,"utf8").digest("base64url");
}

function createShareCapability(room, environment = process.env){
  const roomId=String(room?.id||"").trim(),version=Number(room?.guest_share_version),nonce=String(room?.guest_share_nonce||"");
  if(!UUID_PATTERN.test(roomId)||!Number.isSafeInteger(version)||version<1||!NONCE_PATTERN.test(nonce)){
    throw new ChatCapabilityError("Guest chat sharing is temporarily unavailable.",503,"chat_share_unavailable");
  }
  const payload=`${roomId}.${version}.${nonce}`;
  return `v1.${payload}.${signature(payload,environment)}`;
}

function parseShareCapability(value, environment = process.env){
  const parts=String(value||"").trim().split(".");
  if(parts.length!==5||parts[0]!=="v1")throw invalidCapability();
  const roomId=parts[1],version=Number(parts[2]),nonce=parts[3],supplied=parts[4];
  if(!UUID_PATTERN.test(roomId)||!Number.isSafeInteger(version)||version<1||!NONCE_PATTERN.test(nonce)||!SIGNATURE_PATTERN.test(supplied))throw invalidCapability();
  const expected=signature(`${roomId}.${version}.${nonce}`,environment);
  const suppliedBuffer=Buffer.from(supplied,"utf8"),expectedBuffer=Buffer.from(expected,"utf8");
  if(suppliedBuffer.length!==expectedBuffer.length||!crypto.timingSafeEqual(suppliedBuffer,expectedBuffer))throw invalidCapability();
  return{roomId,version,nonce};
}

function headerValue(request,name){
  const headers=request?.headers;
  if(typeof headers?.get==="function")return String(headers.get(name)||"");
  const value=headers?.[name]??headers?.[name.toLowerCase()]??headers?.[name.toUpperCase()];
  return String(Array.isArray(value)?value[0]:value||"");
}

function clientAddress(request){
  // Vercel overwrites x-forwarded-for before invoking the function. Do not
  // prefer similarly named, attacker-controlled alternate headers.
  const forwarded=headerValue(request,"x-forwarded-for")||headerValue(request,"x-real-ip");
  const candidate=(forwarded.split(",")[0]||request?.socket?.remoteAddress||"").trim().toLowerCase();
  return candidate.slice(0,128)||"unavailable";
}

function anonymousRateHash(request, environment = process.env){
  return crypto.createHmac("sha256",requireShareSecret(environment))
    .update(`anonymous-chat-session\0${clientAddress(request)}`,"utf8")
    .digest("hex");
}

function anonymousSignupTicketHash(ticket){
  const raw=String(ticket||"");
  if(!/^[A-Za-z0-9_-]{43}$/.test(raw))throw new TypeError("Anonymous signup tickets must contain 32 random bytes encoded as base64url.");
  return crypto.createHash("sha256").update(raw,"utf8").digest("hex");
}

function createAnonymousSignupTicket(){
  const ticket=crypto.randomBytes(32).toString("base64url");
  return Object.freeze({ticket,hash:anonymousSignupTicketHash(ticket)});
}

module.exports=Object.freeze({
  ChatCapabilityError,
  anonymousRateHash,
  anonymousSignupTicketHash,
  clientAddress,
  createAnonymousSignupTicket,
  createShareCapability,
  parseShareCapability,
  requireShareSecret,
});
