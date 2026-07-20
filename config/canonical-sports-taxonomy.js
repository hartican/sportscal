(function attachCanonicalSportsTaxonomy(root, factory){
  const taxonomy = factory();
  root.NOTHINGSPORTS_CANONICAL_TAXONOMY = taxonomy;
  if (typeof module !== "undefined" && module.exports) module.exports = taxonomy;
})(typeof globalThis !== "undefined" ? globalThis : window, function buildCanonicalSportsTaxonomy(){
  "use strict";

  const sportDomains = [
    {
      id: "sport:afl",
      slug: "afl",
      name: "AFL",
      kind: "sport",
      sortOrder: 10,
      isActive: true,
      supportsLadders: true,
      supportsAllFixtures: true,
      supportsNarrative: true,
      supportsTeams: true,
      supportsAthletes: false,
      defaultTemplateId: "template:like",
      metadata: { governingBody: "Australian Football League", region: "AU" },
    },
    {
      id: "sport:nrl",
      slug: "nrl",
      name: "NRL",
      kind: "sport",
      sortOrder: 20,
      isActive: true,
      supportsLadders: true,
      supportsAllFixtures: true,
      supportsNarrative: true,
      supportsTeams: true,
      supportsAthletes: false,
      defaultTemplateId: "template:like",
      metadata: { governingBody: "National Rugby League", region: "AU" },
    },
  ];

  const competitionFamilies = [
    {
      id: "family:afl-premiership",
      sportDomainId: "sport:afl",
      slug: "afl-premiership",
      name: "AFL Premiership",
      familyType: "league",
      sortOrder: 10,
      isActive: true,
    },
    {
      id: "family:nrl-premiership",
      sportDomainId: "sport:nrl",
      slug: "nrl-premiership",
      name: "NRL Premiership",
      familyType: "league",
      sortOrder: 20,
      isActive: true,
    },
  ];

  const competitions = [
    {
      id: "competition:afl-premiership-2026",
      sportDomainId: "sport:afl",
      competitionFamilyId: "family:afl-premiership",
      slug: "afl-premiership-2026",
      name: "2026 Toyota AFL Premiership",
      competitionType: "seasonLeague",
      seasonLabel: "2026",
      region: "AU",
      gender: "mens",
      supportsLadder: true,
      supportsTeams: true,
      supportsAthletes: false,
      isSpecialEvent: false,
      source: {
        provider: "AFL",
        competitionId: 1,
        sourceUrl: "https://www.afl.com.au/fixture",
      },
    },
    {
      id: "competition:nrl-premiership-2026",
      sportDomainId: "sport:nrl",
      competitionFamilyId: "family:nrl-premiership",
      slug: "nrl-premiership-2026",
      name: "2026 NRL Telstra Premiership",
      competitionType: "seasonLeague",
      seasonLabel: "2026",
      region: "AU",
      gender: "mens",
      supportsLadder: true,
      supportsTeams: true,
      supportsAthletes: false,
      isSpecialEvent: false,
      source: {
        provider: "NRL Match Centre / Champion Data",
        competitionId: 12999,
        sourceUrl: "https://www.nrl.com/draw",
      },
    },
  ];

  return Object.freeze({
    schemaVersion: "sports-taxonomy.v1",
    sportDomains: Object.freeze(sportDomains.map(Object.freeze)),
    competitionFamilies: Object.freeze(competitionFamilies.map(Object.freeze)),
    competitions: Object.freeze(competitions.map(Object.freeze)),
  });
});
