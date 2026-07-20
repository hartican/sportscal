(function attachNothingSportsSoundtrack(root, factory){
  const api = factory(root);
  root.NOTHINGSPORTS_SOUNDTRACK = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function buildSoundtrack(root){
  "use strict";

  const styles = Object.freeze([
    Object.freeze({ id: "elevator", label: "Elevator music", bpm: 82, waveform: "sine", notes: [261.63, 329.63, 392.00, 493.88] }),
    Object.freeze({ id: "epic", label: "Epic orchestral", bpm: 68, waveform: "triangle", notes: [130.81, 196.00, 261.63, 329.63] }),
    Object.freeze({ id: "metal", label: "Heavy metal", bpm: 132, waveform: "sawtooth", notes: [82.41, 98.00, 110.00, 123.47] }),
  ]);
  const attribution = "Original procedural audio generated in-browser by nothingSports; no recorded or commercial music is bundled.";
  let context = null;
  let master = null;
  let loopTimer = null;
  let activeStyle = null;
  let step = 0;

  function styleFor(id){
    return styles.find(style => style.id === id) || styles[0];
  }

  function playTone(style){
    if (!context || !master) return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = style.waveform;
    oscillator.frequency.value = style.notes[step % style.notes.length];
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(style.id === "metal" ? 0.045 : 0.025, context.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + (style.id === "epic" ? 1.2 : 0.55));
    oscillator.connect(gain);
    gain.connect(master);
    oscillator.start();
    oscillator.stop(context.currentTime + (style.id === "epic" ? 1.25 : 0.6));
    step += 1;
  }

  async function start(styleId){
    stop();
    const AudioContextClass = root.AudioContext || root.webkitAudioContext;
    if (!AudioContextClass) throw new Error("Web Audio is not supported in this browser");
    activeStyle = styleFor(styleId);
    context = new AudioContextClass();
    master = context.createGain();
    master.gain.value = 0.24;
    master.connect(context.destination);
    await context.resume();
    playTone(activeStyle);
    loopTimer = root.setInterval(() => playTone(activeStyle), Math.round(60000 / activeStyle.bpm));
    return activeStyle.id;
  }

  function stop(){
    if (loopTimer !== null) root.clearInterval(loopTimer);
    loopTimer = null;
    if (context && typeof context.close === "function") context.close().catch(() => {});
    context = null;
    master = null;
    activeStyle = null;
    step = 0;
  }

  function state(){
    return { playing: Boolean(context), styleId: activeStyle?.id || null };
  }

  return Object.freeze({ styles, attribution, styleFor, start, stop, state });
});
