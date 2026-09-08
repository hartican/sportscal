(function attachNothingSportsBrand(root){
  const brand = Object.freeze({
    version: "nothingsport-brand.v12",
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
    about: "Nothing Sport is a live sports curator, tailored to your tastes. Follow a sport for its finals and marquee fixtures, or a team or athlete for all their known fixtures. Australian discovery adds fixtures with Australian participants where that filter is useful. Ratings never decide whether a followed fixture appears. Dismiss removes that exact card without changing your follows. Open Events for tournaments, Follow for each sport’s Schedule, Ladder and Standings, or Settings for All Followed.",
    countryAcknowledgement: "Nothing Sport acknowledges the Yuin Nation, the Traditional Custodians of the land on which this app was built. Always was, always will be Aboriginal land. Voice. Treaty. Truth.",
    metadataDescription: "Live sport, nothing missed.",
    onboardingDescription: "Choose your sports and Australia-in-internationals seed once, then refine teams and players in Follow.",
    emptyStateDescription: "No known fixtures match your current follows and filters.",
    timezoneDescription: "Built around AEST/AEDT by default, with other time zones supported as your profile travels.",
  });

  root.NOTHINGSPORTS_BRAND = brand;
  if (typeof module !== "undefined" && module.exports) module.exports = brand;
})(typeof globalThis !== "undefined" ? globalThis : window);
