(function(root, factory){
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.NOTHINGSPORTS_NSC_SUBMISSION_STATE = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function(){
  "use strict";
  function createStore({ read = () => null, write = () => {} } = {}){
    const states = new Map();
    function get(key){
      if (!states.has(key)){
        let saved;
        try { saved = JSON.parse(read(key) || "null"); } catch(_error) { saved = null; }
        states.set(key, saved ? { ...saved, status:saved.status === "pending" ? "uncertain" : saved.status } : {status:"draft",draft:null});
      }
      return states.get(key);
    }
    function put(key, state){
      states.set(key,state);
      try { write(key,JSON.stringify(state)); } catch(_error) { /* Session memory still seals rapid retries. */ }
      return state;
    }
    return {
      get,
      draft(key,draft){ const prior=get(key); if (prior.status === "draft") put(key,{...prior,draft}); },
      begin(key,command){
        const prior=get(key);
        if (prior.status !== "draft") return false;
        put(key,{...prior,status:"pending",command,draft:{rating:command.rating,tags:command.tags || []}});
        return true;
      },
      confirm(key,receipt){
        const prior=get(key);
        return put(key,{...prior,status:"confirmed",receipt:prior.receipt || receipt});
      },
      uncertain(key){ const prior=get(key); if (!prior.receipt) put(key,{...prior,status:"uncertain"}); },
      release(key){ const prior=get(key); if (!prior.receipt) put(key,{...prior,status:"draft"}); },
    };
  }
  function mergeCurrentUser(previous, incoming){
    if (incoming === null) return null;
    return {...previous,...incoming,submissions:{...incoming?.submissions,...previous?.submissions}};
  }
  return { createStore, mergeCurrentUser };
});
