(function attachNothingSportsLoadingProgress(root, factory){
  const api = factory();
  root.NOTHINGSPORTS_LOADING_PROGRESS = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function buildNothingSportsLoadingProgress(){
  "use strict";

  const STARTUP_MILESTONES = Object.freeze({
    runtime: 10,
    "local-state": 20,
    "feed-page": 45,
    "first-viewport": 15,
    "account-state": 10,
  });
  const STARTUP_MIN_MS = 3000;
  const STARTUP_MAX_MS = 6000;
  const FUNNEL_DURATION_MS = 1000;
  const INDICATOR_DELAY_MS = 150;
  const INDICATOR_MIN_VISIBLE_MS = 300;
  const LOADING_AUDIO_CONSENT_KEY = "ns_loading_audio_consent_v1";
  const LOADING_AUDIO_CUES = Object.freeze({
    fill: Object.freeze({ src:null, loop:true, description:"Looping tennis rally, crowd ambience and player sounds" }),
    funnel: Object.freeze({ src:null, loop:false, description:"Golf ball sinks, followed by immediate gallery applause" }),
  });

  function clamp(value, minimum = 0, maximum = 1){
    return Math.max(minimum, Math.min(maximum, Number(value) || 0));
  }

  function createController({ milestones = STARTUP_MILESTONES } = {}){
    const weights = Object.fromEntries(Object.entries(milestones)
      .filter(([, weight]) => Number(weight) > 0)
      .map(([id, weight]) => [String(id), Number(weight)]));
    const totalWeight = Object.values(weights).reduce((total, weight) => total + weight, 0) || 1;
    const progress = Object.fromEntries(Object.keys(weights).map(id => [id, 0]));
    const listeners = new Set();
    let reportedPercent = 0;
    let phase = "loading";
    let error = "";

    function snapshot(){
      const complete = Object.keys(progress).every(id => progress[id] >= 1);
      const weighted = Object.entries(progress)
        .reduce((total, [id, value]) => total + weights[id] * value, 0) / totalWeight * 100;
      const calculated = complete ? 100 : Math.min(95, Math.floor(weighted));
      reportedPercent = Math.max(reportedPercent, calculated);
      if (complete && phase !== "failed") phase = "complete";
      return Object.freeze({
        phase,
        percent: reportedPercent,
        error,
        tasks: Object.freeze({ ...progress }),
      });
    }

    function notify(){
      const state = snapshot();
      listeners.forEach(listener => listener(state));
      return state;
    }

    function set(id, value){
      const key = String(id);
      if (!Object.prototype.hasOwnProperty.call(progress, key)) return snapshot();
      progress[key] = Math.max(progress[key], clamp(value));
      if (phase === "failed"){
        phase = "loading";
        error = "";
      }
      return notify();
    }

    function complete(id){
      return set(id, 1);
    }

    function fail(id, message){
      const key = String(id);
      if (Object.prototype.hasOwnProperty.call(progress, key)) progress[key] = Math.max(progress[key], 0);
      phase = "failed";
      error = String(message || "Loading failed. Try again.");
      return notify();
    }

    function subscribe(listener, { immediate = true } = {}){
      if (typeof listener !== "function") return () => {};
      listeners.add(listener);
      if (immediate) listener(snapshot());
      return () => listeners.delete(listener);
    }

    return Object.freeze({ snapshot, set, complete, fail, subscribe });
  }

  function startupTiming({ readyAfterMs = 0, reducedMotion = false } = {}){
    if (reducedMotion) return { funnelStartAfterMs: 0, funnelDurationMs: 0 };
    return {
      funnelStartAfterMs: Math.min(STARTUP_MAX_MS, Math.max(STARTUP_MIN_MS, Number(readyAfterMs) || 0)),
      funnelDurationMs: FUNNEL_DURATION_MS,
    };
  }

  function escapeHtml(value){
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function ringMarkup(state = {}, { label = "Loading", compact = false } = {}){
    const percent = Math.max(0, Math.min(100, Math.round(Number(state.percent) || 0)));
    const offset = (113.1 * (1 - percent / 100)).toFixed(2);
    const failed = state.phase === "failed";
    const accessibleLabel = failed && state.error ? `${label}: ${state.error}` : `${label}: ${percent}%`;
    return `<span class="loading-progress-ring${compact ? " is-compact" : ""}${failed ? " is-failed" : ""}" role="progressbar" aria-label="${escapeHtml(accessibleLabel)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percent}" style="--loading-progress:${percent};--loading-progress-offset:${offset}"><svg viewBox="0 0 44 44" aria-hidden="true"><circle class="loading-progress-track" cx="22" cy="22" r="18"></circle><circle class="loading-progress-value" cx="22" cy="22" r="18"></circle></svg><strong>${failed ? "!" : percent}</strong>${failed ? "" : "<span>%</span>"}</span>`;
  }

  function createAudioCuePlayer({
    fillAudio = null,
    funnelAudio = null,
    storage = globalThis.localStorage,
    cues = LOADING_AUDIO_CUES,
  } = {}){
    let consent = false;
    try{ consent = storage?.getItem?.(LOADING_AUDIO_CONSENT_KEY) === "enabled"; }catch(_error){ consent = false; }

    function available(){
      return Boolean(cues?.fill?.src && cues?.funnel?.src && fillAudio && funnelAudio);
    }

    function prepare(){
      if (!available()) return false;
      if (fillAudio.src !== cues.fill.src) fillAudio.src = cues.fill.src;
      if (funnelAudio.src !== cues.funnel.src) funnelAudio.src = cues.funnel.src;
      fillAudio.loop = cues.fill.loop !== false;
      funnelAudio.loop = Boolean(cues.funnel.loop);
      return true;
    }

    async function startFill(){
      if (!consent || !prepare()) return false;
      try{
        await fillAudio.play();
        return true;
      }catch(_error){
        return false;
      }
    }

    async function enable(){
      if (!available()) return false;
      consent = true;
      try{ storage?.setItem?.(LOADING_AUDIO_CONSENT_KEY, "enabled"); }catch(_error){ /* Consent remains active for this launch. */ }
      return startFill();
    }

    async function playFunnel(){
      if (!consent || !prepare()) return false;
      fillAudio.pause();
      fillAudio.currentTime = 0;
      funnelAudio.currentTime = 0;
      try{
        await funnelAudio.play();
        return true;
      }catch(_error){
        return false;
      }
    }

    function stop(){
      for (const audio of [fillAudio, funnelAudio]){
        if (!audio) continue;
        audio.pause();
        try{ audio.currentTime = 0; }catch(_error){ /* Some browsers block seeking before metadata. */ }
      }
    }

    return Object.freeze({ available, enabled:() => consent, enable, startFill, playFunnel, stop });
  }

  return Object.freeze({
    STARTUP_MILESTONES,
    STARTUP_MIN_MS,
    STARTUP_MAX_MS,
    FUNNEL_DURATION_MS,
    INDICATOR_DELAY_MS,
    INDICATOR_MIN_VISIBLE_MS,
    LOADING_AUDIO_CONSENT_KEY,
    LOADING_AUDIO_CUES,
    createController,
    createAudioCuePlayer,
    startupTiming,
    ringMarkup,
  });
});
