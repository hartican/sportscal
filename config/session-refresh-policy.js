(function(root, factory){
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.NOTHINGSPORTS_SESSION_REFRESH_POLICY = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function(){
  "use strict";

  const TERMINAL_CODES = new Set([
    "refresh_session_terminal",
    "refresh_token_not_found",
    "refresh_token_already_used",
    "refresh_token_revoked",
    "invalid_refresh_token",
  ]);

  function classify(error){
    const status = Number(error?.status || 0);
    const code = String(error?.code || "").toLowerCase();
    if (TERMINAL_CODES.has(code)) return "terminal";
    if (!status || status === 408 || status === 425 || status === 429 || status >= 500) return "retryable";
    return status === 400 || status === 401 || status === 403 ? "terminal" : "retryable";
  }

  function isTerminal(error){ return classify(error) === "terminal"; }

  return Object.freeze({ TERMINAL_CODES, classify, isTerminal });
});
