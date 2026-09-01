(function(root, factory){
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.NOTHINGSPORTS_OPTIMISTIC_MUTATION = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function buildOptimisticMutation(){
  "use strict";

  function isLostResponse(error){
    const code = String(error?.code || error?.name || "").toLowerCase();
    const message = String(error?.message || "").toLowerCase();
    return code === "aborterror"
      || code === "timeout"
      || code === "network_error"
      || /timed? out|network|failed to fetch|load failed|connection/.test(message);
  }

  async function run({ capture, apply, request, commit, rollback, reconcile } = {}){
    if (typeof request !== "function") throw new TypeError("Optimistic mutations require a request function.");
    const prior = typeof capture === "function" ? capture() : undefined;
    if (typeof apply === "function") await apply(prior);
    try{
      const result = await request(prior);
      if (typeof commit === "function") await commit(result, prior);
      return { ok:true, result, prior, reconciled:false };
    }catch(error){
      if (isLostResponse(error) && typeof reconcile === "function"){
        try{
          const resolution = await reconcile(error, prior);
          if (resolution?.confirmed){
            if (typeof commit === "function") await commit(resolution.result, prior);
            return { ok:true, result:resolution.result, prior, reconciled:true };
          }
        }catch(_reconcileError){ /* Exact rollback below remains the safe fallback. */ }
      }
      if (typeof rollback === "function") await rollback(prior, error);
      return { ok:false, error, prior, reconciled:false };
    }
  }

  return Object.freeze({ isLostResponse, run });
});
