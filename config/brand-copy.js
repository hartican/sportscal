(function attachNothingSportsBrand(root){
  const brand = Object.freeze({
    version: "nothingsport-brand.v7",
    name: "nothingsport",
    title: "Nothingsport — Smart sports feed",
    descriptor: "Live sports curator, tailored to your tastes. Like having a sports-fanatic mate in your pocket.",
    hero: "The sports-fanatic mate who knows what you’re into.",
    about: "nothingsport builds your feed only from teams, players and Aussies Only follows. Sport and major-event choices organise the rest of the app without becoming hidden Feed rules. Likes and dislikes are saved as feedback for future recommendations without changing today’s feed. Open Standings & Fixtures for the complete code-level timetable and ladder context.",
    metadataDescription: "Live sports curator, tailored to your tastes. Like having a sports-fanatic mate in your pocket.",
    onboardingDescription: "Choose your sports and Aussies Only seed once, then refine teams and players in Follow.",
    emptyStateDescription: "Nothing in your current filter deserves your time right now.",
    timezoneDescription: "Built around AEST/AEDT by default, with other time zones supported as your profile travels.",
  });

  root.NOTHINGSPORTS_BRAND = brand;
  if (typeof module !== "undefined" && module.exports) module.exports = brand;
})(typeof globalThis !== "undefined" ? globalThis : window);
