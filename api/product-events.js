"use strict";

const {
  SupabaseRequestError,
  authenticatedUser,
  bearerToken,
  publicError,
  supabaseRequest,
} = require("../lib/supabase-server");
const PRODUCT_EVENTS = require("../config/product-events");

const MAX_REQUEST_BYTES = 32 * 1024;

function setPrivateResponseHeaders(response){
  response.setHeader("Cache-Control", "private, no-store, max-age=0");
  response.setHeader("Vary", "Authorization");
}

function requestBody(request){
  if (typeof request.body === "string"){
    try{
      return JSON.parse(request.body);
    }catch(_error){
      throw new PRODUCT_EVENTS.ProductEventValidationError("Request body must be valid JSON.", "invalid_json");
    }
  }
  return request.body;
}

function isUniqueViolation(error){
  return error instanceof SupabaseRequestError
    && error.status === 409
    && String(error.payload?.code || error.payload?.error_code || "") === "23505";
}

async function appendRows(rows, accessToken){
  const insert = body => supabaseRequest("/rest/v1/product_events", {
    method: "POST",
    accessToken,
    headers: { Prefer: "return=minimal" },
    body,
  });
  try{
    await insert(rows);
    return;
  }catch(error){
    if (!isUniqueViolation(error)) throw error;
  }

  for (const row of rows){
    try{
      await insert([row]);
    }catch(error){
      if (!isUniqueViolation(error)) throw error;
    }
  }
}

module.exports = async function productEventsHandler(request, response){
  setPrivateResponseHeaders(response);
  if (request.method !== "POST"){
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Method not allowed.", code: "method_not_allowed" });
  }

  try{
    const accessToken = bearerToken(request);
    const user = await authenticatedUser(accessToken);
    const body = requestBody(request);
    if (Buffer.byteLength(JSON.stringify(body ?? null), "utf8") > MAX_REQUEST_BYTES){
      return response.status(413).json({ error: "Product event request is too large.", code: "request_too_large" });
    }
    const events = PRODUCT_EVENTS.normalizeBatch(body);
    const rows = PRODUCT_EVENTS.rowsForUser(events, user.id);
    await appendRows(rows, accessToken);
    return response.status(202).json({
      schemaVersion: PRODUCT_EVENTS.SCHEMA_VERSION,
      accepted: events.length,
      deduplicated: true,
    });
  }catch(error){
    if (error instanceof PRODUCT_EVENTS.ProductEventValidationError){
      return response.status(error.status).json({ error: error.message, code: error.code });
    }
    const outgoing = publicError(error);
    return response.status(outgoing.status).json(outgoing.body);
  }
};
