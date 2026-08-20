(function attachCincinnatiReportingSources(root, factory){
  const api = factory();
  root.NOTHINGSPORTS_CINCINNATI_REPORTING_SOURCES = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function buildCincinnatiReportingSources(){
  "use strict";

  const VERSION = "cincinnati-reporting-sources.v2";
  const RAIN_BASE = "https://tennis-feeds.rain-digital.ca/get";
  const SOURCES = Object.freeze([
    Object.freeze({
      id: "cincinnati-rain-oop-mixed",
      label: "Cincinnati Open",
      url: `${RAIN_BASE}/cincinnati/oop-mixed`,
      pageRole: "structured-schedule",
      responseFormat: "json",
      sourceTrust: "verified",
      reliabilityRank: 1,
    }),
    ...["atp", "wta"].flatMap(tour => [
      Object.freeze({
        id: `cincinnati-rain-${tour}-live`,
        label: "Cincinnati Open",
        url: `${RAIN_BASE}/${tour}/cincinnati/live`,
        pageRole: "structured-results",
        responseFormat: "json",
        sourceTrust: "verified",
        reliabilityRank: 1,
        tour: tour.toUpperCase(),
      }),
      Object.freeze({
        id: `cincinnati-rain-${tour}-draws`,
        label: "Cincinnati Open",
        url: `${RAIN_BASE}/${tour}/cincinnati/draws`,
        pageRole: "structured-results",
        responseFormat: "json",
        sourceTrust: "verified",
        reliabilityRank: 1,
        tour: tour.toUpperCase(),
      }),
    ]),
    Object.freeze({
      id: "cincinnati-recaps-api",
      label: "Cincinnati Open",
      url: "https://cincinnatiopen.com/wp-json/wp/v2/posts?categories=27&per_page=20&_fields=id,date_gmt,modified_gmt,link,slug,title,excerpt,content,categories",
      pageRole: "reporting-api",
      responseFormat: "json",
      sourceTrust: "verified",
      reliabilityRank: 1,
    }),
    Object.freeze({
      id: "cincinnati-posts-api",
      label: "Cincinnati Open",
      url: "https://cincinnatiopen.com/wp-json/wp/v2/posts?per_page=20&_fields=id,date_gmt,modified_gmt,link,slug,title,excerpt,content,categories",
      pageRole: "reporting-api",
      responseFormat: "json",
      sourceTrust: "verified",
      reliabilityRank: 1,
    }),
    Object.freeze({
      id: "wta-cincinnati-2026",
      label: "WTA",
      url: "https://www.wtatennis.com/tournaments/1017/cincinnati/2026/scores",
      pageRole: "results-and-reporting",
      responseFormat: "html",
      sourceTrust: "verified",
      reliabilityRank: 2,
      linkPathPattern: "^/(?:news|videos)/",
    }),
    Object.freeze({
      id: "wta-highlights",
      label: "WTA",
      url: "https://www.wtatennis.com/videos/highlights",
      pageRole: "reporting-index",
      responseFormat: "html",
      sourceTrust: "verified",
      reliabilityRank: 2,
      linkPathPattern: "^/videos/[0-9]+/",
    }),
    ...[1, 2].map(competitionType => Object.freeze({
      id: `espn-cincinnati-${competitionType === 1 ? "men" : "women"}-2026`,
      label: "ESPN",
      url: `https://www.espn.com/tennis/scoreboard/tournament/_/eventId/718-2026/competitionType/${competitionType}`,
      pageRole: "structured-results",
      responseFormat: "html",
      sourceTrust: "unverified",
      reliabilityRank: 3,
    })),
  ]);

  function validateSource(source){
    const url = new URL(source?.url || "");
    if (url.protocol !== "https:") throw new Error(`Cincinnati reporting source must use HTTPS: ${url.href}`);
    if (!source.id || !source.label) throw new Error("Cincinnati reporting sources need stable IDs and labels");
    if (!["verified", "unverified"].includes(source.sourceTrust)) throw new Error(`${source.id} has an invalid source trust class`);
    if (!["html", "json"].includes(source.responseFormat)) throw new Error(`${source.id} has an invalid response format`);
    if (!Number.isInteger(source.reliabilityRank) || source.reliabilityRank < 1 || source.reliabilityRank > 4) throw new Error(`${source.id} has an invalid reliability rank`);
    if (source.tour && !["ATP", "WTA"].includes(source.tour)) throw new Error(`${source.id} has an invalid tennis tour`);
    return source;
  }

  SOURCES.forEach(validateSource);
  return Object.freeze({ VERSION, RAIN_BASE, SOURCES, validateSource });
});
