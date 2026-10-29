(function(root, factory){
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.NOTHINGSPORTS_PREFERENCE_RESET_UI = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function buildPreferenceResetUi(){
  "use strict";

  const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
  const localRecoveryViews = new WeakMap();
  function clearLocalRecovery(body){
    const prior=localRecoveryViews.get(body);
    if(prior){prior.invalid=true;prior.section=null;localRecoveryViews.delete(body);}
  }
  function localRecoveryView(body,api){
    const scope=api.captureLocalRecoveryScope?.();
    const valid=scope&&typeof scope.accountId==='string'&&scope.accountId&&typeof scope.profileId==='string'&&scope.profileId
      &&Number.isSafeInteger(scope.sessionGeneration)&&scope.sessionGeneration>=0&&scope.modal&&typeof scope.modal==='object';
    let state=localRecoveryViews.get(body);
    if(!valid||!state||!['accountId','profileId','sessionGeneration','modal'].every(key=>state.scope[key]===scope[key])){
      clearLocalRecovery(body);
      state={scope:valid?scope:null,expanded:false,busy:false,status:'',section:null,invalid:!valid};
      if(valid)localRecoveryViews.set(body,state);
    }
    return state;
  }
  function recoveryViewCurrent(body,state){
    try{return !state.invalid&&localRecoveryViews.get(body)===state&&Boolean(state.scope?.current());}catch(_error){return false;}
  }
  function paintLocalRecovery(state){
    const section=state.section;if(!section||section.isConnected===false)return;
    const warning=section.querySelector('[data-local-recovery-warning]'),confirm=section.querySelector('[data-local-recovery-confirm]'),open=section.querySelector('[data-local-recovery-open]'),status=section.querySelector('[data-local-recovery-status]');
    if(warning)warning.hidden=!state.expanded;if(confirm)confirm.disabled=state.busy;if(open)open.disabled=state.busy;if(status)status.textContent=state.status;
  }

  function scopedApi(api){
    return { ...api, accountScope:api.accountScope || api.captureScope?.() };
  }

  function requireCurrent(api, result){
    if (!api.accountScope) return;
    if (!api.accountScope.current() || (result && !api.accountScope.verify?.(result))){
      throw new Error("Your account changed. Reopen settings to try again.");
    }
  }

  async function reset(api){
    api = scopedApi(api);
    requireCurrent(api);
    const defaults = api.defaults();
    if (api.signedIn()){
      const result = await api.serverSync.resetPreferences(defaults, { accountId:api.accountScope?.accountId || "" });
      requireCurrent(api, result);
      if (!result?.state) throw new Error("The server did not return the reset profile.");
      api.acceptServerResult(result);
    } else {
      const createdAt = new Date();
      const recovery = {
        resetId:crypto.randomUUID?.() || `local-${createdAt.getTime()}`,
        createdAt:createdAt.toISOString(),
        expiresAt:new Date(createdAt.getTime() + WEEK_MS).toISOString(),
        preferences:api.currentPreferences(),
      };
      if (!api.writeLocalRecovery(recovery)) throw new Error("This device could not store the recovery snapshot.");
      api.setRecovery(recovery);
      api.savePreferences(defaults);
    }
    api.afterApply("Preferences reset. Undo is available for seven days.");
  }

  async function undo(api){
    api = scopedApi(api);
    requireCurrent(api);
    const active = api.signedIn() ? api.recovery() : api.localRecovery();
    if (!active) throw new Error("The seven-day recovery window has expired.");
    if (api.signedIn()){
      const result = await api.serverSync.undoPreferencesReset(active.resetId, { accountId:api.accountScope?.accountId || "" });
      requireCurrent(api, result);
      if (!result?.state) throw new Error("The server did not return the restored profile.");
      api.acceptServerResult(result);
    } else {
      api.savePreferences(active.preferences);
      api.removeLocalRecovery();
      api.setRecovery(null);
    }
    api.afterApply("Your pre-reset preferences are restored.");
  }

  function mount(body, api){
    api = scopedApi(api);
    const stack = body.querySelector(".preference-stack") || body;
    const active = api.signedIn() ? api.setRecovery(api.recovery()) : api.setRecovery(api.localRecovery());
    const section = document.createElement("section");
    section.className = "filter-panel preference-data-recovery";
    section.innerHTML = `<h3>Data & recovery</h3>
      <p class="preference-help">Reset follows, Feed tuning, providers, location, notification and display preferences without deleting your account or durable participation.</p>
      ${active ? `<p class="preference-help">A pre-reset snapshot is available until ${new Date(active.expiresAt).toLocaleString("en-AU", { day:"numeric", month:"short", hour:"numeric", minute:"2-digit" })}.</p><button class="btn ghost" type="button" data-reset-action="undo">Undo reset</button>` : ""}
      ${api.signedIn() ? `<button class="btn ghost" type="button" data-local-recovery-open>Use saved account preferences on this device</button>
      <div data-local-recovery-warning hidden><p class="preference-help">This discards unsynced follows and preferences on this device and replaces them with your saved account preferences. You may need to follow items again. Your account, saved server data, ratings, archived cards and individual fixture actions are kept.</p>
      <button class="btn ghost" type="button" data-local-recovery-confirm>Discard unsynced preferences and use saved copy</button></div>
      <p class="preference-help" data-local-recovery-status role="status" aria-live="polite"></p>` : ""}
      <button class="btn ghost" type="button" data-reset-action="open">Reset all preferences…</button>
      <div data-reset-warning="one" hidden>
        <p class="preference-help"><strong>Warning 1 of 2.</strong> This resets follows, Feed tuning, providers, location, notification and display preferences. Your account, chats, media, NSC history, ratings, saved or archived cards and individual reminders remain.</p>
        <button class="btn ghost" type="button" data-reset-action="continue">I understand — continue</button>
      </div>
      <div data-reset-warning="two" hidden>
        <label class="field-label">Warning 2 of 2 · type RESET to confirm
          <input data-reset-confirm autocomplete="off" autocapitalize="characters" spellcheck="false">
        </label>
        <button class="btn ghost" type="button" data-reset-action="confirm" disabled>Reset preferences</button>
        <p class="preference-help" data-reset-status role="status" aria-live="polite"></p>
      </div>`;
    stack.appendChild(section);
    const localView=localRecoveryView(body,api);localView.section=section;paintLocalRecovery(localView);
    section.querySelector('[data-local-recovery-open]')?.addEventListener('click',()=>{
      if(localView.section!==section||localView.busy||!recoveryViewCurrent(body,localView))return;
      localView.expanded=true;paintLocalRecovery(localView);
    });
    section.querySelector('[data-local-recovery-confirm]')?.addEventListener('click',async()=>{
      if(localView.section!==section||!localView.expanded||localView.busy||!recoveryViewCurrent(body,localView))return;
      try{
        requireCurrent(api);localView.busy=true;localView.status='Loading your saved account preferences…';paintLocalRecovery(localView);
        await api.useSavedAccountPreferences({current:()=>recoveryViewCurrent(body,localView)});
        if(!recoveryViewCurrent(body,localView))return;
        localView.status='Saved account preferences loaded on this device. Use Sync now to check.';api.afterLocalRecovery();
      }catch(error){
        if(recoveryViewCurrent(body,localView))localView.status=error.code==='local_recovery_storage_uncertain'?'This device could not verify its local save. Keep this app open; sync is paused.':'Recovery could not be completed. No account data was reset. Reopen Account & sync to try again.';
      }finally{localView.busy=false;if(recoveryViewCurrent(body,localView))paintLocalRecovery(localView);}
    });
    section.querySelector('[data-reset-action="undo"]')?.addEventListener("click", async event => {
      event.currentTarget.disabled = true;
      try{ await undo(api); }
      catch(error){ event.currentTarget.disabled = false; api.showToast(error.message || "Preferences could not be restored."); }
    });
    section.querySelector('[data-reset-action="open"]').addEventListener("click", event => {
      event.currentTarget.hidden = true;
      section.querySelector('[data-reset-warning="one"]').hidden = false;
    });
    section.querySelector('[data-reset-action="continue"]').addEventListener("click", () => {
      section.querySelector('[data-reset-warning="one"]').hidden = true;
      section.querySelector('[data-reset-warning="two"]').hidden = false;
      section.querySelector("[data-reset-confirm]").focus();
    });
    const input = section.querySelector("[data-reset-confirm]");
    const confirm = section.querySelector('[data-reset-action="confirm"]');
    input.addEventListener("input", () => { confirm.disabled = input.value.trim() !== "RESET"; });
    confirm.addEventListener("click", async () => {
      if (input.value.trim() !== "RESET") return;
      confirm.disabled = true;
      section.querySelector("[data-reset-status]").textContent = "Resetting preferences…";
      try{ await reset(api); }
      catch(error){ confirm.disabled = false; section.querySelector("[data-reset-status]").textContent = error.message || "Preferences could not be reset."; }
    });
    return section;
  }

  return Object.freeze({ mount, reset, undo, clearLocalRecovery });
});
