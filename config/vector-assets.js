(function attachVectorAssets(root, factory){
  const assets = factory();
  root.NOTHINGSPORTS_VECTOR_ASSETS = assets;
  if (typeof module !== "undefined" && module.exports) module.exports = assets;
})(typeof globalThis !== "undefined" ? globalThis : window, function buildVectorAssets(){
  "use strict";

  const boardBodies = globalThis.NOTHINGSPORTS_ICONOGRAPHY || (typeof require === "function" ? require("./nothingsport-iconography") : {});

  const SPORTICON_SOURCE = "https://github.com/ookamiinc/sporticon";
  const LUCIDE_SOURCE = "https://github.com/lucide-icons/lucide";
  const SIMPLE_ICONS_SOURCE = "https://github.com/simple-icons/simple-icons";
  const SIMPLE_ICONS_DISCLAIMER = "https://github.com/simple-icons/simple-icons/blob/develop/DISCLAIMER.md";
  const rightsMetadataKinds = Object.freeze(["licensed", "user-supplied", "official", "open-use", "fallback"]);

  const sporticon = {
    "sport:motorsport": "motorsports.svg",
    "sport:rugby": "rugby.svg",
    "sport:tennis": "tennis.svg",
    "sport:football": "soccer.svg",
    "sport:cycling": "cycling.svg",
    "sport:golf": "golf.svg",
    "sport:skiing": "ski_and_snowboard.svg",
    "sport:american-football": "american_football.svg",
    "sport:australian-football": "australian_football.svg",
    "sport:basketball": "basketball.svg",
  };

  const lucideBodies = boardBodies;

  const customBodies = boardBodies;

  const simpleIconBodies = {
    "social:instagram": '<path fill="currentColor" stroke="none" d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.264-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.74 0 12s.014 3.668.072 4.948c.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.74 24 12 24s3.668-.014 4.948-.072c4.354-.2 6.782-2.618 6.979-6.98C23.986 15.668 24 15.259 24 12s-.014-3.667-.072-4.947c-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zm0 10.162a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/>',
    "social:x": '<path fill="currentColor" stroke="none" d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>',
    "social:linkedin": '<path fill="currentColor" stroke="none" d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0z"/>',
  };

  const openUse = Object.freeze({
    "sport:motorcycle": Object.freeze({key:"sport:motorcycle",assetClass:"licensed",rightsStatus:"user-supplied",provenance:"user-supplied",library:"Flaticon",author:"Magnific",license:"Flaticon License (attribution required)",source:"https://www.flaticon.com/free-icon/motorbike_1768191",licenseUrl:"https://www.flaticon.com/media/license/license.pdf",path:"assets/identities/motogp/motorcycle.svg",render:"mask"}),
    ...Object.fromEntries(Object.entries(sporticon).map(([key, file]) => [key, Object.freeze({ key, assetClass: "open-use", rightsStatus: "open-use", provenance: "licensed-library", library: "Sporticon", license: "Apache-2.0", source: SPORTICON_SOURCE, path: `assets/icons/sporticon/${file}`, render: "mask" })])),
    ...Object.fromEntries(Object.keys(simpleIconBodies).map(key => [key, Object.freeze({ key, assetClass: "open-use", rightsStatus: "open-use", provenance: "licensed-library", library: "Simple Icons", license: "CC0-1.0", source: SIMPLE_ICONS_SOURCE, disclaimer: SIMPLE_ICONS_DISCLAIMER, trademarkNotice: "Brand marks remain subject to their owners' trademark and usage rules.", render: "inline" })])),
  });

  const officialPermitted = Object.freeze({
    "brand:logo": Object.freeze({ key: "brand:logo", assetClass: "official-permitted", rightsStatus: "official", provenance: "first-party", owner: "nothingsport", path: "assets/brand/web/nothingsport-logo.png", permissionBasis: "first-party brand asset" }),
    "brand:hero": Object.freeze({ key: "brand:hero", assetClass: "official-permitted", rightsStatus: "official", provenance: "first-party", owner: "nothingsport", path: "assets/brand/web/nothingsport-hero-logo.png", permissionBasis: "first-party brand asset" }),
    "brand:icon": Object.freeze({ key: "brand:icon", assetClass: "official-permitted", rightsStatus: "official", provenance: "first-party", owner: "nothingsport", path: "assets/brand/web/nothingsport-app-icon.png", permissionBasis: "first-party brand asset" }),
    "brand:slogan": Object.freeze({ key: "brand:slogan", assetClass: "official-permitted", rightsStatus: "official", provenance: "first-party", owner: "nothingsport", path: "assets/brand/web/nothingsport-logo-slogan.png", permissionBasis: "first-party brand asset" }),
    "brand:app-192": Object.freeze({ key: "brand:app-192", assetClass: "official-permitted", rightsStatus: "official", provenance: "first-party", owner: "nothingsport", path: "icons/nothingsport-app-192.png", permissionBasis: "first-party brand asset" }),
    "brand:app-512": Object.freeze({ key: "brand:app-512", assetClass: "official-permitted", rightsStatus: "official", provenance: "first-party", owner: "nothingsport", path: "icons/nothingsport-app-512.png", permissionBasis: "first-party brand asset" }),
    "brand:app-maskable-512": Object.freeze({ key: "brand:app-maskable-512", assetClass: "official-permitted", rightsStatus: "official", provenance: "first-party", owner: "nothingsport", path: "icons/nothingsport-app-maskable-512.png", permissionBasis: "first-party brand asset" }),
  });

  const custom = Object.freeze(Object.fromEntries(Object.keys({...customBodies,...boardBodies}).map(key => [key, Object.freeze({ key, assetClass: "custom-semantic", rightsStatus: key.startsWith("sport:") ? "fallback" : "official", provenance: "first-party", owner: "nothingsport", render: "inline" })])));

  function escapeAttribute(value){
    return String(value || "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function inlineSvg(body, { label = "", className = "", preferImage = false, viewBox = "0 0 24 24" } = {}){
    if (preferImage){
      const imageBody = String(body || "").replace(/currentColor/g, "#000000");
      const source = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${escapeAttribute(viewBox)}" fill="none" stroke="#000000" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${imageBody}</svg>`;
      const alternative = label ? `alt="${escapeAttribute(label)}"` : 'alt="" aria-hidden="true"';
      return `<img class="vector-glyph vector-image ${escapeAttribute(className)}" src="data:image/svg+xml,${encodeURIComponent(source)}" ${alternative} decoding="sync" draggable="false">`;
    }
    const accessibility = label ? `role="img" aria-label="${escapeAttribute(label)}"` : 'aria-hidden="true"';
    return `<svg class="vector-glyph vector-svg ${escapeAttribute(className)}" viewBox="${escapeAttribute(viewBox)}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" ${accessibility}>${body}</svg>`;
  }

  function glyphMarkup(key, options = {}){
    if (boardBodies[key]) return inlineSvg(boardBodies[key], options);
    const entry = openUse[key] || custom[key];
    if (!entry) return inlineSvg('<circle cx="12" cy="12" r="9"/><path d="M8 12h8"/>', options);
    if (entry.render === "raster"){
      const accessibility = options.label ? `role="img" aria-label="${escapeAttribute(options.label)}"` : 'aria-hidden="true"';
      // Crop transparent source margins in the viewport; retain the supplied PNG unchanged.
      return `<svg class="vector-glyph steak-glyph ${escapeAttribute(options.className || "")}" viewBox="12 59 488 394" preserveAspectRatio="none" ${accessibility}><image class="steak-artwork" href="${escapeAttribute(entry.path)}" width="512" height="512"/></svg>`;
    }
    if (entry.render === "mask"){
      const accessibility = options.label ? `role="img" aria-label="${escapeAttribute(options.label)}"` : 'aria-hidden="true"';
      if (options.preferImage){
        const alternative = options.label ? `alt="${escapeAttribute(options.label)}"` : 'alt="" aria-hidden="true"';
        return `<img class="vector-glyph vector-image ${escapeAttribute(options.className || "")}" src="${escapeAttribute(entry.path)}" ${alternative} decoding="async" draggable="false">`;
      }
      return `<span class="vector-glyph vector-mask ${escapeAttribute(options.className || "")}" style="--glyph-url:url('${escapeAttribute(entry.path)}')" ${accessibility}></span>`;
    }
    return inlineSvg(lucideBodies[key] || simpleIconBodies[key] || customBodies[key], options);
  }

  const editorialKeys = Object.freeze({
    "Top pick": "semantic:must-watch",
    "Must Watch": "semantic:must-watch",
    Rivalry: "semantic:rivalry",
    "Record Chase": "semantic:record-chase",
    "Title Decider": "semantic:title-decider",
    "Upset Watch": "semantic:upset-watch",
  });

  function intensityMarkup(level, options = {}){
    const active = Math.max(1, Math.min(5, Number(level) || 1));
    const bars = Array.from({ length: 5 }, (_, index) => `<rect x="${2 + index * 4.4}" y="${18 - index * 3}" width="2.8" height="${4 + index * 3}" rx="1" ${index < active ? 'fill="currentColor"' : 'fill="none" opacity=".35"'}/>`).join("");
    return inlineSvg(bars, { ...options, label: options.label || `Intensity ${active} out of 5` });
  }

  function stakesMarkup(level, options = {}){
    const levels = ["low", "medium", "high", "critical"];
    const normalised = levels.includes(level) ? level : "medium";
    const active = levels.indexOf(normalised) + 1;
    const diamonds = Array.from({ length: 4 }, (_, index) => `<path d="m${4 + index * 5.3} 7 3 5-3 5-3-5z" ${index < active ? 'fill="currentColor"' : 'fill="none" opacity=".35"'}/>`).join("");
    return inlineSvg(diamonds, { ...options, label: options.label || `${normalised} stakes` });
  }

  function editorialMarkup(label, options = {}){
    return glyphMarkup(editorialKeys[label] || "semantic:must-watch", { ...options, label: options.label || label });
  }

  function broadcastMarkup(state, options = {}){
    const bodies = {
      live: '<circle cx="6" cy="12" r="2" fill="currentColor"/><path d="M11 8a6 6 0 0 1 0 8M15 5a10 10 0 0 1 0 14"/>',
      replay: '<path d="M4 12a8 8 0 1 0 3-6.2L4 8M4 3v5h5"/><path d="m11 9 5 3-5 3z"/>',
      highlights: '<path d="m12 2 2.2 6.3L21 10l-5 4.1.8 6.9-4.8-3.7L7.2 21l.8-6.9L3 10l6.8-1.7z"/>',
      free: '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 7.5-2"/>',
      subscription: '<circle cx="12" cy="12" r="9"/><path d="M15 8.5c-.7-.7-1.8-1-3-1-1.7 0-3 .9-3 2s1 1.8 3 2.5 3 1.4 3 2.5-1.3 2-3 2c-1.2 0-2.4-.4-3-1M12 5v14"/>',
      geo: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
    };
    const aliases = { "free-to-air": "free", "geo-restricted": "geo" };
    const normalised = bodies[aliases[state] || state] ? (aliases[state] || state) : "live";
    return inlineSvg(bodies[normalised], { ...options, label: options.label || `${state || normalised} broadcast` });
  }

  function reminderMarkup(state, options = {}){
    const overlays = {
      off: '<path d="m3 3 18 18"/>',
      on: '<path d="m9 12 2 2 4-4"/>',
      synced: '<path d="M8 14a4 4 0 0 1 6-3M16 10a4 4 0 0 1-6 3"/>',
      missed: '<path d="m9 10 6 6M15 10l-6 6"/>',
    };
    const normalised = overlays[state] ? state : "off";
    return inlineSvg(`${boardBodies["ui:bell"] || lucideBodies["ui:bell"]}${overlays[normalised]}`, { ...options, label: options.label || `Reminder ${normalised}` });
  }

  return Object.freeze({
    schemaVersion: "vector-assets.v1",
    policy: Object.freeze({ protectedMarks: "neutral-fallback-unless-permission-recorded", commercialRecordings: "not-bundled" }),
    rightsMetadataKinds,
    iconography: boardBodies,
    openUse,
    officialPermitted,
    custom,
    glyphMarkup,
    intensityMarkup,
    stakesMarkup,
    editorialMarkup,
    broadcastMarkup,
    reminderMarkup,
    editorialKeys,
  });
});
