(function attachNothingSportsSoundtrack(root, factory){
  const api = factory(root);
  root.NOTHINGSPORTS_SOUNDTRACK = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function buildSoundtrack(root){
  "use strict";

  const track = Object.freeze({
    id: "skyscraper-samba",
    title: "Skyscraper Samba",
    artist: "Scott Buckley",
    src: "/assets/audio/sb_skyscrapersamba_eq_lessdrums.mp3",
    licence: "CC-BY 4.0",
    website: "https://www.scottbuckley.com.au",
  });
  const attribution = "'Skyscraper Samba' by Scott Buckley - released under CC-BY 4.0. www.scottbuckley.com.au";
  let audio = null;

  function audioElement(){
    if (audio) return audio;
    audio = root.document?.getElementById?.("soundtrackAudio") || null;
    if (!audio && typeof root.Audio === "function") audio = new root.Audio(track.src);
    if (!audio) return null;
    audio.src = track.src;
    audio.preload = "metadata";
    audio.loop = true;
    audio.muted = false;
    audio.volume = 1;
    return audio;
  }

  async function start(){
    const player = audioElement();
    if (!player) throw new Error("HTML audio is not supported in this browser");
    player.loop = true;
    player.muted = false;
    player.volume = 1;
    await player.play();
    return track.id;
  }

  function stop(){
    const player = audioElement();
    if (!player) return;
    player.pause();
    try{
      player.currentTime = 0;
    }catch(_error){
      // Some browsers prevent seeking until metadata has loaded.
    }
  }

  function state(){
    const player = audioElement();
    return {
      playing: Boolean(player && !player.paused),
      trackId: track.id,
      volume: player ? player.volume : 1,
    };
  }

  return Object.freeze({ attribution, start, state, stop, track });
});
