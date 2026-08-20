(function attachNothingSportsCountryFlags(root, factory){
  const api = factory();
  root.NOTHINGSPORTS_COUNTRY_FLAGS = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function buildNothingSportsCountryFlags(){
  "use strict";

  const SCHEMA_VERSION = "country-flags.v1";
  const ASSET_SOURCE = Object.freeze({
    library: "flag-icons",
    version: "7.3.2",
    repository: "https://github.com/lipis/flag-icons",
    license: "MIT",
    noticePath: "assets/licenses/FLAG-ICONS-MIT.txt",
  });
  const ALPHA3_TO_ALPHA2 = Object.freeze({
    ARG: "AR", ARM: "AM", AUS: "AU", AUT: "AT", BEL: "BE", BLR: "BY", BOL: "BO", BRA: "BR", BUL: "BG",
    CAN: "CA", CHI: "CL", CHN: "CN", COL: "CO", CRO: "HR", CZE: "CZ", DEN: "DK", EGY: "EG", ESP: "ES",
    EST: "EE", FIN: "FI", FRA: "FR", GBR: "GB", GEO: "GE", GER: "DE", GRE: "GR", HKG: "HK", HUN: "HU",
    INA: "ID", ITA: "IT", JPN: "JP", KAZ: "KZ", KOR: "KR", LAT: "LV", MON: "MC", NED: "NL", NOR: "NO",
    PAR: "PY", PER: "PE", PHI: "PH", POL: "PL", POR: "PT", ROU: "RO", RUS: "RU", SLO: "SI", SRB: "RS",
    SUI: "CH", SVK: "SK", THA: "TH", TUN: "TN", TUR: "TR", UKR: "UA", USA: "US", UZB: "UZ",
  });
  const SUPPORTED_ALPHA2 = Object.freeze([...new Set(Object.values(ALPHA3_TO_ALPHA2))].sort());

  function escapeAttribute(value){
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function alpha2(countryCode){
    const normalized = String(countryCode || "").trim().toUpperCase();
    if (SUPPORTED_ALPHA2.includes(normalized)) return normalized;
    return ALPHA3_TO_ALPHA2[normalized] || null;
  }

  function countryName(countryCode){
    const normalized = alpha2(countryCode);
    if (!normalized) return "";
    try {
      return new Intl.DisplayNames(["en-AU"], { type: "region" }).of(normalized) || normalized;
    } catch (_error) {
      return normalized;
    }
  }

  function assetPath(countryCode){
    const normalized = alpha2(countryCode);
    return normalized ? `assets/flags/4x3/${normalized.toLowerCase()}.svg` : null;
  }

  function flagMarkup(countryCode, { className = "", label = "" } = {}){
    const path = assetPath(countryCode);
    if (!path) return "";
    const name = label || countryName(countryCode);
    const classes = ["country-flag", className].filter(Boolean).join(" ");
    return `<img class="${escapeAttribute(classes)}" src="${path}" alt="${escapeAttribute(name)} flag" title="${escapeAttribute(name)}" width="20" height="15" loading="lazy" decoding="async">`;
  }

  return Object.freeze({
    SCHEMA_VERSION,
    ASSET_SOURCE,
    ALPHA3_TO_ALPHA2,
    SUPPORTED_ALPHA2,
    alpha2,
    assetPath,
    countryName,
    flagMarkup,
  });
});
