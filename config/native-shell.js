(function(root, factory){
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.NOTHINGSPORTS_NATIVE_SHELL = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function(){
  "use strict";

  const KEYBOARD_THRESHOLD_PX = 96;
  const RESAMPLE_DELAYS_MS = Object.freeze([0, 80, 240]);
  const pixel = value => Math.max(0, Math.round(Number(value) || 0));

  function deriveChatViewport({
    visualHeight,
    visualWidth,
    offsetTop = 0,
    offsetLeft = 0,
    layoutHeight,
    layoutWidth,
    baselineHeight,
  } = {}){
    const height = Math.max(1, pixel(visualHeight) || pixel(layoutHeight) || 1);
    const width = Math.max(1, pixel(visualWidth) || pixel(layoutWidth) || 1);
    const top = pixel(offsetTop);
    const left = pixel(offsetLeft);
    const baseline = Math.max(height + top, pixel(baselineHeight) || pixel(layoutHeight) || height);
    const coveredHeight = Math.max(0, baseline - top - height);
    return Object.freeze({
      height,
      width,
      offsetTop:top,
      offsetLeft:left,
      coveredHeight,
      keyboardOpen:coveredHeight >= KEYBOARD_THRESHOLD_PX,
    });
  }

  return Object.freeze({ KEYBOARD_THRESHOLD_PX, RESAMPLE_DELAYS_MS, deriveChatViewport });
});
