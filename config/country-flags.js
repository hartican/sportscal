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
    ALB: "AL", ALG: "DZ", ANG: "AO", ARG: "AR", ARM: "AM", AUS: "AU", AUT: "AT", BEL: "BE", BEN: "BJ",
    BFA: "BF", BIH: "BA", BLR: "BY", BOL: "BO", BRA: "BR", BUL: "BG", CAN: "CA", CHI: "CL", CHN: "CN",
    CIV: "CI", COL: "CO", CPV: "CV", CRO: "HR", CZE: "CZ", DEN: "DK", DOM: "DO", ECU: "EC", EGY: "EG",
    ESP: "ES", EST: "EE", FIN: "FI", FRA: "FR", GAB: "GA", GAM: "GM", GBR: "GB", GEO: "GE", GER: "DE",
    GHA: "GH", GRE: "GR", GUI: "GN", HAI: "HT", HKG: "HK", HUN: "HU", INA: "ID", IRL: "IE", ISL: "IS",
    ISR: "IL", ITA: "IT", JAM: "JM", JPN: "JP", KAZ: "KZ", KOR: "KR", LAT: "LV", MAR: "MA", MEX: "MX",
    MKD: "MK", MLI: "ML", MON: "MC", MOZ: "MZ", NED: "NL", NGA: "NG", NOR: "NO", NZL: "NZ", PAR: "PY",
    PER: "PE", PHI: "PH", POL: "PL", POR: "PT", ROU: "RO", RUS: "RU", SEN: "SN", SLO: "SI", SRB: "RS",
    SUI: "CH", SVK: "SK", SWE: "SE", THA: "TH", TOG: "TG", TUN: "TN", TUR: "TR", UKR: "UA", URU: "UY",
    USA: "US", UZB: "UZ", VEN: "VE", ZAM: "ZM",
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
