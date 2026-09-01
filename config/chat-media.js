(function(root, factory){
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.NOTHINGSPORTS_CHAT_MEDIA = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function(){
  "use strict";

  const MAX_STATIC_IMAGE_EDGE = 1080;
  const STATIC_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

  function cleanType(value){ return String(value || "").toLowerCase().split(";")[0].trim(); }

  function shouldCompress(contentType){
    return STATIC_IMAGE_TYPES.has(cleanType(contentType));
  }

  function targetDimensions(width, height, maximum = MAX_STATIC_IMAGE_EDGE){
    const sourceWidth = Math.max(1, Number(width) || 1);
    const sourceHeight = Math.max(1, Number(height) || 1);
    const scale = Math.min(1, Math.max(1, Number(maximum) || MAX_STATIC_IMAGE_EDGE) / Math.max(sourceWidth, sourceHeight));
    return {
      width:Math.max(1, Math.round(sourceWidth * scale)),
      height:Math.max(1, Math.round(sourceHeight * scale)),
    };
  }

  function outputPlan(contentType, { hasAlpha = false } = {}){
    const type = cleanType(contentType);
    if (!shouldCompress(type)) return { contentType:type, quality:null, extension:"", preserveAlpha:false };
    if (type === "image/png") return { contentType:"image/png", quality:null, extension:".png", preserveAlpha:true };
    if (hasAlpha || type === "image/webp") return { contentType:"image/webp", quality:.88, extension:".webp", preserveAlpha:true };
    return { contentType:"image/jpeg", quality:.82, extension:".jpg", preserveAlpha:false };
  }

  return Object.freeze({ MAX_STATIC_IMAGE_EDGE, shouldCompress, targetDimensions, outputPlan });
});
