(function attachNothingSportsBrand(root){
  const brand = Object.freeze({
    version: "nothingsport-brand.v11",
    name: "Nothing Sport",
    officialName: "Nothing Sport",
    stylisedName: "nothing SPORT",
    title: "Nothing Sport — Smart sports feed",
    copyright: "Copyright ©\u00A02026\u00A0Nothing Sport. All Rights Reserved.",
    social: Object.freeze({
      instagram: Object.freeze({ handle: "@_nothingsport", url: "https://www.instagram.com/_nothingsport/", status: "active" }),
      x: Object.freeze({ handle: "@nothingsport", status: "coming soon" }),
      linkedin: Object.freeze({ handle: "@nothingsport", status: "coming soon" }),
    }),
    descriptor: "Live sport, nothing missed.",
    loadingDescriptor: "Live sport, nothing missed.",
    hero: "Live sport, nothing missed.",
    about: "Nothing Sport is a live sports curator, tailored to your tastes. Your Feed is built from the sports, teams and players you follow, plus Australian representatives in international competition when that global setting is on. Dismiss removes that exact card without changing your follows. A Like appears only on a high-stakes suggestion that did not come from a follow. Open Events to choose special fixtures early, or Follow for each sport’s Schedule, Ladder and Standings.",
    countryAcknowledgement: "Nothing Sport acknowledges the Yuin Nation, the Traditional Custodians of the land on which this app was built. Always was, always will be Aboriginal land. Voice. Treaty. Truth.",
    metadataDescription: "Live sport, nothing missed.",
    onboardingDescription: "Choose your sports and Australia-in-internationals seed once, then refine teams and players in Follow.",
    emptyStateDescription: "Nothing in your current filter deserves your time right now.",
    timezoneDescription: "Built around AEST/AEDT by default, with other time zones supported as your profile travels.",
  });

  root.NOTHINGSPORTS_BRAND = brand;
  if (typeof module !== "undefined" && module.exports) module.exports = brand;
})(typeof globalThis !== "undefined" ? globalThis : window);
