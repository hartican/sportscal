(function(root, factory){
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.NOTHINGSPORTS_PREFERENCE_RESET_UI = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function buildPreferenceResetUi(){
  "use strict";

  const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

  async function reset(api){
    const defaults = api.defaults();
    if (api.signedIn()){
      const result = await api.serverSync.resetPreferences(defaults);
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
    const active = api.signedIn() ? api.recovery() : api.localRecovery();
    if (!active) throw new Error("The seven-day recovery window has expired.");
    if (api.signedIn()){
      const result = await api.serverSync.undoPreferencesReset(active.resetId);
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
    const stack = body.querySelector(".preference-stack") || body;
    const active = api.signedIn() ? api.setRecovery(api.recovery()) : api.setRecovery(api.localRecovery());
    const section = document.createElement("section");
    section.className = "filter-panel preference-data-recovery";
    section.innerHTML = `<h3>Data & recovery</h3>
      <p class="preference-help">Reset follows, Feed tuning, providers, location, notification and display preferences without deleting your account or durable participation.</p>
      ${active ? `<p class="preference-help">A pre-reset snapshot is available until ${new Date(active.expiresAt).toLocaleString("en-AU", { day:"numeric", month:"short", hour:"numeric", minute:"2-digit" })}.</p><button class="btn ghost" type="button" data-reset-action="undo">Undo reset</button>` : ""}
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

  return Object.freeze({ mount, reset, undo });
});
