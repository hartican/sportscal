(function attachNothingSportsBrand(root){
  const brand = Object.freeze({
    version: "nothingsport-brand.v9",
    name: "nothingsport",
    title: "Nothingsport — Smart sports feed",
    descriptor: "Live sport, nothing missed.",
    loadingDescriptor: "Live sport, nothing missed.",
    hero: "Live sport, nothing missed.",
    about: "nothingsport is a live sports curator, tailored to your tastes. Your Feed is built from the sports, teams and players you follow, plus Australian representatives in international competition when that global setting is on. A dislike removes that exact card and softly tunes future suggestions; a like gently lifts related suggestions without changing complete fixture lists. Open Events to choose special fixtures early, or Standings & Fixtures for the complete timetable and ladder context.",
    metadataDescription: "Live sport, nothing missed.",
    onboardingDescription: "Choose your sports and Australia-in-internationals seed once, then refine teams and players in Follow.",
    emptyStateDescription: "Nothing in your current filter deserves your time right now.",
    timezoneDescription: "Built around AEST/AEDT by default, with other time zones supported as your profile travels.",
  });

  root.NOTHINGSPORTS_BRAND = brand;
  if (typeof module !== "undefined" && module.exports) module.exports = brand;
})(typeof globalThis !== "undefined" ? globalThis : window);
