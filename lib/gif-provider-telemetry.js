"use strict";

const ALLOWED_REASONS = new Set([
  "missing_configuration",
  "provider_rejected_configuration",
  "upstream_response",
  "invalid_response",
  "timeout",
  "network_error",
]);

function logGifProviderFailure(reason, details = {}, write = console.error){
  const safeReason = ALLOWED_REASONS.has(reason) ? reason : "upstream_response";
  const status = Number(details.status);
  write(JSON.stringify({
    level:"error",
    event:"chat_gif_provider_failure",
    provider:"giphy",
    reason:safeReason,
    ...(Number.isInteger(status) && status >= 100 && status <= 599 ? { status } : {}),
  }));
}

module.exports = Object.freeze({ logGifProviderFailure });
