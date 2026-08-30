(function attachVectorAssets(root, factory){
  const assets = factory();
  root.NOTHINGSPORTS_VECTOR_ASSETS = assets;
  if (typeof module !== "undefined" && module.exports) module.exports = assets;
})(typeof globalThis !== "undefined" ? globalThis : window, function buildVectorAssets(){
  "use strict";

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

  const lucideBodies = {
    "ui:settings": '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.09a2 2 0 0 1 1 1.74v.5a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.09a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
    "ui:download": '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>',
    "ui:share": '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5"/><path d="M12 3v12"/>',
    "ui:calendar": '<path d="M8 2v4M16 2v4M3 10h18"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01"/>',
    "ui:ticket": '<path d="M2 9a3 3 0 0 0 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 0 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><path d="M13 5v2M13 17v2M13 11v2"/>',
    "ui:clock": '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
    "ui:radio": '<path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9M7.8 16.2a6 6 0 0 1 0-8.5M19.1 4.9c3.9 3.9 3.9 10.3 0 14.2M16.2 7.8a6 6 0 0 1 0 8.5"/><circle cx="12" cy="12" r="2"/>',
    "ui:bell": '<path d="M10.3 21a2 2 0 0 0 3.4 0M18 8A6 6 0 0 0 6 8c0 7-3 7-3 9h18c0-2-3-2-3-9"/>',
    "ui:sun": '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
    "ui:refresh": '<path d="M20 11a8.1 8.1 0 0 0-15.5-2M4 4v5h5M4 13a8.1 8.1 0 0 0 15.5 2M20 20v-5h-5"/>',
    "ui:jump": '<path d="m7 15 5 5 5-5M7 9l5-5 5 5"/>',
    "ui:info": '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
    "ui:archive": '<rect width="20" height="5" x="2" y="3" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8M10 12h4"/>',
    "ui:watch": '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>',
    "ui:filter": '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
    "ui:palette": '<circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2a10 10 0 0 0 0 20c1.1 0 2-.9 2-2 0-.5-.2-.9-.5-1.3-.3-.4-.5-.8-.5-1.2a2 2 0 0 1 2-2h2.1a4.9 4.9 0 0 0 4.9-4.9C22 5.9 17.5 2 12 2z"/>',
    "ui:music": '<path d="M9 18V5l12-2v13M9 9l12-2"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
    "ui:tv": '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="m8 2 4 3 4-3M8 22h8"/><path d="m10 9 5 3-5 3z"/>',
    "ui:message": '<path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/>',
    "ui:map-pin": '<path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
    "ui:chevron-right": '<path d="m9 18 6-6-6-6"/>',
    "ui:plus": '<path d="M5 12h14M12 5v14"/>',
    "ui:minus": '<path d="M5 12h14"/>',
  };

  const customBodies = {
    "sport:cricket": '<path d="m7 3 4 4-5 5-4-4z"/><path d="m9 5 10 10-4 4L5 9M17 4v8M21 4v8M15 4h8M15 12h8"/>',
    "sport:multi-sport": '<path d="M8 3h8v4a4 4 0 0 1-8 0zM12 11v4M8 21h8M9 15h6v6H9z"/><path d="M8 5H4v1a4 4 0 0 0 4 4M16 5h4v1a4 4 0 0 1-4 4"/>',
    "sport:extreme": '<path d="M2 20h20"/><path d="M3 17h4l2-5 3.5 2 2.5-6 3 10 3.5-4 2.5 3h3.5"/><path d="M4 17l1.5-3M7.5 18l1-4M18 18l1.5-3"/>',
    "sport:surf": '<path d="M2.5 13.5c3-2.5 6-2 8 0.5s6 2.8 8.5 1"/><path d="M4 17.5c1.8-1.2 4-1 5.5 0.4s4.8 2 7.6 0"/><circle cx="6" cy="17.8" r="1.2" fill="none" stroke="currentColor"/><circle cx="17" cy="16" r="1.2" fill="none" stroke="currentColor"/><path d="M9.5 16.5l1.4-2.2M13 15.2l1.1-1.7"/>',
    "semantic:must-watch": '<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
    "semantic:rivalry": '<path d="M4 19 19 4M5 4l15 15M4 4h5v5M20 20h-5v-5"/>',
    "semantic:record-chase": '<path d="M4 20V14h4v6M10 20V9h4v11M16 20V4h4v16M3 20h18"/>',
    "semantic:title-decider": '<path d="M8 3h8v4a4 4 0 0 1-8 0zM12 11v5M8 21h8M9 16h6v5H9z"/><path d="M8 5H4v1a4 4 0 0 0 4 4M16 5h4v1a4 4 0 0 1-4 4"/>',
    "semantic:upset-watch": '<path d="M3 17 8 9l4 5 4-9 5 12M3 20h18"/>',
    "semantic:nrl-finals-trophy": '<path d="M7 3h10v4a5 5 0 0 1-10 0V3Z"/><path d="M7 5H3v2a4 4 0 0 0 4 4M17 5h4v2a4 4 0 0 1-4 4M12 12v5M8 21h8M9 17h6v4H9Z"/><path d="M9.5 6.5h5"/>',
  };

  const simpleIconBodies = {
    "social:instagram": '<path fill="currentColor" stroke="none" d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.264-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.74 0 12s.014 3.668.072 4.948c.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.74 24 12 24s3.668-.014 4.948-.072c4.354-.2 6.782-2.618 6.979-6.98C23.986 15.668 24 15.259 24 12s-.014-3.667-.072-4.947c-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zm0 10.162a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/>',
    "social:x": '<path fill="currentColor" stroke="none" d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>',
    "social:linkedin": '<path fill="currentColor" stroke="none" d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0z"/>',
  };

  const openUse = Object.freeze({
    ...Object.fromEntries(Object.entries(sporticon).map(([key, file]) => [key, Object.freeze({ key, assetClass: "open-use", rightsStatus: "open-use", provenance: "licensed-library", library: "Sporticon", license: "Apache-2.0", source: SPORTICON_SOURCE, path: `assets/icons/sporticon/${file}`, render: "mask" })])),
    ...Object.fromEntries(Object.keys(lucideBodies).map(key => [key, Object.freeze({ key, assetClass: "open-use", rightsStatus: "open-use", provenance: "licensed-library", library: "Lucide", license: "ISC", source: LUCIDE_SOURCE, render: "inline" })])),
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

  const custom = Object.freeze(Object.fromEntries(Object.keys(customBodies).map(key => [key, Object.freeze({ key, assetClass: "custom-semantic", rightsStatus: key.startsWith("sport:") ? "fallback" : "official", provenance: "first-party", owner: "nothingsport", render: "inline" })])));

  function escapeAttribute(value){
    return String(value || "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function inlineSvg(body, { label = "", className = "", preferImage = false } = {}){
    if (preferImage){
      const imageBody = String(body || "").replace(/currentColor/g, "#000000");
      const source = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#000000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${imageBody}</svg>`;
      const alternative = label ? `alt="${escapeAttribute(label)}"` : 'alt="" aria-hidden="true"';
      return `<img class="vector-glyph vector-image ${escapeAttribute(className)}" src="data:image/svg+xml,${encodeURIComponent(source)}" ${alternative} decoding="sync" draggable="false">`;
    }
    const accessibility = label ? `role="img" aria-label="${escapeAttribute(label)}"` : 'aria-hidden="true"';
    return `<svg class="vector-glyph vector-svg ${escapeAttribute(className)}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${accessibility}>${body}</svg>`;
  }

  function glyphMarkup(key, options = {}){
    const entry = openUse[key] || custom[key];
    if (!entry) return inlineSvg('<circle cx="12" cy="12" r="9"/><path d="M8 12h8"/>', options);
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
    return inlineSvg(`${lucideBodies["ui:bell"]}${overlays[normalised]}`, { ...options, label: options.label || `Reminder ${normalised}` });
  }

  return Object.freeze({
    schemaVersion: "vector-assets.v1",
    policy: Object.freeze({ protectedMarks: "neutral-fallback-unless-permission-recorded", commercialRecordings: "not-bundled" }),
    rightsMetadataKinds,
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
