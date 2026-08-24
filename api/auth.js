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
    createdAt: user.created_at || null,
  };
}

module.exports = async function authHandler(request, response){
  setPrivateResponseHeaders(response);
  const config = supabaseConfig();

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
    const outgoing = publicError(error);
    response.status(outgoing.status).json(outgoing.body);
  }
};
