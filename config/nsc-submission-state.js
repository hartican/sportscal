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
  // Read recovery shares one timer. It never retries a submission or changes a
  // saved vote; the browser's existing summary loader owns every actual read.
  function createReadRecovery({now=Date.now,setTimer=setTimeout,clearTimer=clearTimeout,
    active=()=>true,eligible=()=>[],pending=()=>false,retry=()=>{}}={}){
    const waits=[30_000,60_000,120_000],states=new Map();
    let timer=null;
    function sync(){
      clearTimer(timer);timer=null;
      if(!active())return;
      const ids=new Set(eligible()),waiting=[...states].filter(([id,state])=>ids.has(id)&&state.dueAt!==null&&!pending(id));
      if(!waiting.length)return;
      timer=setTimer(()=>{
        timer=null;if(!active())return;
        const mounted=new Set(eligible()),due=[...states].filter(([id,state])=>mounted.has(id)&&state.dueAt!==null&&state.dueAt<=now()&&!pending(id));
        const batch=due.slice(0,50);
        batch.forEach(([,state])=>{state.attempts++;state.dueAt=null;});
        // A resume cannot drain many overdue batches in one foreground burst.
        due.slice(50).forEach(([,state])=>{state.dueAt=now()+waits[0];});
        if(batch.length)retry(batch.map(([id])=>id));
        sync();
      },Math.max(0,Math.min(...waiting.map(([,state])=>state.dueAt))-now()));
    }
    return {
      sync,
      failure(id){
        const state=states.get(id)||{attempts:0,dueAt:null};
        state.dueAt=state.attempts<waits.length?now()+waits[state.attempts]:null;
        states.set(id,state);sync();
      },
      success(id){states.delete(id);sync();},
      manual(id){
        if(!active()||pending(id))return false;
        states.set(id,{attempts:0,dueAt:null});retry([id]);sync();return true;
      },
      state(id){
        const state=states.get(id);
        return {pending:pending(id),attempts:state?.attempts||0,nextRetryAt:state?.dueAt??null,
          exhausted:Boolean(state&&state.attempts===waits.length&&state.dueAt===null&&!pending(id))};
      },
      reset(){clearTimer(timer);timer=null;states.clear();},
    };
  }
  return { createStore, mergeCurrentUser, createReadRecovery };
});
