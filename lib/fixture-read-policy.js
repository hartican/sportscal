'use strict';
// Trusted application policies only. No request, preference, header or numeric
// caller override can select a deadline. Reminder retries own per-attempt bounds.
const GLOBAL=Object.freeze({name:'global-total',deadlineMs:6000,total:true});
const INTERACTIVE=Object.freeze({name:'interactive-total',deadlineMs:5000,total:true});
const SCOPED=Object.freeze({name:'scoped-attempt',deadlineMs:3000,total:false});
const REMINDER=Object.freeze({name:'reminder-attempt',deadlineMs:3000,total:false});
function select({scope='global',selected=false,interactive=false,policy}={}){
 if(policy!==undefined&&policy!==REMINDER)throw Error('Invalid trusted fixture read policy');
 if(policy===REMINDER){if(scope!=='global'||selected)throw Error('Invalid reminder read scope');return REMINDER;}
 if(selected)return SCOPED;
 if(interactive&&['match-centre','participants'].includes(scope))return INTERACTIVE;
 return scope==='global'?GLOBAL:SCOPED;
}
function deadlineError(){return Object.assign(Error('Fixture read deadline exceeded'),{status:504,payload:{code:'supabase_timeout'}});}
function expired(policy,began,timer,signal){return policy.total&&(signal?.aborted||timer()-began>=policy.deadlineMs);}
function check(policy,began,timer,signal){if(expired(policy,began,timer,signal))throw deadlineError();}
function start(policy,timer=()=>performance.now()){
 const began=timer(),controller=policy.total?new AbortController():null;
 const timeout=controller?setTimeout(()=>controller.abort(deadlineError()),policy.deadlineMs):null;
 const checkBudget=()=>check(policy,began,timer,controller?.signal);
 return {
  check:checkBudget,
  options(){if(!controller)return {timeoutMs:policy.deadlineMs};checkBudget();return {timeoutMs:Math.max(1,Math.ceil(policy.deadlineMs-(timer()-began))),signal:controller.signal};},
  failure(error){return expired(policy,began,timer,controller?.signal)?deadlineError():error;},
  finish(){if(timeout)clearTimeout(timeout);controller?.abort();},
 };
}
module.exports={select,start,check,deadlineError,REMINDER};
