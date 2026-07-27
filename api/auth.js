"use strict";

const {
  authenticatedUser,
  bearerToken,
  publicError,
  safeRedirectUrl,
  supabaseConfig,
  supabaseRequest,
} = require("../lib/supabase-server");

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
    if (body.action === "magic-link"){
      const email = validEmail(body.email);
      if (!email){
        response.status(400).json({ error: "Enter a valid email address.", code: "invalid_email" });
        return;
      }
      const redirectTo = safeRedirectUrl(request, body.redirectTo);
      await supabaseRequest(`/auth/v1/otp?redirect_to=${encodeURIComponent(redirectTo)}`, {
        method: "POST",
        body: {
          email,
          create_user: true,
        },
      });
      response.status(200).json({
        sent: true,
        message: "Check your email for your nothingSports sign-in link.",
      });
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
