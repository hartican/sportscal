"use strict";

const {
  authenticatedUser,
  bearerToken,
  publicError,
  requestOrigin,
  supabaseConfig,
  supabaseRequest,
  supabaseServiceRequest,
} = require("../lib/supabase-server");
const followFirst = require("../config/follow-first");
const chatContract = require("../config/chat-contract");
const {
  ChatCapabilityError,
  anonymousRateHash,
  clientAddress,
  createAnonymousSignupTicket,
  parseShareCapability,
} = require("../lib/chat-capability");

function setPrivateResponseHeaders(response){
  response.setHeader("Cache-Control", "private, no-store, max-age=0");
  response.setHeader("Pragma", "no-cache");
}

function requestBody(request){
  if (!request?.body) return {};
  if (typeof request.body === "object") return request.body;
  try{
    return JSON.parse(request.body);
  }catch(_error){
    return {};
  }
}

function validEmail(value){
  const email = String(value || "").trim().toLowerCase();
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "";
}

function validPassword(value){
  const password = typeof value === "string" ? value : "";
  return password.length > 0 && password.length <= 1024 ? password : "";
}

function validNewPassword(value){
  const password = typeof value === "string" ? value : "";
  return password.length >= 8 && password.length <= 1024 ? password : "";
}

function recoveryCallback(request, environment = process.env){
  const allowed = new Set(["https://nothingsport.vercel.app"]);
  String(environment.AUTH_RECOVERY_ORIGINS || "").split(",").map(value => value.trim()).filter(Boolean).forEach(value => {
    try{ allowed.add(new URL(value).origin); }catch(_error){ /* Ignore malformed configuration. */ }
  });
  if (environment.VERCEL_URL){
    try{ allowed.add(new URL(`https://${environment.VERCEL_URL}`).origin); }catch(_error){ /* Ignore malformed deployment metadata. */ }
  }
  const candidate = requestOrigin(request);
  if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(candidate)) allowed.add(candidate);
  const origin = allowed.has(candidate) ? candidate : "https://nothingsport.vercel.app";
  return `${origin}/?auth=recovery`;
}

function signupCallback(request){
  return `${recoveryCallback(request).replace(/\?auth=recovery$/, "")}?auth=confirmed`;
}

function publicUser(user){
  return {
    id: user.id,
    email: user.email || "",
    isAnonymous:user.is_anonymous === true,
    createdAt: user.created_at || null,
  };
}

function anonymousAuthSecret(environment = process.env){
  const secret=String(environment.SUPABASE_SECRET_KEY||"").trim();
  if(!/^sb_secret_[A-Za-z0-9_-]+$/.test(secret)){
    throw new ChatCapabilityError("Guest chat sessions are temporarily unavailable.",503,"anonymous_chat_session_unavailable");
  }
  return secret;
}

function anonymousAuthRequest(request,path,options={}){
  const secret=anonymousAuthSecret();
  return supabaseRequest(path,{
    ...options,
    headers:{...(options.headers||{}),"Sb-Forwarded-For":clientAddress(request)},
    environment:{...process.env,SUPABASE_PUBLISHABLE_KEY:secret,SUPABASE_ANON_KEY:""},
  });
}

function rpcRow(payload){return Array.isArray(payload)?payload[0]||null:payload||null}

async function removeAnonymousUser(userId){
  if(!userId)return;
  try{await supabaseServiceRequest(`/auth/v1/admin/users/${encodeURIComponent(userId)}`,{method:"DELETE"})}catch(_error){/* Daily orphan cleanup is the bounded fallback. */}
}

function anonymousSessionWithoutMetadata(session){
  const expiresAt=Number(session?.expires_at);
  return {
    access_token:String(session?.access_token||""),
    refresh_token:String(session?.refresh_token||""),
    expires_in:Number(session?.expires_in)||3600,
    ...(Number.isFinite(expiresAt)&&expiresAt>0?{expires_at:expiresAt}:{}),
    token_type:String(session?.token_type||"bearer"),
    user:publicUser(session?.user||{}),
  };
}

function jwtHasSignupTicket(accessToken){
  const payload=String(accessToken||"").split(".")[1];
  if(!payload)return false;
  try{
    const claims=JSON.parse(Buffer.from(payload,"base64url").toString("utf8"));
    return Boolean(claims?.user_metadata?.chat_signup_ticket);
  }catch(_error){
    return false;
  }
}

async function clearAnonymousSignupTicketAndRefresh(request,session){
  await supabaseServiceRequest(`/auth/v1/admin/users/${encodeURIComponent(session.user.id)}`,{
    method:"PUT",
    body:{
      user_metadata:{purpose:"fixture-chat-guest",chat_signup_ticket:null},
      app_metadata:{...(session.user?.app_metadata||{}),chat_guest_attested:true},
    },
  });
  const refreshed=await anonymousAuthRequest(request,"/auth/v1/token?grant_type=refresh_token",{
    method:"POST",
    body:{refresh_token:session.refresh_token},
  });
  if(!refreshed?.access_token||!refreshed?.refresh_token||!refreshed?.user?.id||refreshed.user.is_anonymous!==true
     ||refreshed.user?.app_metadata?.chat_guest_attested!==true
     ||refreshed.user?.user_metadata?.chat_signup_ticket||jwtHasSignupTicket(refreshed.access_token)){
    throw new Error("Anonymous signup metadata could not be cleared.");
  }
  return anonymousSessionWithoutMetadata(refreshed);
}

module.exports = async function authHandler(request, response){
  setPrivateResponseHeaders(response);
  const config = supabaseConfig();
  let authAction = "";

  try{
    if (request.method === "GET" || !request.method){
      const accessToken = bearerToken(request);
      if (!accessToken){
        response.status(200).json({
          configured: config.configured,
          provider: config.configured ? "supabase" : "local",
        });
        return;
      }
      const user = await authenticatedUser(accessToken);
      response.status(200).json({ configured: true, user: publicUser(user) });
      return;
    }

    if (request.method !== "POST"){
      response.setHeader("Allow", "GET, POST");
      response.status(405).json({ error: "Auth supports GET and POST requests only.", code: "method_not_allowed" });
      return;
    }

    const body = requestBody(request);
    authAction = String(body.action || "");
    if (body.action === "anonymous-chat-session"){
      const capability=parseShareCapability(body.capability);
      const guestDisplayName=chatContract.displayName(body.guestDisplayName);
      if(!guestDisplayName){
        response.status(400).json({error:"Choose a guest name between 2 and 30 characters.",code:"chat_guest_name_required"});
        return;
      }
      anonymousAuthSecret();
      const signupTicket=createAnonymousSignupTicket();
      const authorization=rpcRow(await supabaseServiceRequest("/rest/v1/rpc/nothingsports_chat_authorize_anonymous_session",{
        method:"POST",
        body:{
          target_room:capability.roomId,
          target_version:capability.version,
          target_nonce:capability.nonce,
          target_ip_hash:anonymousRateHash(request),
          target_ticket_hash:signupTicket.hash,
        },
      }));
      if(authorization?.outcome==="rate_limited"){
        response.status(429).json({error:"Too many guest sessions were requested for this room. Please wait and try again.",code:"chat_guest_rate_limited"});
        return;
      }
      if(authorization?.outcome!=="authorized"){
        response.status(404).json({error:"That guest chat link is invalid or expired.",code:"chat_share_invalid"});
        return;
      }
      const session = await anonymousAuthRequest(request,"/auth/v1/signup", {
        method:"POST",
        body:{
          data:{purpose:"fixture-chat-guest",chat_signup_ticket:signupTicket.ticket},
        },
      });
      if (!session?.access_token || !session?.user?.id || session.user.is_anonymous !== true){
        if(session?.user?.id&&session.user.is_anonymous===true)await removeAnonymousUser(session.user.id);
        response.status(502).json({ error:"A guest chat session could not be created.", code:"anonymous_chat_session_unavailable" });
        return;
      }
      let joined;
      try{
        joined=rpcRow(await supabaseServiceRequest("/rest/v1/rpc/nothingsports_chat_join_shared_room",{
          method:"POST",
          body:{target_room:capability.roomId,target_version:capability.version,target_nonce:capability.nonce,target_user:session.user.id,target_member_kind:"guest",target_guest_display_name:guestDisplayName},
        }));
      }catch(error){
        await removeAnonymousUser(session.user.id);
        throw error;
      }
      if(!["joined","existing"].includes(joined?.outcome)){
        await removeAnonymousUser(session.user.id);
        if(joined?.outcome==="full")response.status(409).json({error:"This chat room already has 25 participants.",code:"chat_room_full"});
        else if(joined?.outcome==="closed")response.status(409).json({error:"This chat room is closed.",code:"chat_room_closed"});
        else response.status(404).json({error:"That guest chat link is invalid or expired.",code:"chat_share_invalid"});
        return;
      }
      let cleanSession;
      try{
        cleanSession=await clearAnonymousSignupTicketAndRefresh(request,session);
      }catch(_error){
        await removeAnonymousUser(session.user.id);
        response.status(502).json({error:"A guest chat session could not be created.",code:"anonymous_chat_session_unavailable"});
        return;
      }
      response.status(200).json({
        session:cleanSession,user:cleanSession.user,joined:true,existing:joined.outcome==="existing",
        room:{roomId:capability.roomId,memberCount:Number(joined.member_count)||0},
        viewer:{kind:"guest",displayName:guestDisplayName,canPost:true},
      });
      return;
    }

    if (body.action === "sign-up"){
      const email = validEmail(body.email);
      const password = validNewPassword(body.password);
      if (!email){
        response.status(400).json({ error:"Enter a valid email address.", code:"invalid_email" });
        return;
      }
      if (!password){
        response.status(400).json({ error:"Use between 8 and 1024 characters.", code:"invalid_password" });
        return;
      }
      const meta = followFirst.normalizeMeta({ ...(body.meta || {}), source:"signup" });
      const signup = await supabaseRequest(`/auth/v1/signup?redirect_to=${encodeURIComponent(signupCallback(request))}`, {
        method:"POST",
        body:{ email, password },
      });
      let metadataDeferred = false;
      if (signup?.user?.id){
        try{
          await supabaseServiceRequest("/rest/v1/nothingsports_user_meta?on_conflict=user_id", {
            method:"POST",
            headers:{ Prefer:"resolution=merge-duplicates,return=minimal" },
            body:{
              user_id:signup.user.id,
              schema_version:meta.schemaVersion,
              revision:meta.revision,
              seed_hash:meta.seedHash,
              sports:meta.sports,
              major_events:meta.majorEvents,
              offer_interests:meta.offerInterests,
              coarse_region:meta.location,
              // Signup is performed by the server service role. Consent may only
              // be granted later from the user's own authenticated session.
              personalised_offers_consent:false,
              consent_updated_at:null,
              source:"signup",
              updated_at:new Date().toISOString(),
            },
          });
        }catch(_error){
          // Account creation must not be rolled back by a transient metadata
          // insert failure. The authenticated first session idempotently seeds it.
          metadataDeferred = true;
        }
      }
      response.status(200).json({
        user:signup?.user ? publicUser(signup.user) : null,
        session:signup?.access_token ? signup : null,
        confirmationRequired:!signup?.access_token,
        metadataDeferred,
      });
      return;
    }

    if (body.action === "password-recovery-request"){
      const email = validEmail(body.email);
      if (!email){
        response.status(400).json({ error: "Enter a valid email address.", code: "invalid_email" });
        return;
      }
      try{
        await supabaseRequest(`/auth/v1/recover?redirect_to=${encodeURIComponent(recoveryCallback(request))}`, {
          method: "POST",
          body: { email },
        });
      }catch(error){
        if (![400, 404, 422].includes(error?.status)) throw error;
      }
      response.status(200).json({ requested: true, message: "If that account exists, a password reset link is on its way." });
      return;
    }

    if (body.action === "password-update"){
      const accessToken = bearerToken(request);
      const password = validNewPassword(body.password);
      if (!accessToken){
        response.status(401).json({ error: "This password reset link is invalid or expired.", code: "missing_recovery_token" });
        return;
      }
      if (!password){
        response.status(400).json({ error: "Use between 8 and 1024 characters.", code: "invalid_password" });
        return;
      }
      await supabaseRequest("/auth/v1/user", {
        method: "PUT",
        accessToken,
        body: { password },
      });
      response.status(200).json({ updated: true });
      return;
    }

    if (body.action === "password-sign-in"){
      const email = validEmail(body.email);
      if (!email){
        response.status(400).json({ error: "Enter a valid email address.", code: "invalid_email" });
        return;
      }
      const password = validPassword(body.password);
      if (!password){
        response.status(400).json({ error: "Enter your password.", code: "invalid_password" });
        return;
      }
      const session = await supabaseRequest("/auth/v1/token?grant_type=password", {
        method: "POST",
        body: {
          email,
          password,
        },
      });
      response.status(200).json({ session });
      return;
    }

    if(body.action==="refresh-anonymous-chat-session"){
      const refreshToken=String(body.refreshToken||"");
      if(!refreshToken){
        response.status(400).json({error:"A guest refresh token is required.",code:"missing_refresh_token"});
        return;
      }
      const session=await anonymousAuthRequest(request,"/auth/v1/token?grant_type=refresh_token",{
        method:"POST",
        body:{refresh_token:refreshToken},
      });
      if(!session?.access_token||!session?.refresh_token||!session?.user?.id||session.user.is_anonymous!==true
         ||session.user?.app_metadata?.chat_guest_attested!==true
         ||session.user?.user_metadata?.chat_signup_ticket||jwtHasSignupTicket(session.access_token)){
        response.status(401).json({error:"That guest chat session is not valid.",code:"invalid_guest_chat_session"});
        return;
      }
      response.status(200).json({session:anonymousSessionWithoutMetadata(session)});
      return;
    }

    if (body.action === "refresh"){
      const refreshToken = String(body.refreshToken || "");
      if (!refreshToken){
        response.status(400).json({ error: "A refresh token is required.", code: "missing_refresh_token" });
        return;
      }
      const session = await supabaseRequest("/auth/v1/token?grant_type=refresh_token", {
        method: "POST",
        body: { refresh_token: refreshToken },
      });
      response.status(200).json({ session });
      return;
    }

    if (body.action === "logout"){
      const accessToken = bearerToken(request);
      if (accessToken){
        await supabaseRequest("/auth/v1/logout?scope=local", {
          method: "POST",
          accessToken,
        });
      }
      response.status(200).json({ signedOut: true });
      return;
    }

    response.status(400).json({ error: "Unknown auth action.", code: "unknown_auth_action" });
  }catch(error){
    if(error instanceof ChatCapabilityError){response.status(error.status).json({error:error.message,code:error.code});return}
    const outgoing = publicError(error);
    if (["refresh", "refresh-anonymous-chat-session"].includes(authAction)){
      const terminal = [400, 401, 403].includes(Number(outgoing.status));
      response.status(outgoing.status).json({
        ...outgoing.body,
        code:terminal ? "refresh_session_terminal" : "refresh_session_retryable",
        causeCode:outgoing.body?.code || null,
      });
      return;
    }
    response.status(outgoing.status).json(outgoing.body);
  }
};
