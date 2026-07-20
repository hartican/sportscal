(function attachVectorAssets(root, factory){
  const assets = factory();
  root.NOTHINGSPORTS_VECTOR_ASSETS = assets;
  if (typeof module !== "undefined" && module.exports) module.exports = assets;
})(typeof globalThis !== "undefined" ? globalThis : window, function buildVectorAssets(){
  "use strict";

  const SPORTICON_SOURCE = "https://github.com/ookamiinc/sporticon";
  const LUCIDE_SOURCE = "https://github.com/lucide-icons/lucide";
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
    "ui:message": '<path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/>',
    "ui:map-pin": '<path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
    "ui:chevron-right": '<path d="m9 18 6-6-6-6"/>',
    "ui:plus": '<path d="M5 12h14M12 5v14"/>',
  };

  const customBodies = {
    "sport:cricket": '<path d="m7 3 4 4-5 5-4-4z"/><path d="m9 5 10 10-4 4L5 9M17 4v8M21 4v8M15 4h8M15 12h8"/>',
    "sport:multi-sport": '<path d="M8 3h8v4a4 4 0 0 1-8 0zM12 11v4M8 21h8M9 15h6v6H9z"/><path d="M8 5H4v1a4 4 0 0 0 4 4M16 5h4v1a4 4 0 0 1-4 4"/>',
    "semantic:must-watch": '<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
    "semantic:rivalry": '<path d="M4 19 19 4M5 4l15 15M4 4h5v5M20 20h-5v-5"/>',
    "semantic:record-chase": '<path d="M4 20V14h4v6M10 20V9h4v11M16 20V4h4v16M3 20h18"/>',
    "semantic:title-decider": '<path d="M8 3h8v4a4 4 0 0 1-8 0zM12 11v5M8 21h8M9 16h6v5H9z"/><path d="M8 5H4v1a4 4 0 0 0 4 4M16 5h4v1a4 4 0 0 1-4 4"/>',
    "semantic:upset-watch": '<path d="M3 17 8 9l4 5 4-9 5 12M3 20h18"/>',
  };

  const openUse = Object.freeze({
    ...Object.fromEntries(Object.entries(sporticon).map(([key, file]) => [key, Object.freeze({ key, assetClass: "open-use", rightsStatus: "open-use", provenance: "licensed-library", library: "Sporticon", license: "Apache-2.0", source: SPORTICON_SOURCE, path: `assets/icons/sporticon/${file}`, render: "mask" })])),
    ...Object.fromEntries(Object.keys(lucideBodies).map(key => [key, Object.freeze({ key, assetClass: "open-use", rightsStatus: "open-use", provenance: "licensed-library", library: "Lucide", license: "ISC", source: LUCIDE_SOURCE, render: "inline" })])),
  });

  const officialPermitted = Object.freeze({
    "brand:logo-day": Object.freeze({ key: "brand:logo-day", assetClass: "official-permitted", rightsStatus: "official", provenance: "first-party", owner: "nothingSports", path: "assets/brand/web/nothingsport-logo-day.png", permissionBasis: "first-party brand asset" }),
    "brand:logo-night": Object.freeze({ key: "brand:logo-night", assetClass: "official-permitted", rightsStatus: "official", provenance: "first-party", owner: "nothingSports", path: "assets/brand/web/nothingsport-logo-night.png", permissionBasis: "first-party brand asset" }),
    "brand:compact-day": Object.freeze({ key: "brand:compact-day", assetClass: "official-permitted", rightsStatus: "official", provenance: "first-party", owner: "nothingSports", path: "assets/brand/web/nothingsport-compact-icon-day.png", permissionBasis: "first-party brand asset" }),
    "brand:compact-night": Object.freeze({ key: "brand:compact-night", assetClass: "official-permitted", rightsStatus: "official", provenance: "first-party", owner: "nothingSports", path: "assets/brand/web/nothingsport-compact-icon-night.png", permissionBasis: "first-party brand asset" }),
    "brand:app-192": Object.freeze({ key: "brand:app-192", assetClass: "official-permitted", rightsStatus: "official", provenance: "first-party", owner: "nothingSports", path: "icons/nothingsport-helm-192.png", permissionBasis: "first-party brand asset" }),
    "brand:app-512": Object.freeze({ key: "brand:app-512", assetClass: "official-permitted", rightsStatus: "official", provenance: "first-party", owner: "nothingSports", path: "icons/nothingsport-helm-512.png", permissionBasis: "first-party brand asset" }),
  });

  const custom = Object.freeze(Object.fromEntries(Object.keys(customBodies).map(key => [key, Object.freeze({ key, assetClass: "custom-semantic", rightsStatus: key.startsWith("sport:") ? "fallback" : "official", provenance: "first-party", owner: "nothingSports", render: "inline" })])));

  function escapeAttribute(value){
    return String(value || "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function inlineSvg(body, { label = "", className = "" } = {}){
    const accessibility = label ? `role="img" aria-label="${escapeAttribute(label)}"` : 'aria-hidden="true"';
    return `<svg class="vector-glyph vector-svg ${escapeAttribute(className)}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${accessibility}>${body}</svg>`;
  }

  function glyphMarkup(key, options = {}){
    const entry = openUse[key] || custom[key];
    if (!entry) return inlineSvg('<circle cx="12" cy="12" r="9"/><path d="M8 12h8"/>', options);
    if (entry.render === "mask"){
      const accessibility = options.label ? `role="img" aria-label="${escapeAttribute(options.label)}"` : 'aria-hidden="true"';
      return `<span class="vector-glyph vector-mask ${escapeAttribute(options.className || "")}" style="--glyph-url:url('${escapeAttribute(entry.path)}')" ${accessibility}></span>`;
    }
    return inlineSvg(lucideBodies[key] || customBodies[key], options);
  }

  const editorialKeys = Object.freeze({
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
