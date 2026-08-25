(function attachNothingSportsBrand(root){
  const brand = Object.freeze({
    version: "nothingsport-brand.v8",
    name: "nothingsport",
    title: "Nothingsport — Smart sports feed",
    descriptor: "Like having a sports-fanatic in your pocket.",
    loadingDescriptor: "Like having a sports-fanatic in your pocket.",
    hero: "Like having a sports-fanatic in your pocket.",
    about: "nothingsport is a live sports curator, tailored to your tastes. Your Feed is built from the sports, teams and players you follow, plus Australian representatives in international competition when that global setting is on. Likes and dislikes are saved as feedback for future recommendations without changing today’s Feed rules. Open Events to choose special fixtures early, or Standings & Fixtures for the complete timetable and ladder context.",
    metadataDescription: "Like having a sports-fanatic in your pocket.",
    onboardingDescription: "Choose your sports and Australia-in-internationals seed once, then refine teams and players in Follow.",
    emptyStateDescription: "Nothing in your current filter deserves your time right now.",
    timezoneDescription: "Built around AEST/AEDT by default, with other time zones supported as your profile travels.",
  });

  root.NOTHINGSPORTS_BRAND = brand;
  if (typeof module !== "undefined" && module.exports) module.exports = brand;
})(typeof globalThis !== "undefined" ? globalThis : window);
